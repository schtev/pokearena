// ═══════════════════════════════════════════════════
//  src/main.js
//  App entry point + Battle UI controller.
//  Ties together: engine, CPU, animations, team,
//  tower, and screen modules.
// ═══════════════════════════════════════════════════

// ─── App init ─────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  // Load save data first — everything else reads from it
  SaveSystem.load();

  // Sync unlocked Pokémon from save into POKEMON_DATA
  SaveSystem.getUnlocked().forEach(key => {
    if (POKEMON_DATA[key]) POKEMON_DATA[key].unlocked = true;
  });

  // Init subsystems
  TeamBuilder.init();
  Tower.init();
  Screen.show('screen-menu');

  // Sound initialises on first click (browser AudioContext policy)
  document.addEventListener('click', () => SoundSystem.init(), { once: true });

  console.log('🎮 PokéArena loaded! Save version:', SaveSystem.get().version);
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

    // Reset weather each battle
    if (typeof Weather !== 'undefined') Weather.reset();

    // Attach default held items to all Pokémon
    if (typeof HeldItems !== 'undefined') {
      [...playerTeam, ...enemyTeam].forEach(p => HeldItems.attachDefault(p));
    }

    // Tower HUD
    const hud = document.getElementById('tower-hud');
    if (hud) hud.classList.toggle('hidden', !isTowerMode);

    BattleUI.refresh();
    BattleUI.showActions();

    // Clear log for new battle
    if (typeof BattleLog !== 'undefined') {
      BattleLog.clear();
      BattleLog.hide();
      BattleLog.add('⚔️ Battle started!', 'system');
    }

    // Trigger switch-in abilities for starting Pokémon
    const switchInMsgs = [];
    if (typeof AbilitySystem !== 'undefined') {
      switchInMsgs.push(...AbilitySystem.triggerSwitchIn(getPlayer(), getEnemy(), Weather));
      switchInMsgs.push(...AbilitySystem.triggerSwitchIn(getEnemy(), getPlayer(), Weather));
    }

    if (switchInMsgs.length > 0) {
      BattleUI.setMessage(switchInMsgs[0]);
      setTimeout(() => BattleUI.setMessage(`Go, ${getPlayer().name}!`), 1200);
    } else {
      BattleUI.setMessage(`Go, ${getPlayer().name}!`);
    }

    // Initialise XP bars
    if (typeof XPSystem !== 'undefined') {
      playerTeam.forEach(p => {
        if (p.xp === undefined) p.xp = XPSystem.xpForLevel(p.level);
      });
      XPSystem.updateBar('player', getPlayer(), false);
    }
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
          BattleLog.logMove(isPlayer ? getPlayer().name : getEnemy().name, event.move.name, event.user);
          await BattleAnimations.wait(200);

          if (event.damage > 0) {
            // Play sound
            if (event.isCrit)                              SoundSystem.play('critHit');
            else if (event.effectiveness >= 2)             SoundSystem.play('hitSuper');
            else if (event.effectiveness < 1 && event.effectiveness > 0) SoundSystem.play('hitWeak');
            else                                           SoundSystem.play('hitNormal');

            // Type-specific move animation (Part 6)
            if (typeof MoveAnimations !== 'undefined') {
              await MoveAnimations.play(event.move.type, defenderEl);
            }

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

            // Log damage
            BattleLog.logDamage(defender.name, event.damage, event.effectiveness, event.isCrit);

            if (event.effectivenessText) {
              BattleUI.setMessage(event.effectivenessText);
              await BattleAnimations.wait(700);
            }
            if (event.isCrit) {
              BattleUI.setMessage('A critical hit!');
              await BattleAnimations.wait(600);
            }

            // Low HP warning
            const p = getPlayer();
            if (p.currentHP / p.maxHP <= 0.2 && p.currentHP > 0) SoundSystem.play('lowHPBeep');

          } else {
            SoundSystem.play('itemUse');
            await BattleAnimations.wait(400);
          }
          break;
        }

        case 'miss': {
          SoundSystem.play('miss');
          BattleLog.logMiss(event.move.name);
          BattleUI.setMessage(`${event.move.name} missed!`);
          await BattleAnimations.wait(900);
          break;
        }

        case 'effect': {
          for (const msg of event.messages) {
            BattleUI.setMessage(msg);
            BattleLog.logEffect(msg);

            const statusTypes = ['burned','paralyzed','poisoned','frozen','asleep'];
            const player = getPlayer();
            const enemy  = getEnemy();
            for (const pkmn of [player, enemy]) {
              if (statusTypes.includes(pkmn.status)) {
                const el = pkmn === player ? playerSpriteEl : enemySpriteEl;
                BattleAnimations.statusFlash(el, pkmn.status);
                SoundSystem.play('statusInflict');
              }
            }
            BattleUI.refreshStatusBadges();
            await BattleAnimations.wait(900);
          }
          break;
        }

        case 'eot': {
          BattleAnimations.drainHP(playerHPBar, playerHPNums, getPlayer().currentHP, getPlayer().maxHP);
          BattleAnimations.drainHP(enemyHPBar,  enemyHPNums,  getEnemy().currentHP,  getEnemy().maxHP);
          for (const msg of event.messages) {
            BattleUI.setMessage(msg);
            // Classify log entry type
            if (msg.includes('weather') || msg.includes('sandstorm') || msg.includes('rain') ||
                msg.includes('sun') || msg.includes('hail'))       BattleLog.logWeather(msg);
            else if (msg.includes('Leftovers') || msg.includes('Berry') || msg.includes('Orb'))
                                                                   BattleLog.logItem(msg);
            else                                                   BattleLog.logEffect(msg);
            await BattleAnimations.wait(800);
          }
          break;
        }

        case 'faint': {
          const isFaintPlayer = event.side === 'player';
          const faintEl       = isFaintPlayer ? playerSpriteEl : enemySpriteEl;
          const faintSide     = isFaintPlayer ? 'player' : 'enemy';

          BattleAnimations.stopIdle(faintSide);
          SoundSystem.play('faint');
          BattleLog.logFaint(event.pkmn.name);

          BattleUI.setMessage(`${event.pkmn.name} fainted!`);
          await BattleAnimations.faintAnimation(faintEl);
          await BattleAnimations.wait(400);

          if (isFaintPlayer) {
            const next = findNextAlive(playerTeam, playerActive);
            if (next !== -1) { playerActive = next; await sendOut(playerSpriteEl, getPlayer(), 'player'); }
          } else {
            const next = findNextAlive(enemyTeam, enemyActive);
            if (next !== -1) { enemyActive = next; await sendOut(enemySpriteEl, getEnemy(), 'enemy'); }
          }
          break;
        }
      }
    }
  }

  // ─── Send out next Pokémon ────────────────────
  async function sendOut(spriteEl, pkmn, side) {
    // Cancel any lingering Web Animations (faint fill:'forwards' ghost fix)
    spriteEl.getAnimations().forEach(a => a.cancel());

    // Hard reset all inline styles before loading new sprite
    spriteEl.style.cssText = '';
    spriteEl.style.opacity   = '0';
    spriteEl.style.transform = '';
    spriteEl.style.filter    = '';

    // Load the correct sprite (front for enemy, back for player)
    const newSrc = side === 'player' ? pkmn.backSpriteUrl : pkmn.spriteUrl;
    spriteEl.src = newSrc;

    // Wait for the image to actually load before animating
    await new Promise(resolve => {
      if (spriteEl.complete && spriteEl.naturalWidth > 0) {
        resolve();
      } else {
        spriteEl.onload  = resolve;
        spriteEl.onerror = resolve; // don't hang if sprite 404s
      }
    });

    BattleUI.setMessage(`Go, ${pkmn.name}!`);
    await BattleAnimations.enterAnimation(spriteEl, side);

    // Restart idle animation for the new Pokémon
    BattleAnimations.startIdle(spriteEl, side);

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
    BattleAnimations.stopAllIdles();
    SoundSystem.play('victory');
    await BattleAnimations.wait(500);

    // Grant XP — each surviving player Pokémon gains levels in tower mode
    if (isTowerMode) {
      const floor = Tower.getCurrentFloor();
      const floorBonus = Math.max(1, floor / 10);

      // Grant XP for each enemy Pokémon defeated
      const evoEvents = [];
      playerTeam.forEach((pkmn, i) => {
        if (BattleEngine.hasFainted(pkmn)) return;

        // Sum XP from all defeated enemies
        let totalXP = 0;
        enemyTeam.forEach(enemy => {
          if (typeof XPSystem !== 'undefined') {
            totalXP += XPSystem.calcReward(enemy, floorBonus);
          }
        });

        if (totalXP > 0 && typeof XPSystem !== 'undefined') {
          const levelEvents = XPSystem.grant(pkmn, totalXP);

          // Animate XP bar
          XPSystem.animateGain('player', pkmn, totalXP);

          levelEvents.forEach(ev => {
            showLevelUpToast(`${pkmn.name} grew to Lv.${ev.newLevel}!`);
            SoundSystem.play('levelUp');
            BattleLog.logLevelUp(`${pkmn.name} grew to Lv.${ev.newLevel}!`);

            // Recalculate stats
            const template = POKEMON_DATA[pkmn.key];
            if (template) {
              const bs = template.baseStats;
              const calcStat = (base) => Math.floor(((2 * base * pkmn.level) / 100) + 5);
              const newMaxHP = Math.floor(((2 * bs.hp * pkmn.level) / 100) + pkmn.level + 10);
              const hpGained = newMaxHP - pkmn.maxHP;
              pkmn.maxHP     = newMaxHP;
              pkmn.currentHP = Math.min(pkmn.maxHP, pkmn.currentHP + hpGained);
              pkmn.stats.attack  = calcStat(bs.attack);
              pkmn.stats.defense = calcStat(bs.defense);
              pkmn.stats.spatk   = calcStat(bs.spatk);
              pkmn.stats.spdef   = calcStat(bs.spdef);
              pkmn.stats.speed   = calcStat(bs.speed);
            }

            // Check evolution
            const evoCheck = EvolutionSystem.checkEvolution(pkmn.key, pkmn.level);
            if (evoCheck) {
              evoEvents.push({ pkmn, slotIndex: i, fromKey: pkmn.key, toKey: evoCheck.into });
            }
          });
        }
      });

      // Play evolution sequence for each evolved Pokémon
      for (const ev of evoEvents) {
        await BattleAnimations.wait(600);
        await playEvolutionSequence(ev.fromKey, ev.toKey, ev.slotIndex);
      }

      // Check for new moves to learn (after level-up and evolutions)
      await MoveLearning.checkAndLearnMoves(playerTeam);
    }

    const overlay  = document.getElementById('result-overlay');
    const icon     = document.getElementById('result-icon');
    const title    = document.getElementById('result-title');
    const detail   = document.getElementById('result-detail');

    icon.textContent  = '🏆';
    title.textContent = 'Victory!';

    if (isTowerMode) {
      const floor     = Tower.getCurrentFloor();
      const floorData = Tower.generateFloor(floor);
      detail.textContent = `Floor ${floor} cleared!`;
      if (floorData.reward) {
        const wasNew = SaveSystem.unlockPokemon(floorData.reward.key);
        if (wasNew) {
          detail.textContent += ` 🎉 Unlocked ${floorData.reward.name}!`;
          TeamBuilder.renderCollection();
        }
      }
      SaveSystem.setBestFloor(floor);
    } else {
      detail.textContent = 'You won the battle!';
    }

    overlay.classList.remove('hidden');
    busy = false;
  }

  async function defeat() {
    BattleAnimations.stopAllIdles();
    SoundSystem.play('defeat');
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

  // ─── Bag ──────────────────────────────────────
  let _pendingItemKey = null;

  function bag() {
    SoundSystem.play('menuSelect');
    const listEl   = document.getElementById('bag-items-list');
    const targetEl = document.getElementById('bag-target');
    if (!listEl) return;

    // Reset target picker
    targetEl?.classList.add('hidden');
    _pendingItemKey = null;

    Items.renderBagUI(listEl, (itemKey) => {
      _pendingItemKey = itemKey;
      showBagTarget(itemKey);
    }, Battle.playerTeam, Battle.getPlayer());

    showSection('bag');
  }

  function showBagTarget(itemKey) {
    const targetEl = document.getElementById('bag-target');
    const gridEl   = document.getElementById('bag-target-grid');
    if (!targetEl || !gridEl) return;

    const item = Items.ITEM_DATA[itemKey];
    targetEl.querySelector('.bag-target-label').textContent =
      `Use ${item?.name} on which Pokémon?`;

    gridEl.innerHTML = '';
    Battle.playerTeam.forEach((pkmn, i) => {
      const fainted = BattleEngine.hasFainted(pkmn);
      const btn = document.createElement('button');
      btn.className = `bag-target-btn${fainted ? ' fainted' : ''}`;
      btn.innerHTML = `
        <img src="${pkmn.backSpriteUrl}" alt="${pkmn.name}" />
        <span>${pkmn.name}</span>
        <span style="font-size:10px;color:var(--text-muted)">${Math.max(0,pkmn.currentHP)}/${pkmn.maxHP}</span>
      `;
      btn.addEventListener('click', () => applyItem(itemKey, pkmn, i));
      gridEl.appendChild(btn);
    });

    targetEl.classList.remove('hidden');
  }

  async function applyItem(itemKey, pkmn, pkmnIdx) {
    const result = Items.useOnPokemon(itemKey, pkmn);
    showSection('none'); // lock input
    setMessage(result.message);

    if (result.success) {
      SoundSystem.play('itemUse');
      // Refresh the HP bar of the affected Pokémon
      const isPlayer = pkmnIdx < Battle.playerTeam.length &&
                       Battle.playerTeam[pkmnIdx] === pkmn;
      if (isPlayer) {
        const hpBar  = document.getElementById('player-hp-bar');
        const hpNums = document.getElementById('player-hp-nums');
        await BattleAnimations.drainHP(hpBar, hpNums, pkmn.currentHP, pkmn.maxHP);
      }
      await BattleAnimations.wait(800);

      // CPU uses its turn while player used item (no move chosen by player)
      const enemy   = Battle.getEnemy();
      const player  = Battle.getPlayer();
      const cpuMove = CPU.chooseMove(enemy, player, 2);
      const dummyMove = { name:'(used item)', power:0, accuracy:100, pp:99, currentPP:99, priority:-7, type:'normal', category:'status' };
      const events = BattleEngine.executeTurn(player, enemy, dummyMove, cpuMove);
      await processEvents(events);
    } else {
      await BattleAnimations.wait(1200);
    }

    if (BattleEngine.isTeamDefeated(Battle.playerTeam)) {
      await defeat();
    } else if (BattleEngine.isTeamDefeated(Battle.enemyTeam)) {
      await victory();
    } else {
      showActions();
      setMessage(`What will ${Battle.getPlayer().name} do?`);
    }
  }

  function run() {
    if (Tower.getIsActive()) {
      setMessage("You can't run from a Tower battle!");
      setTimeout(() => showActions(), 1400);
    } else {
      setMessage("Got away safely!");
      SoundSystem.play('menuSelect');
      setTimeout(() => {
        document.getElementById('result-overlay')?.classList.add('hidden');
        Screen.show('screen-menu');
      }, 1000);
    }
  }

  function toggleMute() {
    const muted = SoundSystem.toggleMute();
    const btn   = document.getElementById('mute-btn');
    if (btn) {
      btn.textContent = muted ? '🔇' : '🔊';
      btn.classList.toggle('muted', muted);
    }
  }

  function showSection(which) {
    const actionsEl = document.getElementById('battle-actions');
    const movesEl   = document.getElementById('move-menu');
    const switchEl  = document.getElementById('switch-menu');
    const bagEl     = document.getElementById('bag-menu');

    actionsEl?.classList.toggle('hidden', which !== 'actions');
    movesEl  ?.classList.toggle('hidden', which !== 'moves');
    switchEl ?.classList.toggle('hidden', which !== 'switch');
    bagEl    ?.classList.toggle('hidden', which !== 'bag');

    if (which === 'none') {
      actionsEl?.classList.add('hidden');
      movesEl  ?.classList.add('hidden');
      switchEl ?.classList.add('hidden');
      bagEl    ?.classList.add('hidden');
    }
  }

  // ─── Status badges on info boxes ──────────────
  function refreshStatusBadges() {
    _renderStatusBadge('player', Battle.getPlayer());
    _renderStatusBadge('enemy',  Battle.getEnemy());
  }

  function _renderStatusBadge(side, pkmn) {
    if (!pkmn) return;
    const nameRow = document.querySelector(`.${side === 'player' ? 'player' : 'enemy'}-info .info-name-row`);
    if (!nameRow) return;

    // Remove existing badge
    nameRow.querySelector('.status-badge')?.remove();

    if (!pkmn.status) return;

    const badge = document.createElement('span');
    const labelMap = {
      burned:    ['BRN', 'status-burn'],
      paralyzed: ['PAR', 'status-paralyzed'],
      poisoned:  ['PSN', 'status-poisoned'],
      frozen:    ['FRZ', 'status-frozen'],
      asleep:    ['SLP', 'status-asleep']
    };
    const [label, cls] = labelMap[pkmn.status] || ['???', ''];
    badge.className = `status-badge ${cls}`;
    badge.textContent = label;
    nameRow.appendChild(badge);
  }

  // Refresh the full battle UI after a switch/faint
  function refresh() {
    const player = Battle.getPlayer();
    const enemy  = Battle.getEnemy();
    if (!player || !enemy) return;

    const playerSpriteEl = document.getElementById('player-sprite');
    const enemySpriteEl  = document.getElementById('enemy-sprite');

    // Stop any leftover idles from a previous battle
    BattleAnimations.stopAllIdles();

    // Sprites
    playerSpriteEl.src = player.backSpriteUrl;
    enemySpriteEl.src  = enemy.spriteUrl;

    // Reset any lingering inline styles from previous battle animations
    [playerSpriteEl, enemySpriteEl].forEach(el => {
      el.getAnimations().forEach(a => a.cancel());
      el.style.cssText = '';
    });

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

    // Start idle animations once images load
    playerSpriteEl.onload = () => BattleAnimations.startIdle(playerSpriteEl, 'player');
    enemySpriteEl.onload  = () => BattleAnimations.startIdle(enemySpriteEl,  'enemy');

    // If already cached, start immediately
    if (playerSpriteEl.complete && playerSpriteEl.naturalWidth > 0) {
      BattleAnimations.startIdle(playerSpriteEl, 'player');
    }
    if (enemySpriteEl.complete && enemySpriteEl.naturalWidth > 0) {
      BattleAnimations.startIdle(enemySpriteEl, 'enemy');
    }
  }

  function refreshSide(side) {
    const pkmn = side === 'player' ? Battle.getPlayer() : Battle.getEnemy();
    if (!pkmn) return;

    document.getElementById(`${side}-name`).textContent  = pkmn.name;
    document.getElementById(`${side}-level`).textContent = `Lv.${pkmn.level}`;
    setHPBar(side, pkmn.currentHP, pkmn.maxHP);
    renderTypes(`${side}-types`, pkmn.types);

    // Held item badge
    if (typeof HeldItems !== 'undefined') {
      const infoBox = document.querySelector(`.${side === 'player' ? 'player' : 'enemy'}-info`);
      if (infoBox) {
        infoBox.querySelector('.held-item-badge')?.remove();
        if (pkmn.heldItem) {
          const badge = document.createElement('div');
          badge.className = 'held-item-badge';
          badge.innerHTML = `<span class="item-icon">${HeldItems.getDisplayIcon(pkmn)}</span>${HeldItems.getDisplayName(pkmn)}`;
          infoBox.appendChild(badge);
        }
      }
    }

    // XP bar update for player
    if (side === 'player' && typeof XPSystem !== 'undefined') {
      XPSystem.updateBar('player', pkmn, false);
    }
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
    switchMenu, bag, run, refresh, refreshSide,
    toggleMute, refreshStatusBadges
  };

})();

