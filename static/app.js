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
          <span class="slot-name">${p.name}</span>
          <div class="slot-types">${t1}${t2}</div>
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
      <div style="margin-bottom: 12px; display: flex; align-items: center; justify-content: space-between;">
        <div>${t1} ${t2}</div>
        <span style="font-size: 0.85rem; color: var(--accent-cyan); font-weight: 700;">BST: ${pkmn.bst}</span>
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

function sendQuickPrompt(promptText) {
  const input = document.getElementById("user-input");
  input.value = promptText;
  sendMessage();
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
