// ═══════════════════════════════════════════════════
//  src/battle/engine.js
//  Core battle logic — damage, accuracy, effects,
//  turn ordering, and win condition checks.
//  This is the heart of the game.
// ═══════════════════════════════════════════════════

const BattleEngine = (() => {

  // ─── Stat stage multipliers ────────────────────
  // Stages run from -6 to +6
  const STAGE_MULT = {
    '-6': 2/8, '-5': 2/7, '-4': 2/6, '-3': 2/5,
    '-2': 2/4, '-1': 2/3,  '0': 1,
     '1': 3/2,  '2': 4/2,  '3': 5/2,
     '4': 6/2,  '5': 7/2,  '6': 8/2
  };

  /**
   * Get the effective value of a stat after applying stages.
   * @param {number} baseStat - The stat's base battle value
   * @param {number} stage    - Current stage (-6 to +6)
   */
  function applyStage(baseStat, stage) {
    return Math.floor(baseStat * (STAGE_MULT[String(stage)] || 1));
  }

  // ─── Damage Formula ────────────────────────────
  /**
   * Calculates raw damage dealt by attacker using move against defender.
   * Based on Gen 5+ damage formula.
   *
   * @param {object} attacker - Pokémon instance
   * @param {object} defender - Pokémon instance
   * @param {object} move     - Move object from MOVES_DATA
   * @returns {object} { damage, effectiveness, isCrit, effectivenessText }
   */
  function calculateDamage(attacker, defender, move) {
    if (move.power === 0) {
      // Status move — no damage
      return { damage: 0, effectiveness: 1, isCrit: false, effectivenessText: '' };
    }

    const level = attacker.level;

    // Pick correct offensive/defensive stats based on move category
    let atkStat, defStat;
    if (move.category === 'physical') {
      atkStat = applyStage(attacker.stats.attack,  attacker.stages.attack);
      defStat = applyStage(defender.stats.defense, defender.stages.defense);
    } else {
      atkStat = applyStage(attacker.stats.spatk, attacker.stages.spatk);
      defStat = applyStage(defender.stats.spdef, defender.stages.spdef);
    }

    // Core formula
    let base = Math.floor(
      (((2 * level / 5 + 2) * move.power * atkStat / defStat) / 50) + 2
    );

    // STAB (Same-Type Attack Bonus) = 1.5×
    const stab = attacker.types.includes(move.type) ? 1.5 : 1;

    // Type effectiveness
    const effectiveness = getTypeEffectiveness(move.type, defender.types);

    // Critical hit — 1/16 base chance (simplified)
    const isCrit = Math.random() < 0.0625;
    const critMult = isCrit ? 1.5 : 1;

    // Random roll: 85–100%
    const random = 0.85 + Math.random() * 0.15;

    // Burn halves physical damage
    const burnMult = (attacker.status === 'burned' && move.category === 'physical') ? 0.5 : 1;

    const damage = Math.max(1,
      Math.floor(base * stab * effectiveness * critMult * random * burnMult)
    );

    return {
      damage,
      effectiveness,
      effectivenessText: getEffectivenessText(effectiveness),
      isCrit
    };
  }

  // ─── Accuracy Check ────────────────────────────
  /**
   * Returns true if the move hits.
   * Accuracy can be modified by evasion/accuracy stages (future).
   */
  function accuracyCheck(move, attacker, defender) {
    if (move.accuracy >= 999) return true;   // "never misses"
    if (defender.status === 'frozen' && move.type === 'fire') return true; // thaw

    // Status conditions that affect action
    if (attacker.status === 'paralyzed' && Math.random() < 0.25) return false; // can't move
    if (attacker.status === 'asleep') return false;                             // can't move

    return Math.random() * 100 < move.accuracy;
  }

  // ─── Turn Order ────────────────────────────────
  /**
   * Determine which side moves first this turn.
   * Priority moves > speed. Ties broken randomly.
   *
   * @param {object} p1Move - Move chosen by side 0
   * @param {object} p2Move - Move chosen by side 1
   * @param {object} p1     - Pokémon instance side 0
   * @param {object} p2     - Pokémon instance side 1
   * @returns {number[]} [firstIdx, secondIdx] where 0 = player, 1 = enemy
   */
  function getTurnOrder(p1Move, p2Move, p1, p2) {
    const p1Priority = p1Move.priority || 0;
    const p2Priority = p2Move.priority || 0;

    if (p1Priority !== p2Priority) {
      return p1Priority > p2Priority ? [0, 1] : [1, 0];
    }

    const p1Speed = applyStage(p1.stats.speed, p1.stages.speed);
    const p2Speed = applyStage(p2.stats.speed, p2.stages.speed);

    if (p1Speed !== p2Speed) {
      return p1Speed > p2Speed ? [0, 1] : [1, 0];
    }

    // Speed tie — coin flip
    return Math.random() < 0.5 ? [0, 1] : [1, 0];
  }

  // ─── Apply Move Effects ────────────────────────
  /**
   * Applies secondary effects of a move (status, stat changes).
   * Returns an array of log strings describing what happened.
   *
   * @param {string} effectStr - The move's effect string
   * @param {object} attacker
   * @param {object} defender
   * @returns {string[]} messages
   */
  function applyEffect(effectStr, attacker, defender) {
    if (!effectStr) return [];
    const msgs = [];

    // ── Status infliction ──
    if (effectStr.startsWith('burn')) {
      const chance = parseInt(effectStr.split('_')[1]) || 100;
      if (!defender.status && Math.random() * 100 < chance) {
        defender.status = 'burned';
        msgs.push(`${defender.name} was burned!`);
      }
    }
    if (effectStr.startsWith('paralysis')) {
      const chance = parseInt(effectStr.split('_')[1]) || 100;
      if (!defender.status && Math.random() * 100 < chance) {
        defender.status = 'paralyzed';
        msgs.push(`${defender.name} is paralyzed! It may be unable to move!`);
      }
    }
    if (effectStr.startsWith('poison') && !effectStr.includes('Powder')) {
      const chance = parseInt(effectStr.split('_')[1]) || 100;
      if (!defender.status && Math.random() * 100 < chance) {
        defender.status = 'poisoned';
        msgs.push(`${defender.name} was poisoned!`);
      }
    }
    if (effectStr === 'poison') {
      if (!defender.status) {
        defender.status = 'poisoned';
        msgs.push(`${defender.name} was poisoned!`);
      }
    }
    if (effectStr.startsWith('freeze')) {
      const chance = parseInt(effectStr.split('_')[1]) || 100;
      if (!defender.status && Math.random() * 100 < chance) {
        defender.status = 'frozen';
        msgs.push(`${defender.name} was frozen solid!`);
      }
    }
    if (effectStr === 'sleep') {
      if (!defender.status) {
        defender.status = 'asleep';
        defender._sleepTurns = 1 + Math.floor(Math.random() * 3); // 1–3 turns
        msgs.push(`${defender.name} fell asleep!`);
      }
    }

    // ── Attacker self heal ──
    if (effectStr === 'heal_50') {
      const healed = Math.floor(attacker.maxHP * 0.5);
      attacker.currentHP = Math.min(attacker.maxHP, attacker.currentHP + healed);
      msgs.push(`${attacker.name} restored HP!`);
    }
    if (effectStr === 'rest') {
      attacker.status = 'asleep';
      attacker._sleepTurns = 2;
      attacker.currentHP = attacker.maxHP;
      msgs.push(`${attacker.name} went to sleep and restored HP!`);
    }

    // ── Stat changes ──
    if (effectStr === 'atk_up_2') {
      attacker.stages.attack = Math.min(6, attacker.stages.attack + 2);
      msgs.push(`${attacker.name}'s Attack sharply rose!`);
    }
    if (effectStr === 'def_up') {
      attacker.stages.defense = Math.min(6, attacker.stages.defense + 1);
      msgs.push(`${attacker.name}'s Defense rose!`);
    }
    if (effectStr === 'def_up_2') {
      attacker.stages.defense = Math.min(6, attacker.stages.defense + 2);
      msgs.push(`${attacker.name}'s Defense sharply rose!`);
    }
    if (effectStr === 'atk_down') {
      defender.stages.attack = Math.max(-6, defender.stages.attack - 1);
      msgs.push(`${defender.name}'s Attack fell!`);
    }
    if (effectStr === 'defspdef_down') {
      defender.stages.defense = Math.max(-6, defender.stages.defense - 1);
      defender.stages.spdef  = Math.max(-6, defender.stages.spdef  - 1);
      attacker.stages.defense = Math.max(-6, attacker.stages.defense - 1);
      attacker.stages.spdef   = Math.max(-6, attacker.stages.spdef  - 1);
      msgs.push(`${attacker.name}'s defenses fell!`);
    }
    if (effectStr === 'spdef_down_10' && Math.random() < 0.1) {
      defender.stages.spdef = Math.max(-6, defender.stages.spdef - 1);
      msgs.push(`${defender.name}'s Sp. Def fell!`);
    }
    if (effectStr === 'spdef_down_20' && Math.random() < 0.2) {
      defender.stages.spdef = Math.max(-6, defender.stages.spdef - 1);
      msgs.push(`${defender.name}'s Sp. Def fell!`);
    }
    if (effectStr === 'def_down_30' && Math.random() < 0.3) {
      defender.stages.defense = Math.max(-6, defender.stages.defense - 1);
      msgs.push(`${defender.name}'s Defense fell!`);
    }

    return msgs;
  }

  // ─── End-of-Turn Effects ───────────────────────
  /**
   * Apply burn/poison damage, sleep tick, etc.
   * Called after both sides have moved.
   *
   * @param {object} pkmn - The Pokémon to tick
   * @returns {string[]} log messages
   */
  function endOfTurnEffects(pkmn) {
    const msgs = [];
    if (pkmn.currentHP <= 0) return msgs; // already fainted

    if (pkmn.status === 'burned') {
      const dmg = Math.max(1, Math.floor(pkmn.maxHP / 16));
      pkmn.currentHP = Math.max(0, pkmn.currentHP - dmg);
      msgs.push(`${pkmn.name} is hurt by its burn!`);
    }

    if (pkmn.status === 'poisoned') {
      const dmg = Math.max(1, Math.floor(pkmn.maxHP / 8));
      pkmn.currentHP = Math.max(0, pkmn.currentHP - dmg);
      msgs.push(`${pkmn.name} is hurt by poison!`);
    }

    if (pkmn.status === 'asleep') {
      pkmn._sleepTurns = (pkmn._sleepTurns || 1) - 1;
      if (pkmn._sleepTurns <= 0) {
        pkmn.status = null;
        msgs.push(`${pkmn.name} woke up!`);
      }
    }

    if (pkmn.status === 'frozen') {
      // 20% chance to thaw each turn
      if (Math.random() < 0.2) {
        pkmn.status = null;
        msgs.push(`${pkmn.name} thawed out!`);
      }
    }

    return msgs;
  }

  // ─── Faint Check ──────────────────────────────
  /**
   * True if the Pokémon has 0 HP (fainted).
   */
  function hasFainted(pkmn) {
    return pkmn.currentHP <= 0;
  }

  /**
   * True if all Pokémon in a team have fainted.
   * @param {object[]} team
   */
  function isTeamDefeated(team) {
    return team.every(p => hasFainted(p));
  }

  // ─── Execute one full turn ─────────────────────
  /**
   * Process one turn of battle.
   * Returns an array of BattleEvent objects for the UI to consume.
   *
   * Event types:
   *   { type:'move',     user, target, move, damage, effectiveness, isCrit }
   *   { type:'miss',     user, move }
   *   { type:'effect',   messages:[] }
   *   { type:'eot',      messages:[] }
   *   { type:'faint',    pkmn }
   *   { type:'status',   pkmn, status }
   *
   * @param {object} playerPkmn  - Active player Pokémon
   * @param {object} enemyPkmn   - Active enemy Pokémon
   * @param {object} playerMove  - Move chosen by player
   * @param {object} enemyMove   - Move chosen by CPU
   * @returns {object[]} events
   */
  function executeTurn(playerPkmn, enemyPkmn, playerMove, enemyMove) {
    const events = [];
    const order = getTurnOrder(playerMove, enemyMove, playerPkmn, enemyPkmn);

    const sides = [
      { pkmn: playerPkmn, move: playerMove, label: 'player' },
      { pkmn: enemyPkmn,  move: enemyMove,  label: 'enemy'  }
    ];

    for (const idx of order) {
      const { pkmn: attacker, move, label } = sides[idx];
      const { pkmn: defender }              = sides[1 - idx];

      if (hasFainted(attacker)) continue; // already out

      // Reduce PP
      move.currentPP = Math.max(0, (move.currentPP ?? move.pp) - 1);

      // Accuracy check
      if (!accuracyCheck(move, attacker, defender)) {
        events.push({ type: 'miss', user: label, move });
        continue;
      }

      // Calculate damage
      const { damage, effectiveness, effectivenessText, isCrit } =
        calculateDamage(attacker, defender, move);

      if (damage > 0) {
        defender.currentHP = Math.max(0, defender.currentHP - damage);
        events.push({
          type: 'move', user: label,
          target: idx === 0 ? 'enemy' : 'player',
          move, damage, effectiveness, effectivenessText, isCrit
        });
      } else {
        // Status move
        events.push({
          type: 'move', user: label,
          target: idx === 0 ? 'enemy' : 'player',
          move, damage: 0, effectiveness: 1, effectivenessText: '', isCrit: false
        });
      }

      // Apply secondary effects
      const effectMsgs = applyEffect(move.effect, attacker, defender);
      if (effectMsgs.length) {
        events.push({ type: 'effect', messages: effectMsgs });
      }

      // Check for faint after this action
      if (hasFainted(defender)) {
        events.push({ type: 'faint', pkmn: defender, side: idx === 0 ? 'enemy' : 'player' });
        break; // No end-of-turn needed if someone fainted mid-turn
      }
    }

    // ── End-of-Turn Effects ──
    if (!hasFainted(playerPkmn) && !hasFainted(enemyPkmn)) {
      const eotMsgs = [
        ...endOfTurnEffects(playerPkmn),
        ...endOfTurnEffects(enemyPkmn)
      ];
      if (eotMsgs.length) {
        events.push({ type: 'eot', messages: eotMsgs });
      }

      // Check faint after EOT effects
      if (hasFainted(playerPkmn)) {
        events.push({ type: 'faint', pkmn: playerPkmn, side: 'player' });
      }
      if (hasFainted(enemyPkmn)) {
        events.push({ type: 'faint', pkmn: enemyPkmn, side: 'enemy' });
      }
    }

    return events;
  }

  // ─── Public API ───────────────────────────────
  return {
    calculateDamage,
    accuracyCheck,
    getTurnOrder,
    applyEffect,
    endOfTurnEffects,
    hasFainted,
    isTeamDefeated,
    executeTurn
  };

})();
