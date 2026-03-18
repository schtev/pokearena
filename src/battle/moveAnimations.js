// ═══════════════════════════════════════════════════
//  src/battle/moveAnimations.js   (Part 6)
//  Type-specific move animations using canvas + CSS.
//  Each type has a unique colour burst, particle
//  pattern, or screen effect layered over the arena.
//
//  Called from BattleAnimations.playAttackSequence()
//  before the hit flash.
// ═══════════════════════════════════════════════════

const MoveAnimations = (() => {

  // ─── Type colour palette ──────────────────────
  const TYPE_COLORS = {
    normal:   '#9a9a8c', fire:     '#e8304a', water:    '#4e8cff',
    grass:    '#3ddc84', electric: '#f5c518', ice:      '#74d0f0',
    fighting: '#c03028', poison:   '#a040a0', ground:   '#e0c068',
    flying:   '#a890f0', psychic:  '#f85888', bug:      '#a8b820',
    rock:     '#b8a038', ghost:    '#705898', dragon:   '#7038f8',
    dark:     '#705848', steel:    '#b8b8d0', fairy:    '#f0b6bc',
  };

  // ─── Canvas helper ────────────────────────────
  function getArenaCanvas() {
    const arenaEl = document.querySelector('.battle-arena');
    if (!arenaEl) return { canvas: null, ctx: null, w: 0, h: 0 };

    let canvas = document.getElementById('move-anim-canvas');
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.id = 'move-anim-canvas';
      canvas.style.cssText =
        'position:absolute;inset:0;pointer-events:none;z-index:4;';
      arenaEl.appendChild(canvas);
    }
    canvas.width  = arenaEl.offsetWidth;
    canvas.height = arenaEl.offsetHeight;
    return { canvas, ctx: canvas.getContext('2d'), w: canvas.width, h: canvas.height };
  }

  function clearCanvas() {
    const { canvas, ctx, w, h } = getArenaCanvas();
    if (ctx) ctx.clearRect(0, 0, w, h);
  }

  // ─── Generic burst (fallback for unmapped types) ─
  async function burst(color, x, y, radius = 60, duration = 300) {
    return new Promise(resolve => {
      const { canvas, ctx, w, h } = getArenaCanvas();
      if (!ctx) { resolve(); return; }

      const start = performance.now();
      function frame(now) {
        const t = Math.min(1, (now - start) / duration);
        ctx.clearRect(0, 0, w, h);
        ctx.save();
        ctx.globalAlpha = (1 - t) * 0.7;
        const grad = ctx.createRadialGradient(x, y, 0, x, y, radius * t * 1.5);
        grad.addColorStop(0, color + 'ff');
        grad.addColorStop(1, color + '00');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x, y, radius * t * 1.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        if (t < 1) requestAnimationFrame(frame);
        else { ctx.clearRect(0, 0, w, h); resolve(); }
      }
      requestAnimationFrame(frame);
    });
  }

  // ─── Type-specific animations ─────────────────

  async function animateFire(targetEl) {
    const { canvas, ctx, w, h } = getArenaCanvas();
    if (!ctx) return;
    const r = targetEl.getBoundingClientRect();
    const ar = canvas.getBoundingClientRect();
    const cx = r.left - ar.left + r.width / 2;
    const cy = r.top  - ar.top  + r.height / 2;

    const particles = Array.from({ length: 28 }, () => ({
      x: cx, y: cy,
      vx: (Math.random() - 0.5) * 8,
      vy: -(Math.random() * 8 + 2),
      life: 1, size: 4 + Math.random() * 8,
    }));

    await new Promise(resolve => {
      function frame() {
        ctx.clearRect(0, 0, w, h);
        let alive = false;
        particles.forEach(p => {
          if (p.life <= 0) return;
          p.x += p.vx; p.y += p.vy; p.vy += 0.3; p.life -= 0.04;
          p.size *= 0.97;
          if (p.life > 0) {
            alive = true;
            ctx.save();
            ctx.globalAlpha = p.life * 0.85;
            const t = 1 - p.life;
            ctx.fillStyle = t < 0.4 ? '#f5c518' : t < 0.7 ? '#e8304a' : '#7038f8';
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }
        });
        if (alive) requestAnimationFrame(frame);
        else { ctx.clearRect(0, 0, w, h); resolve(); }
      }
      requestAnimationFrame(frame);
    });
  }

  async function animateWater(targetEl) {
    const { canvas, ctx, w, h } = getArenaCanvas();
    if (!ctx) return;
    const r = targetEl.getBoundingClientRect();
    const ar = canvas.getBoundingClientRect();
    const cx = r.left - ar.left + r.width / 2;
    const cy = r.top  - ar.top  + r.height / 2;

    const drops = Array.from({ length: 20 }, () => ({
      x: cx + (Math.random() - 0.5) * 40,
      y: cy - 30,
      vy: 2 + Math.random() * 4,
      life: 1, r: 4 + Math.random() * 6,
    }));

    await new Promise(resolve => {
      function frame() {
        ctx.clearRect(0, 0, w, h);
        let alive = false;
        drops.forEach(d => {
          if (d.life <= 0) return;
          d.y += d.vy; d.vy += 0.25; d.life -= 0.035;
          if (d.life > 0) {
            alive = true;
            ctx.save();
            ctx.globalAlpha = d.life * 0.75;
            ctx.fillStyle = '#4e8cff';
            ctx.beginPath();
            ctx.ellipse(d.x, d.y, d.r * 0.6, d.r, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }
        });
        if (alive) requestAnimationFrame(frame);
        else { ctx.clearRect(0, 0, w, h); resolve(); }
      }
      requestAnimationFrame(frame);
    });
  }

  async function animateElectric(targetEl) {
    const { canvas, ctx, w, h } = getArenaCanvas();
    if (!ctx) return;
    const r = targetEl.getBoundingClientRect();
    const ar = canvas.getBoundingClientRect();
    const cx = r.left - ar.left + r.width / 2;
    const cy = r.top  - ar.top  + r.height / 2;

    let frame = 0;
    await new Promise(resolve => {
      function draw() {
        ctx.clearRect(0, 0, w, h);
        if (frame >= 12) { ctx.clearRect(0, 0, w, h); resolve(); return; }
        ctx.save();
        ctx.strokeStyle = '#f5c518';
        ctx.lineWidth = 2.5;
        ctx.shadowColor = '#f5c518';
        ctx.shadowBlur  = 12;
        ctx.globalAlpha = frame % 2 === 0 ? 0.9 : 0.3;

        // Zigzag lightning bolt from top to target
        ctx.beginPath();
        let lx = cx - 10 + Math.random() * 20;
        let ly = cy - 80;
        ctx.moveTo(lx, ly);
        while (ly < cy) {
          lx += (Math.random() - 0.5) * 30;
          ly += 14 + Math.random() * 10;
          ctx.lineTo(lx, ly);
        }
        ctx.stroke();
        ctx.restore();
        frame++;
        requestAnimationFrame(draw);
      }
      requestAnimationFrame(draw);
    });
  }

  async function animateGrass(targetEl) {
    const { canvas, ctx, w, h } = getArenaCanvas();
    if (!ctx) return;
    const r = targetEl.getBoundingClientRect();
    const ar = canvas.getBoundingClientRect();
    const cx = r.left - ar.left + r.width / 2;
    const cy = r.top  - ar.top  + r.height / 2;

    const leaves = Array.from({ length: 16 }, (_, i) => ({
      angle: (i / 16) * Math.PI * 2,
      dist: 0, life: 1, size: 8 + Math.random() * 5,
    }));

    await new Promise(resolve => {
      function frame() {
        ctx.clearRect(0, 0, w, h);
        let alive = false;
        leaves.forEach(l => {
          if (l.life <= 0) return;
          l.dist += 3; l.life -= 0.038;
          if (l.life > 0) {
            alive = true;
            const lx = cx + Math.cos(l.angle) * l.dist;
            const ly = cy + Math.sin(l.angle) * l.dist;
            ctx.save();
            ctx.globalAlpha = l.life * 0.8;
            ctx.fillStyle   = '#3ddc84';
            ctx.translate(lx, ly);
            ctx.rotate(l.angle + Math.PI / 2);
            ctx.beginPath();
            ctx.ellipse(0, 0, l.size * 0.4, l.size, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }
        });
        if (alive) requestAnimationFrame(frame);
        else { ctx.clearRect(0, 0, w, h); resolve(); }
      }
      requestAnimationFrame(frame);
    });
  }

  async function animateIce(targetEl) {
    const { canvas, ctx, w, h } = getArenaCanvas();
    if (!ctx) return;
    const r = targetEl.getBoundingClientRect();
    const ar = canvas.getBoundingClientRect();
    const cx = r.left - ar.left + r.width / 2;
    const cy = r.top  - ar.top  + r.height / 2;

    // Crystalline star burst
    const arms = 8;
    let t = 0;
    await new Promise(resolve => {
      function frame() {
        ctx.clearRect(0, 0, w, h);
        if (t >= 1) { ctx.clearRect(0, 0, w, h); resolve(); return; }
        t += 0.045;
        const maxR = 55 * t;
        ctx.save();
        ctx.strokeStyle = '#74d0f0';
        ctx.lineWidth   = 2;
        ctx.globalAlpha = (1 - t) * 0.85;
        ctx.shadowColor = '#74d0f0';
        ctx.shadowBlur  = 10;
        for (let i = 0; i < arms; i++) {
          const ang = (i / arms) * Math.PI * 2;
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(cx + Math.cos(ang) * maxR, cy + Math.sin(ang) * maxR);
          ctx.stroke();
          // Branch
          const branchR = maxR * 0.55;
          const bx = cx + Math.cos(ang) * branchR;
          const by = cy + Math.sin(ang) * branchR;
          [0.4, -0.4].forEach(off => {
            ctx.beginPath();
            ctx.moveTo(bx, by);
            ctx.lineTo(bx + Math.cos(ang + off) * maxR * 0.35, by + Math.sin(ang + off) * maxR * 0.35);
            ctx.stroke();
          });
        }
        ctx.restore();
        requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    });
  }

  async function animatePsychic(targetEl) {
    const { canvas, ctx, w, h } = getArenaCanvas();
    if (!ctx) return;
    const r = targetEl.getBoundingClientRect();
    const ar = canvas.getBoundingClientRect();
    const cx = r.left - ar.left + r.width / 2;
    const cy = r.top  - ar.top  + r.height / 2;

    let t = 0;
    await new Promise(resolve => {
      function frame() {
        ctx.clearRect(0, 0, w, h);
        if (t >= 1) { ctx.clearRect(0, 0, w, h); resolve(); return; }
        t += 0.03;
        const rings = 4;
        for (let i = 0; i < rings; i++) {
          const phase = (t + i / rings) % 1;
          const radius = phase * 80;
          ctx.save();
          ctx.strokeStyle = '#f85888';
          ctx.lineWidth   = 3;
          ctx.globalAlpha = (1 - phase) * 0.7;
          ctx.shadowColor = '#f85888';
          ctx.shadowBlur  = 14;
          ctx.beginPath();
          ctx.arc(cx, cy, radius, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
        requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    });
  }

  async function animateGhost(targetEl) {
    const { canvas, ctx, w, h } = getArenaCanvas();
    if (!ctx) return;
    const r = targetEl.getBoundingClientRect();
    const ar = canvas.getBoundingClientRect();
    const cx = r.left - ar.left + r.width / 2;
    const cy = r.top  - ar.top  + r.height / 2;

    let t = 0;
    await new Promise(resolve => {
      function frame() {
        ctx.clearRect(0, 0, w, h);
        if (t >= 1) { ctx.clearRect(0, 0, w, h); resolve(); return; }
        t += 0.025;
        // Darkness vortex
        ctx.save();
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 70 * t + 10);
        grad.addColorStop(0, 'rgba(112,88,152,0.7)');
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle   = grad;
        ctx.globalAlpha = Math.sin(t * Math.PI) * 0.8;
        ctx.beginPath();
        ctx.arc(cx, cy, 75, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    });
  }

  async function animateFighting(targetEl) {
    const { canvas, ctx, w, h } = getArenaCanvas();
    if (!ctx) return;
    const r = targetEl.getBoundingClientRect();
    const ar = canvas.getBoundingClientRect();
    const cx = r.left - ar.left + r.width / 2;
    const cy = r.top  - ar.top  + r.height / 2;

    // Impact stars
    const stars = Array.from({ length: 6 }, (_, i) => ({
      angle: (i / 6) * Math.PI * 2 + Math.PI / 12,
      life: 1, r: 0,
    }));
    await new Promise(resolve => {
      function frame() {
        ctx.clearRect(0, 0, w, h);
        let alive = false;
        stars.forEach(s => {
          if (s.life <= 0) return;
          s.r += 4; s.life -= 0.06;
          if (s.life > 0) {
            alive = true;
            const sx = cx + Math.cos(s.angle) * s.r;
            const sy = cy + Math.sin(s.angle) * s.r;
            ctx.save();
            ctx.globalAlpha = s.life * 0.9;
            ctx.fillStyle   = '#c03028';
            ctx.translate(sx, sy);
            ctx.rotate(s.angle);
            // Star shape
            ctx.beginPath();
            for (let j = 0; j < 5; j++) {
              const a = (j / 5) * Math.PI * 2 - Math.PI / 2;
              const ir = j % 2 === 0 ? 10 : 5;
              ctx.lineTo(Math.cos(a) * ir, Math.sin(a) * ir);
            }
            ctx.closePath();
            ctx.fill();
            ctx.restore();
          }
        });
        if (alive) requestAnimationFrame(frame);
        else { ctx.clearRect(0, 0, w, h); resolve(); }
      }
      requestAnimationFrame(frame);
    });
  }

  // ─── Dispatcher ───────────────────────────────
  const ANIM_MAP = {
    fire:     animateFire,
    water:    animateWater,
    electric: animateElectric,
    grass:    animateGrass,
    ice:      animateIce,
    psychic:  animatePsychic,
    ghost:    animateGhost,
    dark:     animateGhost,   // reuse ghost effect
    fighting: animateFighting,
  };

  /**
   * Play the type-appropriate animation on the target element.
   * Falls back to a generic colour burst for unmapped types.
   *
   * @param {string}      moveType  - The move's type key
   * @param {HTMLElement} targetEl  - Defender sprite element
   * @returns {Promise<void>}
   */
  async function play(moveType, targetEl) {
    const anim = ANIM_MAP[moveType];
    const color = TYPE_COLORS[moveType] || '#ffffff';

    if (anim) {
      await anim(targetEl);
    } else {
      const r  = targetEl.getBoundingClientRect();
      const ar = document.querySelector('.battle-arena').getBoundingClientRect();
      const cx = r.left - ar.left + r.width / 2;
      const cy = r.top  - ar.top  + r.height / 2;
      await burst(color, cx, cy, 60, 280);
    }
    clearCanvas();
  }

  return { play, clearCanvas };

})();
