// ═══════════════════════════════════════════════════
//  src/main.js
//  App entry point + Battle UI controller.
//  Ties together: engine, CPU, animations, team,
//  tower, and screen modules.
// ═══════════════════════════════════════════════════

// ─── App init ─────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  TeamBuilder.init();
  Tower.init();
  Screen.show('screen-menu');
  console.log('🎮 PokéArena loaded!');
});

// ═══════════════════════════════════════════════════
//  BATTLE STATE
// ═══════════════════════════════════════════════════
const Battle = (() => {

  // Live battle state
  let playerTeam   = [];
  let enemyTeam    = [];
  let playerActive = 0;   // index into playerTeam
  let enemyActive  = 0;
  let isTowerMode  = false;
  let cpuTier      = 1;
  let busy         = false; // prevents double-clicks during animations

  // ─── Getters ──────────────────────────────────
  const getPlayer  = () => playerTeam[playerActive];
  const getEnemy   = () => enemyTeam[enemyActive];

  // ─── Start battle ─────────────────────────────
  function start(pTeam, eTeam, opts = {}) {
    playerTeam   = pTeam;
    enemyTeam    = eTeam;
    playerActive = 0;
    enemyActive  = 0;
    isTowerMode  = opts.tower || false;
    cpuTier      = opts.cpuTier || 1;
    busy         = false;

    // Tower HUD
    const hud = document.getElementById('tower-hud');
    if (hud) hud.classList.toggle('hidden', !isTowerMode);

    BattleUI.refresh();
    BattleUI.showActions();
    BattleUI.setMessage(`Go, ${getPlayer().name}!`);
  }

  // ─── Process player move choice ───────────────
  async function playerChoosesMove(moveIndex) {
    if (busy) return;
    const player = getPlayer();
    const enemy  = getEnemy();
    const move   = player.moves[moveIndex];
    if (!move || (move.currentPP ?? move.pp) <= 0) return;

    busy = true;
    BattleUI.lockInput();

    // CPU picks its move
    const cpuMove = CPU.chooseMove(enemy, player, cpuTier, {
      cpuTeam: enemyTeam, playerTeam, turnNumber: 0
    });

    // Run the turn through the engine
    const events = BattleEngine.executeTurn(player, enemy, move, cpuMove);

    // Play events sequentially
    await processEvents(events);

    // Check win/loss
    if (BattleEngine.isTeamDefeated(enemyTeam)) {
      await victory();
    } else if (BattleEngine.isTeamDefeated(playerTeam)) {
      await defeat();
    } else {
      busy = false;
      BattleUI.showActions();
      BattleUI.setMessage(`What will ${getPlayer().name} do?`);
    }
  }

  // ─── Process event queue ──────────────────────
  async function processEvents(events) {
    const arenaEl        = document.querySelector('.battle-arena');
    const playerSpriteEl = document.getElementById('player-sprite');
    const enemySpriteEl  = document.getElementById('enemy-sprite');
    const playerHPBar    = document.getElementById('player-hp-bar');
    const playerHPNums   = document.getElementById('player-hp-nums');
    const enemyHPBar     = document.getElementById('enemy-hp-bar');
    const enemyHPNums    = document.getElementById('enemy-hp-nums');

    for (const event of events) {

      switch (event.type) {

        case 'move': {
          const isPlayer    = event.user === 'player';
          const attackerEl  = isPlayer ? playerSpriteEl : enemySpriteEl;
          const defenderEl  = isPlayer ? enemySpriteEl  : playerSpriteEl;
          const defHPBar    = isPlayer ? enemyHPBar    : playerHPBar;
          const defHPNums   = isPlayer ? enemyHPNums   : playerHPNums;
          const defender    = isPlayer ? getEnemy()    : getPlayer();

          BattleUI.setMessage(`${event.move.name}!`);
          await BattleAnimations.wait(200);

          if (event.damage > 0) {
            await BattleAnimations.playAttackSequence({
              attackerEl, defenderEl, arenaEl,
              defenderHPBar: defHPBar, defenderHPNums: defHPNums,
              damage: event.damage,
              effectiveness: event.effectiveness,
              isCrit: event.isCrit,
              move: event.move,
              attackerSide: event.user,
              currentHP: defender.currentHP,
              maxHP: defender.maxHP
            });

            if (event.effectivenessText) {
              BattleUI.setMessage(event.effectivenessText);
              await BattleAnimations.wait(700);
            }
            if (event.isCrit) {
              BattleUI.setMessage('A critical hit!');
              await BattleAnimations.wait(600);
            }
          } else {
            // Status move
            await BattleAnimations.wait(400);
          }
          break;
        }

        case 'miss': {
          BattleUI.setMessage(`${event.move.name} missed!`);
          await BattleAnimations.wait(900);
          break;
        }

        case 'effect': {
          for (const msg of event.messages) {
            BattleUI.setMessage(msg);

            // Status flash animation
            const statusTypes = ['burned','paralyzed','poisoned','frozen','asleep'];
            const player = getPlayer();
            const enemy  = getEnemy();
            for (const pkmn of [player, enemy]) {
              if (statusTypes.includes(pkmn.status)) {
                const el = pkmn === player ? playerSpriteEl : enemySpriteEl;
                BattleAnimations.statusFlash(el, pkmn.status);
              }
            }
            await BattleAnimations.wait(900);
          }
          break;
        }

        case 'eot': {
          // Refresh HP bars after end-of-turn damage
          BattleAnimations.drainHP(playerHPBar, playerHPNums, getPlayer().currentHP, getPlayer().maxHP);
          BattleAnimations.drainHP(enemyHPBar,  enemyHPNums,  getEnemy().currentHP,  getEnemy().maxHP);
          for (const msg of event.messages) {
            BattleUI.setMessage(msg);
            await BattleAnimations.wait(800);
          }
          break;
        }

        case 'faint': {
          const isFaintPlayer = event.side === 'player';
          const faintEl       = isFaintPlayer ? playerSpriteEl : enemySpriteEl;

          BattleUI.setMessage(`${event.pkmn.name} fainted!`);
          await BattleAnimations.faintAnimation(faintEl);
          await BattleAnimations.wait(400);

          // Try to send out next Pokémon
          if (isFaintPlayer) {
            const next = findNextAlive(playerTeam, playerActive);
            if (next !== -1) {
              playerActive = next;
              await sendOut(playerSpriteEl, getPlayer(), 'player');
            }
          } else {
            const next = findNextAlive(enemyTeam, enemyActive);
            if (next !== -1) {
              enemyActive = next;
              await sendOut(enemySpriteEl, getEnemy(), 'enemy');
            }
          }
          break;
        }
      }
    }
  }

  // ─── Send out next Pokémon ────────────────────
  async function sendOut(spriteEl, pkmn, side) {
    spriteEl.src = side === 'player' ? pkmn.backSpriteUrl : pkmn.spriteUrl;
    spriteEl.style.opacity = '1';
    spriteEl.style.transform = '';

    BattleUI.setMessage(`Go, ${pkmn.name}!`);
    await BattleAnimations.enterAnimation(spriteEl, side);

    // Update info box
    BattleUI.refreshSide(side);
    await BattleAnimations.wait(300);
  }

  // ─── Switch Pokémon (player initiated) ────────
  async function playerSwitch(teamIndex) {
    if (busy) return;
    if (teamIndex === playerActive) {
      TeamBuilder.showToast(`${getPlayer().name} is already out!`);
      return;
    }
    if (BattleEngine.hasFainted(playerTeam[teamIndex])) {
      TeamBuilder.showToast("That Pokémon has fainted!");
      return;
    }

    busy = true;
    BattleUI.lockInput();

    // Enemy still attacks while player switches
    const playerSpriteEl = document.getElementById('player-sprite');
    const enemySpriteEl  = document.getElementById('enemy-sprite');

    BattleUI.setMessage(`Come back, ${getPlayer().name}!`);
    await BattleAnimations.wait(600);

    playerActive = teamIndex;

    playerSpriteEl.src = getPlayer().backSpriteUrl;
    await BattleAnimations.enterAnimation(playerSpriteEl, 'player');
    BattleUI.setMessage(`Go, ${getPlayer().name}!`);
    BattleUI.refreshSide('player');
    await BattleAnimations.wait(400);

    // CPU gets a free attack on the switch
    const cpuMove  = CPU.chooseMove(getEnemy(), getPlayer(), cpuTier);
    const events   = BattleEngine.executeTurn(getPlayer(), getEnemy(), { name:'(switching)', power:0, accuracy:100, pp:99, currentPP:99, priority:5, type:'normal', category:'status' }, cpuMove);
    await processEvents(events);

    if (BattleEngine.isTeamDefeated(playerTeam)) {
      await defeat();
    } else {
      busy = false;
      BattleUI.showActions();
      BattleUI.setMessage(`What will ${getPlayer().name} do?`);
    }
  }

  // ─── Helpers ──────────────────────────────────
  function findNextAlive(team, currentIdx) {
    for (let i = 0; i < team.length; i++) {
      if (i !== currentIdx && !BattleEngine.hasFainted(team[i])) return i;
    }
    return -1;
  }

  // ─── Outcome screens ──────────────────────────
  async function victory() {
    await BattleAnimations.wait(500);
    const overlay   = document.getElementById('result-overlay');
    const icon      = document.getElementById('result-icon');
    const title     = document.getElementById('result-title');
    const detail    = document.getElementById('result-detail');

    icon.textContent  = '🏆';
    title.textContent = 'Victory!';

    if (isTowerMode) {
      const floor = Tower.getCurrentFloor();
      const floorData = Tower.generateFloor(floor); // reuse for reward

      detail.textContent = `Floor ${floor} cleared!`;

      if (floorData.reward) {
        TeamBuilder.unlock(floorData.reward.key);
        detail.textContent += ` Unlocked ${floorData.reward.name}!`;
      }
    } else {
      detail.textContent = 'You won the battle!';
    }

    overlay.classList.remove('hidden');
    busy = false;
  }

  async function defeat() {
    await BattleAnimations.wait(500);
    const overlay = document.getElementById('result-overlay');
    const icon    = document.getElementById('result-icon');
    const title   = document.getElementById('result-title');
    const detail  = document.getElementById('result-detail');

    icon.textContent  = '💀';
    title.textContent = 'Defeated!';
    detail.textContent = isTowerMode
      ? `You reached Floor ${Tower.getCurrentFloor()}. Keep training!`
      : 'Better luck next time!';

    if (isTowerMode) Tower.endRun();

    overlay.classList.remove('hidden');
    busy = false;
  }

  return {
    start,
    playerChoosesMove,
    playerSwitch,
    getPlayer,
    getEnemy,
    get playerTeam() { return playerTeam; },
    get enemyTeam()  { return enemyTeam;  }
  };

})();

