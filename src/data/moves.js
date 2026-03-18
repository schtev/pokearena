// ═══════════════════════════════════════════════════
//  src/data/moves.js
//  Move definitions + full Gen 6 type chart
// ═══════════════════════════════════════════════════

/**
 * Move structure:
 *   name     : Display name
 *   type     : Type string (matches type chart keys)
 *   category : 'physical' | 'special' | 'status'
 *   power    : Base power (0 for status moves)
 *   accuracy : 0–100 (100 = always hits)
 *   pp       : Max PP
 *   effect   : Optional effect string for future use
 */
const MOVES_DATA = {

  // ── Normal ──────────────────────────────────────
  tackle: {
    name:'Tackle', type:'normal', category:'physical',
    power:40, accuracy:100, pp:35
  },
  scratch: {
    name:'Scratch', type:'normal', category:'physical',
    power:40, accuracy:100, pp:35
  },
  bodySlam: {
    name:'Body Slam', type:'normal', category:'physical',
    power:85, accuracy:100, pp:15, effect:'paralysis_20'
  },
  hyperBeam: {
    name:'Hyper Beam', type:'normal', category:'special',
    power:150, accuracy:90, pp:5, effect:'recharge'
  },
  quickAttack: {
    name:'Quick Attack', type:'normal', category:'physical',
    power:40, accuracy:100, pp:30, priority:1
  },
  extremeSpeed: {
    name:'ExtremeSpeed', type:'normal', category:'physical',
    power:80, accuracy:100, pp:5, priority:2
  },
  sing: {
    name:'Sing', type:'normal', category:'status',
    power:0, accuracy:55, pp:15, effect:'sleep'
  },
  rest: {
    name:'Rest', type:'psychic', category:'status',
    power:0, accuracy:100, pp:10, effect:'rest'
  },

  // ── Fire ────────────────────────────────────────
  ember: {
    name:'Ember', type:'fire', category:'special',
    power:40, accuracy:100, pp:25, effect:'burn_10'
  },
  flamethrower: {
    name:'Flamethrower', type:'fire', category:'special',
    power:90, accuracy:100, pp:15, effect:'burn_10'
  },
  fireBlast: {
    name:'Fire Blast', type:'fire', category:'special',
    power:110, accuracy:85, pp:5, effect:'burn_10'
  },

  // ── Water ────────────────────────────────────────
  bubble: {
    name:'Bubble', type:'water', category:'special',
    power:40, accuracy:100, pp:30
  },
  waterGun: {
    name:'Water Gun', type:'water', category:'special',
    power:40, accuracy:100, pp:25
  },
  surf: {
    name:'Surf', type:'water', category:'special',
    power:90, accuracy:100, pp:15
  },
  hydroPump: {
    name:'Hydro Pump', type:'water', category:'special',
    power:110, accuracy:80, pp:5
  },

  // ── Grass ────────────────────────────────────────
  vineWhip: {
    name:'Vine Whip', type:'grass', category:'physical',
    power:45, accuracy:100, pp:25
  },
  razorLeaf: {
    name:'Razor Leaf', type:'grass', category:'physical',
    power:55, accuracy:95, pp:25
  },
  solarBeam: {
    name:'Solar Beam', type:'grass', category:'special',
    power:120, accuracy:100, pp:10, effect:'charge'
  },
  synthesis: {
    name:'Synthesis', type:'grass', category:'status',
    power:0, accuracy:100, pp:5, effect:'heal_50'
  },

  // ── Electric ─────────────────────────────────────
  thunderbolt: {
    name:'Thunderbolt', type:'electric', category:'special',
    power:90, accuracy:100, pp:15, effect:'paralysis_10'
  },
  thunder: {
    name:'Thunder', type:'electric', category:'special',
    power:110, accuracy:70, pp:10, effect:'paralysis_30'
  },
  ironTail: {
    name:'Iron Tail', type:'steel', category:'physical',
    power:100, accuracy:75, pp:15, effect:'def_down_30'
  },

  // ── Ice ──────────────────────────────────────────
  iceBeam: {
    name:'Ice Beam', type:'ice', category:'special',
    power:90, accuracy:100, pp:10, effect:'freeze_10'
  },
  blizzard: {
    name:'Blizzard', type:'ice', category:'special',
    power:110, accuracy:70, pp:5, effect:'freeze_10'
  },

  // ── Fighting ─────────────────────────────────────
  closeCombat: {
    name:'Close Combat', type:'fighting', category:'physical',
    power:120, accuracy:100, pp:5, effect:'defspdef_down'
  },
  crossChop: {
    name:'Cross Chop', type:'fighting', category:'physical',
    power:100, accuracy:80, pp:5
  },

  // ── Poison ───────────────────────────────────────
  sludgeBomb: {
    name:'Sludge Bomb', type:'poison', category:'special',
    power:90, accuracy:100, pp:10, effect:'poison_30'
  },
  poisonPowder: {
    name:'PoisonPowder', type:'poison', category:'status',
    power:0, accuracy:75, pp:35, effect:'poison'
  },

  // ── Ground ───────────────────────────────────────
  earthquake: {
    name:'Earthquake', type:'ground', category:'physical',
    power:100, accuracy:100, pp:10
  },
  stonEdge: {
    name:'Stone Edge', type:'rock', category:'physical',
    power:100, accuracy:80, pp:5
  },

  // ── Psychic ──────────────────────────────────────
  psychic: {
    name:'Psychic', type:'psychic', category:'special',
    power:90, accuracy:100, pp:10, effect:'spdef_down_10'
  },
  auraSpherePsychic: {
    name:'Aura Sphere', type:'fighting', category:'special',
    power:80, accuracy:999, pp:20   // never misses
  },

  // ── Ghost ────────────────────────────────────────
  shadowBall: {
    name:'Shadow Ball', type:'ghost', category:'special',
    power:80, accuracy:100, pp:15, effect:'spdef_down_20'
  },

  // ── Dragon ───────────────────────────────────────
  dragonClaw: {
    name:'Dragon Claw', type:'dragon', category:'physical',
    power:80, accuracy:100, pp:15
  },
  dragonRage: {
    name:'Dragon Rage', type:'dragon', category:'special',
    power:40, accuracy:100, pp:10
  },

  // ── Dark ─────────────────────────────────────────
  darkPulse: {
    name:'Dark Pulse', type:'dark', category:'special',
    power:80, accuracy:100, pp:15, effect:'flinch_20'
  },
  bite: {
    name:'Bite', type:'dark', category:'physical',
    power:60, accuracy:100, pp:25, effect:'flinch_30'
  },

  // ── Steel ────────────────────────────────────────
  ironDefense: {
    name:'Iron Defense', type:'steel', category:'status',
    power:0, accuracy:100, pp:15, effect:'def_up_2'
  },

  // ── Flying ───────────────────────────────────────
  airSlash: {
    name:'Air Slash', type:'flying', category:'special',
    power:75, accuracy:95, pp:15, effect:'flinch_30'
  },

  // ── Status / Utility ─────────────────────────────
  growl: {
    name:'Growl', type:'normal', category:'status',
    power:0, accuracy:100, pp:40, effect:'atk_down'
  },
  withdraw: {
    name:'Withdraw', type:'water', category:'status',
    power:0, accuracy:100, pp:40, effect:'def_up'
  },
  swordsDance: {
    name:'Swords Dance', type:'normal', category:'status',
    power:0, accuracy:100, pp:20, effect:'atk_up_2'
  },
  slash: {
    name:'Slash', type:'normal', category:'physical',
    power:70, accuracy:100, pp:20
  }
};

