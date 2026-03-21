// ═══════════════════════════════════════════════════
//  src/story/starterSelect.js
//  Professor Oak opening sequence + starter selection.
//  Self-contained: injects its own screen HTML + CSS.
//  No external dependencies beyond StorySave, Screen,
//  POKEMON_DATA (already in pokemon.js), and Overworld.
// ═══════════════════════════════════════════════════

const StarterSelect = (() => {

  const STARTERS = [
    { key: 'bulbasaur',  id: 1, name: 'Bulbasaur',  types: ['grass','poison'],
      desc: 'Well-rounded and effective against the first two gyms.', color: '#4CAF50' },
    { key: 'charmander', id: 4, name: 'Charmander', types: ['fire'],
      desc: 'Tough start but evolves into one of Kanto\'s strongest.', color: '#FF7043' },
    { key: 'squirtle',   id: 7, name: 'Squirtle',   types: ['water'],
      desc: 'Sturdy and reliable. Water is strong throughout Kanto.', color: '#42A5F5' },
  ];

  const OAK_LINES = {
    bulbasaur:  ['Ah — Bulbasaur! A fine choice.',
                 'This Pokémon has been with me for a while.',
                 'It is gentle and easy to raise.',
                 'I think you two will get along well!'],
    charmander: ['So you want Charmander!',
                 'It can be difficult to raise at first...',
                 'But stick with it — the rewards are great.',
                 'Good luck, Trainer!'],
    squirtle:   ['Squirtle — an excellent choice!',
                 'This Pokémon has outstanding defensive power.',
                 'It is a great choice for a beginning Trainer.',
                 'Treasure it well!'],
  };

  const TYPE_BG = { grass:'#388E3C', poison:'#7B1FA2', fire:'#E64A19',
                    water:'#1565C0', normal:'#616161', electric:'#F9A825' };

  let _selectedKey = null;
  let _oakLineIdx  = 0;
  let _playerName  = 'Red';
  let _rivalName   = 'Blue';
  let _gender      = 'male';

  // ── CSS ────────────────────────────────────────

  function _injectCSS() {
    if (document.getElementById('ss-styles')) return;
    const s = document.createElement('style');
    s.id = 'ss-styles';
    s.textContent = `
#screen-starter {
  background: var(--bg-dark);
  overflow-y: auto;
  align-items: center;
  justify-content: flex-start;
  padding: 24px 16px 40px;
}
.ss-step { display:none; flex-direction:column; align-items:center; gap:20px;
           width:100%; max-width:680px; animation:ssIn .3s ease; }
.ss-step.ss-active { display:flex; }
@keyframes ssIn { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:none} }

.ss-oak { text-align:center; }
.ss-oak img { width:88px; height:88px; image-rendering:pixelated;
              filter:drop-shadow(0 4px 12px rgba(78,140,255,.4)); }

.ss-dlg { background:var(--bg-panel); border:2px solid var(--border-bright);
          border-radius:var(--radius-md); padding:18px 22px 28px; width:100%;
          position:relative; }
.ss-dlg-text { font-size:14px; line-height:1.75; color:var(--text-primary); }
.ss-dlg-prompt { position:absolute; bottom:8px; right:14px; font-size:11px;
                 color:var(--accent-yellow); animation:blink 1.2s ease-in-out infinite; }
@keyframes blink { 0%,100%{opacity:1}50%{opacity:.25} }

.ss-form { background:var(--bg-panel); border:2px solid var(--border);
           border-radius:var(--radius-md); padding:22px; width:100%;
           display:flex; flex-direction:column; gap:14px; }
.ss-row  { display:flex; align-items:center; gap:14px; }
.ss-lbl  { font-family:var(--font-pixel); font-size:9px; color:var(--text-muted);
           width:110px; flex-shrink:0; }
.ss-inp  { flex:1; background:var(--bg-card); border:2px solid var(--border);
           border-radius:var(--radius-sm); color:var(--text-primary);
           font-family:var(--font-body); font-size:15px; padding:10px 13px; outline:none; }
.ss-inp:focus { border-color:var(--accent-blue); }

.ss-cards { display:flex; gap:14px; width:100%; flex-wrap:wrap; justify-content:center; }
.ss-card  { flex:1; min-width:160px; max-width:195px; background:var(--bg-panel);
            border:2px solid var(--border); border-radius:var(--radius-md);
            padding:18px 14px; cursor:pointer; display:flex; flex-direction:column;
            align-items:center; gap:8px;
            transition:border-color .2s, transform .2s, box-shadow .2s; }
.ss-card:hover { border-color:var(--accent-yellow); transform:translateY(-4px);
                 box-shadow:0 8px 22px rgba(245,197,24,.2); }
.ss-card.ss-selected { border-color:var(--accent-blue);
                        box-shadow:0 0 0 3px rgba(78,140,255,.3); }
.ss-card img { width:78px; height:78px; image-rendering:pixelated;
               filter:drop-shadow(0 3px 6px rgba(0,0,0,.5)); }
.ss-card-name { font-family:var(--font-pixel); font-size:10px; color:var(--text-primary); }
.ss-types { display:flex; gap:5px; flex-wrap:wrap; justify-content:center; }
.ss-type  { font-size:9px; font-family:var(--font-pixel); padding:3px 7px;
            border-radius:4px; color:#fff; }
.ss-card-desc { font-size:11px; color:var(--text-muted); text-align:center; line-height:1.5; }

.ss-chosen { display:flex; align-items:center; gap:18px; background:var(--bg-panel);
             border:2px solid var(--border); border-radius:var(--radius-md);
             padding:14px 22px; width:100%; }
.ss-chosen img { width:66px; height:66px; image-rendering:pixelated; }
.ss-chosen-name { font-family:var(--font-pixel); font-size:12px;
                  color:var(--text-primary); margin-bottom:8px; }

.ss-btns { display:flex; gap:14px; flex-wrap:wrap; justify-content:center; width:100%; }

.ss-gender-row { display:flex; gap:12px; }
.ss-gender-btn {
  display:flex; flex-direction:column; align-items:center; gap:6px;
  background:var(--bg-card); border:2px solid var(--border);
  border-radius:var(--radius-md); padding:10px 18px; cursor:pointer;
  font-family:var(--font-pixel); font-size:9px; color:var(--text-muted);
  transition:border-color .2s, color .2s;
}
.ss-gender-btn:hover { border-color:var(--accent-yellow); }
.ss-gender-btn.ss-gender-selected {
  border-color:var(--accent-blue); color:var(--text-primary);
  box-shadow:0 0 0 3px rgba(78,140,255,.2);
}
.ss-gender-sprite {
  width:51px; height:66px; image-rendering:pixelated;
}
    `;
    document.head.appendChild(s);
  }

  // ── HTML ───────────────────────────────────────

  function _buildHTML() {
    const spriteBase = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/';
    const oakSprite  = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/trainers/professor-oak.png';

    return `<div id="screen-starter" class="screen">

  <!-- Step 1: name entry -->
  <div id="ss-step-names" class="ss-step ss-active">
    <div class="ss-oak">
      <img src="${oakSprite}" onerror="this.style.opacity='.3'" alt="Prof. Oak">
    </div>
    <div class="ss-dlg">
      <p class="ss-dlg-text">Hello there! Welcome to the world of Pokémon!<br><br>
      My name is Oak — people call me the Pokémon Professor.<br><br>
      Before you begin your adventure, tell me about yourself!</p>
    </div>
    <div class="ss-form">
      <div class="ss-row">
        <span class="ss-lbl">Who are you?</span>
        <div class="ss-gender-row">
          <button class="ss-gender-btn ss-gender-selected" id="ss-gender-male"
                  onclick="StarterSelect._setGender('male')">
            <img src="sprites/overworld/red_down_idle.png" class="ss-gender-sprite" onerror="this.style.display='none'">
            <span>Boy</span>
          </button>
          <button class="ss-gender-btn" id="ss-gender-female"
                  onclick="StarterSelect._setGender('female')">
            <img src="sprites/overworld/leaf_down_idle.png" class="ss-gender-sprite" onerror="this.style.display='none'">
            <span>Girl</span>
          </button>
        </div>
      </div>
      <div class="ss-row">
        <span class="ss-lbl">Your name:</span>
        <input id="ss-player-name" class="ss-inp" maxlength="12" value="Red">
      </div>
      <div class="ss-row">
        <span class="ss-lbl">Rival's name:</span>
        <input id="ss-rival-name" class="ss-inp" maxlength="12" value="Blue">
      </div>
      <button class="big-btn" style="align-self:flex-end" onclick="StarterSelect._goChoose()">
        Next →
      </button>
    </div>
  </div>

  <!-- Step 2: pick your starter -->
  <div id="ss-step-choose" class="ss-step">
    <div class="ss-oak">
      <img src="${oakSprite}" onerror="this.style.opacity='.3'" alt="Prof. Oak">
    </div>
    <div class="ss-dlg">
      <p class="ss-dlg-text">Now then — are you ready?<br><br>
      A world of dreams and adventures with Pokémon awaits!<br><br>
      Choose your first partner Pokémon!</p>
    </div>
    <div class="ss-cards">
      ${STARTERS.map(s => `
      <div class="ss-card" id="ss-card-${s.key}" onclick="StarterSelect._pick('${s.key}')">
        <img src="${spriteBase}${s.id}.png" alt="${s.name}">
        <div class="ss-card-name">${s.name}</div>
        <div class="ss-types">
          ${s.types.map(t => `<span class="ss-type" style="background:${TYPE_BG[t]||'#555'}">${t}</span>`).join('')}
        </div>
        <div class="ss-card-desc">${s.desc}</div>
      </div>`).join('')}
    </div>
  </div>

  <!-- Step 3: Oak reacts, confirm -->
  <div id="ss-step-oak" class="ss-step">
    <div class="ss-oak">
      <img src="${oakSprite}" onerror="this.style.opacity='.3'" alt="Prof. Oak">
    </div>
    <div class="ss-chosen">
      <img id="ss-chosen-sprite" src="" alt="">
      <div>
        <div class="ss-chosen-name" id="ss-chosen-name"></div>
        <div class="ss-types" id="ss-chosen-types"></div>
      </div>
    </div>
    <div class="ss-dlg" style="cursor:pointer" onclick="StarterSelect._nextOakLine()">
      <p class="ss-dlg-text" id="ss-oak-text"></p>
      <span class="ss-dlg-prompt">▼ tap to continue</span>
    </div>
    <div class="ss-btns" id="ss-confirm-row" style="display:none">
      <button class="big-btn" onclick="StarterSelect._confirm()">Begin Adventure! →</button>
      <button class="big-btn secondary" onclick="StarterSelect._backToChoose()">← Choose Again</button>
    </div>
  </div>

</div>`;
  }

  // ── Step logic ─────────────────────────────────

  function _step(id) {
    ['ss-step-names','ss-step-choose','ss-step-oak'].forEach(s => {
      const el = document.getElementById(s);
      if (el) { el.classList.toggle('ss-active', s === id); }
    });
  }

  function _setGender(g) {
    _gender = g;
    // Update default name when gender changes
    const nameEl = document.getElementById('ss-player-name');
    if (nameEl && (nameEl.value === 'Red' || nameEl.value === 'Leaf')) {
      nameEl.value = g === 'female' ? 'Leaf' : 'Red';
    }
    document.getElementById('ss-gender-male')?.classList.toggle('ss-gender-selected', g === 'male');
    document.getElementById('ss-gender-female')?.classList.toggle('ss-gender-selected', g === 'female');
  }

  function _goChoose() {
    _playerName = (document.getElementById('ss-player-name')?.value || (_gender === 'female' ? 'Leaf' : 'Red')).trim() || 'Red';
    _rivalName  = (document.getElementById('ss-rival-name')?.value  || 'Blue').trim() || 'Blue';
    _step('ss-step-choose');
  }

  function _pick(key) {
    _selectedKey = key;
    document.querySelectorAll('.ss-card').forEach(c => c.classList.remove('ss-selected'));
    document.getElementById(`ss-card-${key}`)?.classList.add('ss-selected');

    const starter = STARTERS.find(s => s.key === key);
    const spriteBase = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/';

    const sp = document.getElementById('ss-chosen-sprite');
    const nm = document.getElementById('ss-chosen-name');
    const ty = document.getElementById('ss-chosen-types');
    const tx = document.getElementById('ss-oak-text');
    const cr = document.getElementById('ss-confirm-row');

    if (sp) sp.src = `${spriteBase}${starter.id}.png`;
    if (nm) nm.textContent = starter.name;
    if (ty) ty.innerHTML = starter.types.map(t =>
      `<span class="ss-type" style="background:${TYPE_BG[t]||'#555'}">${t}</span>`).join('');
    if (tx) tx.textContent = OAK_LINES[key][0];
    if (cr) cr.style.display = 'none';

    _oakLineIdx = 0;
    _step('ss-step-oak');
  }

  function _nextOakLine() {
    if (!_selectedKey) return;
    const lines = OAK_LINES[_selectedKey];
    _oakLineIdx++;
    const tx = document.getElementById('ss-oak-text');
    const cr = document.getElementById('ss-confirm-row');
    if (_oakLineIdx < lines.length) {
      if (tx) tx.textContent = lines[_oakLineIdx];
    } else {
      if (tx) tx.textContent = `${STARTERS.find(s=>s.key===_selectedKey).name} has chosen you!`;
      if (cr) cr.style.display = 'flex';
    }
  }

  function _backToChoose() {
    _selectedKey = null;
    _step('ss-step-choose');
  }

  function _confirm() {
    if (!_selectedKey) return;
    StorySave.beginStory(_selectedKey, _playerName, _rivalName, _gender);
    Screen.show('screen-overworld');
  }

  // ── Public ─────────────────────────────────────

  function init() {
    _injectCSS();
    if (!document.getElementById('screen-starter')) {
      document.body.insertAdjacentHTML('beforeend', _buildHTML());
    }
  }

  function launch() {
    init();
    if (StorySave.hasStarted()) {
      Screen.show('screen-overworld');
      return;
    }
    _selectedKey = null;
    _oakLineIdx  = 0;
    _step('ss-step-names');
    Screen.show('screen-starter');
  }

  return { init, launch, _goChoose, _setGender, _pick, _nextOakLine, _backToChoose, _confirm };

})();