// ═══════════════════════════════════════════════════
//  BATTLE UI — Renders and updates the battle screen
// ═══════════════════════════════════════════════════
const BattleUI = (() => {

  function setMessage(msg) {
    const el = document.getElementById('battle-message');
    if (el) el.textContent = msg;
  }

  function lockInput() {
    showSection('none');
  }

  function showActions() {
    showSection('actions');
  }

  function showMoves() {
    // Build move buttons
    const grid    = document.getElementById('moves-grid');
    const player  = Battle.getPlayer();
    if (!grid || !player) return;

    grid.innerHTML = '';

    player.moves.forEach((move, i) => {
      const pp      = move.currentPP ?? move.pp;
      const btn     = document.createElement('button');
      btn.className = 'move-btn';
      btn.disabled  = pp <= 0;
      btn.innerHTML = `
        <span>${move.name}</span>
        <span class="type-badge type-${move.type} move-btn-type">${move.type}</span>
        <span class="move-btn-pp">PP ${pp}/${move.pp}</span>
      `;
      btn.addEventListener('click',       () => Battle.playerChoosesMove(i));
      btn.addEventListener('mouseenter',  () => hoverMoveDetail(move));
      grid.appendChild(btn);
    });

    showSection('moves');
  }

  function hoverMoveDetail(move) {
    const typeEl   = document.getElementById('move-detail-type');
    const catEl    = document.getElementById('move-detail-cat');
    const ppEl     = document.getElementById('move-detail-pp');
    const powerEl  = document.getElementById('move-detail-power');

    if (typeEl)  typeEl.innerHTML = `<span class="type-badge type-${move.type}">${move.type}</span>`;
    if (catEl)   catEl.textContent  = move.category;
    if (ppEl)    ppEl.textContent   = `PP: ${move.currentPP ?? move.pp}/${move.pp}`;
    if (powerEl) powerEl.textContent = `Power: ${move.power || '—'}`;
  }

  function switchMenu() {
    const grid = document.getElementById('switch-grid');
    if (!grid) return;
    grid.innerHTML = '';

    Battle.playerTeam.forEach((pkmn, i) => {
      const btn = document.createElement('button');
      btn.className = `switch-btn${BattleEngine.hasFainted(pkmn) ? ' fainted' : ''}`;
      if (pkmn === Battle.getPlayer()) btn.classList.add('active');

      btn.innerHTML = `
        <img src="${pkmn.backSpriteUrl}" alt="${pkmn.name}" />
        <span>${pkmn.name}</span>
        <span style="font-size:10px;color:var(--text-muted)">
          ${Math.max(0,pkmn.currentHP)}/${pkmn.maxHP}
        </span>
      `;
      btn.addEventListener('click', () => Battle.playerSwitch(i));
      grid.appendChild(btn);
    });

    showSection('switch');
  }

  function bag() {
    setMessage("You have no items! (Items coming in Part 6)");
    setTimeout(() => { setMessage(`What will ${Battle.getPlayer().name} do?`); showActions(); }, 1800);
  }

  function run() {
    if (Tower.getIsActive()) {
      setMessage("You can't run from a Tower battle!");
      setTimeout(() => showActions(), 1400);
    } else {
      setMessage("Got away safely!");
      setTimeout(() => {
        document.getElementById('result-overlay')?.classList.add('hidden');
        Screen.show('screen-menu');
      }, 1000);
    }
  }

  function showSection(which) {
    const actionsEl = document.getElementById('battle-actions');
    const movesEl   = document.getElementById('move-menu');
    const switchEl  = document.getElementById('switch-menu');

    actionsEl?.classList.toggle('hidden', which !== 'actions');
    movesEl  ?.classList.toggle('hidden', which !== 'moves');
    switchEl ?.classList.toggle('hidden', which !== 'switch');

    if (which === 'none') {
      actionsEl?.classList.add('hidden');
      movesEl  ?.classList.add('hidden');
      switchEl ?.classList.add('hidden');
    }
  }

  // Refresh the full battle UI after a switch/faint
  function refresh() {
    const player = Battle.getPlayer();
    const enemy  = Battle.getEnemy();
    if (!player || !enemy) return;

    // Sprites
    document.getElementById('player-sprite').src = player.backSpriteUrl;
    document.getElementById('enemy-sprite').src  = enemy.spriteUrl;

    // Names + levels
    document.getElementById('player-name').textContent  = player.name;
    document.getElementById('player-level').textContent = `Lv.${player.level}`;
    document.getElementById('enemy-name').textContent   = enemy.name;
    document.getElementById('enemy-level').textContent  = `Lv.${enemy.level}`;

    // HP bars
    setHPBar('player', player.currentHP, player.maxHP);
    setHPBar('enemy',  enemy.currentHP,  enemy.maxHP);

    // Types
    renderTypes('player-types', player.types);
    renderTypes('enemy-types',  enemy.types);

    document.getElementById('msg-pokemon-name').textContent = player.name;
  }

  function refreshSide(side) {
    const pkmn = side === 'player' ? Battle.getPlayer() : Battle.getEnemy();
    if (!pkmn) return;

    document.getElementById(`${side}-name`).textContent  = pkmn.name;
    document.getElementById(`${side}-level`).textContent = `Lv.${pkmn.level}`;
    setHPBar(side, pkmn.currentHP, pkmn.maxHP);
    renderTypes(`${side}-types`, pkmn.types);
  }

  function setHPBar(side, current, max) {
    const bar  = document.getElementById(`${side}-hp-bar`);
    const nums = document.getElementById(`${side}-hp-nums`);
    const pct  = Math.max(0, (current / max) * 100);
    if (bar) {
      bar.style.width = `${pct}%`;
      bar.classList.remove('mid','low');
      if (pct <= 20) bar.classList.add('low');
      else if (pct <= 50) bar.classList.add('mid');
    }
    if (nums) nums.textContent = `${Math.max(0,current)} / ${max}`;
  }

  function renderTypes(elId, types) {
    const el = document.getElementById(elId);
    if (!el) return;
    el.innerHTML = types
      .map(t => `<span class="type-badge type-${t}">${t}</span>`)
      .join('');
  }

  return {
    setMessage, lockInput, showActions, showMoves,
    switchMenu, bag, run, refresh, refreshSide
  };

})();

