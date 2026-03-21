// ═══════════════════════════════════════════════════
//  src/items/items.js
//  Full item system — 60+ items with PokeAPI sprite URLs,
//  proper descriptions, and battle/overworld effects.
//
//  Items are split into categories:
//    medicine   — HP/status restore
//    battle     — in-battle stat boosts
//    pokeball   — catching (overworld)
//    berry      — consumable in battle
//    evolution  — trigger evolutions
//    held       — passive held-item effects (see heldItems.js)
//    key        — story key items
// ═══════════════════════════════════════════════════

const Items = (() => {

  // PokeAPI item sprite base URL
  const SPRITE = id =>
    `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/${id}.png`;

  // ─── Item definitions ─────────────────────────
  const ITEM_DATA = {

    // ══ Medicine — HP restore ══
    potion: {
      name:'Potion', category:'medicine',
      sprite: SPRITE('potion'),
      desc:'Restores 20 HP to one Pokémon.',
      usable:'both',
      effect:{ type:'heal', amount:20 }
    },
    superPotion: {
      name:'Super Potion', category:'medicine',
      sprite: SPRITE('super-potion'),
      desc:'Restores 60 HP to one Pokémon.',
      usable:'both',
      effect:{ type:'heal', amount:60 }
    },
    hyperPotion: {
      name:'Hyper Potion', category:'medicine',
      sprite: SPRITE('hyper-potion'),
      desc:'Restores 120 HP to one Pokémon.',
      usable:'both',
      effect:{ type:'heal', amount:120 }
    },
    maxPotion: {
      name:'Max Potion', category:'medicine',
      sprite: SPRITE('max-potion'),
      desc:'Fully restores HP to one Pokémon.',
      usable:'both',
      effect:{ type:'heal', amount:99999 }
    },
    fullRestore: {
      name:'Full Restore', category:'medicine',
      sprite: SPRITE('full-restore'),
      desc:'Fully restores HP and cures all status.',
      usable:'both',
      effect:{ type:'fullHeal' }
    },
    freshWater: {
      name:'Fresh Water', category:'medicine',
      sprite: SPRITE('fresh-water'),
      desc:'Restores 30 HP to one Pokémon.',
      usable:'both',
      effect:{ type:'heal', amount:30 }
    },
    sodaPop: {
      name:'Soda Pop', category:'medicine',
      sprite: SPRITE('soda-pop'),
      desc:'Restores 50 HP to one Pokémon.',
      usable:'both',
      effect:{ type:'heal', amount:50 }
    },
    lemonade: {
      name:'Lemonade', category:'medicine',
      sprite: SPRITE('lemonade'),
      desc:'Restores 80 HP to one Pokémon.',
      usable:'both',
      effect:{ type:'heal', amount:80 }
    },
    moomooMilk: {
      name:'Moomoo Milk', category:'medicine',
      sprite: SPRITE('moomoo-milk'),
      desc:'Restores 100 HP to one Pokémon.',
      usable:'both',
      effect:{ type:'heal', amount:100 }
    },
    energyPowder: {
      name:'Energy Powder', category:'medicine',
      sprite: SPRITE('energy-powder'),
      desc:'Restores 60 HP (Pokémon dislikes it).',
      usable:'both',
      effect:{ type:'heal', amount:60 }
    },
    energyRoot: {
      name:'Energy Root', category:'medicine',
      sprite: SPRITE('energy-root'),
      desc:'Restores 120 HP (Pokémon dislikes it).',
      usable:'both',
      effect:{ type:'heal', amount:120 }
    },

    // ══ Medicine — Revive ══
    revive: {
      name:'Revive', category:'medicine',
      sprite: SPRITE('revive'),
      desc:'Revives a fainted Pokémon to half HP.',
      usable:'both',
      effect:{ type:'revive', fraction:0.5 }
    },
    maxRevive: {
      name:'Max Revive', category:'medicine',
      sprite: SPRITE('max-revive'),
      desc:'Revives a fainted Pokémon to full HP.',
      usable:'both',
      effect:{ type:'revive', fraction:1.0 }
    },
    revivalHerb: {
      name:'Revival Herb', category:'medicine',
      sprite: SPRITE('revival-herb'),
      desc:'Revives a fainted Pokémon to full HP (Pokémon dislikes it).',
      usable:'both',
      effect:{ type:'revive', fraction:1.0 }
    },

    // ══ Medicine — Status cure ══
    antidote: {
      name:'Antidote', category:'medicine',
      sprite: SPRITE('antidote'),
      desc:'Cures poison.',
      usable:'both',
      effect:{ type:'cureStatus', status:'poison' }
    },
    burnHeal: {
      name:'Burn Heal', category:'medicine',
      sprite: SPRITE('burn-heal'),
      desc:'Cures burn.',
      usable:'both',
      effect:{ type:'cureStatus', status:'burn' }
    },
    iceHeal: {
      name:'Ice Heal', category:'medicine',
      sprite: SPRITE('ice-heal'),
      desc:'Cures freeze.',
      usable:'both',
      effect:{ type:'cureStatus', status:'freeze' }
    },
    awakening: {
      name:'Awakening', category:'medicine',
      sprite: SPRITE('awakening'),
      desc:'Wakes a sleeping Pokémon.',
      usable:'both',
      effect:{ type:'cureStatus', status:'sleep' }
    },
    parlyzHeal: {
      name:'Parlyz Heal', category:'medicine',
      sprite: SPRITE('parlyz-heal'),
      desc:'Cures paralysis.',
      usable:'both',
      effect:{ type:'cureStatus', status:'paralysis' }
    },
    fullHeal: {
      name:'Full Heal', category:'medicine',
      sprite: SPRITE('full-heal'),
      desc:'Cures any status condition.',
      usable:'both',
      effect:{ type:'cureStatus', status:'any' }
    },
    lavaCookie: {
      name:'Lava Cookie', category:'medicine',
      sprite: SPRITE('lava-cookie'),
      desc:'Local Lavaridge specialty — cures any status.',
      usable:'both',
      effect:{ type:'cureStatus', status:'any' }
    },
    oldGateau: {
      name:'Old Gateau', category:'medicine',
      sprite: SPRITE('old-gateau'),
      desc:'Old Chateau specialty — cures any status.',
      usable:'both',
      effect:{ type:'cureStatus', status:'any' }
    },

    // ══ PP restore ══
    ether: {
      name:'Ether', category:'medicine',
      sprite: SPRITE('ether'),
      desc:'Restores 10 PP to one move.',
      usable:'both',
      effect:{ type:'restorePP', amount:10 }
    },
    maxEther: {
      name:'Max Ether', category:'medicine',
      sprite: SPRITE('max-ether'),
      desc:'Fully restores PP of one move.',
      usable:'both',
      effect:{ type:'restorePP', amount:99999 }
    },
    elixir: {
      name:'Elixir', category:'medicine',
      sprite: SPRITE('elixir'),
      desc:'Restores 10 PP to all moves.',
      usable:'both',
      effect:{ type:'restoreAllPP', amount:10 }
    },
    maxElixir: {
      name:'Max Elixir', category:'medicine',
      sprite: SPRITE('max-elixir'),
      desc:'Fully restores PP of all moves.',
      usable:'both',
      effect:{ type:'restoreAllPP', amount:99999 }
    },

    // ══ Battle items — stat boosts ══
    xAttack: {
      name:'X Attack', category:'battle',
      sprite: SPRITE('x-attack'),
      desc:'Sharply raises Attack for this battle.',
      usable:'battle',
      effect:{ type:'statBoost', stat:'attack', stages:2 }
    },
    xDefense: {
      name:'X Defense', category:'battle',
      sprite: SPRITE('x-defense'),
      desc:'Sharply raises Defense for this battle.',
      usable:'battle',
      effect:{ type:'statBoost', stat:'defense', stages:2 }
    },
    xSpeed: {
      name:'X Speed', category:'battle',
      sprite: SPRITE('x-speed'),
      desc:'Sharply raises Speed for this battle.',
      usable:'battle',
      effect:{ type:'statBoost', stat:'speed', stages:2 }
    },
    xSpecial: {
      name:'X Special', category:'battle',
      sprite: SPRITE('x-sp-atk'),
      desc:'Sharply raises Sp.Atk for this battle.',
      usable:'battle',
      effect:{ type:'statBoost', stat:'spatk', stages:2 }
    },
    xSpDef: {
      name:'X Sp. Def', category:'battle',
      sprite: SPRITE('x-sp-def'),
      desc:'Sharply raises Sp.Def for this battle.',
      usable:'battle',
      effect:{ type:'statBoost', stat:'spdef', stages:2 }
    },
    xAccuracy: {
      name:'X Accuracy', category:'battle',
      sprite: SPRITE('x-accuracy'),
      desc:'Sharply raises Accuracy for this battle.',
      usable:'battle',
      effect:{ type:'statBoost', stat:'accuracy', stages:2 }
    },
    guardSpec: {
      name:'Guard Spec.', category:'battle',
      sprite: SPRITE('guard-spec'),
      desc:'Prevents stat reduction for your team.',
      usable:'battle',
      effect:{ type:'guardSpec' }
    },
    direHit: {
      name:'Dire Hit', category:'battle',
      sprite: SPRITE('dire-hit'),
      desc:'Raises critical-hit ratio for this battle.',
      usable:'battle',
      effect:{ type:'critBoost' }
    },

    // ══ Pokéballs ══
    pokeball: {
      name:'Poké Ball', category:'pokeball',
      sprite: SPRITE('poke-ball'),
      desc:'A device for catching Pokémon.',
      usable:'overworld',
      effect:{ type:'catch', rate:1 }
    },
    greatball: {
      name:'Great Ball', category:'pokeball',
      sprite: SPRITE('great-ball'),
      desc:'A good ball with a higher catch rate.',
      usable:'overworld',
      effect:{ type:'catch', rate:1.5 }
    },
    ultraball: {
      name:'Ultra Ball', category:'pokeball',
      sprite: SPRITE('ultra-ball'),
      desc:'An excellent ball with a high catch rate.',
      usable:'overworld',
      effect:{ type:'catch', rate:2 }
    },
    masterball: {
      name:'Master Ball', category:'pokeball',
      sprite: SPRITE('master-ball'),
      desc:'Catches any Pokémon without fail.',
      usable:'overworld',
      effect:{ type:'catch', rate:9999 }
    },
    netball: {
      name:'Net Ball', category:'pokeball',
      sprite: SPRITE('net-ball'),
      desc:'More effective on Water and Bug types.',
      usable:'overworld',
      effect:{ type:'catch', rate:3, typeBonus:['water','bug'] }
    },
    nestball: {
      name:'Nest Ball', category:'pokeball',
      sprite: SPRITE('nest-ball'),
      desc:'More effective on lower-level Pokémon.',
      usable:'overworld',
      effect:{ type:'catch', rate:1 }
    },
    repeatball: {
      name:'Repeat Ball', category:'pokeball',
      sprite: SPRITE('repeat-ball'),
      desc:'More effective on Pokémon you\'ve caught before.',
      usable:'overworld',
      effect:{ type:'catch', rate:3 }
    },
    timerball: {
      name:'Timer Ball', category:'pokeball',
      sprite: SPRITE('timer-ball'),
      desc:'More effective the longer the battle.',
      usable:'overworld',
      effect:{ type:'catch', rate:1 }
    },
    duskball: {
      name:'Dusk Ball', category:'pokeball',
      sprite: SPRITE('dusk-ball'),
      desc:'More effective at night and in caves.',
      usable:'overworld',
      effect:{ type:'catch', rate:3 }
    },
    healball: {
      name:'Heal Ball', category:'pokeball',
      sprite: SPRITE('heal-ball'),
      desc:'Fully restores the caught Pokémon.',
      usable:'overworld',
      effect:{ type:'catch', rate:1 }
    },
    quickball: {
      name:'Quick Ball', category:'pokeball',
      sprite: SPRITE('quick-ball'),
      desc:'More effective at the start of battle.',
      usable:'overworld',
      effect:{ type:'catch', rate:5 }
    },
    cherryball: {
      name:'Cherish Ball', category:'pokeball',
      sprite: SPRITE('cherish-ball'),
      desc:'A special ball for event Pokémon.',
      usable:'overworld',
      effect:{ type:'catch', rate:1 }
    },

    // ══ Berries (consumed in battle) ══
    oranBerry: {
      name:'Oran Berry', category:'berry',
      sprite: SPRITE('oran-berry'),
      desc:'Restores 10 HP when held and HP drops low.',
      usable:'held',
      effect:{ type:'heal', amount:10, trigger:'lowHP' }
    },
    sitrusBerry: {
      name:'Sitrus Berry', category:'berry',
      sprite: SPRITE('sitrus-berry'),
      desc:'Restores 25% HP when held and HP drops to half.',
      usable:'held',
      effect:{ type:'healPercent', fraction:0.25, trigger:'halfHP' }
    },
    leppaBerry: {
      name:'Leppa Berry', category:'berry',
      sprite: SPRITE('leppa-berry'),
      desc:'Restores 10 PP of one move when held.',
      usable:'held',
      effect:{ type:'restorePP', amount:10, trigger:'emptyPP' }
    },
    rawstBerry: {
      name:'Rawst Berry', category:'berry',
      sprite: SPRITE('rawst-berry'),
      desc:'Cures burn when held.',
      usable:'held',
      effect:{ type:'cureStatus', status:'burn', trigger:'onStatus' }
    },
    chestoBerry: {
      name:'Chesto Berry', category:'berry',
      sprite: SPRITE('chesto-berry'),
      desc:'Cures sleep when held.',
      usable:'held',
      effect:{ type:'cureStatus', status:'sleep', trigger:'onStatus' }
    },
    pechaBerry: {
      name:'Pecha Berry', category:'berry',
      sprite: SPRITE('pecha-berry'),
      desc:'Cures poison when held.',
      usable:'held',
      effect:{ type:'cureStatus', status:'poison', trigger:'onStatus' }
    },
    aspearBerry: {
      name:'Aspear Berry', category:'berry',
      sprite: SPRITE('aspear-berry'),
      desc:'Cures freeze when held.',
      usable:'held',
      effect:{ type:'cureStatus', status:'freeze', trigger:'onStatus' }
    },
    chopleBerry: {
      name:'Chople Berry', category:'berry',
      sprite: SPRITE('chople-berry'),
      desc:'Reduces damage from super-effective Fighting moves.',
      usable:'held',
      effect:{ type:'resistSuper', weakType:'fighting' }
    },

    // ══ Evolution items ══
    firestone: {
      name:'Fire Stone', category:'evolution',
      sprite: SPRITE('fire-stone'),
      desc:'Evolves certain Pokémon using fire energy.',
      usable:'overworld',
      effect:{ type:'evolve', trigger:'stone', stoneType:'fire' }
    },
    waterstone: {
      name:'Water Stone', category:'evolution',
      sprite: SPRITE('water-stone'),
      desc:'Evolves certain Pokémon using water energy.',
      usable:'overworld',
      effect:{ type:'evolve', trigger:'stone', stoneType:'water' }
    },
    thunderstone: {
      name:'Thunder Stone', category:'evolution',
      sprite: SPRITE('thunder-stone'),
      desc:'Evolves certain Pokémon using electric energy.',
      usable:'overworld',
      effect:{ type:'evolve', trigger:'stone', stoneType:'thunder' }
    },
    leafstone: {
      name:'Leaf Stone', category:'evolution',
      sprite: SPRITE('leaf-stone'),
      desc:'Evolves certain Pokémon using leaf energy.',
      usable:'overworld',
      effect:{ type:'evolve', trigger:'stone', stoneType:'leaf' }
    },
    moonstone: {
      name:'Moon Stone', category:'evolution',
      sprite: SPRITE('moon-stone'),
      desc:'Evolves certain Pokémon using moon energy.',
      usable:'overworld',
      effect:{ type:'evolve', trigger:'stone', stoneType:'moon' }
    },
    sunstone: {
      name:'Sun Stone', category:'evolution',
      sprite: SPRITE('sun-stone'),
      desc:'Evolves certain Pokémon using sun energy.',
      usable:'overworld',
      effect:{ type:'evolve', trigger:'stone', stoneType:'sun' }
    },
    dawnstone: {
      name:'Dawn Stone', category:'evolution',
      sprite: SPRITE('dawn-stone'),
      desc:'Evolves certain Pokémon.',
      usable:'overworld',
      effect:{ type:'evolve', trigger:'stone', stoneType:'dawn' }
    },
    duskstone: {
      name:'Dusk Stone', category:'evolution',
      sprite: SPRITE('dusk-stone'),
      desc:'Evolves certain Pokémon.',
      usable:'overworld',
      effect:{ type:'evolve', trigger:'stone', stoneType:'dusk' }
    },
    shinystone: {
      name:'Shiny Stone', category:'evolution',
      sprite: SPRITE('shiny-stone'),
      desc:'Evolves certain Pokémon.',
      usable:'overworld',
      effect:{ type:'evolve', trigger:'stone', stoneType:'shiny' }
    },
    iceStone: {
      name:'Ice Stone', category:'evolution',
      sprite: SPRITE('ice-stone'),
      desc:'Evolves certain Pokémon.',
      usable:'overworld',
      effect:{ type:'evolve', trigger:'stone', stoneType:'ice' }
    },
    linkingCord: {
      name:'Linking Cord', category:'evolution',
      sprite: SPRITE('linking-cord'),
      desc:'Evolves Pokémon that normally need trading.',
      usable:'overworld',
      effect:{ type:'evolve', trigger:'stone', stoneType:'trade' }
    },
    kingsrock: {
      name:'King\'s Rock', category:'evolution',
      sprite: SPRITE('kings-rock'),
      desc:'Evolves Slowpoke and Poliwhirl when traded.',
      usable:'overworld',
      effect:{ type:'evolve', trigger:'stone', stoneType:'kingsrock' }
    },
    metalcoat: {
      name:'Metal Coat', category:'evolution',
      sprite: SPRITE('metal-coat'),
      desc:'Evolves Scyther and Onix when traded.',
      usable:'overworld',
      effect:{ type:'evolve', trigger:'stone', stoneType:'metalcoat' }
    },

    // ══ Vitamins / EV items ══
    hpUp: {
      name:'HP Up', category:'vitamin',
      sprite: SPRITE('hp-up'),
      desc:'Raises the base HP of one Pokémon.',
      usable:'overworld',
      effect:{ type:'vitamin', stat:'hp' }
    },
    protein: {
      name:'Protein', category:'vitamin',
      sprite: SPRITE('protein'),
      desc:'Raises the base Attack of one Pokémon.',
      usable:'overworld',
      effect:{ type:'vitamin', stat:'attack' }
    },
    iron: {
      name:'Iron', category:'vitamin',
      sprite: SPRITE('iron'),
      desc:'Raises the base Defense of one Pokémon.',
      usable:'overworld',
      effect:{ type:'vitamin', stat:'defense' }
    },
    calcium: {
      name:'Calcium', category:'vitamin',
      sprite: SPRITE('calcium'),
      desc:'Raises the base Sp.Atk of one Pokémon.',
      usable:'overworld',
      effect:{ type:'vitamin', stat:'spatk' }
    },
    zinc: {
      name:'Zinc', category:'vitamin',
      sprite: SPRITE('zinc'),
      desc:'Raises the base Sp.Def of one Pokémon.',
      usable:'overworld',
      effect:{ type:'vitamin', stat:'spdef' }
    },
    carbos: {
      name:'Carbos', category:'vitamin',
      sprite: SPRITE('carbos'),
      desc:'Raises the base Speed of one Pokémon.',
      usable:'overworld',
      effect:{ type:'vitamin', stat:'speed' }
    },
    rareCandy: {
      name:'Rare Candy', category:'vitamin',
      sprite: SPRITE('rare-candy'),
      desc:'Instantly raises a Pokémon\'s level by 1.',
      usable:'overworld',
      effect:{ type:'rareCandy' }
    },

    // ══ Held items (see heldItems.js for actual combat logic) ══
    choiceBand: {
      name:'Choice Band', category:'held',
      sprite: SPRITE('choice-band'),
      desc:'Boosts Attack by 50% but locks into one move.',
      usable:'held',
      effect:{ type:'held', id:'choiceBand' }
    },
    choiceSpecs: {
      name:'Choice Specs', category:'held',
      sprite: SPRITE('choice-specs'),
      desc:'Boosts Sp.Atk by 50% but locks into one move.',
      usable:'held',
      effect:{ type:'held', id:'choiceSpecs' }
    },
    choiceScarf: {
      name:'Choice Scarf', category:'held',
      sprite: SPRITE('choice-scarf'),
      desc:'Boosts Speed by 50% but locks into one move.',
      usable:'held',
      effect:{ type:'held', id:'choiceScarf' }
    },
    lifeOrb: {
      name:'Life Orb', category:'held',
      sprite: SPRITE('life-orb'),
      desc:'Boosts move power by 30% at cost of some HP.',
      usable:'held',
      effect:{ type:'held', id:'lifeOrb' }
    },
    leftovers: {
      name:'Leftovers', category:'held',
      sprite: SPRITE('leftovers'),
      desc:'Restores 1/16 HP at end of each turn.',
      usable:'held',
      effect:{ type:'held', id:'leftovers' }
    },
    focusSash: {
      name:'Focus Sash', category:'held',
      sprite: SPRITE('focus-sash'),
      desc:'Survives a KO hit at full HP with 1 HP.',
      usable:'held',
      effect:{ type:'held', id:'focusSash' }
    },
    rockyHelmet: {
      name:'Rocky Helmet', category:'held',
      sprite: SPRITE('rocky-helmet'),
      desc:'Damages attacker by 1/6 HP on contact.',
      usable:'held',
      effect:{ type:'held', id:'rockyHelmet' }
    },
    assaultVest: {
      name:'Assault Vest', category:'held',
      sprite: SPRITE('assault-vest'),
      desc:'Raises Sp.Def by 50% but prevents status moves.',
      usable:'held',
      effect:{ type:'held', id:'assaultVest' }
    },
    expertBelt: {
      name:'Expert Belt', category:'held',
      sprite: SPRITE('expert-belt'),
      desc:'Boosts super-effective moves by 20%.',
      usable:'held',
      effect:{ type:'held', id:'expertBelt' }
    },
    heavyDutyBoots: {
      name:'Heavy-Duty Boots', category:'held',
      sprite: SPRITE('heavy-duty-boots'),
      desc:'Protects against entry hazards.',
      usable:'held',
      effect:{ type:'held', id:'heavyDutyBoots' }
    },
  };

  // ─── Category ordering ─────────────────────────
  const CATEGORY_ORDER = ['medicine','battle','pokeball','berry','evolution','vitamin','held','key'];
  const CATEGORY_LABELS = {
    medicine:'🧪 Medicine', battle:'⚔️ Battle', pokeball:'🔴 Poké Balls',
    berry:'🍒 Berries', evolution:'🌀 Evolution', vitamin:'💊 Vitamins',
    held:'💎 Held Items', key:'🗝️ Key Items',
  };

  // ─── Apply item effect ─────────────────────────
  function useOnPokemon(itemKey, pkmn) {
    const item = ITEM_DATA[itemKey];
    if (!item) return { success:false, message:'Unknown item.' };

    const count = SaveSystem.getItemCount(itemKey);
    if (count <= 0) return { success:false, message:`No ${item.name}s left!` };

    const eff = item.effect;

    switch (eff.type) {

      case 'heal': {
        if (pkmn.currentHP <= 0)      return { success:false, message:`${pkmn.name} has fainted!` };
        if (pkmn.currentHP >= pkmn.maxHP) return { success:false, message:`${pkmn.name}'s HP is full!` };
        const restored = Math.min(eff.amount, pkmn.maxHP - pkmn.currentHP);
        pkmn.currentHP += restored;
        SaveSystem.useItem(itemKey);
        return { success:true, message:`${pkmn.name} recovered ${restored} HP!` };
      }

      case 'fullHeal': {
        if (pkmn.currentHP <= 0) return { success:false, message:`${pkmn.name} has fainted!` };
        const was = pkmn.status;
        pkmn.currentHP = pkmn.maxHP;
        pkmn.status    = null;
        SaveSystem.useItem(itemKey);
        return { success:true, message:`${pkmn.name} was fully restored${was?' and cured of '+was:''}!` };
      }

      case 'revive': {
        if (pkmn.currentHP > 0) return { success:false, message:`${pkmn.name} hasn't fainted!` };
        pkmn.currentHP = Math.max(1, Math.floor(pkmn.maxHP * eff.fraction));
        pkmn.status    = null;
        SaveSystem.useItem(itemKey);
        return { success:true, message:`${pkmn.name} was revived with ${pkmn.currentHP} HP!` };
      }

      case 'cureStatus': {
        if (pkmn.currentHP <= 0) return { success:false, message:`${pkmn.name} has fainted!` };
        if (!pkmn.status) return { success:false, message:`${pkmn.name} has no status condition!` };
        if (eff.status !== 'any' && pkmn.status !== eff.status)
          return { success:false, message:`${pkmn.name} doesn't have ${eff.status}!` };
        const cured = pkmn.status;
        pkmn.status = null;
        SaveSystem.useItem(itemKey);
        return { success:true, message:`${pkmn.name} was cured of ${cured}!` };
      }

      case 'statBoost': {
        if (pkmn.currentHP <= 0) return { success:false, message:`${pkmn.name} has fainted!` };
        const st = eff.stat;
        const prev = pkmn.stages?.[st] ?? 0;
        if (prev >= 6) return { success:false, message:`${pkmn.name}'s ${st} won't go higher!` };
        if (!pkmn.stages) pkmn.stages = {};
        pkmn.stages[st] = Math.min(6, prev + eff.stages);
        SaveSystem.useItem(itemKey);
        return { success:true, message:`${pkmn.name}'s ${st} sharply rose!` };
      }

      case 'restorePP': {
        if (pkmn.currentHP <= 0) return { success:false, message:`${pkmn.name} has fainted!` };
        // Restore PP to the move with the least PP remaining
        if (!pkmn.moves?.length) return { success:false, message:'No moves to restore!' };
        const move = pkmn.moves.reduce((m,n) => ((n.currentPP??n.pp)<(m.currentPP??m.pp) ? n : m));
        const before = move.currentPP ?? move.pp;
        move.currentPP = Math.min(move.pp, before + eff.amount);
        SaveSystem.useItem(itemKey);
        return { success:true, message:`${move.name}'s PP was restored!` };
      }

      case 'restoreAllPP': {
        if (pkmn.currentHP <= 0) return { success:false, message:`${pkmn.name} has fainted!` };
        if (!pkmn.moves?.length) return { success:false, message:'No moves!' };
        pkmn.moves.forEach(m => { m.currentPP = m.pp; });
        SaveSystem.useItem(itemKey);
        return { success:true, message:`All of ${pkmn.name}'s moves had their PP restored!` };
      }

      case 'critBoost': {
        if (pkmn.currentHP <= 0) return { success:false, message:`${pkmn.name} has fainted!` };
        pkmn._critBoost = (pkmn._critBoost || 0) + 1;
        SaveSystem.useItem(itemKey);
        return { success:true, message:`${pkmn.name} is getting pumped up!` };
      }

      case 'guardSpec': {
        pkmn._guardSpec = true;
        SaveSystem.useItem(itemKey);
        return { success:true, message:'A barrier was created against stat reduction!' };
      }

      default:
        return { success:false, message:'This item can\'t be used here.' };
    }
  }

  // ─── Bag UI renderer ──────────────────────────
  function renderBagUI(containerEl, onSelect, playerTeam, activePkmn) {
    containerEl.innerHTML = '';

    const inv = SaveSystem.getInventory();

    // Group by category
    const groups = {};
    Object.entries(ITEM_DATA).forEach(([key, item]) => {
      const count = inv[key] || 0;
      if (count <= 0) return;
      const cat = item.category || 'misc';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push({ key, item, count });
    });

    if (Object.keys(groups).length === 0) {
      containerEl.innerHTML = '<p style="color:var(--text-dim);padding:16px;font-size:13px">Your bag is empty!</p>';
      return;
    }

    CATEGORY_ORDER.forEach(cat => {
      if (!groups[cat]?.length) return;

      // Category header
      const header = document.createElement('div');
      header.className = 'bag-cat-header';
      header.textContent = CATEGORY_LABELS[cat] || cat;
      containerEl.appendChild(header);

      groups[cat].forEach(({ key, item, count }) => {
        const btn = document.createElement('button');
        btn.className = 'bag-item-btn';

        // Sprite: try PokeAPI image, fall back to emoji
        const spriteHtml = item.sprite
          ? `<img class="bag-sprite" src="${item.sprite}" alt="${item.name}" onerror="this.style.display='none'">`
          : '';

        btn.innerHTML = `
          ${spriteHtml}
          <span class="bag-name">${item.name}</span>
          <span class="bag-desc">${item.desc}</span>
          <span class="bag-count">×${count}</span>
        `;
        btn.addEventListener('click', () => onSelect(key));
        containerEl.appendChild(btn);
      });
    });
  }

  // ─── Get all items (for UI/cheats) ────────────
  function getAllItems() { return ITEM_DATA; }
  function getItem(key) { return ITEM_DATA[key] || null; }

  return {
    ITEM_DATA,
    CATEGORY_LABELS,
    useOnPokemon,
    renderBagUI,
    getAllItems,
    getItem,
  };

})();
