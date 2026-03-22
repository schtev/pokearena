// ═══════════════════════════════════════════════════
//  src/team/teambuilder.js  — v2
//  New in v2:
//   • Shiny toggle per slot (if shiny unlocked)
//   • Held item picker per slot
//   • Improved collection grid with search + type filter
//   • Tower lead picker: search + larger cards
// ═══════════════════════════════════════════════════

const TeamBuilder = (() => {

  const MAX_TEAM_SIZE = 6;

  let playerTeam      = [];   // array of keys (or null)
  let unlockedPokemon = [];
  let _shinySlots     = {};   // key → bool (is shiny active for that slot)
  let _heldSlots      = {};   // key → itemKey

  // ─── Persistence ──────────────────────────────
  function save() {
    SaveSystem.setTeam(playerTeam.filter(Boolean));
    // Persist per-pokemon prefs
    playerTeam.filter(Boolean).forEach(key => {
      if (_shinySlots[key]) {
        SaveSystem.unlockShiny(key); // ensure saved
      }
      if (_heldSlots[key]) {
        SaveSystem.setHeldItem(key, _heldSlots[key]);
      } else {
        SaveSystem.clearHeldItem(key);
      }
    });
  }

  function load() {
    playerTeam      = [...SaveSystem.getTeam()];
    unlockedPokemon = [...SaveSystem.getUnlocked()];
    unlockedPokemon.forEach(key => { if (POKEMON_DATA[key]) POKEMON_DATA[key].unlocked = true; });
    // Load per-pokemon prefs — restore saved shiny toggle state
    const heldMap    = SaveSystem.getHeldItems()    || {};
    const activeShiny = SaveSystem.getActiveShiny() || {};
    playerTeam.filter(Boolean).forEach(key => {
      // Restore shiny toggle: only true if shiny is unlocked AND was toggled on
      _shinySlots[key] = SaveSystem.hasShiny(key) && (activeShiny[key] === true);
      _heldSlots[key]  = heldMap[key] || null;
    });
  }

  // ─── Team operations ──────────────────────────
  function addToTeam(key) {
    if (playerTeam.filter(Boolean).length >= MAX_TEAM_SIZE) {
      showToast('Your team is full! (6/6)'); return false;
    }
    if (playerTeam.includes(key)) {
      showToast(`${POKEMON_DATA[key].name} is already in your team!`); return false;
    }
    playerTeam.push(key);
    // Restore previously saved shiny state (don't wipe it on re-add)
    const savedActive = SaveSystem.getActiveShiny() || {};
    _shinySlots[key] = SaveSystem.hasShiny(key) && (savedActive[key] === true);
    _heldSlots[key]  = null;
    save(); renderTeamSlots(); renderCollection();
    if (typeof SoundSystem !== 'undefined') SoundSystem.play('menuSelect');
    return true;
  }

  function removeFromTeam(slotIndex) {
    if (slotIndex < 0 || slotIndex >= playerTeam.length) return;
    // Note: we deliberately DON'T clear _shinySlots or activeShiny here —
    // if the player re-adds this Pokémon later, their shiny toggle is preserved.
    playerTeam.splice(slotIndex, 1);
    save(); renderTeamSlots(); renderCollection();
  }

  function swapSlots(idxA, idxB) {
    if (idxA === idxB) return;
    while (playerTeam.length < 6) playerTeam.push(null);
    [playerTeam[idxA], playerTeam[idxB]] = [playerTeam[idxB], playerTeam[idxA]];
    while (playerTeam.length > 0 && !playerTeam[playerTeam.length - 1]) playerTeam.pop();
    save(); renderTeamSlots(); renderCollection();
  }

  function toggleShiny(key) {
    if (!SaveSystem.hasShiny(key)) { showToast(`No shiny ${POKEMON_DATA[key]?.name} unlocked!`); return; }
    _shinySlots[key] = !_shinySlots[key];
    SaveSystem.setActiveShiny(key, _shinySlots[key]);  // persist toggle state
    save(); renderTeamSlots();
  }

  function setHeld(key, itemKey) {
    _heldSlots[key] = itemKey || null;
    save(); renderTeamSlots();
  }

  function getTeam()  { return [...playerTeam].filter(Boolean); }
  function isShiny(k) { return _shinySlots[k] || false; }

  function buildBattleTeam(level = 50) {
    return playerTeam.filter(Boolean).map(key => {
      const inst = createPokemonInstance(key, level, { shiny: _shinySlots[key] || false });
      if (inst && _heldSlots[key] && typeof HeldItems !== 'undefined') {
        const heldKey = _heldSlots[key];
        if (HeldItems.ITEMS?.[heldKey]) {
          inst.heldItem    = heldKey;
          inst.heldItemObj = HeldItems.ITEMS[heldKey];
        }
      }
      return inst;
    }).filter(Boolean);
  }

  function buildTowerTeam() {
    return playerTeam.filter(Boolean).map(key => {
      const level = SaveSystem.getTowerLevel(key);
      const inst  = createPokemonInstance(key, level, { shiny: _shinySlots[key] || false });
      if (inst) {
        inst.xp = typeof XPSystem !== 'undefined' ? XPSystem.xpForLevel(level) : 0;
        if (_heldSlots[key] && typeof HeldItems !== 'undefined') {
          const hk = _heldSlots[key];
          if (HeldItems.ITEMS?.[hk]) { inst.heldItem = hk; inst.heldItemObj = HeldItems.ITEMS[hk]; }
        }
      }
      return inst;
    }).filter(Boolean);
  }

  function unlock(key) {
    if (!unlockedPokemon.includes(key)) {
      unlockedPokemon.push(key);
      if (typeof unlockPokemon === 'function') unlockPokemon(key);
      save(); renderCollection();
      showToast(`🎉 Unlocked ${POKEMON_DATA[key]?.name}!`);
    }
  }

  // ─── Drag state ───────────────────────────────
  let _dragSrcIdx = null, _dragOverIdx = null;

  // ─── Render team slots ────────────────────────
  function renderTeamSlots() {
    const container = document.getElementById('team-slots');
    const countEl   = document.getElementById('team-count');
    if (!container) return;

    const filled = playerTeam.filter(Boolean).length;
    if (countEl) countEl.textContent = `(${filled}/6)`;

    container.querySelectorAll('.team-slot').forEach((slotEl, i) => {
      const key   = playerTeam[i] || null;
      const fresh = slotEl.cloneNode(true);
      slotEl.parentNode.replaceChild(fresh, slotEl);
      const el = container.querySelectorAll('.team-slot')[i];

      if (key && POKEMON_DATA[key]) {
        const pkmn      = POKEMON_DATA[key];
        const shinyOn   = _shinySlots[key] || false;
        const hasShinyU = SaveSystem.hasShiny(key);
        const heldKey   = _heldSlots[key] || null;
        const towerLv   = SaveSystem.getTowerLevel(key);

        el.classList.remove('empty'); el.classList.add('filled');

        const spriteEl = el.querySelector('.slot-sprite');
        const nameEl   = el.querySelector('.slot-name');
        if (spriteEl) {
          spriteEl.src = getSpriteUrl(pkmn.id, shinyOn);
          spriteEl.alt = pkmn.name;
          spriteEl.style.filter = shinyOn ? 'drop-shadow(0 0 6px #f5c518)' : '';
        }
        if (nameEl) {
          nameEl.textContent = (shinyOn ? '✨ ' : '') + pkmn.name;
          nameEl.style.color = shinyOn ? '#f5c518' : '';
        }

        // Level badge
        let lvlEl = el.querySelector('.slot-tower-level');
        if (!lvlEl) {
          lvlEl = document.createElement('span');
          lvlEl.className = 'slot-tower-level';
          el.querySelector('.slot-info')?.prepend(lvlEl);
        }
        lvlEl.textContent = `🗼 Lv.${towerLv}`;

        // Types
        let typesEl = el.querySelector('.slot-types');
        if (!typesEl) {
          typesEl = document.createElement('div');
          typesEl.className = 'slot-types';
          el.querySelector('.slot-info')?.appendChild(typesEl);
        }
        typesEl.innerHTML = pkmn.types.map(t =>
          `<span class="type-badge type-${t}">${t}</span>`).join('');

        // Held item row
        let heldEl = el.querySelector('.slot-held');
        if (!heldEl) {
          heldEl = document.createElement('div');
          heldEl.className = 'slot-held';
          el.querySelector('.slot-info')?.appendChild(heldEl);
        }
        _renderHeldPicker(heldEl, key, heldKey);

        // Shiny toggle button (only if shiny is unlocked)
        let shinyBtn = el.querySelector('.slot-shiny-btn');
        if (!shinyBtn && hasShinyU) {
          shinyBtn = document.createElement('button');
          shinyBtn.className = 'slot-shiny-btn';
          shinyBtn.title = 'Toggle shiny';
          el.insertBefore(shinyBtn, el.querySelector('.slot-remove'));
        }
        if (shinyBtn) {
          if (!hasShinyU) {
            shinyBtn.remove();
          } else {
            shinyBtn.textContent = shinyOn ? '✨' : '☆';
            shinyBtn.classList.toggle('shiny-active', shinyOn);
            const k2 = key;
            shinyBtn.onclick = (e) => { e.stopPropagation(); toggleShiny(k2); };
          }
        }

        // Info btn
        let infoBtn = el.querySelector('.slot-info-btn');
        if (!infoBtn) {
          infoBtn = document.createElement('button');
          infoBtn.className = 'slot-info-btn';
          infoBtn.title = 'View stats';
          infoBtn.textContent = 'ℹ';
          el.insertBefore(infoBtn, el.querySelector('.slot-remove'));
        }
        const k3 = key;
        infoBtn.onclick = (e) => {
          e.stopPropagation();
          if (typeof StatsScreen !== 'undefined') StatsScreen.show(k3, 50);
        };

        // Remove btn
        const removeBtn = el.querySelector('.slot-remove');
        if (removeBtn) removeBtn.onclick = (e) => { e.stopPropagation(); removeFromTeam(i); };

        // Drag
        const handle = document.createElement('span');
        handle.className = 'drag-handle'; handle.title = 'Drag to reorder'; handle.textContent = '⠿';
        el.prepend(handle);
        el.setAttribute('draggable', 'true');
        _attachDragEvents(el, i);

      } else {
        el.classList.remove('filled'); el.classList.add('empty');
        const spriteEl  = el.querySelector('.slot-sprite');
        const nameEl    = el.querySelector('.slot-name');
        const typesEl   = el.querySelector('.slot-types');
        const heldEl    = el.querySelector('.slot-held');
        const infoBtnEl = el.querySelector('.slot-info-btn');
        const shinyBtn  = el.querySelector('.slot-shiny-btn');
        if (spriteEl)  { spriteEl.src = ''; spriteEl.alt = ''; spriteEl.style.filter = ''; }
        if (nameEl)    { nameEl.textContent = '—'; nameEl.style.color = ''; }
        if (typesEl)   typesEl.remove();
        if (heldEl)    heldEl.remove();
        if (infoBtnEl) infoBtnEl.remove();
        if (shinyBtn)  shinyBtn.remove();
        _attachDropEvents(el, i);
      }
    });
  }

  // ─── Held item picker widget ──────────────────
  // Battle-viable items from Items.ITEM_DATA (or a curated list)
  const HELD_ITEM_KEYS = [
    'leftovers','choiceBand','choiceSpecs','choiceScarf','lifeOrb',
    'focusSash','rockyHelmet','assaultVest','expertBelt','heavyDutyBoots',
    'oranBerry','sitrusBerry','leppaBerry','rawstBerry','chestoBerry',
    'pechaBerry','aspearBerry',
  ];

  function _renderHeldPicker(container, key, currentHeld) {
    container.innerHTML = '';
    const label = document.createElement('span');
    label.className = 'slot-held-label';
    label.textContent = currentHeld ? `📦 ${_heldName(currentHeld)}` : '📦 No item';
    container.appendChild(label);

    const btn = document.createElement('button');
    btn.className = 'slot-held-btn';
    btn.textContent = currentHeld ? '✎' : '+';
    btn.title = 'Set held item';
    btn.onclick = (e) => { e.stopPropagation(); _openHeldPicker(key); };
    container.appendChild(btn);
  }

  function _heldName(itemKey) {
    if (typeof Items !== 'undefined' && Items.ITEM_DATA?.[itemKey]) {
      return Items.ITEM_DATA[itemKey].name;
    }
    return itemKey;
  }

  function _openHeldPicker(key) {
    // Remove any existing picker
    document.getElementById('held-picker-popup')?.remove();

    const popup = document.createElement('div');
    popup.id = 'held-picker-popup';
    popup.className = 'held-picker-popup';
    popup.innerHTML = `
      <div class="held-picker-header">
        <span>Choose held item for ${POKEMON_DATA[key]?.name}</span>
        <button onclick="document.getElementById('held-picker-popup')?.remove()">✕</button>
      </div>
      <button class="held-picker-item held-none-btn"
              onclick="TeamBuilder._setHeld('${key}',null)">
        <span class="held-icon">—</span>
        <span>No Item</span>
      </button>
      ${HELD_ITEM_KEYS.map(k => {
        const item = (typeof Items !== 'undefined') ? Items.ITEM_DATA?.[k] : null;
        const name = item?.name || k;
        const desc = item?.desc || '';
        const spr  = item?.sprite ? `<img src="${item.sprite}" class="held-sprite" onerror="this.style.display='none'">` : '';
        return `<button class="held-picker-item" onclick="TeamBuilder._setHeld('${key}','${k}')">
          ${spr}<span class="held-name">${name}</span>
          <span class="held-desc">${desc}</span>
        </button>`;
      }).join('')}
    `;

    // Position near the team slots
    const teamEl = document.getElementById('team-slots');
    const rect   = teamEl?.getBoundingClientRect() || { top: 100, left: 50 };
    popup.style.top  = `${rect.top + window.scrollY}px`;
    popup.style.left = `${rect.left + rect.width + 10}px`;

    document.body.appendChild(popup);

    // Close on outside click
    setTimeout(() => {
      document.addEventListener('click', function _close(e) {
        if (!popup.contains(e.target)) {
          popup.remove();
          document.removeEventListener('click', _close);
        }
      });
    }, 100);
  }

  // ─── Collection grid ──────────────────────────
  let _collFilter   = '';
  let _collType     = 'all';
  let _collShinyOnly = false;

  function renderCollection(filter) {
    if (filter !== undefined) _collFilter = filter;
    const grid = document.getElementById('collection-grid');
    if (!grid) return;

    const keys = Object.keys(POKEMON_DATA).filter(key => {
      const pkmn = POKEMON_DATA[key];
      if (!pkmn.unlocked) return false;
      if (_collFilter && !pkmn.name.toLowerCase().includes(_collFilter.toLowerCase())) return false;
      if (_collType !== 'all' && !pkmn.types.includes(_collType)) return false;
      if (_collShinyOnly && !SaveSystem.hasShiny(key)) return false;
      return true;
    }).sort((a,b) => POKEMON_DATA[a].id - POKEMON_DATA[b].id);

    if (keys.length === 0) {
      grid.innerHTML = '<p style="color:var(--text-dim);padding:20px;grid-column:1/-1">No Pokémon found.</p>';
      return;
    }

    grid.innerHTML = keys.map(key => {
      const pkmn   = POKEMON_DATA[key];
      const inTeam = playerTeam.filter(Boolean).includes(key);
      const hasS   = SaveSystem.hasShiny(key);
      return `<div class="poke-card${inTeam ? ' in-team' : ''}${hasS ? ' has-shiny' : ''}"
                   title="${inTeam ? pkmn.name + ' (in team)' : 'Add ' + pkmn.name}"
                   onclick="${inTeam ? '' : `TeamBuilder._addKey('${key}')`}">
        ${hasS ? '<div class="poke-card-shiny-badge">✨</div>' : ''}
        <img src="${getSpriteUrl(pkmn.id)}" alt="${pkmn.name}" loading="lazy">
        <div class="poke-card-name">${pkmn.name}</div>
        <div class="poke-card-types">
          ${pkmn.types.map(t => `<span class="type-badge type-${t}">${t}</span>`).join('')}
        </div>
        <div class="poke-card-id">#${String(pkmn.id).padStart(3,'0')}</div>
        ${inTeam ? '<div class="poke-card-inteam">✓ In Team</div>' : ''}
      </div>`;
    }).join('');
  }

  function _addKey(key) { addToTeam(key); }
  function _setHeld(key, item) {
    setHeld(key, item);
    document.getElementById('held-picker-popup')?.remove();
  }
  function setCollType(t)     { _collType = t; renderCollection(); }
  function setCollShinyOnly(v){ _collShinyOnly = v; renderCollection(); }

  // ─── Drag/drop (same logic, just extracted) ───
  function _attachDragEvents(el, idx) {
    el.addEventListener('dragstart', e => {
      _dragSrcIdx = idx; el.classList.add('drag-source');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(idx));
      requestAnimationFrame(() => { el.style.opacity = '0.4'; });
    });
    el.addEventListener('dragend', () => {
      el.style.opacity = ''; el.classList.remove('drag-source');
      _clearHighlights(); _dragSrcIdx = _dragOverIdx = null;
    });
    _attachDropEvents(el, idx);
  }

  function _attachDropEvents(el, idx) {
    el.addEventListener('dragover', e => {
      e.preventDefault(); e.dataTransfer.dropEffect = 'move';
      if (_dragOverIdx !== idx) { _clearHighlights(); _dragOverIdx = idx; el.classList.add('drag-over'); }
    });
    el.addEventListener('dragleave', e => {
      if (!el.contains(e.relatedTarget)) { el.classList.remove('drag-over'); if (_dragOverIdx === idx) _dragOverIdx = null; }
    });
    el.addEventListener('drop', e => {
      e.preventDefault(); _clearHighlights();
      const src = parseInt(e.dataTransfer.getData('text/plain'));
      if (!isNaN(src) && src !== idx) { swapSlots(src, idx); if (typeof SoundSystem !== 'undefined') SoundSystem.play('menuSelect'); }
    });
  }

  function _clearHighlights() {
    document.querySelectorAll('.team-slot.drag-over').forEach(e => e.classList.remove('drag-over'));
  }

  // ─── Toast ────────────────────────────────────
  function showToast(msg) {
    let toast = document.getElementById('toast');
    if (!toast) {
      toast = document.createElement('div'); toast.id = 'toast';
      toast.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);' +
        'background:var(--bg-card);border:2px solid var(--border-bright);border-radius:999px;' +
        'padding:10px 24px;font-family:var(--font-pixel);font-size:10px;color:var(--text-primary);' +
        'z-index:200;opacity:0;transition:opacity 0.2s;pointer-events:none;white-space:nowrap;';
      document.body.appendChild(toast);
    }
    toast.textContent = msg; toast.style.opacity = '1';
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => { toast.style.opacity = '0'; }, 2200);
  }

  // ─── Init ─────────────────────────────────────
  function init() { load(); renderTeamSlots(); renderCollection(); }

  return {
    init, addToTeam, removeFromTeam, swapSlots, getTeam,
    buildBattleTeam, buildTowerTeam, unlock, renderTeamSlots, renderCollection,
    showToast, isShiny, toggleShiny, setHeld,
    setCollType, setCollShinyOnly,
    _addKey, _setHeld,
    get teamSize() { return playerTeam.filter(Boolean).length; }
  };

})();

function removeFromTeam(idx) { TeamBuilder.removeFromTeam(idx); }
function filterCollection() {
  const val = document.getElementById('search-pokemon')?.value || '';
  TeamBuilder.renderCollection(val);
}

function collSetType(type, btn) {
  document.querySelectorAll('.coll-type-chip').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  TeamBuilder.setCollType(type);
}
