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

const ROLE_TRANSLATIONS_ES = {
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
  "fast special sweeper": "Atacante Rápido",
  "fast sweeper": "Atacante Rápido",
  "sweeper": "Atacante",
  "hazard setter": "Pone-Trampas",
  "hazard": "Pone-Trampas",
  "spikes": "Púas & Trampas",
  "cleric": "Clérigo / Soporte",
  "pivot": "Pivote Táctico",
  "cleaner": "Rematador",
  "revenge killer": "Rematador",
  "bulky physical": "Tanque Físico",
  "bulky special": "Tanque Especial",
  "balanced": "Equilibrado",
  "unaware cleric": "Clérigo Soporte",
  "speedster": "Velocista",
  "lead": "Iniciador",
  "support": "Soporte"
};

function translateRole(role) {
  if (!role) return "Competitivo";
  const r = role.toLowerCase().trim();
  if (ROLE_TRANSLATIONS_ES[r]) return ROLE_TRANSLATIONS_ES[r];
  const parts = role.split("/");
  const firstPart = parts[0].trim().toLowerCase();
  if (ROLE_TRANSLATIONS_ES[firstPart]) return ROLE_TRANSLATIONS_ES[firstPart];
  for (const [k, v] of Object.entries(ROLE_TRANSLATIONS_ES)) {
    if (r.includes(k)) return v;
  }
  return role;
}

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

let currentTeamList = [];
let slotExpandedMap = {}; // name -> boolean
let teamBuildState = {
  active: false,
  targetSize: 6,
  archetype: "defensivo"
};

let currentMobileView = "chat";

function switchMobileView(view) {
  currentMobileView = view;
  const container = document.querySelector(".main-container");
  const btnChat = document.getElementById("btn-mobile-chat");
  const btnTeam = document.getElementById("btn-mobile-team");

  if (view === "team") {
    if (container) {
      container.classList.add("mobile-show-team");
      container.classList.remove("mobile-show-chat");
    }
    if (btnTeam) btnTeam.classList.add("active");
    if (btnChat) btnChat.classList.remove("active");
  } else {
    if (container) {
      container.classList.add("mobile-show-chat");
      container.classList.remove("mobile-show-team");
    }
    if (btnChat) btnChat.classList.add("active");
    if (btnTeam) btnTeam.classList.remove("active");
  }
}

async function syncTeam() {
  try {
    const res = await fetch(`/team/${sessionId}`);
    if (res.ok) {
      const data = await res.json();
      currentTeamList = data.team || [];
      renderTeam(currentTeamList);
    }
  } catch (err) {
    console.error("Error sincronizando equipo:", err);
  }
}

function toggleSlotAccordion(slotIdx, event) {
  if (event) event.stopPropagation();
  const body = document.getElementById(`slot-accordion-body-${slotIdx}`);
  const arrow = document.getElementById(`slot-arrow-${slotIdx}`);
  if (!body) return;

  const isNowCollapsed = !body.classList.contains("collapsed");
  if (isNowCollapsed) {
    body.classList.add("collapsed");
    if (arrow) arrow.textContent = "▼";
  } else {
    body.classList.remove("collapsed");
    if (arrow) arrow.textContent = "▲";
  }
  const pkmnName = body.getAttribute("data-pokename");
  if (pkmnName) {
    slotExpandedMap[pkmnName] = !isNowCollapsed;
  }
}