// ═══════════════════════════════════════════════════
//  GLOBAL ENTRY POINTS (called from HTML)
// ═══════════════════════════════════════════════════

/**
 * Start a quick CPU battle with the player's current team.
 * @param {'cpu'} mode
 */
function startBattle(mode) {
  const keys = TeamBuilder.getTeam();
  if (keys.length === 0) {
    TeamBuilder.showToast('Add at least 1 Pokémon to your team!');
    return;
  }

  const playerTeam = TeamBuilder.buildBattleTeam(50);

  // Build an enemy team from a random CPU opponent
  const cpuKeys   = ['charizard','blastoise','venusaur','pikachu','gengar','snorlax'];
  const enemyTeam = cpuKeys.slice(0, Math.min(3, playerTeam.length))
    .map(k => createPokemonInstance(k, 50))
    .filter(Boolean);

  Screen.show('screen-battle');
  Battle.start(playerTeam, enemyTeam, { tower: false, cpuTier: 2 });
}

/**
 * Start the next tower floor.
 */
function startTowerBattle() {
  const keys = TeamBuilder.getTeam();
  if (keys.length === 0) {
    TeamBuilder.showToast('Add at least 1 Pokémon to your team first!');
    Screen.show('screen-team');
    return;
  }

  Tower.startRun();
  const floor      = Tower.generateFloor(Tower.getCurrentFloor());
  const playerTeam = TeamBuilder.buildBattleTeam(50);
  const cpuTier    = CPU.getTierForFloor(Tower.getCurrentFloor());

  Screen.show('screen-battle');
  Battle.start(playerTeam, floor.enemyTeam, { tower: true, cpuTier });
}

/**
 * Called when the player clicks "Continue" on the result overlay.
 */
function afterBattle() {
  document.getElementById('result-overlay').classList.add('hidden');

  if (Tower.getIsActive()) {
    Tower.advanceFloor();
    startTowerBattle();
  } else {
    Screen.show('screen-menu');
  }
}
