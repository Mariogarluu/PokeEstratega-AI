import os
import re
import difflib
from typing import Dict, Any, List
from dotenv import load_dotenv
from langchain_core.messages import SystemMessage, HumanMessage
from langchain_ollama import ChatOllama
try:
    from langchain_groq import ChatGroq
except ImportError:
    ChatGroq = None

from engine.pbs_parser import PBSParser
from engine.type_chart import TypeChart, SPANISH_TYPE_NAMES, TYPE_COLORS
from engine.showdown import ShowdownExporter
from engine.indexing import get_vectorstore
from graph.state import PokeState

ENV_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")
load_dotenv(ENV_PATH)
load_dotenv()

parser = PBSParser()
type_chart = TypeChart(parser.types)
exporter = ShowdownExporter(parser)

# Pre-compile a map of lowercase names for instant detection
POKEMON_NAMES_MAP = {name.lower(): p for name, p in parser.pokemon.items() if len(name) > 2}

def classify_intent_node(state: PokeState) -> Dict[str, Any]:
    query = state["query"].lower()
    last_pkmn = state.get("last_pokemon")
    
    # 1. Detect mentioned pokemon (exact and fuzzy matching for typos)
    detected = []
    tokens = re.findall(r'[a-zA-ZáéíóúÁÉÍÓÚñÑ]+', query)
    for token in tokens:
        token_clean = token.lower()
        if token_clean in POKEMON_NAMES_MAP:
            p_obj = POKEMON_NAMES_MAP[token_clean]
            if p_obj["name"] not in detected:
                detected.append(p_obj["name"])
        elif len(token_clean) >= 5:
            close = difflib.get_close_matches(token_clean, POKEMON_NAMES_MAP.keys(), n=1, cutoff=0.74)
            if close:
                p_obj = POKEMON_NAMES_MAP[close[0]]
                if p_obj["name"] not in detected:
                    detected.append(p_obj["name"])

    # 2. Contextual pronoun / reference resolution (e.g. "añadelo al equipo", "ponlo", "agregalo")
    if not detected and last_pkmn:
        pronoun_triggers = [
            "añadelo", "añádelo", "ponlo", "agregalo", "agrégalo", "metelo", "mételo",
            "incluyelo", "inclúyelo", "este", "ese", "al equipo", "al team", "en el equipo", "en mi equipo"
        ]
        if any(pt in query for pt in pronoun_triggers):
            detected = [last_pkmn]

    # 3. Detect intent using flexible word stems
    add_stems = ["añad", "agreg", "met", "inclu", "sum", "pon", "mete", "incorpor"]
    remove_stems = ["quit", "elimin", "sac", "borr"]
    off_topic_indicators = [
        "bucle", "python", "javascript", "c++", "java", "html", "css", "react", "código", "codigo",
        "programar", "programacion", "programación", "script", "algoritmo", "sql", "database",
        "redaccion", "redacción", "ensayo", "tarea de historia", "resuelveme", "ecuacion", "ecuación"
    ]

    if any(k in query for k in ["showdown", "exportar", "paste", "copiar equipo"]):
        intent = "showdown_export"
    elif any(k in query for k in remove_stems):
        intent = "remove_team"
    elif any(k in query for k in add_stems) and (detected or any(w in query for w in ["equipo", "team", "lineup"])):
        intent = "add_team"
    elif any(k in query for k in ["equipo", "sinergia", "mi team", "auditoría", "auditoria", "vulnerabilidad del equipo"]):
        intent = "team_audit"
    elif any(k in query for k in ["debilidad", "debilidades", "resistencias", "inmunidad", "efectividad", "counter", "counters", "vulnerable"]):
        intent = "matchup"
    elif detected or any(k in query for k in ["stats", "estadisticas", "ataque", "velocidad", "defensa", "movimientos", "habilidad", "info", "ficha", "build", "set", "tanque", "defensivo", "ofensivo"]):
        intent = "pokedex"
    elif not detected and any(ot in query for ot in off_topic_indicators):
        intent = "off_topic"
    else:
        intent = "general"

    return {
        "intent": intent,
        "detected_pokemon": detected,
        "last_pokemon": detected[0] if detected else last_pkmn
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
    query_lower = state.get("query", "").lower()

    if intent == "add_team":
        if not detected:
            system_notes.append("¿A qué Pokémon deseas añadir? No he detectado ningún Pokémon en tu petición.")
        for p_name in detected:
            pkmn = parser.get_pokemon(p_name)
            if not pkmn:
                continue
            if any(p["name"].lower() == pkmn["name"].lower() for p in team):
                system_notes.append(f"{pkmn['name']} ya está en tu equipo.")
            elif len(team) >= 6:
                system_notes.append("El equipo ya tiene 6 Pokémon (máximo alcanzado).")
            else:
                entry = dict(pkmn)
                # Check for customized build keywords (defensivo, tanque, sweeper, etc.)
                if any(w in query_lower for w in ["defens", "tanque", "wall", "aguant"]):
                    is_phys = pkmn["base_stats"]["defense"] >= pkmn["base_stats"]["sp_defense"]
                    entry["role"] = "Physical Wall" if is_phys else "Special Wall"
                    entry["nature"] = "Impish" if is_phys else "Calm"
                    entry["item"] = "Leftovers"
                    entry["moves_custom"] = exporter.select_competitive_moves(pkmn, entry["role"])
                elif any(w in query_lower for w in ["ofensiv", "sweeper", "atacante", "rapido", "rápido"]):
                    is_phys = pkmn["base_stats"]["attack"] >= pkmn["base_stats"]["sp_attack"]
                    entry["role"] = "Physical Sweeper" if is_phys else "Special Sweeper"
                    entry["nature"] = "Jolly" if is_phys else "Timid"
                    entry["item"] = "Life Orb"
                    entry["moves_custom"] = exporter.select_competitive_moves(pkmn, entry["role"])

                team.append(entry)
                build_label = f" ({entry.get('role', 'Estándar')})" if "role" in entry and entry.get("role") != exporter.determine_role(pkmn) else ""
                system_notes.append(f"✅ Se ha añadido a **{pkmn['name']}**{build_label} al equipo ({len(team)}/6).")

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
    intent = state.get("intent", "general")
    if intent == "off_topic":
        return {
            "response": "¡Alto ahí, Entrenador! 🛑 Mi base de datos táctica y sensores están dedicados exclusivamente al universo Pokémon y a la estrategia de combate en **Pokémon Añil**.\n\nNo tengo conocimientos ni respondo sobre programación, código (como bucles de Python) ni otros temas ajenos a Pokémon. Si necesitas calcular debilidades de tipos, consultar fichas técnicas de Pokémon o armar tu equipo competitivo de 6, ¡aquí me tienes listo para el combate!"
        }

    context = state.get("context", "")
    query = state.get("query", "")
    team = state.get("team", [])
    team_summary = ", ".join([f"{p['name']} ({SPANISH_TYPE_NAMES.get(p.get('type1'), p.get('type1'))})" for p in team]) if team else "Ninguno"

    system_prompt = f"""Eres PokeEstratega-AI, el Asistente y Coach de Combate Competitivo definitivo de Pokémon (especializado en Pokémon Añil).
Tu ÚNICO propósito es la estrategia, combate, análisis de debilidades, teambuilding y datos del universo Pokémon.

DATOS EXACTOS VERIFICADOS (Calculados matemáticamente):
{context}

ESTADO DEL EQUIPO DEL USUARIO ({len(team)}/6):
{team_summary}

REGLAS ESTRICTAS DE SEGURIDAD Y DOMINIO (GUARDRAILS):
1. REGLA FUNDAMENTAL: Eres EXCLUSIVAMENTE un asistente de combate y teambuilding Pokémon. TIENES TOTALMENTE PROHIBIDO responder preguntas sobre programación (Python, bucles, desarrollo web, etc.), tareas académicas, matemáticas ajenas a Pokémon, o cualquier tema fuera del universo Pokémon.
2. Si el usuario te pregunta sobre cualquier tema que no sea Pokémon (por ejemplo: "cómo hago un bucle en Python", "hazme una redacción", etc.), DEBES RECHAZAR la consulta educadamente pero de forma tajante y con personalidad de entrenador Pokémon.
3. Si la consulta sí es sobre Pokémon, sé conciso, profesional y entusiasta como un estratega veterano.
4. Si se han calculado debilidades o stats, básate estrictamente en los datos verificados proporcionados (no inventes números ni tipos).
5. Si el usuario pide añadir o quitar miembros o exportar a Showdown, confirma la acción claramente y ofrece una sugerencia táctica para complementar el equipo.
6. Responde siempre en español."""

    res_text = ""
    groq_api_key = os.getenv("GROQ_API_KEY", "").strip()
    groq_model = os.getenv("GROQ_MODEL", "qwen/qwen3.8-27b").strip()

    # 1. Primary: Ultra-fast Cloud Groq LLM
    if groq_api_key and ChatGroq:
        try:
            llm = ChatGroq(
                groq_api_key=groq_api_key,
                model_name=groq_model,
                temperature=0.3
            )
            response = llm.invoke([
                SystemMessage(content=system_prompt),
                HumanMessage(content=query)
            ])
            res_text = response.content
        except Exception as e:
            print(f"[PokeEstratega] Error invocando Groq: {e}")

    # 2. Secondary fallback: Local Ollama
    if not res_text:
        try:
            llm = ChatOllama(model="llama3.1:8b", base_url="http://localhost:11434", temperature=0.2)
            response = llm.invoke([
                SystemMessage(content=system_prompt),
                HumanMessage(content=query)
            ])
            res_text = response.content
        except Exception as e:
            print(f"[PokeEstratega] Error invocando Ollama: {e}")

    # 3. Tertiary fallback: Mathematical deterministic engine
    if not res_text:
        res_text = f"{context}\n\n*(Nota técnica: Datos tácticos verificados generados por el motor determinista)*"

    return {"response": res_text}
