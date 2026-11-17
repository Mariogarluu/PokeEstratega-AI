let sessionId = localStorage.getItem("poke_session_id");
if (!sessionId) {
  sessionId = "sess-" + Math.random().toString(36).substring(2, 10);
  localStorage.setItem("poke_session_id", sessionId);
}

const TYPE_COLORS = {
  NORMAL: "#A8A878", FIGHTING: "#C03028", FLYING: "#A890F0",
  POISON: "#A040A0", GROUND: "#E0C068", ROCK: "#B8A038", BUG: "#A8B820",
  GHOST: "#705898", STEEL: "#B8B8D0", FIRE: "#F08030", WATER: "#6890F0",
  GRASS: "#78C850", ELECTRIC: "#F8D030", PSYCHIC: "#F85888",
  ICE: "#98D8D8", DRAGON: "#7038F8", DARK: "#705848", FAIRY: "#EE99AC"
};

const TYPE_NAMES_ES = {
  NORMAL: "Normal", FIGHTING: "Lucha", FLYING: "Volador",
  POISON: "Veneno", GROUND: "Tierra", ROCK: "Roca", BUG: "Bicho",
  GHOST: "Fantasma", STEEL: "Acero", FIRE: "Fuego", WATER: "Agua",
  GRASS: "Planta", ELECTRIC: "Eléctrico", PSYCHIC: "Psíquico",
  ICE: "Hielo", DRAGON: "Dragón", DARK: "Siniestro", FAIRY: "Hada"
};

function createTypeBadge(typeStr) {
  const t = (typeStr || "NORMAL").toUpperCase();
  const color = TYPE_COLORS[t] || "#777";
  const name = TYPE_NAMES_ES[t] || t;
  return `<span class="type-badge" style="background-color: ${color};">${name}</span>`;
}

// Initial Sync
document.addEventListener("DOMContentLoaded", () => {
  syncTeam();
  const input = document.getElementById("user-input");
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") sendMessage();
  });
});

async function syncTeam() {
  try {
    const res = await fetch(`/team/${sessionId}`);
    if (res.ok) {
      const data = await res.json();
      renderTeam(data.team);
    }
  } catch (err) {
    console.error("Error sincronizando equipo:", err);
  }
}

function renderTeam(teamList) {
  const container = document.getElementById("team-slots-container");
  const counter = document.getElementById("team-counter");
  counter.textContent = `${teamList.length} / 6`;

  if (!teamList || teamList.length === 0) {
    container.innerHTML = `
      <div class="team-slot" style="color: var(--text-secondary); font-size: 0.85rem; justify-content: center;">
        No tienes Pokémon en tu equipo aún.
      </div>
    `;
    return;
  }

  container.innerHTML = teamList.map(p => {
    const t1 = createTypeBadge(p.type1);
    const t2 = p.type2 ? createTypeBadge(p.type2) : "";
    return `
      <div class="team-slot filled">
        <div class="slot-info" onclick="inspectPokemon('${p.name}')" style="cursor: pointer;">
          <img src="/icon/${p.id}" class="slot-sprite" alt="${p.name}" onerror="this.style.display='none'">
          <div>
            <span class="slot-name">${p.name}</span>
            <div class="slot-types">${t1}${t2}</div>
          </div>
        </div>
        <button class="remove-btn" title="Eliminar del equipo" onclick="removeFromTeam('${p.name}')">✕</button>
      </div>
    `;
  }).join("");
}

async function removeFromTeam(name) {
  try {
    const res = await fetch(`/team/${sessionId}/remove`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name })
    });
    if (res.ok) {
      const data = await res.json();
      renderTeam(data.team);
      appendMessage("bot", `Se ha eliminado a **${name}** de tu equipo.`);
    }
  } catch (err) {
    console.error(err);
  }
}

async function clearTeam() {
  if (!confirm("¿Deseas vaciar todos los miembros del equipo?")) return;
  try {
    const res = await fetch(`/team/${sessionId}/clear`, { method: "POST" });
    if (res.ok) {
      renderTeam([]);
      appendMessage("bot", "Se ha vaciado el equipo.");
    }
  } catch (err) {
    console.error(err);
  }
}

