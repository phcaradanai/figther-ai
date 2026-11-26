// ============================================================================
// Holy-light texture kit (procedural canvas, no image files)
// White/alpha textures tinted by material colour: fine-lined magic circles,
// light shafts, crescent sword waves, sparkles, hex barriers, heal crosses.
// Style target: Tree of Savior's Paladin / Cleric look (thin crisp lines, soft
// warm glow), drawn from scratch.
// ============================================================================
import * as THREE from 'three';

function canvas(w, h = w) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function toTexture(c, wrap = false) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (wrap) {
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.ClampToEdgeWrapping;
  }
  t.needsUpdate = true;
  return t;
}

// Small deterministic RNG so the rune band looks the same every load
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function glowStroke(g, width, blur, alpha = 1) {
  g.lineWidth = width;
  g.shadowBlur = blur;
  g.shadowColor = `rgba(255, 244, 214, ${alpha})`;
  g.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
}

function ring(g, cx, cy, r) {
  g.beginPath();
  g.arc(cx, cy, r, 0, Math.PI * 2);
  g.stroke();
}

// Paladin sanctuary circle: double outer ring, rune band, hexagram, ticks, star core
function makeHolyCircle(size = 1024, seed = 7) {
  const c = canvas(size);
  const g = c.getContext('2d');
  const cx = size / 2, cy = size / 2, R = size * 0.47;
  const rand = rng(seed);
  g.lineCap = 'round';
  g.lineJoin = 'round';

  // Faint inner light so the circle reads as glowing ground, not just lines
  const fill = g.createRadialGradient(cx, cy, 0, cx, cy, R);
  fill.addColorStop(0, 'rgba(255, 250, 230, 0.22)');
  fill.addColorStop(0.55, 'rgba(255, 245, 220, 0.08)');
  fill.addColorStop(1, 'rgba(255, 240, 210, 0)');
  g.fillStyle = fill;
  g.fillRect(0, 0, size, size);

  glowStroke(g, size * 0.007, size * 0.012);
  ring(g, cx, cy, R);
  glowStroke(g, size * 0.0035, size * 0.008);
  ring(g, cx, cy, R * 0.9);

  // Rune band between the two outer rings
  const runes = 30;
  for (let i = 0; i < runes; i++) {
    const a = (i / runes) * Math.PI * 2;
    const rr = R * 0.95;
    g.save();
    g.translate(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
    g.rotate(a + Math.PI / 2);
    glowStroke(g, size * 0.0032, size * 0.006, 0.95);
    const s = size * 0.014;
    g.beginPath();
    const strokes = 2 + Math.floor(rand() * 3);
    for (let k = 0; k < strokes; k++) {
      const kind = rand();
      const x0 = (rand() - 0.5) * s * 1.4, y0 = (rand() - 0.5) * s * 1.4;
      if (kind < 0.45) {
        g.moveTo(x0, y0);
        g.lineTo((rand() - 0.5) * s * 1.6, (rand() - 0.5) * s * 1.6);
      } else if (kind < 0.75) {
        g.moveTo(x0 + s * 0.35, y0);
        g.arc(x0, y0, s * 0.35, 0, Math.PI * (1 + rand()));
      } else {
        g.moveTo(-s * 0.7, y0);
        g.lineTo(s * 0.7, y0);
        g.moveTo(x0, -s * 0.7);
        g.lineTo(x0, s * 0.7);
      }
    }
    g.stroke();
    g.restore();
  }

  // Tick ring
  glowStroke(g, size * 0.004, size * 0.008);
  ring(g, cx, cy, R * 0.72);
  glowStroke(g, size * 0.0025, size * 0.005, 0.85);
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * Math.PI * 2;
    const r0 = R * 0.72, r1 = R * (i % 6 === 0 ? 0.8 : 0.76);
    g.beginPath();
    g.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
    g.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
    g.stroke();
  }

  // Hexagram + node rings at its points
  glowStroke(g, size * 0.0045, size * 0.01);
  for (const off of [-Math.PI / 2, Math.PI / 2]) {
    g.beginPath();
    for (let i = 0; i <= 3; i++) {
      const a = off + (i / 3) * Math.PI * 2;
      const px = cx + Math.cos(a) * R * 0.72, py = cy + Math.sin(a) * R * 0.72;
      if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
    }
    g.stroke();
  }
  glowStroke(g, size * 0.0035, size * 0.008);
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI / 2 + (i / 6) * Math.PI * 2;
    ring(g, cx + Math.cos(a) * R * 0.72, cy + Math.sin(a) * R * 0.72, R * 0.045);
  }
  ring(g, cx, cy, R * 0.36);
  ring(g, cx, cy, R * 0.3);

  // Four-point star core
  g.shadowBlur = size * 0.02;
  g.fillStyle = 'rgba(255, 255, 255, 0.95)';
  g.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = -Math.PI / 2 + (i / 8) * Math.PI * 2;
    const rr = i % 2 === 0 ? R * 0.27 : R * 0.05;
    const px = cx + Math.cos(a) * rr, py = cy + Math.sin(a) * rr;
    if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
  }
  g.closePath();
  g.fill();
  return toTexture(c);
}

