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
  if (typeof StoryMode !== 'undefined') StoryMode.init();
  Screen.show('screen-menu');

  // Sound initialises on first click (browser AudioContext policy)
  document.addEventListener('click', () => SoundSystem.init(), { once: true });

  console.log('🎮 PokéArena loaded! Save version:', SaveSystem.get().version);

  // Show "Continue Story" button if a story run is active
  if (typeof StorySave !== 'undefined' && StorySave.hasStarted()) {
    const continueBtn = document.getElementById('menu-continue-btn');
    const storyBtn    = document.getElementById('menu-story-btn');
    if (continueBtn) continueBtn.classList.remove('hidden');
    if (storyBtn)    storyBtn.classList.add('hidden');
  }

  // Init story screens so they're ready
  if (typeof StarterSelect !== 'undefined') StarterSelect.init();
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
  let busy         = false;
  let _battleTurn  = 0;

  // ─── Story mode state ─────────────────────────
  let _storyOnWin  = null;
  let _storyOnLose = null;
  let _storyNPC    = null;
  let _isWild      = false;

  // ─── PvP state ────────────────────────────────
  let isPvP          = false;
  let pvpSlot        = 0;    // 0 = player is side 0, 1 = player is side 1
  let pvpSendMove    = null; // function(moveId)
  let pvpOnOppMove   = null; // function(cb) — registers callback for opponent move

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
    _battleTurn  = 0;
    _storyOnWin  = opts.onWin  || null;
    _storyOnLose = opts.onLose || null;
    _storyNPC    = opts.storyNPC || null;
    _isWild      = opts.isWild || false;

    // PvP setup
    isPvP        = opts.pvp       || false;
    pvpSlot      = opts.slot      ?? 0;
    pvpSendMove  = opts.sendMove  || null;
    pvpOnOppMove = opts.onOpponentMove || null;

    // Reset weather each battle
    if (typeof Weather !== 'undefined') Weather.clear();

    // Attach default held items to all Pokémon
    if (typeof HeldItems !== 'undefined') {
      [...playerTeam, ...enemyTeam].forEach(p => HeldItems.attachDefault(p));
    }

    // Tower HUD
    const hud = document.getElementById('tower-hud');
    if (hud) hud.classList.toggle('hidden', !isTowerMode);

    // Story mode trainer sprite panel
    const trainerPanel = document.getElementById('trainer-sprite-panel');
    const trainerImg   = document.getElementById('trainer-battle-sprite');
    const trainerName  = document.getElementById('trainer-battle-name');
    if (trainerPanel) {
      if (_storyNPC && !_isWild && typeof SpriteManager !== 'undefined') {
        const spriteKey = _storyNPC.sprite || 'default';
        const portrait  = SpriteManager.trainerPortrait(spriteKey);
        SpriteManager.bindToElement(trainerImg, portrait, null, spriteKey);
        if (trainerName) trainerName.textContent = _storyNPC.name || '';
        trainerPanel.classList.remove('hidden');
      } else {
        trainerPanel.classList.add('hidden');
        if (trainerImg)  trainerImg.src = '';
        if (trainerName) trainerName.textContent = '';
      }
    }

    BattleUI.refresh();
    BattleUI.showActions();

    // Ensure result overlay is hidden at battle start
    const resultOverlayEl = document.getElementById('result-overlay');
    if (resultOverlayEl) resultOverlayEl.classList.add('hidden');

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

    // Start weather particles if weather was set by a switch-in ability
    _refreshWeatherFX();

    if (switchInMsgs.length > 0) {
      BattleUI.setMessage(switchInMsgs[0]);
      // Queue each ability message as an ability toast
      switchInMsgs.forEach((msg, i) => {
        setTimeout(() => _showAbilityToast(msg), i * 800);
      });
      setTimeout(() => BattleUI.setMessage(`Go, ${getPlayer().name}!`), switchInMsgs.length * 800 + 400);
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

  // ─── Wait for opponent's move over the network ─
  // pvpOnOppMove is PvP.waitForMove — returns Promise<{ moveId, seed }>
  function waitForOpponentMove() {
    return pvpOnOppMove(); // returns Promise<{ moveId, seed }>
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

    let playerMove, enemyMove;

    if (isPvP && pvpSendMove && pvpOnOppMove) {
      // ── PvP: exchange moves + shared RNG seed ──
      // Generate the seed for this turn on our side and send it with our move.
      // Both clients will use this same seed so every dice roll is identical.
      const turnSeed = BattleEngine.generateSeed();
      pvpSendMove(move.id, turnSeed);
      BattleUI.setMessage('⏳ Waiting for opponent...');

      const { moveId: opponentMoveId, seed: opponentSeed } = await waitForOpponentMove();

      // Opponent fled mid-wait
      if (opponentMoveId === '__opponent_fled__') {
        await opponentFled(null);
        return;
      }

      const opponentMoveObj = enemy.moves.find(m => m.id === opponentMoveId)
        || enemy.moves[0];

      if (pvpSlot === 0) {
        playerMove = move;
        enemyMove  = opponentMoveObj;
      } else {
        playerMove = opponentMoveObj;
        enemyMove  = move;
      }

      // Combine both seeds so neither player controls the outcome unilaterally
      const combinedSeed = (turnSeed ^ opponentSeed) >>> 0;
      BattleEngine.seedRng(combinedSeed);
    } else {
      // ── CPU / local battle ──
      playerMove = move;
      enemyMove  = CPU.chooseMove(enemy, player, cpuTier, {
        cpuTeam: enemyTeam, playerTeam, turnNumber: 0
      });
    }

    // Run the turn through the engine
    _battleTurn++;
    const events = BattleEngine.executeTurn(player, enemy, playerMove, enemyMove);
    BattleEngine.resetRng(); // restore native Math.random for non-engine code

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

            // Check if this message changed weather — refresh FX
            const weatherKeywords = ['sunlight','raining','sandstorm','hailing','snowing','fog','Terrain','weather cleared','faded','stopped','subsided','lifted'];
            if (weatherKeywords.some(w => msg.includes(w))) {
              _refreshWeatherFX();
              _showAbilityToast(msg, 'weather');
            }

            // Ability activation toast for non-weather ability messages
            const abilityKeywords = ['Intimidate','Intimidated','Drizzle','Drought','Sand Stream','Snow Warning',
              'Electric Surge','Psychic Surge','Misty Surge','Grassy Surge','Download','Pressure',
              'Flash Fire','Water Absorb','Volt Absorb','Rough Skin','Iron Barbs','Flame Body',
              'Static','Poison Point','Natural Cure','Regenerator','Speed Boost',
              'Multiscale','Solid Rock','Wonder Guard','blocked'];
            if (abilityKeywords.some(a => msg.includes(a))) {
              _showAbilityToast(msg, 'ability');
            }

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

    // Opponent gets a free attack on the switch
    let switchEnemyMove;
    if (isPvP && pvpOnOppMove) {
      // In PvP, the switch itself is the player's "action" for this turn.
      // Send a special switch signal + our seed and wait for the opponent's move.
      const turnSeed = BattleEngine.generateSeed();
      pvpSendMove && pvpSendMove('__switch__', turnSeed);
      const { moveId: opponentMoveId, seed: opponentSeed } = await waitForOpponentMove();
      if (opponentMoveId === '__opponent_fled__') {
        await opponentFled(null);
        return;
      }
      switchEnemyMove = getEnemy().moves.find(m => m.id === opponentMoveId)
        || getEnemy().moves[0];
      const combinedSeed = (turnSeed ^ opponentSeed) >>> 0;
      BattleEngine.seedRng(combinedSeed);
    } else {
      switchEnemyMove = CPU.chooseMove(getEnemy(), getPlayer(), cpuTier);
    }
    const switchDummy = { name:'(switching)', power:0, accuracy:100, pp:99, currentPP:99, priority:5, type:'normal', category:'status' };
    const events = BattleEngine.executeTurn(getPlayer(), getEnemy(), switchDummy, switchEnemyMove);
    BattleEngine.resetRng();
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
      // floorBonus: 1× on floor 1, grows linearly (floor 10 → 2×, floor 50 → 6×)
      const floorBonus = Math.max(1, 1 + (floor - 1) / 9);

      // Grant XP for each enemy Pokémon defeated
      const evoEvents = [];
      playerTeam.forEach((pkmn, i) => {
        if (BattleEngine.hasFainted(pkmn)) return;

        // Sum XP from all defeated enemies, passing player level for relative scaling
        let totalXP = 0;
        enemyTeam.forEach(enemy => {
          if (typeof XPSystem !== 'undefined') {
            const earnedXP = XPSystem.calcReward(enemy, floorBonus, pkmn.level);
            totalXP += earnedXP;
            if (typeof _lastTowerXP !== 'undefined') _lastTowerXP += earnedXP;
          }
        });

        if (totalXP > 0 && typeof XPSystem !== 'undefined') {
          const levelEvents = XPSystem.grant(pkmn, totalXP);

          // Animate XP bar
          XPSystem.animateGain('player', pkmn, totalXP);

          // Note: we deliberately do NOT persist the level to pokemonLevels —
          // tower runs are independent. Level is saved via Tower.syncPartyLevels().

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

      // Award shop coins: 1 coin per 100 XP earned (approximate)
      if (typeof TowerShop !== 'undefined') {
        let totalEarned = 0;
        enemyTeam.forEach(enemy => {
          playerTeam.forEach(p => {
            if (!BattleEngine.hasFainted(p)) {
              totalEarned += XPSystem.calcReward(enemy, Math.max(1, 1 + (Tower.getCurrentFloor()-2)/9), p.level);
            }
          });
        });
        const coins = TowerShop.awardBattleCoins(totalEarned);
        if (coins > 0) showLevelUpToast(`🪙 +${coins} coins!`);
      }
    }

    const overlay  = document.getElementById('result-overlay');
    const icon     = document.getElementById('result-icon');
    const title    = document.getElementById('result-title');
    const detail   = document.getElementById('result-detail');

    icon.textContent  = '🏆';
    title.textContent = 'Victory!';

    // Story mode: bypass overlay and hand control back to overworld
    if (_storyOnWin) {
      const _tp2 = document.getElementById('trainer-sprite-panel');
      if (_tp2) _tp2.classList.add('hidden');
      const cb = _storyOnWin;
      _storyOnWin  = null;
      _storyOnLose = null;
      busy = false;
      cb();
      return;
    }

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
      // Record win for quick battle
      if (!isTowerMode && !Battle.isStoryBattle()) {
        const rec = _getQBRecord(); rec.wins++; _saveQBRecord(rec);
      }
    }

    overlay.classList.remove('hidden');
    overlay.classList.remove('defeat');
    overlay.classList.add('victory');
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

    // Story mode: no overlay — let overworld handle the blackout
    if (_storyOnLose) {
      const _tp3 = document.getElementById('trainer-sprite-panel');
      if (_tp3) _tp3.classList.add('hidden');
      const cb = _storyOnLose;
      _storyOnWin  = null;
      _storyOnLose = null;
      busy = false;
      cb();
      return;
    }

    detail.textContent = isTowerMode
      ? `You reached Floor ${Tower.getCurrentFloor()}. Keep training!`
      : 'Better luck next time!';

    if (isTowerMode) {
      Tower.clearPendingEgg();
      Tower.endRun();
    } else if (!Battle.isStoryBattle()) {
      // Record loss for quick battle
      const rec = _getQBRecord(); rec.losses++; _saveQBRecord(rec);
    }

    overlay.classList.remove('hidden');
    overlay.classList.remove('victory');
    overlay.classList.add('defeat');
    busy = false;
  }

  // ─── PvP: opponent disconnected / fled ────────
  /**
   * Called when the opponent disconnects mid-battle (from pvp.js socket event,
   * or from the sentinel value returned by waitForOpponentMove).
   * Ends the battle as a win for the local player.
   * @param {string|null} name  - opponent name, or null if already known
   */
  async function opponentFled(name) {
    if (!isPvP) return;
    BattleAnimations.stopAllIdles();
    SoundSystem.play('victory');
    await BattleAnimations.wait(400);

    const overlay = document.getElementById('result-overlay');
    const icon    = document.getElementById('result-icon');
    const title   = document.getElementById('result-title');
    const detail  = document.getElementById('result-detail');

    const oppName = name || 'Opponent';
    icon.textContent  = '🏆';
    title.textContent = 'Victory!';
    detail.textContent = `${oppName} fled the battle!`;
    overlay.classList.remove('hidden');
    busy = false;
  }

  /**
   * Called when the local player hits the Flee button during a PvP battle.
   * Notifies the opponent via the socket before leaving.
   */
  function playerFled() {
    if (isPvP) {
      if (typeof PvP !== 'undefined') PvP.disconnect();
    }
    // Hide trainer sprite panel on exit
    const _tp = document.getElementById('trainer-sprite-panel');
    if (_tp) _tp.classList.add('hidden');

    // Story mode: fleeing counts as a loss
    if (_storyOnLose) {
      const cb = _storyOnLose;
      _storyOnWin  = null;
      _storyOnLose = null;
      cb();
      return;
    }
    Screen.show('screen-menu');
  }

  // Story mode callbacks (set by Battle.start opts)
  _storyOnWin  = null;
  _storyOnLose = null;
  _storyNPC    = null;
  _isWild      = false;

  function isStoryBattle() { return _storyOnWin !== null || _storyOnLose !== null; }
  function fireStoryWin()  {
    const cb = _storyOnWin; _storyOnWin = null; _storyOnLose = null; if (cb) cb();
  }
  function fireStoryLose() {
    const cb = _storyOnLose; _storyOnWin = null; _storyOnLose = null; if (cb) cb();
  }

  async function throwBall(ballKey) {
    const wild   = Battle.getEnemy();
    const item   = Items.ITEM_DATA[ballKey];
    if (!wild || !item) return;

    busy = true;
    const ballName = item.name;

    // Throw animation — bounce ball sprite over enemy
    setMessage(`${Battle.getPlayer().name} threw a ${ballName}!`);
    SoundSystem.play('itemUse');

    // Show a bouncing ball overlay on the enemy sprite
    const enemyWrap = document.querySelector('.ba-enemy-sprite-wrap');
    const ballEl    = document.createElement('div');
    ballEl.className = 'catch-ball-anim';
    ballEl.textContent = '🔴';
    if (enemyWrap) enemyWrap.appendChild(ballEl);

    await BattleAnimations.wait(600);

    // Hide enemy sprite (ball sucks it in)
    const enemySprite = document.getElementById('enemy-sprite');
    if (enemySprite) enemySprite.style.opacity = '0';
    await BattleAnimations.wait(300);
    if (ballEl.parentNode) ballEl.parentNode.removeChild(ballEl);

    // Calculate catch result
    const result = Items.tryCatch(ballKey, wild, _battleTurn);

    // Shake animation (1 shake per success)
    for (let s = 0; s < result.shakes; s++) {
      setMessage('...');
      await BattleAnimations.wait(500);
    }

    if (result.caught) {
      // SUCCESS
      SoundSystem.play('victory');
      setMessage(result.message);
      BattleLog.log(`Caught ${wild.name}!`, 'log-system');
      await BattleAnimations.wait(1200);

      // Unlock Pokémon and add to story party if in story mode
      const wasNew = SaveSystem.unlockPokemon(wild.key);
      if (Battle.isStoryBattle() || Battle.isWild) {
        const added = StorySave.addToParty(wild.key, wild.level);
        if (added) {
          setMessage(`${wild.name} joined your party!`);
          await BattleAnimations.wait(1200);
        } else if (StorySave.getParty().length >= 6) {
          setMessage(`${wild.name} was sent to the PC!`);
          await BattleAnimations.wait(1200);
        }
      }
      if (wasNew) TeamBuilder.renderCollection?.();

      // End battle via victory path
      busy = false;
      if (_storyOnWin) {
        const cb = _storyOnWin;
        _storyOnWin  = null;
        _storyOnLose = null;
        cb();
      } else {
        Screen.show('screen-quickbattle');
      }
    } else {
      // FAILED — enemy breaks free
      if (enemySprite) enemySprite.style.opacity = '1';
      setMessage(result.message);
      await BattleAnimations.wait(1000);

      // Enemy uses its turn
      const enemy  = Battle.getEnemy();
      const player = Battle.getPlayer();
      if (enemy && player && !BattleEngine.hasFainted(enemy)) {
        const cpuMove = CPU.chooseMove(enemy, player, cpuTier);
        const dummyMove = { name:'(threw ball)', power:0, accuracy:100, pp:99, currentPP:99, priority:-7, type:'normal', category:'status' };
        const events = BattleEngine.executeTurn(player, enemy, dummyMove, cpuMove);
        await processEvents(events);
        if (BattleEngine.isTeamDefeated(playerTeam)) { await defeat(); return; }
      }

      busy = false;
      showActions();
      setMessage(`What will ${Battle.getPlayer()?.name} do?`);
    }
  }

  return {
    start,
    playerChoosesMove,
    playerSwitch,
    playerFled,
    opponentFled,
    getPlayer,
    getEnemy,
    isStoryBattle,
    fireStoryWin,
    fireStoryLose,
    get isTower()    { return isTowerMode; },
    get isWild()     { return _isWild; },
    throwBall,
    get playerTeam() { return playerTeam; },
    get enemyTeam()  { return enemyTeam;  }
  };

})();

