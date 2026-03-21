// ═══════════════════════════════════════════════════
//  src/overworld/mapData.js
//  All map definitions for the story mode.
//
//  Each map is a grid of tile IDs plus layers for:
//    - npcs    : trainers / characters
//    - exits   : warp tiles to other maps
//    - grass   : tall grass (wild encounter zones)
//    - signs   : readable signs
//
//  Tile legend:
//    0  = path (walkable)
//    1  = grass tile (walkable, decoration)
//    2  = tall grass (walkable, triggers encounters)
//    3  = tree / wall (blocked)
//    4  = water (blocked)
//    5  = building face (blocked)
//    6  = door (warp trigger on step)
//    7  = flower (walkable decoration)
//    8  = ledge (can jump down, blocks going up)
//    9  = sand/path variant
//    10 = fence (blocked)
// ═══════════════════════════════════════════════════

const MapData = (() => {

  // Wild Pokémon tables per zone
  const WILD_TABLES = {
    route1: [
      { key: 'pidgey',   weight: 40, minLv: 3, maxLv: 5 },
      { key: 'rattata',  weight: 40, minLv: 3, maxLv: 5 },
      { key: 'caterpie', weight: 20, minLv: 3, maxLv: 4 },
    ],
    viridianForest: [
      { key: 'caterpie', weight: 30, minLv: 3, maxLv: 6 },
      { key: 'weedle',   weight: 30, minLv: 3, maxLv: 6 },
      { key: 'pikachu',  weight: 10, minLv: 4, maxLv: 6 },
      { key: 'metapod',  weight: 20, minLv: 4, maxLv: 6 },
      { key: 'kakuna',   weight: 10, minLv: 4, maxLv: 6 },
    ],
    route2: [
      { key: 'pidgey',   weight: 35, minLv: 5, maxLv: 8 },
      { key: 'rattata',  weight: 35, minLv: 5, maxLv: 8 },
      { key: 'nidoranM', weight: 15, minLv: 5, maxLv: 7 },
      { key: 'nidoranF', weight: 15, minLv: 5, maxLv: 7 },
    ],
    mtMoon: [
      { key: 'zubat',    weight: 40, minLv: 6, maxLv: 10 },
      { key: 'geodude',  weight: 30, minLv: 6, maxLv: 10 },
      { key: 'clefairy', weight: 10, minLv: 7, maxLv: 10 },
      { key: 'paras',    weight: 20, minLv: 7, maxLv: 10 },
    ],
  };

  // ─── Map definitions ──────────────────────────
  // Tiles are stored as rows of numbers for readability.
  // Each map also declares its pixel tile size and
  // the tilesheet variant (used for rendering colour).

  const MAPS = {

    // ── Pallet Town ───────────────────────────
    palletTown: {
      id: 'palletTown',
      name: "Pallet Town",
      theme: 'town',
      tileset: 'kanto',
      tileSize: 32,
      music: 'palletTown',
      width: 10,
      height: 11,
      // W=10, each row has 10 tiles
      tiles: [
        [3,3,3,3,3,3,3,3,3,3],
        [3,0,0,0,0,0,0,0,0,3],
        [3,0,5,5,0,0,5,5,0,3],  // houses row 1
        [3,0,5,6,0,0,5,6,0,3],  // house doors
        [3,0,0,0,0,0,0,0,0,3],
        [3,0,0,0,5,5,0,0,0,3],  // Oak's lab top
        [3,0,0,0,5,5,0,0,0,3],
        [3,0,0,0,6,0,0,0,0,3],  // Oak's lab door
        [3,0,0,0,0,0,0,0,0,3],
        [3,0,0,0,0,0,0,0,0,3],  // route 1 connection row
        [3,3,3,0,0,0,3,3,3,3],  // exit row — gap at x=3,4,5
      ],
      npcs: [
        {
          id: 'mom_pallet',
          name: 'Mom',
          x: 2, y: 3,
          sprite: 'youngster',
          dialogue: [
            'Your adventure is just beginning!',
            'Make sure to visit Professor Oak before you leave town.',
          ],
          facing: 'down',
        },
        {
          id: 'rival_pallet_1',
          name: '{rival}',       // {rival} is replaced with saved rival name
          x: 7, y: 4,
          sprite: 'rival',
          dialogue: [
            "Hey! {player}! So you're starting your journey too?",
            "Don't think you'll beat me. I've already been waiting for Gramps.",
          ],
          facing: 'left',
          defeatedDialogue: [
            "Hmph. I'll get stronger. Just you wait.",
          ],
        },
        {
          id: 'oak_pallet',
          name: 'Prof. Oak',
          x: 4, y: 6,
          sprite: 'oak',
          dialogue: [
            "Ah, {player}! Welcome to my laboratory.",
            "The world of Pokémon is vast and mysterious.",
            "Your {starter} is eager to begin your adventure together.",
            "Head north to Route 1 — Viridian City awaits!",
          ],
          facing: 'down',
          isBattleTrigger: false,
        },
      ],
      exits: [
        { x: 3, y: 10, toMap: 'route1', toX: 3, toY: 0, label: 'Route 1 →' },
        { x: 4, y: 10, toMap: 'route1', toX: 4, toY: 0, label: 'Route 1 →' },
        { x: 5, y: 10, toMap: 'route1', toX: 5, toY: 0, label: 'Route 1 →' },
      ],
      signs: [
        { x: 1, y: 9, text: "PALLET TOWN\nShades of your journey await!" },
        { x: 8, y: 9, text: "ROUTE 1 →\nViridian City is to the north." },
      ],
      grassZones: [],
    },

    // ── Route 1 ───────────────────────────────
    route1: {
      id: 'route1',
      name: "Route 1",
      theme: 'route',
      tileset: 'kanto',
      tileSize: 32,
      music: 'route1',
      width: 10,
      height: 16,
      tiles: [
        [3,3,3,0,0,0,3,3,3,3],  // from pallet town
        [3,3,3,0,0,0,3,3,3,3],
        [3,2,2,0,0,2,2,3,3,3],  // tall grass
        [3,2,2,0,0,2,2,2,3,3],
        [3,3,3,0,0,3,3,3,3,3],
        [3,3,0,0,0,0,3,3,3,3],
        [3,2,0,0,0,0,2,2,3,3],  // tall grass patch 2
        [3,2,2,0,0,0,2,2,3,3],
        [3,3,2,0,0,2,2,3,3,3],
        [3,3,3,0,0,3,3,3,3,3],
        [3,3,3,0,0,0,3,3,3,3],
        [3,3,0,0,0,0,3,3,3,3],
        [3,0,0,0,0,0,0,3,3,3],
        [3,0,0,0,0,0,0,0,3,3],
        [3,3,3,0,0,0,3,3,3,3],
        [3,3,3,0,0,0,3,3,3,3],  // to viridian city
      ],
      npcs: [
        {
          id: 'youngster_route1',
          name: 'Youngster Ted',
          x: 4, y: 5,
          sprite: 'youngster',
          facing: 'down',
          isBattleTrigger: true,
          sightRange: 2,
          battleTeam: [{ key: 'rattata', level: 5 }],
          dialogue: ["I've been training all day!", "Let's battle!"],
          defeatedDialogue: ["Aw, I lost... You're pretty good."],
          reward: { money: 50 },
        },
      ],
      exits: [
        { x: 3, y: 0, toMap: 'palletTown', toX: 3, toY: 9, label: '← Pallet Town' },
        { x: 4, y: 0, toMap: 'palletTown', toX: 4, toY: 9, label: '← Pallet Town' },
        { x: 5, y: 0, toMap: 'palletTown', toX: 5, toY: 9, label: '← Pallet Town' },
        { x: 3, y: 15, toMap: 'viridianCity', toX: 3, toY: 0, label: 'Viridian City →' },
        { x: 4, y: 15, toMap: 'viridianCity', toX: 4, toY: 0, label: 'Viridian City →' },
        { x: 5, y: 15, toMap: 'viridianCity', toX: 5, toY: 0, label: 'Viridian City →' },
      ],
      signs: [
        { x: 3, y: 1, text: "ROUTE 1\nViridian City is ahead." },
      ],
      wildTable: 'route1',
      grassZones: [],   // tall grass tiles (2) trigger encounters automatically
    },

    // ── Viridian City ─────────────────────────
    viridianCity: {
      id: 'viridianCity',
      name: "Viridian City",
      theme: 'town',
      tileset: 'kanto',
      tileSize: 32,
      music: 'viridianCity',
      width: 12,
      height: 14,
      tiles: [
        [3,3,3,0,0,0,3,3,3,3,3,3],
        [3,0,0,0,0,0,0,0,0,0,0,3],
        [3,0,5,5,0,0,5,5,0,0,0,3],
        [3,0,5,6,0,0,5,6,0,0,0,3],  // pokecenter & mart doors
        [3,0,0,0,0,0,0,0,0,0,0,3],
        [3,0,0,0,0,0,0,0,0,0,0,3],
        [3,0,0,5,5,5,5,0,0,0,0,3],  // gym
        [3,0,0,5,5,5,5,0,0,0,0,3],
        [3,0,0,5,6,5,5,0,0,0,0,3],  // gym door
        [3,0,0,0,0,0,0,0,0,0,0,3],
        [3,0,0,0,0,0,0,0,0,0,0,3],
        [3,0,0,0,0,0,0,0,0,0,0,3],
        [3,3,3,0,0,0,3,3,3,3,3,3],
        [3,3,3,0,0,0,3,3,3,3,3,3],
      ],
      npcs: [
        {
          id: 'nurse_viridian',
          name: 'Nurse Joy',
          x: 2, y: 3,
          sprite: 'nurse',
          dialogue: [
            "Welcome to the Pokémon Center!",
            "We restore your tired Pokémon to full health.",
            "Shall I take your Pokémon?",
          ],
          isHealer: true,
          facing: 'down',
        },
        {
          id: 'gym_guard_viridian',
          name: 'Gym Guide',
          x: 4, y: 8,
          sprite: 'youngster',
          facing: 'up',
          dialogue: [
            "The Viridian Gym is closed right now.",
            "The Gym Leader is away.",
            "Try the Pewter City Gym first — head north through Viridian Forest!",
          ],
        },
        {
          id: 'rival_viridian',
          name: '{rival}',
          x: 7, y: 4,
          sprite: 'rival',
          facing: 'left',
          dialogue: [
            "{player}! You made it to Viridian City.",
            "I'm already planning to beat every gym.",
            "Don't fall behind!",
          ],
          defeatedDialogue: ["Still here? Keep moving, then."],
        },
      ],
      exits: [
        { x: 3, y: 0, toMap: 'route1',   toX: 3, toY: 14, label: '← Route 1' },
        { x: 4, y: 0, toMap: 'route1',   toX: 4, toY: 14, label: '← Route 1' },
        { x: 5, y: 0, toMap: 'route1',   toX: 5, toY: 14, label: '← Route 1' },
        { x: 3, y: 13, toMap: 'route2south', toX: 3, toY: 0, label: 'Route 2 →' },
        { x: 4, y: 13, toMap: 'route2south', toX: 4, toY: 0, label: 'Route 2 →' },
      ],
      signs: [
        { x: 1, y: 11, text: "VIRIDIAN CITY\nThe Eternally Green Paradise" },
      ],
      grassZones: [],
      wildTable: null,
    },

    // ── Route 2 South / Viridian Forest ───────
    route2south: {
      id: 'route2south',
      name: "Route 2",
      theme: 'route',
      tileset: 'kanto',
      tileSize: 32,
      music: 'route2',
      width: 10,
      height: 10,
      tiles: [
        [3,3,3,0,0,3,3,3,3,3],
        [3,3,2,0,0,2,3,3,3,3],
        [3,3,2,0,0,2,2,3,3,3],
        [3,3,3,0,0,3,3,3,3,3],
        [3,3,0,0,0,0,3,3,3,3],
        [3,2,0,0,0,0,2,3,3,3],
        [3,2,2,0,0,0,2,3,3,3],
        [3,3,3,0,0,3,3,3,3,3],
        [3,3,3,0,0,3,3,3,3,3],
        [3,3,3,0,0,3,3,3,3,3],
      ],
      npcs: [
        {
          id: 'lass_route2',
          name: 'Lass Cathy',
          x: 5, y: 3,
          sprite: 'youngster',
          facing: 'left',
          isBattleTrigger: true,
          sightRange: 2,
          battleTeam: [{ key: 'pidgey', level: 8 }, { key: 'rattata', level: 7 }],
          dialogue: ["You look like a strong trainer!", "Battle me!"],
          defeatedDialogue: ["Wow, you're great!"],
          reward: { money: 120 },
        },
      ],
      exits: [
        { x: 3, y: 0, toMap: 'viridianCity', toX: 3, toY: 12, label: '← Viridian City' },
        { x: 4, y: 0, toMap: 'viridianCity', toX: 4, toY: 12, label: '← Viridian City' },
        { x: 3, y: 9, toMap: 'viridianForest', toX: 3, toY: 0, label: 'Viridian Forest →' },
        { x: 4, y: 9, toMap: 'viridianForest', toX: 4, toY: 0, label: 'Viridian Forest →' },
      ],
      wildTable: 'route2',
      grassZones: [],
    },

    // ── Viridian Forest ───────────────────────
    viridianForest: {
      id: 'viridianForest',
      name: "Viridian Forest",
      theme: 'forest',
      tileset: 'forest',
      tileSize: 32,
      music: 'forest',
      width: 10,
      height: 14,
      tiles: [
        [3,3,3,0,0,3,3,3,3,3],
        [3,2,2,0,0,2,2,3,3,3],
        [3,2,2,0,0,2,2,2,3,3],
        [3,3,2,0,0,3,2,2,3,3],
        [3,3,3,0,0,3,3,3,3,3],
        [3,2,0,0,0,0,2,3,3,3],
        [3,2,2,0,0,0,2,2,3,3],
        [3,3,2,0,0,0,3,2,3,3],
        [3,3,3,0,0,3,3,3,3,3],
        [3,2,2,0,0,2,2,3,3,3],
        [3,2,2,0,0,2,2,3,3,3],
        [3,3,3,0,0,3,3,3,3,3],
        [3,3,3,0,0,3,3,3,3,3],
        [3,3,3,0,0,3,3,3,3,3],
      ],
      npcs: [
        {
          id: 'bugcatcher_forest1',
          name: 'Bug Catcher Tommy',
          x: 5, y: 2,
          sprite: 'youngster',
          facing: 'left',
          isBattleTrigger: true,
          sightRange: 2,
          battleTeam: [{ key: 'caterpie', level: 9 }, { key: 'weedle', level: 9 }],
          dialogue: ["Bug Pokémon are the BEST!", "I'll prove it!"],
          defeatedDialogue: ["My bugs... they lost..."],
          reward: { money: 150 },
        },
        {
          id: 'bugcatcher_forest2',
          name: 'Bug Catcher Kent',
          x: 3, y: 8,
          sprite: 'youngster',
          facing: 'down',
          isBattleTrigger: true,
          sightRange: 2,
          battleTeam: [{ key: 'metapod', level: 10 }, { key: 'caterpie', level: 10 }],
          dialogue: ["I've been training my Metapod!", "It's almost ready to evolve!"],
          defeatedDialogue: ["It just hardened... and hardened..."],
          reward: { money: 160 },
        },
      ],
      exits: [
        { x: 3, y: 0, toMap: 'route2south', toX: 3, toY: 8, label: '← Route 2' },
        { x: 4, y: 0, toMap: 'route2south', toX: 4, toY: 8, label: '← Route 2' },
        { x: 3, y: 13, toMap: 'pewterCity', toX: 3, toY: 0, label: 'Pewter City →' },
        { x: 4, y: 13, toMap: 'pewterCity', toX: 4, toY: 0, label: 'Pewter City →' },
      ],
      wildTable: 'viridianForest',
      grassZones: [],
    },

    // ── Pewter City ───────────────────────────
    pewterCity: {
      id: 'pewterCity',
      name: "Pewter City",
      theme: 'town',
      tileset: 'kanto',
      tileSize: 32,
      music: 'pewterCity',
      width: 12,
      height: 14,
      tiles: [
        [3,3,3,0,0,3,3,3,3,3,3,3],
        [3,0,0,0,0,0,0,0,0,0,0,3],
        [3,0,5,5,0,0,5,5,0,0,0,3],
        [3,0,5,6,0,0,5,6,0,0,0,3],
        [3,0,0,0,0,0,0,0,0,0,0,3],
        [3,0,0,0,0,0,0,0,0,0,0,3],
        [3,0,0,5,5,5,5,5,0,0,0,3],  // gym (wider)
        [3,0,0,5,5,5,5,5,0,0,0,3],
        [3,0,0,5,6,5,5,5,0,0,0,3],  // gym door
        [3,0,0,0,0,0,0,0,0,0,0,3],
        [3,0,0,0,0,0,0,0,0,0,0,3],
        [3,0,0,0,0,0,0,0,0,0,0,3],
        [3,3,3,0,0,3,3,3,3,3,3,3],
        [3,3,3,0,0,3,3,3,3,3,3,3],
      ],
      npcs: [
        {
          id: 'nurse_pewter',
          name: 'Nurse Joy',
          x: 2, y: 3,
          sprite: 'nurse',
          dialogue: [
            "Welcome to the Pokémon Center!",
            "Your Pokémon are fully restored!",
          ],
          isHealer: true,
          facing: 'down',
        },
        {
          id: 'brock_pewter',
          name: 'Brock',
          x: 5, y: 8,
          sprite: 'brock',
          facing: 'up',
          isGymLeader: true,
          gymIndex: 0,
          gymName: "Pewter Gym",
          badgeName: "Boulder Badge",
          battleTeam: [
            { key: 'geodude',  level: 12 },
            { key: 'onix',     level: 14 },
          ],
          dialogue: [
            "I'm Brock! I'm Pewter's Gym Leader!",
            "My rock-hard willpower is evident in my Pokémon!",
            "That's right — I have rock-type Pokémon!",
            "Fuhaha! Are you ready?",
          ],
          defeatedDialogue: [
            "I took you for granted. That was my mistake.",
            "Here — take this Boulder Badge!",
            "Rock-type moves don't do much against Grass or Water. Keep that in mind!",
          ],
        },
        {
          id: 'pewter_guide',
          name: 'Hiker',
          x: 8, y: 5,
          sprite: 'youngster',
          facing: 'left',
          dialogue: [
            "Brock is tough, I'll tell you that.",
            "Grass and Water types really give him trouble though.",
            "Good luck, kid.",
          ],
        },
      ],
      exits: [
        { x: 3, y: 0, toMap: 'viridianForest', toX: 3, toY: 12, label: '← Viridian Forest' },
        { x: 4, y: 0, toMap: 'viridianForest', toX: 4, toY: 12, label: '← Viridian Forest' },
        { x: 3, y: 13, toMap: 'route3', toX: 3, toY: 0, label: 'Route 3 →' },
        { x: 4, y: 13, toMap: 'route3', toX: 4, toY: 0, label: 'Route 3 →' },
      ],
      signs: [
        { x: 1, y: 11, text: "PEWTER CITY\nA Stone Gray City" },
        { x: 9, y: 5, text: "PEWTER GYM\nBoulder Badge awarded here." },
      ],
      grassZones: [],
      wildTable: null,
    },
    // ── Route 3 ──────────────────────────────────
    route3: {
      id: 'route3',
      name: "Route 3",
      theme: 'route',
      tileset: 'kanto',
      tileSize: 32,
      music: 'route3',
      width: 10,
      height: 16,
      tiles: [
        [3,3,3,0,0,3,3,3,3,3],
        [3,2,2,0,0,2,2,3,3,3],
        [3,2,2,0,0,2,2,3,3,3],
        [3,3,3,0,0,3,3,3,3,3],
        [3,3,0,0,0,0,3,3,3,3],
        [3,2,0,0,0,0,2,3,3,3],
        [3,2,2,0,0,2,2,3,3,3],
        [3,3,2,0,0,2,3,3,3,3],
        [3,3,3,0,0,3,3,3,3,3],
        [3,3,0,0,0,0,3,3,3,3],
        [3,0,0,0,0,0,0,3,3,3],
        [3,2,0,0,0,0,2,3,3,3],
        [3,2,2,0,0,2,2,3,3,3],
        [3,3,3,0,0,3,3,3,3,3],
        [3,3,3,0,0,3,3,3,3,3],
        [3,3,3,0,0,3,3,3,3,3],
      ],
      npcs: [
        {
          id: 'lass_route3',
          name: 'Lass Ana',
          x: 5, y: 4,
          sprite: 'lass',
          facing: 'left',
          isBattleTrigger: true,
          sightRange: 2,
          battleTeam: [
            { key: 'jigglypuff', level: 13 },
            { key: 'pidgey',     level: 12 },
          ],
          dialogue: ["You look like a strong trainer!", "Battle me!"],
          defeatedDialogue: ["Wow, you're great!"],
          reward: { money: 240 },
        },
        {
          id: 'youngster_route3',
          name: 'Youngster Ben',
          x: 3, y: 9,
          sprite: 'youngster',
          facing: 'down',
          isBattleTrigger: true,
          sightRange: 2,
          battleTeam: [
            { key: 'rattata',   level: 14 },
            { key: 'spearow',   level: 13 },
          ],
          dialogue: ["Hey you! Fight me!", "I've been training hard!"],
          defeatedDialogue: ["Aw man..."],
          reward: { money: 280 },
        },
      ],
      exits: [
        { x: 3, y: 0, toMap: 'pewterCity', toX: 3, toY: 12, label: '← Pewter City' },
        { x: 4, y: 0, toMap: 'pewterCity', toX: 4, toY: 12, label: '← Pewter City' },
        { x: 3, y: 15, toMap: 'mtMoon', toX: 3, toY: 0, label: 'Mt. Moon →' },
        { x: 4, y: 15, toMap: 'mtMoon', toX: 4, toY: 0, label: 'Mt. Moon →' },
      ],
      signs: [{ x: 3, y: 1, text: "ROUTE 3 - Mt. Moon is to the east." }],
      wildTable: 'route2',
    },

    // ── Mt. Moon ──────────────────────────────────
    mtMoon: {
      id: 'mtMoon',
      name: "Mt. Moon",
      theme: 'cave',
      tileset: 'kanto',
      tileSize: 32,
      music: 'cave',
      width: 12,
      height: 14,
      tiles: [
        [3,3,3,0,0,3,3,3,3,3,3,3],
        [3,0,0,0,0,0,0,3,3,3,3,3],
        [3,0,3,3,0,0,3,3,3,3,3,3],
        [3,0,3,3,0,0,3,0,0,3,3,3],
        [3,0,0,0,0,0,0,0,0,3,3,3],
        [3,3,3,0,0,3,3,0,0,3,3,3],
        [3,3,3,0,0,3,3,0,0,0,3,3],
        [3,3,3,0,0,0,0,0,3,3,3,3],
        [3,3,3,3,0,0,3,3,3,3,3,3],
        [3,3,0,0,0,0,0,3,3,3,3,3],
        [3,3,0,3,0,0,3,3,3,3,3,3],
        [3,3,0,0,0,0,3,3,3,3,3,3],
        [3,3,3,3,0,0,3,3,3,3,3,3],
        [3,3,3,3,0,0,3,3,3,3,3,3],
      ],
      npcs: [
        {
          id: 'rocketgrunt_moon1',
          name: 'Team Rocket',
          x: 7, y: 3,
          sprite: 'youngster',
          facing: 'left',
          isBattleTrigger: true,
          sightRange: 2,
          battleTeam: [
            { key: 'sandshrew', level: 15 },
            { key: 'zubat',     level: 14 },
          ],
          dialogue: ["Prepare for trouble!", "Team Rocket blasts off again!"],
          defeatedDialogue: ["How did you beat us?!"],
          reward: { money: 450 },
        },
        {
          id: 'rocketgrunt_moon2',
          name: 'Team Rocket',
          x: 4, y: 9,
          sprite: 'youngster',
          facing: 'down',
          isBattleTrigger: true,
          sightRange: 2,
          battleTeam: [
            { key: 'rattata',  level: 15 },
            { key: 'geodude',  level: 15 },
            { key: 'zubat',    level: 15 },
          ],
          dialogue: ["Hand over the Moon Stone!", "We'll take everything!"],
          defeatedDialogue: ["The boss won't hear about this..."],
          reward: { money: 450 },
        },
      ],
      exits: [
        { x: 3, y: 0, toMap: 'route3',       toX: 3, toY: 14, label: '← Route 3' },
        { x: 4, y: 0, toMap: 'route3',       toX: 4, toY: 14, label: '← Route 3' },
        { x: 4, y: 13, toMap: 'ceruleanCity', toX: 4, toY: 0,  label: 'Cerulean City →' },
        { x: 5, y: 13, toMap: 'ceruleanCity', toX: 5, toY: 0,  label: 'Cerulean City →' },
      ],
      signs: [{ x: 3, y: 1, text: "MT. MOON - Team Rocket is active here. Be careful!" }],
      wildTable: 'mtMoon',
    },

    // ── Cerulean City ─────────────────────────────
    ceruleanCity: {
      id: 'ceruleanCity',
      name: "Cerulean City",
      theme: 'town',
      tileset: 'kanto',
      tileSize: 32,
      music: 'ceruleanCity',
      width: 12,
      height: 14,
      tiles: [
        [3,3,3,3,0,0,3,3,3,3,3,3],
        [3,0,0,0,0,0,0,0,0,0,0,3],
        [3,0,5,5,0,0,5,5,0,0,0,3],
        [3,0,5,6,0,0,5,6,0,0,0,3],
        [3,0,0,0,0,0,0,0,0,0,0,3],
        [3,0,0,0,0,0,0,0,0,0,0,3],
        [3,0,0,5,5,5,5,0,0,0,0,3],
        [3,0,0,5,5,5,5,0,0,0,0,3],
        [3,0,0,5,6,5,5,0,0,0,0,3],
        [3,0,0,0,0,0,0,0,0,0,0,3],
        [3,0,0,0,0,0,0,0,0,0,0,3],
        [3,0,0,0,0,0,0,0,0,0,0,3],
        [3,3,3,0,0,3,3,3,3,3,3,3],
        [3,3,3,0,0,3,3,3,3,3,3,3],
      ],
      npcs: [
        {
          id: 'nurse_cerulean',
          name: 'Nurse Joy',
          x: 2, y: 3,
          sprite: 'nurse',
          dialogue: ["Welcome to the Pokémon Center!", "Your Pokémon are fully restored!"],
          isHealer: true,
          facing: 'down',
        },
        {
          id: 'misty_cerulean',
          name: 'Misty',
          x: 4, y: 8,
          sprite: 'misty',
          facing: 'up',
          isGymLeader: true,
          gymIndex: 1,
          gymName: "Cerulean Gym",
          badgeName: "Cascade Badge",
          battleTeam: [
            { key: 'staryu',   level: 18 },
            { key: 'starmie',  level: 21 },
          ],
          dialogue: [
            "Hi! I'm Misty, the Cerulean City Gym Leader!",
            "My policy is an all-out offensive with Water-type Pokémon!",
            "Prepare yourself!",
          ],
          defeatedDialogue: [
            "You're quite strong for a rookie trainer!",
            "You outdid my Water-type strategy.",
            "Take this Cascade Badge!",
          ],
        },
        {
          id: 'rival_cerulean',
          name: '{rival}',
          x: 8, y: 4,
          sprite: 'rival',
          facing: 'left',
          dialogue: [
            "{player}! You made it to Cerulean too?",
            "You should try the gym — Misty is tough!",
            "I already won my Cascade Badge, obviously.",
          ],
          defeatedDialogue: ["Hmph. Beat you next time."],
        },
      ],
      exits: [
        { x: 4, y: 0, toMap: 'mtMoon',  toX: 4, toY: 12, label: '← Mt. Moon' },
        { x: 5, y: 0, toMap: 'mtMoon',  toX: 5, toY: 12, label: '← Mt. Moon' },
      ],
      signs: [
        { x: 1, y: 11, text: "CERULEAN CITY - A Mysterious Blue Aura Surrounds It" },
        { x: 9, y: 5, text: "CERULEAN GYM - Cascade Badge awarded here." },
      ],
      wildTable: null,
    },
  };

  // ─── Wild encounter helper ─────────────────────

  function rollWildPokemon(mapId) {
    const map   = MAPS[mapId];
    if (!map || !map.wildTable) return null;
    const table = WILD_TABLES[map.wildTable];
    if (!table || table.length === 0) return null;

    // Weighted random pick
    const total = table.reduce((s, e) => s + e.weight, 0);
    let roll    = Math.random() * total;
    let entry   = table[table.length - 1];
    for (const e of table) {
      roll -= e.weight;
      if (roll <= 0) { entry = e; break; }
    }

    const level = entry.minLv + Math.floor(Math.random() * (entry.maxLv - entry.minLv + 1));
    return { key: entry.key, level };
  }

  function getMap(id)          { return MAPS[id] || null; }
  function getWildTables()     { return WILD_TABLES; }
  function listMaps()          { return Object.keys(MAPS); }

  return { getMap, rollWildPokemon, listMaps };

})();
