import os
import uuid
from typing import Dict, Any, List, Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, PlainTextResponse, RedirectResponse
from pydantic import BaseModel

from engine.pbs_parser import PBSParser
from engine.type_chart import TypeChart, SPANISH_TYPE_NAMES, TYPE_COLORS
from engine.showdown import ShowdownExporter, ALL_NATURES, COMPETITIVE_ITEMS, NATURES
from graph.graph import poke_app

from PIL import Image
from dotenv import load_dotenv

BASE_DIR = os.path.dirname(__file__)
load_dotenv(os.path.join(BASE_DIR, ".env"))
load_dotenv()
STATIC_DIR = os.path.join(BASE_DIR, "static")
SPRITE_CACHE_DIR = os.path.join(STATIC_DIR, "cache_sprites")
os.makedirs(SPRITE_CACHE_DIR, exist_ok=True)
LOCAL_BATTLERS_DIR = r"C:\Users\mario\Desktop\Juego\Pokemon Anil V3.52\Graphics\Battlers"
LOCAL_ICONS_DIR = r"C:\Users\mario\Desktop\Juego\Pokemon Anil V3.52\Graphics\Icons"

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
SESSIONS_METADATA: Dict[str, Dict[str, Any]] = {}

class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None

class AddPokemonRequest(BaseModel):
    name: str

class AddCustomPokemonRequest(BaseModel):
    name: str
    moves: List[str]
    ability: Optional[str] = None
    item: Optional[str] = None
    nature: Optional[str] = None

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
    meta = SESSIONS_METADATA.setdefault(session_id, {"last_pokemon": None})

    state_input = {
        "query": req.message,
        "session_id": session_id,
        "team": current_team,
        "intent": "",
        "detected_pokemon": [],
        "context": "",
        "response": "",
        "last_pokemon": meta.get("last_pokemon")
    }

    try:
        final_state = poke_app.invoke(state_input)
        # Update session team
        SESSIONS[session_id] = final_state.get("team", current_team)
        
        # Update last discussed pokemon
        if final_state.get("detected_pokemon"):
            meta["last_pokemon"] = final_state["detected_pokemon"][0]
        elif final_state.get("last_pokemon"):
            meta["last_pokemon"] = final_state["last_pokemon"]
        
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

@app.post("/team/{session_id}/add_custom")
def add_custom_to_team(session_id: str, req: AddCustomPokemonRequest):
    team = SESSIONS.get(session_id, [])
    if len(team) >= 6:
        raise HTTPException(status_code=400, detail="El equipo ya tiene 6 Pokémon.")
    
    base_pkmn = parser.get_pokemon(req.name)
    if not base_pkmn:
        raise HTTPException(status_code=404, detail=f"Pokémon '{req.name}' no encontrado.")
    
    if any(p["name"].lower() == base_pkmn["name"].lower() for p in team):
        raise HTTPException(status_code=400, detail=f"{base_pkmn['name']} ya está en el equipo.")
    
    # Create customized pokemon entry
    role = exporter.determine_role(base_pkmn)
    profile = NATURES.get(role, NATURES["Balanced"])
    
    custom_entry = dict(base_pkmn)
    custom_entry["moves_custom"] = [m.strip() for m in req.moves if m.strip()]
    custom_entry["ability"] = req.ability.strip() if req.ability else (base_pkmn.get("hidden_ability") or base_pkmn["abilities"][0])
    custom_entry["item"] = req.item.strip() if req.item else profile["item"]
    custom_entry["nature"] = req.nature.strip() if req.nature else profile["nature"]
    
    team.append(custom_entry)
    SESSIONS[session_id] = team
    
    moves_str = ", ".join(custom_entry["moves_custom"])
    chat_summary = f"He añadido a **{base_pkmn['name']}** a tu equipo (Objeto: *{custom_entry['item']}*, Habilidad: *{custom_entry['ability']}*, Naturaleza: *{custom_entry['nature']}*, Movimientos: *{moves_str}*)."
    
    return {
        "message": f"{base_pkmn['name']} personalizado añadido con éxito.",
        "team": team,
        "chat_summary": chat_summary,
        "pokemon": custom_entry
    }

