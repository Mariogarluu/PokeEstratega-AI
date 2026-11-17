import os
import json
import uuid
import datetime
from typing import List, Dict, Any, Optional

from engine.pbs_parser import PBSParser
from engine.type_chart import TypeChart, SPANISH_TYPE_NAMES
from engine.showdown import ShowdownExporter, NATURES

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")
SAVED_TEAMS_FILE = os.path.join(DATA_DIR, "saved_teams.json")
CHROMA_DIR = os.path.join(BASE_DIR, "chroma_db")

ROLE_TRANSLATIONS_ES = {
    "special wall": "Muralla Especial",
    "physical wall": "Muralla Física",
    "stall breaker": "Rompemuros",
    "wallbreaker": "Rompemuros",
    "physical wallbreaker": "Rompemuros Físico",
    "special tank": "Tanque Especial",
    "physical tank": "Tanque Físico",
    "tank": "Tanque",
    "special sweeper": "Atacante Especial",
    "physical sweeper": "Atacante Físico",
    "fast special sweeper": "Atacante Especial Rápido",
    "hazard setter": "Pone-Trampas",
    "cleric": "Clérigo",
    "balanced": "Equilibrado"
}

def _translate_role(role: str) -> str:
    if not role:
        return "Equilibrado"
    r = role.lower().strip()
    if r in ROLE_TRANSLATIONS_ES:
        return ROLE_TRANSLATIONS_ES[r]
    for k, v in ROLE_TRANSLATIONS_ES.items():
        if k in r:
            return v
    return role

