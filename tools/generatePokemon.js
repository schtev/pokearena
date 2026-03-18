// ═══════════════════════════════════════════════════
//  tools/generatePokemon.js
//  Run this ONCE with Node.js to generate pokemon.js
//  from the PokeAPI. Fetches all 898 Gen 1–8 Pokémon.
//
//  SETUP:
//    npm install node-fetch   (or use Node 18+ built-in fetch)
//
//  RUN:
//    node tools/generatePokemon.js
//
//  OUTPUT:
//    src/data/pokemon.js   (overwrites the existing file)
//
//  Takes ~3–5 minutes due to rate limiting (1 req/100ms).
//  Only run this when you want to refresh the data.
// ═══════════════════════════════════════════════════

const fs   = require('fs');
const path = require('path');

// ─── Config ───────────────────────────────────────
// How many Pokémon to fetch. Max 1025 (Gen 1–9).
// Start with 151 for Gen 1 only, or 898 for Gen 1–8.
const TOTAL_POKEMON = 898; // Change to 898 for more

// Which Pokémon are unlocked from the start
// (rest are locked and earned via tower/battles)
const STARTER_UNLOCKED = [
  'bulbasaur','charmander','squirtle','pikachu','eevee','mewtwo'
];

// How many moves each Pokémon gets (top N by base power)
const MAX_MOVES = 4;

// Delay between API requests in ms (be polite to free API)
const REQUEST_DELAY = 120;

// ─── Move key normaliser ──────────────────────────
// Converts PokeAPI move names like "fire-blast" to
// camelCase keys like "fireBlast" to match MOVES_DATA
function toCamelCase(str) {
  return str.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

// ─── Fetch with retry ─────────────────────────────
async function fetchJSON(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      if (i === retries - 1) throw err;
      console.warn(`  Retry ${i + 1} for ${url}`);
      await delay(500);
    }
  }
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── Stat name mapping ────────────────────────────
// PokeAPI uses "special-attack", we use "spatk" etc.
const STAT_MAP = {
  'hp':              'hp',
  'attack':          'attack',
  'defense':         'defense',
  'special-attack':  'spatk',
  'special-defense': 'spdef',
  'speed':           'speed',
};

// ─── Move category mapping ────────────────────────
const CAT_MAP = {
  'physical': 'physical',
  'special':  'special',
  'status':   'status',
};

// ─── Filter moves to the best 4 ───────────────────
// Picks the highest-power damaging moves first,
// then fills remaining slots with status moves.
function pickBestMoves(allMoves) {
  // Sort: damaging by power desc, then status
  const damaging = allMoves
    .filter(m => m.power && m.power > 0)
    .sort((a, b) => b.power - a.power);

  const status = allMoves
    .filter(m => !m.power || m.power === 0);

  const picked = [
    ...damaging.slice(0, 3),
    ...status.slice(0, 1),
  ].slice(0, MAX_MOVES);

  // If we have fewer than 4, pad with whatever's left
  if (picked.length < MAX_MOVES) {
    const remaining = allMoves.filter(m => !picked.includes(m));
    picked.push(...remaining.slice(0, MAX_MOVES - picked.length));
  }

  return picked.slice(0, MAX_MOVES).map(m => toCamelCase(m.name));
}

// ─── Fetch a single Pokémon ───────────────────────
async function fetchPokemon(id) {
  const pkmn = await fetchJSON(`https://pokeapi.co/api/v2/pokemon/${id}`);

  // Base stats
  const baseStats = {};
  for (const s of pkmn.stats) {
    const key = STAT_MAP[s.stat.name];
    if (key) baseStats[key] = s.base_stat;
  }

  // Types (1 or 2)
  const types = pkmn.types
    .sort((a, b) => a.slot - b.slot)
    .map(t => t.type.name);

  // Moves — fetch details for the most useful ones
  // PokeAPI returns all learnable moves; we sample the top 20 by name length
  // (shorter names tend to be classic moves) then score by power
  const moveRefs = pkmn.moves
    .filter(m => m.version_group_details.some(
      d => d.move_learn_method.name === 'level-up'
    ))
    .slice(0, 20); // limit API calls per Pokémon

  const moveDetails = [];
  for (const ref of moveRefs) {
    try {
      const md = await fetchJSON(ref.move.url);
      moveDetails.push({
        name:     md.name,
        power:    md.power || 0,
        accuracy: md.accuracy || 100,
        pp:       md.pp || 10,
        type:     md.type.name,
        category: md.damage_class?.name || 'status',
      });
    } catch (e) {
      // Skip moves that 404 or fail
    }
    await delay(60);
  }

  const moves = pickBestMoves(moveDetails);

  // Key: lowercase name, spaces→empty (e.g. "mr-mime" → "mrMime")
  const key = toCamelCase(pkmn.name);

  return {
    key,
    data: {
      id:    pkmn.id,
      name:  pkmn.name.charAt(0).toUpperCase() + pkmn.name.slice(1)
               .replace(/-([a-z])/g, (_, c) => ' ' + c.toUpperCase()),
      types,
      baseStats,
      moves: moves.length > 0 ? moves : ['tackle'], // fallback
      unlocked: STARTER_UNLOCKED.includes(key),
    }
  };
}