function renderTeam(teamList) {
  currentTeamList = teamList || [];
  const container = document.getElementById("team-slots-container");
  const counter = document.getElementById("team-counter");
  const mobileCounter = document.getElementById("mobile-team-counter");
  if (mobileCounter) {
    mobileCounter.textContent = `${currentTeamList.length} / 6`;
  }
  if (counter) {
    if (currentTeamList.length >= 6) {
      counter.innerHTML = `<span style="color:#00FF66; font-weight:800;">6 / 6 (COMPLETO)</span>`;
    } else {
      const faltan = 6 - currentTeamList.length;
      counter.innerHTML = `<span style="color:var(--accent-cyan); font-weight:800;">${currentTeamList.length} / 6</span> <span style="font-size:0.75rem; color:var(--accent-yellow); margin-left:4px;">(Faltan ${faltan})</span>`;
    }
  }

  if (!currentTeamList || currentTeamList.length === 0) {
    container.innerHTML = `
      <div class="team-slot" style="color: var(--text-secondary); font-size: 0.85rem; justify-content: center;">
        No tienes Pokémon en tu equipo aún.
      </div>
    `;
    return;
  }

  container.innerHTML = currentTeamList.map((p, idx) => {
    const t1 = createTypeBadge(p.type1);
    const t2 = p.type2 ? createTypeBadge(p.type2) : "";

    // Check if slot was previously expanded (default: true for all members)
    const isExpanded = slotExpandedMap[p.name] !== undefined ? slotExpandedMap[p.name] : true;
    const arrowSymbol = isExpanded ? "▲" : "▼";
    const bodyCollapsedClass = isExpanded ? "" : "collapsed";

    // Meta chips
    const roleChip = p.role ? `<span class="slot-meta-chip"><strong>Rol:</strong> ${translateRole(p.role)}</span>` : "";
    const itemChip = p.item ? `<span class="slot-meta-chip">🎒 ${p.item}</span>` : "";
    const abilityChip = p.ability ? `<span class="slot-meta-chip">✨ ${p.ability}</span>` : "";
    const natureChip = p.nature ? `<span class="slot-meta-chip">🧬 ${p.nature}</span>` : "";

    // Moves pills (from moves_details or moves_custom)
    let movesHtml = "";
    if (p.moves_details && p.moves_details.length > 0) {
      movesHtml = p.moves_details.map(m => {
        const typeKey = (m.type || "NORMAL").toUpperCase();
        const color = TYPE_COLORS[typeKey] || "#666";
        const catIcon = m.category === "Physical" ? "⚔️" : (m.category === "Special" ? "🔮" : "🛡️");
        return `
          <div class="slot-move-pill" style="background-color: ${color};" title="${m.name} (${m.type}) - Pot: ${m.power || '—'}">
            <span class="move-pill-name">${m.name}</span>
            <span class="move-pill-cat">${catIcon}</span>
          </div>
        `;
      }).join("");
    } else if (p.moves_custom && p.moves_custom.length > 0) {
      movesHtml = p.moves_custom.map(mName => {
        return `
          <div class="slot-move-pill" style="background-color: #3b4259;" title="${mName}">
            <span class="move-pill-name">${mName}</span>
          </div>
        `;
      }).join("");
    } else {
      movesHtml = `<div style="grid-column: span 2; font-size: 0.72rem; color: var(--text-secondary);">Sin movimientos asignados</div>`;
    }

    return `
      <div class="team-slot filled">
        <div class="slot-header-row">
          <div class="slot-main-info" onclick="inspectPokemon('${p.name}')" title="Clic para ver ficha rápida">
            <img src="/icon/${p.id}?v=c1" class="slot-sprite" alt="${p.name}" onerror="this.style.display='none'">
            <div>
              <span class="slot-name">${p.name}</span>
              <div class="slot-types">${t1}${t2}</div>
            </div>
          </div>
          <div class="slot-actions">
            <button class="slot-action-btn edit-btn" title="Editar configuración" onclick="editPokemonFromTeam('${p.name}')">✏️</button>
            <button class="slot-action-btn toggle-btn" id="slot-arrow-${idx}" title="Desplegar / Ocultar" onclick="toggleSlotAccordion(${idx}, event)">${arrowSymbol}</button>
            <button class="slot-action-btn remove-btn" title="Eliminar del equipo" onclick="removeFromTeam('${p.name}')">✕</button>
          </div>
        </div>
        <div class="slot-accordion-body ${bodyCollapsedClass}" id="slot-accordion-body-${idx}" data-pokename="${p.name}">
          <div class="slot-meta-chips">
            ${roleChip}
            ${itemChip}
            ${abilityChip}
            ${natureChip}
          </div>
          <div class="slot-moves-grid">
            ${movesHtml}
          </div>
        </div>
      </div>
    `;
  }).join("");
}

