// ═══════════════════════════════════════════════════
//  src/battle/weather.js
//  Full battle weather + terrain system.
//
//  Weather: Sun, Rain, Sand, Hail, Snow (Gen 9), Fog
//  Terrain: Electric, Psychic, Misty, Grassy
//
//  Effects applied per-turn via applyEndOfTurn(allPkmn).
//  Move modifier via getMoveMult(type, moveId, attacker).
// ═══════════════════════════════════════════════════

const Weather = (() => {

  const TYPES = {
    NONE:             'none',
    SUN:              'sun',
    RAIN:             'rain',
    SAND:             'sand',
    HAIL:             'hail',
    SNOW:             'snow',           // Gen 9 — no direct damage, defensive bonus for Ice
    FOG:              'fog',            // accuracy penalty
    ELECTRICTERRAIN:  'electricterrain',
    PSYCHICTERRAIN:   'psychicterrain',
    MISTYTERRAIN:     'mistyterrain',
    GRASSYTERRAIN:    'grassyterrain',
  };

  let _current    = TYPES.NONE;
  let _turnsLeft  = 0;
  let _suppressed = false;   // Cloud Nine / Air Lock

  // ── Visual / UI config ──────────────────────────
  const CONFIG = {
    none:             { label:'',                      icon:'',   bg:'',                particle: null       },
    sun:              { label:'Harsh sunlight!',        icon:'☀️',  bg:'weather-sun',    particle:'#f5c518'   },
    rain:             { label:"It's raining!",          icon:'🌧️',  bg:'weather-rain',   particle:'#4e8cff'   },
    sand:             { label:'A sandstorm is raging!', icon:'🌪️',  bg:'weather-sand',   particle:'#b8a038'   },
    hail:             { label:"It's hailing!",          icon:'🌨️',  bg:'weather-hail',   particle:'#74d0f0'   },
    snow:             { label:"It's snowing!",          icon:'❄️',  bg:'weather-snow',   particle:'#cce8ff'   },
    fog:              { label:'A thick fog...',         icon:'🌫️',  bg:'weather-fog',    particle:'#8899aa'   },
    electricterrain:  { label:'Electric Terrain!',      icon:'⚡',  bg:'terrain-elec',   particle:'#f5c518'   },
    psychicterrain:   { label:'Psychic Terrain!',       icon:'🔮',  bg:'terrain-psych',  particle:'#b06aff'   },
    mistyterrain:     { label:'Misty Terrain!',         icon:'🌸',  bg:'terrain-mist',   particle:'#ff8fa3'   },
    grassyterrain:    { label:'Grassy Terrain!',        icon:'🌿',  bg:'terrain-grass',  particle:'#3ddc84'   },
  };

  const TERRAIN_TYPES = new Set([
    TYPES.ELECTRICTERRAIN, TYPES.PSYCHICTERRAIN,
    TYPES.MISTYTERRAIN,    TYPES.GRASSYTERRAIN,
  ]);

  function isTerrain(t) { return TERRAIN_TYPES.has(t); }

  // ── Set / clear ─────────────────────────────────
  function set(type, turns = 5) {
    _current    = type;
    _turnsLeft  = turns;
    _suppressed = false;
    _updateUI();
    return CONFIG[type]?.label || '';
  }

  function clear() {
    _current   = TYPES.NONE;
    _turnsLeft = 0;
    _updateUI();
  }

  function suppress() {
    _suppressed = true;
    _updateUI();
  }

  function current()   { return _suppressed ? TYPES.NONE : _current; }
  function turnsLeft() { return _turnsLeft; }

  // ── End-of-turn effects ─────────────────────────
  function applyEndOfTurn(allPkmn) {
    if (_suppressed) return [];
    if (_current === TYPES.NONE) return [];

    const msgs = [];
    const c    = _current;

    allPkmn.forEach(p => {
      if (!p || p.currentHP <= 0) return;
      const types = p.types || [];

      // Sandstorm: 1/16 damage to non-Rock/Ground/Steel
      if (c === TYPES.SAND) {
        const immune = types.some(t => ['rock','ground','steel'].includes(t));
        if (!immune && !p._sandImmune) {
          const dmg = Math.max(1, Math.floor(p.maxHP / 16));
          p.currentHP = Math.max(0, p.currentHP - dmg);
          msgs.push(`${p.name} is buffeted by the sandstorm!`);
        }
      }

      // Hail: 1/16 damage to non-Ice types
      if (c === TYPES.HAIL) {
        const immune = types.includes('ice');
        if (!immune && !p._hailImmune) {
          const dmg = Math.max(1, Math.floor(p.maxHP / 16));
          p.currentHP = Math.max(0, p.currentHP - dmg);
          msgs.push(`${p.name} is pelted by hail!`);
        }
      }

      // Snow: no damage — Ice-types get +50% Sp.Def (applied in engine)
      // Grassy Terrain: heals all grounded Pokémon 1/16 per turn
      if (c === TYPES.GRASSYTERRAIN && !p._airborne) {
        const restored = Math.max(1, Math.floor(p.maxHP / 16));
        p.currentHP = Math.min(p.maxHP, p.currentHP + restored);
        msgs.push(`${p.name} restored HP using the Grassy Terrain!`);
      }
    });

    // Tick down
    _turnsLeft--;
    if (_turnsLeft <= 0) {
      const endMsgs = {
        sun:             'The sunlight faded.',
        rain:            'The rain stopped.',
        sand:            'The sandstorm subsided.',
        hail:            'The hail stopped.',
        snow:            'The snow stopped.',
        fog:             'The fog lifted.',
        electricterrain: 'The Electric Terrain faded.',
        psychicterrain:  'The Psychic Terrain faded.',
        mistyterrain:    'The Misty Terrain faded.',
        grassyterrain:   'The Grassy Terrain faded.',
      };
      msgs.push(endMsgs[_current] || 'The weather cleared.');
      clear();
    }

    return msgs;
  }

  // ── Move power modifier ─────────────────────────
  function getMoveMult(moveType, moveId, attacker) {
    const c = current();
    let mult = 1;

    // Weather boosts
    if (c === TYPES.SUN) {
      if (moveType === 'fire')  mult *= 1.5;
      if (moveType === 'water') mult *= 0.5;
    }
    if (c === TYPES.RAIN) {
      if (moveType === 'water') mult *= 1.5;
      if (moveType === 'fire')  mult *= 0.5;
    }
    if (c === TYPES.SAND) {
      // Rock types get +50% Sp.Def — handled in engine, not move mult
    }
    if (c === TYPES.SNOW) {
      // Ice types get +50% Sp.Def — handled in engine
    }

    // Terrain boosts (grounded attacker only)
    if (!attacker?._airborne) {
      if (c === TYPES.ELECTRICTERRAIN && moveType === 'electric') mult *= 1.3;
      if (c === TYPES.PSYCHICTERRAIN  && moveType === 'psychic')  mult *= 1.3;
      if (c === TYPES.GRASSYTERRAIN   && moveType === 'grass')    mult *= 1.3;
      // Misty Terrain: halves Dragon moves
      if (c === TYPES.MISTYTERRAIN    && moveType === 'dragon')   mult *= 0.5;
    }

    return mult;
  }

  // ── Accuracy modifier ───────────────────────────
  function getAccuracyMult(moveId) {
    const c = current();
    if (c === TYPES.FOG)  return 0.6;  // all moves lose accuracy in fog
    if (c === TYPES.RAIN  && moveId === 'thunder')  return 9999; // auto-hit
    if (c === TYPES.HAIL  && moveId === 'blizzard') return 9999;
    if (c === TYPES.SUN   && moveId === 'thunder')  return 0.5;
    if (c === TYPES.SUN   && moveId === 'blizzard') return 0.5;
    return 1;
  }

  // ── Terrain status block ────────────────────────
  function blocksSleepForGrounded() {
    return current() === TYPES.ELECTRICTERRAIN;
  }

  function blocksDragonForGrounded() {
    return current() === TYPES.MISTYTERRAIN;
  }

  function halvesDamageForGrounded() {
    // Misty Terrain halves all non-Pokémon move damage vs grounded
    return current() === TYPES.MISTYTERRAIN;
  }

  // ── Defensive stat bonus (Snow/Sand) ───────────
  function getDefBonus(pkmn, statName) {
    const c     = current();
    const types = pkmn.types || [];
    if (c === TYPES.SAND && statName === 'spdef' && types.includes('rock'))  return 1.5;
    if (c === TYPES.SNOW && statName === 'defense' && types.includes('ice')) return 1.5;
    return 1;
  }

  // ── UI ──────────────────────────────────────────
  function _updateUI() {
    const cfg   = CONFIG[_current] || CONFIG.none;
    const hud   = document.getElementById('weather-hud');
    const arena = document.querySelector('.battle-arena');
    const canvas= document.getElementById('weather-particle-canvas');

    // HUD badge
    if (hud) {
      if (_current === TYPES.NONE || _suppressed) {
        hud.classList.add('hidden');
      } else {
        hud.classList.remove('hidden');
        hud.innerHTML = `<span class="weather-icon">${cfg.icon}</span>` +
          `<span class="weather-label">${cfg.label}</span>` +
          `<span class="weather-turns">${_turnsLeft > 0 ? _turnsLeft + ' turns' : ''}</span>`;
      }
    }

    // Arena background tint
    if (arena) {
      const allBgs = Object.values(CONFIG).map(c => c.bg).filter(Boolean);
      arena.classList.remove(...allBgs);
      if (_current !== TYPES.NONE && !_suppressed) arena.classList.add(cfg.bg);
    }

    // Particles
    stopParticles();
    if (canvas && _current !== TYPES.NONE && !_suppressed && cfg.particle) {
      // Size canvas to match arena
      const rect = (arena || canvas).getBoundingClientRect();
      canvas.width  = rect.width  || 600;
      canvas.height = rect.height || 300;
      startParticles(canvas);
    }
  }

  // ── Canvas particle system ───────────────────────
  const _particles = [];
  let _animFrame   = null;

  function startParticles(canvas) {
    _particles.length = 0;
    if (_animFrame) cancelAnimationFrame(_animFrame);
    const cfg = CONFIG[_current];
    if (!cfg?.particle || _suppressed) return;

    const ctx = canvas.getContext('2d');
    const W   = canvas.width, H = canvas.height;
    const color = cfg.particle;

    // Spawn initial particles
    for (let i = 0; i < 40; i++) {
      _particles.push({
        x: Math.random() * W,
        y: Math.random() * H,
        vy: _current === 'rain' ? 6 + Math.random() * 4 : 1 + Math.random() * 2,
        vx: _current === 'sand' ? 3 + Math.random() * 2 : (_current === 'rain' ? 1 : 0),
        size: _current === 'rain' ? 2 : 3 + Math.random() * 3,
        alpha: 0.4 + Math.random() * 0.4,
      });
    }

    function draw() {
      ctx.clearRect(0, 0, W, H);
      _particles.forEach(p => {
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle   = color;
        if (_current === 'rain') {
          ctx.fillRect(p.x, p.y, 1, p.size * 4);
        } else {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size / 2, 0, Math.PI * 2);
          ctx.fill();
        }
        p.x += p.vx; p.y += p.vy;
        if (p.y > H) { p.y = -10; p.x = Math.random() * W; }
        if (p.x > W) { p.x = 0; }
      });
      ctx.globalAlpha = 1;
      _animFrame = requestAnimationFrame(draw);
    }
    draw();
  }

  function stopParticles() {
    if (_animFrame) { cancelAnimationFrame(_animFrame); _animFrame = null; }
    _particles.length = 0;
  }

  // ── Backwards-compatibility aliases ───────────
  // engine.js and main.js call these older names
  function reset()               { return clear(); }
  function tick(allPkmn)         { return applyEndOfTurn(allPkmn); }

  return {
    TYPES, isTerrain,
    set, clear, reset, suppress, current, turnsLeft,
    applyEndOfTurn, tick,
    getMoveMult, getAccuracyMult,
    getDefBonus, blocksSleepForGrounded, blocksDragonForGrounded,
    halvesDamageForGrounded,
    startParticles, stopParticles,
    // Backwards compat aliases
    bypassAccuracy: getAccuracyMult,
  };

})();
