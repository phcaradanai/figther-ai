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

function grain(ctx, size, rand, light, dark) {
  for (let i = 0; i < 4100; i++) {
    ctx.fillStyle = i % 2 ? light : dark;
    ctx.globalAlpha = 0.035 + rand() * 0.12;
    ctx.fillRect(rand() * size, rand() * size, 1 + rand() * 4, 1 + rand() * 2);
  }
  ctx.globalAlpha = 1;
}

function patches(ctx, size, rand, rgb, count, radius, opacity, stretch = 1) {
  for (let i = 0; i < count; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const r = radius * (0.3 + rand() * 0.7);
    for (let dy = -size; dy <= size; dy += size) {
      for (let dx = -size; dx <= size; dx += size) {
        const px = x + dx;
        const py = y + dy;
        if (px + r * stretch <= 0 || px - r * stretch >= size || py + r <= 0 || py - r >= size) continue;
        ctx.save();
        ctx.translate(px, py);
        ctx.scale(stretch, 1);
        const wash = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
        wash.addColorStop(0, `rgba(${rgb},${opacity})`);
        wash.addColorStop(1, `rgba(${rgb},0)`);
        ctx.fillStyle = wash;
        ctx.fillRect(-r, -r, r * 2, r * 2);
        ctx.restore();
      }
    }
  }
}

function boards(ctx, size, rand, palette, height) {
  const [base, seam, light, shade] = palette;
  const width = size / 2;
  ctx.fillStyle = seam;
  ctx.fillRect(0, 0, size, size);
  for (let row = 0; row < size / height; row++) {
    const y = row * height;
    for (let col = 0; col < 2; col++) {
      const x = col * width - (row % 4) * width / 4;
      const seed = 51 + row * 13 + col * 19;
      for (const left of [x, x + size]) {
        const boardRand = randomSource(seed);
        const wash = ctx.createLinearGradient(left, y, left, y + height);
        wash.addColorStop(0, light);
        wash.addColorStop(0.14, (row + col) % 3 === 0 ? shade : base);
        wash.addColorStop(1, shade);
        ctx.fillStyle = wash;
        ctx.fillRect(left + 1, y + 1, width - 2, height - 2);
        ctx.strokeStyle = seam;
        for (let i = 0; i < 12; i++) {
          const start = left + 8 + boardRand() * 54;
          const lineY = y + 3 + boardRand() * (height - 6);
          ctx.globalAlpha = 0.07 + boardRand() * 0.2;
          ctx.beginPath();
          ctx.moveTo(start, lineY);
          ctx.bezierCurveTo(start + 42, lineY - 2, start + 94, lineY + 3, start + 155, lineY - 1);
          ctx.stroke();
        }
        ctx.globalAlpha = 0.7;
        for (const end of [left + 7, left + width - 7]) {
          ctx.fillStyle = seam;
          ctx.fillRect(end, y + height * 0.35, 2, 2);
          ctx.fillRect(end, y + height * 0.65, 2, 2);
        }
        ctx.globalAlpha = 1;
      }
    }
  }
  grain(ctx, size, rand, light, seam);
}

