// ============================================================================
// Procedural canvas textures for the Three.js renderer (no extra asset files):
// particle atlas, magic circles, slash ribbons, beams, clouds, cliff stone.
// ============================================================================
import * as THREE from 'three';

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function toTexture(canvas, { srgb = true, repeat = false } = {}) {
  const tex = new THREE.CanvasTexture(canvas);
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  if (repeat) tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

// Deterministic pseudo-random so textures look the same every load
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// 2x2 particle atlas: 0 glow dot, 1 dust puff, 2 petal, 3 four-point sparkle
export function makeParticleAtlas() {
  const S = 128;
  const c = makeCanvas(S * 2, S * 2);
  const g = c.getContext('2d');

  // 0: soft glow dot
  let grd = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.25, 'rgba(255,255,255,0.85)');
  grd.addColorStop(0.6, 'rgba(255,255,255,0.25)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, S, S);

  // 1: watercolor dust puff (overlapping soft blobs)
  const r = rng(7);
  for (let i = 0; i < 9; i++) {
    const bx = S + S / 2 + (r() - 0.5) * S * 0.38;
    const by = S / 2 + (r() - 0.5) * S * 0.38;
    const br = S * (0.16 + r() * 0.16);
    grd = g.createRadialGradient(bx, by, 0, bx, by, br);
    grd.addColorStop(0, 'rgba(255,255,255,0.55)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.beginPath();
    g.arc(bx, by, br, 0, Math.PI * 2);
    g.fill();
  }

  // 2: petal / leaf
  g.save();
  g.translate(S / 2, S + S / 2);
  g.rotate(0.6);
  grd = g.createLinearGradient(0, -S * 0.32, 0, S * 0.32);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(1, 'rgba(255,255,255,0.75)');
  g.fillStyle = grd;
  g.beginPath();
  g.ellipse(0, 0, S * 0.16, S * 0.32, 0, 0, Math.PI * 2);
  g.fill();
  g.restore();

  // 3: four-point sparkle star
  g.save();
  g.translate(S + S / 2, S + S / 2);
  grd = g.createRadialGradient(0, 0, 0, 0, 0, S * 0.5);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.2, 'rgba(255,255,255,0.6)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  for (let k = 0; k < 2; k++) {
    g.save();
    g.rotate(k * Math.PI / 2);
    g.beginPath();
    g.moveTo(0, -S * 0.48);
    g.quadraticCurveTo(S * 0.05, 0, 0, S * 0.48);
    g.quadraticCurveTo(-S * 0.05, 0, 0, -S * 0.48);
    g.fill();
    g.restore();
  }
  g.beginPath();
  g.arc(0, 0, S * 0.12, 0, Math.PI * 2);
  g.fill();
  g.restore();

  return toTexture(c);
}

// Ornate arcane circle (white on transparent, tinted by material color)
export function makeMagicCircle() {
  const S = 512;
  const c = makeCanvas(S, S);
  const g = c.getContext('2d');
  g.translate(S / 2, S / 2);
  g.strokeStyle = 'rgba(255,255,255,0.95)';
  g.fillStyle = 'rgba(255,255,255,0.95)';
  g.shadowColor = 'rgba(255,255,255,0.9)';
  g.shadowBlur = 8;

  const ring = (rad, w) => {
    g.lineWidth = w;
    g.beginPath();
    g.arc(0, 0, rad, 0, Math.PI * 2);
    g.stroke();
  };
  ring(244, 6);
  ring(226, 2);
  ring(168, 4);
  ring(96, 3);

  // Rune ticks between outer rings
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    g.save();
    g.rotate(a);
    g.fillRect(-2, -240, 4, i % 4 === 0 ? 18 : 9);
    if (i % 6 === 3) {
      g.beginPath();
      g.arc(0, -205, 6, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
  }

  // Hexagram
  g.lineWidth = 3;
  for (let t = 0; t < 2; t++) {
    g.beginPath();
    for (let i = 0; i <= 3; i++) {
      const a = t * Math.PI / 3 + (i / 3) * Math.PI * 2 - Math.PI / 2;
      const px = Math.cos(a) * 166;
      const py = Math.sin(a) * 166;
      if (i === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    }
    g.stroke();
  }

  // Inner sun petals
  for (let i = 0; i < 12; i++) {
    g.save();
    g.rotate((i / 12) * Math.PI * 2);
    g.beginPath();
    g.moveTo(0, -94);
    g.quadraticCurveTo(14, -60, 0, -30);
    g.quadraticCurveTo(-14, -60, 0, -94);
    g.stroke();
    g.restore();
  }
  ring(26, 4);
  return toTexture(c);
}

// Slash ribbon: u = along the arc (tail -> head), v = across (inner -> outer edge)
export function makeSlashTexture() {
  const W = 256, H = 64;
  const c = makeCanvas(W, H);
  const g = c.getContext('2d');
  const img = g.createImageData(W, H);
  for (let y = 0; y < H; y++) {
    const v = y / (H - 1);
    // Bright sharp outer edge, soft inner falloff
    const across = Math.pow(v, 2.2) * (v > 0.92 ? (1 - v) / 0.08 : 1);
    for (let x = 0; x < W; x++) {
      const u = x / (W - 1);
      const along = Math.pow(u, 1.6) * Math.min(1, (1 - u) * 14);
      const a = Math.max(0, Math.min(1, across * along * 1.4));
      const core = Math.pow(a, 0.6);
      const i = (y * W + x) * 4;
      img.data[i] = 255;
      img.data[i + 1] = 255;
      img.data[i + 2] = 255;
      img.data[i + 3] = Math.round(core * 255);
    }
  }
  g.putImageData(img, 0, 0);
  return toTexture(c);
}

// Vertical beam gradient (bright core, soft sides, fades at the top)
export function makeBeamTexture() {
  const W = 64, H = 256;
  const c = makeCanvas(W, H);
  const g = c.getContext('2d');
  const img = g.createImageData(W, H);
  for (let y = 0; y < H; y++) {
    const v = 1 - y / (H - 1);
    for (let x = 0; x < W; x++) {
      const u = x / (W - 1);
      const across = Math.pow(Math.sin(u * Math.PI), 1.5);
      const a = across * Math.min(1, (1 - v) * 1.2 + 0.15) * Math.min(1, v * 8);
      const i = (y * W + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
      img.data[i + 3] = Math.round(Math.max(0, Math.min(1, a)) * 255);
    }
  }
  g.putImageData(img, 0, 0);
  return toTexture(c);
}

// Big soft painterly cloud
export function makeCloudTexture(seed = 3) {
  const S = 256;
  const c = makeCanvas(S, S);
  const g = c.getContext('2d');
  const r = rng(seed);
  for (let i = 0; i < 22; i++) {
    const a = r() * Math.PI * 2;
    const d = Math.pow(r(), 0.7) * S * 0.26;
    const bx = S / 2 + Math.cos(a) * d * 1.3;
    const by = S / 2 + Math.sin(a) * d * 0.7;
    const br = S * (0.12 + r() * 0.14);
    const grd = g.createRadialGradient(bx, by - br * 0.3, 0, bx, by, br);
    grd.addColorStop(0, 'rgba(255,255,255,0.55)');
    grd.addColorStop(0.7, 'rgba(255,255,255,0.22)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.beginPath();
    g.arc(bx, by, br, 0, Math.PI * 2);
    g.fill();
  }
  return toTexture(c);
}

// Soft round blob shadow
export function makeShadowTexture() {
  const S = 128;
  const c = makeCanvas(S, S);
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  grd.addColorStop(0, 'rgba(40,25,20,0.55)');
  grd.addColorStop(0.55, 'rgba(40,25,20,0.32)');
  grd.addColorStop(1, 'rgba(40,25,20,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, S, S);
  return toTexture(c);
}

// Hand-painted looking cliff stone (brick courses, vertical light-to-dark wash)
export function makeCliffTexture(base, dark, seed = 11) {
  const W = 512, H = 256;
  const c = makeCanvas(W, H);
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, H);
  grd.addColorStop(0, base);
  grd.addColorStop(1, dark);
  g.fillStyle = grd;
  g.fillRect(0, 0, W, H);
  const r = rng(seed);
  const rowH = 42;
  for (let row = 0; row * rowH < H; row++) {
    const y = row * rowH;
    let x = (row % 2) * -40;
    while (x < W) {
      const bw = 70 + r() * 60;
      g.fillStyle = `rgba(255,255,255,${0.04 + r() * 0.08})`;
      g.fillRect(x + 3, y + 3, bw - 6, rowH - 6);
      g.strokeStyle = 'rgba(30,18,10,0.35)';
      g.lineWidth = 3;
      g.strokeRect(x + 1.5, y + 1.5, bw - 3, rowH - 3);
      x += bw;
    }
  }
  // Moss / drips
  for (let i = 0; i < 40; i++) {
    g.fillStyle = `rgba(90,140,70,${0.08 + r() * 0.12})`;
    const mx = r() * W;
    g.beginPath();
    g.ellipse(mx, r() * 30, 10 + r() * 22, 6 + r() * 10, 0, 0, Math.PI * 2);
    g.fill();
  }
  return toTexture(c, { repeat: true });
}

// 4-tone soft ramp for MeshToonMaterial (lifted shadows = painterly, not hard cel)
export function makeToonRamp() {
  const data = new Uint8Array([120, 120, 120, 255, 172, 172, 172, 255, 226, 226, 226, 255, 255, 255, 255, 255]);
  const tex = new THREE.DataTexture(data, 4, 1, THREE.RGBAFormat);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

// Irregular scorch / splatter mark for lingering ground decals (white, tinted)
export function makeScorchTexture() {
  const S = 256;
  const c = makeCanvas(S, S);
  const g = c.getContext('2d');
  const r = rng(29);
  for (let i = 0; i < 26; i++) {
    const a = r() * Math.PI * 2;
    const d = Math.pow(r(), 1.4) * S * 0.3;
    const bx = S / 2 + Math.cos(a) * d;
    const by = S / 2 + Math.sin(a) * d;
    const br = S * (0.06 + r() * 0.16) * (1 - d / (S * 0.45));
    const grd = g.createRadialGradient(bx, by, 0, bx, by, br);
    grd.addColorStop(0, 'rgba(255,255,255,0.7)');
    grd.addColorStop(0.6, 'rgba(255,255,255,0.35)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.beginPath();
    g.arc(bx, by, br, 0, Math.PI * 2);
    g.fill();
  }
  // Spatter droplets flung outward
  for (let i = 0; i < 30; i++) {
    const a = r() * Math.PI * 2;
    const d = S * (0.28 + r() * 0.18);
    g.fillStyle = `rgba(255,255,255,${0.35 + r() * 0.4})`;
    g.beginPath();
    g.ellipse(S / 2 + Math.cos(a) * d, S / 2 + Math.sin(a) * d, 2 + r() * 5, 1.5 + r() * 3, a, 0, Math.PI * 2);
    g.fill();
  }
  return toTexture(c);
}