// ─── Main ─────────────────────────────────────────
async function main() {
  console.log(`🎮 PokéArena — Generating Pokémon data for #1–${TOTAL_POKEMON}`);
  console.log(`   This takes ~${Math.ceil(TOTAL_POKEMON * 0.4 / 60)} minutes. Sit tight!\n`);

  const entries = [];

  for (let id = 1; id <= TOTAL_POKEMON; id++) {
    try {
      process.stdout.write(`  Fetching #${id}/${TOTAL_POKEMON}... `);
      const { key, data } = await fetchPokemon(id);
      entries.push({ key, data });
      console.log(`✓ ${data.name}`);
    } catch (err) {
      console.warn(`✗ #${id} failed: ${err.message}`);
    }
    await delay(REQUEST_DELAY);
  }

  // ─── Generate the file ──────────────────────────
  const lines = [
    `// AUTO-GENERATED by tools/generatePokemon.js`,
    `// Do not edit by hand — run the generator to update.`,
    `// Generated: ${new Date().toISOString()}`,
    `// Pokémon: #1–${TOTAL_POKEMON} (${entries.length} fetched)`,
    ``,
    `const SPRITE_BASE      = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon';`,
    `const SPRITE_BACK_BASE = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/back';`,
    ``,
    `function getSpriteUrl(id)     { return \`\${SPRITE_BASE}/\${id}.png\`; }`,
    `function getBackSpriteUrl(id) { return \`\${SPRITE_BACK_BASE}/\${id}.png\`; }`,
    ``,
    `const POKEMON_DATA = {`,
  ];

  for (const { key, data } of entries) {
    lines.push(`  ${key}: {`);
    lines.push(`    id: ${data.id}, name: '${data.name}',`);
    lines.push(`    types: ${JSON.stringify(data.types)},`);
    lines.push(`    baseStats: ${JSON.stringify(data.baseStats)},`);
    lines.push(`    moves: ${JSON.stringify(data.moves)},`);
    lines.push(`    unlocked: ${data.unlocked},`);
    lines.push(`  },`);
  }

  lines.push(`};`);
  lines.push(``);
  lines.push(`// ─── Helpers (same as before) ───────────────`);
  lines.push(`function createPokemonInstance(key, level = 50) {`);
  lines.push(`  const template = POKEMON_DATA[key];`);
  lines.push(`  if (!template) { console.error('No Pokémon:', key); return null; }`);
  lines.push(`  const bs = template.baseStats;`);
  lines.push(`  const calcStat = b => Math.floor(((2 * b * level) / 100) + 5);`);
  lines.push(`  const maxHP    = Math.floor(((2 * bs.hp * level) / 100) + level + 10);`);
  lines.push(`  const moves = template.moves.map(id => {`);
  lines.push(`    const m = MOVES_DATA[id];`);
  lines.push(`    if (!m) return null;`);
  lines.push(`    return { ...m, id, currentPP: m.pp };`);
  lines.push(`  }).filter(Boolean);`);
  lines.push(`  if (moves.length === 0) {`);
  lines.push(`    const fallback = MOVES_DATA['tackle'];`);
  lines.push(`    if (fallback) moves.push({ ...fallback, id: 'tackle', currentPP: fallback.pp });`);
  lines.push(`  }`);
  lines.push(`  return {`);
  lines.push(`    key, id: template.id, name: template.name, types: [...template.types],`);
  lines.push(`    level, maxHP, currentHP: maxHP,`);
  lines.push(`    stats: { attack: calcStat(bs.attack), defense: calcStat(bs.defense),`);
  lines.push(`             spatk: calcStat(bs.spatk),   spdef: calcStat(bs.spdef), speed: calcStat(bs.speed) },`);
  lines.push(`    moves, status: null,`);
  lines.push(`    stages: { attack:0, defense:0, spatk:0, spdef:0, speed:0 },`);
  lines.push(`    spriteUrl:     getSpriteUrl(template.id),`);
  lines.push(`    backSpriteUrl: getBackSpriteUrl(template.id),`);
  lines.push(`  };`);
  lines.push(`}`);
  lines.push(``);
  lines.push(`function getUnlockedPokemon() {`);
  lines.push(`  return Object.keys(POKEMON_DATA).filter(k => POKEMON_DATA[k].unlocked);`);
  lines.push(`}`);
  lines.push(``);
  lines.push(`function unlockPokemon(key) {`);
  lines.push(`  if (POKEMON_DATA[key]) POKEMON_DATA[key].unlocked = true;`);
  lines.push(`}`);

  // Write output
  const outPath = path.join(__dirname, '..', 'src', 'data', 'pokemon.js');
  fs.writeFileSync(outPath, lines.join('\n'), 'utf8');

  console.log(`\n✅ Done! Written to ${outPath}`);
  console.log(`   ${entries.length} Pokémon generated.`);
  console.log(`\n⚠️  IMPORTANT: Review src/data/moves.js and make sure the`);
  console.log(`   move keys used in pokemon.js also exist in MOVES_DATA.`);
  console.log(`   Run tools/generateMoves.js next to expand move coverage.`);
}

main().catch(console.error);
