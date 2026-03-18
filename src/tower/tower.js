// ═══════════════════════════════════════════════════
//  src/tower/tower.js
//  Infinite Tower — floor generation, enemy teams,
//  and Pokémon unlock rewards.
// ═══════════════════════════════════════════════════

const Tower = (() => {

  // State
  let currentFloor = 1;
  let bestFloor    = 0;
  let isActive     = false;

  // Pokémon available to spawn as enemies, grouped by "tier"
  // Tier 0 = floors 1–9, Tier 1 = 10–29, etc.
  const ENEMY_POOL = {
    0: ['bulbasaur','charmander','squirtle','pikachu','eevee'],
    1: ['ivysaur','charmeleon','wartortle','raichu','eevee','snorlax'],
    2: ['venusaur','charizard','blastoise','lapras','gengar','machamp'],
    3: ['dragonite','gengar','lapras','machamp','snorlax','lucario'],
    4: ['mewtwo','dragonite','garchomp','lucario','gengar','charizard']
  };

  // Reward pool: beating a floor may unlock one of these
  const REWARD_POOL = {
    0: ['ivysaur','charmeleon','wartortle','raichu'],
    1: ['venusaur','charizard','blastoise','gengar','machamp'],
    2: ['lapras','dragonite','snorlax','lucario'],
    3: ['garchomp','mewtwo']
  };

  // Floor types: affects enemy composition and reward
  const FLOOR_TYPE = {
    WILD:    'wild',
    TRAINER: 'trainer',
    ELITE:   'elite',
    BOSS:    'boss'
  };

  // ─── Floor generation ─────────────────────────
  /**
   * Determine the type of a given floor.
   * Pattern: Boss every 10 floors, Elite every 5 (not boss), else Trainer or Wild.
   * @param {number} n
   */
  function getFloorType(n) {
    if (n % 10 === 0) return FLOOR_TYPE.BOSS;
    if (n % 5  === 0) return FLOOR_TYPE.ELITE;
    if (n % 3  === 0) return FLOOR_TYPE.TRAINER;
    return FLOOR_TYPE.WILD;
  }

  /**
   * Pick a random Pokémon key from the enemy pool for a given tier.
   * @param {number} tier
   * @returns {string}
   */
  function randomEnemyKey(tier) {
    const pool = ENEMY_POOL[Math.min(tier, 4)];
    return pool[Math.floor(Math.random() * pool.length)];
  }

  /**
   * Generate an enemy team for a given floor.
   * @param {number} floorNumber
   * @returns {object[]} Array of Pokémon instances
   */
  function generateEnemyTeam(floorNumber) {
    const type = getFloorType(floorNumber);
    const tier = Math.floor(floorNumber / 10);

    // Level scales with floor: 10 + floor × 1.5, capped at 100
    const baseLevel = Math.min(100, Math.floor(10 + floorNumber * 1.5));
    const levelRange = 3; // ±3 levels for variety

    let teamSize;
    switch (type) {
      case FLOOR_TYPE.BOSS:    teamSize = 6; break;
      case FLOOR_TYPE.ELITE:   teamSize = 4; break;
      case FLOOR_TYPE.TRAINER: teamSize = Math.min(3, 1 + Math.floor(floorNumber / 5)); break;
      default:                 teamSize = 1; break; // WILD
    }

    const team = [];
    for (let i = 0; i < teamSize; i++) {
      const key    = randomEnemyKey(tier);
      const level  = Math.max(5, baseLevel + Math.floor(Math.random() * levelRange * 2) - levelRange);
      const pkmn   = createPokemonInstance(key, level);
      if (pkmn) team.push(pkmn);
    }

    return team;
  }

  /**
   * Generate the full floor data object.
   * @param {number} floorNumber
   */
  function generateFloor(floorNumber) {
    const type      = getFloorType(floorNumber);
    const tier      = Math.floor(floorNumber / 10);
    const enemyTeam = generateEnemyTeam(floorNumber);
    const reward    = generateReward(tier, floorNumber);

    return {
      floorNumber,
      type,
      enemyTeam,
      reward,
      trainerName: generateTrainerName(type, floorNumber)
    };
  }

  // ─── Rewards ──────────────────────────────────
  /**
   * Pick a reward Pokémon to unlock.
   * Boss floors always give a reward; others have a 60% chance.
   * @param {number} tier
   * @param {number} floorNumber
   * @returns {object|null} { key, name } or null
   */
  function generateReward(tier, floorNumber) {
    const type = getFloorType(floorNumber);
    const isBoss = type === FLOOR_TYPE.BOSS;

    if (!isBoss && Math.random() > 0.6) return null;

    const pool = REWARD_POOL[Math.min(tier, 3)];

    // Only offer Pokémon the player doesn't have yet
    const available = pool.filter(key =>
      POKEMON_DATA[key] && !POKEMON_DATA[key].unlocked
    );

    if (available.length === 0) return null;

    const key = available[Math.floor(Math.random() * available.length)];
    return { key, name: POKEMON_DATA[key]?.name };
  }

  // ─── Flavour ──────────────────────────────────
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
    if (type === FLOOR_TYPE.BOSS) {
      return `${BOSS_NAMES[Math.floor(floor / 10) % BOSS_NAMES.length]} (Floor ${floor})`;
    }
    if (type === FLOOR_TYPE.ELITE) {
      return `Elite ${TRAINER_NAMES[Math.floor(Math.random() * TRAINER_NAMES.length)]}`;
    }
    if (type === FLOOR_TYPE.WILD) {
      return 'Wild Battle';
    }
    return TRAINER_NAMES[Math.floor(Math.random() * TRAINER_NAMES.length)];
  }

  // ─── Session management ───────────────────────
  function startRun() {
    currentFloor = 1;
    isActive     = true;
    SaveSystem.setTowerRun(1);
    updateHUD();
  }

  function advanceFloor() {
    currentFloor++;
    if (currentFloor > bestFloor) {
      bestFloor = currentFloor;
      SaveSystem.setBestFloor(bestFloor);
    }
    SaveSystem.setTowerRun(currentFloor);
    updateHUD();
  }

  function endRun() {
    isActive = false;
    SaveSystem.setTowerRun(0);
    updateBestFloorDisplay();
  }

  /** Resume a run that was interrupted (e.g. page refresh mid-tower) */
  function resumeRun() {
    const saved = SaveSystem.get().towerRun || 0;
    if (saved > 1) {
      currentFloor = saved;
      isActive     = true;
      updateHUD();
      return true;   // caller knows there's a run to resume
    }
    return false;
  }

  function getCurrentFloor() { return currentFloor; }
  function getIsActive()     { return isActive; }

  function updateHUD() {
    const hudFloor = document.getElementById('tower-floor-num');
    const curFloor = document.getElementById('current-floor');
    if (hudFloor) hudFloor.textContent = currentFloor;
    if (curFloor) curFloor.textContent = `Floor ${currentFloor}`;
  }

  function updateBestFloorDisplay() {
    bestFloor = SaveSystem.getBestFloor() || 0;
    const el = document.getElementById('best-floor');
    if (el) el.textContent = bestFloor > 0 ? `Floor ${bestFloor}` : '—';
  }

  function init() {
    updateBestFloorDisplay();
    // Check for an interrupted run
    const savedFloor = SaveSystem.get().towerRun || 0;
    if (savedFloor > 1) {
      currentFloor = savedFloor;
      // Show "resume" button on tower menu
      const resumeBtn = document.getElementById('tower-resume-btn');
      if (resumeBtn) resumeBtn.classList.remove('hidden');
      const resumeLabel = document.getElementById('tower-resume-floor');
      if (resumeLabel) resumeLabel.textContent = `Resume Floor ${savedFloor}`;
      updateHUD();
    }
  }

  // ─── Public API ───────────────────────────────
  return {
    init,
    startRun,
    advanceFloor,
    endRun,
    resumeRun,
    generateFloor,
    getCurrentFloor,
    getIsActive
  };

})();
