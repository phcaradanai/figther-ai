const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');
const test = require('node:test');
const WebSocket = require('ws');
const { MAPS } = require('../public/js/shared_data.js');

async function startServer(t, testMaps = {}) {
  const serverPath = path.join(__dirname, '../server.js');
  const sharedDataPath = path.join(__dirname, '../public/js/shared_data.js');
  const child = spawn(process.execPath, ['-e', `
    Object.assign(require(${JSON.stringify(sharedDataPath)}).MAPS, ${JSON.stringify(testMaps)});
    const http = require('node:http');
    const createServer = http.createServer;
    http.createServer = function (...args) {
      const server = createServer.apply(this, args);
      server.once('listening', () => process.send({ port: server.address().port }));
      return server;
    };
    require(${JSON.stringify(serverPath)});
  `], {
    env: { ...process.env, PORT: '0' },
    stdio: ['ignore', 'ignore', 'pipe', 'ipc']
  });
  let stderr = '';
  child.stderr.on('data', chunk => { stderr += chunk.toString(); });
  const exited = new Promise(resolve => child.once('exit', resolve));
  t.after(async () => {
    if (child.exitCode === null && child.signalCode === null) child.kill();
    await exited;
  });
  const port = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Test server did not start')), 5000);
    child.once('message', message => { clearTimeout(timeout); resolve(message.port); });
    child.once('error', error => { clearTimeout(timeout); reject(error); });
    child.once('exit', code => { clearTimeout(timeout); reject(new Error(`Server exited ${code}: ${stderr}`)); });
  });

  async function connect() {
    const socket = new WebSocket(`ws://127.0.0.1:${port}`);
    const messages = [];
    socket.on('message', raw => messages.push(JSON.parse(raw)));
    socket.on('error', () => {});
    t.after(() => socket.terminate());
    await new Promise((resolve, reject) => {
      socket.once('open', resolve);
      socket.once('error', reject);
    });
    return {
      socket,
      messages,
      send: message => socket.send(JSON.stringify(message)),
      async waitFor(predicate, timeoutMs = 3000) {
        return new Promise((resolve, reject) => {
          const check = setInterval(() => {
            const found = messages.findLast(predicate);
            if (found) finish(null, found);
            else if (socket.readyState === WebSocket.CLOSED) finish(new Error(`Socket closed: ${stderr}`));
          }, 5);
          const timeout = setTimeout(() => finish(new Error(`Expected game message was not received: ${stderr}`)), timeoutMs);
          function finish(error, value) {
            clearInterval(check);
            clearTimeout(timeout);
            if (error) reject(error);
            else resolve(value);
          }
        });
      },
      async barrier() {
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => finish(new Error(`Server did not answer ping: ${stderr}`)), 3000);
          const closed = () => finish(new Error(`Server disconnected client: ${stderr}`));
          const pong = () => finish();
          function finish(error) {
            clearTimeout(timeout);
            socket.off('close', closed);
            socket.off('pong', pong);
            if (error) reject(error);
            else resolve();
          }
          socket.once('close', closed);
          socket.once('pong', pong);
          socket.ping();
        });
      }
    };
  }

  return {
    connect,
    assertRunning() {
      assert.equal(child.exitCode, null, stderr);
      assert.equal(child.signalCode, null, stderr);
    }
  };
}

async function join(client, name = 'Player A') {
  client.send({ type: 'join_room', roomId: 'MESSAGE-TEST', playerName: name, heroId: 'knight', mapId: 'sky_temple', mode: 'ffa', team: 0, changeMap: false });
  return client.waitFor(message => message.type === 'joined');
}

test('Cyborg flight spends half a gauge and can be transferred to a grounded hero', { timeout: 12000 }, async t => {
  const map = {
    ...MAPS.sky_temple,
    id: 'gear_transfer_test',
    spawns: [{ x: 0, z: 0 }, { x: 0.4, z: 0.4 }]
  };
  const server = await startServer(t, { [map.id]: map });
  const client = await server.connect();
  client.send({ type: 'join_room', roomId: 'GEAR-GAUGE', heroId: 'cyborg', mapId: map.id });
  const { clientId } = await client.waitFor(msg => msg.type === 'joined');
  const local = msg => msg.players.find(p => p.id === clientId);
  const ready = await client.waitFor(msg => msg.type === 'state' && local(msg).grounded);
  assert.equal(local(ready).skillGauges.trinket, 100);

  client.send({ type: 'drop_gear', slot: 'weapon' });
  client.send({ type: 'skill', slot: 'trinket' });
  const cast = await client.waitFor(msg => msg.type === 'state' && local(msg).animSkillId === 'cyborg_trinket');
  assert.equal(local(cast).gear.weapon, 'cyborg');
  assert.ok(local(cast).skillGauges.trinket >= 50 && local(cast).skillGauges.trinket < 60);
  assert.equal(cast.droppedGears.length, 0);

  await client.waitFor(msg => msg.type === 'state' && local(msg).animSkillId === 'cyborg_trinket' &&
    local(msg).skillGauges.trinket > 65);
  client.send({ type: 'skill', slot: 'trinket' });
  const second = await client.waitFor(msg => msg.type === 'state' && local(msg).skillGauges.trinket < 30);
  assert.ok(local(second).skillGauges.trinket > 0);

  client.send({ type: 'drop_gear', slot: 'trinket' });
  const detached = await client.waitFor(msg => msg.type === 'state' && local(msg).gear.trinket === null);
  assert.equal(detached.droppedGears[0].slot, 'trinket');
  assert.equal(local(detached).skillGauges.trinket, null);

  const knight = await server.connect();
  knight.send({ type: 'join_room', roomId: 'GEAR-GAUGE', heroId: 'knight' });
  const knightId = (await knight.waitFor(msg => msg.type === 'joined')).clientId;
  const recipient = msg => msg.players.find(p => p.id === knightId);
  await knight.waitFor(msg => msg.type === 'state' && recipient(msg).grounded &&
    msg.droppedGears.some(gear => gear.slot === 'trinket' && gear.y <= 0.25), 5500);
  knight.send({ type: 'pickup_gear' });
  const collected = await knight.waitFor(msg => msg.type === 'state' &&
    msg.fx.some(fx => fx.type === 'pickup') &&
    recipient(msg).gear.trinket === 'cyborg');
  assert.ok(recipient(collected).skillGauges.trinket > local(second).skillGauges.trinket);
  assert.ok(recipient(collected).skillGauges.trinket < 100);
  assert.equal(recipient(collected).gear.weapon, 'knight');

  await knight.waitFor(msg => msg.type === 'state' && recipient(msg).gear.trinket === 'cyborg' &&
    recipient(msg).skillGauges.trinket >= 50);
  knight.send({ type: 'skill', slot: 'trinket' });
  const hovering = await knight.waitFor(msg => msg.type === 'state' && recipient(msg).animSkillId === 'cyborg_trinket');
  assert.equal(recipient(hovering).isFlying, true);

  knight.send({ type: 'swap_hero', heroId: 'cyborg' });
  const swapped = await knight.waitFor(msg => msg.type === 'state' && recipient(msg).heroId === 'cyborg');
  const swapCharge = recipient(swapped).skillGauges.trinket;
  await knight.waitFor(msg => msg.type === 'state' && recipient(msg).heroId === 'cyborg' &&
    recipient(msg).skillGauges.trinket > swapCharge + 24);
  knight.send({ type: 'swap_hero', heroId: 'witch' });
  const changed = await knight.waitFor(msg => msg.type === 'state' && recipient(msg).heroId === 'witch');
  assert.equal(recipient(changed).gear.weapon, 'witch');
  assert.equal(recipient(changed).gear.trinket, 'cyborg');
});

