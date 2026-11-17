from typing import Dict, List, Any, Optional

NATURES = {
    "Physical Sweeper": {"nature": "Alegre", "evs": "252 Atk / 4 SpD / 252 Spe", "item": "Vidasfera"},
    "Special Sweeper": {"nature": "Miedosa", "evs": "252 SpA / 4 SpD / 252 Spe", "item": "Gafas Elección"},
    "Physical Wall": {"nature": "Agitada", "evs": "252 HP / 252 Def / 4 SpD", "item": "Restos"},
    "Special Wall": {"nature": "Serena", "evs": "252 HP / 4 Def / 252 SpD", "item": "Restos"},
    "Bulky Physical": {"nature": "Firme", "evs": "252 HP / 252 Atk / 4 Spe", "item": "Chaleco Asalto"},
    "Bulky Special": {"nature": "Modesta", "evs": "252 HP / 252 SpA / 4 Spe", "item": "Chaleco Asalto"},
    "Balanced": {"nature": "Firme", "evs": "252 Atk / 4 Def / 252 Spe", "item": "Banda Focus"}
}

SETUP_UTILITY_MOVES = {
    "SWORDSDANCE", "DRAGONDANCE", "NASTYPLOT", "CALMMIND", "QUIVERDANCE",
    "AGILITY", "SHELLSMASH", "STEALTHROCK", "SPIKES", "TOXIC", "WILLOWISP",
    "THUNDERWAVE", "RECOVER", "ROOST", "SOFTBOILED", "MOONLIGHT", "SYNTHESIS",
    "SLACKOFF", "SUBSTITUTE", "PROTECT", "TAUNT", "DEFOG", "RAPIDSPIN"
}

ALL_NATURES = [
    {"name": "Firme", "label": "Firme (+Atk, -Atq.Esp)", "desc": "Firme (+Ataque, -Atq.Esp)", "plus": "Ataque", "minus": "Atq.Esp"},
    {"name": "Alegre", "label": "Alegre (+Vel, -Atq.Esp)", "desc": "Alegre (+Velocidad, -Atq.Esp)", "plus": "Velocidad", "minus": "Atq.Esp"},
    {"name": "Modesta", "label": "Modesta (+Atq.Esp, -Atk)", "desc": "Modesta (+Atq.Esp, -Ataque)", "plus": "Atq.Esp", "minus": "Ataque"},
    {"name": "Miedosa", "label": "Miedosa (+Vel, -Atk)", "desc": "Miedosa (+Velocidad, -Ataque)", "plus": "Velocidad", "minus": "Ataque"},
    {"name": "Agitada", "label": "Agitada (+Def, -Atq.Esp)", "desc": "Agitada (+Defensa, -Atq.Esp)", "plus": "Defensa", "minus": "Atq.Esp"},
    {"name": "Serena", "label": "Serena (+Def.Esp, -Atk)", "desc": "Serena (+Def.Esp, -Ataque)", "plus": "Def.Esp", "minus": "Ataque"},
    {"name": "Osada", "label": "Osada (+Def, -Atk)", "desc": "Osada (+Defensa, -Ataque)", "plus": "Defensa", "minus": "Ataque"},
    {"name": "Cauta", "label": "Cauta (+Def.Esp, -Atq.Esp)", "desc": "Cauta (+Def.Esp, -Atq.Esp)", "plus": "Def.Esp", "minus": "Atq.Esp"},
    {"name": "Ingenua", "label": "Ingenua (+Vel, -Def.Esp)", "desc": "Ingenua (+Velocidad, -Def.Esp)", "plus": "Velocidad", "minus": "Def.Esp"},
    {"name": "Activa", "label": "Activa (+Vel, -Def)", "desc": "Activa (+Velocidad, -Defensa)", "plus": "Velocidad", "minus": "Defensa"},
    {"name": "Mansa", "label": "Mansa (+Atq.Esp, -Vel)", "desc": "Mansa (+Atq.Esp, -Velocidad)", "plus": "Atq.Esp", "minus": "Velocidad"},
    {"name": "Audaz", "label": "Audaz (+Atk, -Vel)", "desc": "Audaz (+Ataque, -Velocidad)", "plus": "Ataque", "minus": "Velocidad"},
    {"name": "Plácida", "label": "Plácida (+Def, -Vel)", "desc": "Plácida (+Defensa, -Velocidad)", "plus": "Defensa", "minus": "Velocidad"},
    {"name": "Grosera", "label": "Grosera (+Def.Esp, -Vel)", "desc": "Grosera (+Def.Esp, -Velocidad)", "plus": "Def.Esp", "minus": "Velocidad"},
    {"name": "Fuerte", "label": "Fuerte (Neutral)", "desc": "Fuerte (Neutral)", "plus": "Equilibrado", "minus": "Equilibrado"}
]

