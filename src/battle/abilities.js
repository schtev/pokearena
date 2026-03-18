// ═══════════════════════════════════════════════════
//  src/battle/abilities.js   (Part 5)
//  Defines Pokémon abilities and their trigger points.
//
//  Trigger hooks (called from engine/main.js):
//    onSwitchIn(pkmn, opponent, weather) → messages[]
//    onAttack(attacker, move, weather)   → powerMult
//    onHit(defender, move, attacker)     → messages[]
//    onEndOfTurn(pkmn, weather)          → messages[]
// ═══════════════════════════════════════════════════

const AbilitySystem = (() => {

  // ─── Ability definitions ──────────────────────
  const ABILITIES = {

    // ── Starter abilities ──
    blaze: {
      name: 'Blaze',
      desc: 'Powers up Fire moves when HP is below 1/3.',
      onAttack(attacker, move, weather) {
        if (move.type === 'fire' && attacker.currentHP <= attacker.maxHP / 3)
          return 1.5;
        return 1;
      }
    },

    torrent: {
      name: 'Torrent',
      desc: 'Powers up Water moves when HP is below 1/3.',
      onAttack(attacker, move, weather) {
        if (move.type === 'water' && attacker.currentHP <= attacker.maxHP / 3)
          return 1.5;
        return 1;
      }
    },

    overgrow: {
      name: 'Overgrow',
      desc: 'Powers up Grass moves when HP is below 1/3.',
      onAttack(attacker, move, weather) {
        if (move.type === 'grass' && attacker.currentHP <= attacker.maxHP / 3)
          return 1.5;
        return 1;
      }
    },

    // ── Switch-in abilities ──
    intimidate: {
      name: 'Intimidate',
      desc: 'Lowers the opponent\'s Attack by 1 stage on switch-in.',
      onSwitchIn(pkmn, opponent) {
        if (!opponent) return [];
        opponent.stages.attack = Math.max(-6, (opponent.stages.attack || 0) - 1);
        return [`${pkmn.name}'s Intimidate lowered ${opponent.name}'s Attack!`];
      }
    },

    drizzle: {
      name: 'Drizzle',
      desc: 'Summons rain when entering battle.',
      onSwitchIn(pkmn, opponent, weather) {
        weather.set(weather.TYPES.RAIN, 5);
        return ['It started to rain!'];
      }
    },

    drought: {
      name: 'Drought',
      desc: 'Summons harsh sunlight when entering battle.',
      onSwitchIn(pkmn, opponent, weather) {
        weather.set(weather.TYPES.SUN, 5);
        return ['The sunlight turned harsh!'];
      }
    },

    sandStream: {
      name: 'Sand Stream',
      desc: 'Summons a sandstorm when entering battle.',
      onSwitchIn(pkmn, opponent, weather) {
        weather.set(weather.TYPES.SAND, 5);
        return ['A sandstorm kicked up!'];
      }
    },

    // ── Damage reaction abilities ──
    static: {
      name: 'Static',
      desc: '30% chance to paralyze attackers that make contact.',
      onHit(defender, move, attacker) {
        if (move.category === 'physical' && !attacker.status && Math.random() < 0.3) {
          attacker.status = 'paralyzed';
          return [`${defender.name}'s Static paralyzed ${attacker.name}!`];
        }
        return [];
      }
    },

    flamebody: {
      name: 'Flame Body',
      desc: '30% chance to burn attackers that make contact.',
      onHit(defender, move, attacker) {
        if (move.category === 'physical' && !attacker.status && Math.random() < 0.3) {
          attacker.status = 'burned';
          return [`${defender.name}'s Flame Body burned ${attacker.name}!`];
        }
        return [];
      }
    },

    poisonpoint: {
      name: 'Poison Point',
      desc: '30% chance to poison attackers that make contact.',
      onHit(defender, move, attacker) {
        if (move.category === 'physical' && !attacker.status && Math.random() < 0.3) {
          attacker.status = 'poisoned';
          return [`${defender.name}'s Poison Point poisoned ${attacker.name}!`];
        }
        return [];
      }
    },

    // ── Passive / end-of-turn abilities ──
    leftovers: null, // handled via held items

    speedboost: {
      name: 'Speed Boost',
      desc: 'Raises Speed by 1 stage each turn.',
      onEndOfTurn(pkmn) {
        if (pkmn.currentHP > 0 && (pkmn.stages.speed || 0) < 6) {
          pkmn.stages.speed = Math.min(6, (pkmn.stages.speed || 0) + 1);
          return [`${pkmn.name}'s Speed Boost raised its Speed!`];
        }
        return [];
      }
    },

    hugepower: {
      name: 'Huge Power',
      desc: 'Doubles the Pokémon\'s Attack stat.',
      onAttack(attacker, move) {
        if (move.category === 'physical') return 2;
        return 1;
      }
    },

    thickfat: {
      name: 'Thick Fat',
      desc: 'Halves damage from Fire and Ice moves.',
      onDefend(defender, move) {
        if (move.type === 'fire' || move.type === 'ice') return 0.5;
        return 1;
      }
    },

    levitate: {
      name: 'Levitate',
      desc: 'Immune to Ground-type moves.',
      onDefend(defender, move) {
        if (move.type === 'ground') return 0;
        return 1;
      }
    },

    wonderguard: {
      name: 'Wonder Guard',
      desc: 'Only super-effective moves deal damage.',
      onDefend(defender, move, effectiveness) {
        if (effectiveness <= 1) return 0;
        return 1;
      }
    },

    naturalcure: {
      name: 'Natural Cure',
      desc: 'Cures status conditions on switch-out.',
      onSwitchOut(pkmn) {
        if (pkmn.status) {
          pkmn.status = null;
          return [`${pkmn.name} was cured by Natural Cure!`];
        }
        return [];
      }
    },
  };

  // ─── Assign abilities to Pokémon data ─────────
  // Map: pokemonKey → abilityKey
  const POKEMON_ABILITIES = {
    bulbasaur:  'overgrow',
    ivysaur:    'overgrow',
    venusaur:   'overgrow',
    charmander: 'blaze',
    charmeleon: 'blaze',
    charizard:  'blaze',
    squirtle:   'torrent',
    wartortle:  'torrent',
    blastoise:  'torrent',
    pikachu:    'static',
    raichu:     'static',
    eevee:      'naturalcure',
    gengar:     'levitate',
    machamp:    'hugepower',
    lapras:     'naturalcure',
    dragonite:  'hugepower',
    mewtwo:     'speedboost',
    snorlax:    'thickfat',
    lucario:    'hugepower',
    garchomp:   'sandStream',
  };

  /**
   * Get the ability object for a Pokémon key.
   * @param {string} pokemonKey
   * @returns {object|null}
   */
  function getAbility(pokemonKey) {
    const abilityKey = POKEMON_ABILITIES[pokemonKey];
    if (!abilityKey) return null;
    return ABILITIES[abilityKey] || null;
  }

  /**
   * Get ability name for display.
   * @param {string} pokemonKey
   */
  function getAbilityName(pokemonKey) {
    const abilityKey = POKEMON_ABILITIES[pokemonKey];
    if (!abilityKey) return 'None';
    return ABILITIES[abilityKey]?.name || abilityKey;
  }

  /**
   * Get ability description for display.
   * @param {string} pokemonKey
   */
  function getAbilityDesc(pokemonKey) {
    const abilityKey = POKEMON_ABILITIES[pokemonKey];
    if (!abilityKey) return '';
    return ABILITIES[abilityKey]?.desc || '';
  }

  // ─── Trigger helpers (call from battle flow) ──

  function triggerSwitchIn(pkmn, opponent, weather) {
    const ab = getAbility(pkmn.key);
    if (ab?.onSwitchIn) return ab.onSwitchIn(pkmn, opponent, weather) || [];
    return [];
  }

  function triggerSwitchOut(pkmn) {
    const ab = getAbility(pkmn.key);
    if (ab?.onSwitchOut) return ab.onSwitchOut(pkmn) || [];
    return [];
  }

  function triggerAttack(attacker, move, weather) {
    const ab = getAbility(attacker.key);
    if (ab?.onAttack) return ab.onAttack(attacker, move, weather) || 1;
    return 1;
  }

  function triggerDefend(defender, move, effectiveness) {
    const ab = getAbility(defender.key);
    if (ab?.onDefend) return ab.onDefend(defender, move, effectiveness) || 1;
    return 1;
  }

  function triggerOnHit(defender, move, attacker) {
    const ab = getAbility(defender.key);
    if (ab?.onHit) return ab.onHit(defender, move, attacker) || [];
    return [];
  }

  function triggerEndOfTurn(pkmn, weather) {
    const ab = getAbility(pkmn.key);
    if (ab?.onEndOfTurn) return ab.onEndOfTurn(pkmn, weather) || [];
    return [];
  }

  return {
    ABILITIES, POKEMON_ABILITIES,
    getAbility, getAbilityName, getAbilityDesc,
    triggerSwitchIn, triggerSwitchOut, triggerAttack,
    triggerDefend, triggerOnHit, triggerEndOfTurn,
  };

})();