test('Striker helmet grants a third jump and has no active cast', { timeout: 10000 }, async t => {
  const server = await startServer(t);
  const client = await server.connect();
  client.send({ type: 'join_room', roomId: 'GEAR-PASSIVE', heroId: 'striker' });
  const { clientId } = await client.waitFor(msg => msg.type === 'joined');
  const local = msg => msg.players.find(p => p.id === clientId);
  const ready = await client.waitFor(msg => msg.type === 'state' && local(msg).grounded);
  assert.equal(local(ready).skillGauges.helmet, null);

  client.send({ type: 'skill', slot: 'helmet' });
  for (const count of [1, 2, 3]) {
    client.send({ type: 'jump' });
    await client.waitFor(msg => msg.type === 'state' && local(msg).jumpCount === count);
  }
  assert.ok(!client.messages.some(msg => msg.type === 'state' && local(msg).animSkillId === 'striker_helmet'));
});

test('damage accelerates charge and a counter skill breaks an airborne knockdown', { timeout: 10000 }, async t => {
  const map = {
    ...MAPS.sky_temple,
    id: 'counter_test',
    spawns: [{ x: 0, z: 1.5 }, { x: 1.4, z: 1.5 }]
  };
  const server = await startServer(t, { [map.id]: map });
  const knight = await server.connect();
  const samurai = await server.connect();
  for (const [client, heroId] of [[knight, 'knight'], [samurai, 'samurai']]) {
    client.send({ type: 'join_room', roomId: 'GEAR-COUNTER', mapId: map.id, heroId });
    client.id = (await client.waitFor(msg => msg.type === 'joined')).clientId;
  }
  const fighter = (state, client) => state.players.find(p => p.id === client.id);
  await knight.waitFor(msg => msg.type === 'state' && msg.players.length === 2 &&
    msg.players.every(p => p.grounded && !p.buffs.invuln));

  knight.send({ type: 'skill', slot: 'armor' });
  const launched = await samurai.waitFor(msg => msg.type === 'state' && fighter(msg, samurai).state === 'knockdown');
  assert.equal(fighter(launched, samurai).grounded, false);
  const afterHit = fighter(launched, knight).skillGauges.armor;
  assert.ok(afterHit >= 6);

  samurai.send({ type: 'skill', slot: 'weapon' });
  samurai.send({ type: 'skill', slot: 'armor' });
  const countered = await samurai.waitFor(msg => msg.type === 'state' && fighter(msg, samurai).animSkillId === 'samurai_armor');
  assert.equal(fighter(countered, samurai).state, 'skill');
  assert.equal(fighter(countered, samurai).skillGauges.weapon, 100);
  assert.ok(fighter(countered, knight).skillGauges.armor >= afterHit + 3);
});

test('a melee attack turns toward the closest enemy in reach', { timeout: 10000 }, async t => {
  const map = {
    ...MAPS.sky_temple,
    id: 'melee_aim_test',
    spawns: [{ x: 0, z: 1.5 }, { x: -1.3, z: 1.5 }, { x: 4.5, z: 1.5 }]
  };
  const server = await startServer(t, { [map.id]: map });
  const attacker = await server.connect();
  const close = await server.connect();
  const distant = await server.connect();
  for (const client of [attacker, close, distant]) {
    client.send({ type: 'join_room', roomId: 'MELEE-AIM', mapId: map.id, heroId: 'reaper' });
    client.id = (await client.waitFor(msg => msg.type === 'joined')).clientId;
  }
  const ready = await attacker.waitFor(msg => msg.type === 'state' && msg.players.length === 3 &&
    msg.players.every(p => p.grounded && !p.buffs.invuln));
  assert.equal(ready.players.find(p => p.id === attacker.id).facing, 0);

  attacker.send({ type: 'attack', phase: 'press' });
  const hit = await attacker.waitFor(msg => msg.type === 'state' &&
    msg.players.some(p => p.id === close.id && p.hp < p.maxHp));
  assert.ok(Math.cos(hit.players.find(p => p.id === attacker.id).facing) < 0);
  assert.ok(hit.players.some(p => p.id === distant.id && p.hp === p.maxHp));
});

test('held ranged fire can switch enemies and homing gear only fires on confirmation', { timeout: 10000 }, async t => {
  const map = {
    ...MAPS.sky_temple,
    id: 'targeting_test',
    platforms: [{ x: -20, z: -20, w: 40, d: 40, y: 0, h: 4 }],
    jumpPads: [],
    spawns: [{ x: 0, z: 0 }, { x: 0, z: 1.1 }, { x: -4.1, z: -0.5 }, { x: 0, z: 6.5 }]
  };
  const server = await startServer(t, { [map.id]: map });
  const owner = await server.connect();
  const ally = await server.connect();
  const near = await server.connect();
  const far = await server.connect();

  for (const [client, heroId, team] of [[owner, 'cyborg', 1], [ally, 'knight', 1], [near, 'knight', 2], [far, 'knight', 2]]) {
    client.send({ type: 'join_room', roomId: 'TARGETING', mapId: map.id, mode: 'team', heroId, team });
    client.id = (await client.waitFor(message => message.type === 'joined')).clientId;
  }
  const local = state => state.players.find(p => p.id === owner.id);
  await owner.waitFor(msg => msg.type === 'state' && msg.players.length === 4 && msg.players.every(p => p.grounded && !p.buffs.invuln));

  owner.send({ type: 'attack', phase: 'press' });
  const aimed = await owner.waitFor(msg => msg.type === 'state' && local(msg).targeting?.mode === 'ranged');
  assert.equal(local(aimed).targeting.targetId, near.id);
  assert.equal(aimed.projectiles.length, 0);

  owner.send({ type: 'switch_target', dx: 0, dz: 1 });
  await owner.waitFor(msg => msg.type === 'state' && local(msg).targeting?.targetId === far.id);
  owner.send({ type: 'attack', phase: 'release' });
  const fired = await owner.waitFor(msg => msg.type === 'state' && msg.projectiles.some(pr => pr.type === 'plasma'));
  assert.equal(local(fired).targeting, null);
  const shot = fired.projectiles.find(pr => pr.type === 'plasma');
  assert.ok(shot.vz > 0);
  far.send({ type: 'input', mx: 1, mz: 0 });
  await owner.waitFor(msg => msg.type === 'state' && msg.projectiles.some(pr => pr.id === shot.id && pr.vx > shot.vx + 0.5));
  await owner.waitFor(msg => msg.type === 'state' && msg.players.some(p => p.id === far.id && p.hp < p.maxHp));
  far.send({ type: 'input', mx: 0, mz: 0 });

  owner.send({ type: 'skill', slot: 'helmet' });
  const preview = await owner.waitFor(msg => msg.type === 'state' && local(msg).targeting?.mode === 'skill');
  assert.equal(local(preview).cooldowns.helmet, 0);
  assert.equal(preview.projectiles.some(pr => pr.type === 'homing_missile'), false);

  owner.send({ type: 'skill', slot: 'helmet' });
  const cast = await owner.waitFor(msg => msg.type === 'state' && msg.projectiles.some(pr => pr.type === 'homing_missile'));
  assert.equal(local(cast).targeting, null);
  assert.ok(local(cast).cooldowns.helmet > 0);
});

