import re
from typing import Dict, Any, List
from langchain_core.messages import SystemMessage, HumanMessage
from langchain_ollama import ChatOllama
from engine.pbs_parser import PBSParser
from engine.type_chart import TypeChart, SPANISH_TYPE_NAMES, TYPE_COLORS
from engine.showdown import ShowdownExporter
from engine.indexing import get_vectorstore
from graph.state import PokeState

parser = PBSParser()
type_chart = TypeChart(parser.types)
exporter = ShowdownExporter(parser)

# Pre-compile a map of lowercase names for instant detection
POKEMON_NAMES_MAP = {name.lower(): p for name, p in parser.pokemon.items() if len(name) > 2}

def classify_intent_node(state: PokeState) -> Dict[str, Any]:
    query = state["query"].lower()
    
    # Detect mentioned pokemon
    detected = []
    # Tokenize words to match against pokemon names
    tokens = re.findall(r'[a-zA-ZáéíóúÁÉÍÓÚñÑ]+', query)
    for token in tokens:
        token_clean = token.lower()
        if token_clean in POKEMON_NAMES_MAP:
            p_obj = POKEMON_NAMES_MAP[token_clean]
            if p_obj["name"] not in detected:
                detected.append(p_obj["name"])

    # Detect intent
    if any(k in query for k in ["showdown", "exportar", "paste", "copiar equipo"]):
        intent = "showdown_export"
    elif any(k in query for k in ["añadir", "agrega", "meter", "incluir", "pon a", "sumar a"]):
        intent = "add_team"
    elif any(k in query for k in ["quitar", "elimina", "sacar", "borra a"]):
        intent = "remove_team"
    elif any(k in query for k in ["equipo", "sinergia", "mi team", "auditoría", "vulnerabilidad del equipo"]):
        intent = "team_audit"
    elif any(k in query for k in ["debilidad", "debilidades", "resistencias", "inmunidad", "efectividad", "counter", "counters", "vulnerable"]):
        intent = "matchup"
    elif detected or any(k in query for k in ["stats", "estadisticas", "ataque", "velocidad", "movimientos", "habilidad", "info", "ficha"]):
        intent = "pokedex"
    else:
        intent = "general"

    return {
        "intent": intent,
        "detected_pokemon": detected
    }

def pokedex_node(state: PokeState) -> Dict[str, Any]:
    detected = state.get("detected_pokemon", [])
    context_parts = []

    for p_name in detected:
        pkmn = parser.get_pokemon(p_name)
        if not pkmn:
            continue

        role = exporter.determine_role(pkmn)
        bs = pkmn["base_stats"]
        bst = pkmn["bst"]
        moves = exporter.select_competitive_moves(pkmn, role)
        
        t1_es = SPANISH_TYPE_NAMES.get(pkmn["type1"], pkmn["type1"])
        t2_es = f" / {SPANISH_TYPE_NAMES.get(pkmn['type2'], pkmn['type2'])}" if pkmn.get("type2") else ""

        context_parts.append(f"""### Ficha Técnica: {pkmn['name']} (#{pkmn['id']})
- **Tipos**: {t1_es}{t2_es}
- **Rol Competitivo**: {role}
- **Estadísticas Base**: PS: {bs['hp']} | Atq: {bs['attack']} | Def: {bs['defense']} | Atq.Esp: {bs['sp_attack']} | Def.Esp: {bs['sp_defense']} | Vel: {bs['speed']} (BST: {bst})
- **Movimientos Recomendados**: {', '.join(moves)}
- **Habilidades**: {', '.join(pkmn['abilities'])} | Oculta: {pkmn.get('hidden_ability') or 'Ninguna'}
""")

    # If no specific pokemon was matched, perform a ChromaDB semantic search
    if not detected:
        try:
            vs = get_vectorstore()
            results = vs.similarity_search(state["query"], k=3)
            if results:
                context_parts.append("### Resultados semánticos relevantes:")
                for r in results:
                    context_parts.append(r.page_content)
        except Exception:
            pass

    return {"context": "\n".join(context_parts)}

def matchup_node(state: PokeState) -> Dict[str, Any]:
    detected = state.get("detected_pokemon", [])
    context_parts = []

    for p_name in detected:
        pkmn = parser.get_pokemon(p_name)
        if not pkmn:
            continue

        matchups = type_chart.get_matchups(pkmn["type1"], pkmn.get("type2"))
        w4 = [f"{SPANISH_TYPE_NAMES.get(t, t)} (x4)" for t in matchups["weaknesses_4x"]]
        w2 = [f"{SPANISH_TYPE_NAMES.get(t, t)} (x2)" for t in matchups["weaknesses_2x"]]
        res = [f"{SPANISH_TYPE_NAMES.get(t, t)}" for t in matchups["resistances"]]
        imm = [f"{SPANISH_TYPE_NAMES.get(t, t)}" for t in matchups["immunities"]]

        context_parts.append(f"""### Análisis de Tipos: {pkmn['name']}
- **Debilidades Críticas (x4)**: {', '.join(w4) if w4 else 'Ninguna'}
- **Debilidades (x2)**: {', '.join(w2) if w2 else 'Ninguna'}
- **Resistencias**: {', '.join(res) if res else 'Ninguna'}
- **Inmunidades (x0 daño)**: {', '.join(imm) if imm else 'Ninguna'}
""")

    return {"context": "\n".join(context_parts)}

