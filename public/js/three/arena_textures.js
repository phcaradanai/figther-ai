import * as THREE from 'three';

function randomSource(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function paintTexture(width, height, paint, repeat = false) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  paint(canvas.getContext('2d'), width, height);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  if (repeat) {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = 8;
  }
  return tex;
}

export function makeArenaFloor(theme) {
  const { props, surface } = theme;
  return paintTexture(384, 384, (ctx, size) => {
    const rand = randomSource(152);
    const [base, seam, light, accent] = surface;
    const wood = props === 'harbor';
    const metal = props === 'courier';
    const cyber = props === 'astral';
    const ruins = props === 'ruins';
    const snow = props === 'snow';
    const tileW = wood ? 192 : 96;
    const tileH = wood ? 32 : snow ? 128 : 96;
    ctx.fillStyle = seam;
    ctx.fillRect(0, 0, size, size);
    for (let row = 0; row < size / tileH; row++) {
      for (let x = row % 2 ? -tileW / 2 : 0; x < size; x += tileW) {
        const y = row * tileH;
        const grad = ctx.createLinearGradient(x, y, x, y + tileH);
        grad.addColorStop(0, light);
        grad.addColorStop(0.25, base);
        grad.addColorStop(1, accent);
        ctx.fillStyle = grad;
        ctx.fillRect(x + 1, y + 1, tileW - 2, tileH - 2);

        if (cyber) {
          ctx.strokeStyle = 'rgba(121,211,250,0.65)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(x + 7, y + 13);
          ctx.lineTo(x + 38, y + 13);
          ctx.lineTo(x + 49, y + 24);
          ctx.lineTo(x + 83, y + 24);
          ctx.stroke();
          ctx.fillStyle = '#619cc5';
          ctx.fillRect(x + 77, y + 22, 6, 5);
        } else if (wood || metal) {
          ctx.fillStyle = seam;
          for (const u of [x + 7, x + tileW - 7]) {
            ctx.beginPath();
            ctx.arc(u, y + tileH - 8, metal ? 2.4 : 1.5, 0, Math.PI * 2);
            ctx.fill();
          }
        } else {
          ctx.strokeStyle = snow ? seam : light;
          ctx.globalAlpha = 0.5;
          ctx.beginPath();
          ctx.moveTo(x + 12, y + tileH * 0.7);
          ctx.lineTo(x + tileW * 0.48, y + tileH * 0.53);
          ctx.lineTo(x + tileW * 0.6, y + tileH * 0.3);
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
      }
    }

    if (ruins || snow) {
      for (let i = 0; i < 65; i++) {
        const x = rand() * size;
        const y = rand() * size;
        const r = 4 + rand() * (ruins ? 16 : 22);
        const patch = ctx.createRadialGradient(x, y, 0, x, y, r);
        patch.addColorStop(0, ruins ? 'rgba(120,143,65,0.5)' : 'rgba(255,255,255,0.48)');
        patch.addColorStop(1, ruins ? 'rgba(120,143,65,0)' : 'rgba(255,255,255,0)');
        ctx.fillStyle = patch;
        ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
      }
    }

    for (let i = 0; i < 1700; i++) {
      ctx.fillStyle = i % 2 ? light : seam;
      ctx.globalAlpha = 0.04 + rand() * 0.12;
      const x = rand() * size;
      const y = rand() * size;
      ctx.fillRect(x, y, (wood ? 32 : 5) * rand() + 1, wood ? 1 : 2.5);
    }
  }, true);
}

function paintRidge(ctx, width, height, y, color, rand, relief) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, height);
  for (let x = 0; x <= width; x += width / 20) {
    const ridge = 0.5 + Math.sin(x / width * 14) * 0.27;
    ctx.lineTo(x, y - (ridge + rand() * 0.5) * relief);
  }
  ctx.lineTo(width, height);
  ctx.fill();
}

