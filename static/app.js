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

// 4 Tabs State & Teambuilder Variables
let currentTab = "moves";
let selectedMoves = [null, null, null, null];
let selectedAbility = "";
let selectedItem = "";
let selectedNature = "";
let activeMoveCategoryFilter = "ALL";
let draggedMoveName = null;
let draggedSlotIndex = null;

function switchBuilderTab(tabKey) {
  currentTab = tabKey;
  const tabs = ["moves", "ability", "item", "nature"];
  tabs.forEach(t => {
    const btn = document.getElementById(`tab-btn-${t}`);
    const pane = document.getElementById(`tab-content-${t}`);
    if (t === tabKey) {
      if (btn) btn.classList.add("active");
      if (pane) pane.style.display = "flex";
    } else {
      if (btn) btn.classList.remove("active");
      if (pane) pane.style.display = "none";
    }
  });
}

function getMoveObj(moveName) {
  if (!moveName || !currentCustomData || !currentCustomData.learnable_moves) return null;
  const lower = moveName.trim().toLowerCase();
  const found = currentCustomData.learnable_moves.find(m => m.name.toLowerCase() === lower);
  if (found) return found;
  return {
    name: moveName,
    type: "NORMAL",
    category: "Physical",
    power: 0,
    accuracy: 100,
    pp: 20
  };
}

