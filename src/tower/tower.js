// ═══════════════════════════════════════════════════
//  src/tower/tower.js  (v2 — Egg Run Edition)
//
//  Changes from v1:
//   • No level cap — enemy levels scale infinitely,
//     player Pokémon can exceed lv100
//   • Player brings ONE Pokémon to start (the "lead")
//   • Every EGG_INTERVAL floors a rarity-tiered egg
//     is awarded; it hatches after the battle and adds
//     a new Pokémon to the tower run party (max 6)
//   • Tower party is run-scoped: starts fresh each run,
//     saved in SaveSystem.get().towerRun* fields
// ═══════════════════════════════════════════════════

const Tower = (() => {

  // ─── Configuration ────────────────────────────
  const EGG_INTERVAL = 5;   // egg every N floors

  // ─── Rarity tiers ─────────────────────────────
  // Each tier has a colour, label, and Pokémon pool.
  // Pools are intentionally NOT overlap-filtered so
  // duplicates can happen (adds challenge decision later).
  const RARITY = {
    COMMON: {
      id: 'common', label: 'Common', colour: '#9E9E9E',
      chance: 0.50,   // 50 % of egg rolls
      pool: [
        'pidgey','rattata','caterpie','weedle','geodude',
        'zubat','oddish','paras','venonat','diglett',
        'meowth','psyduck','mankey','growlithe','poliwag',
        'abra','machop','bellsprout','tentacool','slowpoke',
        'magnemite','doduo','seel','grimer','drowzee',
        'krabby','voltorb','exeggcute','cubone','rhyhorn',
        'tangela','horsea','goldeen','staryu',
      ],
    },
    UNCOMMON: {
      id: 'uncommon', label: 'Uncommon', colour: '#4CAF50',
      chance: 0.28,   // 28 %
      pool: [
        'bulbasaur','charmander','squirtle','pikachu','eevee',
        'clefairy','jigglypuff','vulpix','sandshrew','nidoranM',
        'nidoranF','chansey','kangaskhan','pinsir','scyther',
        'electabuzz','magmar','tauros','ditto','porygon',
        'omanyte','kabuto','aerodactyl',
        'chikorita','cyndaquil','totodile','togepi',
        'mareep','flaaffy','swinub',
      ],
    },
    RARE: {
      id: 'rare', label: 'Rare', colour: '#2196F3',
      chance: 0.15,   // 15 %
      pool: [
        'ivysaur','charmeleon','wartortle','raichu','vaporeon',
        'jolteon','flareon','espeon','umbreon','gengar',
        'haunter','alakazam','machamp','golem','arcanine',
        'poliwrath','victreebel','rapidash','slowbro','magneton',
        'dodrio','dewgong','muk','cloyster','hypno',
        'starmie','mrMime','jynx','electabuzz','pinsir',
        'lapras','snorlax','ampharos','bellossom','scizor',
        'heracross','sneasel','ursaring','magcargo',
      ],
    },
    EPIC: {
      id: 'epic', label: 'Epic', colour: '#9C27B0',
      chance: 0.055,  // 5.5 %
      pool: [
        'venusaur','charizard','blastoise','gyarados','aerodactyl',
        'dragonair','dragonite','rhydon','nidoking','nidoqueen',
        'clefable','wigglytuff','ninetales','arcanine','poliwrath',
        'machamp','alakazam','golem','rapidash','dewgong',
        'cloyster','gengar','onix','hypno','kingler',
        'electrode','exeggutor','marowak','hitmonlee','hitmonchan',
        'weezing','kangaskhan','starmie','tauros','lapras',
        'vaporeon','jolteon','flareon','espeon','umbreon',
        'togekiss','ampharos','bellossom','scizor','heracross',
        'tyranitar','blissey','kingdra','porygon2',
        'garchomp','lucario','weavile','electivire','magmortar',
      ],
    },
    LEGENDARY: {
      id: 'legendary', label: 'LEGENDARY', colour: '#FF9800',
      chance: 0.015,  // 1.5 %
      pool: [
        'articuno','zapdos','moltres','mewtwo',
        'raikou','entei','suicune','lugia','hoOh','celebi',
        'regirock','regice','registeel','latias','latios',
        'kyogre','groudon','rayquaza','jirachi','deoxysNormal',
        'uxie','mesprit','azelf','dialga','palkia',
        'giratinaAltered','heatran','regigigas','cresselia',
        'victini','cobalion','terrakion','virizion',
        'tornadusIncarnate','thundurusIncarnate','reshiram','zekrom','landorusIncarnate',
        'kyurem','keldeoOrdinary','meloettaAria','genesect',
      ],
    },
  };

  const RARITY_ORDER = ['COMMON','UNCOMMON','RARE','EPIC','LEGENDARY'];

  // ─── Enemy pools (unchanged, but no level cap) ─
  const ENEMY_POOL = {
    0: ['bulbasaur','charmander','squirtle','pikachu','eevee'],
    1: ['ivysaur','charmeleon','wartortle','raichu','eevee','snorlax'],
    2: ['venusaur','charizard','blastoise','lapras','gengar','machamp'],
    3: ['dragonite','gengar','lapras','machamp','snorlax','lucario'],
    4: ['mewtwo','dragonite','garchomp','lucario','gengar','charizard'],
    5: ['mewtwo','rayquaza','giratinaAltered','dialga','palkia','arceus'],
  };

  const FLOOR_TYPE = {
    WILD: 'wild', TRAINER: 'trainer', ELITE: 'elite', BOSS: 'boss',
  };

  // ─── Run state ────────────────────────────────
  let currentFloor  = 1;
  let bestFloor     = 0;
  let isActive      = false;
  // The tower-run party: [{ key, level, xp }, ...]
  // Built fresh at startRun, persisted in save.
  let runParty      = [];
  // Pending egg (set after floor clear, consumed by hatch overlay)
  let pendingEgg    = null;

  // ─── Floor generation ─────────────────────────

  function getFloorType(n) {
    if (n % 10 === 0) return FLOOR_TYPE.BOSS;
    if (n % 5  === 0) return FLOOR_TYPE.ELITE;
    if (n % 3  === 0) return FLOOR_TYPE.TRAINER;
    return FLOOR_TYPE.WILD;
  }

  function randomEnemyKey(tier) {
    const pool = ENEMY_POOL[Math.min(tier, 5)];
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function generateEnemyTeam(floorNumber) {
    const type = getFloorType(floorNumber);
    const tier = Math.floor(floorNumber / 10);

    // No level cap — scales indefinitely
    const baseLevel  = Math.floor(10 + floorNumber * 1.5);
    const levelRange = 3;

    let teamSize;
    switch (type) {
      case FLOOR_TYPE.BOSS:    teamSize = 6; break;
      case FLOOR_TYPE.ELITE:   teamSize = 4; break;
      case FLOOR_TYPE.TRAINER: teamSize = Math.min(3, 1 + Math.floor(floorNumber / 5)); break;
      default:                 teamSize = 1;
    }

    const team = [];
    for (let i = 0; i < teamSize; i++) {
      const key   = randomEnemyKey(tier);
      const level = Math.max(5, baseLevel + Math.floor(Math.random() * levelRange * 2) - levelRange);
      const pkmn  = createPokemonInstance(key, level);
      if (pkmn) team.push(pkmn);
    }
    return team;
  }

  function generateFloor(floorNumber) {
    const type      = getFloorType(floorNumber);
    const enemyTeam = generateEnemyTeam(floorNumber);
    const egg       = isEggFloor(floorNumber) ? rollEgg() : null;

    return {
      floorNumber,
      type,
      enemyTeam,
      reward: null,           // old unlock system removed
      egg,                    // null | { rarity, rarityData, key, name }
      trainerName: generateTrainerName(type, floorNumber),
    };
  }

  // ─── Egg system ───────────────────────────────

  function isEggFloor(n) {
    return n > 0 && n % EGG_INTERVAL === 0;
  }

  /** Roll a rarity tier, then pick a random Pokémon from that tier's pool. */
  function rollEgg() {
    // Weighted roll
    const roll = Math.random();
    let cumulative = 0;
    let chosenRarity = 'COMMON';
    for (const rid of RARITY_ORDER) {
      cumulative += RARITY[rid].chance;
      if (roll < cumulative) { chosenRarity = rid; break; }
    }

    const rarityData = RARITY[chosenRarity];
    const pool       = rarityData.pool.filter(k => POKEMON_DATA[k]);  // only keys that exist
    if (!pool.length) return null;

    const key = pool[Math.floor(Math.random() * pool.length)];
    // Shiny chance: 1% base, +1% per rarity tier above Common
    const rarityBonus = RARITY_ORDER.indexOf(chosenRarity) * 0.01;
    const isShiny = Math.random() < (0.01 + rarityBonus);
    return {
      rarity:     chosenRarity,
      rarityData,
      key,
      name:       POKEMON_DATA[key]?.name || key,
      isShiny,
    };
  }

  /** Store the egg so the hatch overlay can use it after battle. */
  function setPendingEgg(egg) { pendingEgg = egg; }
  function getPendingEgg()    { return pendingEgg; }
  function clearPendingEgg()  { pendingEgg = null; }

  // ─── Run party ────────────────────────────────

  /**
   * Start a new run with a single lead Pokémon.
   * @param {string} leadKey  — pokemon key chosen in the tower menu
   */
  function startRun(leadKey, slotIdx = 0) {
    _activeSlot  = slotIdx;
    currentFloor = 1;
    isActive     = true;
    pendingEgg   = null;

    const leadLevel = SaveSystem.getTowerLevel(leadKey) || 5;
    const _xpBase = lv => Math.pow(Math.max(1, lv), 3);
    runParty = [{ key: leadKey, level: leadLevel, xp: _xpBase(leadLevel) }];

    _saveRunParty();
    SaveSystem.setTowerRun(1);
    updateHUD();
  }

  /** Build live battle instances from the current run party. */
  function buildRunParty() {
    return runParty
      .map(m => {
        const inst = createPokemonInstance(m.key, m.level);
        if (inst) {
          inst.xp = (m.xp !== undefined && m.xp > 0) ? m.xp : Math.pow(Math.max(1, m.level), 3);
          inst._towerPartyKey = m.key;   // tag so we can sync back
        }
        return inst;
      })
      .filter(Boolean);
  }

  /**
   * After a battle, sync any level-ups back into runParty.
   * @param {object[]} instances  — live battle instances
   */
  function syncPartyLevels(instances) {
    for (const inst of instances) {
      const key    = inst._towerPartyKey || inst.key?.toLowerCase?.();
      const member = runParty.find(m => m.key === key);
      if (member) {
        member.level = inst.level || member.level;
        const _xpBase3 = lv => Math.pow(Math.max(1, lv), 3);
        member.xp    = inst.xp !== undefined ? inst.xp : _xpBase3(member.level);
        // Persist the lead's level so it carries across sessions
        SaveSystem.setTowerLevel(key, member.level);
      }
    }
    _saveRunParty();
  }

  /**
   * Add a hatched Pokémon to the run party (max 6).
   * @param {string} key  — pokemon key
   * @returns {boolean}   — true if added
   */
  function addHatchedToParty(key) {
    if (runParty.length >= 6) return false;
    const level = Math.max(5, Math.floor(currentFloor * 0.8));  // hatches at ~80% of current floor
    const _xpBase2 = lv => Math.pow(Math.max(1, lv), 3);
    runParty.push({ key, level, xp: _xpBase2(level) });
    _saveRunParty();
    return true;
  }

  function getRunParty()  { return runParty; }
  function getPartySize() { return runParty.length; }

  // Current active slot index (0-2)
  let _activeSlot = -1;

  function _saveRunParty() {
    if (_activeSlot < 0) return;
    SaveSystem.saveTowerSlot(_activeSlot, {
      floor:     currentFloor,
      party:     runParty.map(m => ({ ...m })),
      lead:      runParty[0]?.key || null,
      bestFloor: SaveSystem.getBestFloor(),
      active:    true,
    });
  }

  function _loadRunParty() {
    if (_activeSlot < 0) return [];
    const slot = SaveSystem.getTowerSlot(_activeSlot);
    return slot?.party || [];
  }

  function getActiveSlot() { return _activeSlot; }

  function setActiveSlot(idx) {
    _activeSlot = idx;
  }

  // ─── Session management ───────────────────────

  function advanceFloor() {
    currentFloor++;
    if (currentFloor > bestFloor) {
      bestFloor = currentFloor;
      SaveSystem.setBestFloor(bestFloor);
    }
    SaveSystem.setTowerRun(currentFloor);
    _saveRunParty();   // persist party + floor to slot
    updateHUD();
  }

  function endRun() {
    isActive = false;
    runParty = [];
    if (_activeSlot >= 0) {
      SaveSystem.clearTowerSlot(_activeSlot);
    }
    _activeSlot = -1;
    SaveSystem.setTowerRun(0);
    updateBestFloorDisplay();
  }

  function resumeRun(slotIdx) {
    const idx  = (slotIdx !== undefined) ? slotIdx : SaveSystem.getActiveTowerSlot();
    const slot = (idx >= 0) ? SaveSystem.getTowerSlot(idx) : null;

    if (slot && slot.active && slot.floor > 0) {
      _activeSlot  = idx;
      currentFloor = slot.floor;
      isActive     = true;
      runParty     = slot.party || [];
      updateHUD();
      return true;
    }
    // Legacy fallback: old towerRun field
    const saved = SaveSystem.get().towerRun || 0;
    if (saved > 1) {
      _activeSlot  = 0;
      currentFloor = saved;
      isActive     = true;
      runParty     = SaveSystem.get().towerParty || [];
      updateHUD();
      return true;
    }
    return false;
  }

  function getCurrentFloor() { return currentFloor; }
  function getIsActive()     { return isActive; }

  // ─── HUD ──────────────────────────────────────

  function updateHUD() {
    const hudFloor = document.getElementById('tower-floor-num');
    const curFloor = document.getElementById('current-floor');
    if (hudFloor) hudFloor.textContent = currentFloor;
    if (curFloor) curFloor.textContent = `Floor ${currentFloor}`;
    _renderPartyHUD();
  }

  function _renderPartyHUD() {
    const hud = document.getElementById('tower-party-hud');
    if (!hud || runParty.length === 0) return;
    hud.innerHTML = runParty.map(m => {
      const d = POKEMON_DATA[m.key];
      return `<div class="tph-slot" title="${d?.name || m.key}">
        <img src="${d ? getSpriteUrl(d.id) : ''}" class="tph-sprite">
        <span class="tph-level">Lv${m.level}</span>
      </div>`;
    }).join('');
  }

  function updateBestFloorDisplay() {
    bestFloor = SaveSystem.getBestFloor() || 0;
    const el = document.getElementById('best-floor');
    if (el) el.textContent = bestFloor > 0 ? `Floor ${bestFloor}` : '—';
  }

  // ─── Tower menu ───────────────────────────────

  const TRAINER_NAMES = [
    'Youngster Joey', 'Lass Cathy', 'Bug Catcher Tommy', 'Hiker Frank',
    'Pokémaniac Steve', 'Sailor Jerry', 'Super Nerd Lewis', 'Rocker Kirk',
    'Psychic Jin', 'Cool Trainer Kate', 'Ace Trainer Al', 'Rival Blue'
  ];
  const BOSS_NAMES = [
    'Tower Guardian', 'Shadow Warden', 'Apex Challenger', 'The Enforcer',
    'Arcane Master', 'Floor Lord', 'Elite Striker', 'Champion Echo'
  ];

  function generateTrainerName(type, floor) {
    if (type === FLOOR_TYPE.BOSS)
      return `${BOSS_NAMES[Math.floor(floor/10) % BOSS_NAMES.length]} (Floor ${floor})`;
    if (type === FLOOR_TYPE.ELITE)
      return `Elite ${TRAINER_NAMES[Math.floor(Math.random()*TRAINER_NAMES.length)]}`;
    if (type === FLOOR_TYPE.WILD) return 'Wild Battle';
    return TRAINER_NAMES[Math.floor(Math.random()*TRAINER_NAMES.length)];
  }

  // ─── Init ─────────────────────────────────────

  function init() {
    updateBestFloorDisplay();
    const savedFloor = SaveSystem.get().towerRun || 0;
    if (savedFloor > 1) {
      currentFloor = savedFloor;
      runParty     = _loadRunParty();
      const resumeBtn   = document.getElementById('tower-resume-btn');
      const resumeLabel = document.getElementById('tower-resume-floor');
      const enterBtn    = document.getElementById('tower-enter-btn');
      if (resumeBtn)   { resumeBtn.style.display = 'block'; resumeBtn.classList.remove('hidden'); }
      if (enterBtn)    enterBtn.style.display = 'none';
      if (resumeLabel) resumeLabel.textContent = `Resume Floor ${savedFloor}`;
      updateHUD();
    }
    _buildSlotCards();
  }

  /** Render the 3-slot cards in the tower menu. */
  function _buildSlotCards() {
    const grid = document.getElementById('tower-slots-grid');
    if (!grid) return;

    const slots      = SaveSystem.getTowerSlots();
    const bestFloor  = SaveSystem.getBestFloor();

    grid.innerHTML = slots.map((slot, idx) => {
      if (slot && slot.active) {
        // Active run slot
        const party  = slot.party || [];
        const partyHtml = party.map(m => {
          const d = POKEMON_DATA[m.key];
          return `<div class="ts-party-mon" title="${d?.name||m.key} Lv${m.level}">
            <img src="${d ? getSpriteUrl(d.id) : ''}" class="ts-party-sprite">
            <span class="ts-party-lv">Lv${m.level}</span>
          </div>`;
        }).join('');
        return `<div class="tower-slot-card tower-slot-active" data-idx="${idx}"
                     onclick="Tower._selectSlot(${idx})">
          <div class="ts-header">
            <span class="ts-label">Slot ${idx+1}</span>
            <span class="ts-floor">Floor ${slot.floor}</span>
          </div>
          <div class="ts-party">${partyHtml}</div>
          <div class="ts-actions">
            <button class="ts-btn ts-btn-resume" onclick="event.stopPropagation();Tower._selectSlot(${idx})">▶ Resume</button>
            <button class="ts-btn ts-btn-delete" onclick="event.stopPropagation();Tower._deleteSlot(${idx})">🗑</button>
          </div>
        </div>`;
      } else {
        // Empty slot
        return `<div class="tower-slot-card tower-slot-empty" data-idx="${idx}"
                     onclick="Tower._selectSlot(${idx})">
          <div class="ts-header">
            <span class="ts-label">Slot ${idx+1}</span>
            <span class="ts-floor">Empty</span>
          </div>
          <div class="ts-empty-icon">＋</div>
          <div class="ts-empty-hint">Start new run</div>
        </div>`;
      }
    }).join('');
  }

  let _selectedSlotIdx = -1;

  function _selectSlot(idx) {
    _selectedSlotIdx = idx;

    // Highlight selected card
    document.querySelectorAll('.tower-slot-card').forEach((el, i) => {
      el.classList.toggle('tower-slot-selected', i === idx);
    });

    const slot        = SaveSystem.getTowerSlot(idx);
    const leadSection = document.getElementById('tower-lead-section');
    const resumeBtn   = document.getElementById('tower-resume-btn');
    const resumeLabel = document.getElementById('tower-resume-floor');

    if (slot && slot.active) {
      // Existing run — show resume button
      if (leadSection)  leadSection.classList.add('hidden');
      if (resumeBtn)  { resumeBtn.classList.remove('hidden'); resumeBtn.style.display = 'block'; }
      if (resumeLabel)  resumeLabel.textContent = `Resume Slot ${idx+1} — Floor ${slot.floor}`;
    } else {
      // Empty slot — show lead picker
      if (resumeBtn)  { resumeBtn.classList.add('hidden'); resumeBtn.style.display = 'none'; }
      if (leadSection)  leadSection.classList.remove('hidden');
      _buildLeadPicker();
    }
  }

  function _deleteSlot(idx) {
    if (!confirm(`Delete Slot ${idx+1}? This run will be lost.`)) return;
    SaveSystem.clearTowerSlot(idx);
    _buildSlotCards();
    // Reset UI if the deleted slot was selected
    if (_selectedSlotIdx === idx) {
      _selectedSlotIdx = -1;
      const leadSection = document.getElementById('tower-lead-section');
      const resumeBtn   = document.getElementById('tower-resume-btn');
      if (leadSection) leadSection.classList.add('hidden');
      if (resumeBtn)   { resumeBtn.classList.add('hidden'); resumeBtn.style.display = 'none'; }
    }
  }

  let _leadSearch = '';
  let _leadTypeFilter = 'all';

  /** Render the lead picker with search + type filter. */
  function _buildLeadPicker() {
    const container = document.getElementById('tower-lead-picker');
    if (!container) return;
    delete container.dataset.needsRebuild;

    const unlocked = SaveSystem.getUnlocked()
      .filter(key => {
        const d = POKEMON_DATA[key];
        if (!d) return false;
        if (_leadSearch && !d.name.toLowerCase().includes(_leadSearch.toLowerCase())) return false;
        if (_leadTypeFilter !== 'all' && !d.types.includes(_leadTypeFilter)) return false;
        return true;
      })
      .sort((a,b) => POKEMON_DATA[a].id - POKEMON_DATA[b].id);

    const currentLead = _getSelectedLead();

    container.innerHTML = `
      <div class="tower-lead-search-row">
        <input type="text" id="tower-lead-search" class="tower-lead-search"
               placeholder="🔍 Search Pokémon..."
               value="${_leadSearch}"
               oninput="Tower._leadSearchInput(this.value)">
        <select class="tower-lead-type-filter" onchange="Tower._leadTypeFilter(this.value)">
          <option value="all">All types</option>
          ${['normal','fire','water','grass','electric','ice','fighting','poison',
             'ground','flying','psychic','bug','rock','ghost','dragon','dark','steel','fairy']
            .map(t => `<option value="${t}"${_leadTypeFilter===t?' selected':''}>${t.charAt(0).toUpperCase()+t.slice(1)}</option>`).join('')}
        </select>
      </div>
      <div class="tower-lead-count">${unlocked.length} Pokémon</div>
      <div class="tower-lead-grid" id="tower-lead-grid">
        ${unlocked.length === 0
          ? '<p class="tower-lead-empty">No Pokémon match.</p>'
          : unlocked.map(key => {
              const d    = POKEMON_DATA[key];
              const lv   = SaveSystem.getTowerLevel(key) || 5;
              const sel  = currentLead === key ? ' tower-lead-selected' : '';
              const hasS = SaveSystem.hasShiny(key);
              return `<div class="tower-lead-slot${sel}" data-key="${key}"
                           onclick="Tower._selectLead('${key}')">
                ${hasS ? '<span class="tls-shiny">✨</span>' : ''}
                <img src="${getSpriteUrl(d.id)}" class="tower-lead-sprite">
                <div class="tower-lead-types">
                  ${d.types.map(t=>`<span class="type-badge type-${t}">${t}</span>`).join('')}
                </div>
                <span class="tower-lead-name">${d.name}</span>
                <span class="tower-lead-lv">Lv ${lv}</span>
              </div>`;
            }).join('')
        }
      </div>`;
  }

  function _leadSearchInput(val) {
    _leadSearch = val;
    _buildLeadPicker();
  }

  function _setLeadTypeFilter(val) {  // called as Tower._leadTypeFilter from HTML
    _leadTypeFilter = val;
    _buildLeadPicker();
  }

  function _getSelectedLead() {
    return SaveSystem.get().towerSelectedLead
      || SaveSystem.getUnlocked()[0]
      || null;
  }

  function _selectLead(key) {
    SaveSystem.get().towerSelectedLead = key;
    SaveSystem.save();
    document.querySelectorAll('.tower-lead-slot').forEach(el => {
      el.classList.toggle('tower-lead-selected', el.dataset.key === key);
    });
  }

  function getSelectedLead() { return _getSelectedLead(); }
  function getSelectedSlotIdx() { return _selectedSlotIdx; }

  // ─── Public API ───────────────────────────────
  function refreshLeadPicker() {
    const container = document.getElementById('tower-lead-picker');
    if (container) container.dataset.needsRebuild = '1';
    _buildSlotCards();
    _buildLeadPicker();
  }

  return {
    init,
    refreshLeadPicker,
    getActiveSlot, setActiveSlot,
    getSelectedSlotIdx,
    _selectSlot, _deleteSlot,
    _leadSearchInput, _leadTypeFilter: _setLeadTypeFilter,
    startRun,
    advanceFloor,
    endRun,
    resumeRun,
    generateFloor,
    getCurrentFloor,
    getIsActive,
    isEggFloor,
    rollEgg,
    setPendingEgg,
    getPendingEgg,
    clearPendingEgg,
    buildRunParty,
    syncPartyLevels,
    addHatchedToParty,
    getRunParty,
    getPartySize,
    getSelectedLead,
    RARITY,
    RARITY_ORDER,
    _selectLead,
  };

})();
