// ═══════════════════════════════════════════════════
//  src/battle/engine.js
//  Core battle logic — fully wired abilities + weather.
// ═══════════════════════════════════════════════════

const BattleEngine = (() => {

  // ─── Seeded RNG ────────────────────────────────
  let _rng = Math.random;
  function seedRng(seed) {
    let s = seed >>> 0;
    _rng = function() {
      s |= 0; s = s + 0x6D2B79F5 | 0;
      let t = Math.imul(s ^ s >>> 15, 1 | s);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function resetRng() { _rng = Math.random; }
  function generateSeed() { return (Math.random() * 0xFFFFFFFF) >>> 0; }

  // ─── Stat stage multipliers ────────────────────
  const STAGE_MULT = {
    '-6':2/8,'-5':2/7,'-4':2/6,'-3':2/5,'-2':2/4,'-1':2/3,'0':1,
    '1':3/2,'2':4/2,'3':5/2,'4':6/2,'5':7/2,'6':8/2
  };
  function applyStage(stat, stage) {
    return Math.floor(stat * (STAGE_MULT[String(Math.max(-6,Math.min(6,stage||0)))] || 1));
  }

  // ─── Damage formula ────────────────────────────
  function calculateDamage(attacker, defender, move, extraMults = {}) {
    if (!move.power) return { damage:0, effectiveness:1, isCrit:false, effectivenessText:'' };

    const level = attacker.level;
    let atkStat, defStat;
    if (move.category === 'physical') {
      atkStat = applyStage(attacker.stats.attack,  attacker.stages.attack  || 0);
      defStat = applyStage(defender.stats.defense, defender.stages.defense || 0);
    } else {
      atkStat = applyStage(attacker.stats.spatk, attacker.stages.spatk || 0);
      defStat = applyStage(defender.stats.spdef, defender.stages.spdef || 0);
    }

    // Weather defensive bonuses (Sand → Rock Sp.Def; Snow → Ice Def)
    if (typeof Weather !== 'undefined') {
      if (move.category === 'special')  defStat = Math.floor(defStat * (Weather.getDefBonus(defender,'spdef')  || 1));
      if (move.category === 'physical') defStat = Math.floor(defStat * (Weather.getDefBonus(defender,'defense') || 1));
    }

    let base = Math.floor((((2*level/5+2) * move.power * atkStat / defStat) / 50) + 2);

    const stab          = attacker.types.includes(move.type) ? 1.5 : 1;
    // Adaptability doubles STAB
    const stabFinal     = (stab > 1 && extraMults.adaptability) ? stab * 1.33 : stab;
    const effectiveness = getTypeEffectiveness(move.type, defender.types);
    const isCrit        = _rng() < (0.0625 + ((attacker._critBoost || 0) * 0.125));
    const critMult      = isCrit ? 1.5 : 1;
    const random        = 0.85 + _rng() * 0.15;
    const burnMult      = (attacker.status === 'burned' && move.category === 'physical') ? 0.5 : 1;

    const damage = Math.max(1, Math.floor(
      base * stabFinal * effectiveness * critMult * random * burnMult
      * (extraMults.weather  || 1)
      * (extraMults.ability  || 1)
      * (extraMults.held     || 1)
      * (extraMults.defAbil  || 1)
    ));

    // Sturdy — survive from full HP
    if (damage >= defender.currentHP && defender.currentHP >= defender.maxHP
        && _abilityKey(defender) === 'sturdy') {
      return { damage: defender.currentHP - 1, effectiveness, effectivenessText: getEffectivenessText(effectiveness), isCrit, sturdyProc: true };
    }
    // Focus Sash
    if (damage >= defender.currentHP && defender.currentHP >= defender.maxHP
        && defender._focusSash) {
      defender._focusSash = false;
      return { damage: defender.currentHP - 1, effectiveness, effectivenessText: getEffectivenessText(effectiveness), isCrit };
    }
    // Multiscale — halve if at full HP (already in defAbil but double-check)
    return { damage, effectiveness, effectivenessText: getEffectivenessText(effectiveness), isCrit };
  }

  function _abilityKey(pkmn) {
    if (typeof AbilitySystem === 'undefined') return null;
    return AbilitySystem.POKEMON_ABILITIES?.[pkmn.key] || null;
  }

  // ─── Accuracy check ────────────────────────────
  function accuracyCheck(move, attacker, defender) {
    if (move.accuracy >= 999) return true;
    if (defender.status === 'frozen' && move.type === 'fire') return true;
    if (attacker.status === 'paralyzed' && _rng() < 0.25) return false;
    if (attacker.status === 'asleep') return false;

    // Weather accuracy modifier
    const accMult = (typeof Weather !== 'undefined') ? (Weather.getAccuracyMult(move.id) || 1) : 1;
    if (accMult >= 999) return true;  // auto-hit (Thunder in rain)
    if (accMult <= 0)   return false;

    // Stage-based accuracy/evasion
    const accStage = attacker.stages?.accuracy || 0;
    const evaStage = defender.stages?.evasion  || 0;
    const netStage = Math.max(-6, Math.min(6, accStage - evaStage));
    const stageMult = STAGE_MULT[String(netStage)] || 1;

    return _rng() * 100 < move.accuracy * accMult * stageMult;
  }

  // ─── Turn order ────────────────────────────────
  function getTurnOrder(p1Move, p2Move, p1, p2) {
    const pr1 = p1Move.priority || 0, pr2 = p2Move.priority || 0;
    if (pr1 !== pr2) return pr1 > pr2 ? [0,1] : [1,0];

    let sp1 = applyStage(p1.stats.speed, p1.stages.speed || 0);
    let sp2 = applyStage(p2.stats.speed, p2.stages.speed || 0);

    // Weather speed boosts (Swift Swim etc.)
    if (typeof AbilitySystem !== 'undefined' && typeof Weather !== 'undefined') {
      const cur = Weather.current();
      sp1 = Math.floor(sp1 * (AbilitySystem.getWeatherBoost(p1.key, cur) || 1));
      sp2 = Math.floor(sp2 * (AbilitySystem.getWeatherBoost(p2.key, cur) || 1));
    }

    if (sp1 !== sp2) return sp1 > sp2 ? [0,1] : [1,0];
    return _rng() < 0.5 ? [0,1] : [1,0];
  }

  // ─── Status helpers ────────────────────────────
  function _tryInflictStatus(pkmn, status, weather) {
    if (pkmn.status) return false;  // already has a status
    // Ability block check
    if (typeof AbilitySystem !== 'undefined') {
      const allowed = AbilitySystem.triggerStatusApply(pkmn, status, weather);
      if (!allowed) return false;
    }
    // Terrain blocks
    if (typeof Weather !== 'undefined') {
      if (status === 'asleep'   && Weather.blocksSleepForGrounded() && !pkmn._airborne) return false;
    }
    // Type immunities
    if (status === 'burned'   && pkmn.types.includes('fire'))     return false;
    if (status === 'poisoned' && (pkmn.types.includes('poison') || pkmn.types.includes('steel'))) return false;
    if (status === 'frozen'   && pkmn.types.includes('ice'))      return false;
    if (status === 'paralyzed'&& pkmn.types.includes('electric')) return false;

    pkmn.status = status;
    if (status === 'asleep') pkmn._sleepTurns = 1 + Math.floor(_rng() * 3);
    return true;
  }

  // ─── Move effects ──────────────────────────────
  function applyEffect(effectStr, attacker, defender, weather) {
    if (!effectStr) return [];
    const msgs = [];

    const STATUS_MAP = {
      'burn': 'burned', 'paralysis': 'paralyzed',
      'poison': 'poisoned', 'freeze': 'frozen', 'sleep': 'asleep',
    };

    // Status infliction with chance
    for (const [key, status] of Object.entries(STATUS_MAP)) {
      if (effectStr === key || effectStr.startsWith(key + '_')) {
        const chance = effectStr.includes('_') ? parseInt(effectStr.split('_')[1]) : 100;
        if (_rng() * 100 < chance) {
          if (_tryInflictStatus(defender, status, weather)) {
            const statusMsgs = {
              burned:'was burned!', paralyzed:'is paralyzed! It may be unable to move!',
              poisoned:'was poisoned!', frozen:'was frozen solid!', asleep:'fell asleep!',
            };
            msgs.push(`${defender.name} ${statusMsgs[status]}`);
          }
        }
        break;
      }
    }

    // Self heal
    if (effectStr === 'heal_50') {
      const healed = Math.floor(attacker.maxHP * 0.5);
      attacker.currentHP = Math.min(attacker.maxHP, attacker.currentHP + healed);
      msgs.push(`${attacker.name} restored HP!`);
    }
    if (effectStr === 'rest') {
      attacker.status = 'asleep'; attacker._sleepTurns = 2;
      attacker.currentHP = attacker.maxHP;
      msgs.push(`${attacker.name} went to sleep and restored HP!`);
    }

    // Stat stages - attacker boosts
    const SELF_BOOSTS = {
      'atk_up_2':['attack',2,true], 'atk_up':['attack',1,true],
      'def_up_2':['defense',2,true], 'def_up':['defense',1,true],
      'spatk_up_2':['spatk',2,true], 'spd_up':['speed',1,true],
      'spdef_up':['spdef',1,true], 'spdef_up_2':['spdef',2,true],
    };
    if (SELF_BOOSTS[effectStr]) {
      const [stat, stages, self] = SELF_BOOSTS[effectStr];
      const target = self ? attacker : defender;
      target.stages[stat] = Math.min(6, (target.stages[stat]||0) + stages);
      const word = stages >= 2 ? 'sharply rose' : 'rose';
      msgs.push(`${target.name}'s ${stat} ${word}!`);
    }

    // Defender drops
    const DEF_DROPS = {
      'atk_down':['attack',-1], 'def_down':['defense',-1],
      'spdef_down':['spdef',-1], 'spd_down':['speed',-1],
      'atk_down_2':['attack',-2], 'def_down_2':['defense',-2],
    };
    for (const [key, [stat, delta]] of Object.entries(DEF_DROPS)) {
      if (effectStr === key || (effectStr.includes(key) && effectStr.includes('_'))) {
        const chance = effectStr.split('_').pop();
        const pct    = isNaN(parseInt(chance)) ? 100 : parseInt(chance);
        if (_rng() * 100 < pct) {
          defender.stages[stat] = Math.max(-6, (defender.stages[stat]||0) + delta);
          const word = Math.abs(delta) >= 2 ? 'sharply fell' : 'fell';
          msgs.push(`${defender.name}'s ${stat} ${word}!`);
        }
        break;
      }
    }

    if (effectStr === 'defspdef_down') {
      ['defense','spdef'].forEach(s => {
        attacker.stages[s] = Math.max(-6,(attacker.stages[s]||0)-1);
      });
      msgs.push(`${attacker.name}'s defenses fell!`);
    }

    // Weather-setting moves
    const WEATHER_MOVES = {
      'sunny_day': 'sun', 'rain_dance': 'rain',
      'sandstorm': 'sand', 'hail': 'hail',
      'snowscape': 'snow',
    };
    if (WEATHER_MOVES[effectStr] && typeof Weather !== 'undefined') {
      const label = Weather.set(WEATHER_MOVES[effectStr], 5);
      msgs.push(label);
    }

    return msgs;
  }

  // ─── End-of-turn status ────────────────────────
  function endOfTurnEffects(pkmn) {
    const msgs = [];
    if (pkmn.currentHP <= 0) return msgs;

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
      if (pkmn._sleepTurns <= 0) { pkmn.status = null; msgs.push(`${pkmn.name} woke up!`); }
    }
    if (pkmn.status === 'frozen' && _rng() < 0.2) {
      pkmn.status = null;
      msgs.push(`${pkmn.name} thawed out!`);
    }
    return msgs;
  }

  function hasFainted(pkmn)     { return pkmn.currentHP <= 0; }
  function isTeamDefeated(team) { return team.every(p => hasFainted(p)); }

  // ─── Execute one full turn ─────────────────────
  function executeTurn(playerPkmn, enemyPkmn, playerMove, enemyMove) {
    const events  = [];
    const weather = typeof Weather !== 'undefined' ? Weather : null;
    const order   = getTurnOrder(playerMove, enemyMove, playerPkmn, enemyPkmn);

    const sides = [
      { pkmn: playerPkmn, move: playerMove, label:'player' },
      { pkmn: enemyPkmn,  move: enemyMove,  label:'enemy'  },
    ];

    for (const idx of order) {
      const { pkmn: attacker, move, label } = sides[idx];
      const { pkmn: defender }              = sides[1 - idx];

      if (hasFainted(attacker)) continue;

      move.currentPP = Math.max(0, (move.currentPP ?? move.pp) - 1);

      if (!accuracyCheck(move, attacker, defender)) {
        events.push({ type:'miss', user:label, move });
        continue;
      }

      // Wonder Guard — only super-effective moves land
      if (typeof AbilitySystem !== 'undefined') {
        const dk = _abilityKey(defender);
        if (dk === 'wonderguard') {
          const eff = getTypeEffectiveness(move.type, defender.types);
          if (eff <= 1 && move.category !== 'status') {
            events.push({ type:'miss', user:label, move, reason:'wonderguard' });
            events.push({ type:'effect', messages:[`${defender.name}'s Wonder Guard blocked the move!`] });
            continue;
          }
        }
      }

      // Gather all multipliers
      const curWeather  = weather?.current() || 'none';
      const effectiveness = getTypeEffectiveness(move.type, defender.types);

      const weatherMult = weather ? (weather.getMoveMult(move.type, move.id, attacker) || 1) : 1;
      const abilityMult = (typeof AbilitySystem !== 'undefined')
        ? AbilitySystem.triggerAttack(attacker, move, weather, effectiveness) : 1;
      const heldMult    = (typeof HeldItems !== 'undefined') ? HeldItems.triggerAttack(attacker, move) : 1;
      const defAbilMult = (typeof AbilitySystem !== 'undefined')
        ? AbilitySystem.triggerDefend(defender, move, effectiveness) : 1;
      const defHeldMult = (typeof HeldItems !== 'undefined') ? HeldItems.triggerDefend(defender, move) : 1;

      // Check for type-immunity ability (returns 0 from triggerDefend)
      if (defAbilMult === 0) {
        // Ability absorbed the move — show absorption message from ability trigger
        const absorbMsgs = (typeof AbilitySystem !== 'undefined')
          ? AbilitySystem.triggerOnHit(defender, move, attacker) : [];
        events.push({ type:'move', user:label, target:idx===0?'enemy':'player',
          move, damage:0, effectiveness:0, effectivenessText:'It had no effect!', isCrit:false });
        if (absorbMsgs.length) events.push({ type:'effect', messages:absorbMsgs });
        continue;
      }

      const isAdaptability = AbilitySystem?.POKEMON_ABILITIES?.[attacker.key] === 'adaptability';
      const { damage, effectiveness: eff, effectivenessText, isCrit } =
        calculateDamage(attacker, defender, move, {
          weather: weatherMult, ability: abilityMult,
          held: heldMult * defHeldMult, defAbil: defAbilMult,
          adaptability: isAdaptability,
        });

      if (damage > 0) {
        defender.currentHP = Math.max(0, defender.currentHP - damage);
        events.push({ type:'move', user:label, target:idx===0?'enemy':'player',
          move, damage, effectiveness:eff, effectivenessText, isCrit });

        const heldAfter    = (typeof HeldItems     !== 'undefined') ? HeldItems.triggerAfterAttack(attacker, damage) : [];
        const rockyHelmet  = (typeof HeldItems     !== 'undefined') ? HeldItems.triggerOnHit(defender, move, attacker) : [];
        const abilityHit   = (typeof AbilitySystem !== 'undefined') ? AbilitySystem.triggerOnHit(defender, move, attacker) : [];
        const reactMsgs    = [...heldAfter, ...rockyHelmet, ...abilityHit];
        if (reactMsgs.length) events.push({ type:'effect', messages:reactMsgs });

      } else {
        events.push({ type:'move', user:label, target:idx===0?'enemy':'player',
          move, damage:0, effectiveness:1, effectivenessText:'', isCrit:false });
      }

      const effectMsgs = applyEffect(move.effect, attacker, defender, weather);
      if (effectMsgs.length) events.push({ type:'effect', messages:effectMsgs });

      const lumMsgs = (typeof HeldItems !== 'undefined') ? HeldItems.triggerOnStatusInflict(defender) : [];
      if (lumMsgs.length) events.push({ type:'effect', messages:lumMsgs });

      if (hasFainted(defender)) {
        events.push({ type:'faint', pkmn:defender, side:idx===0?'enemy':'player' });
        break;
      }
    }

    // ── End-of-turn ──────────────────────────────
    if (!hasFainted(playerPkmn) && !hasFainted(enemyPkmn)) {
      const eotMsgs = [];

      eotMsgs.push(...endOfTurnEffects(playerPkmn));
      eotMsgs.push(...endOfTurnEffects(enemyPkmn));

      if (weather) eotMsgs.push(...weather.tick([playerPkmn, enemyPkmn]));

      if (typeof HeldItems !== 'undefined') {
        eotMsgs.push(...HeldItems.triggerEndOfTurn(playerPkmn));
        eotMsgs.push(...HeldItems.triggerEndOfTurn(enemyPkmn));
      }
      if (typeof AbilitySystem !== 'undefined') {
        eotMsgs.push(...AbilitySystem.triggerEndOfTurn(playerPkmn, weather));
        eotMsgs.push(...AbilitySystem.triggerEndOfTurn(enemyPkmn,  weather));
      }

      if (eotMsgs.length) events.push({ type:'eot', messages:eotMsgs });

      if (hasFainted(playerPkmn)) events.push({ type:'faint', pkmn:playerPkmn, side:'player' });
      if (hasFainted(enemyPkmn))  events.push({ type:'faint', pkmn:enemyPkmn,  side:'enemy'  });
    }

    return events;
  }

  return {
    calculateDamage, accuracyCheck, getTurnOrder,
    applyEffect, endOfTurnEffects,
    hasFainted, isTeamDefeated, executeTurn,
    rng: () => _rng(), seedRng, resetRng, generateSeed,
  };

})();
