from typing import Dict, Any
from langgraph.graph import StateGraph, START, END
from graph.state import PokeState
from graph.nodes import (
    classify_intent_node,
    pokedex_node,
    matchup_node,
    team_manager_node,
    showdown_node,
    synthesizer_node
)

def route_intent(state: PokeState) -> str:
    intent = state.get("intent", "general")
    if intent in ("add_team", "remove_team", "team_audit", "team_build_suggest"):
        return "team_manager"
    if intent == "matchup":
        return "matchup"
    if intent == "pokedex":
        return "pokedex"
    if intent == "showdown_export":
        return "showdown"
    return "synthesizer"

def create_pokemon_graph():
    workflow = StateGraph(PokeState)

    workflow.add_node("classify", classify_intent_node)
    workflow.add_node("pokedex", pokedex_node)
    workflow.add_node("matchup", matchup_node)
    workflow.add_node("team_manager", team_manager_node)
    workflow.add_node("showdown", showdown_node)
    workflow.add_node("synthesizer", synthesizer_node)

    workflow.add_edge(START, "classify")

    workflow.add_conditional_edges(
        "classify",
        route_intent,
        {
            "pokedex": "pokedex",
            "matchup": "matchup",
            "team_manager": "team_manager",
            "showdown": "showdown",
            "synthesizer": "synthesizer"
        }
    )

    workflow.add_edge("pokedex", "synthesizer")
    workflow.add_edge("matchup", "synthesizer")
    workflow.add_edge("team_manager", "synthesizer")
    workflow.add_edge("showdown", "synthesizer")
    workflow.add_edge("synthesizer", END)

    return workflow.compile()

# Global compiled graph instance
poke_app = create_pokemon_graph()
