// ============================================================================
// LOST SAGA 3D HQ - Client Controller, Bottom-Center HUD, Modular Windows,
// Mix & Match 3D Inventory, Hero/Gear Shop, Audio & LAN WebSocket.
// ============================================================================
window.startArenaGame = function (renderer) {
  const GAME_DATA = window.GAME_DATA;
  const RARITY_TIERS = GAME_DATA.RARITY_TIERS || {
    normal: { id: 'normal', code: 'N', labelTh: 'ปกติ', labelEn: 'Normal' },
    rare:   { id: 'rare',   code: 'R', labelTh: 'หายาก', labelEn: 'Rare' },
    unique: { id: 'unique', code: 'U', labelTh: 'พิเศษ', labelEn: 'Unique' },
    epic:   { id: 'epic',   code: 'E', labelTh: 'ตำนาน', labelEn: 'Epic' }
  };
  const ITEM_STATUS_BADGES = GAME_DATA.ITEM_STATUS_BADGES || {
    perm:    { id: 'perm',    labelTh: 'ถาวร' },
    rent:    { id: 'rent',    labelTh: 'เช่า 7วัน' },
    expired: { id: 'expired', labelTh: 'หมดอายุ' },
    event:   { id: 'event',   labelTh: 'ลิมิเต็ด' }
  };

  const canvas = document.getElementById('gameCanvas');

  function setStyle(el, prop, value) {
    if (el && el.style) el.style[prop] = value;
  }

  function setVar(el, name, value) {
    if (el && el.style && typeof el.style.setProperty === 'function') el.style.setProperty(name, String(value));
  }

  function escapeHtml(text) {
    return String(text ?? '').replace(/[&<>"']/g, ch => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
    ));
  }

  function queryAll(selector, root = document) {
    return typeof root?.querySelectorAll === 'function' ? Array.from(root.querySelectorAll(selector)) : [];
  }

  function isTypingInField(target) {
    const el = target || (typeof document !== 'undefined' ? document.activeElement : null);
    const tag = el && el.tagName ? String(el.tagName).toUpperCase() : '';
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
  }

  // --------------------------------------------------------------------------
  // RETRO ARCADE WEBAUDIO SOUND SYNTHESIZER (Zero external audio assets needed)
  // --------------------------------------------------------------------------
  class SoundFX {
    constructor() {
      this.ctx = null;
      this.out = null;
      this.level = 1;
    }
    init() {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          this.ctx = new AudioCtx();
          // Everything goes through one compressor so a room full of hits cannot clip.
          this.out = this.ctx.createDynamicsCompressor();
          this.out.threshold.value = -16;
          this.out.ratio.value = 6;
          this.out.connect(this.ctx.destination);
        }
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
        gain.gain.setValueAtTime(vol * this.level, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
        osc.connect(gain);
        gain.connect(this.out);
        osc.start(now);
        osc.stop(now + duration);
      } catch (e) {}
    }
    // A second of white noise, shared by every swoosh and crack.
    noiseBuffer() {
      if (!this.noise) {
        const length = this.ctx.sampleRate;
        this.noise = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
        const data = this.noise.getChannelData(0);
        for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
      }
      return this.noise;
    }
    // Filtered noise whose pass band sweeps from f0 to f1: the body of a blade swoosh.
    burst(duration, f0, f1, q, vol, type = 'bandpass') {
      if (!this.ctx) return;
      try {
        const now = this.ctx.currentTime;
        const source = this.ctx.createBufferSource();
        source.buffer = this.noiseBuffer();
        const filter = this.ctx.createBiquadFilter();
        filter.type = type;
        filter.Q.value = q;
        filter.frequency.setValueAtTime(f0, now);
        filter.frequency.exponentialRampToValueAtTime(Math.max(40, f1), now + duration);
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol * this.level), now + Math.min(0.025, duration * 0.3));
        gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
        source.connect(filter);
        filter.connect(gain);
        gain.connect(this.out);
        source.start(now, Math.random() * 0.5);
        source.stop(now + duration + 0.02);
      } catch (e) {}
    }
    // Each call is a few percent off pitch so repeated strikes do not machine-gun.
    jitter() {
      return 0.94 + Math.random() * 0.12;
    }
    swordSwing(finisher) {
      const k = this.jitter();
      if (finisher) {
        this.burst(0.24, 520 * k, 2100 * k, 0.8, 0.15);
        this.tone(150 * k, 70, 0.2, 'sine', 0.07);
      } else {
        this.burst(0.15, 760 * k, 3600 * k, 1.0, 0.11);
      }
    }
    // Weight, a crack of noise and two inharmonic metal partials.
    strike(strong) {
      const k = this.jitter();
      this.tone(strong ? 150 * k : 190 * k, 48, strong ? 0.2 : 0.12, 'sine', strong ? 0.2 : 0.15);
      this.burst(strong ? 0.1 : 0.06, 5200, 1400, 0.7, strong ? 0.17 : 0.12, 'highpass');
      this.tone(1850 * k, 1500 * k, strong ? 0.22 : 0.14, 'triangle', strong ? 0.06 : 0.045);
      this.tone(2710 * k, 2200 * k, strong ? 0.16 : 0.1, 'sine', 0.032);
    }
    // A hit taken on the shield: a dull clank with a short ring.
    clank(sharp) {
      const k = this.jitter();
      this.tone(sharp ? 1250 * k : 820 * k, sharp ? 1100 * k : 700 * k, sharp ? 0.4 : 0.26, 'triangle', 0.1);
      this.tone(sharp ? 1980 * k : 1330 * k, 1500 * k, 0.22, 'sine', 0.05);
      this.tone(130 * k, 55, 0.1, 'sine', 0.12);
      this.burst(0.05, 3800, 2000, 0.8, 0.1, 'bandpass');
    }
    playUi(kind) {
      this.init();
      this.level = 1;
      if (kind === 'click') this.tone(540, 760, 0.06, 'triangle', 0.05);
      else if (kind === 'equip') this.tone(420, 880, 0.14, 'sine', 0.08);
      else if (kind === 'buy') this.tone(520, 1040, 0.2, 'triangle', 0.09);
      else if (kind === 'warn') this.tone(240, 150, 0.12, 'sawtooth', 0.06);
    }
    // Quieter with distance from the local player, so a fight across the arena is a murmur.
    playFx(type, fx, level = 1) {
      this.init();
      this.level = level;
      switch (type) {
        case 'slash':
          if (fx?.weaponType === 'broadsword') {
            this.swordSwing(!!fx.isFinisher);
            break;
          }
          this.tone(420, 140, 0.09, 'sawtooth', 0.06);
          break;
        case 'muzzle':
          this.tone(420, 140, 0.09, 'sawtooth', 0.06);
          break;
        case 'hit':
          this.strike((fx?.damage || 0) >= 18);
          break;
        case 'block':
          this.clank(false);
          break;
        case 'parry':
          this.clank(true);
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
        case 'clash':
          this.tone(920, 420, 0.16, 'triangle', 0.12);
          this.tone(1280, 660, 0.12, 'sine', 0.08);
          break;
        case 'guard_break':
          this.tone(180, 55, 0.24, 'sawtooth', 0.13);
          this.tone(520, 140, 0.18, 'square', 0.09);
          break;
      }
    }
  }

  const sfx = new SoundFX();
  // The 3D renderer may hold a hit until the blade lands; it calls this at that moment.
  const hearing = fx => {
    const me = currentGameState?.players?.find(p => p.id === localClientId);
    if (!me || typeof fx?.x !== 'number') return 1;
    return Math.max(0.2, Math.min(1, 1 - (Math.hypot(fx.x - me.x, fx.z - me.z) - 5) / 22));
  };
  if (typeof renderer.releaseHits === 'function') renderer.onHit = fx => sfx.playFx('hit', fx, hearing(fx));

  // --------------------------------------------------------------------------
  // CLIENT STATE, CATALOG OWNERSHIP & INTERPOLATION BUFFER
  // --------------------------------------------------------------------------
  let ws = null;
  let localClientId = null;
  let selectedHeroId = 'knight';
  let currentGameState = null;
  let lastKnownKills = 0;
  const interpPlayers = new Map();
  const prevSkillReady = { weapon: true, armor: true, helmet: true, trinket: true };

  // Local catalog status (Permanent / Rental / Expired / Event) & LAN Peso balance
  const STORAGE_KEY = 'lostSagaArcadeCatalog_v1';
  let pesoBalance = 30000;
  const itemStatuses = {};

  function initCatalogState() {
    for (const hero of GAME_DATA.HERO_LIST) {
      itemStatuses[`hero:${hero.id}`] = hero.defaultStatus || 'perm';
      for (const slot of GAME_DATA.GEAR_SLOTS) {
        const sk = hero.skills[slot];
        itemStatuses[`gear:${slot}:${hero.id}`] = sk?.defaultStatus || hero.defaultStatus || 'perm';
      }
    }
    try {
      const saved = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.peso === 'number' && Number.isFinite(parsed.peso)) pesoBalance = parsed.peso;
        if (parsed.statuses && typeof parsed.statuses === 'object') {
          for (const [k, v] of Object.entries(parsed.statuses)) {
            if (Object.hasOwn(itemStatuses, k) && Object.hasOwn(ITEM_STATUS_BADGES, v)) {
              itemStatuses[k] = v;
            }
          }
        }
      }
    } catch (e) {}
  }

  function saveCatalogState() {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ peso: pesoBalance, statuses: itemStatuses }));
      }
    } catch (e) {}
  }

  initCatalogState();

  const keys = {};
  let lastTapKey = null;
  let lastTapTime = 0;
  let isDashReady = false;
  let doubleTapSprinting = false;
  const arrowDirections = {
    ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1]
  };
  let localFacing = null;

  // Inventory / Shop / Preview UI State
  let invCategory = 'hero';
  let invRarityFilter = 'all';
  let shopCategory = 'featured';
  let preview3d = null;
  const previewLoadout = {
    heroId: 'knight',
    gear: { weapon: 'knight', armor: 'knight', helmet: 'knight', trinket: 'knight' }
  };
  let inspectedItem = null;
  let lastLiveLoadoutKey = '';

  // DOM Elements
  const lobbyModal = document.getElementById('lobbyModal');
  const lobbyRoomList = document.getElementById('lobbyRoomList');
  const lobbyLanUrls = document.getElementById('lobbyLanUrls');
  const hudLanUrl = document.getElementById('hudLanUrl');
  const hudRoomInfo = document.getElementById('hudRoomInfo');
  const hudPesoBalance = document.getElementById('hudPesoBalance');
  const shopPesoBalance = document.getElementById('shopPesoBalance');
  const heroSwapBar = document.getElementById('heroSwapBar');
  const scoreboardList = document.getElementById('scoreboardList');
  const killFeedList = document.getElementById('killFeedList');
  const selectMapInGame = document.getElementById('selectMapInGame');
  const selectArenaMap = document.getElementById('selectArenaMap');
  const arenaMapDescription = document.getElementById('arenaMapDescription');
  const toastContainer = document.getElementById('toastContainer');
  const invItemGrid = document.getElementById('invItemGrid');
  const invItemInspector = document.getElementById('invItemInspector');
  const invEquippedStrip = document.getElementById('invEquippedStrip');
  const shopItemGrid = document.getElementById('shopItemGrid');
  const leftHud = document.getElementById('leftHud');
  const rightHud = document.getElementById('rightHud');
  const trainingTray = document.getElementById('trainingTray');
  const btnTrainingTools = document.getElementById('btnTrainingTools');
  const heroCarouselPrev = document.getElementById('heroCarouselPrev');
  const heroCarouselNext = document.getElementById('heroCarouselNext');
  const minimapCanvas = document.getElementById('minimapCanvas');
  const minimapLabel = document.getElementById('minimapLabel');

  // Populate arena map selects
  for (const select of [selectArenaMap, selectMapInGame]) {
    for (const map of Object.values(GAME_DATA.MAPS)) {
      const option = document.createElement('option');
      option.value = map.id;
      option.textContent = map.nameTh;
      select.appendChild(option);
    }
    select.value = GAME_DATA.MAPS.sky_temple.id;
  }

  function updateArenaMapDescription() {
    arenaMapDescription.textContent = GAME_DATA.MAPS[selectArenaMap.value]?.descTh || '';
  }
  selectArenaMap.addEventListener('change', updateArenaMapDescription);
  updateArenaMapDescription();

  // --------------------------------------------------------------------------
  // TOAST FEEDBACK & PESO WALLET DISPLAY
  // --------------------------------------------------------------------------
  function showToast(message, tone = 'info') {
    if (!toastContainer || typeof toastContainer.appendChild !== 'function') return;
    const toast = document.createElement('div');
    toast.className = `arcade-toast ${tone}`;
    toast.textContent = message;
    toastContainer.appendChild(toast);
    if (typeof setTimeout === 'function') {
      setTimeout(() => {
        if (typeof toast.remove === 'function') toast.remove();
      }, 2400);
    }
  }

  function updatePesoDisplay() {
    const formatted = `🪙 ${pesoBalance.toLocaleString('en-US')} P`;
    if (hudPesoBalance) hudPesoBalance.textContent = formatted;
    if (shopPesoBalance) shopPesoBalance.textContent = formatted;
  }
  updatePesoDisplay();

  // --------------------------------------------------------------------------
  // MODULAR DRAGGABLE WINDOWS SYSTEM (Windows-style Pop-ups over live HQ)
  // --------------------------------------------------------------------------
  const WINDOW_IDS = ['winInventory', 'winBattleList', 'winShop'];
  const openWindowOrder = [];
  let topWindowZ = 42;

  function syncLauncherButtons() {
    for (const winId of WINDOW_IDS) {
      const win = document.getElementById(winId);
      const isOpen = !!win && !win.classList.contains('hidden');
      queryAll(`[data-window="${winId}"]`).forEach(btn => {
        btn.classList.toggle('is-open', isOpen);
      });
    }
  }

  function bringWindowToFront(winId) {
    const win = document.getElementById(winId);
    if (!win) return;
    topWindowZ += 1;
    setStyle(win, 'zIndex', String(topWindowZ));
    const idx = openWindowOrder.indexOf(winId);
    if (idx !== -1) openWindowOrder.splice(idx, 1);
    if (!win.classList.contains('hidden')) openWindowOrder.push(winId);
  }

  function ensurePreview3D() {
    if (!preview3d && typeof window.createCharacterPreview3D === 'function') {
      const previewCanvas = document.getElementById('inventoryPreviewCanvas');
      if (previewCanvas) {
        try {
          preview3d = window.createCharacterPreview3D(previewCanvas);
        } catch (e) {
          console.warn('3D preview unavailable:', e);
        }
      }
    }
    return preview3d;
  }

  function syncPreview3D() {
    const hero = GAME_DATA.HEROES[previewLoadout.heroId] || GAME_DATA.HEROES.knight;
    const rarity = RARITY_TIERS[hero.rarity || 'normal'] || RARITY_TIERS.normal;
    const nameEl = document.getElementById('previewHeroName');
    const rarityEl = document.getElementById('previewHeroRarity');
    const statsEl = document.getElementById('previewStatsBar');
    if (nameEl) nameEl.textContent = `${hero.nameTh} (${hero.nameEn})`;
    if (rarityEl) {
      rarityEl.textContent = `${rarity.code} · ${rarity.labelEn}`;
      rarityEl.className = `rarity-badge rarity-${rarity.id}`;
    }
    if (statsEl) {
      const mobText = hero.mobility?.canFly ? '✈️ บินได้' : `🦘 ${hero.mobility?.maxJumps || 2}-Jump`;
      statsEl.innerHTML = `<span>❤️ HP ${hero.maxHp}</span><span>⚡ SPD ${hero.speed}</span><span>${mobText}</span>`;
    }

    const p3d = ensurePreview3D();
    if (p3d) p3d.setLoadout(previewLoadout.heroId, previewLoadout.gear);
    renderEquippedStrip();
  }

  function syncLoadoutFromLivePlayer() {
    const me = currentGameState?.players?.find(p => p.id === localClientId);
    if (!me) return;
    previewLoadout.heroId = me.heroId;
    for (const slot of GAME_DATA.GEAR_SLOTS) {
      previewLoadout.gear[slot] = me.gear?.[slot] ?? null;
    }
  }

  function openWindow(winId) {
    const win = document.getElementById(winId);
    if (!win) return;
    win.classList.remove('hidden');
    win.classList.remove('collapsed');
    bringWindowToFront(winId);
    syncLauncherButtons();
    sfx.playUi('click');

    if (winId === 'winInventory') {
      syncLoadoutFromLivePlayer();
      renderInventoryGrid();
      syncPreview3D();
      const p3d = ensurePreview3D();
      p3d?.setActive(true);
    } else if (winId === 'winBattleList') {
      if (currentGameState) {
        selectArenaMap.value = currentGameState.mapId;
        updateArenaMapDescription();
      }
      refreshLanInfo();
    } else if (winId === 'winShop') {
      renderShopGrid();
    }
  }

  function closeWindow(winId) {
    const win = document.getElementById(winId);
    if (!win) return;
    win.classList.add('hidden');
    const idx = openWindowOrder.indexOf(winId);
    if (idx !== -1) openWindowOrder.splice(idx, 1);
    syncLauncherButtons();
    if (winId === 'winInventory' && preview3d) {
      preview3d.setActive(false);
    }
  }

  function toggleWindow(winId) {
    const win = document.getElementById(winId);
    if (!win) return;
    if (win.classList.contains('hidden')) openWindow(winId);
    else if (win.classList.contains('collapsed')) {
      win.classList.remove('collapsed');
      bringWindowToFront(winId);
      if (winId === 'winInventory') preview3d?.setActive(true);
    } else {
      closeWindow(winId);
    }
  }

  function initDraggableWindows() {
    for (const winId of WINDOW_IDS) {
      const win = document.getElementById(winId);
      if (!win) continue;
      win.addEventListener('pointerdown', () => bringWindowToFront(winId));
    }

    queryAll('[data-drag-handle]').forEach(handle => {
      const winId = handle.dataset?.dragHandle;
      const win = document.getElementById(winId);
      if (!win) return;

      let dragging = false;
      let offsetX = 0;
      let offsetY = 0;

      handle.addEventListener('pointerdown', (e) => {
        if (typeof e.target?.closest === 'function' && e.target.closest('.win-ctrl-btn')) return;
        if (typeof win.getBoundingClientRect !== 'function') return;
        const rect = win.getBoundingClientRect();
        dragging = true;
        offsetX = e.clientX - rect.left;
        offsetY = e.clientY - rect.top;
        setStyle(win, 'left', `${rect.left}px`);
        setStyle(win, 'top', `${rect.top}px`);
        setStyle(win, 'right', 'auto');
        setStyle(win, 'bottom', 'auto');
        bringWindowToFront(winId);
        handle.setPointerCapture?.(e.pointerId);
      });

      handle.addEventListener('pointermove', (e) => {
        if (!dragging) return;
        const vw = window.innerWidth || 1280;
        const vh = window.innerHeight || 720;
        const rect = typeof win.getBoundingClientRect === 'function' ? win.getBoundingClientRect() : { width: 400 };
        const maxLeft = Math.max(8, vw - Math.min(rect.width, 220));
        const nextLeft = Math.max(8, Math.min(maxLeft, e.clientX - offsetX));
        const nextTop = Math.max(54, Math.min(vh - 56, e.clientY - offsetY));
        setStyle(win, 'left', `${nextLeft}px`);
        setStyle(win, 'top', `${nextTop}px`);
      });

      const stopDrag = () => { dragging = false; };
      handle.addEventListener('pointerup', stopDrag);
      handle.addEventListener('pointercancel', stopDrag);

      handle.addEventListener('dblclick', (e) => {
        if (typeof e.target?.closest === 'function' && e.target.closest('.win-ctrl-btn')) return;
        win.classList.toggle('collapsed');
        if (winId === 'winInventory' && preview3d) {
          preview3d.setActive(!win.classList.contains('collapsed'));
        }
      });
    });

    queryAll('[data-close]').forEach(btn => {
      btn.addEventListener('click', () => closeWindow(btn.dataset.close));
    });

    queryAll('[data-minimize]').forEach(btn => {
      btn.addEventListener('click', () => {
        const winId = btn.dataset.minimize;
        const win = document.getElementById(winId);
        if (!win) return;
        win.classList.toggle('collapsed');
        if (winId === 'winInventory' && preview3d) {
          preview3d.setActive(!win.classList.contains('collapsed'));
        }
      });
    });
  }

  initDraggableWindows();

  // Top HQ Launcher Buttons
  document.getElementById('btnOpenInventory')?.addEventListener('click', () => toggleWindow('winInventory'));
  document.getElementById('btnOpenShop')?.addEventListener('click', () => toggleWindow('winShop'));
  document.getElementById('btnOpenLobby')?.addEventListener('click', () => toggleWindow('winBattleList'));
  document.getElementById('btnRefreshRooms')?.addEventListener('click', () => {
    refreshLanInfo();
    showToast('อัปเดตรายชื่อห้อง LAN แล้ว', 'success');
  });

  document.getElementById('btnToggleSideHud')?.addEventListener('click', () => {
    leftHud?.classList.toggle('hidden');
    rightHud?.classList.toggle('hidden');
  });

  // TRAINING tab: opens the practice tools tray (bots, map, LAN link)
  btnTrainingTools?.addEventListener('click', () => {
    if (!trainingTray) return;
    trainingTray.hidden = !trainingTray.hidden;
    btnTrainingTools.classList.toggle('is-open', !trainingTray.hidden);
    btnTrainingTools.setAttribute?.('aria-expanded', String(!trainingTray.hidden));
    sfx.playUi('click');
  });

  document.getElementById('btnClaimBonus')?.addEventListener('click', () => {
    pesoBalance += 10000;
    saveCatalogState();
    updatePesoDisplay();
    sfx.playUi('buy');
    showToast('รับโบนัส LAN +10,000 P สำเร็จ!', 'success');
    renderShopGrid();
  });

  // Stop hero movement when clicking into text inputs/selects inside Battle List
  for (const fieldId of ['inputPlayerName', 'inputRoomId', 'selectGameMode', 'selectArenaMap']) {
    document.getElementById(fieldId)?.addEventListener('focus', () => releaseInputs());
  }

  // --------------------------------------------------------------------------
  // 10-HERO HOT-SWAP CAROUSEL (Bottom-Center, 5 portraits visible, Keys 1..0)
  // --------------------------------------------------------------------------
  const CAROUSEL_VISIBLE = 5;
  const carouselMaxStart = Math.max(0, GAME_DATA.HERO_LIST.length - CAROUSEL_VISIBLE);
  let carouselStart = 0;
  let carouselHeroId = null;

  function setCarouselStart(start) {
    carouselStart = Math.max(0, Math.min(carouselMaxStart, start));
    setVar(heroSwapBar, '--carousel-start', carouselStart);
    if (heroCarouselPrev) heroCarouselPrev.disabled = carouselStart <= 0;
    if (heroCarouselNext) heroCarouselNext.disabled = carouselStart >= carouselMaxStart;
  }

  // Page so the given hero's portrait is on screen (only when it is off screen)
  function revealHeroInCarousel(heroId) {
    const idx = GAME_DATA.HERO_LIST.findIndex(h => h.id === heroId);
    if (idx < 0) return;
    if (idx < carouselStart) setCarouselStart(idx);
    else if (idx >= carouselStart + CAROUSEL_VISIBLE) setCarouselStart(idx - CAROUSEL_VISIBLE + 1);
  }

  function initHeroSwapBar() {
    heroSwapBar.innerHTML = '';

    GAME_DATA.HERO_LIST.forEach((hero, idx) => {
      const hotkeyLabel = idx === 9 ? '0' : String(idx + 1);
      const rarity = hero.rarity || 'normal';

      const swapBtn = document.createElement('button');
      swapBtn.type = 'button';
      swapBtn.className = `swap-hero-btn ${hero.id === selectedHeroId ? 'active' : ''}`;
      swapBtn.dataset.heroId = hero.id;
      swapBtn.title = `[${hotkeyLabel}] ${hero.nameTh} (${hero.nameEn}) · ${RARITY_TIERS[rarity]?.labelEn || 'Normal'}`;
      setVar(swapBtn, '--hero-color', hero.color || '#2b6cff');
      setVar(swapBtn, '--hero-accent', hero.accentColor || '#8fd0ff');
      swapBtn.innerHTML = `
        <img class="swap-hero-icon" src="/assets/tos/head/${hero.id}.png" alt="${hero.nameTh}" />
        <span class="swap-key">${hotkeyLabel}</span>
        <span class="swap-rarity-dot ${rarity}"></span>
        <span class="swap-cd-overlay"></span>
      `;
      swapBtn.addEventListener('click', () => {
        sendSwapHero(hero.id);
      });
      heroSwapBar.appendChild(swapBtn);
    });

    heroCarouselPrev?.addEventListener('click', () => setCarouselStart(carouselStart - 1));
    heroCarouselNext?.addEventListener('click', () => setCarouselStart(carouselStart + 1));
    setCarouselStart(0);
    revealHeroInCarousel(selectedHeroId);
  }
  initHeroSwapBar();

  // --------------------------------------------------------------------------
  // TOP-RIGHT MINIMAP (turned with the camera: up on the minimap = up on screen)
  // --------------------------------------------------------------------------
  const minimap = {
    ctx: typeof minimapCanvas?.getContext === 'function' ? minimapCanvas.getContext('2d') : null,
    mapId: null,
    cssSize: 0,
    dpr: 1,
    base: null,
    axes: null,
    toScreen: null
  };

  function minimapAxes() {
    // World XZ directions of screen-right and screen-down, taken from the renderer's camera mapping
    const right = renderer.transformInputByCamera?.(1, 0) || { mx: 1, mz: 0 };
    const down = renderer.transformInputByCamera?.(0, 1) || { mx: 0, mz: 1 };
    const rl = Math.hypot(right.mx, right.mz) || 1;
    const dl = Math.hypot(down.mx, down.mz) || 1;
    return { rx: right.mx / rl, rz: right.mz / rl, dx: down.mx / dl, dz: down.mz / dl };
  }

  function buildMinimapBase(map) {
    const cssSize = minimapCanvas.clientWidth || 168;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    minimapCanvas.width = Math.round(cssSize * dpr);
    minimapCanvas.height = Math.round(cssSize * dpr);

    const axes = minimapAxes();
    const project = (x, z) => ({ u: x * axes.rx + z * axes.rz, v: x * axes.dx + z * axes.dz });
    const rects = [...(map.platforms || [])];
    if (map.lava) rects.push(map.lava);
    let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
    for (const r of rects) {
      for (const [cx, cz] of [[r.x, r.z], [r.x + r.w, r.z], [r.x + r.w, r.z + r.d], [r.x, r.z + r.d]]) {
        const p = project(cx, cz);
        minU = Math.min(minU, p.u); maxU = Math.max(maxU, p.u);
        minV = Math.min(minV, p.v); maxV = Math.max(maxV, p.v);
      }
    }
    if (!Number.isFinite(minU)) { minU = -20; maxU = 20; minV = -20; maxV = 20; }
    const pad = 10;
    const scale = (cssSize - pad * 2) / Math.max(maxU - minU, maxV - minV, 1);
    const offU = (cssSize - (maxU - minU) * scale) / 2;
    const offV = (cssSize - (maxV - minV) * scale) / 2;
    const toScreen = (x, z) => {
      const p = project(x, z);
      return { sx: offU + (p.u - minU) * scale, sy: offV + (p.v - minV) * scale };
    };

    const base = document.createElement('canvas');
    base.width = minimapCanvas.width;
    base.height = minimapCanvas.height;
    const g = base.getContext('2d');
    g.scale(dpr, dpr);

    // Backdrop: deep blue with a faint scan grid
    const bg = g.createRadialGradient(cssSize / 2, cssSize / 2, 8, cssSize / 2, cssSize / 2, cssSize * 0.72);
    bg.addColorStop(0, 'rgba(18, 52, 120, 0.85)');
    bg.addColorStop(1, 'rgba(4, 14, 40, 0.92)');
    g.fillStyle = bg;
    g.fillRect(0, 0, cssSize, cssSize);
    g.strokeStyle = 'rgba(120, 190, 255, 0.08)';
    g.lineWidth = 1;
    for (let i = 12; i < cssSize; i += 12) {
      g.beginPath(); g.moveTo(i + 0.5, 0); g.lineTo(i + 0.5, cssSize); g.stroke();
      g.beginPath(); g.moveTo(0, i + 0.5); g.lineTo(cssSize, i + 0.5); g.stroke();
    }

    const quad = (r) => {
      const pts = [[r.x, r.z], [r.x + r.w, r.z], [r.x + r.w, r.z + r.d], [r.x, r.z + r.d]].map(([cx, cz]) => toScreen(cx, cz));
      g.beginPath();
      pts.forEach((p, i) => (i ? g.lineTo(p.sx, p.sy) : g.moveTo(p.sx, p.sy)));
      g.closePath();
    };

    if (map.lava) {
      quad(map.lava);
      g.fillStyle = 'rgba(255, 110, 40, 0.38)';
      g.fill();
      g.strokeStyle = 'rgba(255, 160, 90, 0.7)';
      g.stroke();
    }
    // Lower platforms first so raised ones draw on top, brighter
    for (const pl of [...(map.platforms || [])].sort((a, b) => (a.y || 0) - (b.y || 0))) {
      quad(pl);
      const raised = (pl.y || 0) > 0.3;
      g.fillStyle = raised ? 'rgba(120, 205, 255, 0.4)' : 'rgba(60, 140, 255, 0.3)';
      g.fill();
      g.strokeStyle = raised ? 'rgba(190, 240, 255, 0.9)' : 'rgba(130, 210, 255, 0.75)';
      g.lineWidth = 1.2;
      g.stroke();
    }
    for (const pillar of map.pillars || []) {
      const p = toScreen(pillar.x, pillar.z);
      g.beginPath();
      g.arc(p.sx, p.sy, Math.max(1.5, pillar.r * scale), 0, Math.PI * 2);
      g.fillStyle = 'rgba(6, 20, 52, 0.9)';
      g.fill();
      g.strokeStyle = 'rgba(130, 210, 255, 0.6)';
      g.lineWidth = 1;
      g.stroke();
    }
    for (const jumpPad of map.jumpPads || []) {
      const p = toScreen(jumpPad.x, jumpPad.z);
      g.beginPath();
      g.arc(p.sx, p.sy, Math.max(2, jumpPad.r * scale), 0, Math.PI * 2);
      g.fillStyle = 'rgba(110, 255, 220, 0.55)';
      g.fill();
    }

    Object.assign(minimap, { mapId: map.id, cssSize, dpr, base, axes, toScreen });
    if (minimapLabel) minimapLabel.textContent = (map.nameTh || map.nameEn || '').split(' (')[0];
  }

  function drawMinimap(state, me) {
    if (!minimap.ctx || !state) return;
    const map = GAME_DATA.MAPS[state.mapId];
    if (!map) return;
    if (minimap.mapId !== map.id || minimap.cssSize !== (minimapCanvas.clientWidth || 168)) {
      buildMinimapBase(map);
    }
    const ctx = minimap.ctx;
    const size = minimap.cssSize;
    const clampPt = (p) => ({ sx: Math.max(4, Math.min(size - 4, p.sx)), sy: Math.max(4, Math.min(size - 4, p.sy)) });

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, minimapCanvas.width, minimapCanvas.height);
    ctx.drawImage(minimap.base, 0, 0);
    ctx.setTransform(minimap.dpr, 0, 0, minimap.dpr, 0, 0);

    // Dropped gear: small gold diamonds
    ctx.fillStyle = '#ffd54a';
    for (const gear of state.droppedGears || []) {
      const p = clampPt(minimap.toScreen(gear.x, gear.z));
      ctx.beginPath();
      ctx.moveTo(p.sx, p.sy - 3.2); ctx.lineTo(p.sx + 3.2, p.sy);
      ctx.lineTo(p.sx, p.sy + 3.2); ctx.lineTo(p.sx - 3.2, p.sy);
      ctx.closePath();
      ctx.fill();
    }

    // Other fighters: red = enemy, blue = teammate (stealthed enemies stay hidden)
    for (const p of state.players) {
      if (me && p.id === me.id) continue;
      if (p.state === 'dead' || p.hp <= 0) continue;
      const ally = state.mode === 'team' && me && p.team && p.team === me.team;
      if (!ally && p.buffs?.stealth) continue;
      const pt = clampPt(minimap.toScreen(p.x, p.z));
      ctx.beginPath();
      ctx.arc(pt.sx, pt.sy, 3.4, 0, Math.PI * 2);
      ctx.fillStyle = ally ? '#4cc3ff' : '#ff4d5e';
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.stroke();
    }

    // You: green square with a gold core and a facing cone
    if (me && me.state !== 'dead') {
      const pt = clampPt(minimap.toScreen(me.x, me.z));
      const ax = minimap.axes;
      const fx = Math.cos(me.facing || 0), fz = Math.sin(me.facing || 0);
      const ang = Math.atan2(fx * ax.dx + fz * ax.dz, fx * ax.rx + fz * ax.rz);
      const cone = ctx.createRadialGradient(pt.sx, pt.sy, 2, pt.sx, pt.sy, 22);
      cone.addColorStop(0, 'rgba(120, 255, 170, 0.5)');
      cone.addColorStop(1, 'rgba(120, 255, 170, 0)');
      ctx.beginPath();
      ctx.moveTo(pt.sx, pt.sy);
      ctx.arc(pt.sx, pt.sy, 22, ang - 0.5, ang + 0.5);
      ctx.closePath();
      ctx.fillStyle = cone;
      ctx.fill();

      ctx.shadowColor = 'rgba(60, 255, 140, 0.9)';
      ctx.shadowBlur = 8;
      ctx.fillStyle = '#19c45c';
      ctx.fillRect(pt.sx - 5, pt.sy - 5, 10, 10);
      ctx.shadowBlur = 0;
      ctx.lineWidth = 1.4;
      ctx.strokeStyle = '#d8ffe6';
      ctx.strokeRect(pt.sx - 5, pt.sy - 5, 10, 10);
      ctx.beginPath();
      ctx.arc(pt.sx, pt.sy, 2.4, 0, Math.PI * 2);
      ctx.fillStyle = '#ffe14a';
      ctx.fill();
    }
  }

  // --------------------------------------------------------------------------
  // MY ITEM: MIX & MATCH GRID + INSPECTOR + EQUIPPED SUMMARY
  // --------------------------------------------------------------------------
  function getItemKey(cat, heroId) {
    return cat === 'hero' ? `hero:${heroId}` : `gear:${cat}:${heroId}`;
  }

  function renderEquippedStrip() {
    if (!invEquippedStrip) return;
    invEquippedStrip.innerHTML = '';
    for (const slot of GAME_DATA.GEAR_SLOTS) {
      const slotMeta = GAME_DATA.GEAR_SLOT_LABELS[slot];
      const gearHeroId = previewLoadout.gear[slot];
      const gearHero = gearHeroId ? GAME_DATA.HEROES[gearHeroId] : null;
      const skill = gearHero?.skills?.[slot];
      const rarity = RARITY_TIERS[skill?.rarity || gearHero?.rarity || 'normal'] || RARITY_TIERS.normal;

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'eq-mini-slot';
      btn.innerHTML = `
        <img src="/assets/tos/${slot}/${gearHeroId || previewLoadout.heroId}.png" alt="${slotMeta.th}" style="${gearHeroId ? '' : 'opacity:0.35;filter:grayscale(1)'}" />
        <div class="eq-mini-text">
          <div class="eq-mini-label">[${slotMeta.key}] ${slotMeta.th}</div>
          <div class="eq-mini-name">${skill ? skill.nameTh : 'ว่าง (หลุด)'}</div>
        </div>
        <span class="rarity-badge rarity-${rarity.id}">${rarity.code}</span>
      `;
      btn.addEventListener('click', () => {
        setInventoryCategory(slot);
      });
      invEquippedStrip.appendChild(btn);
    }
  }

  function renderInspector(item) {
    inspectedItem = item;
    if (!invItemInspector) return;
    if (!item) {
      invItemInspector.innerHTML = '<div class="inspector-empty">คลิกฮีโร่หรืออุปกรณ์ด้านบนเพื่อแต่งตัวและดูผลบนโมเดล 3D ทันที</div>';
      return;
    }

    const rarity = RARITY_TIERS[item.rarity || 'normal'] || RARITY_TIERS.normal;
    const statusKey = itemStatuses[item.key] || 'perm';
    const status = ITEM_STATUS_BADGES[statusKey] || ITEM_STATUS_BADGES.perm;
    const renewCost = 500;

    let actionHtml = '';
    if (statusKey === 'expired') {
      actionHtml = `<button type="button" class="arcade-btn btn-emerald btn-sm" id="btnInspectorRenew">🔄 ต่ออายุ &amp; ใส่เลย (${renewCost} P)</button>`;
    } else if (statusKey === 'rent') {
      actionHtml = `<button type="button" class="arcade-btn btn-amber btn-sm" id="btnInspectorUpgrade">⭐ ซื้อถาวร (${item.price.toLocaleString('en-US')} P)</button>`;
    }

    invItemInspector.innerHTML = `
      <div class="inspector-top">
        <div class="inspector-title">
          <span class="rarity-badge rarity-${rarity.id}">${rarity.code} ${rarity.labelEn}</span>
          <span class="status-badge status-${statusKey}">${status.labelTh}</span>
          <span>${item.title}</span>
        </div>
        ${actionHtml}
      </div>
      <div class="inspector-desc">${item.desc}</div>
    `;

    document.getElementById('btnInspectorRenew')?.addEventListener('click', () => {
      renewOrBuyItem(item, true);
    });
    document.getElementById('btnInspectorUpgrade')?.addEventListener('click', () => {
      renewOrBuyItem(item, false);
    });
  }

  function renewOrBuyItem(item, isRenew) {
    const cost = isRenew ? 500 : item.price;
    if (pesoBalance < cost) {
      sfx.playUi('warn');
      showToast(`เหรียญไม่พอ (ต้องการ ${cost.toLocaleString('en-US')} P) — กด +10k P ในร้านค้าได้ฟรี!`, 'warn');
      return;
    }
    pesoBalance -= cost;
    itemStatuses[item.key] = isRenew ? 'rent' : 'perm';
    saveCatalogState();
    updatePesoDisplay();
    sfx.playUi('buy');
    showToast(isRenew ? `ต่ออายุ ${item.title} เรียบร้อย! สวมใส่ทันที` : `ปลดล็อก ${item.title} แบบถาวรแล้ว!`, 'success');

    if (item.cat === 'hero') {
      previewLoadout.heroId = item.heroId;
      sendSwapHero(item.heroId);
    } else {
      previewLoadout.gear[item.cat] = item.heroId;
      sendEquipGear(item.cat, item.heroId);
    }
    syncPreview3D();
    renderInventoryGrid();
    renderShopGrid();
    renderInspector(item);
  }

  function setInventoryCategory(cat) {
    invCategory = cat;
    queryAll('#invCategoryTabs .glossy-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.cat === cat);
    });
    renderInventoryGrid();
  }

  function renderInventoryGrid() {
    if (!invItemGrid) return;
    invItemGrid.innerHTML = '';

    for (const hero of GAME_DATA.HERO_LIST) {
      const isHero = invCategory === 'hero';
      const skill = isHero ? null : hero.skills[invCategory];
      const rarityId = isHero ? (hero.rarity || 'normal') : (skill?.rarity || hero.rarity || 'normal');
      if (invRarityFilter !== 'all' && rarityId !== invRarityFilter) continue;

      const key = getItemKey(invCategory, hero.id);
      const statusId = itemStatuses[key] || 'perm';
      const rarity = RARITY_TIERS[rarityId] || RARITY_TIERS.normal;
      const status = ITEM_STATUS_BADGES[statusId] || ITEM_STATUS_BADGES.perm;
      const equipped = isHero
        ? previewLoadout.heroId === hero.id
        : previewLoadout.gear[invCategory] === hero.id;

      const folder = isHero ? 'head' : invCategory;
      const title = isHero ? hero.nameTh : (skill?.nameTh || hero.nameTh);
      const sub = isHero ? hero.roleEn : hero.nameTh;
      const desc = isHero
        ? `${hero.descTh} · ท่าหนัก [K]: ${hero.heavyAttack.nameTh}`
        : `[${GAME_DATA.GEAR_SLOT_LABELS[invCategory].key}] ${skill.nameTh} (${skill.nameEn}) — ${skill.descTh}`;
      const price = isHero ? (hero.shopPrice || 5000) : (skill?.shopPrice || 2500);

      const itemObj = { key, cat: invCategory, heroId: hero.id, title, sub, desc, rarity: rarityId, price };

      const card = document.createElement('button');
      card.type = 'button';
      card.className = `inv-card ${equipped ? 'equipped' : ''} ${statusId === 'expired' ? 'expired' : ''}`;
      card.innerHTML = `
        <span class="rarity-badge rarity-${rarity.id}">${rarity.code}</span>
        <span class="status-badge status-${statusId}">${status.labelTh}</span>
        <img class="inv-card-img" src="/assets/tos/${folder}/${hero.id}.png" alt="${title}" />
        <div class="inv-card-name">${title}</div>
        <div class="inv-card-sub">${sub}</div>
        ${equipped ? '<span class="inv-equipped-tag">ใส่อยู่</span>' : ''}
      `;

      card.addEventListener('click', () => {
        if (isHero) {
          previewLoadout.heroId = hero.id;
          previewLoadout.gear.weapon = hero.id;
          sendSwapHero(hero.id);
          sfx.playUi('equip');
          showToast(`เปลี่ยนฮีโร่เป็น ${hero.nameTh}!`, 'success');
        } else if (invCategory === 'weapon') {
          previewLoadout.heroId = hero.id;
          previewLoadout.gear.weapon = hero.id;
          sendSwapHero(hero.id);
          sfx.playUi('equip');
          showToast(`อาวุธเป็นสกิลประจำตัวฮีโร่ — สลับเป็น ${hero.nameTh} เพื่อใช้อาวุธนี้!`, 'info');
        } else {
          // Immediately dress 3D preview on click!
          previewLoadout.gear[invCategory] = hero.id;
          if (statusId === 'expired') {
            sfx.playUi('warn');
            showToast(`${title} หมดอายุ — ดูตัวอย่าง 3D ได้และกดต่ออายุทันทีด้านล่าง`, 'warn');
          } else {
            sendEquipGear(invCategory, hero.id);
            sfx.playUi('equip');
            showToast(`สวมใส่ [${GAME_DATA.GEAR_SLOT_LABELS[invCategory].th}] ${title}!`, 'success');
          }
        }
        syncPreview3D();
        renderInventoryGrid();
        renderInspector(itemObj);
      });

      invItemGrid.appendChild(card);
    }
  }

  // Bind Inventory Category Tabs, Rarity Filters, Pose Buttons & Quick Actions
  queryAll('#invCategoryTabs .glossy-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      sfx.playUi('click');
      setInventoryCategory(tab.dataset.cat);
    });
  });

  queryAll('#invRarityFilters .filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      invRarityFilter = chip.dataset.rarity;
      queryAll('#invRarityFilters .filter-chip').forEach(c => c.classList.toggle('active', c === chip));
      renderInventoryGrid();
    });
  });

  queryAll('.pose-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      queryAll('.pose-btn').forEach(b => b.classList.toggle('active', b === btn));
      preview3d?.playPose(btn.dataset.pose);
    });
  });

  document.getElementById('btnRandomMix')?.addEventListener('click', () => {
    const heroes = GAME_DATA.HERO_LIST;
    const pick = () => heroes[Math.floor(Math.random() * heroes.length)].id;
    const nextHero = pick();
    previewLoadout.heroId = nextHero;
    previewLoadout.gear.weapon = nextHero;
    sendSwapHero(nextHero);
    for (const slot of ['armor', 'helmet', 'trinket']) {
      const candidates = heroes.filter(h => itemStatuses[`gear:${slot}:${h.id}`] !== 'expired');
      const chosen = (candidates[Math.floor(Math.random() * candidates.length)] || heroes[0]).id;
      previewLoadout.gear[slot] = chosen;
      sendEquipGear(slot, chosen);
    }
    syncPreview3D();
    preview3d?.playPose('skill');
    renderInventoryGrid();
    sfx.playUi('equip');
    showToast('🎲 สุ่มชุด Mix & Match สวมใส่ลงสนามแล้ว!', 'success');
  });

  document.getElementById('btnResetSet')?.addEventListener('click', () => {
    const hId = previewLoadout.heroId;
    previewLoadout.gear.weapon = hId;
    for (const slot of ['armor', 'helmet', 'trinket']) {
      previewLoadout.gear[slot] = hId;
      sendEquipGear(slot, hId);
    }
    syncPreview3D();
    renderInventoryGrid();
    sfx.playUi('equip');
    showToast(`รีเซ็ตกลับเป็นชุดประจำตัว ${GAME_DATA.HEROES[hId]?.nameTh || hId}`, 'info');
  });

  // --------------------------------------------------------------------------
  // SHOP WINDOW: FEATURED / HEROES / 40 GEAR CATALOG
  // --------------------------------------------------------------------------
  function buildShopEntries() {
    const entries = [];
    if (shopCategory === 'featured') {
      // Curated showcase spanning all 4 rarities (Green/Yellow/Red/Purple) & statuses
      const picks = [
        { cat: 'hero', heroId: 'cyborg' },
        { cat: 'hero', heroId: 'reaper' },
        { cat: 'hero', heroId: 'samurai' },
        { cat: 'hero', heroId: 'witch' },
        { cat: 'helmet', heroId: 'viking' },
        { cat: 'trinket', heroId: 'witch' },
        { cat: 'weapon', heroId: 'ninja' },
        { cat: 'armor', heroId: 'knight' }
      ];
      for (const p of picks) entries.push(p);
    } else {
      for (const hero of GAME_DATA.HERO_LIST) {
        entries.push({ cat: shopCategory, heroId: hero.id });
      }
    }
    return entries;
  }

  function renderShopGrid() {
    if (!shopItemGrid) return;
    shopItemGrid.innerHTML = '';

    for (const entry of buildShopEntries()) {
      const hero = GAME_DATA.HEROES[entry.heroId];
      if (!hero) continue;
      const isHero = entry.cat === 'hero';
      const skill = isHero ? null : hero.skills[entry.cat];
      const rarityId = isHero ? (hero.rarity || 'normal') : (skill?.rarity || hero.rarity || 'normal');
      const rarity = RARITY_TIERS[rarityId] || RARITY_TIERS.normal;
      const key = getItemKey(entry.cat, hero.id);
      const statusId = itemStatuses[key] || 'perm';
      const status = ITEM_STATUS_BADGES[statusId] || ITEM_STATUS_BADGES.perm;
      const folder = isHero ? 'head' : entry.cat;
      const title = isHero ? `${hero.nameTh} (${hero.nameEn})` : skill.nameTh;
      const sub = isHero ? hero.roleTh : `${GAME_DATA.GEAR_SLOT_LABELS[entry.cat].th} · ${hero.nameTh}`;
      const desc = isHero ? hero.descTh : skill.descTh;
      const price = isHero ? (hero.shopPrice || 5000) : (skill?.shopPrice || 2500);

      const itemObj = { key, cat: entry.cat, heroId: hero.id, title, sub, desc, rarity: rarityId, price };

      let buyLabel = '⚡ สวมใส่เลย';
      let buyBtnClass = 'btn-sky';
      if (statusId === 'expired') {
        buyLabel = '🔄 ต่ออายุ 500 P';
        buyBtnClass = 'btn-emerald';
      } else if (statusId === 'rent') {
        buyLabel = `🛒 ถาวร ${price.toLocaleString('en-US')} P`;
        buyBtnClass = 'btn-amber';
      } else if (statusId === 'event') {
        buyLabel = `✨ ปลด ${price.toLocaleString('en-US')} P`;
        buyBtnClass = 'btn-purple';
      }

      const card = document.createElement('div');
      card.className = 'shop-card';
      card.dataset.rarity = rarity.id;
      card.innerHTML = `
        <div class="shop-card-head">
          <div class="shop-thumb">
            <span class="rarity-badge rarity-${rarity.id}">${rarity.code}</span>
            <img src="/assets/tos/${folder}/${hero.id}.png" alt="${title}" />
          </div>
          <div class="shop-card-info">
            <div class="shop-card-title">${title}</div>
            <div class="shop-card-sub">${sub}</div>
            <div class="shop-card-badges">
              <span class="status-badge status-${statusId}">${status.labelTh}</span>
              <span class="shop-price-pill">🪙 ${price.toLocaleString('en-US')} P</span>
            </div>
          </div>
        </div>
        <div class="shop-card-desc">${desc}</div>
        <div class="shop-card-actions">
          <button type="button" class="arcade-btn btn-soft btn-sm shop-try-btn">👁️ ลอง 3D</button>
          <button type="button" class="arcade-btn ${buyBtnClass} btn-sm shop-buy-btn">${buyLabel}</button>
        </div>
      `;

      const tryBtn = card.querySelector?.('.shop-try-btn');
      const buyBtn = card.querySelector?.('.shop-buy-btn');

      tryBtn?.addEventListener('click', () => {
        openWindow('winInventory');
        setInventoryCategory(entry.cat);
        if (isHero) {
          previewLoadout.heroId = hero.id;
          previewLoadout.gear.weapon = hero.id;
        } else {
          previewLoadout.gear[entry.cat] = hero.id;
        }
        syncPreview3D();
        preview3d?.playPose(isHero ? 'attack' : 'skill');
        renderInventoryGrid();
        renderInspector(itemObj);
        showToast(`กำลังลองสวมใส่ ${title} บนโมเดล 3D!`, 'info');
      });

      buyBtn?.addEventListener('click', () => {
        if (statusId === 'perm') {
          if (isHero) {
            previewLoadout.heroId = hero.id;
            sendSwapHero(hero.id);
          } else {
            previewLoadout.gear[entry.cat] = hero.id;
            sendEquipGear(entry.cat, hero.id);
          }
          sfx.playUi('equip');
          showToast(`สวมใส่ ${title} ลงสนามทันที!`, 'success');
          syncPreview3D();
          renderInventoryGrid();
        } else {
          renewOrBuyItem(itemObj, statusId === 'expired');
        }
      });

      shopItemGrid.appendChild(card);
    }
  }

  queryAll('#shopCategoryTabs .glossy-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      shopCategory = tab.dataset.shopCat;
      queryAll('#shopCategoryTabs .glossy-tab').forEach(t => t.classList.toggle('active', t === tab));
      sfx.playUi('click');
      renderShopGrid();
    });
  });

  // --------------------------------------------------------------------------
  // WEBSOCKET CONNECTION & LAN ROOM MANAGEMENT
  // --------------------------------------------------------------------------
  function refreshLanInfo() {
    if (typeof fetch !== 'function') return;
    fetch('/api/lan-info')
      .then(r => r.json())
      .then(info => {
        updateLanAddressesUI(info.addresses);
        updateRoomListUI(info.rooms);
      })
      .catch(() => {});
  }

  function connectWebSocket() {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(`${proto}//${location.host}`);

    ws.addEventListener('open', () => {
      // Spawn straight into live HQ / Arena so center is open for movement & combos!
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
        hudRoomInfo.textContent = `ห้อง ${msg.roomId} · ${msg.mode === 'team' ? 'Team' : 'FFA'}`;
        selectMapInGame.value = msg.mapId;
      } else if (msg.type === 'state') {
        handleServerState(msg);
      }
    });

    ws.addEventListener('close', () => {
      releaseInputs();
      if (typeof setTimeout === 'function') setTimeout(connectWebSocket, 1500);
    });
  }

  function updateLanAddressesUI(addrs) {
    if (!addrs || addrs.length === 0) return;
    const urls = addrs.map(a => a.url);
    lobbyLanUrls.innerHTML = urls.map(u => `<div>🔗 ${u}</div>`).join('');
    hudLanUrl.textContent = `📡 LAN: ${urls[0]}`;
    hudLanUrl.onclick = () => {
      navigator.clipboard?.writeText(urls[0]);
      showToast(`คัดลอกลิงก์ LAN: ${urls[0]} แล้ว!`, 'success');
      hudLanUrl.textContent = `✅ คัดลอกแล้ว!`;
      if (typeof setTimeout === 'function') {
        setTimeout(() => {
          hudLanUrl.textContent = `📡 LAN: ${urls[0]}`;
        }, 1800);
      }
    };
  }

  function updateRoomListUI(roomList) {
    lobbyRoomList.innerHTML = '';
    const activeRoomId = (document.getElementById('inputRoomId')?.value || '').trim().toUpperCase();
    roomList.forEach(r => {
      const div = document.createElement('div');
      div.className = `room-item ${r.id === activeRoomId ? 'active' : ''}`;
      const modeBadge = r.mode === 'team'
        ? '<span class="room-mode-pill room-mode-team">TEAM</span>'
        : '<span class="room-mode-pill room-mode-ffa">FFA</span>';
      div.innerHTML = `
        <span>${modeBadge}<strong>${r.id}</strong> · ${r.mapNameTh}</span>
        <span style="color:#15803d;font-weight:900">👤 ${r.humanCount} | 🤖 ${r.botCount}</span>
      `;
      div.addEventListener('click', () => {
        document.getElementById('inputRoomId').value = r.id;
        selectArenaMap.value = r.mapId;
        updateArenaMapDescription();
        document.getElementById('selectGameMode').value = r.mode;
        queryAll('#lobbyRoomList .room-item').forEach(el => el.classList.toggle('active', el === div));
      });
      lobbyRoomList.appendChild(div);
    });
  }

  function joinSelectedRoom(closeWin = true) {
    if (!ws || ws.readyState !== 1) return;
    const playerName = document.getElementById('inputPlayerName').value.trim() || 'นักสู้ LAN';
    const roomId = document.getElementById('inputRoomId').value.trim() || 'LAN-1';
    const mapId = selectArenaMap.value;
    const mode = document.getElementById('selectGameMode').value;

    ws.send(JSON.stringify({
      type: 'join_room',
      playerName,
      roomId,
      mapId,
      mode,
      heroId: selectedHeroId,
      changeMap: closeWin
    }));

    if (closeWin) {
      closeWindow('winBattleList');
      lobbyModal?.classList.add('hidden');
      sfx.init();
      showToast(`เข้าร่วมห้อง ${roomId.toUpperCase()} เรียบร้อย!`, 'success');
    }
  }

  const btnJoinBattle = document.getElementById('btnJoinBattle');
  btnJoinBattle.disabled = false;
  btnJoinBattle.addEventListener('click', () => joinSelectedRoom(true));

  // Top HUD arena controls
  document.getElementById('btnAddBot').addEventListener('click', () => {
    if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: 'add_bot' }));
  });
  document.getElementById('btnClearBots').addEventListener('click', () => {
    if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: 'clear_bots' }));
  });
  selectMapInGame.addEventListener('change', (e) => {
    if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: 'change_map', mapId: e.target.value }));
  });

  // 4 Skill Dock Buttons Click & Right-Click Drop Support
  GAME_DATA.GEAR_SLOTS.forEach(slot => {
    const btn = document.getElementById(`skillBtn_${slot}`);
    if (btn) {
      btn.addEventListener('click', () => sendSkillCast(slot));
      if (slot !== 'weapon') {
        btn.addEventListener('contextmenu', e => {
          e.preventDefault();
          if (ws?.readyState === 1) ws.send(JSON.stringify({ type: 'drop_gear', slot }));
        });
      }
    }
  });

  // --------------------------------------------------------------------------
  // HANDLE SERVER SNAPSHOTS & UPDATE BOTTOM-CENTER HUD
  // --------------------------------------------------------------------------
  function handleServerState(state) {
    if (state.mapId !== currentGameState?.mapId) {
      selectMapInGame.value = state.mapId;
      interpPlayers.clear();
      renderer.setStage?.(state.mapId);
    }
    currentGameState = state;

    if (state.fx && state.fx.length > 0) {
      renderer.processServerFx?.(state.fx);
      // The 3D renderer shows a Knight's hit on the blade's contact frame, so it
      // plays the hit sound itself (renderer.onHit) at that moment.
      state.fx.forEach(f => {
        if (!(f.type === 'hit' && renderer.onHit)) sfx.playFx(f.type, f, hearing(f));
      });
    }

    const activeIds = new Set();
    for (const pl of state.players) {
      activeIds.add(pl.id);
      if (!interpPlayers.has(pl.id)) {
        interpPlayers.set(pl.id, { ...pl });
      } else {
        const cur = interpPlayers.get(pl.id);
        Object.assign(cur, pl, {
          x: cur.x,
          y: cur.y,
          z: cur.z,
          targetX: pl.x,
          targetY: pl.y,
          targetZ: pl.z
        });
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
      // Reward LAN Peso on KOs!
      if (me.kills > lastKnownKills) {
        const gained = (me.kills - lastKnownKills) * 500;
        lastKnownKills = me.kills;
        pesoBalance += gained;
        saveCatalogState();
        updatePesoDisplay();
        showToast(`🏆 K.O. โบนัส +${gained.toLocaleString('en-US')} P!`, 'success');
      } else if (me.kills < lastKnownKills) {
        lastKnownKills = me.kills;
      }

      const hero = GAME_DATA.HEROES[me.heroId] || GAME_DATA.HEROES.knight;

      // Keep the active hero's portrait on screen when it changes (arrows still browse freely)
      if (carouselHeroId !== hero.id) {
        carouselHeroId = hero.id;
        revealHeroInCarousel(hero.id);
      }

      document.getElementById('hudHeroName').textContent = `${hero.nameTh} (${hero.nameEn})`;
      document.getElementById('hudHeroRole').textContent = hero.roleEn || hero.roleTh;

      // Hero-swap cooldown readiness pill & hot-swap strip sweep
      const swapCd = me.swapCooldownMs || 0;
      const swapStatus = document.getElementById('hudSwapStatus');
      if (swapStatus) {
        if (swapCd > 50) {
          swapStatus.textContent = `⏳ สลับฮีโร่ ${(swapCd / 1000).toFixed(1)}s`;
          swapStatus.classList.add('cooling');
        } else {
          swapStatus.textContent = '⚡ สลับฮีโร่พร้อม [1-0]';
          swapStatus.classList.remove('cooling');
        }
      }
      heroSwapBar.classList.toggle('swapping', swapCd > 50);

      // Glossy HP Bar
      const hpPct = Math.max(0, Math.min(100, (me.hp / me.maxHp) * 100));
      const hpBar = document.getElementById('hudHpBar');
      setStyle(hpBar, 'width', `${hpPct}%`);
      setStyle(hpBar, 'background', hpPct > 50
        ? 'linear-gradient(180deg, #86ffb0 0%, #19c45c 100%)'
        : hpPct > 25
        ? 'linear-gradient(180deg, #ffe98a 0%, #f59e0b 100%)'
        : 'linear-gradient(180deg, #ff9aa6 0%, #e11d48 100%)');
      document.getElementById('hudHpText').textContent = `${me.hp} / ${me.maxHp} HP`;

      // Glossy Mobility / Stamina Bar
      const mobPct = Math.max(0, Math.min(100, ((me.mobilityGauge ?? 100) / (me.maxMobilityGauge || 100)) * 100));
      const mobBar = document.getElementById('hudMobilityBar');
      setStyle(mobBar, 'width', `${mobPct}%`);
      const mobText = document.getElementById('hudMobilityText');
      if (mobText) mobText.textContent = `${hero.mobility?.canFly ? '✈️' : '⚡'} ${Math.round(mobPct)}%`;

      // Highlight active hero in bottom 10-hero hot-swap bar
      queryAll('.swap-hero-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.heroId === me.heroId);
      });

      // Sync My Item 3D preview live if player's gear/hero changed while window is open
      const liveKey = `${me.heroId}|${me.gear?.weapon}|${me.gear?.armor}|${me.gear?.helmet}|${me.gear?.trinket}`;
      if (liveKey !== lastLiveLoadoutKey) {
        lastLiveLoadoutKey = liveKey;
        const invWin = document.getElementById('winInventory');
        if (invWin && !invWin.classList.contains('hidden')) {
          syncLoadoutFromLivePlayer();
          syncPreview3D();
          renderInventoryGrid();
        }
      }

      // 4 Bottom-Center Real-Time Gear Skill Icons (Q Weapon, E Armor, R Helmet, F Trinket)
      GAME_DATA.GEAR_SLOTS.forEach(slot => {
        const card = document.getElementById(`skillBtn_${slot}`);
        const keyEl = document.getElementById(`skillKey_${slot}`);
        const nameEl = document.getElementById(`skillName_${slot}`);
        const ownerEl = document.getElementById(`skillOwner_${slot}`);
        const condEl = document.getElementById(`skillCond_${slot}`);
        const imgEl = document.getElementById(`skillImg_${slot}`);
        const curtainEl = document.getElementById(`skillCurtain_${slot}`);
        const centerEl = document.getElementById(`skillCenter_${slot}`);
        const badgeEl = document.getElementById(`skillBadge_${slot}`);
        const mixEl = document.getElementById(`skillMix_${slot}`);

        const slotLabel = GAME_DATA.GEAR_SLOT_LABELS[slot];
        const aiming = me.targeting?.mode === 'skill' && me.targeting.slot === slot;
        const gearHeroId = me.gear?.[slot];
        const gearHero = GAME_DATA.HEROES[gearHeroId];
        const skill = gearHero?.skills[slot];
        const passive = skill?.type === 'passive';
        const stolen = !!skill && gearHero.id !== me.heroId;
        const charge = me.skillGauges?.[slot];
        const cdMs = me.cooldowns?.[slot] || 0;
        const ready = !!skill && !passive && charge >= (skill?.gaugeCost ?? 100) && cdMs <= 0;

        // Trigger bright golden ready flash the instant cooldown fills!
        if (ready && !prevSkillReady[slot]) {
          card.classList.remove('just-ready');
          void card.offsetWidth;
          card.classList.add('just-ready');
        }
        prevSkillReady[slot] = ready;

        const conds = skill?.conditions || [];
        const isIncap = me.state === 'hurt' || me.state === 'knockdown' || me.state === 'frozen';
        let condBlocked = false;
        let counterHighlight = false;
        if (skill && !passive) {
          if (isIncap) {
            condBlocked = !(skill.usableWhileHit || conds.includes('down'));
            counterHighlight = !condBlocked && ready;
          } else if (!me.grounded) {
            condBlocked = !conds.includes('air');
          } else {
            condBlocked = !conds.includes('ground');
          }
        }

        card.classList.toggle('targeting', aiming);
        card.classList.toggle('stripped', !skill);
        card.classList.toggle('stolen', stolen);
        card.classList.toggle('passive', passive);
        card.classList.toggle('ready', ready || passive);
        card.classList.toggle('cond-blocked', condBlocked);
        card.classList.toggle('cond-counter-ready', counterHighlight);

        // Icon artwork & color-coded rarity/mix badges
        if (imgEl) {
          if (gearHeroId) {
            const wantSrc = `/assets/tos/${slot}/${gearHeroId}.png`;
            if (imgEl.dataset.src !== wantSrc) {
              imgEl.dataset.src = wantSrc;
              imgEl.src = wantSrc;
            }
            setStyle(imgEl, 'opacity', '1');
          } else {
            setStyle(imgEl, 'opacity', '0.2');
          }
        }

        if (badgeEl) {
          if (skill) {
            const skRarity = RARITY_TIERS[skill.rarity || gearHero?.rarity || 'normal'] || RARITY_TIERS.normal;
            badgeEl.textContent = skRarity.code;
            badgeEl.className = `rarity-badge rarity-${skRarity.id} skill-rarity-badge`;
            badgeEl.hidden = false;
          } else {
            badgeEl.hidden = true;
          }
        }
        if (mixEl) mixEl.hidden = !stolen;

        // Orb charge ring + clockwise cooldown sweep & center readout
        const chargePct = !skill ? 0 : (passive || ready) ? 100 : Math.max(0, Math.min(100, charge ?? 0));
        setVar(card, '--charge', chargePct);
        setVar(curtainEl, '--remain', 100 - chargePct);
        if (centerEl) {
          if (!skill) centerEl.textContent = 'หลุด!';
          else if (passive || ready) centerEl.textContent = '';
          else if (charge >= (skill?.gaugeCost ?? 100) && cdMs > 0) centerEl.textContent = `${(cdMs / 1000).toFixed(1)}s`;
          else centerEl.textContent = `${charge ?? 0}%`;
        }

        if (condEl) {
          if (!skill) {
            condEl.innerHTML = '';
          } else {
            const condNames = { ground: 'พื้น', air: 'อากาศ', down: 'ล้มสวน', passive: 'ติดตัว' };
            condEl.innerHTML = conds.map(c =>
              `<span class="cond-pill ${c === 'down' ? 'cond-down' : c === 'passive' ? 'cond-passive' : ''}">${condNames[c] || c}</span>`
            ).join('');
          }
        }

        keyEl.textContent = passive ? 'ติดตัว' : slotLabel.key;
        nameEl.textContent = skill?.nameTh ?? 'ช่องว่าง';
        const descText = skill
          ? `${skill.descTh}${slot === 'weapon' ? ' · อาวุธประจำช่อง' : ' · คลิกขวาเพื่อถอด'}`
          : 'เกียร์หลุด! กด G เพื่อเก็บเกียร์ใกล้ตัว หรือเปิดคลังเก็บของ (B)';
        const descEl = document.getElementById(`skillDesc_${slot}`);
        if (descEl && descEl.textContent !== descText) descEl.textContent = descText;
        card.setAttribute?.('aria-label', skill
          ? `[${slotLabel.key} / ${slotLabel.altKey}] ${skill.nameTh}: ${descText}`
          : descText);

        if (!skill) {
          ownerEl.textContent = 'กด G เก็บเกียร์';
        } else if (aiming) {
          ownerEl.textContent = me.targeting.targetId ? 'ลูกศรเปลี่ยนเป้า · กดซ้ำยิง' : 'กำลังหาเป้าหมาย';
        } else if (skill.confirmTarget) {
          ownerEl.textContent = 'กดเพื่อล็อคเป้า';
        } else if (passive) {
          ownerEl.textContent = 'ติดตัวขณะสวมใส่';
        } else if (skill.gaugeCost < 100) {
          ownerEl.textContent = `ใช้เกจ ${skill.gaugeCost}%`;
        } else if (skill.usableWhileHit) {
          ownerEl.textContent = 'สวนกลับตอนโดนตี';
        } else {
          ownerEl.textContent = `${slotLabel.th} · ${gearHero.nameTh}`;
        }
      });
    }

    drawMinimap(state, me);

    // Scoreboard (names come from other players: escape before innerHTML)
    const sorted = [...state.players].sort((a, b) => b.score - a.score || b.kills - a.kills);
    scoreboardList.innerHTML = sorted.map((p, i) => {
      const h = GAME_DATA.HEROES[p.heroId];
      const isMe = p.id === localClientId;
      return `
        <div class="score-row ${isMe ? 'me' : ''}">
          <span>${i + 1}. ${escapeHtml(p.name)} <span class="score-hero-tag">[${h?.nameTh || ''}]</span></span>
          <span>${p.kills}K / ${p.deaths}D</span>
        </div>
      `;
    }).join('');

    // Kill feed
    if (state.killFeed) {
      killFeedList.innerHTML = state.killFeed.map(kf => `
        <div class="kill-item ${kf.isRingOut ? 'ringout' : ''}">
          <strong>${escapeHtml(kf.killer)}</strong> ➔ <strong>${escapeHtml(kf.victim)}</strong>
          <div class="kill-method">${escapeHtml(kf.method)}</div>
        </div>
      `).join('');
    }
  }

  // --------------------------------------------------------------------------
  // PLAYER INPUT & LOST SAGA J/K/L COMBO + GEAR SKILL CHORDS
  // WASD movement · J attack/hold-charge/aim · K jump/glide · L guard/roll
  // Chords: JL weapon · JKL armor · JK helmet · KL trinket (+ Q/E/R/F shortcuts)
  // --------------------------------------------------------------------------
  const CHORD_WINDOW_MS = 65;
  const CHORD_CODES = new Set(['KeyJ', 'KeyK', 'KeyL']);
  const chordKeys = new Set();
  let chordTimer = null;
  let attackPressSent = false;

  function clearChordWindow() {
    if (chordTimer !== null) {
      if (typeof clearTimeout === 'function') clearTimeout(chordTimer);
      chordTimer = null;
    }
    chordKeys.clear();
  }

  function resolveChord() {
    if (chordTimer !== null) {
      if (typeof clearTimeout === 'function') clearTimeout(chordTimer);
      chordTimer = null;
    }
    if (chordKeys.size === 0) return;

    const hasJ = chordKeys.has('KeyJ');
    const hasK = chordKeys.has('KeyK');
    const hasL = chordKeys.has('KeyL');
    chordKeys.clear();

    if (hasJ && hasK && hasL) {
      sendSkillCast('armor');
      return;
    }
    if (hasJ && hasL) {
      sendSkillCast('weapon');
      return;
    }
    if (hasJ && hasK) {
      sendSkillCast('helmet');
      return;
    }
    if (hasK && hasL) {
      sendSkillCast('trinket');
      return;
    }
    if (hasK) {
      if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: 'jump' }));
      return;
    }
    if (hasJ) {
      if (keys['KeyJ']) {
        attackPressSent = true;
        sendBasicAttack('press');
      } else {
        attackPressSent = false;
        sendBasicAttack('press');
        sendBasicAttack('release');
      }
    }
  }

  function sendSkillCast(slot) {
    if (!ws || ws.readyState !== 1) return;
    ws.send(JSON.stringify({ type: 'skill', slot }));
  }

  function sendSwapHero(heroId) {
    selectedHeroId = heroId;
    if (!ws || ws.readyState !== 1) return;
    ws.send(JSON.stringify({ type: 'swap_hero', heroId }));
  }

  function sendEquipGear(slot, heroId) {
    if (!ws || ws.readyState !== 1) return;
    ws.send(JSON.stringify({ type: 'equip_gear', slot, heroId }));
  }

  function activeTargeting() {
    const targeting = interpPlayers.get(localClientId)?.targeting;
    return targeting?.mode === 'ranged' && !keys['KeyJ'] ? null : targeting;
  }

  function getCurrentWorldMove() {
    let ix = 0;
    let iz = 0;
    const aiming = activeTargeting();
    const arrowMoves = code => !aiming && keys[code];
    if (keys['KeyA'] || arrowMoves('ArrowLeft')) ix -= 1;
    if (keys['KeyD'] || arrowMoves('ArrowRight')) ix += 1;
    if (keys['KeyW'] || arrowMoves('ArrowUp')) iz -= 1;
    if (keys['KeyS'] || arrowMoves('ArrowDown')) iz += 1;
    const worldMove = renderer.transformInputByCamera(ix, iz);
    return { ix, iz, mx: worldMove.mx, mz: worldMove.mz };
  }

  function isSprintHeld() {
    return !!(keys['ShiftLeft'] || keys['ShiftRight'] || (doubleTapSprinting && !keys['KeyL']));
  }

  function sendBasicAttack(phase) {
    if (!ws || ws.readyState !== 1) return;
    const mv = getCurrentWorldMove();
    const isDash = isDashReady || (isSprintHeld() && (mv.ix !== 0 || mv.iz !== 0));
    ws.send(JSON.stringify({ type: 'attack', phase, isDash }));
    if (phase !== 'press') isDashReady = false;
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
    if (isTypingInField(e.target)) {
      if (e.key === 'Escape' && typeof e.target?.blur === 'function') e.target.blur();
      return;
    }

    if (lobbyModal && !lobbyModal.classList.contains('hidden')) {
      if (e.key === 'Escape') lobbyModal.classList.add('hidden');
      return;
    }

    const code = e.code;
    if (e.repeat && !keys[code]) return;
    const wasPressed = !!keys[code];
    keys[code] = true;

    // Modular HQ Window Hotkeys (B = My Item, H = Shop, M = Battle List)
    if (!wasPressed && code === 'KeyB') {
      toggleWindow('winInventory');
      return;
    }
    if (!wasPressed && code === 'KeyH') {
      toggleWindow('winShop');
      return;
    }
    if (!wasPressed && code === 'KeyM') {
      toggleWindow('winBattleList');
      return;
    }

    const isArrow = Object.hasOwn(arrowDirections, code);
    if (isArrow) {
      e.preventDefault();
      if (!wasPressed && ws?.readyState === 1) {
        const { mx, mz } = renderer.transformInputByCamera(...arrowDirections[code]);
        ws.send(JSON.stringify({ type: 'switch_target', dx: mx, dz: mz }));
      }
    }

    const isMoveKey = isArrow ? !activeTargeting() : ['KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(code);
    if (isArrow && !isMoveKey) lastTapKey = null;
    if (!wasPressed && isMoveKey) {
      const meState = interpPlayers.get(localClientId)?.state;
      if (meState === 'knockdown') {
        const mv = getCurrentWorldMove();
        if (ws?.readyState === 1) ws.send(JSON.stringify({ type: 'wakeup', dx: mv.mx, dz: mv.mz }));
      } else if (keys['KeyL']) {
        clearChordWindow();
        const mv = getCurrentWorldMove();
        if (ws?.readyState === 1) ws.send(JSON.stringify({ type: 'dodge', dx: mv.mx, dz: mv.mz }));
        lastTapKey = null;
      } else {
        const now = performance.now();
        if (lastTapKey === code && now - lastTapTime < 280) {
          doubleTapSprinting = true;
          triggerDash();
        }
        lastTapKey = code;
        lastTapTime = now;
      }
    }

    if (!wasPressed && (code === 'KeyC' || code === 'AltLeft')) {
      e.preventDefault();
      if (keys['KeyL']) {
        clearChordWindow();
        const mv = getCurrentWorldMove();
        if (ws?.readyState === 1) ws.send(JSON.stringify({ type: 'dodge', dx: mv.mx, dz: mv.mz }));
      } else {
        triggerDash();
      }
      return;
    }
    if (code === 'Escape') {
      clearChordWindow();
      if (activeTargeting()) {
        if (ws?.readyState === 1) ws.send(JSON.stringify({ type: 'cancel_targeting' }));
      } else if (openWindowOrder.length > 0) {
        closeWindow(openWindowOrder[openWindowOrder.length - 1]);
      } else if (ws?.readyState === 1) {
        ws.send(JSON.stringify({ type: 'cancel_targeting' }));
      }
      return;
    }

    // Secondary Jump / Glide / Quick Wake-Up alias (Space)
    if (code === 'Space' && !wasPressed) {
      e.preventDefault();
      if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: 'jump' }));
      return;
    }

    // Lost Saga Primary Controls: J = Attack/Hold-Charge/Aim, K = Jump/Glide, L = Guard/Roll
    // Simultaneous Chords: JL = Weapon, JKL = Armor, JK = Helmet, KL = Trinket
    if (CHORD_CODES.has(code)) {
      if (!wasPressed) {
        // Holding L (Guard) then pressing J or K immediately includes L in the chord (JL / KL / JKL)
        if (chordKeys.size === 0 && code !== 'KeyL' && keys['KeyL']) {
          chordKeys.add('KeyL');
        }
        chordKeys.add(code);
        if (chordKeys.size === 3) {
          resolveChord();
        } else if (chordTimer === null) {
          if (typeof setTimeout === 'function') {
            chordTimer = setTimeout(resolveChord, CHORD_WINDOW_MS);
          } else {
            resolveChord();
          }
        }
      }
      return;
    }

    // 1-Key Gear Skill Shortcuts: Q (weapon), E (armor), R (helmet), F (trinket) + U / I / O / P aliases
    if (code === 'KeyQ' || code === 'KeyU') {
      if (!wasPressed) sendSkillCast('weapon');
      return;
    }
    if (code === 'KeyE' || code === 'KeyI') {
      if (!wasPressed) sendSkillCast('armor');
      return;
    }
    if (code === 'KeyR' || code === 'KeyO') {
      if (!wasPressed) sendSkillCast('helmet');
      return;
    }
    if (code === 'KeyF' || code === 'KeyP') {
      if (!wasPressed) sendSkillCast('trinket');
      return;
    }

    // Pick Up / Swap Dropped Gear on Ground (G)
    if (code === 'KeyG') {
      if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: 'pickup_gear' }));
      return;
    }

    // 10-Hero Hot-Swap Mid-Battle (Digits 1..9 and 0 for 10th Hero)
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
    const wasPressed = !!keys[e.code];
    keys[e.code] = false;
    const activePlay = (!lobbyModal || lobbyModal.classList.contains('hidden')) && !isTypingInField(e.target);
    if (CHORD_CODES.has(e.code) && chordKeys.size > 0 && activePlay) {
      const anyHeld = Array.from(chordKeys).some(c => keys[c]);
      if (!anyHeld) {
        resolveChord();
      }
      return;
    }
    if (e.code === 'KeyJ' && wasPressed && attackPressSent && activePlay) {
      attackPressSent = false;
      sendBasicAttack('release');
    }
  });

  function releaseInputs() {
    clearChordWindow();
    attackPressSent = false;
    for (const code of Object.keys(keys)) delete keys[code];
    lastTapKey = null;
    lastTapTime = 0;
    isDashReady = false;
    doubleTapSprinting = false;
    localFacing = null;

    if (ws && ws.readyState === 1) {
      ws.send(JSON.stringify({ type: 'cancel_targeting' }));
      ws.send(JSON.stringify({
        type: 'input',
        mx: 0,
        mz: 0,
        guard: false,
        jumpHeld: false,
        sprinting: false
      }));
    }
  }

  window.addEventListener('blur', releaseInputs);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) releaseInputs();
  });

  // Direct Canvas Click Attacks (Clicking inside modular windows never fires this)
  canvas.addEventListener('mousedown', (e) => {
    if (lobbyModal && !lobbyModal.classList.contains('hidden')) return;
    sfx.init();
    if (e.button === 0) {
      sendBasicAttack();
    } else if (e.button === 2) {
      if (ws && ws.readyState === 1) {
        ws.send(JSON.stringify({ type: 'heavy' }));
      }
    }
  });

  window.addEventListener('contextmenu', (e) => e.preventDefault());

  // Continuous 30 Hz Input Sender
  setInterval(() => {
    if (!ws || ws.readyState !== 1) return;
    if (lobbyModal && !lobbyModal.classList.contains('hidden')) return;
    if (isTypingInField(null)) return;

    const mv = getCurrentWorldMove();
    if (mv.ix === 0 && mv.iz === 0) {
      isDashReady = false;
      doubleTapSprinting = false;
    }

    const guard = !!keys['KeyL'] && chordKeys.size < 2;
    if (guard) doubleTapSprinting = false;
    const jumpHeld = !!(keys['KeyK'] || keys['Space']) && chordKeys.size < 2;
    const sprinting = isSprintHeld();

    const facing = mv.ix !== 0 || mv.iz !== 0 ? Math.atan2(mv.mz, mv.mx) : undefined;
    localFacing = activeTargeting() ? null : (facing ?? null);

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
        if (pl.id === localClientId && localFacing !== null && !pl.targeting &&
            ['idle', 'run', 'jump', 'guard'].includes(pl.state)) {
          pl.facing = localFacing;
        }
        smoothedPlayers.push(pl);
      }
      renderer.render?.({
        ...currentGameState,
        players: smoothedPlayers
      }, localClientId);
    } else {
      renderer.render?.(null, null);
    }
    requestAnimationFrame(animate);
  }

  connectWebSocket();
  requestAnimationFrame(animate);
};
