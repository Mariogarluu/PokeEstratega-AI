import os
from typing import List, Dict, Any, Optional
from langchain_core.documents import Document
from langchain_chroma import Chroma
from langchain_ollama import OllamaEmbeddings
from engine.pbs_parser import PBSParser
from engine.type_chart import TypeChart, SPANISH_TYPE_NAMES
from engine.showdown import ShowdownExporter

BASE_DIR = os.path.dirname(os.path.dirname(__file__))
CHROMA_DIR = os.path.join(BASE_DIR, "chroma_db")
COLLECTION_NAME = "pokemon_competitive"

def build_pokemon_documents(parser: PBSParser, type_chart: TypeChart, exporter: ShowdownExporter) -> List[Document]:
    docs = []
    
    for pid, pkmn in parser.pokemon_by_id.items():
        name = pkmn["name"]
        t1 = pkmn["type1"]
        t2 = pkmn.get("type2")
        t1_es = SPANISH_TYPE_NAMES.get(t1, t1)
        t2_es = f" / {SPANISH_TYPE_NAMES.get(t2, t2)}" if t2 else ""
        
        bs = pkmn["base_stats"]
        bst = pkmn["bst"]
        role = exporter.determine_role(pkmn)
        
        matchups = type_chart.get_matchups(t1, t2)
        weaknesses_str = ", ".join([f"{SPANISH_TYPE_NAMES.get(w, w)} (x4)" for w in matchups["weaknesses_4x"]] +
                                   [f"{SPANISH_TYPE_NAMES.get(w, w)} (x2)" for w in matchups["weaknesses_2x"]]) or "Ninguna"
        resistances_str = ", ".join([f"{SPANISH_TYPE_NAMES.get(r, r)}" for r in matchups["resistances"]]) or "Ninguna"
        immunities_str = ", ".join([f"{SPANISH_TYPE_NAMES.get(i, i)}" for i in matchups["immunities"]]) or "Ninguna"
        
        abilities_list = []
        for a in pkmn.get("abilities", []):
            a_obj = parser.get_ability(a)
            abilities_list.append(a_obj["name"] if a_obj else a)
        abilities_str = ", ".join(abilities_list)
        
        if pkmn.get("hidden_ability"):
            ha_obj = parser.get_ability(pkmn["hidden_ability"])
            ha_str = f" | Habilidad Oculta: {ha_obj['name'] if ha_obj else pkmn['hidden_ability']}"
        else:
            ha_str = ""

        # Key moves
        top_moves = exporter.select_competitive_moves(pkmn, role)
        moves_str = ", ".join(top_moves) if top_moves else "Movimientos estándar"

        pokedex_desc = pkmn.get("pokedex", "").strip()

        content = f"""Pokémon: {name} (ID: #{pid})
Tipos: {t1_es}{t2_es}
Rol Competitivo: {role}
Estadísticas Base: PS: {bs['hp']}, Ataque: {bs['attack']}, Defensa: {bs['defense']}, Ataque Esp: {bs['sp_attack']}, Defensa Esp: {bs['sp_defense']}, Velocidad: {bs['speed']} | Total (BST): {bst}
Habilidades: {abilities_str}{ha_str}
Debilidades: {weaknesses_str}
Resistencias: {resistances_str}
Inmunidades: {immunities_str}
Movimientos Competitivos Recomendados: {moves_str}
Información de Pokédex: {pokedex_desc}"""

        metadata = {
            "id": pid,
            "name": name.lower(),
            "display_name": name,
            "type1": t1,
            "type2": t2 or "NONE",
            "bst": bst,
            "speed": bs["speed"],
            "attack": bs["attack"],
            "sp_attack": bs["sp_attack"],
            "defense": bs["defense"],
            "sp_defense": bs["sp_defense"],
            "hp": bs["hp"],
            "role": role
        }

        docs.append(Document(page_content=content, metadata=metadata, id=f"pkmn-{pid}"))

    return docs

def get_vectorstore(persist_dir: str = CHROMA_DIR, ollama_url: str = "http://localhost:11434") -> Chroma:
    embeddings = OllamaEmbeddings(
        model="nomic-embed-text",
        base_url=ollama_url
    )
    return Chroma(
        collection_name=COLLECTION_NAME,
        embedding_function=embeddings,
        persist_directory=persist_dir
    )

def index_all_pokemon(persist_dir: str = CHROMA_DIR, ollama_url: str = "http://localhost:11434", batch_size: int = 100) -> Chroma:
    parser = PBSParser()
    type_chart = TypeChart(parser.types)
    exporter = ShowdownExporter(parser)

    docs = build_pokemon_documents(parser, type_chart, exporter)
    vectorstore = get_vectorstore(persist_dir=persist_dir, ollama_url=ollama_url)

    # Check existing count
    try:
        existing_count = vectorstore._collection.count()
        if existing_count >= len(docs):
            print(f"ChromaDB ya contiene {existing_count} Pokémon indexados. Omitiendo reindexación.")
            return vectorstore
    except Exception:
        pass

    print(f"Indexando {len(docs)} Pokémon en ChromaDB en lotes de {batch_size}...")
    for i in range(0, len(docs), batch_size):
        batch = docs[i : i + batch_size]
        vectorstore.add_documents(documents=batch, ids=[d.id for d in batch])
        print(f"  -> Indexados {min(i + batch_size, len(docs))}/{len(docs)} Pokémon...")

    print("Indexación completada con éxito.")
    return vectorstore
