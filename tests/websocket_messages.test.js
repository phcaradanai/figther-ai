const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');
const test = require('node:test');
const WebSocket = require('ws');

async function startServer(t) {
  const serverPath = path.join(__dirname, '../server.js');
  const child = spawn(process.execPath, ['-e', `
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
