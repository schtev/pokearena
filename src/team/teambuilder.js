// ═══════════════════════════════════════════════════
//  src/team/teambuilder.js
//  Part 5: Full drag-and-drop slot reordering.
//
//  Drag behaviour:
//    - Grab a filled slot via the ⠿ drag handle
//    - Drag over any other slot → highlights as target
//    - Drop → swap positions in playerTeam[]
//    - Works with mouse AND touch events
//    - Empty slots are valid drop targets
// ═══════════════════════════════════════════════════

const TeamBuilder = (() => {

  const MAX_TEAM_SIZE = 6;

  let playerTeam      = [];
  let unlockedPokemon = [];

  // ─── Drag state ───────────────────────────────
  let _dragSrcIdx  = null;
  let _dragOverIdx = null;

  // ─── Persistence ──────────────────────────────
  function save() {
    if (typeof SaveSystem !== 'undefined') {
      SaveSystem.setTeam(playerTeam.filter(Boolean));
    } else {
      localStorage.setItem('pokearena_team',     JSON.stringify(playerTeam));
      localStorage.setItem('pokearena_unlocked', JSON.stringify(unlockedPokemon));
    }
  }

  function load() {
    if (typeof SaveSystem !== 'undefined') {
      playerTeam      = [...SaveSystem.getTeam()];
      unlockedPokemon = [...SaveSystem.getUnlocked()];
    } else {
      const savedTeam     = localStorage.getItem('pokearena_team');
      const savedUnlocked = localStorage.getItem('pokearena_unlocked');
      playerTeam      = savedTeam     ? JSON.parse(savedTeam)    : [];
      unlockedPokemon = savedUnlocked ? JSON.parse(savedUnlocked) : getUnlockedPokemon();
    }
    unlockedPokemon.forEach(key => { if (POKEMON_DATA[key]) POKEMON_DATA[key].unlocked = true; });
  }

  // ─── Team operations ──────────────────────────
  function addToTeam(key) {
    if (playerTeam.filter(Boolean).length >= MAX_TEAM_SIZE) {
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
    if (typeof SoundSystem !== 'undefined') SoundSystem.play('menuSelect');
    return true;
  }

  function removeFromTeam(slotIndex) {
    if (slotIndex < 0 || slotIndex >= playerTeam.length) return;
    playerTeam.splice(slotIndex, 1);
    save();
    renderTeamSlots();
    renderCollection();
  }

  function swapSlots(idxA, idxB) {
    if (idxA === idxB) return;
    // Pad to 6
    while (playerTeam.length < 6) playerTeam.push(null);
    const tmp = playerTeam[idxA];
    playerTeam[idxA] = playerTeam[idxB];
    playerTeam[idxB] = tmp;
    // Trim nulls from end
    while (playerTeam.length > 0 && !playerTeam[playerTeam.length - 1]) playerTeam.pop();
    save();
    renderTeamSlots();
    renderCollection();
  }

  function getTeam()       { return [...playerTeam].filter(Boolean); }

  function buildBattleTeam(level = 50) {
    return playerTeam.filter(Boolean)
      .map(key => createPokemonInstance(key, level))
      .filter(Boolean);
  }

  // For tower: each Pokémon uses its saved tower level (min 5)
  function buildTowerTeam() {
    return playerTeam.filter(Boolean)
      .map(key => {
        const level = SaveSystem.getTowerLevel(key);
        const inst  = createPokemonInstance(key, level);
        if (inst) inst.xp = XPSystem ? XPSystem.xpForLevel(level) : 0;
        return inst;
      })
      .filter(Boolean);
  }

  function unlock(key) {
    if (!unlockedPokemon.includes(key)) {
      unlockedPokemon.push(key);
      if (typeof unlockPokemon === 'function') unlockPokemon(key);
      save();
      renderCollection();
      showToast(`🎉 Unlocked ${POKEMON_DATA[key]?.name}!`);
    }
  }

  // ─── Render team slots ────────────────────────
  function renderTeamSlots() {
    const container = document.getElementById('team-slots');
    const countEl   = document.getElementById('team-count');
    if (!container) return;

    const filled = playerTeam.filter(Boolean).length;
    if (countEl) countEl.textContent = `(${filled}/6)`;

    const slots = container.querySelectorAll('.team-slot');

    slots.forEach((slotEl, i) => {
      const key = playerTeam[i] || null;

      // Clean up previous drag state
      slotEl.removeAttribute('draggable');
      slotEl.classList.remove('drag-source', 'drag-over');
      slotEl.querySelector('.drag-handle')?.remove();
      // Remove old listeners by cloning (cleanest approach)
      const fresh = slotEl.cloneNode(true);
      slotEl.parentNode.replaceChild(fresh, slotEl);
      const el = container.querySelectorAll('.team-slot')[i];

      if (key && POKEMON_DATA[key]) {
        const pkmn = POKEMON_DATA[key];
        el.classList.remove('empty');
        el.classList.add('filled');

        const spriteEl = el.querySelector('.slot-sprite');
        const nameEl   = el.querySelector('.slot-name');
        if (spriteEl) { spriteEl.src = getSpriteUrl(pkmn.id); spriteEl.alt = pkmn.name; }
        if (nameEl)   nameEl.textContent = pkmn.name;

        // Tower level badge
        let lvlEl = el.querySelector('.slot-tower-level');
        if (!lvlEl) {
          lvlEl = document.createElement('span');
          lvlEl.className = 'slot-tower-level';
          el.querySelector('.slot-info').insertBefore(lvlEl, el.querySelector('.slot-info').firstChild);
        }
        const towerLv = (typeof SaveSystem !== 'undefined') ? SaveSystem.getTowerLevel(key) : 5;
        lvlEl.textContent = `🗼 Lv.${towerLv}`;

        // Types
        let typesEl = el.querySelector('.slot-types');
        if (!typesEl) {
          typesEl = document.createElement('div');
          typesEl.className = 'slot-types';
          el.querySelector('.slot-info').appendChild(typesEl);
        }
        typesEl.innerHTML = pkmn.types.map(t =>
          `<span class="type-badge type-${t}">${t}</span>`).join('');

        // Info btn
        let infoBtn = el.querySelector('.slot-info-btn');
        if (!infoBtn) {
          infoBtn = document.createElement('button');
          infoBtn.className   = 'slot-info-btn';
          infoBtn.title       = 'View stats';
          infoBtn.textContent = 'ℹ';
          el.insertBefore(infoBtn, el.querySelector('.slot-remove'));
        }
        const capturedKey = key;
        infoBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (typeof StatsScreen !== 'undefined') StatsScreen.show(capturedKey, 50);
        });

        // Remove button
        const removeBtn = el.querySelector('.slot-remove');
        if (removeBtn) {
          removeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            removeFromTeam(i);
          });
        }

        // Drag handle
        const handle = document.createElement('span');
        handle.className   = 'drag-handle';
        handle.title       = 'Drag to reorder';
        handle.textContent = '⠿';
        el.prepend(handle);

        // Make draggable
        el.setAttribute('draggable', 'true');
        attachDragEvents(el, i);

      } else {
        el.classList.remove('filled');
        el.classList.add('empty');

        const spriteEl  = el.querySelector('.slot-sprite');
        const nameEl    = el.querySelector('.slot-name');
        const typesEl   = el.querySelector('.slot-types');
        const infoBtnEl = el.querySelector('.slot-info-btn');

        if (spriteEl)  { spriteEl.src = ''; spriteEl.alt = ''; }
        if (nameEl)    nameEl.textContent = '—';
        if (typesEl)   typesEl.remove();
        if (infoBtnEl) infoBtnEl.remove();

        // Empty slots are drop targets only
        attachDropEvents(el, i);
      }
    });
  }

  // ─── Drag-and-drop ────────────────────────────
  function attachDragEvents(el, idx) {
    el.addEventListener('dragstart', (e) => {
      _dragSrcIdx = idx;
      el.classList.add('drag-source');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(idx));
      // Slight delay so the ghost renders normally first
      requestAnimationFrame(() => { el.style.opacity = '0.4'; });
    });

    el.addEventListener('dragend', () => {
      el.style.opacity = '';
      el.classList.remove('drag-source');
      clearHighlights();
      _dragSrcIdx  = null;
      _dragOverIdx = null;
    });

    attachDropEvents(el, idx);

    // ── Touch drag ──
    let _touchActive = false;
    let _touchClone  = null;

    el.addEventListener('touchstart', (e) => {
      const handle = el.querySelector('.drag-handle');
      if (!handle) return;
      const t  = e.touches[0];
      const hr = handle.getBoundingClientRect();
      if (t.clientX >= hr.left - 8 && t.clientX <= hr.right + 8 &&
          t.clientY >= hr.top  - 8 && t.clientY <= hr.bottom + 8) {
        _touchActive = true;
        _dragSrcIdx  = idx;
        el.classList.add('drag-source');
        e.preventDefault();

        // Visual clone following finger
        _touchClone = el.cloneNode(true);
        _touchClone.style.cssText =
          'position:fixed;pointer-events:none;z-index:9999;opacity:0.8;' +
          `width:${el.offsetWidth}px;transform:scale(1.05);transition:none;` +
          `left:${t.clientX - el.offsetWidth/2}px;top:${t.clientY - 30}px;`;
        document.body.appendChild(_touchClone);
      }
    }, { passive: false });

    el.addEventListener('touchmove', (e) => {
      if (!_touchActive) return;
      e.preventDefault();
      const t = e.touches[0];

      // Move clone
      if (_touchClone) {
        _touchClone.style.left = `${t.clientX - el.offsetWidth / 2}px`;
        _touchClone.style.top  = `${t.clientY - 30}px`;
      }

      // Find which slot we're over
      if (_touchClone) _touchClone.style.display = 'none';
      const target   = document.elementFromPoint(t.clientX, t.clientY);
      if (_touchClone) _touchClone.style.display = '';

      const targetEl = target?.closest('.team-slot');
      clearHighlights();
      if (targetEl) {
        const allSlots = [...document.querySelectorAll('.team-slot')];
        _dragOverIdx   = allSlots.indexOf(targetEl);
        if (_dragOverIdx !== _dragSrcIdx) targetEl.classList.add('drag-over');
      }
    }, { passive: false });

    el.addEventListener('touchend', () => {
      if (!_touchActive) return;
      _touchClone?.remove();
      _touchClone  = null;
      _touchActive = false;
      el.classList.remove('drag-source');

      if (_dragOverIdx !== null && _dragOverIdx !== _dragSrcIdx) {
        swapSlots(_dragSrcIdx, _dragOverIdx);
        if (typeof SoundSystem !== 'undefined') SoundSystem.play('menuSelect');
      }
      clearHighlights();
      _dragSrcIdx  = null;
      _dragOverIdx = null;
    });
  }

  function attachDropEvents(el, idx) {
    el.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (_dragOverIdx !== idx) {
        clearHighlights();
        _dragOverIdx = idx;
        el.classList.add('drag-over');
      }
    });

    el.addEventListener('dragleave', (e) => {
      if (!el.contains(e.relatedTarget)) {
        el.classList.remove('drag-over');
        if (_dragOverIdx === idx) _dragOverIdx = null;
      }
    });

    el.addEventListener('drop', (e) => {
      e.preventDefault();
      clearHighlights();
      const src = parseInt(e.dataTransfer.getData('text/plain'));
      if (!isNaN(src) && src !== idx) {
        swapSlots(src, idx);
        if (typeof SoundSystem !== 'undefined') SoundSystem.play('menuSelect');
      }
    });
  }

  function clearHighlights() {
    document.querySelectorAll('.team-slot.drag-over')
      .forEach(e => e.classList.remove('drag-over'));
  }

  // ─── Collection grid ──────────────────────────
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
      const pkmn   = POKEMON_DATA[key];
      const inTeam = playerTeam.filter(Boolean).includes(key);

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

      if (!inTeam) card.addEventListener('click', () => addToTeam(key));
      grid.appendChild(card);
    });
  }

  // ─── Toast ────────────────────────────────────
  function showToast(msg) {
    let toast = document.getElementById('toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'toast';
      toast.style.cssText =
        'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);' +
        'background:var(--bg-card);border:2px solid var(--border-bright);' +
        'border-radius:999px;padding:10px 24px;font-family:var(--font-pixel);' +
        'font-size:10px;color:var(--text-primary);z-index:200;opacity:0;' +
        'transition:opacity 0.2s;pointer-events:none;white-space:nowrap;';
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
    init, addToTeam, removeFromTeam, swapSlots, getTeam,
    buildBattleTeam, buildTowerTeam, unlock, renderTeamSlots, renderCollection, showToast,
    get teamSize() { return playerTeam.filter(Boolean).length; }
  };

})();

function removeFromTeam(idx) { TeamBuilder.removeFromTeam(idx); }
function filterCollection() {
  const val = document.getElementById('search-pokemon')?.value || '';
  TeamBuilder.renderCollection(val);
}
