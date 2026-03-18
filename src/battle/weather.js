// ═══════════════════════════════════════════════════
//  src/battle/weather.js   (Part 5)
//  Battle weather system: Sunny, Rain, Sandstorm, Hail
//  Affects move power, end-of-turn damage, and some
//  abilities. Weather lasts 5 turns by default.
// ═══════════════════════════════════════════════════

const Weather = (() => {

  const TYPES = {
    NONE:      'none',
    SUN:       'sun',
    RAIN:      'rain',
    SAND:      'sand',
    HAIL:      'hail',
  };

  // Current battle weather state (reset each battle)
  let _current  = TYPES.NONE;
  let _turnsLeft = 0;

  // Visual config per weather
  const CONFIG = {
    none: { label: '',            icon: '',   bgClass: '',          particleColor: null },
    sun:  { label: 'Harsh sunlight!', icon: '☀️', bgClass: 'weather-sun',  particleColor: '#f5c518' },
    rain: { label: 'It\'s raining!',  icon: '🌧️', bgClass: 'weather-rain', particleColor: '#4e8cff' },
    sand: { label: 'A sandstorm!',    icon: '🌪️', bgClass: 'weather-sand', particleColor: '#b8a038' },
    hail: { label: 'It\'s hailing!',  icon: '🌨️', bgClass: 'weather-hail', particleColor: '#74d0f0' },
  };

  // ─── Set / clear ──────────────────────────────
  function set(type, turns = 5) {
    _current   = type;
    _turnsLeft = turns;
    updateUI();
    return CONFIG[type]?.label || '';
  }

  function clear() {
    _current   = TYPES.NONE;
    _turnsLeft = 0;
    updateUI();
  }

  function reset() { clear(); }

  function get()       { return _current; }
  function turnsLeft() { return _turnsLeft; }
  function isActive()  { return _current !== TYPES.NONE; }

  // ─── End-of-turn tick ────────────────────────
  /**
   * Called at end of each turn. Ticks down duration,
   * applies weather damage, returns log messages.
   * @param {object[]} allPkmn - [playerActive, enemyActive]
   * @returns {string[]} messages
   */
  function tick(allPkmn) {
    if (_current === TYPES.NONE) return [];
    const msgs = [];

    // Apply damage
    allPkmn.forEach(pkmn => {
      if (!pkmn || pkmn.currentHP <= 0) return;

      // Sand: damages non-Rock/Ground/Steel
      if (_current === TYPES.SAND) {
        const immune = ['rock','ground','steel'].some(t => pkmn.types.includes(t));
        if (!immune) {
          const dmg = Math.max(1, Math.floor(pkmn.maxHP / 16));
          pkmn.currentHP = Math.max(0, pkmn.currentHP - dmg);
          msgs.push(`${pkmn.name} is buffeted by the sandstorm!`);
        }
      }

      // Hail: damages non-Ice types
      if (_current === TYPES.HAIL) {
        const immune = pkmn.types.includes('ice');
        if (!immune) {
          const dmg = Math.max(1, Math.floor(pkmn.maxHP / 16));
          pkmn.currentHP = Math.max(0, pkmn.currentHP - dmg);
          msgs.push(`${pkmn.name} is pelted by hail!`);
        }
      }
    });

    // Tick down duration
    _turnsLeft--;
    if (_turnsLeft <= 0) {
      const endMsg = {
        sun:  'The sunlight faded.',
        rain: 'The rain stopped.',
        sand: 'The sandstorm subsided.',
        hail: 'The hail stopped.',
      }[_current] || 'The weather cleared.';
      msgs.push(endMsg);
      clear();
    }

    return msgs;
  }

  // ─── Move power modifier ──────────────────────
  /**
   * Returns a multiplier for a move's power based on weather.
   * @param {string} moveType
   * @returns {number}
   */
  function getMoveMult(moveType) {
    if (_current === TYPES.SUN) {
      if (moveType === 'fire')  return 1.5;
      if (moveType === 'water') return 0.5;
    }
    if (_current === TYPES.RAIN) {
      if (moveType === 'water') return 1.5;
      if (moveType === 'fire')  return 0.5;
    }
    return 1;
  }

  // ─── Accuracy modifier ────────────────────────
  /** Thunder/Blizzard hit through Rain/Hail without check */
  function bypassAccuracy(moveId) {
    if (_current === TYPES.RAIN && moveId === 'thunder')   return true;
    if (_current === TYPES.HAIL && moveId === 'blizzard')  return true;
    return false;
  }

  // ─── UI ───────────────────────────────────────
  function updateUI() {
    const cfg    = CONFIG[_current] || CONFIG.none;
    const hudEl  = document.getElementById('weather-hud');
    const arenaEl= document.querySelector('.battle-arena');

    // Update HUD badge
    if (hudEl) {
      if (_current === TYPES.NONE) {
        hudEl.classList.add('hidden');
      } else {
        hudEl.classList.remove('hidden');
        hudEl.innerHTML = `${cfg.icon} ${_turnsLeft > 0 ? _turnsLeft + ' turns' : ''}`;
      }
    }

    // Swap arena background class
    if (arenaEl) {
      arenaEl.classList.remove('weather-sun','weather-rain','weather-sand','weather-hail');
      if (_current !== TYPES.NONE) arenaEl.classList.add(cfg.bgClass);
    }

    // Update / clear particle canvas
    if (_current !== TYPES.NONE) {
      startParticles(cfg.particleColor, _current);
    } else {
      stopParticles();
    }
  }

  // ─── Canvas particle effects ──────────────────
  let _canvas = null;
  let _ctx    = null;
  let _raf    = null;
  let _particles = [];

  function startParticles(color, weatherType) {
    stopParticles();

    const arenaEl = document.querySelector('.battle-arena');
    if (!arenaEl) return;

    _canvas = document.getElementById('weather-canvas');
    if (!_canvas) {
      _canvas = document.createElement('canvas');
      _canvas.id = 'weather-canvas';
      _canvas.style.cssText =
        'position:absolute;inset:0;pointer-events:none;z-index:3;opacity:0.55;';
      arenaEl.appendChild(_canvas);
    }

    _canvas.width  = arenaEl.offsetWidth;
    _canvas.height = arenaEl.offsetHeight;
    _ctx = _canvas.getContext('2d');

    // Spawn particles
    _particles = [];
    const count = weatherType === 'sand' ? 60 : weatherType === 'rain' ? 80 : 40;
    for (let i = 0; i < count; i++) {
      _particles.push(makeParticle(weatherType, color, _canvas.width, _canvas.height));
    }

    function loop() {
      _ctx.clearRect(0, 0, _canvas.width, _canvas.height);
      _particles.forEach((p, idx) => {
        tickParticle(p, weatherType, _canvas.width, _canvas.height);
        drawParticle(_ctx, p, weatherType, color);
      });
      _raf = requestAnimationFrame(loop);
    }
    _raf = requestAnimationFrame(loop);
  }

  function stopParticles() {
    if (_raf)    { cancelAnimationFrame(_raf); _raf = null; }
    if (_canvas) { _canvas.remove(); _canvas = null; _ctx = null; }
    _particles = [];
  }

  function makeParticle(type, color, w, h) {
    return {
      x:   Math.random() * w,
      y:   Math.random() * h - h,
      spd: 1 + Math.random() * 3,
      len: type === 'rain' ? 8 + Math.random() * 10 : 3 + Math.random() * 4,
      ang: type === 'rain' ? 0.3 : type === 'sand' ? 0.1 : 0,
      sz:  1 + Math.random() * 1.5,
      alpha: 0.4 + Math.random() * 0.5,
    };
  }

  function tickParticle(p, type, w, h) {
    if (type === 'rain') {
      p.x += Math.sin(p.ang) * p.spd * 0.8;
      p.y += p.spd * 4;
    } else if (type === 'sand') {
      p.x += p.spd * 2;
      p.y += Math.sin(p.ang) * p.spd * 0.3;
      p.ang += 0.05;
    } else {
      p.x += Math.sin(p.ang) * p.spd * 0.5;
      p.y += p.spd * 2;
    }
    // Wrap
    if (p.y > h + 10) { p.y = -10; p.x = Math.random() * w; }
    if (p.x > w + 10) p.x = -10;
    if (p.x < -10)    p.x = w + 10;
  }

  function drawParticle(ctx, p, type, color) {
    ctx.save();
    ctx.globalAlpha = p.alpha;
    ctx.strokeStyle = color;
    ctx.fillStyle   = color;

    if (type === 'rain') {
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + Math.sin(p.ang) * p.len * 0.5, p.y + p.len);
      ctx.stroke();
    } else if (type === 'sun') {
      // Tiny sparkles
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.sz, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.sz, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  return {
    TYPES, set, clear, reset, get, turnsLeft, isActive,
    tick, getMoveMult, bypassAccuracy, updateUI
  };

})();