test('Mix & Match equip_gear validates inputs, keeps weapon hero-locked, and transfers cloak mobility', { timeout: 10000 }, async t => {
  const server = await startServer(t);
  const client = await server.connect();
  client.send({ type: 'join_room', roomId: 'MIX-MATCH', heroId: 'knight', mapId: 'sky_temple' });
  const { clientId } = await client.waitFor(msg => msg.type === 'joined');
  const local = msg => msg.players.find(p => p.id === clientId);
  await client.waitFor(msg => msg.type === 'state' && local(msg).grounded);

  // Invalid slot, prototype hero names, or cross-hero weapon transfer must be ignored safely
  for (const bad of [
    { type: 'equip_gear', slot: 'boots', heroId: 'ninja' },
    { type: 'equip_gear', slot: 'helmet', heroId: '__proto__' },
    { type: 'equip_gear', slot: 'armor', heroId: ['witch'] },
    { type: 'equip_gear', slot: 'weapon', heroId: 'samurai' }
  ]) {
    client.send(bad);
    await client.barrier();
  }
  const unchanged = await client.waitFor(msg => msg.type === 'state' && local(msg).heroId === 'knight');
  assert.deepEqual(local(unchanged).gear, { weapon: 'knight', armor: 'knight', helmet: 'knight', trinket: 'knight' });

  // Equip Cyborg trinket (jetpack flight + glide) + Striker passive helmet on Knight
  client.send({ type: 'equip_gear', slot: 'trinket', heroId: 'cyborg' });
  client.send({ type: 'equip_gear', slot: 'helmet', heroId: 'striker' });
  const mixed = await client.waitFor(msg => msg.type === 'state' &&
    local(msg).gear.trinket === 'cyborg' &&
    local(msg).gear.helmet === 'striker');
  assert.equal(local(mixed).heroId, 'knight');
  assert.equal(local(mixed).gear.weapon, 'knight');
  assert.equal(local(mixed).skillGauges.helmet, null); // Striker helmet is passive
  assert.equal(local(mixed).skillGauges.trinket, 100);
  assert.equal(typeof local(mixed).swapCooldownMs, 'number');

  // Knight gains cloak-granted glide when holding Jump in mid-air
  client.send({ type: 'jump' });
  client.send({ type: 'input', jumpHeld: true });
  const gliding = await client.waitFor(msg => msg.type === 'state' && !local(msg).grounded && local(msg).isFlying === true);
  assert.equal(local(gliding).isFlying, true);
  client.send({ type: 'input', jumpHeld: false });

  // Mixed non-weapon gear persists when swapping heroes
  client.send({ type: 'swap_hero', heroId: 'mage' });
  const swapped = await client.waitFor(msg => msg.type === 'state' && local(msg).heroId === 'mage');
  assert.equal(local(swapped).gear.weapon, 'mage');
  assert.equal(local(swapped).gear.trinket, 'cyborg');
  assert.equal(local(swapped).gear.helmet, 'striker');
  assert.ok(local(swapped).swapCooldownMs > 0);
  server.assertRunning();
});

test('null, primitive, array and malformed JSON packets leave the server running', { timeout: 10000 }, async t => {
  const server = await startServer(t);
  const client = await server.connect();
  for (const raw of ['null', '[]', '"input"', '0', 'false', '{', '{}', '{"type":4}', '{"type":"unknown"}']) {
    client.socket.send(raw);
    await client.barrier();
  }
  const joined = await join(client);
  assert.equal(joined.heroId, 'knight');
  server.assertRunning();
});

test('invalid join fields are rejected before changing the existing room or player', { timeout: 10000 }, async t => {
  const server = await startServer(t);
  const client = await server.connect();
  const joined = await join(client);
  for (const fields of [
    { roomId: 42 }, { roomId: {} }, { playerName: {} }, { roomName: [] },
    { heroId: '__proto__' }, { heroId: ['ninja'] }, { mapId: 'constructor' },
    { mode: {} }, { team: {} }, { changeMap: 'yes' }
  ]) {
    client.send({ type: 'join_room', ...fields });
    await client.barrier();
  }
  const joins = client.messages.filter(message => message.type === 'joined').length;
  client.messages.length = 0;
  const state = await client.waitFor(message => message.type === 'state' && message.roomId === 'MESSAGE-TEST');
  assert.equal(joins, 1);
  assert.equal(state.players.find(player => player.id === joined.clientId).name, 'Player A');
  server.assertRunning();
});

test('invalid action fields and inherited hero or map names cannot mutate the arena', { timeout: 10000 }, async t => {
  const server = await startServer(t);
  const client = await server.connect();
  const joined = await join(client);
  for (const message of [
    { type: 'input', mx: { valueOf: null, toString: null } },
    { type: 'input', guard: 'yes' }, { type: 'input', jumpHeld: [] },
    { type: 'input', sprinting: {} }, { type: 'dash', dx: {}, dz: 1 },
    { type: 'attack', isDash: 'yes' }, { type: 'skill', slot: {} },
    { type: 'swap_hero', heroId: '__proto__' }, { type: 'swap_hero', heroId: ['ninja'] },
    { type: 'add_bot', heroId: 'constructor' }, { type: 'change_map', mapId: '__proto__' },
    { type: 'change_map', mapId: ['cyber_rooftop'] }
  ]) {
    client.send(message);
    await client.barrier();
  }
  client.messages.length = 0;
  const state = await client.waitFor(message => message.type === 'state');
  const player = state.players.find(player => player.id === joined.clientId);
  assert.equal(state.mapId, 'sky_temple');
  assert.equal(state.players.length, 1);
  assert.equal(player.heroId, 'knight');
  assert.equal(player.guarding, false);
  assert.equal(player.comboStep, 0);
  server.assertRunning();
});

test('overflowing numbers and numeric strings do not poison movement snapshots', { timeout: 10000 }, async t => {
  const server = await startServer(t);
  const client = await server.connect();
  const joined = await join(client);
  for (const raw of [
    '{"type":"input","facing":1e309}',
    '{"type":"input","mx":"Infinity"}',
    '{"type":"dash","dx":1e309,"dz":1}',
    '{"type":"input","mz":-1e309}'
  ]) {
    client.socket.send(raw);
    await client.barrier();
    client.messages.length = 0;
    const state = await client.waitFor(message => message.type === 'state');
    const player = state.players.find(player => player.id === joined.clientId);
    for (const key of ['x', 'y', 'z', 'vx', 'vy', 'vz', 'facing', 'hp']) {
      assert.equal(Number.isFinite(player[key]), true, `Non-finite ${key} after ${raw}`);
    }
    assert.equal(player.vx, 0);
    assert.equal(player.vz, 0);
    assert.equal(player.facing, 0);
    assert.equal(player.isDashing, false);
  }
  server.assertRunning();
});

