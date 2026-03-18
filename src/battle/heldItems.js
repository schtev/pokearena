// ═══════════════════════════════════════════════════
//  src/battle/heldItems.js   (Part 5)
//  Held items that Pokémon carry into battle.
//  Separate from bag items — these are permanently
//  attached to a Pokémon and trigger automatically.
// ═══════════════════════════════════════════════════

const HeldItems = (() => {

  const ITEMS = {

    leftovers: {
      name: 'Leftovers',
      icon: '🍃',
      desc: 'Restores 1/16 HP at the end of each turn.',
      onEndOfTurn(holder) {
        if (holder.currentHP < holder.maxHP) {
          const heal = Math.max(1, Math.floor(holder.maxHP / 16));
          holder.currentHP = Math.min(holder.maxHP, holder.currentHP + heal);
          return [`${holder.name} restored a little HP using its Leftovers!`];
        }
        return [];
      }
    },

    choiceBand: {
      name: 'Choice Band',
      icon: '🩹',
      desc: 'Boosts Attack by 50% but locks into one move.',
      onAttack(holder, move) {
        if (move.category === 'physical') return 1.5;
        return 1;
      }
    },

    choiceSpecs: {
      name: 'Choice Specs',
      icon: '👓',
      desc: 'Boosts Sp. Atk by 50% but locks into one move.',
      onAttack(holder, move) {
        if (move.category === 'special') return 1.5;
        return 1;
      }
    },

    lifeOrb: {
      name: 'Life Orb',
      icon: '🔮',
      desc: 'Boosts move power by 30% but costs 10% HP per use.',
      onAttack(holder, move) {
        return move.power > 0 ? 1.3 : 1;
      },
      afterAttack(holder) {
        if (holder.currentHP > 0) {
          const dmg = Math.max(1, Math.floor(holder.maxHP / 10));
          holder.currentHP = Math.max(0, holder.currentHP - dmg);
          return [`${holder.name} is hurt by its Life Orb!`];
        }
        return [];
      }
    },

    shellBell: {
      name: 'Shell Bell',
      icon: '🔔',
      desc: 'Restores 1/8 of damage dealt.',
      afterAttack(holder, damageDealt) {
        if (damageDealt > 0 && holder.currentHP < holder.maxHP) {
          const heal = Math.max(1, Math.floor(damageDealt / 8));
          holder.currentHP = Math.min(holder.maxHP, holder.currentHP + heal);
          return [`${holder.name} restored HP using its Shell Bell!`];
        }
        return [];
      }
    },

    rockyHelmet: {
      name: 'Rocky Helmet',
      icon: '⛑️',
      desc: 'Damages attacker by 1/6 HP when hit by contact.',
      onHit(holder, move, attacker) {
        if (move.category === 'physical') {
          const dmg = Math.max(1, Math.floor(attacker.maxHP / 6));
          attacker.currentHP = Math.max(0, attacker.currentHP - dmg);
          return [`${attacker.name} was hurt by ${holder.name}'s Rocky Helmet!`];
        }
        return [];
      }
    },

    lum: {
      name: 'Lum Berry',
      icon: '🍒',
      desc: 'Cures any status condition once.',
      onStatusInflict(holder) {
        if (holder.status) {
          holder.status = null;
          holder.heldItem = null; // consumed
          return [`${holder.name}'s Lum Berry cured its status!`];
        }
        return [];
      }
    },

    sitrusBerry: {
      name: 'Sitrus Berry',
      icon: '🍊',
      desc: 'Restores 25% HP when below 50%. Used once.',
      onEndOfTurn(holder) {
        if (holder.currentHP / holder.maxHP < 0.5) {
          const heal = Math.floor(holder.maxHP / 4);
          holder.currentHP = Math.min(holder.maxHP, holder.currentHP + heal);
          holder.heldItem  = null; // consumed
          return [`${holder.name} ate its Sitrus Berry and restored HP!`];
        }
        return [];
      }
    },

    focusSash: {
      name: 'Focus Sash',
      icon: '🎀',
      desc: 'Survives a one-hit KO at full HP. Used once.',
      onDamage(holder, damage) {
        if (holder.currentHP === holder.maxHP && damage >= holder.maxHP) {
          holder.heldItem = null; // consumed
          return { reducedDamage: holder.maxHP - 1 };
        }
        return { reducedDamage: damage };
      }
    },

    assaultVest: {
      name: 'Assault Vest',
      icon: '🦺',
      desc: 'Raises Sp. Def by 50% but prevents status moves.',
      onDefend(holder, move) {
        if (move.category === 'special') return 0.67; // ~+50% spdef equivalent
        return 1;
      }
    },
  };

  // ─── Default held items per Pokémon ───────────
  // (Can be expanded into an equipment screen later)
  const DEFAULT_HELD = {
    snorlax:   'leftovers',
    charizard: 'lifeOrb',
    blastoise: 'leftovers',
    mewtwo:    'choiceSpecs',
    lapras:    'shellBell',
    machamp:   'choiceBand',
    lucario:   'lifeOrb',
    dragonite: 'choiceBand',
    pikachu:   'focusSash',
    gengar:    'lifeOrb',
  };

  /**
   * Attach default held items to a battle Pokémon instance.
   * @param {object} pkmn
   */
  function attachDefault(pkmn) {
    const itemKey = DEFAULT_HELD[pkmn.key];
    if (itemKey && ITEMS[itemKey]) {
      pkmn.heldItem    = itemKey;
      pkmn.heldItemObj = ITEMS[itemKey];
    }
  }

  // ─── Trigger helpers ──────────────────────────
  function triggerEndOfTurn(holder) {
    if (!holder.heldItem || !holder.heldItemObj?.onEndOfTurn) return [];
    return holder.heldItemObj.onEndOfTurn(holder) || [];
  }

  function triggerOnHit(holder, move, attacker) {
    if (!holder.heldItem || !holder.heldItemObj?.onHit) return [];
    return holder.heldItemObj.onHit(holder, move, attacker) || [];
  }

  function triggerAfterAttack(holder, damageDealt) {
    if (!holder.heldItem || !holder.heldItemObj?.afterAttack) return [];
    return holder.heldItemObj.afterAttack(holder, damageDealt) || [];
  }

  function triggerAttack(holder, move) {
    if (!holder.heldItem || !holder.heldItemObj?.onAttack) return 1;
    return holder.heldItemObj.onAttack(holder, move) || 1;
  }

  function triggerDefend(holder, move) {
    if (!holder.heldItem || !holder.heldItemObj?.onDefend) return 1;
    return holder.heldItemObj.onDefend(holder, move) || 1;
  }

  function triggerOnStatusInflict(holder) {
    if (!holder.heldItem || !holder.heldItemObj?.onStatusInflict) return [];
    return holder.heldItemObj.onStatusInflict(holder) || [];
  }

  function getDisplayName(pkmn) {
    if (!pkmn.heldItem) return 'None';
    return ITEMS[pkmn.heldItem]?.name || pkmn.heldItem;
  }

  function getDisplayIcon(pkmn) {
    if (!pkmn.heldItem) return '';
    return ITEMS[pkmn.heldItem]?.icon || '📦';
  }

  return {
    ITEMS, DEFAULT_HELD, attachDefault,
    triggerEndOfTurn, triggerOnHit, triggerAfterAttack,
    triggerAttack, triggerDefend, triggerOnStatusInflict,
    getDisplayName, getDisplayIcon,
  };

})();