function paving(ctx, size, rand, palette, kind) {
  const [base, seam, light, shade] = palette;
  const width = size / 4;
  const height = kind === 'lava' ? size / 4 : size / 8;
  ctx.fillStyle = seam;
  ctx.fillRect(0, 0, size, size);
  for (let row = 0; row < size / height; row++) {
    for (let col = 0; col < 4; col++) {
      const x = col * width - (row % 2) * width / 2;
      const y = row * height;
      const cut = 4 + rand() * (kind === 'lava' ? 22 : 8);
      const face = rand() > 0.65 ? shade : base;
      for (const left of [x, x + size]) {
        const wash = ctx.createLinearGradient(left, y, left + width, y + height);
        wash.addColorStop(0, light);
        wash.addColorStop(0.31, face);
        wash.addColorStop(1, shade);
        ctx.fillStyle = wash;
        ctx.beginPath();
        ctx.moveTo(left + cut, y + 3);
        ctx.lineTo(left + width - cut * 0.6, y + 2);
        ctx.lineTo(left + width - 3, y + cut);
        ctx.lineTo(left + width - 4, y + height - cut * 0.7);
        ctx.lineTo(left + width - cut, y + height - 3);
        ctx.lineTo(left + cut * 0.8, y + height - 3);
        ctx.lineTo(left + 3, y + height - cut);
        ctx.lineTo(left + 3, y + cut);
        ctx.closePath();
        ctx.fill();
        if (kind === 'lava' && (row + col) % 3 !== 1) {
          ctx.strokeStyle = seam;
          ctx.globalAlpha = 0.49;
          ctx.beginPath();
          ctx.moveTo(left + cut + 3, y + 8);
          ctx.lineTo(left + width * 0.42, y + height * 0.25);
          ctx.lineTo(left + width * 0.36, y + height * 0.33);
          ctx.lineTo(left + width * 0.56, y + height * 0.44);
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
      }
    }
  }
  if (kind === 'ruins') patches(ctx, size, rand, '82,108,48', 45, 61, 0.7);
  if (kind === 'lava') patches(ctx, size, rand, '153,94,64', 57, 32, 0.25);
  grain(ctx, size, rand, light, seam);
}

function plates(ctx, size, rand, palette, finish) {
  const [base, seam, light, shade] = palette;
  const catwalk = finish === 'catwalk';
  const forecastle = finish === 'forecastle';
  const airship = finish === 'courier';
  const width = size / (catwalk ? 8 : airship ? 2 : 4);
  const height = size / (catwalk ? 2 : airship ? 8 : 4);
  ctx.fillStyle = seam;
  ctx.fillRect(0, 0, size, size);
  for (let y = 0; y < size; y += height) {
    for (let x = 0; x < size; x += width) {
      const wash = ctx.createLinearGradient(x, y, x, y + height);
      wash.addColorStop(0, light);
      wash.addColorStop(0.16, base);
      wash.addColorStop(1, shade);
      ctx.fillStyle = wash;
      ctx.fillRect(x + 1, y + 1, width - 2, height - 2);
      ctx.fillStyle = seam;
      if (catwalk || forecastle) {
        for (let row = y + 11; row < y + height - 6; row += catwalk ? 15 : 24) {
          ctx.globalAlpha = 0.55;
          ctx.fillRect(x + 9, row, width - 18, 2);
        }
        ctx.globalAlpha = 1;
      }
      if (airship) {
        ctx.globalAlpha = 0.55;
        for (let bolt = x + 18; bolt < x + width - 10; bolt += 19) {
          ctx.fillRect(bolt, y + height - 5, 2.5, 2.5);
        }
        ctx.globalAlpha = 1;
      }
      for (const u of [x + 6, x + width - 6]) {
        for (const v of [y + 6, y + height - 6]) {
          ctx.beginPath();
          ctx.arc(u, v, 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }
  grain(ctx, size, rand, light, seam);
}

export function makeArenaFloor(theme, finish) {
  const { props } = theme;
  const palette = finish === 'cinder' ? ['#806459', '#463334', '#a58a72', '#6b534b']
    : finish === 'archstone' ? ['#746764', '#40393a', '#9b8c81', '#665958']
    : theme.surface;
  return paintTexture(512, 512, (ctx, size) => {
    const rand = randomSource(152);
    if (props === 'harbor') {
      boards(ctx, size, rand, palette, size / 16);
    } else if (finish === 'archstone') {
      paving(ctx, size, rand, palette, 'ashlar');
    } else if (finish === 'ice') {
      ctx.fillStyle = '#77a7b8';
      ctx.fillRect(0, 0, size, size);
      patches(ctx, size, rand, '213,240,238', 38, 93, 0.48, 1.9);
      patches(ctx, size, rand, '58,106,134', 24, 62, 0.3, 1.4);
      // Hairline fractures meet their neighbours across the tile boundaries.
      for (const points of [
        [[0, 155], [79, 174], [128, 150], [204, 178], [248, 159], [287, 168], [360, 139], [414, 146], [512, 155]],
        [[128, 150], [145, 118], [175, 107], [186, 79]],
        [[360, 139], [373, 183], [365, 200], [390, 227]],
        [[268, 0], [280, 51], [258, 85], [269, 119], [248, 159]],
        [[268, 512], [256, 477], [270, 453], [266, 435]]
      ]) {
        ctx.beginPath();
        for (const [i, [x, y]] of points.entries()) {
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = 'rgba(67,115,135,0.46)';
        ctx.lineWidth = 3.5;
        ctx.stroke();
        ctx.strokeStyle = 'rgba(226,247,245,0.82)';
        ctx.lineWidth = 1.3;
        ctx.stroke();
      }
      grain(ctx, size, rand, '#e1f3ee', '#56869a');
    } else if (props === 'snow') {
      ctx.fillStyle = palette[0];
      ctx.fillRect(0, 0, size, size);
      patches(ctx, size, rand, '242,250,252', 54, 103, 0.56, 2.4);
      patches(ctx, size, rand, '112,152,177', 30, 58, 0.18, 2.7);
      ctx.strokeStyle = '#e4eff4';
      for (let i = 0; i < 86; i++) {
        const x = rand() * size;
        const y = rand() * size;
        const length = 6 + rand() * 42;
        ctx.globalAlpha = 0.08 + rand() * 0.13;
        for (const offset of [0, -size]) {
          ctx.beginPath();
          ctx.moveTo(x + offset, y);
          ctx.quadraticCurveTo(x + offset + length * 0.6, y - 1.6, x + offset + length, y);
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
      grain(ctx, size, rand, palette[2], palette[1]);
    } else if (props === 'courier' || props === 'astral') {
      plates(ctx, size, rand, palette, finish ?? props);
    } else {
      paving(ctx, size, rand, palette, props);
    }
  }, true);
}

export function makeConveyorTread() {
  return paintTexture(384, 256, (ctx, width, height) => {
    ctx.fillStyle = '#344745';
    ctx.fillRect(0, 0, width, height);
    for (let x = 0; x < width; x += 32) {
      const rubber = ctx.createLinearGradient(x, 0, x + 32, 0);
      rubber.addColorStop(0, '#85908a');
      rubber.addColorStop(0.08, '#566762');
      rubber.addColorStop(1, '#43534f');
      ctx.fillStyle = rubber;
      ctx.fillRect(x + 1, 0, 29, height);
      ctx.fillStyle = '#a0a59a';
      for (const y of [15, height - 15]) ctx.fillRect(x + 7, y, 7, 3);
    }
    ctx.lineJoin = 'bevel';
    ctx.strokeStyle = '#d4b977';
    ctx.lineWidth = 8;
    for (const x of [113, 147]) {
      ctx.beginPath();
      ctx.moveTo(x, 72);
      ctx.lineTo(x + 50, height / 2);
      ctx.lineTo(x, height - 72);
      ctx.stroke();
    }
    grain(ctx, width, randomSource(711), '#e0d4a3', '#273d3c');
  }, true);
}

export function makeShrineInlay() {
  return paintTexture(512, 512, (ctx, size) => {
    ctx.translate(size / 2, size / 2);
    ctx.fillStyle = 'rgba(53,78,63,0.70)';
    ctx.beginPath();
    ctx.arc(0, 0, 248, 0, 2 * Math.PI);
    ctx.fill();
    for (const [r, width, color] of [[237, 14, '#adb18c'], [219, 3, '#dbd9ae'], [91, 4, '#a0b39a']]) {
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, 2 * Math.PI);
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.stroke();
    }
    for (let i = 0; i < 8; i++) {
      ctx.save();
      ctx.rotate(i * Math.PI / 4);
      ctx.beginPath();
      ctx.moveTo(0, -25);
      ctx.bezierCurveTo(-36, -68, -32, -122, 0, -169);
      ctx.bezierCurveTo(28, -117, 37, -71, 0, -25);
      ctx.fillStyle = i % 2 ? '#92b49d' : '#b2c6a1';
      ctx.fill();
      ctx.strokeStyle = '#4d725e';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, -34);
      ctx.quadraticCurveTo(-8, -93, 0, -148);
      ctx.stroke();
      ctx.fillStyle = '#d8c99e';
      ctx.fillRect(-3, -215, 6, i % 2 ? 12 : 22);
      ctx.restore();
    }
    ctx.fillStyle = '#dacb9e';
    ctx.beginPath();
    ctx.arc(0, 0, 14, 0, 2 * Math.PI);
    ctx.fill();
  });
}

export function makeArenaWall(theme) {
  const { props, cliff: [light, dark] } = theme;
  return paintTexture(512, 512, (ctx, size) => {
    const rand = randomSource(391);
    const wash = ctx.createLinearGradient(0, 0, 0, size);
    wash.addColorStop(0, light);
    wash.addColorStop(0.5, dark);
    wash.addColorStop(1, light);
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, size, size);
    if (props === 'harbor') {
      boards(ctx, size, rand, [light, dark, '#ad8261', '#6e4e3c'], size / 8);
    } else if (props === 'astral' || props === 'courier') {
      const airship = props === 'courier';
      const step = size / (airship ? 4 : 8);
      for (let x = 0; x < size; x += step) {
        ctx.fillStyle = dark;
        ctx.fillRect(x, 0, 4, size);
        ctx.fillStyle = airship ? '#937151' : '#61748c';
        ctx.globalAlpha = 0.65;
        ctx.fillRect(x + 4, 0, 2, size);
        for (let y = 22; y < size; y += 48) ctx.fillRect(x + 9, y, 3, 3);
        ctx.globalAlpha = 1;
      }
    } else if (props === 'lava') {
      const masonry = ['#695b58', '#342d33', '#8e7f74', '#55494a'];
      paving(ctx, size, rand, masonry, 'lava');
      patches(ctx, size, rand, '64,48,51', 28, 42, 0.22);
    } else if (props === 'snow') {
      ctx.strokeStyle = '#bed5df';
      for (let i = 0; i < 29; i++) {
        const y = rand() * size;
        const slope = (rand() - 0.5) * 28;
        ctx.globalAlpha = 0.12 + rand() * 0.4;
        ctx.lineWidth = 1 + rand() * 8;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.bezierCurveTo(size / 3, y + slope, 2 * size / 3, y - slope, size, y);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    } else {
      paving(ctx, size, rand, [light, dark, light, theme.under], props);
    }
    grain(ctx, size, rand, light, dark);
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
