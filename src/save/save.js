// ═══════════════════════════════════════════════════
//  src/save/save.js   (Part 2)
//  Centralised save/load system using localStorage.
//  Everything in one place so no data gets out of sync.
//
//  Save data structure:
//  {
//    version      : number      (for future migration)
//    team         : string[]    (Pokémon keys)
//    unlocked     : string[]    (Pokémon keys)
//    bestFloor    : number
//    towerRun     : number      (current floor if mid-run)
//    inventory    : { itemKey: count, ... }
//    playtime     : number      (ms)
//    lastSaved    : timestamp
//  }
// ═══════════════════════════════════════════════════

const SaveSystem = (() => {

  const SAVE_KEY    = 'pokearena_save';
  const SAVE_VERSION = 2;

  // Default/blank save
  const DEFAULTS = {
    version:   SAVE_VERSION,
    team:      [],
    unlocked:  ['bulbasaur','charmander','squirtle','pikachu','eevee'],
    bestFloor: 0,
    towerRun:  0,
    pokemonLevels: {},   // key → level earned through the tower
    inventory: {
      potion:       3,    superPotion:  1,    hyperPotion:  0,
      maxPotion:    0,    fullRestore:  0,    freshWater:   0,
      sodaPop:      0,    lemonade:     0,    moomooMilk:   0,
      antidote:     2,    burnHeal:     1,    iceHeal:      0,
      awakening:    1,    parlyzHeal:   1,    fullHeal:     0,
      ether:        0,    maxEther:     0,    elixir:       0,
      maxElixir:    0,    revive:       1,    maxRevive:    0,
      fullRevive:   0,    revivalHerb:  0,
      xAttack:      1,    xDefense:     0,    xSpeed:       1,
      xSpecial:     0,    xSpDef:       0,    xAccuracy:    0,
      guardSpec:    0,    direHit:      0,
      pokeball:     5,    greatball:    0,    ultraball:    0,
      firestone:    0,    waterstone:   0,    thunderstone: 0,
      leafstone:    0,    moonstone:    0,    rareCandy:    0,
    },
    // Tower run save slots (3 independent runs)
    towerSlots: [null, null, null],
    // Shiny unlocks: Set of pokemon keys
    shinies: [],
    // Per-pokemon held items for quick battle (key → itemKey)
    heldItems: {},
    playtime:  0,
    lastSaved: null
  };

  let _data      = null;
  let _sessionStart = Date.now();

  // ─── Core load/save ───────────────────────────
  function load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) {
        _data = { ...DEFAULTS, unlocked: [...DEFAULTS.unlocked], inventory: { ...DEFAULTS.inventory } };
        return _data;
      }
      const parsed = JSON.parse(raw);
      // Migrate older saves forward
      _data = migrate(parsed);
      return _data;
    } catch (e) {
      console.warn('Save load failed, starting fresh:', e);
      _data = { ...DEFAULTS, unlocked: [...DEFAULTS.unlocked], inventory: { ...DEFAULTS.inventory } };
      return _data;
    }
  }

  function save() {
    if (!_data) return;
    _data.playtime += Date.now() - _sessionStart;
    _sessionStart   = Date.now();
    _data.lastSaved = Date.now();
    _data.version   = SAVE_VERSION;
    localStorage.setItem(SAVE_KEY, JSON.stringify(_data));
  }

  function reset() {
    localStorage.removeItem(SAVE_KEY);
    _data = { ...DEFAULTS, unlocked: [...DEFAULTS.unlocked], inventory: { ...DEFAULTS.inventory } };
    return _data;
  }

  function migrate(parsed) {
    // v1 → v2: add inventory if missing
    if (!parsed.inventory) {
      parsed.inventory = { ...DEFAULTS.inventory };
    }
    // v2 → v3: add pokemonLevels if missing
    if (!parsed.pokemonLevels) {
      parsed.pokemonLevels = {};
    }
    // v3 → v4: add tower save slots
    if (!parsed.towerSlots) {
      parsed.towerSlots = [null, null, null];
    }
    // v4 → v5: shinies and heldItems
    if (!parsed.shinies)    parsed.shinies    = [];
    if (!parsed.heldItems)  parsed.heldItems  = {};
    parsed.version = SAVE_VERSION;
    return { ...DEFAULTS, ...parsed };
  }

  // ─── Accessors ────────────────────────────────
  function get() {
    if (!_data) load();
    return _data;
  }

  function getTeam()      { return get().team; }
  function getUnlocked()  { return get().unlocked; }
  function getBestFloor() { return get().bestFloor; }
  function getInventory() { return get().inventory; }
  function getPokemonLevels() { return get().pokemonLevels || {}; }
  function getTowerLevel(key) { return (get().pokemonLevels || {})[key] || 5; }
  function setTowerLevel(key, level) {
    if (!get().pokemonLevels) get().pokemonLevels = {};
    get().pokemonLevels[key] = level;
    save();
  }

  function setTeam(arr) {
    get().team = arr;
    save();
  }

  function unlockPokemon(key) {
    const d = get();
    if (!d.unlocked.includes(key)) {
      d.unlocked.push(key);
      // Sync to POKEMON_DATA
      if (window.POKEMON_DATA?.[key]) POKEMON_DATA[key].unlocked = true;
      save();
      return true;
    }
    return false;
  }

  function setBestFloor(n) {
    const d = get();
    if (n > d.bestFloor) {
      d.bestFloor = n;
      save();
    }
  }

  function setTowerRun(floor) {
    get().towerRun = floor;
    save();
  }

  // ─── Inventory helpers ────────────────────────
  function getItemCount(key) {
    return get().inventory[key] ?? 0;
  }

  function addItem(key, amount = 1) {
    const inv = get().inventory;
    inv[key] = (inv[key] ?? 0) + amount;
    save();
  }

  function useItem(key) {
    const inv = get().inventory;
    if ((inv[key] ?? 0) <= 0) return false;
    inv[key]--;
    save();
    return true;
  }

  // ─── Playtime formatter ───────────────────────
  function getPlaytimeString() {
    const ms    = get().playtime + (Date.now() - _sessionStart);
    const secs  = Math.floor(ms / 1000);
    const mins  = Math.floor(secs / 60);
    const hours = Math.floor(mins / 60);
    return `${hours}h ${mins % 60}m ${secs % 60}s`;
  }

  // ── Shiny API ──────────────────────────────────
  function getShinies()          { return get().shinies || []; }
  function hasShiny(key)         { return (get().shinies || []).includes(key); }
  function unlockShiny(key) {
    if (!get().shinies) get().shinies = [];
    if (!get().shinies.includes(key)) {
      get().shinies.push(key);
      save();
      return true;
    }
    return false;
  }
  function lockShiny(key) {
    if (!get().shinies) return;
    get().shinies = get().shinies.filter(k => k !== key);
    save();
  }

  // ── Held items (quick battle per-pokemon) ───────
  function getHeldItems()        { return get().heldItems || {}; }
  function getHeldItem(key)      { return (get().heldItems || {})[key] || null; }
  function setHeldItem(key, item) {
    if (!get().heldItems) get().heldItems = {};
    get().heldItems[key] = item;
    save();
  }
  function clearHeldItem(key) {
    if (!get().heldItems) return;
    delete get().heldItems[key];
    save();
  }

  // ── Tower slot API ─────────────────────────────
  function getTowerSlots() {
    return get().towerSlots || [null, null, null];
  }

  function getTowerSlot(idx) {
    return (get().towerSlots || [null,null,null])[idx] || null;
  }

  function saveTowerSlot(idx, slotData) {
    if (!get().towerSlots) get().towerSlots = [null,null,null];
    get().towerSlots[idx] = slotData;
    save();
  }

  function clearTowerSlot(idx) {
    if (!get().towerSlots) get().towerSlots = [null,null,null];
    get().towerSlots[idx] = null;
    save();
  }

  function getActiveTowerSlot() {
    return (get().towerSlots || [null,null,null]).findIndex(s => s && s.active);
  }

  return {
    load, save, reset, get,
    getTeam, getUnlocked, getBestFloor, getInventory,
    getPokemonLevels, getTowerLevel, setTowerLevel,
    setTeam, unlockPokemon, setBestFloor, setTowerRun,
    getItemCount, addItem, useItem,
    getPlaytimeString,
    getTowerSlots, getTowerSlot, saveTowerSlot, clearTowerSlot, getActiveTowerSlot,
    getShinies, hasShiny, unlockShiny, lockShiny,
    getHeldItems, getHeldItem, setHeldItem, clearHeldItem,
  };

})();
