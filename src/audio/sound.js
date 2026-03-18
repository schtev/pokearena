// ═══════════════════════════════════════════════════
//  src/audio/sound.js   (Part 2)
//  Procedural sound effects via Web Audio API.
//  No external files — all sounds are synthesised
//  from oscillators and noise. Works offline too!
// ═══════════════════════════════════════════════════

const SoundSystem = (() => {

  let ctx = null;
  let masterGain = null;
  let _muted = false;
  let _volume = 0.35;

  // ─── Init ─────────────────────────────────────
  // AudioContext must be created after a user gesture (browser policy).
  function init() {
    if (ctx) return;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = ctx.createGain();
      masterGain.gain.value = _volume;
      masterGain.connect(ctx.destination);
    } catch (e) {
      console.warn('Web Audio not supported:', e);
    }
  }

  function setVolume(v) {
    _volume = Math.max(0, Math.min(1, v));
    if (masterGain) masterGain.gain.value = _muted ? 0 : _volume;
  }

  function toggleMute() {
    _muted = !_muted;
    if (masterGain) masterGain.gain.value = _muted ? 0 : _volume;
    return _muted;
  }

  // ─── Low-level helpers ────────────────────────
  function createOsc(type, freq, startTime, duration, gainVal = 0.3) {
    if (!ctx) return;
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type      = type;
    osc.frequency.setValueAtTime(freq, startTime);
    gain.gain.setValueAtTime(gainVal, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(startTime);
    osc.stop(startTime + duration);
    return { osc, gain };
  }

  function createNoise(startTime, duration, gainVal = 0.15, filterFreq = 2000) {
    if (!ctx) return;
    const bufSize = ctx.sampleRate * duration;
    const buffer  = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data    = buffer.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;

    const src    = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const gain   = ctx.createGain();

    src.buffer          = buffer;
    filter.type         = 'bandpass';
    filter.frequency.value = filterFreq;
    gain.gain.setValueAtTime(gainVal, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);
    src.start(startTime);
    return src;
  }

  // ─── Sound effects ────────────────────────────
  const SFX = {

    // Menu navigation blip
    menuSelect() {
      if (!ctx) return;
      const t = ctx.currentTime;
      createOsc('square', 880, t,        0.04, 0.2);
      createOsc('square', 1100, t + 0.04, 0.04, 0.2);
    },

    // Pokémon enters battle (rising sweep)
    pokemonEnter() {
      if (!ctx) return;
      const t = ctx.currentTime;
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(200, t);
      osc.frequency.linearRampToValueAtTime(600, t + 0.35);
      gain.gain.setValueAtTime(0.3, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
      osc.connect(gain);
      gain.connect(masterGain);
      osc.start(t);
      osc.stop(t + 0.4);
    },

    // Normal hit (short thud)
    hitNormal() {
      if (!ctx) return;
      const t = ctx.currentTime;
      createNoise(t, 0.12, 0.25, 800);
      createOsc('sawtooth', 120, t, 0.08, 0.2);
    },

    // Super effective hit (sharper, louder)
    hitSuper() {
      if (!ctx) return;
      const t = ctx.currentTime;
      createNoise(t, 0.2, 0.4, 1400);
      createOsc('square', 200, t,       0.06, 0.3);
      createOsc('square', 160, t + 0.06, 0.1, 0.25);
    },

    // Not very effective (muffled thud)
    hitWeak() {
      if (!ctx) return;
      const t = ctx.currentTime;
      createNoise(t, 0.08, 0.12, 400);
      createOsc('sine', 100, t, 0.08, 0.15);
    },

    // Move miss
    miss() {
      if (!ctx) return;
      const t = ctx.currentTime;
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(400, t);
      osc.frequency.exponentialRampToValueAtTime(150, t + 0.2);
      gain.gain.setValueAtTime(0.15, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
      osc.connect(gain);
      gain.connect(masterGain);
      osc.start(t);
      osc.stop(t + 0.25);
    },

    // Critical hit (dramatic crack)
    critHit() {
      if (!ctx) return;
      const t = ctx.currentTime;
      createNoise(t, 0.25, 0.5, 2000);
      createOsc('sawtooth', 300, t,        0.05, 0.4);
      createOsc('sawtooth', 250, t + 0.05, 0.15, 0.35);
    },

    // Pokémon faint (descending sad tone)
    faint() {
      if (!ctx) return;
      const t = ctx.currentTime;
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, t);
      osc.frequency.linearRampToValueAtTime(110, t + 0.6);
      gain.gain.setValueAtTime(0.25, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.65);
      osc.connect(gain);
      gain.connect(masterGain);
      osc.start(t);
      osc.stop(t + 0.7);
    },

    // Victory fanfare (classic ascending arpeggio)
    victory() {
      if (!ctx) return;
      const t = ctx.currentTime;
      const notes = [523, 659, 784, 1047]; // C5, E5, G5, C6
      notes.forEach((freq, i) => {
        createOsc('square', freq, t + i * 0.12, 0.18, 0.28);
      });
      // Final chord
      [523, 659, 784].forEach(freq => {
        createOsc('square', freq, t + notes.length * 0.12, 0.5, 0.2);
      });
    },

    // Defeat (sad descending)
    defeat() {
      if (!ctx) return;
      const t = ctx.currentTime;
      const notes = [392, 349, 330, 294]; // G4, F4, E4, D4
      notes.forEach((freq, i) => {
        createOsc('triangle', freq, t + i * 0.18, 0.22, 0.22);
      });
    },

    // HP low warning beep (call this on a loop when HP < 20%)
    lowHPBeep() {
      if (!ctx) return;
      const t = ctx.currentTime;
      createOsc('square', 880, t, 0.06, 0.15);
    },

    // Item used
    itemUse() {
      if (!ctx) return;
      const t = ctx.currentTime;
      createOsc('sine', 660, t,       0.08, 0.2);
      createOsc('sine', 880, t + 0.08, 0.08, 0.2);
      createOsc('sine', 1100, t + 0.16, 0.1, 0.2);
    },

    // Level up jingle
    levelUp() {
      if (!ctx) return;
      const t = ctx.currentTime;
      const notes = [523, 659, 784, 1047, 784, 1047]; // rising then holds
      notes.forEach((freq, i) => {
        createOsc('square', freq, t + i * 0.1, 0.12, i >= 4 ? 0.3 : 0.2);
      });
    },

    // Evolution sparkle (shimmer of highs)
    evolution() {
      if (!ctx) return;
      const t = ctx.currentTime;
      [1047, 1319, 1568, 2093, 1568, 1319, 1047].forEach((freq, i) => {
        createOsc('sine', freq, t + i * 0.08, 0.15, 0.25);
      });
    },

    // Status inflicted (buzzy tone)
    statusInflict() {
      if (!ctx) return;
      const t = ctx.currentTime;
      createOsc('sawtooth', 220, t, 0.3, 0.2);
    },

    // Tower floor cleared
    floorClear() {
      if (!ctx) return;
      const t = ctx.currentTime;
      [784, 988, 1175, 1568].forEach((freq, i) => {
        createOsc('triangle', freq, t + i * 0.1, 0.18, 0.3);
      });
    }
  };

  // ─── Play with auto-init ───────────────────────
  function play(sfxName) {
    init();
    if (ctx?.state === 'suspended') ctx.resume();
    if (SFX[sfxName]) SFX[sfxName]();
  }

  return { init, play, setVolume, toggleMute, SFX };

})();