async function editPokemonFromTeam(nameOrId) {
  const modal = document.getElementById("builder-modal");
  if (modal) modal.style.display = "flex";

  const pInTeam = currentTeamList.find(p => p.name.toLowerCase() === String(nameOrId).toLowerCase() || p.id == nameOrId);

  await selectPokemonForConfig(nameOrId);

  if (pInTeam) {
    if (pInTeam.moves_custom && pInTeam.moves_custom.length > 0) {
      selectedMoves = [
        pInTeam.moves_custom[0] || null,
        pInTeam.moves_custom[1] || null,
        pInTeam.moves_custom[2] || null,
        pInTeam.moves_custom[3] || null
      ];
    }
    if (pInTeam.ability) selectedAbility = pInTeam.ability;
    if (pInTeam.item) selectedItem = pInTeam.item;
    if (pInTeam.nature) selectedNature = pInTeam.nature;

    renderActiveMoveSlots();
    renderMovesPool();
    renderAbilitiesTab();
    renderItemsTab();
    renderNaturesTab();
    updateFooterSummary();
  }
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
      currentTeamList = data.team || [];
      renderTeam(currentTeamList);
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
      currentTeamList = [];
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
        <img src="/sprite/${pkmn.id}?v=c1" class="inspect-sprite" alt="${pkmn.name}" onerror="this.src='/icon/${pkmn.id}?v=c1';">
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
    if (data.team) {
      currentTeamList = data.team;
      renderTeam(data.team);
    }

    if (data.team_build) {
      teamBuildState.active = data.team_build.active;
      teamBuildState.targetSize = data.team_build.target;
      teamBuildState.archetype = data.team_build.archetype;
    }

    updateMessage(loadingId, data.response || "No se obtuvo respuesta.", data.suggested_options);

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

function updateMessage(id, text, suggestedOptions) {
  const el = document.getElementById(id);
  if (!el) return;
  const contentDiv = el.querySelector(".msg-content");
  if (contentDiv) {
    let parsedContent = (typeof marked !== "undefined" && marked.parse) ? marked.parse(text) : `<p>${text}</p>`;

    if (suggestedOptions && suggestedOptions.length > 0 && currentTeamList.length < 6) {
      const targetSize = Math.min(6, teamBuildState.targetSize || 6);
      const faltan = Math.max(0, targetSize - currentTeamList.length);
      const nextSlot = currentTeamList.length + 1;

      const buttonsHtml = suggestedOptions.map(opt => {
        const roleParam = (opt.role || '').replace(/'/g, "\\'");
        const itemParam = (opt.item || '').replace(/'/g, "\\'");
        const abilityParam = (opt.ability || '').replace(/'/g, "\\'");
        const shortRole = opt.role ? translateRole(opt.role.split('/')[0].trim()) : '';

        // Calculate background gradient or solid color based on typing
        let bgStyle = "";
        let rawTypes = opt.raw_types || [];
        if ((!rawTypes || rawTypes.length === 0) && opt.types) {
          rawTypes = opt.types.map(t => {
            const entry = Object.entries(TYPE_NAMES_ES).find(([k, v]) => v.toLowerCase() === t.toLowerCase());
            return entry ? entry[0] : t.toUpperCase();
          });
        }

        if (rawTypes && rawTypes.length >= 2) {
          const c1 = TYPE_COLORS[rawTypes[0].toUpperCase()] || "#4facfe";
          const c2 = TYPE_COLORS[rawTypes[1].toUpperCase()] || "#00f2fe";
          bgStyle = `background: linear-gradient(135deg, ${c1} 0%, ${c2} 100%);`;
        } else if (rawTypes && rawTypes.length === 1) {
          const c1 = TYPE_COLORS[rawTypes[0].toUpperCase()] || "#4facfe";
          bgStyle = `background-color: ${c1};`;
        } else {
          bgStyle = `background-color: var(--accent-yellow);`;
        }

        const iconHtml = opt.id ? `<img src="/icon/${opt.id}?v=c1" style="width: 22px; height: 22px; image-rendering: pixelated; vertical-align: middle; margin-right: 4px;" onerror="this.style.display='none'">` : '';

        return `
          <button class="arcade-btn-choice" 
                  style="${bgStyle} color: #ffffff; text-shadow: 0 1px 3px rgba(0,0,0,0.9); border: 2.5px solid #000000; box-shadow: 3px 3px 0px #000000;"
                  onclick="addSuggestedPokemon('${opt.name}', '${roleParam}', '${itemParam}', '${abilityParam}', this)">
            ${iconHtml}
            <span>+ ${opt.name}</span>
            <span style="font-size: 0.7rem; opacity: 0.95; font-weight: 800; background: rgba(0,0,0,0.4); padding: 1px 6px; border-radius: 4px; margin-left: 4px;">
              ${shortRole}
            </span>
          </button>
        `;
      }).join("");

      parsedContent += `
        <div class="chat-arcade-buttons">
          <div style="width: 100%; font-size: 0.75rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; color: var(--accent-yellow); margin-bottom: 4px; display: flex; justify-content: space-between; align-items: center;">
            <span>🕹️ Fichar para Slot #${nextSlot} de ${targetSize}:</span>
            <span style="background: rgba(0,0,0,0.45); padding: 2px 8px; border-radius: 4px; color: #55f3a0; font-size: 0.72rem; border: 1px solid rgba(255,255,255,0.15);">Faltan ${faltan}</span>
          </div>
          ${buttonsHtml}
        </div>
      `;
    }

    contentDiv.innerHTML = parsedContent;
  }
  const history = document.getElementById("chat-history");
  history.scrollTop = history.scrollHeight;
}

async function addSuggestedPokemon(name, role, item, ability, btnElement) {
  if (currentTeamList.length >= 6) {
    alert("¡Tu equipo ya tiene 6 Pokémon! Vacía un espacio o elimina uno para añadir otro.");
    return;
  }

  if (btnElement) {
    btnElement.disabled = true;
    btnElement.style.opacity = "0.7";
    btnElement.textContent = "⏳ Fichando...";

    // Disable sibling choices in this message group
    const parentChoices = btnElement.closest(".chat-arcade-buttons");
    if (parentChoices) {
      const allChoiceBtns = parentChoices.querySelectorAll(".arcade-btn-choice");
      allChoiceBtns.forEach(b => {
        if (b !== btnElement) {
          b.disabled = true;
          b.style.opacity = "0.35";
          b.style.pointerEvents = "none";
        }
      });
    }
  }

  try {
    let res;
    if (item || ability) {
      res = await fetch(`/team/${sessionId}/add_custom`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name,
          moves: [],
          ability: ability || "",
          item: item || "",
          nature: ""
        })
      });
    } else {
      res = await fetch(`/team/${sessionId}/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name })
      });
    }

    if (!res.ok) {
      const errData = await res.json();
      alert(errData.detail || "Error al añadir Pokémon.");
      if (btnElement) {
        btnElement.disabled = false;
        btnElement.style.opacity = "1";
      }
      return;
    }

    const data = await res.json();
    currentTeamList = data.team || [];
    renderTeam(currentTeamList);

    if (btnElement) {
      btnElement.textContent = `✅ ${name} incorporado`;
      btnElement.style.background = "#00FF66";
      btnElement.style.color = "#000000";
    }

    inspectPokemon(name);

    // Dynamic chained recruitment flow:
    const target = Math.min(6, teamBuildState.targetSize || 6);
    const faltan = Math.max(0, target - currentTeamList.length);

    if (teamBuildState.active && currentTeamList.length < target && currentTeamList.length < 6) {
      const nextSlot = currentTeamList.length + 1;
      const arch = teamBuildState.archetype || "defensivo";

      appendMessage("user", `✅ ¡Fichado **${name}**! Equipo: ${currentTeamList.length}/${target} (Faltan ${faltan} miembros). Dame opciones para el **Slot #${nextSlot}** (${arch}).`);
      
      const queryNext = `He sumado a ${name} a mi equipo. Mi equipo ahora tiene ${currentTeamList.length}/${target} miembros (faltan exactamente ${faltan} para completar el equipo de ${target}). Recomiéndame las 3 mejores opciones de sinergia para el Slot #${nextSlot} de mi equipo ${arch}.`;
      await requestNextTeamSlot(queryNext);

    } else if (currentTeamList.length >= target || currentTeamList.length >= 6) {
      teamBuildState.active = false;
      appendMessage("bot", `🏆 **¡EQUIPO COMPLETADO (${currentTeamList.length}/6)!**\n\n¡Menuda formación legendaria acabamos de montar, hermano! Hemos alcanzado el tope máximo de 6 miembros reglamentarios y la sinergia está 100% blindada. Pulsa en **'📋 Showdown'** para exportar tu equipo listo para competir.`);
    } else {
      appendMessage("bot", `⚡ ¡Fichaje de élite confirmado! He sumado a **${name}** a tu formación táctica (${currentTeamList.length}/6). Si quieres seguir completando el equipo, dime qué otra necesidad tienes o pídemelo.`);
    }

  } catch (err) {
    alert("Error de conexión: " + err.message);
    if (btnElement) {
      btnElement.disabled = false;
      btnElement.style.opacity = "1";
    }
  }
}

async function requestNextTeamSlot(queryText) {
  const loadingId = appendMessage("bot", "<em>Analizando nuevas sinergias, debilidades del equipo y buscando los mejores candidatos...</em>");
  try {
    const res = await fetch("/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: queryText, session_id: sessionId })
    });
    const data = await res.json();
    if (data.team) {
      currentTeamList = data.team;
      renderTeam(data.team);
    }
    if (data.team_build) {
      teamBuildState.active = data.team_build.active;
      teamBuildState.targetSize = data.team_build.target;
      teamBuildState.archetype = data.team_build.archetype;
    }

    updateMessage(loadingId, data.response || "Aquí tienes las siguientes opciones.", data.suggested_options);
  } catch (err) {
    updateMessage(loadingId, "⚠️ Error al consultar el siguiente miembro: " + err.message);
  }
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
// Full Team Tactical Board Modal (6 in 1)
// ---------------------------------------------------------------------
async function openTeamBoardModal() {
  const modal = document.getElementById("team-board-modal");
  if (!modal) return;
  modal.style.display = "flex";

  const counter = document.getElementById("board-team-counter");
  const grid = document.getElementById("team-board-grid");
  const auditContainer = document.getElementById("team-board-audit");

  if (counter) counter.textContent = `Cargando...`;
  if (grid) grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--text-secondary); padding: 30px;">Cargando formación táctica del equipo...</div>`;

  try {
    const res = await fetch(`/team/${sessionId}`);
    if (!res.ok) throw new Error("Error al consultar equipo");
    const data = await res.json();
    currentTeamList = data.team || [];
    renderTeamBoard(currentTeamList, data.audit);
  } catch (err) {
    if (grid) grid.innerHTML = `<div style="grid-column: 1/-1; color: #ff6b6b; padding: 20px;">⚠️ Error al cargar el equipo: ${err.message}</div>`;
  }
}

function closeTeamBoardModal() {
  const modal = document.getElementById("team-board-modal");
  if (modal) modal.style.display = "none";
}

function renderTeamBoard(team, audit) {
  const counter = document.getElementById("board-team-counter");
  const grid = document.getElementById("team-board-grid");
  const auditContainer = document.getElementById("team-board-audit");

  if (counter) counter.textContent = `(${team.length} / 6)`;

  if (!team || team.length === 0) {
    if (grid) {
      grid.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 40px 20px; background: #151825; border-radius: 12px; border: 1px dashed var(--border-color);">
          <div style="font-size: 2.2rem; margin-bottom: 8px;">🛡️</div>
          <h4 style="color: #fff; margin-bottom: 6px;">Tu equipo está vacío</h4>
          <p style="color: var(--text-secondary); font-size: 0.85rem; max-width: 420px; margin: 0 auto 16px;">
            Añade hasta 6 Pokémon usando el botón de Teambuilder o pídeselo directamente al Coach en el chat.
          </p>
          <button class="action-btn success" style="margin: 0 auto; display: inline-flex;" onclick="closeTeamBoardModal(); openBuilderModal();">
            <span>➕ Añadir tu primer Pokémon</span>
          </button>
        </div>
      `;
    }
    if (auditContainer) {
      auditContainer.innerHTML = `<div style="text-align:center; color: var(--text-secondary); font-size: 0.82rem;">Sin datos de auditoría para un equipo vacío.</div>`;
    }
    return;
  }

  // Render 6 cards
  if (grid) {
    grid.innerHTML = team.map(p => {
      const t1 = createTypeBadge(p.type1);
      const t2 = p.type2 ? createTypeBadge(p.type2) : "";
      const bs = p.base_stats || { hp: 0, attack: 0, defense: 0, sp_attack: 0, sp_defense: 0, speed: 0 };

      // Moves grid
      let movesHtml = "";
      if (p.moves_details && p.moves_details.length > 0) {
        movesHtml = p.moves_details.map(m => {
          const typeKey = (m.type || "NORMAL").toUpperCase();
          const color = TYPE_COLORS[typeKey] || "#555";
          const catIcon = m.category === "Physical" ? "⚔️" : (m.category === "Special" ? "🔮" : "🛡️");
          const potStr = m.power > 0 ? `Pot: ${m.power}` : "—";
          return `
            <div class="board-move-pill" style="background-color: ${color};">
              <div class="board-move-top">
                <span class="board-move-name">${m.name}</span>
                <span class="board-move-cat">${catIcon}</span>
              </div>
              <div class="board-move-sub">
                <span>${m.type}</span>
                <span>${potStr}</span>
              </div>
            </div>
          `;
        }).join("");
      } else if (p.moves_custom && p.moves_custom.length > 0) {
        movesHtml = p.moves_custom.map(mName => `
          <div class="board-move-pill" style="background-color: #2b3044;">
            <div class="board-move-top">
              <span class="board-move-name">${mName}</span>
            </div>
          </div>
        `).join("");
      } else {
        movesHtml = `<div style="grid-column: span 2; font-size: 0.75rem; color: var(--text-secondary);">Sin movimientos asignados</div>`;
      }

      return `
        <div class="board-pkmn-card">
          <div class="board-card-header">
            <div class="board-card-pkmn">
              <img src="/sprite/${p.id}?v=c1" class="board-card-sprite" alt="${p.name}" onerror="this.src='/icon/${p.id}?v=c1';">
              <div class="board-card-title">
                <div class="board-card-name">
                  <span>${p.name}</span>
                  <span style="font-size:0.75rem; color:var(--text-secondary); font-weight:normal;">#${p.id}</span>
                </div>
                <div class="board-card-types">${t1} ${t2}</div>
                <div class="board-card-role">${translateRole(p.role || "Competitivo")}</div>
              </div>
            </div>
            <button class="slot-action-btn edit-btn" style="width:32px; height:32px; font-size:0.9rem;" title="Editar Pokémon" onclick="closeTeamBoardModal(); editPokemonFromTeam('${p.name}');">
              ✏️
            </button>
          </div>

          <!-- Base Stats Grid -->
          <div class="board-card-stats">
            <div class="board-stat-item">
              <span class="board-stat-label">PS</span>
              <span class="board-stat-val" style="color: #55f3a0;">${bs.hp}</span>
            </div>
            <div class="board-stat-item">
              <span class="board-stat-label">ATK</span>
              <span class="board-stat-val" style="color: #ff6b6b;">${bs.attack}</span>
            </div>
            <div class="board-stat-item">
              <span class="board-stat-label">DEF</span>
              <span class="board-stat-val" style="color: #4facfe;">${bs.defense}</span>
            </div>
            <div class="board-stat-item">
              <span class="board-stat-label">SPA</span>
              <span class="board-stat-val" style="color: #c77dff;">${bs.sp_attack}</span>
            </div>
            <div class="board-stat-item">
              <span class="board-stat-label">SPD</span>
              <span class="board-stat-val" style="color: #00f2fe;">${bs.sp_defense}</span>
            </div>
            <div class="board-stat-item">
              <span class="board-stat-label">VEL</span>
              <span class="board-stat-val" style="color: #f8d030;">${bs.speed}</span>
            </div>
          </div>

          <!-- Meta (Item, Ability, Nature) -->
          <div class="board-card-meta">
            <div class="board-meta-row">
              <span class="board-meta-label">🎒 Objeto:</span>
              <span class="board-meta-val">${p.item || "Restos"}</span>
            </div>
            <div class="board-meta-row">
              <span class="board-meta-label">✨ Habilidad:</span>
              <span class="board-meta-val">${p.ability || "Presión"}</span>
            </div>
            <div class="board-meta-row">
              <span class="board-meta-label">🧬 Naturaleza:</span>
              <span class="board-meta-val">${p.nature || "Firme"}</span>
            </div>
          </div>

          <!-- 4 Moves Grid -->
          <div class="board-card-moves">
            ${movesHtml}
          </div>
        </div>
      `;
    }).join("");
  }

  // Render Audit Section
  if (auditContainer) {
    if (!audit) {
      auditContainer.innerHTML = `<div style="text-align:center; color: var(--text-secondary);">Auditoría táctica completada.</div>`;
      return;
    }

    const critWeaknesses = audit.critical_vulnerabilities || [];
    let weakHtml = "";
    if (critWeaknesses.length === 0) {
      weakHtml = `<div style="color: #55f3a0; font-size: 0.8rem;">✅ ¡Excelente sinergia! Sin debilidades críticas compartidas.</div>`;
    } else {
      weakHtml = `<div class="audit-badges-wrap">` + critWeaknesses.map(cw => {
        const typeBadge = createTypeBadge(cw.type_name_es || cw.type);
        return `
          <div style="display:inline-flex; align-items:center; gap:4px; background:#29141b; border:1px solid #ff4757; padding:2px 6px; border-radius:6px; font-size:0.75rem;">
            ${typeBadge}
            <span style="color:#ff6b6b; font-weight:700;">x${cw.weak_count} débiles</span>
          </div>
        `;
      }).join("") + `</div>`;
    }

    // Offensive Uncovered Types
    const uncovered = audit.uncovered_types_offensively || [];
    let covHtml = "";
    if (uncovered.length === 0) {
      covHtml = `<div style="color: #55f3a0; font-size: 0.8rem;">⚡ Cobertura ofensiva STAB total sobre todos los tipos.</div>`;
    } else {
      covHtml = `<div class="audit-badges-wrap">` + uncovered.map(t => {
        return createTypeBadge(t);
      }).join("") + `</div>`;
    }

    // STABs present
    const stabs = audit.stabs_present || [];
    const stabsHtml = `<div class="audit-badges-wrap">` + stabs.map(t => createTypeBadge(t)).join("") + `</div>`;

    auditContainer.innerHTML = `
      <div class="audit-grid">
        <div>
          <div class="audit-col-title" style="color: #ff6b6b;">
            <span>⚠️ Vulnerabilidades Críticas de Equipo</span>
          </div>
          ${weakHtml}
        </div>
        <div>
          <div class="audit-col-title" style="color: var(--accent-cyan);">
            <span>⚔️ STABs Presentes en el Equipo</span>
          </div>
          ${stabsHtml}
        </div>
        <div>
          <div class="audit-col-title" style="color: var(--accent-yellow);">
            <span>🛡️ Tipos No Cubiertos Ofensivamente</span>
          </div>
          ${covHtml}
        </div>
      </div>
    `;
  }
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
  if (currentTeamList && currentTeamList.length >= 6) {
    alert("⚠️ Tu equipo ya tiene el máximo permitido de 6 Pokémon. Debes eliminar uno antes de poder añadir otro.");
    return;
  }
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
  if (!container) return;

  container.innerHTML = ALL_TYPES.map(t => {
    const isAll = t === "ALL";
    const label = isAll ? "Todos" : (TYPE_NAMES_ES[t] || t);
    const isActive = activeTypeFilter === t;
    const activeCls = isActive ? "active" : "";

    let style = "";
    if (isAll) {
      if (isActive) {
        style = "background-color: var(--accent-cyan); color: #0f111a; border: 1.5px solid var(--accent-cyan); box-shadow: 0 0 10px rgba(0,242,254,0.45); font-weight:700;";
      } else {
        style = "background-color: #232738; color: #cbd5e1; border: 1.5px solid var(--border-color);";
      }
    } else {
      const color = TYPE_COLORS[t] || "#777";
      if (isActive) {
        style = `background-color: ${color}; color: #ffffff; border: 1.5px solid ${color}; box-shadow: 0 0 10px ${color}88; font-weight:700;`;
      } else {
        style = `background-color: ${color}22; color: #f0f2f5; border: 1.5px solid ${color}66;`;
      }
    }

    return `<button class="type-filter-btn ${activeCls}" style="${style}" onclick="setTypeFilter('${t}')">${label}</button>`;
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
        <img src="/sprite/${p.id}?v=c1" class="card-sprite" alt="${p.name}" loading="lazy" onerror="this.src='/icon/${p.id}?v=c1';">
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
      <img src="/sprite/${pkmn.id}?v=c1" class="config-big-sprite" alt="${pkmn.name}" onerror="this.src='/icon/${pkmn.id}?v=c1';">
      <div>
        <h3 style="font-size: 1.25rem; color: #fff; margin-bottom: 4px;">
          ${pkmn.name} <span style="font-size: 0.85rem; color: var(--text-secondary);">#${pkmn.id}</span>
        </h3>
        <div style="margin-bottom: 6px; display:flex; align-items:center; gap:6px;">
          ${t1} ${t2} 
          <span style="margin-left: 8px; font-size: 0.82rem; color: var(--accent-yellow); font-weight: 700;">BST: ${pkmn.bst}</span>
          <span style="font-size: 0.82rem; color: var(--accent-cyan); margin-left: 6px;">[${translateRole(pkmn.role || 'Competitivo')}]</span>
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
      <div class="recom-tag">⭐ Recomendada para ${currentConfigPokemon ? translateRole(currentConfigPokemon.role) : 'Combate'}</div>
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