test('an invalid UTF-8 WebSocket frame only disconnects its sender', { timeout: 10000 }, async t => {
  const server = await startServer(t);
  const healthy = await server.connect();
  await join(healthy);
  const invalid = await server.connect();
  const closed = new Promise(resolve => invalid.socket.once('close', resolve));
  invalid.socket.send(Buffer.from([0xff]), { binary: false });
  await closed;
  await healthy.barrier();
  healthy.messages.length = 0;
  await healthy.waitFor(message => message.type === 'state');
  server.assertRunning();
});

test('two normal clients can keep playing after malformed messages', { timeout: 10000 }, async t => {
  const server = await startServer(t);
  const first = await server.connect();
  const second = await server.connect();
  const joined = await join(first);
  await join(second, 'Player B');
  first.socket.send('null');
  await first.barrier();
  first.send({ type: 'input', mx: 1, mz: 0, facing: 0, guard: false, jumpHeld: false, sprinting: false });
  await second.waitFor(message => message.type === 'state' && message.players.some(player => player.id === joined.clientId && player.vx > 1));
  first.send({ type: 'input', mx: 0, mz: 0, guard: true, jumpHeld: false, sprinting: false });
  await second.waitFor(message => message.type === 'state' && message.players.some(player => player.id === joined.clientId && player.guarding));
  first.send({ type: 'attack', isDash: false });
  await second.waitFor(message => message.type === 'state' && message.players.some(player => player.id === joined.clientId && player.comboStep > 0));
  first.send({ type: 'skill', slot: 'weapon' });
  await second.waitFor(message => message.type === 'state' && message.players.some(player => player.id === joined.clientId && player.cooldowns.weapon > 0));
  first.send({ type: 'swap_hero', heroId: 'ninja' });
  await second.waitFor(message => message.type === 'state' && message.players.some(player => player.id === joined.clientId && player.heroId === 'ninja'));
  first.send({ type: 'input', mx: 1, mz: 0, facing: 0, guard: false, jumpHeld: false, sprinting: true });
  await second.waitFor(message => message.type === 'state' && message.players.some(player => player.id === joined.clientId && player.isSprinting && player.mobilityGauge < 100));
  first.send({ type: 'input', mx: 0, mz: 0, guard: false, jumpHeld: false, sprinting: false });
  first.send({ type: 'dash', dx: null, dz: null });
  await second.waitFor(message => message.type === 'state' && message.players.some(player => player.id === joined.clientId && player.isDashing));
  first.send({ type: 'add_bot', heroId: 'knight' });
  await second.waitFor(message => message.type === 'state' && message.players.some(player => player.isBot));
  first.send({ type: 'clear_bots' });
  second.messages.length = 0;
  await second.waitFor(message => message.type === 'state' && message.players.length === 2);
  first.send({ type: 'change_map', mapId: 'cyber_rooftop' });
  await second.waitFor(message => message.type === 'state' && message.mapId === 'cyber_rooftop');
  server.assertRunning();
});

test('every arena can be created and switched live with both LAN players landing safely', { timeout: 20000 }, async t => {
  const maps = Object.values(MAPS);
  assert.ok(maps.length >= 7, 'The lobby needs at least seven playable arenas');
  for (const map of maps) {
    const width = Math.max(...map.platforms.map(p => p.x + p.w)) - Math.min(...map.platforms.map(p => p.x));
    const depth = Math.max(...map.platforms.map(p => p.z + p.d)) - Math.min(...map.platforms.map(p => p.z));
    assert.ok(Math.max(width, depth) >= 32, `${map.id} needs a full-size arena footprint`);
  }
  const server = await startServer(t);
  const first = await server.connect();
  const second = await server.connect();
  const one = await join(first);
  const two = await join(second, 'Player B');
  const ids = [one.clientId, two.clientId];

  for (const [index, map] of maps.entries()) {
    const roomId = `ARENA-${index}`;
    first.messages.length = 0;
    first.send({ type: 'join_room', roomId, playerName: 'Player A', mapId: map.id });
    const created = await first.waitFor(message => message.type === 'joined' && message.roomId === roomId);
    assert.equal(created.mapId, map.id);
    first.send({ type: 'join_room', roomId: one.roomId, playerName: 'Player A' });
    await first.waitFor(message => message.type === 'joined' && message.roomId === one.roomId);

    second.messages.length = 0;
    if (index % 2 === 0) {
      first.send({ type: 'join_room', roomId: one.roomId, playerName: 'Player A', mapId: map.id, changeMap: true });
    } else {
      first.send({ type: 'change_map', mapId: map.id });
    }
    if (index > 0) {
      await second.waitFor(message => message.type === 'state' && message.mapId === map.id
        && message.players.some(player => player.id === two.clientId && player.y > 2.5));
    }
    const landed = await second.waitFor(message => message.type === 'state' && message.mapId === map.id
      && ids.every(id => message.players.some(player => player.id === id && player.grounded)));
    assert.ok(landed.players.every(player => map.platforms.some(platform =>
      player.y === platform.y && player.x >= platform.x && player.x <= platform.x + platform.w
      && player.z >= platform.z && player.z <= platform.z + platform.d
    )), `Players must land on the active arena's platforms in ${map.id}`);
  }
  server.assertRunning();
});

test('raised walls block walking, allow sliding and jumping, and leave level paths open', { timeout: 12000 }, async t => {
  const server = await startServer(t, {
    ledge: {
      id: 'ledge',
      voidY: -6.5,
      pillars: [],
      jumpPads: [],
      platforms: [
        { x: -6, z: -5, w: 11, d: 10, y: 0, h: 3 },
        { x: 5, z: -5, w: 4, d: 10, y: 0, h: 3 },
        { x: 0, z: -3, w: 3, d: 6, y: 1.3, h: 1.3 }
      ],
      spawns: [{ x: -2, z: 0 }]
    }
  });
  const client = await server.connect();
  client.send({ type: 'join_room', roomId: 'LEDGE', heroId: 'knight', mapId: 'ledge' });
  const { clientId } = await client.waitFor(message => message.type === 'joined');
  const player = message => message.players.find(p => p.id === clientId);
  const observe = predicate => client.waitFor(message => message.type === 'state' && predicate(player(message)));

  await observe(p => p.grounded);
  client.send({ type: 'input', mx: 1, mz: 0 });
  await observe(p => p.x >= -0.6);
  await new Promise(resolve => setTimeout(resolve, 230));
  const blocked = player(client.messages.findLast(message => message.type === 'state'));
  assert.ok(blocked.x < 0 && blocked.x >= -0.6, `Player walked through the wall to x=${blocked.x}`);
  assert.equal(blocked.y, 0);

  client.send({ type: 'input', mx: 1, mz: 0.65 });
  const slid = await observe(p => p.z > blocked.z + 0.45);
  assert.ok(player(slid).x < 0, 'Sliding along the wall must not cross it');
  client.send({ type: 'input', mx: 1, mz: 0 });
  client.send({ type: 'jump' });
  await observe(p => p.grounded && p.y === 1.3 && p.x > 0);
  await observe(p => p.grounded && p.y === 0 && p.x > 3);
  await observe(p => p.grounded && p.y === 0 && p.x > 5.5);
  server.assertRunning();
});