// Lionheart emblem: sunburst of alternating long/short rays inside two rings
function makeSunburst(size = 1024) {
  const c = canvas(size);
  const g = c.getContext('2d');
  const cx = size / 2, cy = size / 2, R = size * 0.47;
  g.lineCap = 'round';
  const fill = g.createRadialGradient(cx, cy, R * 0.1, cx, cy, R);
  fill.addColorStop(0, 'rgba(255, 248, 225, 0.1)');
  fill.addColorStop(1, 'rgba(255, 240, 210, 0)');
  g.fillStyle = fill;
  g.fillRect(0, 0, size, size);
  g.shadowColor = 'rgba(255, 236, 190, 1)';
  g.shadowBlur = size * 0.006;
  g.fillStyle = 'rgba(255, 255, 255, 1)';
  const rays = 24;
  for (let i = 0; i < rays; i++) {
    const a = (i / rays) * Math.PI * 2;
    const long = i % 2 === 0;
    const r0 = R * 0.34, r1 = R * (long ? 0.94 : 0.74), w = long ? 0.06 : 0.045;
    g.beginPath();
    g.moveTo(cx + Math.cos(a - w) * r0, cy + Math.sin(a - w) * r0);
    g.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
    g.lineTo(cx + Math.cos(a + w) * r0, cy + Math.sin(a + w) * r0);
    g.closePath();
    g.fill();
  }
  glowStroke(g, size * 0.007, size * 0.012);
  ring(g, cx, cy, R * 0.3);
  glowStroke(g, size * 0.004, size * 0.008);
  ring(g, cx, cy, R * 0.25);
  ring(g, cx, cy, R * 0.98);
  return toTexture(c);
}

