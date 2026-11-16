import os
import uuid
from typing import Dict, Any, List, Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, PlainTextResponse
from pydantic import BaseModel

from engine.pbs_parser import PBSParser
from engine.type_chart import TypeChart, SPANISH_TYPE_NAMES, TYPE_COLORS
from engine.showdown import ShowdownExporter
from graph.graph import poke_app

BASE_DIR = os.path.dirname(__file__)
STATIC_DIR = os.path.join(BASE_DIR, "static")

app = FastAPI(
    title="PokeEstratega-AI",
    description="Asistente y Asesor Competitivo de Pokémon con LangGraph, FastAPI, ChromaDB y Docker",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

parser = PBSParser()
type_chart = TypeChart(parser.types)
exporter = ShowdownExporter(parser)

# In-memory sessions store: session_id -> list of pokemon dicts
SESSIONS: Dict[str, List[Dict[str, Any]]] = {}

class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None

class AddPokemonRequest(BaseModel):
    name: str

@app.get("/")
def get_index():
    index_path = os.path.join(STATIC_DIR, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {"message": "PokeEstratega-AI API online. Visita /docs para la documentación interactiva."}

@app.post("/chat")
def chat_endpoint(req: ChatRequest):
    session_id = req.session_id or str(uuid.uuid4())
    current_team = SESSIONS.get(session_id, [])

    state_input = {
        "query": req.message,
        "session_id": session_id,
        "team": current_team,
        "intent": "",
        "detected_pokemon": [],
        "context": "",
        "response": ""
    }

    try:
        final_state = poke_app.invoke(state_input)
        # Update session team
        SESSIONS[session_id] = final_state.get("team", current_team)
        
        return {
            "session_id": session_id,
            "response": final_state.get("response", ""),
            "intent": final_state.get("intent", "general"),
            "detected_pokemon": final_state.get("detected_pokemon", []),
            "team": [
                {
                    "id": p["id"],
                    "name": p["name"],
                    "type1": p["type1"],
                    "type2": p.get("type2"),
                    "base_stats": p["base_stats"],
                    "bst": p["bst"]
                }
                for p in SESSIONS[session_id]
            ]
        }
    except Exception as e:
        return {
            "session_id": session_id,
            "response": f"Ocurrió un error en el motor: {str(e)}",
            "team": current_team
        }

@app.get("/team/{session_id}")
def get_team(session_id: str):
    team = SESSIONS.get(session_id, [])
    audit = type_chart.audit_team(team) if team else None
    return {
        "session_id": session_id,
        "team_size": len(team),
        "team": team,
        "audit": audit
    }

@app.post("/team/{session_id}/add")
def add_to_team(session_id: str, req: AddPokemonRequest):
    team = SESSIONS.get(session_id, [])
    if len(team) >= 6:
        raise HTTPException(status_code=400, detail="El equipo ya tiene 6 Pokémon.")
    
    pkmn = parser.get_pokemon(req.name)
    if not pkmn:
        raise HTTPException(status_code=404, detail=f"Pokémon '{req.name}' no encontrado.")
    
    if any(p["name"].lower() == pkmn["name"].lower() for p in team):
        raise HTTPException(status_code=400, detail=f"{pkmn['name']} ya está en el equipo.")
    
    team.append(pkmn)
    SESSIONS[session_id] = team
    return {"message": f"{pkmn['name']} añadido con éxito.", "team": team}

@app.post("/team/{session_id}/remove")
def remove_from_team(session_id: str, req: AddPokemonRequest):
    team = SESSIONS.get(session_id, [])
    initial_len = len(team)
    team = [p for p in team if p["name"].lower() != req.name.lower()]
    SESSIONS[session_id] = team
    return {"message": f"{req.name} eliminado.", "team": team, "removed": len(team) < initial_len}

@app.post("/team/{session_id}/clear")
def clear_team(session_id: str):
    SESSIONS[session_id] = []
    return {"message": "Equipo vaciado.", "team": []}

@app.get("/team/{session_id}/export-showdown")
def export_showdown(session_id: str):
    team = SESSIONS.get(session_id, [])
    if not team:
        return PlainTextResponse("No hay Pokémon en el equipo para exportar.")
    paste = exporter.export_team(team)
    return PlainTextResponse(paste)

@app.get("/pokemon/{name_or_id}")
def get_pokemon_info(name_or_id: str):
    pkmn = parser.get_pokemon(name_or_id)
    if not pkmn:
        raise HTTPException(status_code=404, detail="Pokémon no encontrado.")
    
    matchups = type_chart.get_matchups(pkmn["type1"], pkmn.get("type2"))
    showdown_set = exporter.export_pokemon(pkmn)
    return {
        "pokemon": pkmn,
        "matchups": matchups,
        "showdown_set": showdown_set
    }

@app.get("/search")
def search_pokemon_endpoint(q: str = "", limit: int = 10):
    if not q:
        return []
    results = parser.search_pokemon(q, limit=limit)
    return [
        {
            "id": p["id"],
            "name": p["name"],
            "type1": p["type1"],
            "type2": p.get("type2"),
            "bst": p["bst"]
        }
        for p in results
    ]

@app.get("/health")
def healthcheck():
    return {
        "status": "healthy",
        "total_pokemon": len(parser.pokemon_by_id),
        "total_moves": len(parser.moves),
        "total_abilities": len(parser.abilities)
    }

# Mount static folder if exists
if os.path.exists(STATIC_DIR):
    app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