async function inspectPokemon(nameOrId) {
  try {
    const res = await fetch(`/pokemon/${nameOrId}`);
    if (!res.ok) return;
    const data = await res.json();
    const pkmn = data.pokemon;
    const bs = pkmn.base_stats;
    const matchups = data.matchups;

    document.getElementById("inspect-pokename").textContent = `${pkmn.name} (#${pkmn.id})`;

    const t1 = createTypeBadge(pkmn.type1);
    const t2 = pkmn.type2 ? createTypeBadge(pkmn.type2) : "";

    const statRows = [
      { label: "PS", val: bs.hp, cls: "stat-hp" },
      { label: "Ataque", val: bs.attack, cls: "stat-atk" },
      { label: "Defensa", val: bs.defense, cls: "stat-def" },
      { label: "Atq. Esp", val: bs.sp_attack, cls: "stat-spa" },
      { label: "Def. Esp", val: bs.sp_defense, cls: "stat-spd" },
      { label: "Velocidad", val: bs.speed, cls: "stat-spe" }
    ].map(s => {
      const pct = Math.min(100, Math.round((s.val / 200) * 100));
      return `
        <div class="stat-row">
          <span class="stat-label">${s.label}</span>
          <span class="stat-value">${s.val}</span>
          <div class="stat-bar-bg">
            <div class="stat-bar-fill ${s.cls}" style="width: ${pct}%;"></div>
          </div>
        </div>
      `;
    }).join("");

    const w4Badges = matchups.weaknesses_4x.map(t => createTypeBadge(t)).join(" ") || "<span style='color:#777;'>Ninguna</span>";
    const w2Badges = matchups.weaknesses_2x.map(t => createTypeBadge(t)).join(" ") || "<span style='color:#777;'>Ninguna</span>";
    const resBadges = matchups.resistances.map(t => createTypeBadge(t)).join(" ") || "<span style='color:#777;'>Ninguna</span>";
    const immBadges = matchups.immunities.map(t => createTypeBadge(t)).join(" ") || "<span style='color:#777;'>Ninguna</span>";

    document.getElementById("inspector-content").innerHTML = `
      <div class="inspect-header">
        <img src="/sprite/${pkmn.id}" class="inspect-sprite" alt="${pkmn.name}" onerror="this.src='/icon/${pkmn.id}';">
        <div>
          <div style="margin-bottom: 6px;">${t1} ${t2}</div>
          <span style="font-size: 0.85rem; color: var(--accent-cyan); font-weight: 700;">BST: ${pkmn.bst}</span>
        </div>
      </div>
      <div style="margin-bottom: 14px;">${statRows}</div>
      <div style="font-size: 0.8rem; line-height: 1.6;">
        <div><strong>Debilidades (x4):</strong> ${w4Badges}</div>
        <div style="margin-top: 4px;"><strong>Debilidades (x2):</strong> ${w2Badges}</div>
        <div style="margin-top: 4px;"><strong>Resistencias:</strong> ${resBadges}</div>
        <div style="margin-top: 4px;"><strong>Inmunidades (x0):</strong> ${immBadges}</div>
      </div>
    `;
  } catch (err) {
    console.error(err);
  }
}

async function sendMessage() {
  const input = document.getElementById("user-input");
  const text = input.value.trim();
  if (!text) return;

  input.value = "";
  appendMessage("user", text);

  // Loading state
  const loadingId = appendMessage("bot", "<em>Pensando estrategia y calculando multiplicadores...</em>");
  const sendBtn = document.getElementById("send-btn");
  sendBtn.disabled = true;

  try {
    const res = await fetch("/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text, session_id: sessionId })
    });

    const data = await res.json();
    updateMessage(loadingId, data.response || "No se obtuvo respuesta.");

    if (data.team) {
      renderTeam(data.team);
    }

    if (data.detected_pokemon && data.detected_pokemon.length > 0) {
      inspectPokemon(data.detected_pokemon[0]);
    }
  } catch (err) {
    updateMessage(loadingId, "⚠️ Error al conectar con el servidor: " + err.message);
  } finally {
    sendBtn.disabled = false;
    input.focus();
  }
}

function appendMessage(role, text) {
  const history = document.getElementById("chat-history");
  const id = "msg-" + Date.now() + "-" + Math.random().toString(36).substring(2, 6);
  const msgDiv = document.createElement("div");
  msgDiv.className = `message ${role}`;
  msgDiv.id = id;

  const avatar = role === "user" ? "👤" : "⚡";
  const parsedContent = (typeof marked !== "undefined" && marked.parse) ? marked.parse(text) : `<p>${text}</p>`;

  msgDiv.innerHTML = `
    <div class="msg-avatar">${avatar}</div>
    <div class="msg-content">${parsedContent}</div>
  `;

  history.appendChild(msgDiv);
  history.scrollTop = history.scrollHeight;
  return id;
}

function updateMessage(id, text) {
  const el = document.getElementById(id);
  if (!el) return;
  const contentDiv = el.querySelector(".msg-content");
  if (contentDiv) {
    contentDiv.innerHTML = (typeof marked !== "undefined" && marked.parse) ? marked.parse(text) : `<p>${text}</p>`;
  }
  const history = document.getElementById("chat-history");
  history.scrollTop = history.scrollHeight;
}