// ═══════════════════════════════════════════════════
//  HELPER: Level-up toast notification
// ═══════════════════════════════════════════════════
function showLevelUpToast(msg) {
  let toast = document.getElementById('levelup-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'levelup-toast';
    toast.className = 'level-up-toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('show'), 2500);
}

// ═══════════════════════════════════════════════════
//  HELPER: Evolution sequence
// ═══════════════════════════════════════════════════
async function playEvolutionSequence(fromKey, toKey, slotIndex) {
  const fromData = POKEMON_DATA[fromKey];
  const toData   = POKEMON_DATA[toKey];
  if (!fromData || !toData) return;

  const overlay    = document.getElementById('evo-overlay');
  const fromSprite = document.getElementById('evo-from-sprite');
  const toSprite   = document.getElementById('evo-to-sprite');
  const textEl     = document.getElementById('evo-text');
  const resultEl   = document.getElementById('evo-result');
  const resultName = document.getElementById('evo-result-name');
  const continueBtn= document.getElementById('evo-continue-btn');

  if (!overlay) return;

  // Set up overlay
  fromSprite.src   = getSpriteUrl(fromData.id);
  toSprite.src     = getSpriteUrl(toData.id);
  toSprite.style.opacity = '0';
  textEl.textContent = `${fromData.name} is evolving!`;
  resultEl.classList.add('hidden');
  overlay.classList.remove('hidden');

  SoundSystem.play('evolution');

  // Flash sequence — from Pokémon flashes, then fades out and to-Pokémon fades in
  await BattleAnimations.wait(2000);

  fromSprite.animate([
    { opacity: 1 }, { opacity: 0 }
  ], { duration: 600, fill: 'forwards' });
  toSprite.animate([
    { opacity: 0 }, { opacity: 1 }
  ], { duration: 600, fill: 'forwards' });

  await BattleAnimations.wait(700);
  fromSprite.style.opacity = '0';
  toSprite.style.opacity   = '1';

  SoundSystem.play('victory');

  textEl.textContent = `${fromData.name} evolved into...`;
  await BattleAnimations.wait(600);

  resultName.textContent = `${toData.name}!`;
  resultEl.classList.remove('hidden');

  // Perform the actual evolution in data
  EvolutionSystem.evolve(fromKey, toKey, slotIndex);
  TeamBuilder.renderCollection();
  TeamBuilder.renderTeamSlots();

  // Wait for player to click Continue
  return new Promise(resolve => {
    continueBtn.onclick = () => {
      overlay.classList.add('hidden');
      resolve();
    };
  });
}

// ═══════════════════════════════════════════════════
//  GLOBAL ENTRY POINTS (called from HTML)
// ═══════════════════════════════════════════════════

function startBattle(mode) {
  const keys = TeamBuilder.getTeam();
  if (keys.length === 0) {
    TeamBuilder.showToast('Add at least 1 Pokémon to your team!');
    return;
  }

  SoundSystem.play('menuSelect');
  const playerTeam = TeamBuilder.buildBattleTeam(50);

  // Random enemy team scaled to player team size
  const cpuPool  = ['charizard','blastoise','venusaur','pikachu','gengar','snorlax','lapras','machamp','dragonite'];
  const shuffled = cpuPool.sort(() => Math.random() - 0.5);
  const enemyTeam = shuffled.slice(0, Math.min(playerTeam.length, 3))
    .map(k => createPokemonInstance(k, 50))
    .filter(Boolean);

  Screen.show('screen-battle');
  Battle.start(playerTeam, enemyTeam, { tower: false, cpuTier: 2 });
}

async function startTowerBattle() {
  const keys = TeamBuilder.getTeam();
  if (keys.length === 0) {
    TeamBuilder.showToast('Add at least 1 Pokémon to your team first!');
    Screen.show('screen-team');
    return;
  }

  SoundSystem.play('menuSelect');
  Tower.startRun();

  const floorNum  = Tower.getCurrentFloor();
  const floorData = Tower.generateFloor(floorNum);
  const playerTeam= TeamBuilder.buildBattleTeam(50);
  const cpuTier   = CPU.getTierForFloor(floorNum);

  // Show animated floor transition, then start battle
  Screen.show('screen-battle');
  await FloorTransition.show(floorData, false);

  Battle.start(playerTeam, floorData.enemyTeam, { tower: true, cpuTier, floorData });
}

async function afterBattle() {
  document.getElementById('result-overlay').classList.add('hidden');
  SoundSystem.play('menuSelect');

  if (Tower.getIsActive()) {
    Tower.advanceFloor();
    await startTowerBattle();
  } else {
    Screen.show('screen-menu');
  }
}

/** Resume an interrupted tower run from saved floor */
async function resumeTowerRun() {
  const keys = TeamBuilder.getTeam();
  if (keys.length === 0) {
    TeamBuilder.showToast('Add at least 1 Pokémon to your team first!');
    Screen.show('screen-team');
    return;
  }

  SoundSystem.play('menuSelect');
  Tower.resumeRun();

  const floorNum  = Tower.getCurrentFloor();
  const floorData = Tower.generateFloor(floorNum);
  const playerTeam= TeamBuilder.buildBattleTeam(50);
  const cpuTier   = CPU.getTierForFloor(floorNum);

  Screen.show('screen-battle');
  await FloorTransition.show(floorData, false);
  Battle.start(playerTeam, floorData.enemyTeam, { tower: true, cpuTier, floorData });
}

/** Pokédex type filter button handler */
function setDexType(type, btn) {
  document.querySelectorAll('.dex-type-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  Pokedex.setTypeFilter(type);
}

//Commands
window.PokeCheats = (function () {
  const SECRET = "letmein"; // change this to whatever you want

  function check(code) {
    if (code !== SECRET) {
      console.warn("Invalid cheat code");
      return false;
    }
    return true;
  }

  function unlockPokemon(code, pokemonId) {
    if (!check(code)) return;

    if (!POKEMON_DATA[pokemonId]) {
      console.warn("Pokemon not found:", pokemonId);
      return;
    }

    POKEMON_DATA[pokemonId].unlocked = true;

    console.log(`Unlocked ${pokemonId}`);
  }

  function unlockAll(code) {
    if (!check(code)) return;

    Object.keys(POKEMON_DATA).forEach(id => {
      POKEMON_DATA[id].unlocked = true;
    });

    console.log("All Pokémon unlocked");
  }

  function lockAll(code) {
    if (!check(code)) return;

    Object.keys(POKEMON_DATA).forEach(id => {
      POKEMON_DATA[id].unlocked = false;
    });

    console.log("All Pokémon locked");
  }

  function listLocked() {
    return Object.entries(POKEMON_DATA)
      .filter(([_, p]) => !p.unlocked)
      .map(([id]) => id);
  }

  return {
    unlockPokemon,
    unlockAll,
    lockAll,
    listLocked
  };
})();