// Use the shipped arenas and the normal LAN inputs. Only the spawn locations
// are moved so each test starts beside the feature it exercises.
async function arenaClients(t, mapId, spawns, heroId = 'knight') {
  const server = await startServer(t, { [mapId]: { ...MAPS[mapId], spawns } });
  const clients = [];
  for (const _spawn of spawns) {
    const client = await server.connect();
    client.send({ type: 'join_room', roomId: 'TERRAIN', heroId, mapId });
    const { clientId } = await client.waitFor(m => m.type === 'joined');
    client.player = state => state.players.find(p => p.id === clientId);
    client.observe = (predicate, timeout) => client.waitFor(m => m.type === 'state' && predicate(client.player(m), m), timeout);
    clients.push(client);
  }
  return clients;
}

test('the loading belt carries an idle fighter into the sea while the pier beside it stays still', async t => {
  const [rider, walker] = await arenaClients(t, 'tideglass_harbor', [{ x: 32.5, z: 16 }, { x: 32.5, z: 21 }]);
  const start = walker.player(await walker.observe(p => p.grounded));
  await rider.observe(p => p.grounded && p.x > 34.5);
  const fall = await rider.observe(p => p.deaths === 1);
  assert.ok(fall.killFeed.some(entry => entry.isRingOut));
  assert.equal(walker.player(fall).x, start.x);
  assert.equal(walker.player(fall).deaths, 0);
});

test('the harbor center piers join on foot while the outlying pier has a jump gap', { timeout: 11000 }, async t => {
  const [walker, jumper] = await arenaClients(t, 'tideglass_harbor', [{ x: 7, z: -10.8 }, { x: 25, z: 3.5 }]);
  await Promise.all([walker.observe(p => p.grounded), jumper.observe(p => p.grounded)]);
  walker.send({ type: 'input', mz: 1 });
  jumper.send({ type: 'input', mz: 1 });
  await jumper.observe(p => p.z > 5 && p.z < 6 && p.grounded);
  jumper.send({ type: 'jump' });
  await jumper.observe(p => p.z > 8 && p.y === 0 && p.grounded && p.deaths === 0);
  jumper.send({ type: 'input', mz: 0 });
  await walker.observe(p => p.z > 10 && p.y === 0 && p.grounded && p.deaths === 0, 6500);
  const center = walker.messages.filter(m => m.type === 'state').map(walker.player)
    .filter(p => p && p.z > -8 && p.z < 7);
  assert.ok(center.length > 10);
  assert.ok(center.every(p => p.y === 0 && p.grounded));
});

test('releasing movement on the frozen crossing has a longer stopping distance than on the snow bypass', async t => {
  const [skater, walker] = await arenaClients(t, 'frostline_pass', [{ x: 8, z: -8 }, { x: -24, z: -8 }]);
  await skater.observe((p, m) => p.grounded && walker.player(m)?.grounded);
  for (const c of [skater, walker]) c.send({ type: 'input', mz: 1 });
  const moving = await skater.observe((p, m) => p.vz > 4 && walker.player(m).vz > 4);
  for (const c of [skater, walker]) c.send({ type: 'input', mz: 0 });
  skater.messages.length = 0;
  const stopped = await skater.observe((p, m) => Math.abs(p.vz) < 0.4 && Math.abs(walker.player(m).vz) < 0.4);
  const distance = c => c.player(stopped).z - c.player(moving).z;
  assert.ok(distance(skater) > distance(walker) + 1.2, 'Ice must preserve measurable momentum after release');
});

test('the west snow path bends around the chasm and the east ledges form three landable jumps', { timeout: 20000 }, async t => {
  const [walker, jumper] = await arenaClients(t, 'frostline_pass', [{ x: -24, z: -15.5 }, { x: 20.3, z: -15.5 }], 'ninja');
  await Promise.all([walker.observe(p => p.grounded), jumper.observe(p => p.grounded)]);
  for (const c of [walker, jumper]) c.send({ type: 'input', mz: 1 });
  await Promise.all([
    (async () => {
      await walker.observe(p => p.z > 8.6 && p.z < 10 && p.grounded, 6500);
      walker.send({ type: 'input', mx: 1 });
      await walker.observe(p => p.x > -17.8 && p.x < -16.6 && p.grounded);
      walker.send({ type: 'input', mz: 1 });
      await walker.observe(p => p.z > 13.5 && p.y === 0 && p.grounded && p.deaths === 0);
    })(),
    (async () => {
      for (const [edge, landing] of [[-12, -8], [-1, 2], [9, 12]]) {
        await jumper.observe(p => p.z > edge - 0.75 && p.z < edge && p.grounded);
        jumper.send({ type: 'jump' });
        await jumper.observe(p => p.z > landing && p.z < landing + 3.5 && p.y === 0 && p.grounded && p.deaths === 0);
      }
    })()
  ]);
});

test('the lava moat burns and launches once, allowing a recovery or a second-contact ring-out', async t => {
  const [escape, fall] = await arenaClients(t, 'lava_citadel', [{ x: -5.7, z: -11 }, { x: 0, z: 5.8 }]);
  const bounced = escape.player(await escape.observe(p => p.hp < p.maxHp && p.vy > 0));
  assert.equal(bounced.maxHp - bounced.hp, 18);
  escape.send({ type: 'input', mx: -1 });
  const landed = escape.player(await escape.observe(p => p.x < -7.5 && p.grounded));
  assert.equal(landed.deaths, 0);
  assert.equal(landed.hp, bounced.hp);
  assert.ok((await fall.observe(p => p.deaths === 1)).killFeed.some(entry => entry.isRingOut));
});

test('the expanded lava citadel has a walkable crossing and open bridge edges', { timeout: 14000 }, async t => {
  const [walker, fall] = await arenaClients(t, 'lava_citadel', [{ x: -19, z: 11 }, { x: 0, z: 11 }]);
  await walker.observe(p => p.grounded);
  await fall.observe(p => p.grounded);
  walker.send({ type: 'input', mx: 1 });
  fall.send({ type: 'input', mz: 1 });
  await fall.observe(p => p.z > 14 && p.y < 0);
  await walker.observe(p => p.x > 14 && p.grounded && p.hp === p.maxHp && p.deaths === 0, 10000);
  const crossing = walker.messages.filter(m => m.type === 'state').map(walker.player)
    .filter(p => p && p.x > -5 && p.x < 6);
  assert.ok(crossing.length > 10);
  assert.ok(crossing.every(p => p.grounded && p.y === 0), 'The bridge should join both banks at ground level');
});

test('both lava launch pads reach the raised island at regular movement speed', async t => {
  const [west, east] = await arenaClients(t, 'lava_citadel', [{ x: -13.5, z: -4 }, { x: 14.5, z: -4 }], 'mage');
  await Promise.all([west.observe(p => p.grounded), east.observe(p => p.grounded)]);
  west.send({ type: 'input', mx: 1 });
  east.send({ type: 'input', mx: -1 });
  for (const rider of [west, east]) {
    await rider.observe((p, m) => p.vy > 10 && m.fx.some(f => f.type === 'jumppad'), 3500);
    const landed = rider.player(await rider.observe(p => p.grounded && p.y === 1.2 && p.x > -3.5 && p.x < 4.5, 3500));
    rider.send({ type: 'input', mx: 0 });
    assert.equal(landed.hp, landed.maxHp);
    assert.equal(landed.deaths, 0);
  }
});