// Soft round glow
function makeGlow(size = 256) {
  const c = canvas(size);
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gr.addColorStop(0, 'rgba(255, 255, 255, 1)');
  gr.addColorStop(0.2, 'rgba(255, 255, 255, 0.55)');
  gr.addColorStop(0.5, 'rgba(255, 255, 255, 0.15)');
  gr.addColorStop(1, 'rgba(255, 255, 255, 0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, size, size);
  return toTexture(c);
}

// Sparkle flare: long thin cross rays + short diagonals + hot core
function makeFlare(size = 512) {
  const c = canvas(size);
  const g = c.getContext('2d');
  const h = size / 2;
  const core = g.createRadialGradient(h, h, 0, h, h, h * 0.4);
  core.addColorStop(0, 'rgba(255, 255, 255, 1)');
  core.addColorStop(0.25, 'rgba(255, 255, 255, 0.5)');
  core.addColorStop(1, 'rgba(255, 255, 255, 0)');
  g.fillStyle = core;
  g.fillRect(0, 0, size, size);
  const ray = (angle, len, width) => {
    g.save();
    g.translate(h, h);
    g.rotate(angle);
    const gr = g.createLinearGradient(-len, 0, len, 0);
    gr.addColorStop(0, 'rgba(255, 255, 255, 0)');
    gr.addColorStop(0.5, 'rgba(255, 255, 255, 1)');
    gr.addColorStop(1, 'rgba(255, 255, 255, 0)');
    g.fillStyle = gr;
    g.beginPath();
    g.moveTo(-len, 0);
    g.quadraticCurveTo(0, -width, len, 0);
    g.quadraticCurveTo(0, width, -len, 0);
    g.fill();
    g.restore();
  };
  ray(0, h * 0.98, size * 0.022);
  ray(Math.PI / 2, h * 0.98, size * 0.022);
  ray(Math.PI / 4, h * 0.45, size * 0.012);
  ray(-Math.PI / 4, h * 0.45, size * 0.012);
  return toTexture(c);
}

// Vertical light shaft: bright core column, soft edges, fades out toward the top
function makeLightShaft(w = 128, h = 512) {
  const c = canvas(w, h);
  const g = c.getContext('2d');
  const img = g.createImageData(w, h);
  const rand = rng(21);
  const streaks = Array.from({ length: 9 }, () => ({ x: rand(), w: 0.01 + rand() * 0.03, a: 0.25 + rand() * 0.5 }));
  for (let y = 0; y < h; y++) {
    const v = y / (h - 1); // 0 top, 1 bottom
    const vert = Math.pow(v, 1.4) * (1 - Math.pow(Math.max(0, v - 0.92) / 0.08, 2) * 0.6);
    for (let x = 0; x < w; x++) {
      const u = x / (w - 1) - 0.5;
      const core = Math.exp(-(u * u) / 0.012);
      const soft = Math.exp(-(u * u) / 0.07) * 0.55;
      let st = 0;
      for (const s of streaks) st += s.a * Math.exp(-Math.pow((x / (w - 1) - s.x) / s.w, 2));
      const a = Math.min(1, (core + soft + st * 0.35 * soft * 2) * vert);
      const i = (y * w + x) * 4;
      img.data[i] = 255;
      img.data[i + 1] = 255;
      img.data[i + 2] = 255;
      img.data[i + 3] = Math.round(a * 255);
    }
  }
  g.putImageData(img, 0, 0);
  return toTexture(c, true);
}

// Sword-wave crescent: convex edge faces +X (travel direction), hot outer rim,
// body fading toward the inner edge, fine arc streaks, tapered tips
function makeCrescent(size = 512) {
  const c = canvas(size);
  const g = c.getContext('2d');
  const img = g.createImageData(size, size);
  const rand = rng(5);
  const streakR = Array.from({ length: 14 }, () => ({ r: 0.6 + rand() * 0.36, a: 0.2 + rand() * 0.5, w: 0.004 + rand() * 0.008 }));
  const rOut = size * 0.5;
  const cx = size * 0.98 - rOut, cy = size * 0.5;
  const span = 1.3; // half angle (rad)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - cx, dy = y - cy;
      const r = Math.hypot(dx, dy) / rOut;
      const th = Math.atan2(dy, dx);
      const at = Math.abs(th) / span;
      if (at >= 1 || r > 1.02) continue;
      const thick = 0.42 * Math.pow(Math.cos(at * Math.PI / 2), 0.9);
      const inner = 1 - thick;
      if (r < inner - 0.05) continue;
      const k = (r - inner) / Math.max(0.001, thick); // 0 inner .. 1 outer
      let a = 0.12 + 0.88 * Math.pow(Math.max(0, Math.min(1, k)), 0.85);
      if (k < 0.12) a *= Math.max(0, k / 0.12);
      const rim = Math.exp(-Math.pow((r - 0.985) / 0.018, 2));
      a = Math.max(a * 0.85, rim);
      let st = 0;
      for (const s of streakR) st += s.a * Math.exp(-Math.pow((r - s.r) / s.w, 2));
      a = a * (0.78 + 0.4 * Math.min(1, st)) * (1 - Math.pow(at, 4));
      if (r > 1) a *= 1 - (r - 1) / 0.02;
      const i = (y * size + x) * 4;
      img.data[i] = 255;
      img.data[i + 1] = 255;
      img.data[i + 2] = 255;
      img.data[i + 3] = Math.round(Math.max(0, Math.min(1, a)) * 255);
    }
  }
  g.putImageData(img, 0, 0);
  return toTexture(c);
}

// Shockwave ring: crisp bright edge with a soft trailing fill inward
function makeShockRing(size = 512) {
  const c = canvas(size);
  const g = c.getContext('2d');
  const img = g.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const r = Math.hypot(x - size / 2, y - size / 2) / (size / 2);
      let a = 0;
      if (r <= 1) {
        a = Math.exp(-Math.pow((r - 0.93) / 0.025, 2)) + Math.max(0, (r - 0.55) / 0.38) * 0.3 * (r < 0.93 ? 1 : 0);
      }
      const i = (y * size + x) * 4;
      img.data[i] = 255;
      img.data[i + 1] = 255;
      img.data[i + 2] = 255;
      img.data[i + 3] = Math.round(Math.min(1, a) * 255);
    }
  }
  g.putImageData(img, 0, 0);
  return toTexture(c);
}

