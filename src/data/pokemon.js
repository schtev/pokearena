// ═══════════════════════════════════════════════════
//  src/data/pokemon.js
//  Pokémon definitions — stats, types, learnset
//  Sprites pulled live from PokeAPI's GitHub CDN
//  Add more entries following the same structure!
// ═══════════════════════════════════════════════════

const SPRITE_BASE      = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon';
const SPRITE_BACK_BASE = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/back';

/**
 * Get front sprite URL for a given Pokédex ID
 * @param {number} id
 */
function getSpriteUrl(id) {
  return `${SPRITE_BASE}/${id}.png`;
}

/**
 * Get back sprite URL (used for player's Pokémon in battle)
 * @param {number} id
 */
function getBackSpriteUrl(id) {
  return `${SPRITE_BACK_BASE}/${id}.png`;
}

/**
 * Pokémon template — every entry needs:
 *   id       : National Pokédex number (used for sprites)
 *   name     : Display name
 *   types    : Array of 1–2 type strings
 *   baseStats: { hp, attack, defense, spatk, spdef, speed }
 *   moves    : Array of move-name strings (must exist in MOVES_DATA)
 *   unlocked : Whether the player starts with this Pokémon
 */
const POKEMON_DATA = {

  // ── Starters & Classics ──────────────────────────
  bulbasaur: {
    id: 1, name: 'Bulbasaur',
    types: ['grass','poison'],
    baseStats: { hp:45, attack:49, defense:49, spatk:65, spdef:65, speed:45 },
    moves: ['tackle','vineWhip','razorLeaf','growl'],
    unlocked: true
  },
  ivysaur: {
    id: 2, name: 'Ivysaur',
    types: ['grass','poison'],
    baseStats: { hp:60, attack:62, defense:63, spatk:80, spdef:80, speed:60 },
    moves: ['vineWhip','razorLeaf','poisonPowder','growl'],
    unlocked: false
  },
  venusaur: {
    id: 3, name: 'Venusaur',
    types: ['grass','poison'],
    baseStats: { hp:80, attack:82, defense:83, spatk:100, spdef:100, speed:80 },
    moves: ['razorLeaf','solarBeam','earthquake','synthesis'],
    unlocked: false
  },
  charmander: {
    id: 4, name: 'Charmander',
    types: ['fire'],
    baseStats: { hp:39, attack:52, defense:43, spatk:60, spdef:50, speed:65 },
    moves: ['scratch','ember','growl','dragonRage'],
    unlocked: true
  },
  charmeleon: {
    id: 5, name: 'Charmeleon',
    types: ['fire'],
    baseStats: { hp:58, attack:64, defense:58, spatk:80, spdef:65, speed:80 },
    moves: ['ember','flamethrower','slash','dragonRage'],
    unlocked: false
  },
  charizard: {
    id: 6, name: 'Charizard',
    types: ['fire','flying'],
    baseStats: { hp:78, attack:84, defense:78, spatk:109, spdef:85, speed:100 },
    moves: ['flamethrower','airSlash','dragonClaw','earthquake'],
    unlocked: false
  },
  squirtle: {
    id: 7, name: 'Squirtle',
    types: ['water'],
    baseStats: { hp:44, attack:48, defense:65, spatk:50, spdef:64, speed:43 },
    moves: ['tackle','waterGun','withdraw','bubble'],
    unlocked: true
  },
  wartortle: {
    id: 8, name: 'Wartortle',
    types: ['water'],
    baseStats: { hp:59, attack:63, defense:80, spatk:65, spdef:80, speed:58 },
    moves: ['waterGun','bite','withdraw','iceBeam'],
    unlocked: false
  },
  blastoise: {
    id: 9, name: 'Blastoise',
    types: ['water'],
    baseStats: { hp:79, attack:83, defense:100, spatk:85, spdef:105, speed:78 },
    moves: ['hydroPump','iceBeam','earthquake','ironDefense'],
    unlocked: false
  },
  pikachu: {
    id: 25, name: 'Pikachu',
    types: ['electric'],
    baseStats: { hp:35, attack:55, defense:40, spatk:50, spdef:50, speed:90 },
    moves: ['thunderbolt','quickAttack','ironTail','thunder'],
    unlocked: true
  },
  raichu: {
    id: 26, name: 'Raichu',
    types: ['electric'],
    baseStats: { hp:60, attack:90, defense:55, spatk:90, spdef:80, speed:110 },
    moves: ['thunder','thunderbolt','quickAttack','ironTail'],
    unlocked: false
  },
  gengar: {
    id: 94, name: 'Gengar',
    types: ['ghost','poison'],
    baseStats: { hp:60, attack:65, defense:60, spatk:130, spdef:75, speed:110 },
    moves: ['shadowBall','sludgeBomb','thunderbolt','darkPulse'],
    unlocked: false
  },
  machamp: {
    id: 68, name: 'Machamp',
    types: ['fighting'],
    baseStats: { hp:90, attack:130, defense:80, spatk:65, spdef:85, speed:55 },
    moves: ['closeCombat','crossChop','earthquake','stonEdge'],
    unlocked: false
  },
  lapras: {
    id: 131, name: 'Lapras',
    types: ['water','ice'],
    baseStats: { hp:130, attack:85, defense:80, spatk:85, spdef:95, speed:60 },
    moves: ['iceBeam','surf','thunderbolt','sing'],
    unlocked: false
  },
  dragonite: {
    id: 149, name: 'Dragonite',
    types: ['dragon','flying'],
    baseStats: { hp:91, attack:134, defense:95, spatk:100, spdef:100, speed:80 },
    moves: ['dragonClaw','extremeSpeed','fireBlast','thunder'],
    unlocked: false
  },
  mewtwo: {
    id: 150, name: 'Mewtwo',
    types: ['psychic'],
    baseStats: { hp:106, attack:110, defense:90, spatk:154, spdef:90, speed:130 },
    moves: ['psychic','shadowBall','iceBeam','thunderbolt'],
    unlocked: false
  },
  eevee: {
    id: 133, name: 'Eevee',
    types: ['normal'],
    baseStats: { hp:55, attack:55, defense:50, spatk:45, spdef:65, speed:55 },
    moves: ['tackle','quickAttack','bite','growl'],
    unlocked: true
  },
  snorlax: {
    id: 143, name: 'Snorlax',
    types: ['normal'],
    baseStats: { hp:160, attack:110, defense:65, spatk:65, spdef:110, speed:30 },
    moves: ['bodySlam','earthquake','iceBeam','rest'],
    unlocked: false
  },
  lucario: {
    id: 448, name: 'Lucario',
    types: ['fighting','steel'],
    baseStats: { hp:70, attack:110, defense:70, spatk:115, spdef:70, speed:90 },
    moves: ['closeCombat','auraSpherePsychic','ironTail','shadowBall'],
    unlocked: false
  },
  garchomp: {
    id: 445, name: 'Garchomp',
    types: ['dragon','ground'],
    baseStats: { hp:108, attack:130, defense:95, spatk:80, spdef:85, speed:102 },
    moves: ['dragonClaw','earthquake','stonEdge','swordsDance'],
    unlocked: false
  }
};