test('the airship stairs can be climbed on foot while the side of the forecastle blocks movement', async t => {
  const [climber, blocker] = await arenaClients(t, 'brasswind_courier', [{ x: 6.5, z: 0 }, { x: 24, z: 10 }]);
  await climber.observe((p, m) => p.grounded && blocker.player(m)?.grounded);
  climber.send({ type: 'input', mx: 1 });
  blocker.send({ type: 'input', mz: -1 });
  const top = await climber.observe(p => p.grounded && p.x > 19 && p.y === 1.6, 4500);
  assert.ok(blocker.player(top).z >= 7.3);
  assert.equal(blocker.player(top).y, 0);
  climber.send({ type: 'input', mx: -1 });
  await climber.observe(p => p.grounded && p.x < 7 && p.y === 0 && p.vx < 0, 4500);
});

test('a gunslinger on the forecastle can shoot a fighter on the lower deck', async t => {
  const [gunner, target] = await arenaClients(t, 'brasswind_courier', [{ x: 25, z: 5.7 }, { x: 25, z: 9 }]);
  gunner.send({ type: 'swap_hero', heroId: 'cowboy' });
  const ready = await gunner.observe((p, m) => p.heroId === 'cowboy' && p.y > 1 && p.grounded &&
    target.player(m)?.grounded && !target.player(m).buffs.invuln);
  const shooter = gunner.player(ready), opponent = target.player(ready);
  const facing = Math.atan2(opponent.z - shooter.z, opponent.x - shooter.x);
  gunner.send({ type: 'input', facing });
  await gunner.observe(p => Math.abs(p.facing - facing) < 0.01);
  gunner.send({ type: 'attack' });
  await target.observe(p => p.y === 0 && p.hp < p.maxHp);
});

test('the deck launch pad reaches the forecastle while both flanks stay walkable', { timeout: 12000 }, async t => {
  const [jumper, north, south] = await arenaClients(t, 'brasswind_courier',
    [{ x: 10, z: -5.8 }, { x: 8, z: -9.5 }, { x: 8, z: 9.5 }]);
  const crew = [jumper, north, south];
  await Promise.all(crew.map(c => c.observe(p => p.grounded)));
  for (const c of crew) c.send({ type: 'input', mx: 1 });
  await jumper.observe((p, m) => p.vy >= 15 && m.fx.some(f => f.type === 'jumppad'));
  await jumper.observe(p => p.x > 18 && p.y === 1.6 && p.grounded && p.deaths === 0, 4000);
  for (const c of [north, south]) {
    await c.observe(p => p.x > 27 && p.y === 0 && p.grounded && p.deaths === 0, 5500);
  }
});

test('an enemy contests the healing circle until they leave', { timeout: 12000 }, async t => {
  const [holder, challenger] = await arenaClients(t, 'mossgate_ruins', [{ x: -0.25, z: 0 }, { x: 0.5, z: 0 }]);
  const ready = await challenger.observe((p, m) => p.grounded && !holder.player(m)?.buffs.invuln && m.shrineState === 'contested');
  const facing = Math.atan2(holder.player(ready).z - challenger.player(ready).z, holder.player(ready).x - challenger.player(ready).x);
  challenger.send({ type: 'input', facing });
  await challenger.observe(p => Math.abs(p.facing - facing) < 0.01);
  challenger.send({ type: 'attack' });
  const hit = holder.player(await holder.observe(p => p.hp < p.maxHp));
  challenger.send({ type: 'input', mx: 1 });
  await challenger.observe(p => p.x > 3.25 && p.x < 3.6);
  challenger.send({ type: 'input', mx: 0 });
  await new Promise(resolve => setTimeout(resolve, 1300));
  const contested = holder.messages.findLast(m => m.type === 'state');
  const edge = challenger.player(contested);
  assert.ok(Math.hypot(edge.x, edge.z) > 3 && Math.hypot(edge.x, edge.z) < 4);
  assert.equal(contested.shrineState, 'contested');
  assert.equal(holder.player(contested).hp, hit.hp);
  challenger.socket.close();
  const healed = holder.player(await holder.observe((p, m) => m.shrineState === 'held' && p.hp > hit.hp));
  assert.ok(healed.hp <= healed.maxHp);
});

test('the ruins bypass can be climbed from both courts and walked down toward the east court', { timeout: 14000 }, async t => {
  const [west, east] = await arenaClients(t, 'mossgate_ruins', [{ x: -22, z: -21.3 }, { x: 16.4, z: -6 }]);
  await Promise.all([west.observe(p => p.grounded), east.observe(p => p.grounded)]);
  west.send({ type: 'input', mx: 1 });
  east.send({ type: 'input', mz: -1 });
  await east.observe(p => p.z < -17 && p.y === 1.35 && p.grounded, 4250);
  east.send({ type: 'input', mz: 1 });
  await east.observe(p => p.z > -7 && p.y === 0 && p.grounded && p.vz > 0, 5500);
  east.send({ type: 'input', mz: 0 });
  await west.observe(p => p.x > 10 && p.y === 1.35 && p.grounded && p.deaths === 0, 7500);
});

test('a melee bot crosses both offset bridges through the center rooftop', { timeout: 22000 }, async t => {
  const mapId = 'cyber_rooftop';
  const spawns = [{ x: 23, z: 7 }, { x: -21, z: 8.5 }];
  const server = await startServer(t, { [mapId]: { ...MAPS[mapId], spawns } });
  const client = await server.connect();
  client.send({ type: 'join_room', roomId: 'CROSSING', mapId });
  await client.waitFor(m => m.type === 'joined');
  client.send({ type: 'add_bot', heroId: 'knight' });
  await client.waitFor(m => m.type === 'state' && m.players.some(p => p.isBot && Math.abs(p.x) < 3 && p.grounded), 11500);
  const arrival = await client.waitFor(m => m.type === 'state' && m.players.some(p => p.isBot && p.x > 13 && p.grounded), 6000);
  assert.equal(arrival.players.find(p => p.isBot).deaths, 0);
});

test('both rooftop staircases can be climbed and the catwalk gap can be jumped', { timeout: 14000 }, async t => {
  const [west, east] = await arenaClients(t, 'cyber_rooftop', [{ x: -25, z: -14 }, { x: 24, z: -14 }]);
  await Promise.all([west.observe(p => p.grounded), east.observe(p => p.grounded)]);
  west.send({ type: 'input', mx: 1 });
  east.send({ type: 'input', mx: -1 });
  await east.observe(p => p.x < 15 && p.y === 1.4 && p.grounded, 4000);
  east.send({ type: 'input', mx: 0 });
  await west.observe(p => p.x >= -5.5 && p.x < -5 && p.y === 1.4 && p.grounded, 6000);
  west.send({ type: 'jump' });
  await west.observe(p => p.x > -2 && p.y === 1.4 && p.grounded && p.deaths === 0);
  west.send({ type: 'input', mx: 0 });
  east.send({ type: 'input', mx: 1 });
  await east.observe(p => p.x > 22.1 && p.y === 0 && p.grounded, 4500);
});

