# PokéArena

A fan-made browser Pokémon battle game built with vanilla JavaScript.

**Play online:** https://schtev.github.io/pokearena/

---

## Features (Parts 1–6)

- ⚔️ **Battle Engine** — Gen 5 damage formula, type chart, status effects, turn order
- 🤖 **CPU AI** — Three difficulty tiers (Random → Smart → Predictive)
- 🗼 **Infinite Tower** — Procedurally generated floors with scaling difficulty, boss fights, persistent runs
- 👥 **Team Builder** — Drag-and-drop slot reordering, Pokémon collection grid
- 📖 **Pokédex** — Browse all Pokémon, silhouetted until unlocked
- 📊 **Stats Screen** — Full stat bars, learnset table, evolution chain
- 💾 **Save System** — Persists team, unlocks, tower progress, playtime
- 🎒 **Items** — Potion, Super Potion, Full Restore, Revive, X-items in battle
- 🌿 **Abilities** — Blaze, Torrent, Intimidate, Static, Speed Boost, and more
- 🏷️ **Held Items** — Leftovers, Life Orb, Choice Band, Rocky Helmet, etc.
- ☀️ **Weather** — Sun/Rain/Sandstorm/Hail with particle effects and move power changes
- ⭐ **XP System** — Medium-Fast curve, animated EXP bar, levels up between floors
- 🌟 **Evolution** — Level-based evolution with full animation sequence
- 📚 **Move Learning** — Learn new moves on level-up, choose which to replace
- 🎨 **Move Animations** — Type-specific canvas particle effects per move type
- 📋 **Battle Log** — Full colour-coded battle history panel
- 🔊 **Procedural Sound** — Web Audio API sound effects, no external files
- 🌐 **Online PvP** — Socket.io matchmaking lobby (requires server deployment)
- ⚙️ **Settings** — Volume, mute, reset, playtime stats

---

## Running Locally

1. Clone the repo: `git clone https://github.com/YOUR-USERNAME/pokearena.git`
2. Open the folder in VS Code
3. Install the **Live Server** extension
4. Right-click `index.html` → **Open with Live Server**
5. Game opens at `http://localhost:5500`

> The game runs entirely in the browser — no build step needed.

---

## Deploying to GitHub Pages (Free Hosting)

1. Push your code to GitHub
2. Go to your repo → **Settings** → **Pages**
3. Under **Branch**, select `main` and folder `/root` (or `/ (root)`)
4. Click **Save**
5. Your game is live at `[https://YOUR-USERNAME.github.io/pokearena](https://schtev.github.io/pokearena/)` in ~60 seconds

---

## Deploying the Multiplayer Server (Free)

The PvP lobby requires a Socket.io server. Deploy free on [Railway](https://railway.app):

1. Push this repo to GitHub
2. Go to [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub Repo**
3. Select your `pokearena` repo
4. Railway auto-detects Node.js and runs `npm start`
5. Go to your deployment → **Settings** → copy the **Public URL**
6. Open `src/online/pvp.js` and update `SERVER_URL` to your Railway URL
7. Commit and push → GitHub Pages picks up the change automatically

---

## Project Structure

```
pokearena/
├── index.html               ← Single-page app shell (all screens)
├── style.css                ← All styles
├── package.json             ← Server dependencies
├── server/
│   └── server.js            ← Socket.io PvP server (deploy to Railway)
└── src/
    ├── audio/sound.js       ← Procedural Web Audio sound effects
    ├── battle/
    │   ├── engine.js        ← Core damage formula, turn order, effects
    │   ├── cpu.js           ← 3-tier AI (random/smart/predictive)
    │   ├── animations.js    ← Sprite animations (lunge, flash, idle, faint)
    │   ├── moveAnimations.js← Type-specific canvas particle effects
    │   ├── weather.js       ← Sun/Rain/Sand/Hail system
    │   ├── abilities.js     ← Ability definitions and triggers
    │   └── heldItems.js     ← Held item definitions and triggers
    ├── data/
    │   ├── pokemon.js       ← Pokémon stats, types, base moves
    │   ├── moves.js         ← Move definitions + type chart
    │   └── learnsets.js     ← Level-up move tables
    ├── items/items.js       ← Bag item definitions and battle use
    ├── online/pvp.js        ← Socket.io PvP client
    ├── pokemon/
    │   ├── evolution.js     ← Evolution checks and triggers
    │   ├── moveLearning.js  ← Learn-move dialogue system
    │   └── xp.js            ← XP curve, grant, bar animation
    ├── save/save.js         ← Centralised localStorage save system
    ├── team/teambuilder.js  ← Team management + drag-and-drop reorder
    ├── tower/
    │   ├── tower.js         ← Floor generation, enemy teams, rewards
    │   └── floorTransition.js ← Animated floor number reveal
    └── ui/
        ├── screen.js        ← Screen transition manager
        ├── statsScreen.js   ← Pokémon stats overlay
        ├── battleLog.js     ← Battle event log panel
        ├── pokedex.js       ← Pokédex browser
        └── settings.js      ← Settings / profile screen
```

---

## Adding More Pokémon

In `src/data/pokemon.js`, copy any entry and add your own:

```js
newPokemon: {
  id: 999,           // Pokédex number (used for sprite URL)
  name: 'NewMon',
  types: ['fire'],
  baseStats: { hp:60, attack:80, defense:50, spatk:90, spdef:50, speed:100 },
  moves: ['flamethrower','ember','slash','growl'],
  unlocked: false    // true = available from the start
}
```

Then add it to `src/data/learnsets.js` and `src/pokemon/evolution.js` if it evolves.

---

## Credits

- Sprites: [PokeAPI Sprites](https://github.com/PokeAPI/sprites) (Nintendo/Game Freak)
- This is a fan project for educational purposes only
