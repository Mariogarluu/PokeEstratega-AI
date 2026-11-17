from typing import Dict, List, Any, Optional

NATURES = {
    "Physical Sweeper": {"nature": "Jolly", "evs": "252 Atk / 4 SpD / 252 Spe", "item": "Life Orb"},
    "Special Sweeper": {"nature": "Timid", "evs": "252 SpA / 4 SpD / 252 Spe", "item": "Choice Specs"},
    "Physical Wall": {"nature": "Impish", "evs": "252 HP / 252 Def / 4 SpD", "item": "Leftovers"},
    "Special Wall": {"nature": "Calm", "evs": "252 HP / 4 Def / 252 SpD", "item": "Leftovers"},
    "Bulky Physical": {"nature": "Adamant", "evs": "252 HP / 252 Atk / 4 Spe", "item": "Assault Vest"},
    "Bulky Special": {"nature": "Modest", "evs": "252 HP / 252 SpA / 4 Spe", "item": "Assault Vest"},
    "Balanced": {"nature": "Adamant", "evs": "252 Atk / 4 Def / 252 Spe", "item": "Focus Sash"}
}

SETUP_UTILITY_MOVES = {
    "SWORDSDANCE", "DRAGONDANCE", "NASTYPLOT", "CALMMIND", "QUIVERDANCE",
    "AGILITY", "SHELLSMASH", "STEALTHROCK", "SPIKES", "TOXIC", "WILLOWISP",
    "THUNDERWAVE", "RECOVER", "ROOST", "SOFTBOILED", "MOONLIGHT", "SYNTHESIS",
    "SLACKOFF", "SUBSTITUTE", "PROTECT", "TAUNT", "DEFOG", "RAPIDSPIN"
}


ALL_NATURES = [
    {"name": "Adamant", "label": "Adamant (+Atk, -SpA)", "desc": "Firme (+Ataque, -Atq.Esp)"},
    {"name": "Jolly", "label": "Jolly (+Spe, -SpA)", "desc": "Alegre (+Velocidad, -Atq.Esp)"},
    {"name": "Modest", "label": "Modest (+SpA, -Atk)", "desc": "Modesta (+Atq.Esp, -Ataque)"},
    {"name": "Timid", "label": "Timid (+Spe, -Atk)", "desc": "Miedosa (+Velocidad, -Ataque)"},
    {"name": "Impish", "label": "Impish (+Def, -SpA)", "desc": "Agitada (+Defensa, -Atq.Esp)"},
    {"name": "Calm", "label": "Calm (+SpD, -Atk)", "desc": "Serena (+Def.Esp, -Ataque)"},
    {"name": "Bold", "label": "Bold (+Def, -Atk)", "desc": "Osada (+Defensa, -Ataque)"},
    {"name": "Careful", "label": "Careful (+SpD, -SpA)", "desc": "Cauta (+Def.Esp, -Atq.Esp)"},
    {"name": "Naive", "label": "Naive (+Spe, -SpD)", "desc": "Ingenua (+Velocidad, -Def.Esp)"},
    {"name": "Hasty", "label": "Hasty (+Spe, -Def)", "desc": "Activa (+Velocidad, -Defensa)"},
    {"name": "Quiet", "label": "Quiet (+SpA, -Spe)", "desc": "Mansa (+Atq.Esp, -Velocidad)"},
    {"name": "Brave", "label": "Brave (+Atk, -Spe)", "desc": "Audaz (+Ataque, -Velocidad)"},
    {"name": "Relaxed", "label": "Relaxed (+Def, -Spe)", "desc": "Plácida (+Defensa, -Velocidad)"},
    {"name": "Sassy", "label": "Sassy (+SpD, -Spe)", "desc": "Grosera (+Def.Esp, -Velocidad)"},
    {"name": "Hardy", "label": "Hardy (Neutral)", "desc": "Fuerte (Neutral)"}
]

COMPETITIVE_ITEMS = [
    {"name": "Life Orb", "desc": "Vidasfera (+30% daño, -10% PS por golpe)"},
    {"name": "Leftovers", "desc": "Restos (Recupera 1/16 PS cada turno)"},
    {"name": "Choice Band", "desc": "Cinta Elección (+50% Ataque, bloquea movimiento)"},
    {"name": "Choice Specs", "desc": "Gafas Elección (+50% Atq.Esp, bloquea movimiento)"},
    {"name": "Choice Scarf", "desc": "Pañuelo Elección (+50% Velocidad, bloquea movimiento)"},
    {"name": "Assault Vest", "desc": "Chaleco Asalto (+50% Def.Esp, solo movimientos de daño)"},
    {"name": "Focus Sash", "desc": "Banda Focus (Sobrevive con 1 PS a golpes fulminantes)"},
    {"name": "Heavy-Duty Boots", "desc": "Botas Gruesas (Inmune a trampa rocas y púas)"},
    {"name": "Rocky Helmet", "desc": "Casco Dentado (Daña 1/6 al rival al recibir contacto)"},
    {"name": "Eviolite", "desc": "Mineral Evolutivo (+50% Def y Def.Esp si puede evolucionar)"},
    {"name": "Light Clay", "desc": "Refleluz (Aumenta pantallas a 8 turnos)"},
    {"name": "Expert Belt", "desc": "Cinta Experto (+20% daño si es supereficaz)"},
    {"name": "Air Balloon", "desc": "Globo Helio (Inmunidad a Tierra hasta recibir daño)"},
    {"name": "Sitrus Berry", "desc": "Baya Zidra (Restaura 25% PS al bajar de 50%)"},
    {"name": "Lum Berry", "desc": "Baya Milagro (Cura cualquier cambio de estado)"},
    {"name": "Weakness Policy", "desc": "Seguro Debilidad (+2 Atk y Atq.Esp al recibir golpe supereficaz)"}
]

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

        item = pkmn.get("item") or profile["item"]
        
        # Ability: check custom or default
        if pkmn.get("ability"):
            ability_name = pkmn["ability"]
        else:
            ability = pkmn.get("hidden_ability") or (pkmn["abilities"][0] if pkmn.get("abilities") else "Cursed Body")
            ab_obj = self.parser.get_ability(ability)
            ability_name = ab_obj["name"] if ab_obj else ability

        nature = pkmn.get("nature") or profile["nature"]
        if " " in nature:
            nature = nature.split(" ")[0]

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