COMPETITIVE_ITEMS = [
    {"name": "Vidasfera", "desc": "Vidasfera (+30% daño, -10% PS por golpe)"},
    {"name": "Restos", "desc": "Restos (Recupera 1/16 PS cada turno)"},
    {"name": "Chaleco Asalto", "desc": "Chaleco Asalto (+50% Def.Esp, solo movimientos de daño)"},
    {"name": "Banda Focus", "desc": "Banda Focus (Sobrevive con 1 PS a golpes fulminantes)"},
    {"name": "Cinta Elección", "desc": "Cinta Elección (+50% Ataque, bloquea movimiento)"},
    {"name": "Gafas Elección", "desc": "Gafas Elección (+50% Atq.Esp, bloquea movimiento)"},
    {"name": "Pañuelo Elección", "desc": "Pañuelo Elección (+50% Velocidad, bloquea movimiento)"},
    {"name": "Botas Gruesas", "desc": "Botas Gruesas (Inmune a trampa rocas y púas)"},
    {"name": "Casco Dentado", "desc": "Casco Dentado (Daña 1/6 al rival al recibir contacto)"},
    {"name": "Mineral Evolutivo", "desc": "Mineral Evolutivo (+50% Def y Def.Esp si puede evolucionar)"},
    {"name": "Refleluz", "desc": "Refleluz (Aumenta pantallas a 8 turnos)"},
    {"name": "Cinturón Experto", "desc": "Cinturón Experto (+20% daño si es supereficaz)"},
    {"name": "Globo Helio", "desc": "Globo Helio (Inmunidad a Tierra hasta recibir daño)"},
    {"name": "Baya Zidra", "desc": "Baya Zidra (Restaura 25% PS al bajar de 50%)"},
    {"name": "Baya Ziuela", "desc": "Baya Ziuela (Cura cualquier cambio de estado)"},
    {"name": "Seguro Debilidad", "desc": "Seguro Debilidad (+2 Atk y Atq.Esp al recibir golpe supereficaz)"},
    {"name": "Lodo Negro", "desc": "Lodo Negro (Recupera 1/16 PS a Pokémon Veneno)"},
    {"name": "Toxisfera", "desc": "Toxisfera (Envenena al portador al final del turno)"}
]

SPANISH_TO_ENGLISH_ITEMS = {
    "vidasfera": "Life Orb",
    "restos": "Leftovers",
    "chaleco asalto": "Assault Vest",
    "banda focus": "Focus Sash",
    "cinta elección": "Choice Band",
    "cinta eleccion": "Choice Band",
    "gafas elección": "Choice Specs",
    "gafas eleccion": "Choice Specs",
    "pañuelo elección": "Choice Scarf",
    "pañuelo eleccion": "Choice Scarf",
    "botas gruesas": "Heavy-Duty Boots",
    "casco dentado": "Rocky Helmet",
    "mineral evolutivo": "Eviolite",
    "refleluz": "Light Clay",
    "cinturón experto": "Expert Belt",
    "cinturon experto": "Expert Belt",
    "globo helio": "Air Balloon",
    "baya zidra": "Sitrus Berry",
    "baya ziuela": "Lum Berry",
    "seguro debilidad": "Weakness Policy",
    "lodo negro": "Black Sludge",
    "toxisfera": "Toxic Orb",
    "llamasfera": "Flame Orb"
}

SPANISH_TO_ENGLISH_NATURES = {
    "firme": "Adamant",
    "alegre": "Jolly",
    "modesta": "Modest",
    "miedosa": "Timid",
    "agitada": "Impish",
    "serena": "Calm",
    "osada": "Bold",
    "cauta": "Careful",
    "ingenua": "Naive",
    "activa": "Hasty",
    "mansa": "Quiet",
    "audaz": "Brave",
    "plácida": "Relaxed",
    "placida": "Relaxed",
    "grosera": "Sassy",
    "fuerte": "Hardy"
}