// Honeycomb barrier: glowing hex cell outlines, repeats horizontally for domes
function makeHexBarrier(w = 512, h = 256) {
  const c = canvas(w, h);
  const g = c.getContext('2d');
  const cell = w / 12;
  const hh = cell * Math.sqrt(3) / 2;
  g.lineJoin = 'round';
  g.shadowColor = 'rgba(220, 240, 255, 1)';
  g.shadowBlur = 6;
  g.strokeStyle = 'rgba(255, 255, 255, 0.95)';
  g.lineWidth = 2.2;
  for (let row = -1; row * hh < h + hh; row++) {
    for (let col = -1; col * cell * 1.5 < w + cell; col++) {
      const x = col * cell * 1.5;
      const y = row * hh * 2 + (col % 2 ? hh : 0);
      g.beginPath();
      for (let i = 0; i <= 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const px = x + Math.cos(a) * cell * 0.92, py = y + Math.sin(a) * cell * 0.92;
        if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
      }
      g.stroke();
    }
  }
  // Brighter base band (where a dome meets the ground)
  const gr = g.createLinearGradient(0, 0, 0, h);
  gr.addColorStop(0, 'rgba(255, 255, 255, 0)');
  gr.addColorStop(0.75, 'rgba(255, 255, 255, 0.05)');
  gr.addColorStop(1, 'rgba(255, 255, 255, 0.45)');
  g.shadowBlur = 0;
  g.fillStyle = gr;
  g.fillRect(0, 0, w, h);
  return toTexture(c, true);
}

// Front shield crest: hex plate with bright rim and inner cross
function makeShieldCrest(size = 512) {
  const c = canvas(size);
  const g = c.getContext('2d');
  const cx = size / 2, cy = size / 2, R = size * 0.44;
  const hex = (r) => {
    g.beginPath();
    for (let i = 0; i <= 6; i++) {
      const a = Math.PI / 6 + (i / 6) * Math.PI * 2;
      const px = cx + Math.cos(a) * r, py = cy + Math.sin(a) * r;
      if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
    }
  };
  const fill = g.createRadialGradient(cx, cy, 0, cx, cy, R);
  fill.addColorStop(0, 'rgba(255, 255, 255, 0.35)');
  fill.addColorStop(1, 'rgba(255, 255, 255, 0.08)');
  hex(R);
  g.fillStyle = fill;
  g.fill();
  glowStroke(g, size * 0.018, size * 0.03);
  hex(R);
  g.stroke();
  glowStroke(g, size * 0.007, size * 0.015);
  hex(R * 0.82);
  g.stroke();
  g.lineCap = 'round';
  glowStroke(g, size * 0.03, size * 0.03);
  g.beginPath();
  g.moveTo(cx, cy - R * 0.5);
  g.lineTo(cx, cy + R * 0.5);
  g.moveTo(cx - R * 0.32, cy - R * 0.12);
  g.lineTo(cx + R * 0.32, cy - R * 0.12);
  g.stroke();
  return toTexture(c);
}

// Heal cross with a soft halo
function makeCross(size = 128) {
  const c = canvas(size);
  const g = c.getContext('2d');
  const h = size / 2;
  const halo = g.createRadialGradient(h, h, 0, h, h, h);
  halo.addColorStop(0, 'rgba(255, 255, 255, 0.45)');
  halo.addColorStop(1, 'rgba(255, 255, 255, 0)');
  g.fillStyle = halo;
  g.fillRect(0, 0, size, size);
  g.shadowColor = 'rgba(255, 255, 255, 1)';
  g.shadowBlur = size * 0.08;
  g.fillStyle = 'rgba(255, 255, 255, 1)';
  const t = size * 0.11, l = size * 0.32;
  g.fillRect(h - t, h - l, t * 2, l * 2);
  g.fillRect(h - l, h - t, l * 2, t * 2);
  return toTexture(c);
}

// Floor streak: a glowing line that fades in from the left end
function makeGroundStreak(w = 512, h = 64) {
  const c = canvas(w, h);
  const g = c.getContext('2d');
  const img = g.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    const v = (y / (h - 1) - 0.5) * 2;
    const prof = Math.exp(-v * v / 0.05) + Math.exp(-v * v / 0.4) * 0.35;
    for (let x = 0; x < w; x++) {
      const u = x / (w - 1);
      const along = Math.min(1, u / 0.25) * Math.min(1, (1 - u) / 0.06);
      const i = (y * w + x) * 4;
      img.data[i] = 255;
      img.data[i + 1] = 255;
      img.data[i + 2] = 255;
      img.data[i + 3] = Math.round(Math.min(1, prof * along) * 255);
    }
  }
  g.putImageData(img, 0, 0);
  return toTexture(c);
}

let cached = null;
export function holyTextures() {
  if (!cached) {
    cached = {
      circle: makeHolyCircle(),
      sunburst: makeSunburst(),
      glow: makeGlow(),
      flare: makeFlare(),
      shaft: makeLightShaft(),
      crescent: makeCrescent(),
      shock: makeShockRing(),
      hex: makeHexBarrier(),
      crest: makeShieldCrest(),
      cross: makeCross(),
      streak: makeGroundStreak()
    };
  }
  return cached;
}
