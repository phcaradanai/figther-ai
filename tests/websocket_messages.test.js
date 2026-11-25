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