async function selectPokemonForConfig(nameOrId) {
  try {
    const res = await fetch(`/pokemon/${nameOrId}/custom-data`);
    if (!res.ok) return;
    const data = await res.json();
    currentCustomData = data;
    currentConfigPokemon = data.pokemon;

    // Initialize Selection State with Recommended Defaults
    const defMoves = data.default_moves || [];
    selectedMoves = [
      defMoves[0] || null,
      defMoves[1] || null,
      defMoves[2] || null,
      defMoves[3] || null
    ];
    selectedAbility = data.default_ability || (data.abilities[0] ? data.abilities[0].name : "");
    selectedItem = data.default_item || (data.all_items[0] ? data.all_items[0].name : "");
    selectedNature = data.default_nature || (data.all_natures[0] ? data.all_natures[0].name : "");
    activeMoveCategoryFilter = "ALL";

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
        <h3 style="font-size: 1.25rem; color: #fff; margin-bottom: 4px;">
          ${pkmn.name} <span style="font-size: 0.85rem; color: var(--text-secondary);">#${pkmn.id}</span>
        </h3>
        <div style="margin-bottom: 6px; display:flex; align-items:center; gap:6px;">
          ${t1} ${t2} 
          <span style="margin-left: 8px; font-size: 0.82rem; color: var(--accent-yellow); font-weight: 700;">BST: ${pkmn.bst}</span>
          <span style="font-size: 0.82rem; color: var(--accent-cyan); margin-left: 6px;">[${pkmn.role || 'Competitivo'}]</span>
        </div>
        <div style="font-size: 0.8rem; color: var(--text-secondary);">
          PS: ${bs.hp} | Atq: ${bs.attack} | Def: ${bs.defense} | SpA: ${bs.sp_attack} | SpD: ${bs.sp_defense} | Vel: ${bs.speed}
        </div>
      </div>
    `;

    // Reset to Tab 1 (Movimientos)
    switchBuilderTab("moves");

    // Render All 4 Tabs
    renderActiveMoveSlots();
    renderMovesPool();
    renderAbilitiesTab();
    renderItemsTab();
    renderNaturesTab();
    updateFooterSummary();

  } catch (err) {
    alert("Error al obtener datos de personalización: " + err.message);
  }
}

// ==========================================
// TAB 1: MOVIMIENTOS & DRAG AND DROP
// ==========================================

function renderActiveMoveSlots() {
  const container = document.getElementById("active-move-slots");
  if (!container) return;

  const equippedCount = selectedMoves.filter(m => m !== null).length;
  const badge = document.getElementById("moves-count-badge");
  if (badge) badge.textContent = `${equippedCount}/4`;

  container.innerHTML = [0, 1, 2, 3].map(slotIdx => {
    const moveName = selectedMoves[slotIdx];
    if (moveName) {
      const m = getMoveObj(moveName);
      const typeKey = (m.type || "NORMAL").toUpperCase();
      const typeColor = TYPE_COLORS[typeKey] || "#888";
      const catIcon = m.category === "Physical" ? "⚔️" : (m.category === "Special" ? "🔮" : "🛡️");
      const catName = m.category === "Physical" ? "Físico" : (m.category === "Special" ? "Especial" : "Estado");
      const potStr = m.power > 0 ? `Pot: ${m.power}` : "—";
      const accStr = m.accuracy ? `Prec: ${m.accuracy}%` : "Prec: —";

      return `
        <div class="active-slot-card" 
             style="border-color: ${typeColor}; background: linear-gradient(180deg, ${typeColor}18 0%, rgba(26,28,41,0.95) 100%);"
             draggable="true"
             ondragstart="handleSlotDragStart(event, ${slotIdx})"
             ondragover="handleSlotDragOver(event, ${slotIdx})"
             ondragleave="handleSlotDragLeave(event, ${slotIdx})"
             ondrop="handleSlotDrop(event, ${slotIdx})">
          <div class="slot-move-header">
            <div>
              <span style="font-size:0.68rem; color:${typeColor}; font-weight:700; text-transform:uppercase;">Ranura ${slotIdx + 1}</span>
              <div class="slot-move-name">${m.name}</div>
            </div>
            <button class="slot-remove-btn" title="Desequipar movimiento" onclick="removeMoveSlot(${slotIdx})">✕</button>
          </div>
          <div class="slot-move-meta">
            ${createTypeBadge(m.type)}
            <div class="slot-move-stats">
              <span>${catIcon} ${potStr}</span>
              <span>${accStr}</span>
            </div>
          </div>
        </div>
      `;
    } else {
      return `
        <div class="active-slot-card empty"
             ondragover="handleSlotDragOver(event, ${slotIdx})"
             ondragleave="handleSlotDragLeave(event, ${slotIdx})"
             ondrop="handleSlotDrop(event, ${slotIdx})">
          <span style="font-size:1.1rem; margin-bottom:2px;">➕</span>
          <span style="font-weight:600; color:#cbd5e1;">Ranura ${slotIdx + 1} Libre</span>
          <span style="font-size:0.72rem; color:var(--text-secondary); margin-top:2px;">Arrastra aquí o haz clic abajo</span>
        </div>
      `;
    }
  }).join("");

  // Re-render moves pool equipped state
  renderMovesPool();
  updateFooterSummary();
}

function renderMovesPool() {
  const container = document.getElementById("moves-pool-container");
  if (!container || !currentCustomData) return;

  const search = (document.getElementById("move-pool-search") ? document.getElementById("move-pool-search").value.trim().toLowerCase() : "");
  let moves = currentCustomData.learnable_moves || [];

  if (activeMoveCategoryFilter !== "ALL") {
    moves = moves.filter(m => m.category === activeMoveCategoryFilter);
  }
  if (search) {
    moves = moves.filter(m => m.name.toLowerCase().includes(search) || (m.type && m.type.toLowerCase().includes(search)));
  }

  if (moves.length === 0) {
    container.innerHTML = `<div style="grid-column: 1/-1; text-align:center; color:var(--text-secondary); padding:20px;">No se encontraron movimientos con esos filtros.</div>`;
    return;
  }

  container.innerHTML = moves.map(m => {
    const isEquipped = selectedMoves.some(sm => sm && sm.toLowerCase() === m.name.toLowerCase());
    const typeKey = (m.type || "NORMAL").toUpperCase();
    const typeColor = TYPE_COLORS[typeKey] || "#888";
    const catIcon = m.category === "Physical" ? "⚔️" : (m.category === "Special" ? "🔮" : "🛡️");
    const catName = m.category === "Physical" ? "Físico" : (m.category === "Special" ? "Especial" : "Estado");
    const potStr = m.power > 0 ? `Pot: ${m.power}` : "—";

    return `
      <div class="pool-move-card ${isEquipped ? 'is-equipped' : ''}" 
           style="border-left: 4px solid ${typeColor};"
           draggable="${!isEquipped}"
           ondragstart="handlePoolDragStart(event, '${m.name.replace(/'/g, "\\'")}')"
           onclick="handlePoolMoveClick('${m.name.replace(/'/g, "\\'")}')"
           title="${isEquipped ? 'Haz clic para desequipar' : 'Haz clic o arrastra para equipar'}">
        <div class="pool-card-top">
          <span class="pool-move-name">${m.name}</span>
          ${isEquipped ? '<span class="equipped-pill">✓ Equipado</span>' : createTypeBadge(m.type)}
        </div>
        <div class="pool-card-bottom">
          <span>${catIcon} ${catName}</span>
          <span>${potStr}</span>
          <span>${m.pp} PP</span>
        </div>
      </div>
    `;
  }).join("");
}

function handlePoolDragStart(e, moveName) {
  draggedMoveName = moveName;
  draggedSlotIndex = null;
  e.dataTransfer.setData("text/plain", moveName);
  e.currentTarget.classList.add("dragging");
  setTimeout(() => {
    if (e.target) e.target.classList.remove("dragging");
  }, 300);
}

function handleSlotDragStart(e, slotIdx) {
  draggedSlotIndex = slotIdx;
  draggedMoveName = selectedMoves[slotIdx];
  e.dataTransfer.setData("text/plain", draggedMoveName || "");
  e.currentTarget.classList.add("dragging");
}

function handleSlotDragOver(e, slotIdx) {
  e.preventDefault();
  e.currentTarget.classList.add("drag-over");
}

function handleSlotDragLeave(e, slotIdx) {
  e.currentTarget.classList.remove("drag-over");
}

function handleSlotDrop(e, targetSlotIdx) {
  e.preventDefault();
  e.currentTarget.classList.remove("drag-over");

  // Slot-to-Slot Swap
  if (draggedSlotIndex !== null) {
    const temp = selectedMoves[draggedSlotIndex];
    selectedMoves[draggedSlotIndex] = selectedMoves[targetSlotIdx];
    selectedMoves[targetSlotIdx] = temp;
    renderActiveMoveSlots();
    draggedSlotIndex = null;
    draggedMoveName = null;
    return;
  }

  // Pool-to-Slot Drag
  if (draggedMoveName) {
    // If already in another slot, remove it from that slot
    const existingIdx = selectedMoves.findIndex(m => m && m.toLowerCase() === draggedMoveName.toLowerCase());
    if (existingIdx !== -1) {
      selectedMoves[existingIdx] = selectedMoves[targetSlotIdx];
    }
    selectedMoves[targetSlotIdx] = draggedMoveName;
    renderActiveMoveSlots();
    draggedMoveName = null;
  }
}

function handlePoolMoveClick(moveName) {
  const existingIdx = selectedMoves.findIndex(m => m && m.toLowerCase() === moveName.toLowerCase());
  if (existingIdx !== -1) {
    // Unequip
    selectedMoves[existingIdx] = null;
  } else {
    // Equip in first free slot, or overwrite slot 3 (4th slot)
    const emptyIdx = selectedMoves.findIndex(m => m === null);
    if (emptyIdx !== -1) {
      selectedMoves[emptyIdx] = moveName;
    } else {
      selectedMoves[3] = moveName;
    }
  }
  renderActiveMoveSlots();
}

function removeMoveSlot(slotIdx) {
  selectedMoves[slotIdx] = null;
  renderActiveMoveSlots();
}

function restoreRecommendedMoves() {
  if (!currentCustomData || !currentCustomData.default_moves) return;
  const def = currentCustomData.default_moves;
  selectedMoves = [
    def[0] || null,
    def[1] || null,
    def[2] || null,
    def[3] || null
  ];
  renderActiveMoveSlots();
}

function filterMovesPool() {
  renderMovesPool();
}

function setCategoryFilter(category, btnEl) {
  activeMoveCategoryFilter = category;
  document.querySelectorAll(".category-pills .cat-pill").forEach(b => b.classList.remove("active"));
  if (btnEl) btnEl.classList.add("active");
  renderMovesPool();
}

// ==========================================
// TAB 2: HABILIDADES
// ==========================================

function renderAbilitiesTab() {
  if (!currentCustomData) return;
  const recomCard = document.getElementById("recom-ability-card");
  const list = document.getElementById("all-abilities-list");
  const defaultAb = currentCustomData.default_ability;
  const abilities = currentCustomData.abilities || [];

  const recomObj = abilities.find(a => a.name.toLowerCase() === defaultAb.toLowerCase()) || { name: defaultAb, description: "Habilidad recomendada competitiva.", hidden: false };
  const recomHidden = recomObj.hidden || recomObj.is_hidden;
  const recomDesc = recomObj.description || recomObj.desc || "Habilidad recomendada competitiva.";

  recomCard.innerHTML = `
    <div>
      <div class="recom-tag">⭐ Recomendada por el Meta</div>
      <div style="font-size:1.05rem; font-weight:700; color:#fff; display:flex; align-items:center; gap:8px;">
        <span>${recomObj.name}</span>
        ${recomHidden ? '<span class="ability-badge-hidden">Habilidad Oculta</span>' : '<span class="ability-badge-normal">Habilidad Estándar</span>'}
      </div>
      <div style="font-size:0.8rem; color:var(--text-secondary); margin-top:4px;">${recomDesc}</div>
    </div>
    <button class="action-btn ${selectedAbility.toLowerCase() === recomObj.name.toLowerCase() ? 'success' : 'primary'}" onclick="selectAbility('${recomObj.name.replace(/'/g, "\\'")}')">
      ${selectedAbility.toLowerCase() === recomObj.name.toLowerCase() ? '✓ Seleccionada' : 'Seleccionar'}
    </button>
  `;

  list.innerHTML = abilities.map(a => {
    const isSelected = selectedAbility.toLowerCase() === a.name.toLowerCase();
    const isHidden = a.hidden || a.is_hidden;
    const descText = a.description || a.desc || "Sin descripción disponible.";
    return `
      <div class="ability-card ${isSelected ? 'active' : ''}" onclick="selectAbility('${a.name.replace(/'/g, "\\'")}')">
        <div>
          <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
            <strong style="color:#fff; font-size:0.95rem;">${a.name}</strong>
            ${isHidden ? '<span class="ability-badge-hidden">Habilidad Oculta</span>' : '<span class="ability-badge-normal">Habilidad Estándar</span>'}
          </div>
          <div style="font-size:0.8rem; color:var(--text-secondary);">${descText}</div>
        </div>
        <div style="font-size:1.1rem; color:${isSelected ? '#55f3a0' : 'transparent'};">✓</div>
      </div>
    `;
  }).join("");

  const labelEl = document.getElementById("tab-label-ability");
  if (labelEl) labelEl.textContent = selectedAbility;
}

function selectAbility(name) {
  selectedAbility = name;
  renderAbilitiesTab();
  updateFooterSummary();
}

// ==========================================
// TAB 3: OBJETOS
// ==========================================

function renderItemsTab() {
  if (!currentCustomData) return;
  const recomCard = document.getElementById("recom-item-card");
  const grid = document.getElementById("all-items-grid");
  const defaultIt = currentCustomData.default_item;
  const items = currentCustomData.all_items || [];

  const recomObj = items.find(it => it.name.toLowerCase() === defaultIt.toLowerCase()) || { name: defaultIt, desc: "Objeto competitivo recomendado." };

  recomCard.innerHTML = `
    <div>
      <div class="recom-tag">⭐ Recomendado por el Meta</div>
      <div style="font-size:1.05rem; font-weight:700; color:#fff; display:flex; align-items:center; gap:8px;">
        <span>🎒 ${recomObj.name}</span>
      </div>
      <div style="font-size:0.8rem; color:var(--text-secondary); margin-top:4px;">${recomObj.desc}</div>
    </div>
    <button class="action-btn ${selectedItem === recomObj.name ? 'success' : 'primary'}" onclick="selectItem('${recomObj.name}')">
      ${selectedItem === recomObj.name ? '✓ Equipado' : 'Equipar'}
    </button>
  `;

  const search = (document.getElementById("item-search") ? document.getElementById("item-search").value.trim().toLowerCase() : "");
  let filtered = items;
  if (search) {
    filtered = items.filter(it => it.name.toLowerCase().includes(search) || it.desc.toLowerCase().includes(search));
  }

  grid.innerHTML = filtered.map(it => {
    const isSelected = selectedItem.toLowerCase() === it.name.toLowerCase();
    return `
      <div class="item-card ${isSelected ? 'active' : ''}" onclick="selectItem('${it.name}')">
        <div class="item-card-title">
          <span>🎒 ${it.name}</span>
          ${isSelected ? '<span style="color:#55f3a0; font-size:0.8rem;">✓ Equipado</span>' : ''}
        </div>
        <div class="item-card-desc">${it.desc}</div>
      </div>
    `;
  }).join("");

  const labelEl = document.getElementById("tab-label-item");
  if (labelEl) labelEl.textContent = selectedItem;
}

function selectItem(name) {
  selectedItem = name;
  renderItemsTab();
  updateFooterSummary();
}

function filterItemsList() {
  renderItemsTab();
}

// ==========================================
// TAB 4: NATURALEZAS
// ==========================================

function renderNaturesTab() {
  if (!currentCustomData) return;
  const recomCard = document.getElementById("recom-nature-card");
  const grid = document.getElementById("all-natures-grid");
  const defaultNat = currentCustomData.default_nature;
  const natures = currentCustomData.all_natures || [];

  const recomObj = natures.find(n => n.name.toLowerCase() === defaultNat.toLowerCase()) || { name: defaultNat, label: defaultNat, desc: "Naturaleza competitiva recomendada.", plus: "Velocidad", minus: "Atq.Esp" };

  recomCard.innerHTML = `
    <div>
      <div class="recom-tag">⭐ Recomendada para ${currentConfigPokemon ? currentConfigPokemon.role : 'Combate'}</div>
      <div style="font-size:1.05rem; font-weight:700; color:#fff; display:flex; align-items:center; gap:8px;">
        <span>🧬 ${recomObj.label}</span>
      </div>
      <div style="font-size:0.8rem; color:var(--text-secondary); margin-top:4px;">${recomObj.desc}</div>
    </div>
    <button class="action-btn ${selectedNature.toLowerCase() === recomObj.name.toLowerCase() ? 'success' : 'primary'}" onclick="selectNature('${recomObj.name}')">
      ${selectedNature.toLowerCase() === recomObj.name.toLowerCase() ? '✓ Seleccionada' : 'Seleccionar'}
    </button>
  `;

  grid.innerHTML = natures.map(nat => {
    const isSelected = selectedNature.toLowerCase() === nat.name.toLowerCase();
    const isNeutral = nat.plus === "Equilibrado";
    return `
      <div class="nature-card ${isSelected ? 'active' : ''}" onclick="selectNature('${nat.name}')">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <strong style="color:#fff; font-size:0.9rem;">${nat.label}</strong>
          ${isSelected ? '<span style="color:#55f3a0; font-size:0.8rem;">✓</span>' : ''}
        </div>
        <div class="nature-modifiers">
          ${isNeutral ? '<span class="nature-boost" style="color:#a8a878; background:rgba(168,168,120,0.12);">Sin cambios de stats</span>' : `<span class="nature-boost">+10% ${nat.plus}</span><span class="nature-drop">-10% ${nat.minus}</span>`}
        </div>
        <div style="font-size:0.75rem; color:var(--text-secondary);">${nat.desc}</div>
      </div>
    `;
  }).join("");

  const labelEl = document.getElementById("tab-label-nature");
  if (labelEl) labelEl.textContent = selectedNature;
}

function selectNature(name) {
  selectedNature = name;
  renderNaturesTab();
  updateFooterSummary();
}

// ==========================================
// FOOTER SUMMARY & SAVE
// ==========================================

function updateFooterSummary() {
  const summaryEl = document.getElementById("footer-build-summary");
  if (!summaryEl) return;

  const validMoves = selectedMoves.filter(m => m !== null);
  const movesChips = validMoves.map(m => {
    const mObj = getMoveObj(m);
    const color = mObj ? (TYPE_COLORS[(mObj.type || "NORMAL").toUpperCase()] || "#777") : "#777";
    return `<span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:${color}; margin-right:3px;"></span>${m}`;
  }).join(", ") || "<em style='color:#777;'>Sin movimientos</em>";

  summaryEl.innerHTML = `
    <span class="summary-chip"><strong>Movimientos (${validMoves.length}/4):</strong> ${movesChips}</span>
    <span class="summary-chip"><strong>Habilidad:</strong> ${selectedAbility || 'Ninguna'}</span>
    <span class="summary-chip"><strong>Objeto:</strong> ${selectedItem || 'Ninguno'}</span>
    <span class="summary-chip"><strong>Naturaleza:</strong> ${selectedNature || 'Neutra'}</span>
  `;
}

function backToPokemonSelect() {
  document.getElementById("builder-step-configure").style.display = "none";
  document.getElementById("builder-step-select").style.display = "block";
}

async function saveCustomPokemon() {
  if (!currentConfigPokemon) return;

  const validMoves = selectedMoves.filter(m => m !== null);
  if (validMoves.length === 0) {
    alert("Debes seleccionar al menos 1 movimiento para este Pokémon.");
    return;
  }

  const saveBtn = document.getElementById("btn-save-custom-pokemon");
  saveBtn.disabled = true;

  try {
    const res = await fetch(`/team/${sessionId}/add_custom`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: currentConfigPokemon.name,
        moves: validMoves,
        ability: selectedAbility,
        item: selectedItem,
        nature: selectedNature
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
