// Dev tool: capture a contact sheet of the live 3D game in slow motion.
// In the console of /?renderer=3d:  const a = await import('/dev/combat_capture.js'); a.setup();
// then  await a.shoot({ keys: [['KeyJ', 40]] })  and look at the sheet drawn over the page.
// Not linked from the game; slow motion only scales the client clock (the server stays real time).
const R = () => window.__threeRenderer;

export function setup({ scale = 0.12, camDist = 18, clearBots = true } = {}) {
  const r = R();
  if (!window.__auditClock) {
    const real = performance.now.bind(performance);
    let virt = real(), last = virt;
    performance.now = () => { const t = real(); virt += (t - last) * window.__ts; last = t; return virt; };
    const render = r.render.bind(r);
    r.render = (state, id) => { render(state, id); window.__capTick?.(); };
    window.__auditClock = true;
  }
  window.__ts = scale;
  r.camDist = camDist;
  if (clearBots) {
    document.getElementById('btnTrainingTools')?.click();
    document.getElementById('btnClearBots')?.click();
  }
  return 'ready';
}

export const speed = s => { window.__ts = s; };
export const press = (code, hold = 60) => {
  window.dispatchEvent(new KeyboardEvent('keydown', { code, key: code, bubbles: true }));
  setTimeout(() => window.dispatchEvent(new KeyboardEvent('keyup', { code, key: code, bubbles: true })), hold);
};
export const me = () => [...R().players.values()][0];
export const closeSheet = () => document.getElementById('__sheet')?.remove();

// Tiles follow the character: n frames, `step` ms of game time apart, around `size` css px.
export function shoot({ n = 12, step = 40, cols = 6, size = 240, tile = 220, keys = [], calls = [], start = 0, follow = null, ahead = 0, lift = 1.0 } = {}) {
  closeSheet();
  return new Promise(resolve => {
    const r = R(), cv = r.renderer.domElement;
    const sx = cv.width / innerWidth, sy = cv.height / innerHeight;
    const sheet = document.createElement('canvas');
    sheet.width = cols * tile; sheet.height = Math.ceil(n / cols) * tile;
    const g = sheet.getContext('2d');
    g.fillStyle = '#222'; g.fillRect(0, 0, sheet.width, sheet.height);
    for (const [code, at, hold] of keys) setTimeout(() => press(code, hold), at);
    for (const [fn, at] of calls) setTimeout(fn, at);
    let i = 0, begin = null;
    window.__capTick = () => {
      const now = performance.now();
      if (begin === null) begin = now + start;
      if (now < begin + i * step) return;
      const e = follow ? r.players.get(follow) : me();
      const p = e.view.root.position;
      const f = e.pl.facing || 0;
      const v = r.camera.position.clone().set(p.x + Math.cos(f) * ahead, p.y + lift, p.z + Math.sin(f) * ahead).project(r.camera);
      const px = (v.x * 0.5 + 0.5) * innerWidth, py = (-v.y * 0.5 + 0.5) * innerHeight;
      const x = (i % cols) * tile, y = Math.floor(i / cols) * tile;
      g.drawImage(cv, (px - size / 2) * sx, (py - size / 2) * sy, size * sx, size * sy, x, y, tile, tile);
      g.fillStyle = 'rgba(0,0,0,.65)'; g.fillRect(x, y, 96, 15);
      g.fillStyle = '#ffe066'; g.font = '11px monospace';
      g.fillText(`${Math.round(now - begin + start)}ms ${e.view.currentName}`, x + 3, y + 12);
      if (++i >= n) {
        window.__capTick = null;
        sheet.id = '__sheet';
        sheet.style.cssText = 'position:fixed;left:0;top:0;width:100vw;z-index:99999;background:#222';
        document.body.appendChild(sheet);
        resolve(`${sheet.width}x${sheet.height}`);
      }
    };
  });
}

// Replays a server fx event in front of the local player.
export function fx(type, extra = {}, ahead = 1.1) {
  const e = me(), p = e.pl;
  r_fx({ id: Math.floor(Math.random() * 1e9), type, x: p.x + Math.cos(p.facing) * ahead, y: p.y + 0.9, z: p.z + Math.sin(p.facing) * ahead, facing: p.facing, color: '#60a5fa', heroId: 'knight', playerId: p.id, originX: p.x, originY: p.y, originZ: p.z, weaponType: 'broadsword', ...extra });
}
const r_fx = event => R().processServerFx([event]);

// Records every rendered frame of the local player for `ms` of game time: clip, body and boot
// positions, and the orientation of the main bones relative to the character. Use it with real
// input (press / keys) to find jerks: `const log = await a.record(6000, [['KeyD', 100, 1500]])`,
// then `a.jerks(log)`.
const TRACKED = ['hips', 'torso', 'head', 'armL', 'foreL', 'handL', 'armR', 'foreR', 'handR', 'legL', 'shinL', 'footL', 'legR', 'shinR', 'footR'];
export function record(ms, keys = [], follow = null) {
  return new Promise(resolve => {
    const r = R();
    const frames = [];
    for (const [code, at, hold] of keys) setTimeout(() => press(code, hold), at);
    let begin = null;
    window.__capTick = () => {
      const e = follow ? r.players.get(follow) : me();
      if (!e) return;
      const now = performance.now();
      if (begin === null) begin = now;
      const v = e.view, THREE_Q = v.root.quaternion.constructor, V3 = v.root.position.constructor;
      v.root.updateMatrixWorld(true);
      const ri = v.root.getWorldQuaternion(new THREE_Q()).invert();
      const bones = {};
      for (const name of TRACKED) bones[name] = v.R[name].getWorldQuaternion(new THREE_Q()).premultiply(ri).toArray();
      const foot = b => v.R[b].getWorldPosition(new V3()).toArray();
      frames.push({
        t: now - begin, clip: v.currentName, state: e.pl.state, grounded: e.pl.grounded,
        x: e.pl.x, z: e.pl.z, vx: e.pl.vx, vz: e.pl.vz, facing: e.pl.facing,
        root: v.root.position.toArray(), yaw: v.root.rotation.y,
        hips: v.R.hips.getWorldPosition(new V3()).toArray(), footL: foot('footL'), footR: foot('footR'), bones
      });
      if (now - begin >= ms) { window.__capTick = null; resolve(frames); }
    };
  });
}

const angle = (a, b) => 2 * Math.acos(Math.min(1, Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3])));
// Frames where a bone turns far more in one frame than around it, with the clip change (if any) that caused it.
export function jerks(frames, { minAngle = 0.35, ratio = 3 } = {}) {
  const out = [];
  for (let i = 3; i < frames.length - 4; i++) {
    for (const name of TRACKED) {
      const d = angle(frames[i].bones[name], frames[i - 1].bones[name]);
      const around = [-2, -1, 1, 2, 3].map(k => angle(frames[i + k].bones[name], frames[i + k - 1].bones[name])).sort((a, b) => a - b);
      const typical = around[2];
      if (d > minAngle && d > typical * ratio + 0.1) {
        out.push({ i, t: Math.round(frames[i].t), bone: name, turn: +d.toFixed(2), typical: +typical.toFixed(2), from: frames[i - 1].clip, to: frames[i].clip, dt: Math.round(frames[i].t - frames[i - 1].t) });
      }
    }
  }
  return out;
}