// ═══════════════════════════════════════════════════
//  WEATHER FX + ABILITY TOAST
// ═══════════════════════════════════════════════════

/** Refresh weather particle canvas and arena class to match current weather. */
function _refreshWeatherFX() {
  if (typeof Weather === 'undefined') return;
  // Weather.updateUI() is called internally by Weather.set/clear,
  // but we may need to restart particles after a mid-battle weather change.
  const canvas = document.getElementById('weather-particle-canvas');
  if (canvas) {
    Weather.stopParticles();
    if (Weather.current() !== 'none') Weather.startParticles(canvas);
  }
}

/** Show a small toast banner for an ability activation or weather change. */
let _toastTimeout = null;
function _showAbilityToast(msg, type = 'ability') {
  let el = document.getElementById('ability-toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'ability-toast';
    document.getElementById('screen-battle')?.appendChild(el);
  }
  el.className = `ability-toast ability-toast-${type}`;
  el.textContent = msg;
  el.classList.add('ability-toast-show');

  clearTimeout(_toastTimeout);
  _toastTimeout = setTimeout(() => {
    el.classList.remove('ability-toast-show');
  }, 2200);
}

// ═══════════════════════════════════════════════════
//  BATTLE UI — Renders and updates the battle screen
// ═══════════════════════════════════════════════════
const BattleUI = (() => {

  function setMessage(msg) {
    const el = document.getElementById('battle-message');
    if (!el) return;
    el.textContent = msg;
    // Brief flash to draw attention to new message
    el.classList.remove('new-msg');
    void el.offsetWidth; // force reflow to restart animation
    el.classList.add('new-msg');
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
      const ppPct   = move.pp > 0 ? Math.round((pp / move.pp) * 100) : 0;
      const ppClass = ppPct <= 25 ? 'low' : ppPct <= 50 ? 'mid' : '';
      const cat     = move.category || 'status';
      const btn     = document.createElement('button');
      btn.className = 'move-btn';
      btn.dataset.type = move.type;
      btn.disabled  = pp <= 0;
      btn.innerHTML = `
        <span>${move.name}</span>
        <div style="display:flex;gap:5px;align-items:center">
          <span class="type-badge type-${move.type} move-btn-type">${move.type}</span>
          <span class="move-btn-cat ${cat}">${cat === 'physical' ? '⚔' : cat === 'special' ? '✨' : '○'}</span>
          ${move.power ? `<span style="font-size:7px;color:var(--text-dim)">Pwr ${move.power}</span>` : ''}
        </div>
        <div class="move-btn-pp">
          <span>${pp}/${move.pp}</span>
          <div class="move-btn-pp-bar">
            <div class="move-btn-pp-fill ${ppClass}" style="width:${ppPct}%"></div>
          </div>
        </div>
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
      // Pokéballs in a wild battle → throw at wild Pokémon directly
      const item = Items.ITEM_DATA[itemKey];
      if (Battle.isWild && item?.category === 'pokeball') {
        showSection('none');
        Battle.throwBall(itemKey);
        return;
      }
      // Pokéballs in non-wild battles can't be used
      if (!Battle.isWild && item?.category === 'pokeball') {
        setMessage("You can't catch a trainer's Pokémon!");
        setTimeout(() => showActions(), 1400);
        return;
      }
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
    // HTML uses ba-name-row inside ba-player-info / ba-enemy-info
    const infoSel = side === 'player' ? '.ba-player-info .ba-name-row' : '.ba-enemy-info .ba-name-row';
    const nameRow = document.querySelector(infoSel);
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

    // Clear all sub-menu grids so previous battle's fainted/items don't bleed through
    const switchGrid = document.getElementById('switch-grid');
    const movesGrid  = document.getElementById('moves-grid');
    const bagList    = document.getElementById('bag-items-list');
    const bagTarget  = document.getElementById('bag-target-grid');
    if (switchGrid) switchGrid.innerHTML = '';
    if (movesGrid)  movesGrid.innerHTML  = '';
    if (bagList)    bagList.innerHTML    = '';
    if (bagTarget)  bagTarget.innerHTML  = '';

    // Ensure we start on the actions panel (not a leftover sub-menu)
    showSection('actions');

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
    document.getElementById('player-level').innerHTML   = `Lv.<b>${player.level}</b>`;
    document.getElementById('enemy-name').textContent   = enemy.name;
    document.getElementById('enemy-level').innerHTML    = `Lv.<b>${enemy.level}</b>`;

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
    document.getElementById(`${side}-level`).innerHTML = `Lv.<b>${pkmn.level}</b>`;
    setHPBar(side, pkmn.currentHP, pkmn.maxHP);
    renderTypes(`${side}-types`, pkmn.types);

    // Held item badge
    if (typeof HeldItems !== 'undefined') {
      const infoBox = document.querySelector(side === 'player' ? '.ba-player-info' : '.ba-enemy-info');
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
    if (nums) nums.innerHTML = `${Math.max(0,current)}<span class="ba-hp-slash">/</span>${max}`;
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

// ─── Quick Battle screen logic ────────────────────
let _qbParty = [];   // keys of selected party for quick battle

function initQuickBattleScreen() {
  // Restore saved QB party (or use existing TeamBuilder team as default)
  try {
    const saved = JSON.parse(localStorage.getItem('pokearena_qb_party') || 'null');
    const savedUnlocked = new Set(SaveSystem.getUnlocked());
    if (saved && Array.isArray(saved)) {
      // Validate saved keys still exist and are unlocked (hardcoded or earned)
      _qbParty = saved.filter(k =>
        POKEMON_DATA[k] && (POKEMON_DATA[k].unlocked === true || savedUnlocked.has(k))
      );
    }
  } catch { _qbParty = []; }

  // Seed from TeamBuilder if empty
  if (_qbParty.length === 0) _qbParty = TeamBuilder.getTeam().slice(0, 6);

  _qbRenderPartyBar();
  _qbRenderPicker('');

  // W/L record
  const rec = _getQBRecord();
  const total = rec.wins + rec.losses;
  document.getElementById('qb-wins').textContent   = rec.wins;
  document.getElementById('qb-losses').textContent = rec.losses;
  document.getElementById('qb-winrate').textContent =
    total === 0 ? '—' : `${Math.round((rec.wins / total) * 100)}%`;
}

function _qbSaveParty() {
  localStorage.setItem('pokearena_qb_party', JSON.stringify(_qbParty));
}

function _qbRenderPartyBar() {
  const slots = document.getElementById('qb-party-slots');
  const fightBtn = document.getElementById('qb-fight-btn');
  if (!slots) return;

  slots.innerHTML = Array.from({ length: 6 }, (_, i) => {
    const key = _qbParty[i];
    if (key && POKEMON_DATA[key]) {
      const p = POKEMON_DATA[key];
      const shiny = TeamBuilder.isShiny ? TeamBuilder.isShiny(key) : false;
      return `<div class="qb-slot qb-slot-filled" onclick="qbRemoveSlot(${i})" title="Remove ${p.name}">
        <img src="${getSpriteUrl(p.id, shiny)}" alt="${p.name}" class="qb-slot-sprite" ${shiny ? 'style="filter:drop-shadow(0 0 4px #f5c518)"' : ''}/>
        <span class="qb-slot-name">${shiny ? '✨' : ''}${p.name}</span>
        <span class="qb-slot-remove">✕</span>
      </div>`;
    }
    return `<div class="qb-slot qb-slot-empty">
      <span class="qb-slot-num">${i + 1}</span>
    </div>`;
  }).join('');

  if (fightBtn) fightBtn.disabled = _qbParty.length === 0;
}

function _qbRenderPicker(filter) {
  const grid = document.getElementById('qb-picker-grid');
  if (!grid) return;

  // Combine hardcoded unlocked AND save-system unlocked
  const savedUnlocked = new Set(SaveSystem.getUnlocked());

  const unlocked = Object.keys(POKEMON_DATA).filter(key => {
    const p = POKEMON_DATA[key];
    if (!p) return false;
    // Show if hardcoded unlocked OR earned through gameplay
    if (p.unlocked !== true && !savedUnlocked.has(key)) return false;
    if (filter && !p.name.toLowerCase().includes(filter.toLowerCase())) return false;
    return true;
  });

  if (unlocked.length === 0) {
    grid.innerHTML = '<div class="qb-picker-empty">No Pokémon found</div>';
    return;
  }

  grid.innerHTML = unlocked.map(key => {
    const p = POKEMON_DATA[key];
    const inParty = _qbParty.includes(key);
    const partyIdx = _qbParty.indexOf(key);
    const shiny = TeamBuilder.isShiny ? TeamBuilder.isShiny(key) : false;
    const spriteUrl = getSpriteUrl(p.id, shiny);
    return `<div class="qb-picker-card ${inParty ? 'qb-in-party' : ''}" 
                 onclick="qbTogglePokemon('${key}')"
                 title="${inParty ? `Remove ${p.name} (slot ${partyIdx+1})` : `Add ${p.name}`}">
      <div class="qb-picker-sprite-wrap">
        <img src="${spriteUrl}" alt="${p.name}" class="qb-picker-sprite"/>
        ${inParty ? `<div class="qb-party-badge">${partyIdx + 1}</div>` : ''}
      </div>
      <div class="qb-picker-name">${p.name}</div>
      <div class="qb-picker-types">
        ${p.types.map(t => `<span class="type-badge type-${t}">${t}</span>`).join('')}
      </div>
      <div class="qb-picker-id">#${String(p.id).padStart(3,'0')}</div>
    </div>`;
  }).join('');
}

function qbTogglePokemon(key) {
  const idx = _qbParty.indexOf(key);
  if (idx >= 0) {
    _qbParty.splice(idx, 1);
  } else {
    if (_qbParty.length >= 6) {
      TeamBuilder.showToast('Party full! Remove a Pokémon first.');
      return;
    }
    _qbParty.push(key);
  }
  _qbSaveParty();
  _qbRenderPartyBar();
  // Refresh picker to update in-party state
  const search = document.getElementById('qb-search')?.value || '';
  _qbRenderPicker(search);
  if (typeof SoundSystem !== 'undefined') SoundSystem.play('menuSelect');
}

function qbRemoveSlot(idx) {
  if (idx >= 0 && idx < _qbParty.length) {
    _qbParty.splice(idx, 1);
    _qbSaveParty();
    _qbRenderPartyBar();
    const search = document.getElementById('qb-search')?.value || '';
    _qbRenderPicker(search);
  }
}

function qbFilterPicker() {
  const val = document.getElementById('qb-search')?.value || '';
  _qbRenderPicker(val);
}

function _getQBRecord() {
  try { return JSON.parse(localStorage.getItem('pokearena_qb_record') || '{"wins":0,"losses":0}'); }
  catch { return { wins: 0, losses: 0 }; }
}
function _saveQBRecord(r) {
  localStorage.setItem('pokearena_qb_record', JSON.stringify(r));
}

function startQuickBattle() {
  if (!_qbParty || _qbParty.length === 0) {
    TeamBuilder.showToast('Add at least 1 Pokémon to your party!');
    return;
  }
  SoundSystem.play('menuSelect');
  const level = parseInt(document.getElementById('quick-battle-level')?.value || '50', 10);
  const tier  = parseInt(document.getElementById('quick-battle-tier')?.value  || '2',  10);

  const playerTeam = _qbParty
    .map(key => {
      const shiny = TeamBuilder.isShiny ? TeamBuilder.isShiny(key) : false;
      return createPokemonInstance(key, level, { shiny });
    })
    .filter(Boolean);

  const cpuPool   = Object.keys(POKEMON_DATA).filter(k => POKEMON_DATA[k] && POKEMON_DATA[k].unlocked !== false);
  const shuffled  = cpuPool.sort(() => Math.random() - 0.5);
  const enemyTeam = shuffled.slice(0, Math.min(playerTeam.length, 3))
    .map(k => createPokemonInstance(k, level, { shiny: Math.random() < 1/512 }))
    .filter(Boolean);

  window._qbTier = tier;
  Screen.show('screen-battle');
  Battle.start(playerTeam, enemyTeam, { tower: false, cpuTier: tier });
}

function startBattle(mode) {
  const keys = TeamBuilder.getTeam();
  if (keys.length === 0) {
    TeamBuilder.showToast('Add at least 1 Pokémon to your team!');
    return;
  }
  SoundSystem.play('menuSelect');
  const level = parseInt(document.getElementById('quick-battle-level')?.value || '50', 10);
  const playerTeam = TeamBuilder.buildBattleTeam(level);

  const cpuPool  = ['charizard','blastoise','venusaur','pikachu','gengar','snorlax','lapras','machamp','dragonite'];
  const shuffled = cpuPool.sort(() => Math.random() - 0.5);
  const enemyTeam = shuffled.slice(0, Math.min(playerTeam.length, 3))
    .map(k => {
      const isShiny = Math.random() < (1/512);
      return createPokemonInstance(k, level, { shiny: isShiny });
    })
    .filter(Boolean);

  Screen.show('screen-battle');
  Battle.start(playerTeam, enemyTeam, { tower: false, cpuTier: 2 });
}

async function startTowerBattle() {
  const lead    = Tower.getSelectedLead();
  let   slotIdx = Tower.getSelectedSlotIdx();

  // Auto-pick first empty slot if none selected
  if (slotIdx < 0) {
    const slots = SaveSystem.getTowerSlots();
    slotIdx = slots.findIndex(s => !s || !s.active);
    if (slotIdx < 0) slotIdx = 0;  // all full — overwrite slot 0
  }

  if (!lead) {
    TeamBuilder.showToast('Choose your lead Pokémon first!');
    return;
  }

  SoundSystem.play('menuSelect');

  if (!Tower.getIsActive()) {
    Tower.startRun(lead, slotIdx);
  }

  await _runTowerFloor();
}

/** Run one floor (used by both startTowerBattle and afterBattle advancement). */
async function _runTowerFloor() {
  const floorNum  = Tower.getCurrentFloor();
  const floorData = Tower.generateFloor(floorNum);
  const playerTeam= Tower.buildRunParty();
  const cpuTier   = CPU.getTierForFloor(floorNum);

  // Stash the egg so we can award it after the battle
  if (floorData.egg) Tower.setPendingEgg(floorData.egg);

  Screen.show('screen-battle');
  await FloorTransition.show(floorData, false);

  // Apply random floor weather before battle starts
  if (floorData.weather && typeof Weather !== 'undefined') {
    Weather.set(floorData.weather, 8);  // lasts 8 turns
  }

  Battle.start(playerTeam, floorData.enemyTeam, { tower: true, cpuTier, floorData });
}

async function afterBattle() {
  document.getElementById('result-overlay').classList.add('hidden');
  SoundSystem.play('menuSelect');

  // Tower mode takes priority — isTowerMode is set when battle starts and
  // never changed mid-battle, so this is reliable even if story state is stale
  if (Battle.isTower) {
    // endRun() is called by defeat(), so if tower is no longer active we lost
    if (!Tower.getIsActive()) {
      // Defeat — run already ended, go back to tower menu
      Screen.show('screen-tower-menu');
      return;
    }

    // Victory — advance to next floor
    if (typeof TowerShop !== 'undefined' && typeof _lastTowerXP !== 'undefined') {
      TowerShop.awardBattleCoins(_lastTowerXP);
      _lastTowerXP = 0;
    }
    Tower.syncPartyLevels(Battle.playerTeam || []);
    Tower.advanceFloor();

    const egg = Tower.getPendingEgg();
    if (egg) {
      Tower.clearPendingEgg();
      await EggHatch.show(egg);
    }

    const currentFloorData = Tower.generateFloor(Tower.getCurrentFloor() - 1);
    if (currentFloorData.hasShop && typeof TowerShop !== 'undefined') {
      await TowerShop.show();
    }

    await _runTowerFloor();
    return;
  }

  // Story mode win callback
  if (Battle.isStoryBattle()) {
    Battle.fireStoryWin();
    return;
  }

  // Regular CPU / PvP — return to whichever screen launched this battle
  // Quick battles go back to quick battle screen; PvP goes to online screen
  Screen.show('screen-quickbattle');
}

/** Resume an interrupted tower run from saved floor */
async function resumeTowerRun() {
  const slotIdx = Tower.getSelectedSlotIdx();
  SoundSystem.play('menuSelect');
  Tower.resumeRun(slotIdx >= 0 ? slotIdx : undefined);
  await _runTowerFloor();
}

/** Pokédex type filter button handler */
function setDexType(type, btn) {
  document.querySelectorAll('.dex-type-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  Pokedex.setTypeFilter(type);
}

// ═══════════════════════════════════════════════════
//  CHEAT / DEBUG CONSOLE
//  Usage: open browser console and type commands like:
//
//  PokeCheats.help()
//  PokeCheats.unlock('letmein', 'mewtwo')
//  PokeCheats.unlockAll('letmein')
//  PokeCheats.setLevel('letmein', 'pikachu', 50)
//  PokeCheats.giveItem('letmein', 'fullRestore', 10)
//  PokeCheats.fillBag('letmein')
//  PokeCheats.setFloor('letmein', 50)
//  PokeCheats.addBadge('letmein', 0)
//  PokeCheats.allBadges('letmein')
//  PokeCheats.warpTo('letmein', 'pewterCity')
//  PokeCheats.addToStoryParty('letmein', 'charizard')
//  PokeCheats.setStoryPokemonLevel('letmein', 'charizard', 50)
//  PokeCheats.healStoryParty('letmein')
//  PokeCheats.addEgg('letmein', 'legendary')
//  PokeCheats.setTowerFloor('letmein', 50)
//  PokeCheats.status()
//  PokeCheats.resetStory('letmein')
//  PokeCheats.resetAll('letmein')
// ═══════════════════════════════════════════════════

window.PokeCheats = (function () {

  const SECRET = 'letmein';  // change to whatever you want

  // ── Auth ──────────────────────────────────────
  function _auth(code) {
    if (code !== SECRET) {
      _log('❌ Wrong code. Usage: PokeCheats.help()', 'error');
      return false;
    }
    return true;
  }

  // ── Output ────────────────────────────────────
  function _log(msg, type = 'info') {
    const styles = {
      info:    'color:#4e8cff',
      success: 'color:#3ddc84',
      warn:    'color:#f5c518',
      error:   'color:#e8304a',
    };
    console.log('%c[PokeCheats] ' + msg, styles[type] || styles.info);
  }

  function _pkmn(key) {
    return POKEMON_DATA[key] || POKEMON_DATA[key?.toLowerCase()];
  }

  // ════════════════════════════════════════════════
  //  HELP
  // ════════════════════════════════════════════════

  function help() {
    console.log('%cPokéArena Cheats — all commands need the secret code as first argument', 'color:#b06aff;font-weight:bold');
    const cmds = [
      ['help()',                                    'Show this help'],
      ['status()',                                  'Show current game state (no code needed)'],
      ['unlock(code, "pokemonKey")',                'Unlock a specific Pokémon'],
      ['unlockAll(code)',                           'Unlock all 898 Pokémon'],
      ['lock(code, "pokemonKey")',                  'Lock a specific Pokémon'],
      ['lockAll(code)',                             'Lock all Pokémon (reset collection)'],
      ['setLevel(code, "key", level)',              'Set quick-battle/tower level for a Pokémon'],
      ['giveItem(code, "itemKey", amount)',         'Add items to bag (e.g. "fullRestore", "revive")'],
      ['fillBag(code)',                             'Max out all bag items'],
      ['clearBag(code)',                            'Empty all bag items'],
      ['setTowerFloor(code, floor)',                'Jump to a tower floor (must be in a run)'],
      ['addEgg(code, "rarity")',                    'Hatch an egg in the current tower run (common/uncommon/rare/epic/legendary)'],
      ['addToStoryParty(code, "key")',              'Add a Pokémon to story party'],
      ['setStoryPokemonLevel(code, "key", level)', 'Set story party member level'],
      ['healStoryParty(code)',                      'Fully heal story party'],
      ['addBadge(code, badgeIndex)',                'Earn a gym badge 0-7 (0=Brock, 7=Giovanni)'],
      ['allBadges(code)',                           'Earn all 8 gym badges'],
      ['warpTo(code, "mapId")',                     'Warp overworld to a map'],
      ['resetStory(code)',                          'Reset story mode progress only'],
      ['resetAll(code)',                            'Full game reset (destructive!)'],
      ['listPokemon(filter)',                       'List Pokémon keys (optional: "unlocked"/"locked")'],
      ['listMaps()',                                'List available map IDs'],
      ['listItems()',                               'List all item keys and current counts'],
    ];
    cmds.forEach(([cmd, desc]) => {
      console.log(`%c  PokeCheats.${cmd.padEnd(46)} %c${desc}`,
        'color:#eef0ff', 'color:#7a80b0');
    });
    return '☝️ See above';
  }

  // ════════════════════════════════════════════════
  //  STATUS (no auth needed)
  // ════════════════════════════════════════════════

  function status() {
    const save     = SaveSystem.get();
    const unlocked = SaveSystem.getUnlocked().length;
    const total    = Object.keys(POKEMON_DATA).length;
    const team     = SaveSystem.getTeam();
    const inv      = SaveSystem.getInventory();

    console.group('%c📊 PokéArena Status', 'color:#b06aff;font-weight:bold');

    console.log('%cCollection', 'color:#f5c518;font-weight:bold');
    console.log(`  Unlocked: ${unlocked}/${total}`);
    console.log(`  Quick Battle Team: ${team.map(k => POKEMON_DATA[k]?.name || k).join(', ') || '(empty)'}`);

    console.log('%cInventory', 'color:#f5c518;font-weight:bold');
    Object.entries(inv).forEach(([k, v]) => console.log(`  ${k}: ${v}`));

    console.log('%cTower', 'color:#f5c518;font-weight:bold');
    console.log(`  Best Floor: ${SaveSystem.getBestFloor()}`);
    console.log(`  Active Run: ${save.towerRun > 0 ? 'Floor ' + save.towerRun : 'None'}`);
    const towerParty = save.towerParty || [];
    if (towerParty.length) {
      console.log(`  Run Party: ${towerParty.map(m => `${POKEMON_DATA[m.key]?.name||m.key} Lv${m.level}`).join(', ')}`);
    }

    if (typeof StorySave !== 'undefined' && StorySave.hasStarted()) {
      console.log('%cStory Mode', 'color:#f5c518;font-weight:bold');
      console.log(`  Player: ${StorySave.getPlayerName()}  Rival: ${StorySave.getRivalName()}`);
      console.log(`  Location: ${StorySave.getLocation()}`);
      console.log(`  Badges: ${StorySave.getBadgeCount()}/8`);
      const party = StorySave.getParty();
      if (party.length) {
        console.log(`  Party: ${party.map(m => `${POKEMON_DATA[m.key]?.name||m.key} Lv${m.level}`).join(', ')}`);
      }
    } else {
      console.log('%cStory Mode', 'color:#f5c518;font-weight:bold');
      console.log('  Not started');
    }

    console.groupEnd();
    return '✅ See above';
  }

  // ════════════════════════════════════════════════
  //  COLLECTION
  // ════════════════════════════════════════════════

  function unlock(code, key) {
    if (!_auth(code)) return;
    const d = _pkmn(key);
    if (!d) { _log(`Unknown Pokémon: ${key}`, 'error'); return; }
    const wasNew = SaveSystem.unlockPokemon(key.toLowerCase());
    if (typeof TeamBuilder !== 'undefined') TeamBuilder.renderCollection();
    if (typeof Tower !== 'undefined') Tower.refreshLeadPicker();
    _log(`${wasNew ? 'Unlocked' : 'Already had'} ${d.name} ✓`, wasNew ? 'success' : 'warn');
  }

  function unlockAll(code) {
    if (!_auth(code)) return;
    let count = 0;
    Object.keys(POKEMON_DATA).forEach(key => {
      if (SaveSystem.unlockPokemon(key)) count++;
    });
    if (typeof TeamBuilder !== 'undefined') TeamBuilder.renderCollection();
    if (typeof Tower !== 'undefined') Tower.refreshLeadPicker();
    _log(`Unlocked ${count} new Pokémon (${Object.keys(POKEMON_DATA).length} total) ✓`, 'success');
  }

  function lock(code, key) {
    if (!_auth(code)) return;
    const d = _pkmn(key);
    if (!d) { _log(`Unknown Pokémon: ${key}`, 'error'); return; }
    const k = key.toLowerCase();
    const save = SaveSystem.get();
    save.unlocked = save.unlocked.filter(x => x !== k);
    if (POKEMON_DATA[k]) POKEMON_DATA[k].unlocked = false;
    SaveSystem.save();
    if (typeof TeamBuilder !== 'undefined') TeamBuilder.renderCollection();
    _log(`Locked ${d.name}`, 'warn');
  }

  function lockAll(code) {
    if (!_auth(code)) return;
    const save = SaveSystem.get();
    save.unlocked = [];
    Object.values(POKEMON_DATA).forEach(d => d.unlocked = false);
    SaveSystem.save();
    if (typeof TeamBuilder !== 'undefined') TeamBuilder.renderCollection();
    _log('All Pokémon locked', 'warn');
  }

  function listPokemon(filter) {
    const entries = Object.entries(POKEMON_DATA);
    let list;
    if (filter === 'unlocked')     list = entries.filter(([,d]) => d.unlocked);
    else if (filter === 'locked')  list = entries.filter(([,d]) => !d.unlocked);
    else                           list = entries;
    console.table(list.map(([key, d]) => ({
      key, name: d.name, id: d.id,
      types: d.types?.join('/'),
      unlocked: d.unlocked,
    })));
    return `${list.length} Pokémon listed`;
  }

  // ════════════════════════════════════════════════
  //  SHINIES
  // ════════════════════════════════════════════════

  function unlockShiny(code, key) {
    if (!_auth(code)) return;
    const d = _pkmn(key);
    if (!d) { _log(`Unknown Pokémon: ${key}`, 'error'); return; }
    const k = key.toLowerCase();
    const wasNew = SaveSystem.unlockShiny(k);
    if (typeof TeamBuilder !== 'undefined') TeamBuilder.renderTeamSlots();
    _log(`${wasNew ? 'Unlocked' : 'Already had'} ✨ Shiny ${d.name} ✓`, wasNew ? 'success' : 'warn');
  }

  function unlockAllShinies(code) {
    if (!_auth(code)) return;
    let count = 0;
    Object.keys(POKEMON_DATA).forEach(key => {
      if (SaveSystem.unlockShiny(key)) count++;
    });
    if (typeof TeamBuilder !== 'undefined') TeamBuilder.renderTeamSlots();
    _log(`Unlocked ${count} shinies ✓`, 'success');
  }

  function lockShiny(code, key) {
    if (!_auth(code)) return;
    const d = _pkmn(key);
    if (!d) { _log(`Unknown Pokémon: ${key}`, 'error'); return; }
    SaveSystem.lockShiny(key.toLowerCase());
    _log(`Locked shiny ${d.name}`, 'warn');
  }

  function lockAllShinies(code) {
    if (!_auth(code)) return;
    Object.keys(POKEMON_DATA).forEach(k => SaveSystem.lockShiny(k));
    _log('All shinies locked', 'warn');
  }

  // ════════════════════════════════════════════════
  //  LEVELS
  // ════════════════════════════════════════════════

  function setLevel(code, key, level) {
    if (!_auth(code)) return;
    const d = _pkmn(key);
    if (!d) { _log(`Unknown Pokémon: ${key}`, 'error'); return; }
    const lv = Math.max(1, parseInt(level));
    SaveSystem.setTowerLevel(key.toLowerCase(), lv);
    _log(`Set ${d.name} quick-battle/tower level → ${lv} ✓`, 'success');
  }

  // ════════════════════════════════════════════════
  //  ITEMS / BAG
  // ════════════════════════════════════════════════

  const ITEM_KEYS = [
    'potion','superPotion','fullRestore','revive','fullRevive',
    'xAttack','xDefense','xSpeed',
  ];

  function giveItem(code, itemKey, amount = 1) {
    if (!_auth(code)) return;
    if (!ITEM_KEYS.includes(itemKey)) {
      _log(`Unknown item: "${itemKey}". Valid: ${ITEM_KEYS.join(', ')}`, 'error');
      return;
    }
    const n = Math.max(1, parseInt(amount));
    SaveSystem.addItem(itemKey, n);
    _log(`Added ${n}× ${itemKey}  (now: ${SaveSystem.getItemCount(itemKey)}) ✓`, 'success');
  }

  function fillBag(code) {
    if (!_auth(code)) return;
    const amounts = { potion:99, superPotion:99, fullRestore:99,
                      revive:99, fullRevive:99, xAttack:99,
                      xDefense:99, xSpeed:99 };
    Object.entries(amounts).forEach(([k, v]) => {
      const current = SaveSystem.getItemCount(k);
      if (v > current) SaveSystem.addItem(k, v - current);
    });
    _log('Bag maxed out ✓', 'success');
  }

  function clearBag(code) {
    if (!_auth(code)) return;
    const inv = SaveSystem.get().inventory;
    ITEM_KEYS.forEach(k => { inv[k] = 0; });
    SaveSystem.save();
    _log('Bag cleared', 'warn');
  }

  function listItems() {
    const inv = SaveSystem.getInventory();
    console.table(Object.fromEntries(ITEM_KEYS.map(k => [k, inv[k] ?? 0])));
    return 'Items listed above';
  }

  // ════════════════════════════════════════════════
  //  TOWER
  // ════════════════════════════════════════════════

  function setTowerFloor(code, floor) {
    if (!_auth(code)) return;
    if (!Tower.getIsActive()) {
      _log('No active tower run. Start a run first.', 'error');
      return;
    }
    const f = Math.max(1, parseInt(floor));
    const save = SaveSystem.get();
    save.towerRun = f;
    SaveSystem.save();
    // Also update the internal floor counter via advanceFloor trick
    // We directly set via save since Tower.currentFloor is private
    _log(`Tower floor set to ${f}. The next floor transition will show floor ${f}.`, 'success');
    _log('Tip: the change takes effect on your next battle.', 'info');
  }

  function addEgg(code, rarityId = 'common') {
    if (!_auth(code)) return;
    if (!Tower.getIsActive()) {
      _log('No active tower run. This adds an egg to the current run party.', 'error');
      return;
    }
    const rid = rarityId.toUpperCase();
    if (!Tower.RARITY[rid]) {
      _log(`Unknown rarity: "${rarityId}". Use: common/uncommon/rare/epic/legendary`, 'error');
      return;
    }
    const egg = Tower.rollEgg();
    // Override with requested rarity
    const forced = (() => {
      const rd = Tower.RARITY[rid];
      const pool = rd.pool.filter(k => POKEMON_DATA[k]);
      if (!pool.length) return null;
      const key = pool[Math.floor(Math.random() * pool.length)];
      return { rarity: rid, rarityData: rd, key, name: POKEMON_DATA[key]?.name || key };
    })();
    if (!forced) { _log('No valid Pokémon in that rarity pool.', 'error'); return; }
    Tower.setPendingEgg(forced);
    _log(`${forced.rarityData.label} egg (${POKEMON_DATA[forced.key]?.name}) queued — it will hatch after your next battle. ✓`, 'success');
  }

  // ════════════════════════════════════════════════
  //  STORY MODE
  // ════════════════════════════════════════════════

  function addToStoryParty(code, key) {
    if (!_auth(code)) return;
    if (typeof StorySave === 'undefined' || !StorySave.hasStarted()) {
      _log('Story mode not started.', 'error'); return;
    }
    const d = _pkmn(key);
    if (!d) { _log(`Unknown Pokémon: ${key}`, 'error'); return; }
    const k = key.toLowerCase();
    const added = StorySave.addToParty(k, 5);
    SaveSystem.unlockPokemon(k);
    _log(added ? `${d.name} added to story party ✓` : `Party full (6/6) — couldn't add ${d.name}`, added ? 'success' : 'warn');
  }

  function setStoryPokemonLevel(code, key, level) {
    if (!_auth(code)) return;
    if (typeof StorySave === 'undefined' || !StorySave.hasStarted()) {
      _log('Story mode not started.', 'error'); return;
    }
    const d = _pkmn(key);
    if (!d) { _log(`Unknown Pokémon: ${key}`, 'error'); return; }
    const lv  = Math.max(1, parseInt(level));
    const k   = key.toLowerCase();
    const xp  = typeof XPSystem !== 'undefined' ? XPSystem.xpForLevel(lv) : 0;
    StorySave.updatePartyMember(k, lv, xp);
    _log(`${d.name} story level → ${lv} ✓`, 'success');
  }

  function healStoryParty(code) {
    if (!_auth(code)) return;
    if (typeof StorySave === 'undefined' || !StorySave.hasStarted()) {
      _log('Story mode not started.', 'error'); return;
    }
    // createPokemonInstance always creates at full HP — just reset xp to floor
    const party = StorySave.getParty();
    party.forEach(m => {
      const xp = typeof XPSystem !== 'undefined' ? XPSystem.xpForLevel(m.level) : 0;
      StorySave.updatePartyMember(m.key, m.level, xp);
    });
    _log(`Healed ${party.length} Pokémon in story party ✓`, 'success');
  }

  function addBadge(code, index) {
    if (!_auth(code)) return;
    if (typeof StorySave === 'undefined' || !StorySave.hasStarted()) {
      _log('Story mode not started.', 'error'); return;
    }
    const i = parseInt(index);
    if (isNaN(i) || i < 0 || i > 7) {
      _log('Badge index must be 0-7 (0=Brock, 1=Misty, 2=Lt.Surge, 3=Erika, 4=Koga, 5=Sabrina, 6=Blaine, 7=Giovanni)', 'error');
      return;
    }
    StorySave.earnBadge(i);
    const names = ['Boulder','Cascade','Thunder','Rainbow','Soul','Marsh','Volcano','Earth'];
    _log(`Earned ${names[i]} Badge ✓`, 'success');
  }

  function allBadges(code) {
    if (!_auth(code)) return;
    if (typeof StorySave === 'undefined' || !StorySave.hasStarted()) {
      _log('Story mode not started.', 'error'); return;
    }
    for (let i = 0; i < 8; i++) StorySave.earnBadge(i);
    _log('All 8 gym badges earned ✓', 'success');
  }

  function warpTo(code, mapId) {
    if (!_auth(code)) return;
    if (typeof MapData === 'undefined') { _log('MapData not loaded.', 'error'); return; }
    const map = MapData.getMap(mapId);
    if (!map) {
      _log(`Unknown map: "${mapId}". Use PokeCheats.listMaps()`, 'error');
      return;
    }
    StorySave.setLocation(mapId);
    if (typeof Overworld !== 'undefined') {
      Screen.show('screen-overworld');
      Overworld.init();
    }
    _log(`Warped to ${map.name} ✓`, 'success');
  }

  function listMaps() {
    if (typeof MapData === 'undefined') { _log('MapData not loaded.', 'error'); return; }
    const maps = MapData.listMaps().map(id => {
      const m = MapData.getMap(id);
      return { id, name: m?.name, theme: m?.theme };
    });
    console.table(maps);
    return 'Maps listed above';
  }

  // ════════════════════════════════════════════════
  //  RESETS
  // ════════════════════════════════════════════════

  function resetStory(code) {
    if (!_auth(code)) return;
    if (typeof StorySave === 'undefined') { _log('StorySave not loaded.', 'error'); return; }
    StorySave.resetStory();
    _log('Story mode reset. Start fresh from the main menu.', 'warn');
  }

  function resetAll(code) {
    if (!_auth(code)) return;
    const confirmed = window.confirm('⚠️ This will delete ALL save data. Are you sure?');
    if (!confirmed) { _log('Reset cancelled.', 'info'); return; }
    SaveSystem.reset();
    _log('All save data wiped. Reload the page to start fresh.', 'warn');
    setTimeout(() => location.reload(), 1500);
  }

  // ════════════════════════════════════════════════
  //  PUBLIC
  // ════════════════════════════════════════════════

  _log('PokéArena cheats loaded. Type PokeCheats.help() to see all commands.', 'info');

  return {
    help, status,
    // Collection + Shinies
    unlock, unlockAll, lock, lockAll, listPokemon,
    unlockShiny, unlockAllShinies, lockShiny, lockAllShinies,
    // Levels
    setLevel,
    // Items
    giveItem, fillBag, clearBag, listItems,
    // Tower
    setTowerFloor, addEgg,
    // Story
    addToStoryParty, setStoryPokemonLevel, healStoryParty,
    addBadge, allBadges, warpTo, listMaps,
    // Resets
    resetStory, resetAll,
    // Legacy aliases
    unlockPokemon: unlock,
    lockAll,
    listLocked: () => listPokemon('locked'),
  };

})();