class ShowdownExporter:
    def __init__(self, pbs_parser):
        self.parser = pbs_parser

    def determine_role(self, pkmn: Dict[str, Any]) -> str:
        bs = pkmn["base_stats"]
        atk = bs["attack"]
        spa = bs["sp_attack"]
        spe = bs["speed"]
        hp = bs["hp"]
        df = bs["defense"]
        spd = bs["sp_defense"]

        if spe >= 85:
            if spa > atk + 10:
                return "Special Sweeper"
            elif atk > spa + 10:
                return "Physical Sweeper"
            elif spa >= atk:
                return "Special Sweeper"
            else:
                return "Physical Sweeper"
        
        # Bulky / Walls
        if df >= 95 and hp >= 75:
            return "Physical Wall"
        if spd >= 95 and hp >= 75:
            return "Special Wall"
        
        if atk >= spa:
            return "Bulky Physical"
        return "Bulky Special"

    def select_competitive_moves(self, pkmn: Dict[str, Any], role: str) -> List[str]:
        type1 = pkmn["type1"]
        type2 = pkmn.get("type2")
        types = [type1] + ([type2] if type2 else [])

        all_learned = []
        for m_info in pkmn.get("moves", []):
            m_name = m_info["move"].upper()
            if m_name not in all_learned:
                all_learned.append(m_name)
        for m_name in pkmn.get("egg_moves", []):
            m_name = m_name.upper()
            if m_name not in all_learned:
                all_learned.append(m_name)

        target_cat = "Physical" if "Physical" in role else "Special"
        is_wall = "Wall" in role

        stab_moves = []
        coverage_moves = []
        utility_moves = []

        for m_internal in all_learned:
            m_obj = self.parser.get_move(m_internal)
            if not m_obj:
                continue

            m_type = m_obj["type"]
            m_cat = m_obj["category"]
            m_power = m_obj["power"]
            m_display = m_obj["name"]

            if m_internal in SETUP_UTILITY_MOVES:
                utility_moves.append((m_display, 100))
            elif m_cat == target_cat and m_power > 0:
                if m_type in types:
                    stab_moves.append((m_display, m_power * 1.5))
                else:
                    coverage_moves.append((m_display, m_power))
            elif is_wall and m_power > 0:
                stab_moves.append((m_display, m_power))

        # Sort moves by effective power
        stab_moves.sort(key=lambda x: x[1], reverse=True)
        coverage_moves.sort(key=lambda x: x[1], reverse=True)

        chosen = []
        # Up to 2 STAB moves
        for m, _ in stab_moves[:2]:
            if m not in chosen:
                chosen.append(m)

        # 1 Utility / Setup move if available
        if utility_moves and len(chosen) < 4:
            chosen.append(utility_moves[0][0])

        # Fill remaining with best coverage moves
        for m, _ in coverage_moves:
            if m not in chosen:
                chosen.append(m)
            if len(chosen) >= 4:
                break

        # Fallback if less than 4
        for m, _ in stab_moves[2:]:
            if m not in chosen:
                chosen.append(m)
            if len(chosen) >= 4:
                break

        # If still empty, grab whatever level-up moves exist
        if not chosen and pkmn.get("moves"):
            for m_info in reversed(pkmn["moves"][-4:]):
                m_obj = self.parser.get_move(m_info["move"])
                m_display = m_obj["name"] if m_obj else m_info["move"]
                if m_display not in chosen:
                    chosen.append(m_display)

        return chosen[:4]


    def export_pokemon(self, pkmn: Dict[str, Any], custom_moves: Optional[List[str]] = None) -> str:
        name = pkmn["name"]
        role = self.determine_role(pkmn)
        profile = NATURES.get(role, NATURES["Balanced"])

        raw_item = pkmn.get("item") or profile["item"]
        item = SPANISH_TO_ENGLISH_ITEMS.get(raw_item.lower(), raw_item)
        
        # Ability: check custom or default
        raw_ability = pkmn.get("ability")
        if not raw_ability:
            raw_ability = pkmn.get("hidden_ability") or (pkmn["abilities"][0] if pkmn.get("abilities") else "Pressure")
        
        ab_obj = self.parser.get_ability(raw_ability)
        if ab_obj:
            ability_name = ab_obj.get("internal_name", raw_ability).title()
        else:
            ability_name = raw_ability

        raw_nature = pkmn.get("nature") or profile["nature"]
        if " " in raw_nature:
            raw_nature = raw_nature.split(" ")[0]
        nature = SPANISH_TO_ENGLISH_NATURES.get(raw_nature.lower(), raw_nature)

        evs = pkmn.get("evs") or profile["evs"]
        moves = custom_moves or pkmn.get("moves_custom") or pkmn.get("custom_moves") or self.select_competitive_moves(pkmn, role)

        lines = [
            f"{name} @ {item}",
            f"Ability: {ability_name}",
            f"EVs: {evs}",
            f"{nature} Nature"
        ]
        for m in moves:
            lines.append(f"- {m}")

        return "\n".join(lines)

    def export_team(self, team_pokemon: List[Dict[str, Any]]) -> str:
        blocks = [self.export_pokemon(p) for p in team_pokemon]
        return "\n\n".join(blocks)
