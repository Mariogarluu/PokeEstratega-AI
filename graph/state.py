from typing import TypedDict, List, Dict, Any, Optional

class PokeState(TypedDict):
    query: str
    session_id: str
    team: List[Dict[str, Any]]
    intent: str
    detected_pokemon: List[str]
    context: str
    response: str
    last_pokemon: Optional[str]