def team_manager_node(state: PokeState) -> Dict[str, Any]:
    team = list(state.get("team", []))
    detected = state.get("detected_pokemon", [])
    intent = state.get("intent")
    system_notes = []

    if intent == "add_team":
        for p_name in detected:
            pkmn = parser.get_pokemon(p_name)
            if not pkmn:
                continue
            if any(p["name"].lower() == pkmn["name"].lower() for p in team):
                system_notes.append(f"{pkmn['name']} ya está en tu equipo.")
            elif len(team) >= 6:
                system_notes.append("El equipo ya tiene 6 Pokémon (máximo alcanzado).")
            else:
                team.append(pkmn)
                system_notes.append(f"✅ Se ha añadido a **{pkmn['name']}** al equipo ({len(team)}/6).")

    elif intent == "remove_team":
        for p_name in detected:
            initial_len = len(team)
            team = [p for p in team if p["name"].lower() != p_name.lower()]
            if len(team) < initial_len:
                system_notes.append(f"❌ Se ha eliminado a **{p_name}** del equipo ({len(team)}/6).")

    # Team Audit
    context_parts = list(system_notes)
    if team:
        audit = type_chart.audit_team(team)
        member_summaries = [f"{p['name']} ({SPANISH_TYPE_NAMES.get(p['type1'], p['type1'])}{' / ' + SPANISH_TYPE_NAMES.get(p['type2'], p['type2']) if p.get('type2') else ''})" for p in team]
        context_parts.append(f"### Equipo Actual ({len(team)}/6):\n" + "\n".join(f"- {m}" for m in member_summaries))

        if audit["critical_vulnerabilities"]:
            context_parts.append("\n⚠️ **Vulnerabilidades Críticas Detectadas:**")
            for cv in audit["critical_vulnerabilities"]:
                context_parts.append(f"- Tipo **{cv['type_name_es']}**: {cv['weak_count']} miembros débiles y solo {cv['resist_count']} resistencias.")
        else:
            context_parts.append("\n✨ El equipo tiene un buen equilibrio defensivo sin vulnerabilidades compartidas críticas.")

        if audit["uncovered_types_offensively"]:
            uncovered_es = [SPANISH_TYPE_NAMES.get(t, t) for t in audit["uncovered_types_offensively"][:4]]
            context_parts.append(f"🎯 **Tipos sin cobertura ofensiva STAB super-eficaz**: {', '.join(uncovered_es)}.")
    else:
        context_parts.append("Actualmente no tienes ningún Pokémon en tu equipo activo. Añade uno diciendo por ejemplo: 'Añade a Gengar a mi equipo'.")

    return {
        "team": team,
        "context": "\n".join(context_parts)
    }

def showdown_node(state: PokeState) -> Dict[str, Any]:
    team = state.get("team", [])
    if not team:
        return {"context": "No hay ningún Pokémon en el equipo para exportar. Añade Pokémon a tu equipo primero."}

    paste = exporter.export_team(team)
    context = f"""### Formato Pokémon Showdown Generado:
```text
{paste}
```
*Copia el bloque anterior para importarlo directamente en el Teambuilder de Pokémon Showdown.*"""
    return {"context": context}

def synthesizer_node(state: PokeState) -> Dict[str, Any]:
    context = state.get("context", "")
    query = state.get("query", "")
    team = state.get("team", [])
    team_summary = ", ".join([p["name"] for p in team]) if team else "Ninguno"

    system_prompt = f"""Eres PokeEstratega-AI, el Asistente y Coach de Combate Competitivo definitivo de Pokémon.
Tu objetivo es dar consejos estratégicos de alto nivel (tiers OU/VGC, roles como Sweeper, Wall, Pivot, sinergias de tipos y sets competitivos).

DATOS EXACTOS VERIFICADOS (Calculados matemáticamente):
{context}

ESTADO DEL EQUIPO DEL USUARIO ({len(team)}/6):
{team_summary}

DIRECTRICES:
1. Sé conciso, profesional y entusiasta como un estratega veterano.
2. Si se han calculado debilidades o stats, básate estrictamente en los datos verificados proporcionados (no inventes números ni tipos).
3. Si el usuario pide añadir o quitar miembros o exportar a Showdown, confirma la acción claramente y ofrece una sugerencia táctica para complementar el equipo.
4. Responde en español."""

    try:
        llm = ChatOllama(model="llama3.1:8b", base_url="http://localhost:11434", temperature=0.2)
        response = llm.invoke([
            SystemMessage(content=system_prompt),
            HumanMessage(content=query)
        ])
        res_text = response.content
    except Exception as e:
        # Fallback if Ollama is busy or not loaded
        res_text = f"{context}\n\n*(Nota técnica: Datos verificados generados por el motor determinista)*"

    return {"response": res_text}
