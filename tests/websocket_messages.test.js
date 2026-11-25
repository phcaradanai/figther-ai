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
      async waitFor(predicate) {
        return new Promise((resolve, reject) => {
          const check = setInterval(() => {
            const found = messages.findLast(predicate);
            if (found) finish(null, found);
            else if (socket.readyState === WebSocket.CLOSED) finish(new Error(`Socket closed: ${stderr}`));
          }, 5);
          const timeout = setTimeout(() => finish(new Error(`Expected game message was not received: ${stderr}`)), 3000);
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