// ═══════════════════════════════════════════════════
//  TYPE EFFECTIVENESS CHART  (Gen 6+, 18 types)
//  typeChart[attackType][defenseType] = multiplier
//  Missing entries = 1× (neutral)
// ═══════════════════════════════════════════════════

const TYPE_CHART = {
  normal:   { rock:0.5, ghost:0, steel:0.5 },
  fire:     { fire:0.5, water:0.5, grass:2, ice:2, bug:2, rock:0.5, dragon:0.5, steel:2 },
  water:    { fire:2, water:0.5, grass:0.5, ground:2, rock:2, dragon:0.5 },
  electric: { water:2, electric:0.5, grass:0.5, ground:0, flying:2, dragon:0.5 },
  grass:    { fire:0.5, water:2, grass:0.5, poison:0.5, ground:2, flying:0.5, bug:0.5, rock:2, dragon:0.5, steel:0.5 },
  ice:      { fire:0.5, water:0.5, grass:2, ice:0.5, ground:2, flying:2, dragon:2, steel:0.5 },
  fighting: { normal:2, ice:2, poison:0.5, flying:0.5, psychic:0.5, bug:0.5, rock:2, ghost:0, dark:2, steel:2, fairy:0.5 },
  poison:   { grass:2, poison:0.5, ground:0.5, rock:0.5, ghost:0.5, steel:0, fairy:2 },
  ground:   { fire:2, electric:2, grass:0.5, poison:2, flying:0, bug:0.5, rock:2, steel:2 },
  flying:   { electric:0.5, grass:2, fighting:2, bug:2, rock:0.5, steel:0.5 },
  psychic:  { fighting:2, poison:2, psychic:0.5, dark:0, steel:0.5 },
  bug:      { fire:0.5, grass:2, fighting:0.5, flying:0.5, psychic:2, ghost:0.5, dark:2, steel:0.5, fairy:0.5 },
  rock:     { fire:2, ice:2, fighting:0.5, ground:0.5, flying:2, bug:2, steel:0.5 },
  ghost:    { normal:0, psychic:2, ghost:2, dark:0.5 },
  dragon:   { dragon:2, steel:0.5, fairy:0 },
  dark:     { fighting:0.5, psychic:2, ghost:2, dark:0.5, fairy:0.5 },
  steel:    { fire:0.5, water:0.5, electric:0.5, ice:2, rock:2, steel:0.5, fairy:2 },
  fairy:    { fire:0.5, fighting:2, poison:0.5, dragon:2, dark:2, steel:0.5 }
};

/**
 * Get the combined type effectiveness multiplier for a move hitting a defender.
 * Handles dual-type defenders by multiplying both matchups.
 *
 * @param {string}   attackType   - The move's type
 * @param {string[]} defenderTypes - Array of 1–2 defender types
 * @returns {number} Multiplier (0, 0.25, 0.5, 1, 2, or 4)
 */
function getTypeEffectiveness(attackType, defenderTypes) {
  let multiplier = 1;
  for (const defType of defenderTypes) {
    const row = TYPE_CHART[attackType];
    if (row && row[defType] !== undefined) {
      multiplier *= row[defType];
    }
    // If not in the chart, it's 1× (neutral) — multiplier unchanged
  }
  return multiplier;
}

/**
 * Return a human-readable effectiveness string
 * @param {number} mult
 */
function getEffectivenessText(mult) {
  if (mult === 0)   return "It doesn't affect the foe...";
  if (mult < 1)     return "It's not very effective...";
  if (mult === 1)   return "";
  if (mult >= 2)    return "It's super effective!";
}