function paintSkyline(ctx, width, height, colors, rand) {
  for (const [layer, color] of colors.entries()) {
    const street = height * (0.77 + layer * 0.11);
    for (let x = -20; x < width;) {
      const w = 18 + rand() * 46;
      const h = 12 + rand() * (60 + layer * 34);
      ctx.fillStyle = color;
      ctx.fillRect(x, street - h, w, height - street + h + 1);
      ctx.fillRect(x + w * 0.22, street - h - 6, w * 0.58, 7);
      if (layer === 2) {
        ctx.fillStyle = 'rgba(202,215,211,0.23)';
        for (let y = street - h + 9; y < street; y += 9) {
          for (let offset = 6; offset < w - 4; offset += 8) {
            if (rand() > 0.74) ctx.fillRect(x + offset, y, 3, 2);
          }
        }
      }
      x += w + rand() * 13;
    }
  }
}

export function makeArenaSky(map, theme) {
  return paintTexture(1024, 640, (ctx, width, height) => {
    const rand = randomSource(193);
    const horizon = ctx.createLinearGradient(0, 0, 0, height);
    horizon.addColorStop(0, map.skyTop);
    horizon.addColorStop(0.65, map.skyBottom);
    horizon.addColorStop(1, theme.fog);
    ctx.fillStyle = horizon;
    ctx.fillRect(0, 0, width, height);

    const glow = ctx.createRadialGradient(width * 0.24, height * 0.31, 15, width * 0.24, height * 0.31, width * 0.25);
    const glowColor = theme.props === 'astral' ? '187,211,232' : '246,233,207';
    glow.addColorStop(0, `rgba(${glowColor},0.46)`);
    glow.addColorStop(0.2, `rgba(${glowColor},0.26)`);
    glow.addColorStop(1, `rgba(${glowColor},0)`);
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);

    for (let i = 0; i < 64; i++) {
      const x = rand() * width;
      const y = height * (0.14 + rand() * 0.49);
      const r = 18 + rand() * 110;
      const cloud = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
      cloud.addColorStop(0, 'rgba(255,243,220,0.32)');
      cloud.addColorStop(1, 'rgba(255,243,220,0)');
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(1, 0.23 + rand() * 0.25);
      ctx.fillStyle = cloud;
      ctx.fillRect(-r, -r, r * 2, r * 2);
      ctx.restore();
    }

    if (theme.props === 'astral') {
      paintSkyline(ctx, width, height, theme.ridges, rand);
    } else {
      for (const [index, color] of theme.ridges.entries()) {
        const y = height * (0.67 + index * 0.075);
        paintRidge(ctx, width, height, y, color, rand, height * (0.08 + index * 0.026));
      }
    }

    if (theme.props === 'ruins' || theme.props === 'snow') {
      const forest = theme.props === 'ruins';
      ctx.fillStyle = theme.ridges.at(-1);
      for (let i = 0; i < 95; i++) {
        const x = rand() * width;
        const y = height * (0.74 + rand() * 0.11);
        const h = 8 + rand() * 31;
        ctx.beginPath();
        ctx.moveTo(x - h * 0.22, y);
        ctx.lineTo(x, y - h);
        ctx.lineTo(x + h * 0.26, y);
        ctx.fill();
      }
      if (!forest) {
        ctx.fillStyle = 'rgba(242,250,255,0.55)';
        for (let i = 0; i < 170; i++) {
          const r = 0.5 + rand() * 1.15;
          ctx.fillRect(rand() * width, rand() * height, r, r);
        }
      }
    }
  });
}

export function makeTideTexture() {
  return paintTexture(256, 256, (ctx, size) => {
    const rand = randomSource(73);
    ctx.fillStyle = '#426e79';
    ctx.fillRect(0, 0, size, size);
    for (let row = 0; row < 38; row++) {
      const y = 5 + rand() * (size - 10);
      const start = rand() * 175;
      const until = Math.min(size, start + 17 + rand() * 65);
      const fade = ctx.createLinearGradient(start, 0, until, 0);
      fade.addColorStop(0, 'rgba(170,210,210,0)');
      fade.addColorStop(0.5, 'rgba(170,210,210,0.3)');
      fade.addColorStop(1, 'rgba(170,210,210,0)');
      ctx.strokeStyle = fade;
      ctx.beginPath();
      for (let x = start; x <= until; x += 2) {
        const crest = y + Math.sin(x / size * 4 * Math.PI + row * 1.3) * 2;
        ctx.lineTo(x, crest);
      }
      ctx.stroke();
    }
  }, true);
}
