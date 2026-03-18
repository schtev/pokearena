// ═══════════════════════════════════════════════════
//  src/team/teambuilder.js
//  Manages the player's team and Pokémon collection.
//  Persists to localStorage so progress is saved.
// ═══════════════════════════════════════════════════

const TeamBuilder = (() => {

  const MAX_TEAM_SIZE = 6;

  // State
  let playerTeam       = [];  // Array of Pokémon keys (strings)
  let unlockedPokemon  = [];  // Array of unlocked keys

  // ─── Persistence ──────────────────────────────
  function save() {
    localStorage.setItem('pokearena_team',     JSON.stringify(playerTeam));
    localStorage.setItem('pokearena_unlocked', JSON.stringify(unlockedPokemon));
  }

  function load() {
    const savedTeam     = localStorage.getItem('pokearena_team');
    const savedUnlocked = localStorage.getItem('pokearena_unlocked');

    playerTeam      = savedTeam     ? JSON.parse(savedTeam)     : [];
    unlockedPokemon = savedUnlocked ? JSON.parse(savedUnlocked)  : getUnlockedPokemon();

    // Sync unlocks back to POKEMON_DATA
    unlockedPokemon.forEach(key => { if (POKEMON_DATA[key]) POKEMON_DATA[key].unlocked = true; });
  }

  // ─── Team operations ──────────────────────────
  function addToTeam(key) {
    if (playerTeam.length >= MAX_TEAM_SIZE) {
      showToast('Your team is full! (6/6)');
      return false;
    }
    if (playerTeam.includes(key)) {
      showToast(`${POKEMON_DATA[key].name} is already in your team!`);
      return false;
    }
    playerTeam.push(key);
    save();
    renderTeamSlots();
    renderCollection();
    return true;
  }

  function removeFromTeam(slotIndex) {
    if (slotIndex < 0 || slotIndex >= playerTeam.length) return;
    playerTeam.splice(slotIndex, 1);
    save();
    renderTeamSlots();
    renderCollection();
  }

  function getTeam() {
    return [...playerTeam];
  }

  /**
   * Build battle-ready instances for the current team.
   * @param {number} level - Level to create instances at (default 50)
   * @returns {object[]}
   */
  function buildBattleTeam(level = 50) {
    return playerTeam
      .map(key => createPokemonInstance(key, level))
      .filter(Boolean);
  }

  function unlock(key) {
    if (!unlockedPokemon.includes(key)) {
      unlockedPokemon.push(key);
      unlockPokemon(key);
      save();
      renderCollection();
      showToast(`🎉 Unlocked ${POKEMON_DATA[key]?.name}!`);
    }
  }

  // ─── Render: Team Slots ────────────────────────
  function renderTeamSlots() {
    const slotsContainer = document.getElementById('team-slots');
    const countEl        = document.getElementById('team-count');
    if (!slotsContainer) return;

    if (countEl) countEl.textContent = `(${playerTeam.length}/6)`;

    const slots = slotsContainer.querySelectorAll('.team-slot');

    slots.forEach((slotEl, i) => {
      const key = playerTeam[i];

      if (key && POKEMON_DATA[key]) {
        const pkmn = POKEMON_DATA[key];
        slotEl.classList.remove('empty');
        slotEl.classList.add('filled');

        const spriteEl = slotEl.querySelector('.slot-sprite');
        const nameEl   = slotEl.querySelector('.slot-name');

        if (spriteEl) {
          spriteEl.src = getSpriteUrl(pkmn.id);
          spriteEl.alt = pkmn.name;
        }
        if (nameEl) nameEl.textContent = pkmn.name;

        // Type badges
        let typesEl = slotEl.querySelector('.slot-types');
        if (!typesEl) {
          typesEl = document.createElement('div');
          typesEl.className = 'slot-types';
          slotEl.querySelector('.slot-info').appendChild(typesEl);
        }
        typesEl.innerHTML = pkmn.types
          .map(t => `<span class="type-badge type-${t}">${t}</span>`)
          .join('');

      } else {
        slotEl.classList.remove('filled');
        slotEl.classList.add('empty');

        const spriteEl = slotEl.querySelector('.slot-sprite');
        const nameEl   = slotEl.querySelector('.slot-name');
        const typesEl  = slotEl.querySelector('.slot-types');

        if (spriteEl) { spriteEl.src = ''; spriteEl.alt = ''; }
        if (nameEl)   nameEl.textContent = '—';
        if (typesEl)  typesEl.remove();
      }
    });
  }

  // ─── Render: Collection Grid ──────────────────
  function renderCollection(filter = '') {
    const grid = document.getElementById('collection-grid');
    if (!grid) return;

    grid.innerHTML = '';

    const keys = Object.keys(POKEMON_DATA).filter(key => {
      const pkmn = POKEMON_DATA[key];
      if (!pkmn.unlocked) return false;
      if (filter && !pkmn.name.toLowerCase().includes(filter.toLowerCase())) return false;
      return true;
    });

    if (keys.length === 0) {
      grid.innerHTML = '<p style="color:var(--text-dim);padding:20px;grid-column:1/-1">No Pokémon found.</p>';
      return;
    }

    keys.forEach(key => {
      const pkmn      = POKEMON_DATA[key];
      const inTeam    = playerTeam.includes(key);

      const card = document.createElement('div');
      card.className = `poke-card${inTeam ? ' in-team' : ''}`;
      card.title     = inTeam ? `${pkmn.name} (in team)` : `Add ${pkmn.name} to team`;

      card.innerHTML = `
        <img src="${getSpriteUrl(pkmn.id)}" alt="${pkmn.name}" loading="lazy" />
        <div class="poke-card-name">${pkmn.name}</div>
        <div style="display:flex;gap:3px;flex-wrap:wrap;justify-content:center">
          ${pkmn.types.map(t => `<span class="type-badge type-${t}">${t}</span>`).join('')}
        </div>
        <div class="poke-card-id">#${String(pkmn.id).padStart(3,'0')}</div>
        ${inTeam ? '<div style="font-size:11px;color:var(--accent-green);font-weight:700">✓ In Team</div>' : ''}
      `;

      if (!inTeam) {
        card.addEventListener('click', () => addToTeam(key));
      }

      grid.appendChild(card);
    });
  }

  // ─── Toast notification ────────────────────────
  function showToast(msg) {
    let toast = document.getElementById('toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'toast';
      toast.style.cssText = `
        position: fixed;
        bottom: 24px;
        left: 50%;
        transform: translateX(-50%);
        background: var(--bg-card);
        border: 2px solid var(--border-bright);
        border-radius: 999px;
        padding: 10px 24px;
        font-family: var(--font-pixel);
        font-size: 10px;
        color: var(--text-primary);
        z-index: 200;
        opacity: 0;
        transition: opacity 0.2s;
        pointer-events: none;
        white-space: nowrap;
      `;
      document.body.appendChild(toast);
    }

    toast.textContent = msg;
    toast.style.opacity = '1';
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => { toast.style.opacity = '0'; }, 2200);
  }

  // ─── Init ─────────────────────────────────────
  function init() {
    load();
    renderTeamSlots();
    renderCollection();
  }

  return {
    init,
    addToTeam,
    removeFromTeam,
    getTeam,
    buildBattleTeam,
    unlock,
    renderTeamSlots,
    renderCollection,
    showToast,
    get teamSize() { return playerTeam.length; }
  };

})();

// ─── Global helpers (called from HTML onclick) ───
function removeFromTeam(idx) { TeamBuilder.removeFromTeam(idx); }
function filterCollection() {
  const val = document.getElementById('search-pokemon')?.value || '';
  TeamBuilder.renderCollection(val);
}
