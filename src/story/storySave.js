// ═══════════════════════════════════════════════════
//  src/story/storySave.js
//  Story mode save state — completely separate from
//  the quick battle / tower save data.
//
//  Writes into SaveSystem.get().story so everything
//  persists in one localStorage entry.
//
//  Story party is INDEPENDENT of the Team Builder.
//  The player's story team starts with just their
//  starter and grows as they catch / receive Pokémon.
//  Each party member tracks its own level separately
//  from quick battle levels.
//
//  Party member structure:
//  {
//    key:   string,   // pokemon key e.g. 'bulbasaur'
//    level: number,   // story-mode level (starts at 5)
//    xp:    number,   // current xp within this level
//  }
// ═══════════════════════════════════════════════════

const StorySave = (() => {

  const DEFAULTS = {
    started:      false,
    starterKey:   null,
    playerName:   'Red',
    rivalName:    'Blue',
    gender:       'male',    // 'male' | 'female'
    money:        3000,      // starting money (₽)
    badges:       [false,false,false,false,false,false,false,false],
    location:     'palletTown',
    defeatedNPCs: [],
    flags:        {},
    party: [],
  };

  // ── Internal ───────────────────────────────────

  function _get() {
    const root = SaveSystem.get();
    if (!root.story) {
      root.story = {
        ...DEFAULTS,
        badges:       [...DEFAULTS.badges],
        defeatedNPCs: [],
        flags:        {},
        party:        [],
      };
    }
    // Migrate saves that predate the party field
    if (!root.story.party)  root.story.party  = [];
    if (!root.story.gender) root.story.gender = 'male';
    if (root.story.money === undefined) root.story.money = 3000;
    return root.story;
  }

  function _flush() { SaveSystem.save(); }

  // ── Getters ────────────────────────────────────

  function hasStarted()    { return !!_get().started; }
  function getStarterKey() { return _get().starterKey; }
  function getPlayerName() { return _get().playerName || 'Red'; }
  function getRivalName()  { return _get().rivalName  || 'Blue'; }
  function getGender()     { return _get().gender || 'male'; }
  function getLocation()   { return _get().location   || 'palletTown'; }
  function getBadges()     { return _get().badges; }
  function getBadgeCount() { return _get().badges.filter(Boolean).length; }
  function getFlag(key)    { return _get().flags[key]; }
  function getParty()      { return _get().party; }
  function getMoney()      { return _get().money ?? 3000; }

  // ── Party management ───────────────────────────

  /**
   * Get a party member by pokemon key.
   * Returns { key, level, xp } or null.
   */
  function getPartyMember(key) {
    return _get().party.find(m => m.key === key) || null;
  }

  /**
   * Add a pokemon to the story party (max 6).
   * If already in party, does nothing.
   * @param {string} key    - pokemon key
   * @param {number} level  - starting level (default 5)
   */
  function addToParty(key, level = 5) {
    const party = _get().party;
    if (party.length >= 6) return false;
    if (party.find(m => m.key === key)) return false;
    party.push({ key, level, xp: 0 });
    _flush();
    return true;
  }

  /**
   * Update a party member's level and xp after battle.
   */
  function updatePartyMember(key, level, xp) {
    const member = getPartyMember(key);
    if (member) {
      member.level = level;
      member.xp    = xp || 0;
      _flush();
    }
  }

  /**
   * Build the story party as pokemon instances ready for battle.
   * Falls back to just the starter at level 5 if party is empty.
   * @returns {object[]} array of pokemon instances
   */
  function buildBattleParty() {
    const party = _get().party;

    if (party.length === 0) {
      // Shouldn't happen after beginStory, but be safe
      const sk = _get().starterKey;
      if (!sk) return [];
      return [createPokemonInstance(sk, 5)].filter(Boolean);
    }

    return party
      .map(m => {
        const inst = createPokemonInstance(m.key, m.level);
        if (inst && m.xp) inst.xp = m.xp;
        return inst;
      })
      .filter(Boolean);
  }

  /**
   * Sync party levels/xp back from live battle instances.
   * Called after a story battle ends.
   * @param {object[]} instances - live pokemon instances from battle
   */
  function syncPartyFromBattle(instances) {
    const party = _get().party;
    let changed = false;
    for (const inst of instances) {
      const member = party.find(m => m.key === inst._storyKey || m.key === inst.key?.toLowerCase());
      if (member) {
        member.level = inst.level || member.level;
        member.xp    = inst.xp   || 0;
        changed = true;
      }
    }
    if (changed) _flush();
  }

  // ── Setters ────────────────────────────────────

  function beginStory(starterKey, playerName, rivalName, gender) {
    const s = _get();
    s.started      = true;
    s.starterKey   = starterKey;
    s.playerName   = (playerName || 'Red').trim()  || 'Red';
    s.rivalName    = (rivalName  || 'Blue').trim() || 'Blue';
    s.gender       = gender || 'male';
    s.money        = 3000;
    s.location     = 'palletTown';
    s.badges       = [false,false,false,false,false,false,false,false];
    s.defeatedNPCs = [];
    s.flags        = {};
    s.party        = [{ key: starterKey, level: 5, xp: 0 }];
    SaveSystem.unlockPokemon(starterKey);
    SaveSystem.addItem('pokeball', 10);   // start with 10 Poké Balls
    _flush();
  }

  function addMoney(amount) {
    _get().money = Math.max(0, (_get().money ?? 3000) + amount);
    _flush();
  }

  function spendMoney(amount) {
    const current = _get().money ?? 0;
    if (current < amount) return false;
    _get().money = current - amount;
    _flush();
    return true;
  }

  function setLocation(mapId) { _get().location = mapId; _flush(); }

  function earnBadge(idx) {
    if (idx >= 0 && idx <= 7) { _get().badges[idx] = true; _flush(); }
  }

  function defeatNPC(id) {
    const arr = _get().defeatedNPCs;
    if (!arr.includes(id)) { arr.push(id); _flush(); }
  }

  function hasDefeatedNPC(id) { return _get().defeatedNPCs.includes(id); }

  function setFlag(key, val) { _get().flags[key] = val; _flush(); }

  function resetStory() {
    SaveSystem.get().story = {
      ...DEFAULTS,
      badges:       [...DEFAULTS.badges],
      defeatedNPCs: [],
      flags:        {},
      party:        [],
    };
    _flush();
  }

  return {
    hasStarted, getStarterKey, getPlayerName, getRivalName,
    getGender, getMoney, addMoney, spendMoney,
    getLocation, getBadges, getBadgeCount, getFlag,
    getParty, getPartyMember, addToParty, updatePartyMember,
    buildBattleParty, syncPartyFromBattle,
    beginStory, setLocation, earnBadge,
    defeatNPC, hasDefeatedNPC, setFlag, resetStory,
  };

})();