@app.get("/pokemon-list")
def get_pokemon_list():
    p_list = []
    for pid in sorted(parser.pokemon_by_id.keys()):
        p = parser.pokemon_by_id[pid]
        p_list.append({
            "id": p["id"],
            "name": p["name"],
            "type1": p["type1"],
            "type2": p.get("type2"),
            "bst": p["bst"],
            "role": exporter.determine_role(p)
        })
    return {"pokemon": p_list}

@app.get("/pokemon/{name_or_id}/custom-data")
def get_pokemon_custom_data(name_or_id: str):
    pkmn = parser.get_pokemon(name_or_id)
    if not pkmn:
        raise HTTPException(status_code=404, detail="Pokémon no encontrado.")
        
    role = exporter.determine_role(pkmn)
    profile = NATURES.get(role, NATURES["Balanced"])
    default_moves = exporter.select_competitive_moves(pkmn, role)
    all_learnable = parser.get_learnable_moves(pkmn)
    
    # Abilities
    abilities = []
    for a in pkmn.get("abilities", []):
        ab_obj = parser.get_ability(a)
        abilities.append({
            "internal": a,
            "name": ab_obj["name"] if ab_obj else a,
            "description": ab_obj.get("description", "") if ab_obj else "",
            "hidden": False
        })
    if pkmn.get("hidden_ability"):
        ha = pkmn["hidden_ability"]
        ha_obj = parser.get_ability(ha)
        abilities.append({
            "internal": ha,
            "name": ha_obj["name"] if ha_obj else ha,
            "description": ha_obj.get("description", "") if ha_obj else "",
            "hidden": True
        })
        
    default_ability = abilities[-1]["name"] if abilities else "Presión"
    
    return {
        "pokemon": {
            "id": pkmn["id"],
            "name": pkmn["name"],
            "type1": pkmn["type1"],
            "type2": pkmn.get("type2"),
            "base_stats": pkmn["base_stats"],
            "bst": pkmn["bst"],
            "role": role
        },
        "default_moves": default_moves,
        "learnable_moves": all_learnable,
        "abilities": abilities,
        "default_ability": default_ability,
        "default_nature": profile["nature"],
        "default_item": profile["item"],
        "all_natures": ALL_NATURES,
        "all_items": COMPETITIVE_ITEMS
    }

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

def crop_first_frame(src_path: str, dst_path: str) -> bool:
    try:
        with Image.open(src_path) as img:
            w, h = img.size
            if w > h * 1.1:
                # Square frame from the left
                frame = img.crop((0, 0, h, h))
                frame.save(dst_path, "PNG")
            else:
                img.save(dst_path, "PNG")
        return True
    except Exception:
        return False

@app.get("/sprite/{poke_id}")
def get_pokemon_sprite(poke_id: int):
    cached_path = os.path.join(SPRITE_CACHE_DIR, f"battler_{poke_id}.png")
    if os.path.exists(cached_path):
        return FileResponse(cached_path, media_type="image/png", headers={"Cache-Control": "no-cache, must-revalidate"})
        
    for fn in [f"{poke_id:03d}.png", f"{poke_id}.png"]:
        src = os.path.join(LOCAL_BATTLERS_DIR, fn)
        if os.path.exists(src):
            if crop_first_frame(src, cached_path):
                return FileResponse(cached_path, media_type="image/png", headers={"Cache-Control": "no-cache, must-revalidate"})
            return FileResponse(src, media_type="image/png")
            
    return RedirectResponse(f"https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/{poke_id}.png")

@app.get("/icon/{poke_id}")
def get_pokemon_icon(poke_id: int):
    cached_path = os.path.join(SPRITE_CACHE_DIR, f"icon_{poke_id}.png")
    if os.path.exists(cached_path):
        return FileResponse(cached_path, media_type="image/png", headers={"Cache-Control": "no-cache, must-revalidate"})
        
    for fn in [f"icon{poke_id:03d}.png", f"icon{poke_id}.png"]:
        src = os.path.join(LOCAL_ICONS_DIR, fn)
        if os.path.exists(src):
            if crop_first_frame(src, cached_path):
                return FileResponse(cached_path, media_type="image/png", headers={"Cache-Control": "no-cache, must-revalidate"})
            return FileResponse(src, media_type="image/png")
            
    return RedirectResponse(f"https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-vii/icons/{poke_id}.png")

# Mount static folder if exists
if os.path.exists(STATIC_DIR):
    app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