test('skill conditions enforce ground/air posture and startup i-frames dodge attacks', { timeout: 12000 }, async t => {
  const [caster, attacker] = await arenaClients(t, 'sky_temple', [{ x: 0, z: 0 }, { x: 1.0, z: 0 }], 'knight');
  await Promise.all([
    caster.observe(p => p.grounded && !p.buffs.invuln),
    attacker.observe(p => p.grounded && !p.buffs.invuln)
  ]);

  // Knight helmet (Lionheart Warcry) is ground-only: casting while airborne must not spend gauge
  caster.send({ type: 'jump' });
  await caster.observe(p => !p.grounded);
  caster.send({ type: 'skill', slot: 'helmet' });
  await caster.barrier();
  const airborne = caster.player(await caster.observe(p => !p.grounded));
  assert.equal(airborne.skillGauges.helmet, 100);
  assert.notEqual(airborne.animSkillId, 'knight_helmet');

  // Landing allows casting a skill, granting startup i-frames that dodge an attack
  caster.messages.length = 0;
  await caster.observe(p => p.grounded);
  caster.send({ type: 'swap_hero', heroId: 'samurai' });
  const ready = await caster.observe((p, m) => p.heroId === 'samurai' && p.grounded && attacker.player(m)?.grounded);
  const attState = attacker.player(ready);
  const casState = caster.player(ready);
  attacker.send({ type: 'input', facing: Math.atan2(casState.z - attState.z, casState.x - attState.x) });
  await attacker.barrier();

  caster.send({ type: 'skill', slot: 'helmet' });
  const casting = await caster.observe(p => p.animSkillId === 'samurai_helmet' && p.buffs.skillIframe);
  assert.ok(caster.player(casting).skillGauges.helmet < 100);
  assert.equal(caster.player(casting).buffs.invuln, true);

  caster.messages.length = 0;
  attacker.send({ type: 'attack', phase: 'press' });
  const dodged = await caster.observe((p, m) => m.fx.some(f => f.type === 'text' && f.text.includes('I-FRAME')));
  assert.equal(caster.player(dodged).hp, caster.player(dodged).maxHp);
});

test('hold-J melee charge triggers guard break and shatters a guarding opponent', { timeout: 12000 }, async t => {
  const [attacker, defender] = await arenaClients(t, 'sky_temple', [{ x: -0.6, z: 0 }, { x: 0.9, z: 0 }], 'knight');
  const ready = await attacker.observe((p, m) => p.grounded && !p.buffs.invuln &&
    defender.player(m)?.grounded && !defender.player(m).buffs.invuln);
  const att = attacker.player(ready);
  const def = defender.player(ready);

  defender.send({ type: 'input', facing: Math.atan2(att.z - def.z, att.x - def.x), guard: true });
  await defender.observe(p => p.guarding === true);
  // Let the 260ms Just Guard window expire so defender holds a normal Guard
  await new Promise(r => setTimeout(r, 300));

  attacker.send({ type: 'attack', phase: 'press' });
  await attacker.observe(p => p.charging === true);
  defender.messages.length = 0;
  attacker.send({ type: 'attack', phase: 'release' });

  const broken = await defender.observe((p, m) => m.fx.some(f => f.type === 'guard_break'));
  assert.equal(defender.player(broken).guarding, false);
  assert.ok(defender.player(broken).hp < defender.player(broken).maxHp);
});

test('guard roll grants invulnerability on agile heroes and ignores heavy tanks without cloak', { timeout: 10000 }, async t => {
  const [agile, tank] = await arenaClients(t, 'sky_temple', [{ x: -3, z: 0 }, { x: 3, z: 0 }], 'ninja');
  tank.send({ type: 'swap_hero', heroId: 'knight' });
  await Promise.all([
    agile.observe(p => p.grounded && !p.buffs.invuln),
    tank.observe(p => p.heroId === 'knight' && p.grounded && !p.buffs.invuln)
  ]);

  agile.send({ type: 'dodge', dx: 1, dz: 0 });
  const rolling = agile.player(await agile.observe(p => p.isRolling === true));
  assert.equal(rolling.buffs.invuln, true);
  assert.ok(rolling.mobilityGauge < 100);

  tank.send({ type: 'dodge', dx: 1, dz: 0 });
  await tank.barrier();
  const stillTank = tank.player(await tank.observe(p => p.heroId === 'knight'));
  assert.equal(stillTank.isRolling, false);
  assert.equal(stillTank.mobilityGauge, 100);

  // Equipping Ninja cloak grants Roll/Dodge to Knight
  tank.send({ type: 'equip_gear', slot: 'trinket', heroId: 'ninja' });
  await tank.observe(p => p.gear.trinket === 'ninja');
  tank.send({ type: 'dodge', dx: 1, dz: 0 });
  const tankRolled = tank.player(await tank.observe(p => p.isRolling === true));
  assert.equal(tankRolled.isRolling, true);
});

test('combo finisher knocks down, grounded knockdown blocks non-OTG hits, and Quick Wake-Up escapes', { timeout: 14000 }, async t => {
  const [attacker, defender] = await arenaClients(t, 'sky_temple', [{ x: -0.4, z: 0 }, { x: 0.4, z: 0 }], 'reaper');
  await Promise.all([
    attacker.observe(p => p.grounded && !p.buffs.invuln),
    defender.observe(p => p.grounded && !p.buffs.invuln)
  ]);

  // Close in until inside melee range between hits and land 3-hit basic combo finisher -> grounded knockdown
  for (let hit = 1; hit <= 3; hit++) {
    attacker.messages.length = 0;
    const snap = await attacker.observe(() => true);
    const att = attacker.player(snap);
    const def = defender.player(snap);
    const ang = Math.atan2(def.z - att.z, def.x - att.x);
    if (Math.hypot(def.x - att.x, def.z - att.z) > 1.8) {
      attacker.send({ type: 'input', mx: Math.cos(ang), mz: Math.sin(ang), facing: ang });
      attacker.messages.length = 0;
      await attacker.observe((p, m) => Math.hypot(p.x - defender.player(m).x, p.z - defender.player(m).z) <= 1.8);
      attacker.send({ type: 'input', mx: 0, mz: 0, facing: ang });
      await attacker.barrier();
    } else {
      attacker.send({ type: 'input', mx: 0, mz: 0, facing: ang });
    }
    attacker.send({ type: 'attack' });
    await attacker.observe(p => p.comboStep === hit);
    if (hit < 3) await new Promise(r => setTimeout(r, 290));
  }
  const kdState = await defender.observe(p => p.state === 'knockdown' && p.grounded);
  const kdHp = defender.player(kdState).hp;

  // Non-OTG basic attack against grounded knockdown deals 0 damage
  await new Promise(r => setTimeout(r, 290));
  attacker.send({ type: 'attack' });
  await attacker.barrier();
  defender.messages.length = 0;
  const afterNonOtg = defender.player(await defender.observe(p => p.state === 'knockdown'));
  assert.equal(afterNonOtg.hp, kdHp);

  // Heavy attack (Reaper Soul Hook has otg: true) chains after basic cooldown and hits OTG while grounded knockdown lasts!
  await new Promise(r => setTimeout(r, 290));
  defender.messages.length = 0;
  attacker.send({ type: 'heavy' });
  const otgHit = await defender.observe((p, m) => p.hp < kdHp && m.fx.some(f => f.type === 'hit' && f.text === 'OTG!'));
  assert.ok(defender.player(otgHit).hp < kdHp);

  // Quick Wake-Up buffered right before knockdown landing
  attacker.send({ type: 'swap_hero', heroId: 'viking' });
  await attacker.observe(p => p.heroId === 'viking');
  await defender.observe(p => p.state === 'idle' && p.grounded);
  attacker.messages.length = 0;
  const preSkill = await attacker.observe(() => true);
  const aPos = attacker.player(preSkill);
  const dPos = defender.player(preSkill);
  const sAng = Math.atan2(dPos.z - aPos.z, dPos.x - aPos.x);
  if (Math.hypot(dPos.x - aPos.x, dPos.z - aPos.z) > 4.0) {
    attacker.send({ type: 'input', mx: Math.cos(sAng), mz: Math.sin(sAng), facing: sAng });
    attacker.messages.length = 0;
    await attacker.observe((p, m) => Math.hypot(p.x - defender.player(m).x, p.z - defender.player(m).z) <= 3.0);
    attacker.send({ type: 'input', mx: 0, mz: 0, facing: sAng });
  } else {
    attacker.send({ type: 'input', facing: sAng });
  }
  await attacker.barrier();
  attacker.send({ type: 'skill', slot: 'weapon' });
  await defender.observe(p => p.state === 'knockdown' && !p.grounded && p.vy <= -4.5);
  defender.messages.length = 0;
  defender.send({ type: 'wakeup', dx: 1, dz: 0 });
  const woken = defender.player(await defender.observe((p, m) => m.fx.some(f => f.type === 'dash' && f.text === 'QUICK WAKE-UP!')));
  assert.notEqual(woken.state, 'knockdown');
  assert.equal(woken.buffs.invuln, true);
});

