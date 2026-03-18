// ═══════════════════════════════════════════════════
//  src/items/items.js   (Part 2)
//  Item definitions, bag UI, and in-battle use logic.
// ═══════════════════════════════════════════════════

const Items = (() => {

  // ─── Item definitions ─────────────────────────
  const ITEM_DATA = {
    potion: {
      name:    'Potion',
      icon:    '🧪',
      desc:    'Restores 20 HP to one Pokémon.',
      usable:  'battle',   // 'battle' | 'overworld' | 'both'
      effect:  { type: 'heal', amount: 20 }
    },
    superPotion: {
      name:    'Super Potion',
      icon:    '💊',
      desc:    'Restores 50 HP to one Pokémon.',
      usable:  'battle',
      effect:  { type: 'heal', amount: 50 }
    },
    hyperPotion: {
      name:    'Hyper Potion',
      icon:    '💉',
      desc:    'Restores 200 HP to one Pokémon.',
      usable:  'battle',
      effect:  { type: 'heal', amount: 200 }
    },
    fullRestore: {
      name:    'Full Restore',
      icon:    '✨',
      desc:    'Fully restores HP and cures all status conditions.',
      usable:  'battle',
      effect:  { type: 'fullHeal' }
    },
    revive: {
      name:    'Revive',
      icon:    '💫',
      desc:    'Revives a fainted Pokémon to half HP.',
      usable:  'battle',
      effect:  { type: 'revive', fraction: 0.5 }
    },
    fullRevive: {
      name:    'Full Revive',
      icon:    '⭐',
      desc:    'Revives a fainted Pokémon to full HP.',
      usable:  'battle',
      effect:  { type: 'revive', fraction: 1.0 }
    },
    xAttack: {
      name:    'X Attack',
      icon:    '⚔️',
      desc:    'Sharply raises Attack for this battle.',
      usable:  'battle',
      effect:  { type: 'statBoost', stat: 'attack', stages: 2 }
    },
    xDefense: {
      name:    'X Defense',
      icon:    '🛡️',
      desc:    'Sharply raises Defense for this battle.',
      usable:  'battle',
      effect:  { type: 'statBoost', stat: 'defense', stages: 2 }
    },
    xSpeed: {
      name:    'X Speed',
      icon:    '💨',
      desc:    'Sharply raises Speed for this battle.',
      usable:  'battle',
      effect:  { type: 'statBoost', stat: 'speed', stages: 2 }
    }
  };

  // ─── Apply item effect to a Pokémon ───────────
  /**
   * Use an item on a Pokémon in battle.
   * Returns { success, message } so the UI can display the result.
   *
   * @param {string} itemKey   - Key in ITEM_DATA
   * @param {object} pkmn      - Live battle Pokémon instance
   * @returns {{ success: boolean, message: string }}
   */
  function useOnPokemon(itemKey, pkmn) {
    const item = ITEM_DATA[itemKey];
    if (!item) return { success: false, message: 'Unknown item.' };

    const count = SaveSystem.getItemCount(itemKey);
    if (count <= 0) return { success: false, message: `No ${item.name}s left!` };

    const eff = item.effect;

    switch (eff.type) {

      case 'heal': {
        if (pkmn.currentHP <= 0) {
          return { success: false, message: `${pkmn.name} has fainted!` };
        }
        if (pkmn.currentHP >= pkmn.maxHP) {
          return { success: false, message: `${pkmn.name}'s HP is already full!` };
        }
        const restored = Math.min(eff.amount, pkmn.maxHP - pkmn.currentHP);
        pkmn.currentHP += restored;
        SaveSystem.useItem(itemKey);
        return { success: true, message: `${pkmn.name} recovered ${restored} HP!` };
      }

      case 'fullHeal': {
        if (pkmn.currentHP <= 0) {
          return { success: false, message: `${pkmn.name} has fainted!` };
        }
        const wasStatus = pkmn.status;
        pkmn.currentHP = pkmn.maxHP;
        pkmn.status    = null;
        SaveSystem.useItem(itemKey);
        const statusNote = wasStatus ? ` and was cured of ${wasStatus}` : '';
        return { success: true, message: `${pkmn.name} was fully restored${statusNote}!` };
      }

      case 'revive': {
        if (pkmn.currentHP > 0) {
          return { success: false, message: `${pkmn.name} hasn't fainted!` };
        }
        pkmn.currentHP = Math.max(1, Math.floor(pkmn.maxHP * eff.fraction));
        pkmn.status    = null;
        SaveSystem.useItem(itemKey);
        return { success: true, message: `${pkmn.name} was revived with ${pkmn.currentHP} HP!` };
      }

      case 'statBoost': {
        if (pkmn.currentHP <= 0) {
          return { success: false, message: `${pkmn.name} has fainted!` };
        }
        const stat = eff.stat;
        const prev = pkmn.stages[stat] ?? 0;
        if (prev >= 6) {
          return { success: false, message: `${pkmn.name}'s ${stat} won't go higher!` };
        }
        pkmn.stages[stat] = Math.min(6, prev + eff.stages);
        SaveSystem.useItem(itemKey);
        return { success: true, message: `${pkmn.name}'s ${stat} sharply rose!` };
      }

      default:
        return { success: false, message: 'Unknown effect.' };
    }
  }

  // ─── Bag UI renderer ──────────────────────────
  /**
   * Build the bag panel HTML inside the battle bag menu.
   * @param {Function} onSelect  - Callback(itemKey) when an item is clicked
   * @param {object[]} playerTeam
   * @param {object}   activePkmn
   */
  function renderBagUI(containerEl, onSelect, playerTeam, activePkmn) {
    containerEl.innerHTML = '';

    const inv = SaveSystem.getInventory();
    const entries = Object.entries(inv).filter(([, count]) => count > 0);

    if (entries.length === 0) {
      containerEl.innerHTML = '<p style="color:var(--text-dim);padding:16px;font-size:13px">Your bag is empty!</p>';
      return;
    }

    entries.forEach(([key, count]) => {
      const item = ITEM_DATA[key];
      if (!item) return;

      const btn = document.createElement('button');
      btn.className = 'bag-item-btn';
      btn.innerHTML = `
        <span class="bag-icon">${item.icon}</span>
        <span class="bag-name">${item.name}</span>
        <span class="bag-desc">${item.desc}</span>
        <span class="bag-count">×${count}</span>
      `;
      btn.addEventListener('click', () => onSelect(key));
      containerEl.appendChild(btn);
    });
  }

  return {
    ITEM_DATA,
    useOnPokemon,
    renderBagUI
  };

})();
