import os
import csv
from typing import Dict, List, Optional, Any

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")

class PBSParser:
    def __init__(self, data_dir: str = DATA_DIR):
        self.data_dir = data_dir
        self.types: Dict[str, Dict[str, Any]] = {}
        self.abilities: Dict[str, Dict[str, Any]] = {}
        self.moves: Dict[str, Dict[str, Any]] = {}
        self.pokemon: Dict[str, Dict[str, Any]] = {}
        self.pokemon_by_id: Dict[int, Dict[str, Any]] = {}
        
        self.load_all()

    def load_types(self):
        filepath = os.path.join(self.data_dir, "types.txt")
        if not os.path.exists(filepath):
            return
        
        with open(filepath, "r", encoding="utf-8", errors="replace") as f:
            content = f.read()

        current_type: Dict[str, Any] = {}
        for line in content.splitlines():
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if line.startswith("[") and line.endswith("]"):
                if "InternalName" in current_type:
                    self.types[current_type["InternalName"]] = current_type
                current_type = {}
                continue
            
            if "=" in line:
                k, v = line.split("=", 1)
                k = k.strip()
                v = v.strip()
                if k in ("Weaknesses", "Resistances", "Immunities"):
                    current_type[k] = [x.strip() for x in v.split(",") if x.strip()]
                else:
                    current_type[k] = v
                    
        if "InternalName" in current_type:
            self.types[current_type["InternalName"]] = current_type

    def load_abilities(self):
        filepath = os.path.join(self.data_dir, "abilities.txt")
        if not os.path.exists(filepath):
            return

        with open(filepath, "r", encoding="utf-8", errors="replace") as f:
            reader = csv.reader(f)
            for row in reader:
                if not row or len(row) < 3:
                    continue
                try:
                    aid = int(row[0].strip())
                    internal_name = row[1].strip()
                    name = row[2].strip()
                    desc = row[3].strip() if len(row) > 3 else ""
                    self.abilities[internal_name] = {
                        "id": aid,
                        "internal_name": internal_name,
                        "name": name,
                        "description": desc
                    }
                except ValueError:
                    continue

    def load_moves(self):
        filepath = os.path.join(self.data_dir, "moves.txt")
        if not os.path.exists(filepath):
            return

        with open(filepath, "r", encoding="utf-8", errors="replace") as f:
            reader = csv.reader(f)
            for row in reader:
                if not row or len(row) < 7:
                    continue
                try:
                    mid = int(row[0].strip())
                    internal_name = row[1].strip()
                    name = row[2].strip()
                    power = int(row[4].strip()) if row[4].strip().isdigit() else 0
                    mtype = row[5].strip()
                    category = row[6].strip()  # Physical, Special, Status
                    accuracy = int(row[7].strip()) if len(row) > 7 and row[7].strip().isdigit() else 100
                    pp = int(row[8].strip()) if len(row) > 8 and row[8].strip().isdigit() else 10
                    desc = row[13].strip() if len(row) > 13 else ""
                    
                    self.moves[internal_name] = {
                        "id": mid,
                        "internal_name": internal_name,
                        "name": name,
                        "power": power,
                        "type": mtype,
                        "category": category,
                        "accuracy": accuracy,
                        "pp": pp,
                        "description": desc
                    }
                except (ValueError, IndexError):
                    continue

    def load_pokemon(self):
        filepath = os.path.join(self.data_dir, "pokemon.txt")
        if not os.path.exists(filepath):
            return

        with open(filepath, "r", encoding="utf-8", errors="replace") as f:
            content = f.read()

        current_pkmn: Dict[str, Any] = {}
        for line in content.splitlines():
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if line.startswith("[") and line.endswith("]"):
                if "InternalName" in current_pkmn and "BaseStats" in current_pkmn:
                    self._register_pokemon(current_pkmn)
                current_pkmn = {}
                id_str = line[1:-1]
                if id_str.isdigit():
                    current_pkmn["id"] = int(id_str)
                continue

            if "=" in line:
                k, v = line.split("=", 1)
                k = k.strip()
                v = v.strip()
                current_pkmn[k] = v

        if "InternalName" in current_pkmn and "BaseStats" in current_pkmn:
            self._register_pokemon(current_pkmn)

    def _register_pokemon(self, raw: Dict[str, Any]):
        stats_list = [int(s.strip()) for s in raw["BaseStats"].split(",") if s.strip().isdigit()]
        if len(stats_list) == 6:
            base_stats = {
                "hp": stats_list[0],
                "attack": stats_list[1],
                "defense": stats_list[2],
                "speed": stats_list[3],
                "sp_attack": stats_list[4],
                "sp_defense": stats_list[5],
            }
        else:
            base_stats = {"hp": 50, "attack": 50, "defense": 50, "speed": 50, "sp_attack": 50, "sp_defense": 50}

        bst = sum(base_stats.values())
        type1 = raw.get("Type1", "NORMAL").upper()
        type2 = raw.get("Type2", None)
        if type2:
            type2 = type2.upper()

        abilities = [a.strip() for a in raw.get("Abilities", "").split(",") if a.strip()]
        hidden_ability = raw.get("HiddenAbility", "").strip() or None

        # Parse moves list: Level,MOVENAME,Level,MOVENAME
        moves_raw = raw.get("Moves", "").split(",")
        moves_learned = []
        for i in range(0, len(moves_raw) - 1, 2):
            lvl_str = moves_raw[i].strip()
            mname = moves_raw[i + 1].strip()
            if lvl_str.isdigit() and mname:
                moves_learned.append({"level": int(lvl_str), "move": mname})

        egg_moves = [m.strip() for m in raw.get("EggMoves", "").split(",") if m.strip()]

        data = {
            "id": raw.get("id", 0),
            "name": raw.get("Name", raw.get("InternalName", "Unknown")),
            "internal_name": raw["InternalName"].upper(),
            "type1": type1,
            "type2": type2,
            "base_stats": base_stats,
            "bst": bst,
            "abilities": abilities,
            "hidden_ability": hidden_ability,
            "moves": moves_learned,
            "egg_moves": egg_moves,
            "kind": raw.get("Kind", ""),
            "pokedex": raw.get("Pokedex", ""),
            "height": float(raw.get("Height", 1.0)),
            "weight": float(raw.get("Weight", 10.0)),
            "color": raw.get("Color", ""),
            "habitat": raw.get("Habitat", "")
        }

        self.pokemon[data["name"].lower()] = data
        self.pokemon[data["internal_name"].lower()] = data
        if data["id"] > 0:
            self.pokemon_by_id[data["id"]] = data

    def load_all(self):
        self.load_types()
        self.load_abilities()
        self.load_moves()
        self.load_pokemon()

    def get_pokemon(self, identifier: Any) -> Optional[Dict[str, Any]]:
        if isinstance(identifier, int):
            return self.pokemon_by_id.get(identifier)
        if isinstance(identifier, str):
            identifier = identifier.strip().lower()
            if identifier.isdigit():
                return self.pokemon_by_id.get(int(identifier))
            return self.pokemon.get(identifier)
        return None

    def search_pokemon(self, query: str, limit: int = 5) -> List[Dict[str, Any]]:
        query = query.strip().lower()
        results = []
        seen = set()
        for key, p in self.pokemon.items():
            if p["name"] in seen:
                continue
            if query in key or query in p["name"].lower():
                results.append(p)
                seen.add(p["name"])
                if len(results) >= limit:
                    break
        return results

    def get_move(self, name_or_internal: str) -> Optional[Dict[str, Any]]:
        name_or_internal = name_or_internal.strip().upper()
        if name_or_internal in self.moves:
            return self.moves[name_or_internal]
        for m in self.moves.values():
            if m["name"].upper() == name_or_internal:
                return m
        return None

    def get_ability(self, name_or_internal: str) -> Optional[Dict[str, Any]]:
        name_or_internal = name_or_internal.strip().upper()
        if name_or_internal in self.abilities:
            return self.abilities[name_or_internal]
        for a in self.abilities.values():
            if a["name"].upper() == name_or_internal:
                return a
        return None

    def get_learnable_moves(self, pkmn: Dict[str, Any]) -> List[Dict[str, Any]]:
        seen = set()
        moves_list = []
        
        # Level-up moves
        for m_info in pkmn.get("moves", []):
            m_id = m_info["move"].upper()
            if m_id not in seen:
                seen.add(m_id)
                m_obj = self.get_move(m_id)
                if m_obj:
                    moves_list.append(m_obj)
                    
        # Egg moves
        for m_id in pkmn.get("egg_moves", []):
            m_id = m_id.upper()
            if m_id not in seen:
                seen.add(m_id)
                m_obj = self.get_move(m_id)
                if m_obj:
                    moves_list.append(m_obj)
                    
        moves_list.sort(key=lambda m: m["name"])
        return moves_list
