// ============================================================================
// LOST SAGA 2.5D PIXEL ARENA - CLIENT CONTROLLER, HUD, AUDIO & LAN WEBSOCKET
// ============================================================================
(async function () {
  const GAME_DATA = window.GAME_DATA;
  const canvas = document.getElementById('gameCanvas');

  // Renderer: 2D canvas (default) or the Three.js prototype with ?renderer=3d
  const pageParams = new URLSearchParams(location.search);
  const use3D = pageParams.get('renderer') === '3d';
  let renderer = null;
  if (use3D) {
    try {
      const mod = await import('/js/three/renderer3d.js');
      renderer = new mod.ThreeRenderer(canvas);
    } catch (err) {
      console.error('Three.js renderer failed to start, falling back to 2D:', err);
    }
  }
  if (!renderer) renderer = new window.PixelRenderer25D(canvas);

  const btnToggleRenderer = document.getElementById('btnToggleRenderer');
  if (btnToggleRenderer) {
    btnToggleRenderer.textContent = use3D ? '🎨 กลับไป 2D' : '🧊 3D (ทดลอง)';
    btnToggleRenderer.addEventListener('click', () => {
      if (use3D) pageParams.delete('renderer');
      else pageParams.set('renderer', '3d');
      const qs = pageParams.toString();
      location.search = qs ? `?${qs}` : '';
    });
  }

  // --------------------------------------------------------------------------
  // RETRO ARCADE WEBAUDIO SOUND SYNTHESIZER (Zero external audio assets needed)
  // --------------------------------------------------------------------------
  class SoundFX {
    constructor() {
      this.ctx = null;
    }
    init() {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) this.ctx = new AudioCtx();
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
    }
    tone(freq, endFreq, duration, type = 'square', vol = 0.08) {
      if (!this.ctx) return;
      try {
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, now);
        osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + duration);
        gain.gain.setValueAtTime(vol, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + duration);
      } catch (e) {}
    }
    playFx(type) {
      this.init();
      switch (type) {
        case 'slash':
        case 'muzzle':
          this.tone(420, 140, 0.09, 'sawtooth', 0.06);
          break;
        case 'hit':
          this.tone(200, 65, 0.11, 'square', 0.08);
          break;
        case 'heavy_cast':
        case 'heavy_impact':
          this.tone(160, 480, 0.18, 'sawtooth', 0.09);
          break;
        case 'skill_cast':
          this.tone(320, 880, 0.25, 'triangle', 0.11);
          break;
        case 'gear_break':
          this.tone(680, 180, 0.32, 'sawtooth', 0.12);
          break;
        case 'pickup':
        case 'hero_swap':
          this.tone(360, 740, 0.18, 'sine', 0.10);
          break;
        case 'ko':
          this.tone(240, 55, 0.45, 'sawtooth', 0.14);
          break;
        case 'jump':
        case 'jumppad':
          this.tone(220, 540, 0.13, 'sine', 0.06);
          break;
        case 'air_jump':
          this.tone(360, 820, 0.16, 'triangle', 0.09);
          break;
        case 'dash':
          this.tone(480, 190, 0.12, 'sawtooth', 0.08);
          break;
      }
    }
  }

  const sfx = new SoundFX();

  // --------------------------------------------------------------------------
  // CLIENT STATE & INTERPOLATION BUFFER
  // --------------------------------------------------------------------------
  let ws = null;
  let localClientId = null;
  let selectedHeroId = 'knight';
  let currentGameState = null;
  const interpPlayers = new Map(); // id -> smoothed 3D coordinates

  // Input tracking (Facing is controlled strictly by movement keys W/A/S/D or Arrows, never by mouse!)
  const keys = {};
  let lastTapKey = null;
  let lastTapTime = 0;
  let isDashReady = false;
  let localFacing = null;

  // DOM Elements
  const lobbyModal = document.getElementById('lobbyModal');
  const lobbyHeroGrid = document.getElementById('lobbyHeroGrid');
  const lobbyHeroDetail = document.getElementById('lobbyHeroDetail');
  const lobbyRoomList = document.getElementById('lobbyRoomList');
  const lobbyLanUrls = document.getElementById('lobbyLanUrls');
  const hudLanUrl = document.getElementById('hudLanUrl');
  const hudRoomInfo = document.getElementById('hudRoomInfo');
  const heroSwapBar = document.getElementById('heroSwapBar');
  const scoreboardList = document.getElementById('scoreboardList');
  const killFeedList = document.getElementById('killFeedList');
  const selectMapInGame = document.getElementById('selectMapInGame');

  // --------------------------------------------------------------------------
  // BUILD 10 HEROES UI IN LOBBY & IN-GAME HOT-SWAP DOCK
  // --------------------------------------------------------------------------
  function initHeroUI() {
    lobbyHeroGrid.innerHTML = '';
    heroSwapBar.innerHTML = '';

    GAME_DATA.HERO_LIST.forEach((hero, idx) => {
      const hotkeyLabel = idx === 9 ? '0' : String(idx + 1);

      // 1. Lobby Tile (with Tree-of-Savior Chibi Portrait!)
      const tile = document.createElement('div');
      tile.className = `hero-tile ${hero.id === selectedHeroId ? 'selected' : ''}`;
      tile.dataset.heroId = hero.id;
      tile.innerHTML = `
        <div class="hero-tile-num">กด [${hotkeyLabel}]</div>
        <img class="hero-tile-portrait" src="/assets/tos/head/${hero.id}.png" alt="${hero.nameEn}" />
        <div class="hero-tile-name" style="color:${hero.accentColor}">${hero.nameTh}</div>
        <div class="hero-tile-role">${hero.roleTh.split('/')[0]}</div>
      `;
      tile.addEventListener('click', () => {
        selectedHeroId = hero.id;
        document.querySelectorAll('.hero-tile').forEach(el => {
          el.classList.toggle('selected', el.dataset.heroId === selectedHeroId);
        });
        renderHeroDetailCard(hero);
      });
      lobbyHeroGrid.appendChild(tile);

      // 2. Bottom HUD Hot-Swap Button (Keys 1..0)
      const swapBtn = document.createElement('button');
      swapBtn.className = `swap-hero-btn ${hero.id === selectedHeroId ? 'active' : ''}`;
      swapBtn.dataset.heroId = hero.id;
      swapBtn.innerHTML = `
        <span class="swap-key">${hotkeyLabel}</span>
        <img class="swap-hero-icon" src="/assets/tos/head/${hero.id}.png" alt="" />
        <span>${hero.nameTh}</span>
      `;
      swapBtn.addEventListener('click', () => {
        sendSwapHero(hero.id);
      });
      heroSwapBar.appendChild(swapBtn);
    });

    renderHeroDetailCard(GAME_DATA.HEROES[selectedHeroId]);
  }

  function renderHeroDetailCard(hero) {
    if (!hero) return;
    const s = hero.skills;
    lobbyHeroDetail.innerHTML = `
      <div class="detail-header">
        <div class="detail-title">${hero.index}. ${hero.nameTh} (${hero.nameEn})</div>
        <div class="role-tag">${hero.roleTh} • HP ${hero.maxHp}</div>
      </div>
      <div class="detail-desc">
        ${hero.descTh} <br/>
        <strong style="color:#38bdf8">⚡ ความสามารถเคลื่อนที่ (Mobility):</strong> ${hero.mobility?.nameTh || 'พุ่ง Dash + กระโดด 2 ชั้น'} <br/>
        <strong style="color:#fde047">💥 ท่าโจมตีหนัก (คลิกขวา / K):</strong> ${hero.heavyAttack.nameTh} (ทะลวงการ์ด!)
      </div>
      <div class="detail-skills-grid">
        <div class="detail-skill-item">
          <div class="detail-skill-top">⚔️ [Q / SD] อาวุธ: ${s.weapon.nameTh}</div>
          <div class="detail-skill-desc">${s.weapon.descTh}</div>
        </div>
        <div class="detail-skill-item">
          <div class="detail-skill-top">🛡️ [E / ASD] ชุดเกราะ: ${s.armor.nameTh}</div>
          <div class="detail-skill-desc">${s.armor.descTh}</div>
        </div>
        <div class="detail-skill-item">
          <div class="detail-skill-top">🪖 [R / AD] หมวก: ${s.helmet.nameTh}</div>
          <div class="detail-skill-desc">${s.helmet.descTh}</div>
        </div>
        <div class="detail-skill-item">
          <div class="detail-skill-top">🧣 [F / AS] ประดับ: ${s.trinket.nameTh}</div>
          <div class="detail-skill-desc">${s.trinket.descTh}</div>
        </div>
      </div>
    `;
  }

  initHeroUI();

  // --------------------------------------------------------------------------
  // WEBSOCKET CONNECTION & LAN ROOM MANAGEMENT
  // --------------------------------------------------------------------------
  function connectWebSocket() {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(`${proto}//${location.host}`);

    ws.addEventListener('open', () => {
      // Auto-join default room right away so the 2.5D background battle is live immediately!
      joinSelectedRoom(false);
    });

    ws.addEventListener('message', (ev) => {
      let msg;
      try {
        msg = JSON.parse(ev.data);
      } catch (e) {
        return;
      }

      if (msg.type === 'welcome') {
        localClientId = msg.clientId;
        updateLanAddressesUI(msg.lanAddresses || []);
        updateRoomListUI(msg.rooms || []);
      } else if (msg.type === 'joined') {
        localClientId = msg.clientId;
        hudRoomInfo.textContent = `ห้อง: ${msg.roomId} (${msg.mode === 'team' ? 'Team' : 'FFA'})`;
        selectMapInGame.value = msg.mapId;
      } else if (msg.type === 'state') {
        handleServerState(msg);
      }
    });

    ws.addEventListener('close', () => {
      setTimeout(connectWebSocket, 1500);
    });
  }

  function updateLanAddressesUI(addrs) {
    if (!addrs || addrs.length === 0) return;
    const urls = addrs.map(a => a.url);
    lobbyLanUrls.innerHTML = urls.map(u => `<div>🔗 ${u}</div>`).join('');
    hudLanUrl.textContent = `📡 LAN: ${urls[0]} (คลิกคัดลอก)`;
    hudLanUrl.onclick = () => {
      navigator.clipboard?.writeText(urls[0]);
      hudLanUrl.textContent = `✅ คัดลอก ${urls[0]} แล้ว!`;
      setTimeout(() => {
        hudLanUrl.textContent = `📡 LAN: ${urls[0]} (คลิกคัดลอก)`;
      }, 2000);
    };
  }

  function updateRoomListUI(roomList) {
    lobbyRoomList.innerHTML = '';
    roomList.forEach(r => {
      const div = document.createElement('div');
      div.className = 'room-item';
      div.innerHTML = `
        <span><strong>${r.id}</strong> - ${r.mapNameTh}</span>
        <span style="color:#4ade80">👤 ${r.humanCount} คน | 🤖 ${r.botCount} บอท</span>
      `;
      div.addEventListener('click', () => {
        document.getElementById('inputRoomId').value = r.id;
        document.getElementById('selectArenaMap').value = r.mapId;
        document.getElementById('selectGameMode').value = r.mode;
      });
      lobbyRoomList.appendChild(div);
    });
  }

  function joinSelectedRoom(closeModal = true) {
    if (!ws || ws.readyState !== 1) return;
    const playerName = document.getElementById('inputPlayerName').value.trim() || 'นักสู้ LAN';
    const roomId = document.getElementById('inputRoomId').value.trim() || 'LAN-1';
    const mapId = document.getElementById('selectArenaMap').value;
    const mode = document.getElementById('selectGameMode').value;

    ws.send(JSON.stringify({
      type: 'join_room',
      playerName,
      roomId,
      mapId,
      mode,
      heroId: selectedHeroId,
      changeMap: closeModal
    }));

    if (closeModal) {
      lobbyModal.classList.add('hidden');
      sfx.init();
    }
  }

  document.getElementById('btnJoinBattle').addEventListener('click', () => joinSelectedRoom(true));
  document.getElementById('btnOpenLobby').addEventListener('click', () => {
    fetch('/api/lan-info')
      .then(r => r.json())
      .then(info => {
        updateLanAddressesUI(info.addresses);
        updateRoomListUI(info.rooms);
      })
      .catch(() => {});
    lobbyModal.classList.remove('hidden');
  });

  // Top HUD buttons
  document.getElementById('btnAddBot').addEventListener('click', () => {
    if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: 'add_bot' }));
  });
  document.getElementById('btnClearBots').addEventListener('click', () => {
    if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: 'clear_bots' }));
  });
  selectMapInGame.addEventListener('change', (e) => {
    if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: 'change_map', mapId: e.target.value }));
  });

  // 4 Skill Dock Buttons Click Support
  GAME_DATA.GEAR_SLOTS.forEach(slot => {
    const btn = document.getElementById(`skillBtn_${slot}`);
    if (btn) {
      btn.addEventListener('click', () => sendSkillCast(slot));
    }
  });

  // --------------------------------------------------------------------------
  // HANDLE SERVER SNAPSHOTS & UPDATE HUD
  // --------------------------------------------------------------------------
  function handleServerState(state) {
    currentGameState = state;

    // Trigger client visual & sound FX
    if (state.fx && state.fx.length > 0) {
      renderer.processServerFx(state.fx);
      state.fx.forEach(f => sfx.playFx(f.type));
    }

    // Update interpolation targets for smooth 60 FPS movement
    const activeIds = new Set();
    for (const pl of state.players) {
      activeIds.add(pl.id);
      if (!interpPlayers.has(pl.id)) {
        interpPlayers.set(pl.id, { ...pl });
      } else {
        const cur = interpPlayers.get(pl.id);
        // Copy non-positional fields immediately
        Object.assign(cur, pl, {
          x: cur.x,
          y: cur.y,
          z: cur.z,
          targetX: pl.x,
          targetY: pl.y,
          targetZ: pl.z
        });
        // Snap if teleported or respawned far away
        if (Math.hypot(pl.x - cur.x, pl.z - cur.z) > 6.5) {
          cur.x = pl.x;
          cur.y = pl.y;
          cur.z = pl.z;
        }
      }
    }
    for (const oldId of interpPlayers.keys()) {
      if (!activeIds.has(oldId)) interpPlayers.delete(oldId);
    }

    updateHud(state);
  }

  function updateHud(state) {
    const me = state.players.find(p => p.id === localClientId);
    if (me) {
      const hero = GAME_DATA.HEROES[me.heroId] || GAME_DATA.HEROES.knight;
      const badge = document.getElementById('hudHeroBadge');
      if (badge.dataset.heroId !== hero.id) {
        badge.dataset.heroId = hero.id;
        badge.innerHTML = `<img class="hud-avatar-img" src="/assets/tos/head/${hero.id}.png" alt="${hero.nameEn}" />`;
      }
      badge.style.background = `radial-gradient(circle at 35% 30%, ${hero.accentColor}, ${hero.color})`;

      document.getElementById('hudHeroName').textContent = `${hero.nameTh} (${hero.nameEn})`;
      document.getElementById('hudHeroRole').textContent = hero.roleTh;

      const hpPct = Math.max(0, Math.min(100, (me.hp / me.maxHp) * 100));
      const hpBar = document.getElementById('hudHpBar');
      hpBar.style.width = `${hpPct}%`;
      hpBar.style.background = hpPct > 50
        ? 'linear-gradient(90deg, #16a34a, #4ade80)'
        : hpPct > 25
        ? 'linear-gradient(90deg, #ca8a04, #facc15)'
        : 'linear-gradient(90deg, #dc2626, #f87171)';
      document.getElementById('hudHpText').textContent = `${me.hp} / ${me.maxHp} HP`;

      // Update Mobility / Flight Gauge Bar on HUD (clean visual bar without status text clutter)
      const mobPct = Math.max(0, Math.min(100, ((me.mobilityGauge ?? 100) / (me.maxMobilityGauge || 100)) * 100));
      const mobBar = document.getElementById('hudMobilityBar');
      if (mobBar) mobBar.style.width = `${mobPct}%`;

      // Highlight active hero in bottom 10-hero hot-swap bar
      document.querySelectorAll('.swap-hero-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.heroId === me.heroId);
      });

      // Update the 4 Modular Gear Skill Cards (shows intact, stripped, or stolen gear skills!)
      GAME_DATA.GEAR_SLOTS.forEach(slot => {
        const card = document.getElementById(`skillBtn_${slot}`);
        const nameEl = document.getElementById(`skillName_${slot}`);
        const ownerEl = document.getElementById(`skillOwner_${slot}`);
        const cdEl = document.getElementById(`skillCd_${slot}`);

        const eqHeroId = me.gear ? me.gear[slot] : null;
        if (!eqHeroId) {
          // Gear piece was knocked off!
          card.classList.add('stripped');
          card.classList.remove('stolen');
          nameEl.textContent = '❌ เกราะหลุด! (ไม่มีอุปกรณ์)';
          ownerEl.textContent = 'เดินเก็บอุปกรณ์ที่ตกพื้น (ปุ่ม G)';
          cdEl.style.display = 'none';
        } else {
          card.classList.remove('stripped');
          const gearHero = GAME_DATA.HEROES[eqHeroId];
          const skill = gearHero?.skills[slot];
          const isStolen = eqHeroId !== me.heroId;
          card.classList.toggle('stolen', isStolen);

          nameEl.textContent = skill ? skill.nameTh : slot;
          ownerEl.textContent = isStolen
            ? `★ ขโมยจาก: ${gearHero.nameTh}`
            : (skill?.usableWhileHit ? '⚡ กดใช้ตอนโดนตีได้!' : gearHero.nameTh);

          const cdMs = me.cooldowns ? (me.cooldowns[slot] || 0) : 0;
          if (cdMs > 0) {
            cdEl.style.display = 'flex';
            cdEl.textContent = `${(cdMs / 1000).toFixed(1)}s`;
          } else {
            cdEl.style.display = 'none';
          }
        }
      });
    }

    // Update Scoreboard
    const sorted = [...state.players].sort((a, b) => b.score - a.score || b.kills - a.kills);
    scoreboardList.innerHTML = sorted.map((p, i) => {
      const h = GAME_DATA.HEROES[p.heroId];
      const isMe = p.id === localClientId;
      return `
        <div class="score-row ${isMe ? 'me' : ''}">
          <span>${i + 1}. ${p.name} <small style="color:${h?.accentColor || '#94a3b8'}">[${h?.nameTh || ''}]</small></span>
          <span>${p.kills}K / ${p.deaths}D (${p.score})</span>
        </div>
      `;
    }).join('');

    // Update Kill Feed
    if (state.killFeed) {
      killFeedList.innerHTML = state.killFeed.map(kf => `
        <div class="kill-item ${kf.isRingOut ? 'ringout' : ''}">
          <strong>${kf.killer}</strong> ➔ <strong>${kf.victim}</strong>
          <div style="color:#fde047; font-size:10.5px">${kf.method}</div>
        </div>
      `).join('');
    }
  }

  // --------------------------------------------------------------------------
  // PLAYER INPUT & LOST SAGA COMBO SHORTCUTS
  // --------------------------------------------------------------------------
  function sendSkillCast(slot) {
    if (!ws || ws.readyState !== 1) return;
    ws.send(JSON.stringify({ type: 'skill', slot }));
  }

  function sendSwapHero(heroId) {
    selectedHeroId = heroId;
    if (!ws || ws.readyState !== 1) return;
    ws.send(JSON.stringify({ type: 'swap_hero', heroId }));
  }

  // Helper to get current movement vector in world coordinates
  function getCurrentWorldMove() {
    let ix = 0;
    let iz = 0;
    if (keys['KeyA'] || keys['ArrowLeft']) ix -= 1;
    if (keys['KeyD'] || keys['ArrowRight']) ix += 1;
    if (keys['KeyW'] || keys['ArrowUp']) iz -= 1;
    if (keys['KeyS'] || keys['ArrowDown']) iz += 1;
    const worldMove = renderer.transformInputByCamera(ix, iz);
    return { ix, iz, mx: worldMove.mx, mz: worldMove.mz };
  }

  function triggerDash() {
    if (!ws || ws.readyState !== 1) return;
    const mv = getCurrentWorldMove();
    isDashReady = true;
    ws.send(JSON.stringify({
      type: 'dash',
      dx: mv.ix !== 0 || mv.iz !== 0 ? mv.mx : null,
      dz: mv.ix !== 0 || mv.iz !== 0 ? mv.mz : null
    }));
  }

  window.addEventListener('keydown', (e) => {
    if (!lobbyModal.classList.contains('hidden')) {
      if (e.key === 'Escape') lobbyModal.classList.add('hidden');
      return;
    }

    const code = e.code;
    const now = performance.now();

    // Detect double-tap movement key for Lost Saga Ground Dash / Air Dash + Sprint!
    const isMoveKey = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(code);
    const wasPressed = !!keys[code];
    keys[code] = true;

    if (!wasPressed && isMoveKey) {
      if (lastTapKey === code && now - lastTapTime < 280) {
        triggerDash();
      }
      lastTapKey = code;
      lastTapTime = now;
    }

    // Dedicated Dash / Air Dash hotkey (C or Left Alt)
    if (!wasPressed && (code === 'KeyC' || code === 'AltLeft')) {
      e.preventDefault();
      triggerDash();
      return;
    }

    // Jump / Double Jump / Triple Jump / Flight Mode (Space)
    if (code === 'Space' && !wasPressed) {
      e.preventDefault();
      if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: 'jump' }));
      return;
    }

    // Basic Attack (J)
    if (code === 'KeyJ') {
      if (ws && ws.readyState === 1) {
        ws.send(JSON.stringify({ type: 'attack', isDash: isDashReady }));
        isDashReady = false;
      }
      return;
    }

    // Heavy / Guard Break Attack (K)
    if (code === 'KeyK') {
      if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: 'heavy' }));
      return;
    }

    // 4 Gear Skills: Q (Weapon/SD), E (Armor/ASD), R (Helmet/AD), F (Trinket/AS)
    // Also supports U / I / O / P for two-handed keyboard play!
    if (code === 'KeyQ' || code === 'KeyU') {
      sendSkillCast('weapon');
      return;
    }
    if (code === 'KeyE' || code === 'KeyI') {
      sendSkillCast('armor');
      return;
    }
    if (code === 'KeyR' || code === 'KeyO') {
      sendSkillCast('helmet');
      return;
    }
    if (code === 'KeyF' || code === 'KeyP') {
      sendSkillCast('trinket');
      return;
    }

    // Pick Up / Swap Dropped Gear on Ground (G)
    if (code === 'KeyG') {
      if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: 'pickup_gear' }));
      return;
    }

    // 10-Hero Hot-Swap Mid-Battle (Digits 1..9 and 0 for 10th Hero!)
    if (code.startsWith('Digit')) {
      const num = parseInt(code.replace('Digit', ''), 10);
      const idx = num === 0 ? 9 : num - 1;
      const hero = GAME_DATA.HERO_LIST[idx];
      if (hero) {
        sendSwapHero(hero.id);
      }
    }
  });

  window.addEventListener('keyup', (e) => {
    keys[e.code] = false;
  });

  // Click Attacks (Character never rotates toward mouse cursor)
  canvas.addEventListener('mousedown', (e) => {
    if (!lobbyModal.classList.contains('hidden')) return;
    sfx.init();
    if (e.button === 0) {
      // Left Click -> Basic Combo Attack
      if (ws && ws.readyState === 1) {
        ws.send(JSON.stringify({ type: 'attack', isDash: isDashReady }));
        isDashReady = false;
      }
    } else if (e.button === 2) {
      // Right Click -> Heavy / Guard Break Attack
      if (ws && ws.readyState === 1) {
        ws.send(JSON.stringify({ type: 'heavy' }));
      }
    }
  });

  window.addEventListener('contextmenu', (e) => e.preventDefault());

  // Continuous 30 Hz Input Sender
  setInterval(() => {
    if (!ws || ws.readyState !== 1 || !lobbyModal.classList.contains('hidden')) return;

    const mv = getCurrentWorldMove();
    if (mv.ix === 0 && mv.iz === 0) {
      isDashReady = false;
    }

    const guard = !!(keys['ShiftLeft'] || keys['ShiftRight'] || keys['KeyL']);
    const jumpHeld = !!keys['Space'];
    const sprinting = !!(isDashReady || keys['KeyC'] || keys['AltLeft']);

    let facing = undefined;
    if (mv.ix !== 0 || mv.iz !== 0) {
      facing = Math.atan2(mv.mz, mv.mx);
      localFacing = facing;
      // Apply facing immediately on local player for zero-latency turning!
      const me = interpPlayers.get(localClientId);
      if (me) me.facing = facing;
    }

    ws.send(JSON.stringify({
      type: 'input',
      mx: mv.mx,
      mz: mv.mz,
      facing,
      guard,
      jumpHeld,
      sprinting
    }));
  }, 33);

  // --------------------------------------------------------------------------
  // 60 FPS RENDER & INTERPOLATION LOOP
  // --------------------------------------------------------------------------
  function animate() {
    if (currentGameState) {
      const smoothedPlayers = [];
      for (const pl of interpPlayers.values()) {
        if (typeof pl.targetX === 'number') {
          pl.x += (pl.targetX - pl.x) * 0.35;
          pl.y += (pl.targetY - pl.y) * 0.35;
          pl.z += (pl.targetZ - pl.z) * 0.35;
        }
        if (pl.id === localClientId && localFacing !== null) {
          pl.facing = localFacing;
        }
        smoothedPlayers.push(pl);
      }
      renderer.render({
        ...currentGameState,
        players: smoothedPlayers
      }, localClientId);
    } else {
      renderer.render(null, null);
    }
    requestAnimationFrame(animate);
  }

  connectWebSocket();
  requestAnimationFrame(animate);
})();