test('simultaneous melee swings clash with zero damage and Just Guard charges skill gauge', { timeout: 14000 }, async t => {
  const [p1, p2] = await arenaClients(t, 'sky_temple', [{ x: 0, z: 0 }, { x: 0.4, z: 0 }], 'samurai');
  const ready = await p1.observe((p, m) => p.grounded && !p.buffs.invuln &&
    p2.player(m)?.grounded && !p2.player(m).buffs.invuln);
  const a = p1.player(ready);
  const b = p2.player(ready);

  p1.send({ type: 'input', facing: Math.atan2(b.z - a.z, b.x - a.x) });
  p2.send({ type: 'input', facing: Math.atan2(a.z - b.z, a.x - b.x) });
  p1.messages.length = 0;
  p2.messages.length = 0;
  await Promise.all([p1.observe(() => true), p2.observe(() => true)]);

  p1.messages.length = 0;
  p1.send({ type: 'attack', phase: 'press' });
  p2.send({ type: 'attack', phase: 'press' });
  const clashed = await p1.observe((p, m) => m.fx.some(f => f.type === 'clash'));
  assert.equal(p1.player(clashed).hp, p1.player(clashed).maxHp);
  assert.equal(p2.player(clashed).hp, p2.player(clashed).maxHp);

  // Spend p2's helmet gauge first and wait for skill startup i-frames to finish before Just Guarding
  p1.messages.length = 0;
  p2.messages.length = 0;
  await Promise.all([
    p1.observe(p => p.state === 'idle' && p.grounded),
    p2.observe(p => p.state === 'idle' && p.grounded)
  ]);
  p2.send({ type: 'skill', slot: 'helmet' });
  await p2.observe(p => p.skillGauges.helmet < 50);
  p2.messages.length = 0;
  await p2.observe(p => p.state === 'idle' && !p.buffs.skillIframe);

  // Close the Clash knockback gap and let momentum settle before testing Just Guard
  p1.messages.length = 0;
  const sepSnap = await p1.observe(() => true);
  const w1 = p1.player(sepSnap);
  const w2 = p2.player(sepSnap);
  if (Math.hypot(w2.x - w1.x, w2.z - w1.z) > 1.6) {
    const walkAng = Math.atan2(w2.z - w1.z, w2.x - w1.x);
    p1.send({ type: 'input', mx: Math.cos(walkAng), mz: Math.sin(walkAng), facing: walkAng });
    p1.messages.length = 0;
    await p1.observe((p, m) => Math.hypot(p.x - p2.player(m).x, p.z - p2.player(m).z) <= 1.6);
    p1.send({ type: 'input', mx: 0, mz: 0, facing: walkAng });
    await new Promise(r => setTimeout(r, 120));
  }

  p2.messages.length = 0;
  const preSnap = await p2.observe(() => true);
  const s1 = p1.player(preSnap);
  const s2 = p2.player(preSnap);
  const preCharge = s2.skillGauges.helmet;
  p1.send({ type: 'input', facing: Math.atan2(s2.z - s1.z, s2.x - s1.x) });
  p2.send({ type: 'input', facing: Math.atan2(s1.z - s2.z, s1.x - s2.x), guard: true });
  p2.messages.length = 0;
  await p2.observe(p => p.guarding === true);
  p1.send({ type: 'attack', phase: 'press' });

  const parried = await p2.observe((p, m) => m.fx.some(f => f.type === 'parry' && f.text === 'JUST GUARD!'));
  assert.equal(p2.player(parried).hp, p2.player(parried).maxHp);
  assert.ok(p2.player(parried).skillGauges.helmet >= preCharge + 7);
});

test('hero swap cancels attack recovery and air heavy spikes airborne targets into ground bounce', { timeout: 14000 }, async t => {
  const [attacker, defender] = await arenaClients(t, 'sky_temple', [{ x: 0, z: 0 }, { x: 0.7, z: 0 }], 'samurai');
  await Promise.all([
    attacker.observe(p => p.grounded && !p.buffs.invuln),
    defender.observe(p => p.grounded && !p.buffs.invuln)
  ]);

  // Mid-attack Hero Swap Cancel resets attack cooldown immediately
  attacker.send({ type: 'attack', phase: 'press' });
  await attacker.observe(p => p.state === 'attack');
  attacker.send({ type: 'swap_hero', heroId: 'striker' });
  const swapped = await attacker.observe((p, m) => p.heroId === 'striker' && m.fx.some(f => f.type === 'hero_swap' && f.text === 'SWAP CANCEL!'));
  assert.equal(attacker.player(swapped).heroId, 'striker');

  // Striker trinket (Seismic Ground Stomp) launches defender high, then Striker jumps and Air Heavy spikes into Ground Bounce
  await defender.observe(p => p.grounded && p.state === 'idle');
  attacker.send({ type: 'skill', slot: 'trinket' });
  await defender.observe(p => !p.grounded && p.vy > 5);
  attacker.messages.length = 0;
  attacker.send({ type: 'jump' });
  await attacker.observe(p => !p.grounded);
  defender.messages.length = 0;
  attacker.send({ type: 'heavy' });

  await defender.observe((p, m) => m.fx.some(f => f.type === 'heavy_impact' && f.text === 'SPIKE!'));
  const bounced = await defender.observe((p, m) => m.fx.some(f => f.type === 'text' && f.text === 'GROUND BOUNCE!'));
  assert.ok(defender.player(bounced).vy > 4);
});