/**
 * Build a battle-ready Pokémon instance at a given level.
 * Calculates actual HP from base stats + level.
 * 
 * @param {string} key    - Key in POKEMON_DATA (e.g. 'pikachu')
 * @param {number} level  - Level (1–100), default 50
 * @returns {object}      - Battle instance
 */
function createPokemonInstance(key, level = 50) {
  const template = POKEMON_DATA[key];
  if (!template) { console.error(`No Pokémon found: ${key}`); return null; }

  const bs = template.baseStats;

  // Simplified stat formula (no EVs/IVs for now — add later!)
  const calcStat = (base) => Math.floor(((2 * base * level) / 100) + 5);
  const maxHP    = Math.floor(((2 * bs.hp * level) / 100) + level + 10);

  // Build move instances with current PP
  const moves = template.moves.map(moveName => {
    const moveData = MOVES_DATA[moveName];
    if (!moveData) { console.warn(`Move not found: ${moveName}`); return null; }
    return { ...moveData, id: moveName, currentPP: moveData.pp };
  }).filter(Boolean);

  return {
    key,
    id:       template.id,
    name:     template.name,
    types:    [...template.types],
    level,
    maxHP,
    currentHP: maxHP,
    stats: {
      attack:  calcStat(bs.attack),
      defense: calcStat(bs.defense),
      spatk:   calcStat(bs.spatk),
      spdef:   calcStat(bs.spdef),
      speed:   calcStat(bs.speed)
    },
    moves,
    // Status: null | 'paralyzed' | 'burned' | 'poisoned' | 'frozen' | 'asleep'
    status: null,
    // Stat stages: -6 to +6
    stages: { attack:0, defense:0, spatk:0, spdef:0, speed:0 },
    spriteUrl:     getSpriteUrl(template.id),
    backSpriteUrl: getBackSpriteUrl(template.id)
  };
}

/**
 * Get all unlocked Pokémon as an array of keys
 */
function getUnlockedPokemon() {
  // In Part 4 this will read from localStorage.
  // For now, read from the data directly.
  return Object.keys(POKEMON_DATA).filter(k => POKEMON_DATA[k].unlocked);
}

/**
 * Unlock a Pokémon (called when tower rewards are given)
 * @param {string} key
 */
function unlockPokemon(key) {
  if (POKEMON_DATA[key]) {
    POKEMON_DATA[key].unlocked = true;
    console.log(`🎉 Unlocked: ${POKEMON_DATA[key].name}!`);
  }
}