// Showdown Modal
async function openShowdownModal() {
  const modal = document.getElementById("showdown-modal");
  const textarea = document.getElementById("showdown-text");
  textarea.value = "Cargando formato Showdown...";
  modal.style.display = "flex";

  try {
    const res = await fetch(`/team/${sessionId}/export-showdown`);
    const paste = await res.text();
    textarea.value = paste;
  } catch (err) {
    textarea.value = "Error al obtener Showdown: " + err.message;
  }
}

function closeShowdownModal() {
  document.getElementById("showdown-modal").style.display = "none";
}

function copyShowdownClipboard() {
  const textarea = document.getElementById("showdown-text");
  textarea.select();
  navigator.clipboard.writeText(textarea.value);
  const btn = document.getElementById("copy-btn-text");
  btn.textContent = "✅ ¡Copiado!";
  setTimeout(() => { btn.textContent = "📋 Copiar al Portapapeles"; }, 2000);
}

// ---------------------------------------------------------------------
// Teambuilder & Customizer Modal Logic
// ---------------------------------------------------------------------
let allPokemonList = [];
let activeTypeFilter = "ALL";
let currentConfigPokemon = null;
let currentCustomData = null;

const ALL_TYPES = [
  "ALL", "NORMAL", "FIRE", "WATER", "GRASS", "ELECTRIC", "ICE", "FIGHTING",
  "POISON", "GROUND", "FLYING", "PSYCHIC", "BUG", "ROCK", "GHOST", "DRAGON", "STEEL", "DARK", "FAIRY"
];

async function openBuilderModal() {
  const modal = document.getElementById("builder-modal");
  modal.style.display = "flex";
  
  // Reset view to step 1
  document.getElementById("builder-step-select").style.display = "block";
  document.getElementById("builder-step-configure").style.display = "none";
  
  renderTypeFilters();
  
  if (!allPokemonList || allPokemonList.length === 0) {
    await loadPokemonList();
  } else {
    filterPokemonList();
  }
}

function closeBuilderModal() {
  document.getElementById("builder-modal").style.display = "none";
}

function renderTypeFilters() {
  const container = document.getElementById("builder-type-filters");
  container.innerHTML = ALL_TYPES.map(t => {
    const label = t === "ALL" ? "Todos" : (TYPE_NAMES_ES[t] || t);
    const activeCls = activeTypeFilter === t ? "active" : "";
    return `<button class="type-filter-btn ${activeCls}" onclick="setTypeFilter('${t}')">${label}</button>`;
  }).join("");
}

function setTypeFilter(t) {
  activeTypeFilter = t;
  renderTypeFilters();
  filterPokemonList();
}

async function loadPokemonList() {
  const grid = document.getElementById("builder-pkmn-grid");
  grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--text-secondary); padding: 20px;">Cargando Pokédex...</div>`;
  try {
    const res = await fetch("/pokemon-list");
    if (res.ok) {
      const data = await res.json();
      allPokemonList = data.pokemon;
      filterPokemonList();
    }
  } catch (err) {
    grid.innerHTML = `<div style="grid-column: 1/-1; color: #ff6b6b; padding: 20px;">Error al cargar la Pokédex: ${err.message}</div>`;
  }
}

function filterPokemonList() {
  const search = document.getElementById("builder-search").value.trim().toLowerCase();
  const grid = document.getElementById("builder-pkmn-grid");

  let filtered = allPokemonList;
  if (activeTypeFilter !== "ALL") {
    filtered = filtered.filter(p => p.type1 === activeTypeFilter || p.type2 === activeTypeFilter);
  }
  if (search) {
    filtered = filtered.filter(p => p.name.toLowerCase().includes(search) || p.id.toString() === search);
  }

  // Cap to 60 for smooth rendering
  const displayList = filtered.slice(0, 60);

  if (displayList.length === 0) {
    grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--text-secondary); padding: 30px;">No se encontraron Pokémon con ese criterio.</div>`;
    return;
  }

  grid.innerHTML = displayList.map(p => {
    const t1 = createTypeBadge(p.type1);
    const t2 = p.type2 ? createTypeBadge(p.type2) : "";
    return `
      <div class="builder-pkmn-card" onclick="selectPokemonForConfig('${p.id}')">
        <img src="/sprite/${p.id}" class="card-sprite" alt="${p.name}" loading="lazy" onerror="this.src='/icon/${p.id}';">
        <div class="card-name">${p.name}</div>
        <div class="card-id">#${p.id}</div>
        <div class="card-types">${t1}${t2}</div>
        <div class="card-bst">BST: ${p.bst}</div>
      </div>
    `;
  }).join("");
}