class TeamStore:
    def __init__(self, parser: Optional[PBSParser] = None):
        self.parser = parser or PBSParser()
        self.type_chart = TypeChart(self.parser.types)
        self.exporter = ShowdownExporter(self.parser)
        self.embedding_fn = None
        self.chroma_client = None
        self.collection = None

        os.makedirs(DATA_DIR, exist_ok=True)
        self._init_vectorstore()
        self._ensure_starter_teams()

    def _init_vectorstore(self):
        try:
            import chromadb
            from chromadb.utils import embedding_functions
            self.embedding_fn = embedding_functions.DefaultEmbeddingFunction()
            self.chroma_client = chromadb.PersistentClient(path=CHROMA_DIR)
            self.collection = self.chroma_client.get_or_create_collection(
                name="saved_competitive_teams",
                embedding_function=self.embedding_fn,
                metadata={"description": "Colección de equipos Pokémon competitivos con búsqueda semántica"}
            )
        except Exception as e:
            print(f"[TeamStore] Aviso: No se pudo inicializar ChromaDB persistente ({e}). Se usará búsqueda en memoria.")
            self.collection = None

    def _build_starter_entry(self, name: str, role_pref: str, nature_pref: str, item_pref: str, ability_pref: Optional[str] = None) -> Dict[str, Any]:
        pkmn = self.parser.get_pokemon(name)
        if not pkmn:
            raise ValueError(f"Pokemon {name} no encontrado en PBS")
        
        entry = dict(pkmn)
        role = _translate_role(role_pref)
        entry["role"] = role
        entry["nature"] = nature_pref
        entry["item"] = item_pref

        # Ability in Spanish
        if ability_pref:
            entry["ability"] = ability_pref
        else:
            raw_ab = pkmn.get("hidden_ability") or (pkmn["abilities"][0] if pkmn.get("abilities") else "Presión")
            ab_obj = self.parser.get_ability(raw_ab)
            entry["ability"] = ab_obj["name"] if ab_obj else raw_ab

        entry["moves_custom"] = self.exporter.select_competitive_moves(pkmn, role)
        
        # Details of moves
        enriched_moves = []
        for m_str in entry["moves_custom"]:
            m_obj = self.parser.get_move(m_str)
            if m_obj:
                t_es = SPANISH_TYPE_NAMES.get(m_obj["type"].upper(), m_obj["type"].capitalize())
                enriched_moves.append({
                    "name": m_obj["name"],
                    "type": t_es,
                    "category": m_obj.get("category", "Physical"),
                    "power": m_obj.get("power", 0),
                    "accuracy": m_obj.get("accuracy", 100)
                })
            else:
                enriched_moves.append({"name": m_str, "type": "Normal", "category": "Physical", "power": 0, "accuracy": 100})
        entry["moves_details"] = enriched_moves
        return entry

    def _generate_starter_teams(self) -> List[Dict[str, Any]]:
        starters = []

        # 1. Stall Añil (Muro Defensivo Clásico)
        stall_members = [
            self._build_starter_entry("Garchomp", "Muralla Física", "Agitada", "Restos", "Piel Rugosa"),
            self._build_starter_entry("Corviknight", "Muralla Especial", "Serena", "Restos", "Coraza Reflejo"),
            self._build_starter_entry("Toxapex", "Tanque Físico", "Osada", "Lodo Negro", "Ensañamiento"),
            self._build_starter_entry("Chansey", "Muralla Especial", "Serena", "Mineral Evolutivo", "Cura Natural"),
            self._build_starter_entry("Gliscor", "Rompemuros Físico", "Agitada", "Toxisfera", "Antídoto"),
            self._build_starter_entry("Ferrothorn", "Pone-Trampas", "Plácida", "Casco Dentado", "Punta Acero")
        ]
        starters.append({
            "id": "starter-stall-anil",
            "name": "Stall Añil (Muro Infranqueable)",
            "archetype": "Defensivo (Stall)",
            "description": "Alineación ultra defensiva orientada a desgastar al rival por daño residual, trampas y regeneración pasiva. Muro físico con Garchomp y Toxapex, muro especial con Chansey y Corviknight, e inmunidades clave a Tierra, Fuego y Eléctrico.",
            "members": stall_members,
            "created_at": "2026-11-17T12:00:00Z",
            "is_starter": True
        })

        # 2. Hyper Offense Lluvia (Rain Team)
        rain_members = [
            self._build_starter_entry("Pelipper", "Pivote Táctico", "Osada", "Roca Lluvia", "Llovizna"),
            self._build_starter_entry("Swampert", "Atacante Físico", "Firme", "Vidasfera", "Nado Rápido"),
            self._build_starter_entry("Zapdos", "Atacante Especial", "Modesta", "Botas Gruesas", "Electricidad Estática"),
            self._build_starter_entry("Scizor", "Atacante Físico", "Firme", "Cinta Elegida", "Experto"),
            self._build_starter_entry("Kingdra", "Atacante Especial Rápido", "Modesta", "Gafas Especiales", "Nado Rápido"),
            self._build_starter_entry("Ferrothorn", "Tanque Defensivo", "Plácida", "Restos", "Punta Acero")
        ]
        starters.append({
            "id": "starter-rain-team",
            "name": "Hyper Offense Lluvia (Marea Torrencial)",
            "archetype": "Ofensivo (Lluvia)",
            "description": "Equipo de clima basado en Llovizna con Pelipper para duplicar la velocidad de Swampert y Kingdra bajo agua con Nado Rápido. Cobertura brutal con Truenos certeros de Zapdos y prioridad demoledora de Scizor.",
            "members": rain_members,
            "created_at": "2026-11-17T12:05:00Z",
            "is_starter": True
        })

        # 3. Bulky Balance Metagame
        balance_members = [
            self._build_starter_entry("Garchomp", "Atacante Físico", "Alegre", "Vidasfera", "Piel Rugosa"),
            self._build_starter_entry("Heatran", "Tanque Especial", "Modesta", "Restos", "Absorbe Fuego"),
            self._build_starter_entry("Clefable", "Clérigo", "Osada", "Restos", "Muro Mágico"),
            self._build_starter_entry("Weavile", "Atacante Especial Rápido", "Alegre", "Cinta Elegida", "Presión"),
            self._build_starter_entry("Slowbro", "Muralla Física", "Osada", "Casco Dentado", "Regeneración"),
            self._build_starter_entry("Corviknight", "Pivote Defensivo", "Agitada", "Restos", "Presión")
        ]
        starters.append({
            "id": "starter-bulky-balance",
            "name": "Bulky Balance (Meta Sólido)",
            "archetype": "Equilibrado (Balance)",
            "description": "Estructura competitiva balanceada con capacidad de absorber golpes y responder con daño masivo. Heatran y Clefable frenan atacantes especiales, Slowbro y Corviknight neutralizan atacantes físicos, y Garchomp y Weavile rematan la partida.",
            "members": balance_members,
            "created_at": "2026-11-17T12:10:00Z",
            "is_starter": True
        })

        # Compute Showdown pastes for all starters
        for s in starters:
            s["showdown_paste"] = self.exporter.export_team(s["members"])

        return starters

    def _ensure_starter_teams(self):
        existing = self._read_json_teams()
        if not existing:
            starters = self._generate_starter_teams()
            self._write_json_teams(starters)
            self._sync_vectorstore(starters)
        else:
            # Sync existing to Chroma
            self._sync_vectorstore(existing)

    def _read_json_teams(self) -> List[Dict[str, Any]]:
        if not os.path.exists(SAVED_TEAMS_FILE):
            return []
        try:
            with open(SAVED_TEAMS_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return []

    def _write_json_teams(self, teams: List[Dict[str, Any]]):
        with open(SAVED_TEAMS_FILE, "w", encoding="utf-8") as f:
            json.dump(teams, f, ensure_ascii=False, indent=2)

    def _team_to_embedding_text(self, team_data: Dict[str, Any]) -> str:
        name = team_data.get("name", "Equipo Competitivo")
        archetype = team_data.get("archetype", "Equilibrado")
        desc = team_data.get("description", "")
        members = team_data.get("members", [])

        member_lines = []
        for p in members:
            t1_es = SPANISH_TYPE_NAMES.get(p.get("type1", ""), p.get("type1", ""))
            t2_es = f"/{SPANISH_TYPE_NAMES.get(p.get('type2', ''), p.get('type2', ''))}" if p.get("type2") else ""
            moves = ", ".join(p.get("moves_custom", []))
            member_lines.append(f"{p['name']} ({t1_es}{t2_es}, {p.get('role', 'Combatiente')}, Obj: {p.get('item', 'Restos')}, Hab: {p.get('ability', '')}, Moves: {moves})")

        return f"""Equipo Competitivo Pokémon Añil: {name}
Arquetipo táctico: {archetype}
Descripción de estrategia: {desc}
Miembros de la alineación ({len(members)}/6):
{chr(10).join('- ' + m for m in member_lines)}"""

    def _sync_vectorstore(self, teams: List[Dict[str, Any]]):
        if not self.collection:
            return
        try:
            ids = [t["id"] for t in teams]
            documents = [self._team_to_embedding_text(t) for t in teams]
            metadatas = [
                {
                    "name": t["name"],
                    "archetype": t.get("archetype", "Equilibrado"),
                    "members_str": ", ".join(p["name"] for p in t.get("members", [])),
                    "created_at": t.get("created_at", "")
                }
                for t in teams
            ]
            self.collection.upsert(ids=ids, documents=documents, metadatas=metadatas)
        except Exception as e:
            print(f"[TeamStore] Error sincronizando ChromaDB: {e}")

    def list_teams(self) -> List[Dict[str, Any]]:
        return self._read_json_teams()

    def get_team(self, team_id: str) -> Optional[Dict[str, Any]]:
        teams = self._read_json_teams()
        for t in teams:
            if t["id"] == team_id:
                return t
        return None

    def save_team(self, name: str, members: List[Dict[str, Any]], user_notes: str = "", archetype: Optional[str] = None) -> Dict[str, Any]:
        if len(members) != 6:
            raise ValueError(f"Solo se pueden registrar equipos completos de 6 Pokémon (actual: {len(members)}/6).")

        teams = self._read_json_teams()
        team_id = f"team-{uuid.uuid4().hex[:8]}"

        # Infer archetype if not given
        if not archetype:
            roles_lower = " ".join(p.get("role", "").lower() for p in members)
            if any(w in roles_lower for w in ["stall", "muralla", "tanque"]):
                archetype = "Defensivo (Stall)"
            elif any(w in roles_lower for w in ["sweeper", "atacante", "rapido"]):
                archetype = "Ofensivo (Hyper Offense)"
            else:
                archetype = "Equilibrado (Balance)"

        # Generate Showdown paste
        showdown_paste = self.exporter.export_team(members)

        # Audit
        audit = self.type_chart.audit_team(members)
        weak_summary = ", ".join(cv["type_name_es"] for cv in audit.get("critical_vulnerabilities", [])) or "Ninguna crítica"
        
        desc = user_notes.strip() if user_notes else f"Formación competitiva {archetype} de 6 miembros. Debilidades compartidas: {weak_summary}."

        new_team = {
            "id": team_id,
            "name": name.strip(),
            "archetype": archetype,
            "description": desc,
            "members": members,
            "showdown_paste": showdown_paste,
            "created_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "is_starter": False
        }

        teams.insert(0, new_team)
        self._write_json_teams(teams)

        if self.collection:
            try:
                emb_text = self._team_to_embedding_text(new_team)
                meta = {
                    "name": new_team["name"],
                    "archetype": new_team["archetype"],
                    "members_str": ", ".join(p["name"] for p in members),
                    "created_at": new_team["created_at"]
                }
                self.collection.upsert(ids=[team_id], documents=[emb_text], metadatas=[meta])
            except Exception as e:
                print(f"[TeamStore] Error indexando nuevo equipo: {e}")

        return new_team

    def delete_team(self, team_id: str) -> bool:
        teams = self._read_json_teams()
        initial_len = len(teams)
        teams = [t for t in teams if t["id"] != team_id]
        if len(teams) < initial_len:
            self._write_json_teams(teams)
            if self.collection:
                try:
                    self.collection.delete(ids=[team_id])
                except Exception:
                    pass
            return True
        return False

    def search_teams_semantic(self, query: str, top_k: int = 3) -> List[Dict[str, Any]]:
        teams = self._read_json_teams()
        if not teams:
            return []

        # 1. If Chroma collection is ready, perform cosine vector similarity search
        if self.collection and len(teams) > 0:
            try:
                results = self.collection.query(
                    query_texts=[query],
                    n_results=min(top_k, len(teams))
                )
                matched_ids = results.get("ids", [[]])[0]
                distances = results.get("distances", [[]])[0] if "distances" in results else []
                
                ordered_teams = []
                for i, tid in enumerate(matched_ids):
                    t = self.get_team(tid)
                    if t:
                        t_copy = dict(t)
                        # Similarity score: distance is cosine distance (0: identical)
                        dist = distances[i] if i < len(distances) else 0.5
                        sim = max(0.0, min(1.0, 1.0 - dist))
                        t_copy["similarity_score"] = round(sim, 2)
                        ordered_teams.append(t_copy)
                if ordered_teams:
                    return ordered_teams
            except Exception as e:
                print(f"[TeamStore] Fallback a búsqueda léxica ({e})")

        # 2. Fallback: Keyword and archetype overlap
        q_lower = query.lower()
        scored = []
        for t in teams:
            score = 0
            t_text = f"{t['name']} {t.get('archetype', '')} {t.get('description', '')} {' '.join(p['name'] for p in t.get('members', []))}".lower()
            tokens = [w for w in q_lower.split() if len(w) > 3]
            for tok in tokens:
                if tok in t_text:
                    score += 1
            scored.append((score, t))
        scored.sort(key=lambda x: x[0], reverse=True)
        return [item[1] for item in scored[:top_k]]
