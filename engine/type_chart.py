from typing import Dict, List, Any, Optional

ALL_TYPES = [
    "NORMAL", "FIGHTING", "FLYING", "POISON", "GROUND", "ROCK", "BUG",
    "GHOST", "STEEL", "FIRE", "WATER", "GRASS", "ELECTRIC", "PSYCHIC",
    "ICE", "DRAGON", "DARK", "FAIRY"
]

SPANISH_TYPE_NAMES = {
    "NORMAL": "Normal", "FIGHTING": "Lucha", "FLYING": "Volador",
    "POISON": "Veneno", "GROUND": "Tierra", "ROCK": "Roca", "BUG": "Bicho",
    "GHOST": "Fantasma", "STEEL": "Acero", "FIRE": "Fuego", "WATER": "Agua",
    "GRASS": "Planta", "ELECTRIC": "Eléctrico", "PSYCHIC": "Psíquico",
    "ICE": "Hielo", "DRAGON": "Dragón", "DARK": "Siniestro", "FAIRY": "Hada"
}

TYPE_COLORS = {
    "NORMAL": "#A8A878", "FIGHTING": "#C03028", "FLYING": "#A890F0",
    "POISON": "#A040A0", "GROUND": "#E0C068", "ROCK": "#B8A038", "BUG": "#A8B820",
    "GHOST": "#705898", "STEEL": "#B8B8D0", "FIRE": "#F08030", "WATER": "#6890F0",
    "GRASS": "#78C850", "ELECTRIC": "#F8D030", "PSYCHIC": "#F85888",
    "ICE": "#98D8D8", "DRAGON": "#7038F8", "DARK": "#705848", "FAIRY": "#EE99AC"
}

class TypeChart:
    def __init__(self, pbs_types: Dict[str, Dict[str, Any]]):
        self.pbs_types = pbs_types

    def get_single_effectiveness(self, attacking_type: str, defending_type: str) -> float:
        att = attacking_type.upper()
        df = defending_type.upper()
        
        def_info = self.pbs_types.get(df)
        if not def_info:
            return 1.0

        if att in def_info.get("Immunities", []):
            return 0.0
        if att in def_info.get("Weaknesses", []):
            return 2.0
        if att in def_info.get("Resistances", []):
            return 0.5
        return 1.0

    def get_matchups(self, type1: str, type2: Optional[str] = None) -> Dict[str, Any]:
        matchups: Dict[str, float] = {}
        for att in ALL_TYPES:
            mult1 = self.get_single_effectiveness(att, type1)
            mult2 = self.get_single_effectiveness(att, type2) if type2 else 1.0
            matchups[att] = mult1 * mult2

        weaknesses_4x = [t for t, m in matchups.items() if m >= 4.0]
        weaknesses_2x = [t for t, m in matchups.items() if 2.0 <= m < 4.0]
        resistances_half = [t for t, m in matchups.items() if 0.25 < m <= 0.5]
        resistances_quarter = [t for t, m in matchups.items() if 0.0 < m <= 0.25]
        immunities = [t for t, m in matchups.items() if m == 0.0]
        neutral = [t for t, m in matchups.items() if m == 1.0]

        return {
            "all": matchups,
            "weaknesses_4x": weaknesses_4x,
            "weaknesses_2x": weaknesses_2x,
            "weaknesses": weaknesses_4x + weaknesses_2x,
            "resistances_half": resistances_half,
            "resistances_quarter": resistances_quarter,
            "resistances": resistances_half + resistances_quarter,
            "immunities": immunities,
            "neutral": neutral
        }

    def audit_team(self, team_pokemon: List[Dict[str, Any]]) -> Dict[str, Any]:
        team_weakness_count: Dict[str, int] = {t: 0 for t in ALL_TYPES}
        team_resistance_count: Dict[str, int] = {t: 0 for t in ALL_TYPES}
        team_immunity_count: Dict[str, int] = {t: 0 for t in ALL_TYPES}
        
        individual_matchups = []
        team_stabs = set()

        for pkmn in team_pokemon:
            t1 = pkmn.get("type1", "NORMAL")
            t2 = pkmn.get("type2")
            team_stabs.add(t1)
            if t2:
                team_stabs.add(t2)

            matchups = self.get_matchups(t1, t2)
            individual_matchups.append({
                "pokemon": pkmn.get("name"),
                "types": [t1, t2] if t2 else [t1],
                "matchups": matchups
            })

            for w in matchups["weaknesses"]:
                team_weakness_count[w] += 1
            for r in matchups["resistances"]:
                team_resistance_count[r] += 1
            for im in matchups["immunities"]:
                team_immunity_count[im] += 1

        # Critical vulnerabilities: 3 or more weak and fewer than 2 resist
        critical_vulnerabilities = []
        for t in ALL_TYPES:
            weak_cnt = team_weakness_count[t]
            res_cnt = team_resistance_count[t] + team_immunity_count[t]
            if weak_cnt >= 3 and res_cnt < 2:
                critical_vulnerabilities.append({
                    "type": t,
                    "type_name_es": SPANISH_TYPE_NAMES.get(t, t),
                    "weak_count": weak_cnt,
                    "resist_count": res_cnt,
                    "severity": "CRITICAL" if weak_cnt >= 4 else "HIGH"
                })

        # Calculate offensive STAB coverage
        offensive_coverage: Dict[str, List[str]] = {}
        for stab in team_stabs:
            super_effective_against = []
            for target_type in ALL_TYPES:
                if self.get_single_effectiveness(stab, target_type) > 1.0:
                    super_effective_against.append(target_type)
            offensive_coverage[stab] = super_effective_against

        all_covered_types = set()
        for targets in offensive_coverage.values():
            all_covered_types.update(targets)

        uncovered_types = [t for t in ALL_TYPES if t not in all_covered_types]

        return {
            "team_size": len(team_pokemon),
            "critical_vulnerabilities": critical_vulnerabilities,
            "weakness_distribution": team_weakness_count,
            "resistance_distribution": team_resistance_count,
            "immunity_distribution": team_immunity_count,
            "stabs_present": list(team_stabs),
            "uncovered_types_offensively": uncovered_types,
            "individual_matchups": individual_matchups
        }