async function selectPokemonForConfig(nameOrId) {
  try {
    const res = await fetch(`/pokemon/${nameOrId}/custom-data`);
    if (!res.ok) return;
    const data = await res.json();
    currentCustomData = data;
    currentConfigPokemon = data.pokemon;

    // Switch step
    document.getElementById("builder-step-select").style.display = "none";
    document.getElementById("builder-step-configure").style.display = "block";

    // Render top card
    const pkmn = data.pokemon;
    const t1 = createTypeBadge(pkmn.type1);
    const t2 = pkmn.type2 ? createTypeBadge(pkmn.type2) : "";
    const bs = pkmn.base_stats;
    document.getElementById("config-top-card").innerHTML = `
      <img src="/sprite/${pkmn.id}" class="config-big-sprite" alt="${pkmn.name}" onerror="this.src='/icon/${pkmn.id}';">
      <div>
        <h3 style="font-size: 1.25rem; color: #fff; margin-bottom: 4px;">${pkmn.name} <span style="font-size: 0.85rem; color: var(--text-secondary);">#${pkmn.id}</span></h3>
        <div style="margin-bottom: 6px;">${t1} ${t2} <span style="margin-left: 8px; font-size: 0.82rem; color: var(--accent-yellow); font-weight: 700;">BST: ${pkmn.bst}</span></div>
        <div style="font-size: 0.8rem; color: var(--text-secondary);">
          PS: ${bs.hp} | Atq: ${bs.attack} | Def: ${bs.defense} | SpA: ${bs.sp_attack} | SpD: ${bs.sp_defense} | Vel: ${bs.speed}
        </div>
      </div>
    `;

    // Populate Moves
    const learnable = data.learnable_moves || [];
    const moveOptionsHtml = learnable.map(m => {
      const typeEs = TYPE_NAMES_ES[m.type] || m.type;
      const catLabel = m.category === "Physical" ? "Físico" : (m.category === "Special" ? "Especial" : "Estado");
      const potStr = m.power > 0 ? `(Pot: ${m.power})` : "(Estado)";
      return `<option value="${m.name}">[${catLabel}] ${m.name} ${potStr} - ${typeEs}</option>`;
    }).join("");

    const defMoves = data.default_moves || [];
    for (let i = 1; i <= 4; i++) {
      const sel = document.getElementById(`move-slot-${i}`);
      sel.innerHTML = moveOptionsHtml;
      // Preselect recommended move
      const targetMove = defMoves[i - 1];
      if (targetMove) {
        for (let opt of sel.options) {
          if (opt.value.toLowerCase() === targetMove.toLowerCase()) {
            sel.value = opt.value;
            break;
          }
        }
      }
    }

    // Populate Abilities
    const abilitySel = document.getElementById("config-ability");
    abilitySel.innerHTML = (data.abilities || []).map(a => {
      return `<option value="${a.name}">${a.name}</option>`;
    }).join("");
    if (data.default_ability) abilitySel.value = data.default_ability;

    // Populate Items
    const itemSel = document.getElementById("config-item");
    itemSel.innerHTML = (data.all_items || []).map(it => {
      return `<option value="${it.name}">${it.name} - ${it.desc}</option>`;
    }).join("");
    if (data.default_item) itemSel.value = data.default_item;

    // Populate Natures
    const natureSel = document.getElementById("config-nature");
    natureSel.innerHTML = (data.all_natures || []).map(nat => {
      return `<option value="${nat.name}">${nat.label} - ${nat.desc}</option>`;
    }).join("");
    if (data.default_nature) natureSel.value = data.default_nature;

  } catch (err) {
    alert("Error al obtener datos de personalización: " + err.message);
  }
}

function backToPokemonSelect() {
  document.getElementById("builder-step-configure").style.display = "none";
  document.getElementById("builder-step-select").style.display = "block";
}

async function saveCustomPokemon() {
  if (!currentConfigPokemon) return;

  const moves = [
    document.getElementById("move-slot-1").value,
    document.getElementById("move-slot-2").value,
    document.getElementById("move-slot-3").value,
    document.getElementById("move-slot-4").value
  ].filter(m => !!m);

  const ability = document.getElementById("config-ability").value;
  const item = document.getElementById("config-item").value;
  const nature = document.getElementById("config-nature").value;

  const saveBtn = document.getElementById("btn-save-custom-pokemon");
  saveBtn.disabled = true;

  try {
    const res = await fetch(`/team/${sessionId}/add_custom`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: currentConfigPokemon.name,
        moves: moves,
        ability: ability,
        item: item,
        nature: nature
      })
    });

    const data = await res.json();
    if (!res.ok) {
      alert(data.detail || "Error al añadir el Pokémon");
      return;
    }

    renderTeam(data.team);
    closeBuilderModal();

    // Inspect the newly added pokemon
    inspectPokemon(currentConfigPokemon.name);

    // Notify in chat
    if (data.chat_summary) {
      appendMessage("bot", `⚔️ ${data.chat_summary}`);
    }

  } catch (err) {
    alert("Error al guardar el Pokémon: " + err.message);
  } finally {
    saveBtn.disabled = false;
  }
}
