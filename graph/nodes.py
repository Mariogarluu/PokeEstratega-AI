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

COMMON_NON_POKEMON_WORDS = {
    "primero", "segundo", "tercero", "cuarto", "quinto", "sexto", "ultimo", "último",
    "quiero", "equipo", "defensivo", "ofensivo", "tanque", "resto", "elige", "elije",
    "escoge", "bueno", "mejor", "mucho", "sobre", "contra", "favor", "puedes", "puedo",
    "decir", "amigo", "hermano", "miembro", "miembros", "compensa", "combate", "pelea",
    "fuerte", "rapido", "rápido", "ataque", "defensa", "velocidad", "objeto", "habilidad",
    "movimiento", "movimientos", "completa", "termina", "super", "lineup", "formacion",
    "formación", "fichaje", "fichajes", "tiempo", "tienes", "tengo", "hacer", "vamos",
    "pasar", "pasarse", "maximo", "máximo", "minimo", "mínimo", "contador", "faltan",
    "especifico", "específico", "cuenta", "nunca", "pedido"
}

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
        elif len(token_clean) >= 5 and token_clean not in COMMON_NON_POKEMON_WORDS:
            close = difflib.get_close_matches(token_clean, POKEMON_NAMES_MAP.keys(), n=1, cutoff=0.80)
            if close and close[0] not in COMMON_NON_POKEMON_WORDS:
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
    suggest_stems = [
        "sugier", "recomiend", "crea", "te dejo crear", "hazme un equipo", "completa",
        "termina", "arma", "armame", "siguiente pokemon", "siguiente miembro", "proximo pokemon",
        "próximo pokemon", "opcion", "opciones", "otro pokemon", "compañero", "compañeros", "falta",
        "elige", "elije", "escoge", "quiero un equipo", "monta un equipo", "construye", "forma un equipo"
    ]
    off_topic_indicators = [
        "bucle", "python", "javascript", "c++", "java", "html", "css", "react", "código", "codigo",
        "programar", "programacion", "programación", "script", "algoritmo", "sql", "database",
        "redaccion", "redacción", "ensayo", "tarea de historia", "resuelveme", "ecuacion", "ecuación"
    ]

    is_team_build = (
        any(k in query for k in ["quiero un equipo", "crea un equipo", "hazme un equipo", "arma un equipo", "haz un equipo", "completa mi equipo", "elige el resto", "elije el resto", "escoge el resto", "te dejo crear", "construye un equipo", "forma un equipo"]) or
        (any(s in query for s in suggest_stems) and any(w in query for w in ["equipo", "team", "compañero", "compañeros", "opcion", "opciones", "siguiente", "fichaje", "lineup", "crear", "muro", "defensivo", "ofensivo", "terminar", "completar", "asco", "slot", "resto"]))
    )

    if any(k in query for k in ["showdown", "exportar", "paste", "copiar equipo"]):
        intent = "showdown_export"
    elif any(k in query for k in remove_stems):
        intent = "remove_team"
    elif is_team_build:
        intent = "team_build_suggest"
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

    if intent == "add_team" or (intent == "team_build_suggest" and detected):
        if intent == "add_team" and not detected:
            system_notes.append("¿A qué Pokémon deseas añadir? No he detectado ningún Pokémon en tu petición.")
        for p_name in detected:
            pkmn = parser.get_pokemon(p_name)
            if not pkmn:
                continue
            if any(p["name"].lower() == pkmn["name"].lower() for p in team):
                system_notes.append(f"ℹ️ {pkmn['name']} ya está en tu equipo.")
            elif len(team) >= 6:
                system_notes.append("⚠️ El equipo ya tiene 6 Pokémon (máximo alcanzado).")
            else:
                entry = dict(pkmn)
                # Check for customized build keywords (defensivo, tanque, sweeper, etc.)
                if any(w in query_lower for w in ["defens", "tanque", "wall", "aguant"]):
                    is_phys = pkmn["base_stats"]["defense"] >= pkmn["base_stats"]["sp_defense"]
                    entry["role"] = "Muralla Física" if is_phys else "Muralla Especial"
                    entry["nature"] = "Agitada" if is_phys else "Serena"
                    entry["item"] = "Restos"
                    entry["moves_custom"] = exporter.select_competitive_moves(pkmn, entry["role"])
                elif any(w in query_lower for w in ["ofensiv", "sweeper", "atacante", "rapido", "rápido"]):
                    is_phys = pkmn["base_stats"]["attack"] >= pkmn["base_stats"]["sp_attack"]
                    entry["role"] = "Atacante Físico" if is_phys else "Atacante Especial"
                    entry["nature"] = "Alegre" if is_phys else "Miedosa"
                    entry["item"] = "Vidasfera"
                    entry["moves_custom"] = exporter.select_competitive_moves(pkmn, entry["role"])

                raw_ab = pkmn.get("hidden_ability") or (pkmn["abilities"][0] if pkmn.get("abilities") else "Presión")
                ab_obj = parser.get_ability(raw_ab)
                entry["ability"] = ab_obj["name"] if ab_obj else raw_ab

                team.append(entry)
                build_label = f" ({entry.get('role', 'Estándar')})" if "role" in entry and entry.get("role") != exporter.determine_role(pkmn) else ""
                system_notes.append(f"✅ Se ha añadido a **{pkmn['name']}**{build_label} al equipo ({len(team)}/6).")

    elif intent == "remove_team":
        for p_name in detected:
            initial_len = len(team)
            team = [p for p in team if p["name"].lower() != p_name.lower()]
            if len(team) < initial_len:
                system_notes.append(f"❌ Se ha eliminado a **{p_name}** del equipo ({len(team)}/6).")

    # Determine target size (capped at 6)
    target_size = 6
    for num_w, val in [("1", 1), ("2", 2), ("pareja", 2), ("duo", 2), ("3", 3), ("trio", 3), ("trío", 3), ("tres", 3), ("4", 4), ("cuatro", 4), ("5", 5), ("cinco", 5), ("6", 6), ("seis", 6)]:
        if num_w in query_lower:
            target_size = val
            break
    target_size = min(6, target_size)
    faltan = max(0, target_size - len(team))

    # Team Audit & Synergy Suggestions
    context_parts = list(system_notes)
    suggested_options = None

    if intent in ("team_build_suggest", "team_audit") or (len(team) < 6 and any(w in query_lower for w in ["sugier", "recomiend", "crear", "hazme", "falta", "siguiente", "termina", "completa", "asco", "defensivo", "ofensivo", "resto", "elige", "elije", "escoge"])):
        if len(team) >= 6:
            context_parts.append("\n🏆 **¡EQUIPO COMPLETO (6/6)!** Tu alineación ha alcanzado el límite máximo reglamentario de 6 Pokémon. La formación está cerrada.")
            suggested_options = None
        else:
            archetype = "defensive" if any(w in query_lower for w in ["defens", "stall", "tanque", "muro", "aguant", "asco"]) else ("offensive" if any(w in query_lower for w in ["ofensiv", "sweeper", "rapido", "ataque", "hyper"]) else "balanced")
            suggested_options = type_chart.find_best_partners(team, parser, archetype=archetype, top_k=3)
            context_parts.append(f"\n📊 **Contador de Equipo**: {len(team)}/{target_size} miembros. **Faltan {faltan} Pokémon** para completar tu equipo de {target_size} (máximo 6).")
            if suggested_options:
                next_slot = len(team) + 1
                context_parts.append(f"\n### 🎯 Top 3 Opciones de Sinergia Ideales para el Slot #{next_slot} (cubriendo debilidades de tu equipo):")
                for i, cand in enumerate(suggested_options, 1):
                    context_parts.append(f"{i}. **{cand['name']}** ({cand['role']}): {cand['reason']}")

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
        "context": "\n".join(context_parts),
        "suggested_options": suggested_options
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
            "response": "¡Hermano, para un segundo! 🛑 ¿Pero qué me estás contando? ¿Qué bucles de Python ni qué leches? ¡Aquí hemos venido a reventar el meta de **Pokémon Añil** y a ganar combates como auténticos pros, no a picar código!\n\nPregúntame por sinergias, debilidades, sets god tier o armar tu equipo de 6. ¡Concéntrate que estamos en prime!"
        }

    context = state.get("context", "")
    query = state.get("query", "")
    team = state.get("team", [])
    team_summary = ", ".join([f"{p['name']} ({SPANISH_TYPE_NAMES.get(p.get('type1'), p.get('type1'))})" for p in team]) if team else "Ninguno (0/6)"

    system_prompt = f"""Eres PokeEstratega-AI, el Coach y Analista Competitivo definitivo de Pokémon (especializado en Pokémon Añil).
Tienes una personalidad MARCADÍSIMA estilo streamer top competitivo (rollo Xokas / streamer de élite): eres intenso, hiperactivo, seguro de ti mismo hasta el extremo, apasionado del competitivo y te picas con humor sano si el usuario comete errores tácticos o intenta inventar cosas raras.

PERSONALIDAD, JERGA Y ESTILO:
- Hablas con energía y modismos actuales de la cultura gamer: 'hermano', 'escúchame una cosa', 'esto es demencial', 'te falta calle competitiva', 'estoy en prime', 'menudo bicho', 'te van a mandar al lobby', 'literalmente', 'god tier', 'broken', 'inting', 'throwear', 'clutch', 'focus'.
- Vacile sano: Si el usuario propone algo flojo o un set absurdo, vacílale con humor pero manteniéndote siempre servicial y enseñándole la jugada pro para ganar.

RASGO PSICOLÓGICO CLAVE (OBLIGATORIO):
- INCAPAZ DE ADMITIR UN ERROR PERO LO CORRIGES AL INSTANTE: Jamás pidas disculpas ni digas 'tienes razón, me equivoqué'. Si el usuario te rebate o corriges algo, di con orgullo cómico que le estabas poniendo a prueba a propósito para ver si estaba atento al combate o si tenía calle competitiva, y corrígelo con orgullo al instante ('A ver hermano, pero tú qué te crees, ¿que no lo sabía? ¡Te estaba testeando los reflejos tácticos a ver si estabas despierto!').

DATOS EXACTOS VERIFICADOS (Calculados matemáticamente):
{context}

ESTADO DEL EQUIPO DEL USUARIO:
{team_summary}

ACCIONES REALIZADAS EN ESTE TURNO:
- Si en los DATOS EXACTOS aparece '✅ Se ha añadido a...', confirma con orgullo y tu energía habitual que el Pokémon ya ha sido metido en el equipo. Celébralo como un fichaje god tier y sugiere de inmediato la siguiente pieza clave para cubrir sus debilidades.
- Si en los DATOS EXACTOS aparece '❌ Se ha eliminado a...', confirma que lo has mandado al banquillo/lobby.
- Si en los DATOS EXACTOS aparecen 'Top 3 Opciones de Sinergia':
  Presenta las opciones con tu flow streamer (1 frase impactante por opción explicando por qué da asco al rival o cubre las debilidades del equipo).
  Dile al usuario que pulse cualquiera de los botones interactivos de abajo para incorporar al que prefiera.
- NUNCA digas '¿qué Pokémon quieres añadir?' si en los DATOS EXACTOS ya figura que el Pokémon fue añadido exitosamente.
- CONTADOR DE FALTANTES Y TOPE REGLAMENTARIO DE 6 (OBLIGATORIO):
  Menciona siempre con orgullo cuántos Pokémon tiene el equipo actualmente y cuántos FALTAN exactamente para completar el objetivo o el tope de 6 (ej: '¡Fichado Garchomp en el roster (1/6)! Faltan exactamente 5 miembros para completar tu fortaleza de 6').
  Si el equipo ya tiene 6 Pokémon, declara que la alineación está 100% CERRADA Y COMPLETA (6/6) y que no se puede añadir ningún Pokémon más porque 6 es el límite absoluto de las reglas competitivas.
- ROLES Y ATRIBUTOS EN ESPAÑOL OBLIGATORIO: Llama siempre a los roles y perfiles por su nombre en castellano ('Muralla Especial', 'Muralla Física', 'Rompemuros', 'Tanque Especial', 'Tanque Físico', 'Atacante Especial', 'Atacante Físico', 'Pone-Trampas', etc.). Nunca uses términos en inglés como 'Special Wall' o 'Stall Breaker'.
- CONCISIÓN OBLIGATORIA: Sé directo, enérgico e impactante (máximo 160-180 palabras). Termina siempre tus frases y no te cortes a medias.

REGLAS DE DOMINIO:
1. Eres un coach de combate Pokémon y NADA más. No hables de programación ni código.
2. Eres ULTRA SERVICIAL y atento: tu objetivo es que el usuario tenga el mejor equipo posible y gane todas las partidas.
3. Basa tus recomendaciones en los datos verificados proporcionados.
4. Responde siempre en español, de forma concisa, impactante y con mucho flow."""

    res_text = ""
    groq_api_key = os.getenv("GROQ_API_KEY", "").strip()
    groq_model = os.getenv("GROQ_MODEL", "qwen/qwen3.8-27b").strip()

    # 1. Primary: Ultra-fast Cloud Groq LLM
    if groq_api_key and ChatGroq:
        try:
            llm = ChatGroq(
                groq_api_key=groq_api_key,
                model_name=groq_model,
                temperature=0.4,
                max_tokens=650
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

    return {
        "response": res_text,
        "suggested_options": state.get("suggested_options")
    }
