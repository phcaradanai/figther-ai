const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const GAME_DATA = require('../public/js/shared_data.js');

const clientSource = fs.readFileSync(path.join(__dirname, '../public/js/game_client.js'), 'utf8');

async function createClient() {
  const elements = new Map();
  const timers = [];
  const packets = [];
  let now = 1000;
  let socket;

  function element() {
    const target = new EventTarget();
    const classes = new Set(['hidden']);
    return Object.assign(target, {
      value: '',
      dataset: {},
      classList: {
        contains: name => classes.has(name),
        add: name => classes.add(name),
        remove: name => classes.delete(name),
        toggle: (name, enabled) => enabled ? classes.add(name) : classes.delete(name)
      },
      appendChild() {}
    });
  }

  const document = Object.assign(new EventTarget(), {
    hidden: false,
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, element());
      return elements.get(id);
    },
    createElement: element,
    querySelectorAll: () => []
  });
  const window = Object.assign(new EventTarget(), {
    GAME_DATA
  });
  class WebSocket extends EventTarget {
    constructor() {
      super();
      this.readyState = 1;
      socket = this;
    }
    send(raw) { packets.push(JSON.parse(raw)); }
  }

  vm.runInNewContext(clientSource, {
    window, document, WebSocket,
    location: { protocol: 'http:', host: 'localhost', search: '' },
    performance: { now: () => now },
    setInterval: callback => timers.push(callback),
    requestAnimationFrame() {}
  }, { filename: 'game_client.js' });
  window.startArenaGame({
    transformInputByCamera(mx, mz) { return { mx, mz }; }
  });

  function dispatch(target, type, properties = {}) {
    target.dispatchEvent(Object.assign(new Event(type, { cancelable: true }), properties));
  }

  return {
    packets,
    socket,
    keyDown: code => dispatch(window, 'keydown', { code }),
    keyUp: code => dispatch(window, 'keyup', { code }),
    rightClickSkill: slot => dispatch(document.getElementById(`skillBtn_${slot}`), 'contextmenu'),
    blur: () => dispatch(window, 'blur'),
    focus: () => dispatch(window, 'focus'),
    visibility(hidden) {
      document.hidden = hidden;
      dispatch(document, 'visibilitychange');
    },
    advance: ms => { now += ms; },
    tick() { timers.forEach(callback => callback()); },
    input: () => packets.filter(packet => packet.type === 'input').at(-1)
  };
}

const neutralInput = {
  type: 'input', mx: 0, mz: 0, guard: false, jumpHeld: false, sprinting: false
};

test('losing focus immediately releases movement, guard, jump and sprint', async () => {
  const client = await createClient();
  for (const code of ['ArrowRight', 'ShiftLeft', 'Space', 'KeyL']) client.keyDown(code);
  client.tick();
  assert.equal(client.input().mx, 1);
  assert.equal(client.input().guard, true);
  assert.equal(client.input().jumpHeld, true);
  assert.equal(client.input().sprinting, true);

  client.blur();
  assert.deepEqual(client.input(), neutralInput);
  client.tick();
  assert.deepEqual(client.input(), neutralInput);
});

test('hiding the tab releases inputs even without a blur event', async () => {
  const client = await createClient();
  client.keyDown('ArrowUp');
  client.tick();
  assert.equal(client.input().mz, -1);
  client.visibility(true);
  assert.deepEqual(client.input(), neutralInput);
});

test('returning to the game accepts fresh keys without a phantom double-tap dash', async () => {
  const client = await createClient();
  client.keyDown('ArrowRight');
  client.keyDown('Space');
  client.blur();
  client.advance(100);
  client.focus();
  const start = client.packets.length;
  client.keyDown('ArrowRight');
  client.tick();
  assert.equal(client.input().mx, 1);
  assert.equal(client.input().sprinting, false);
  assert.equal(client.packets.slice(start).some(packet => packet.type === 'dash'), false);
  client.keyDown('Space');
  assert.equal(client.packets.at(-1).type, 'jump');
  client.keyDown('KeyJ');
  assert.deepEqual(client.packets.at(-1), { type: 'attack', phase: 'press', isDash: false });
  client.keyUp('ArrowRight');
  client.tick();
  assert.equal(client.input().mx, 0);
});

test('focus loss forgets taps made before switching windows', async () => {
  const client = await createClient();
  client.keyDown('ArrowRight');
  client.keyUp('ArrowRight');
  client.blur();
  client.advance(100);
  client.focus();
  const start = client.packets.length;
  client.keyDown('ArrowRight');
  assert.equal(client.packets.slice(start).some(packet => packet.type === 'dash'), false);
});

test('normal double-tap dash still works after focus returns', async () => {
  const client = await createClient();
  client.blur();
  client.focus();
  client.keyDown('KeyD');
  client.keyUp('KeyD');
  client.advance(100);
  client.keyDown('KeyD');
  assert.equal(client.packets.at(-1).type, 'dash');
  client.keyDown('KeyJ');
  assert.deepEqual(client.packets.at(-1), { type: 'attack', phase: 'press', isDash: true });
});

test('holding Shift sprints without sending a dash', async () => {
  const client = await createClient();
  const start = client.packets.length;
  client.keyDown('ArrowRight');
  client.keyDown('ShiftLeft');
  client.tick();
  assert.equal(client.packets.slice(start).some(packet => packet.type === 'dash'), false);
  assert.equal(client.input().sprinting, true);
  assert.equal(client.input().guard, false);
  client.keyDown('KeyJ');
  assert.deepEqual(client.packets.at(-1), { type: 'attack', phase: 'press', isDash: true });
  client.keyUp('ShiftLeft');
  client.tick();
  assert.equal(client.input().sprinting, false);
  client.keyDown('KeyJ');
  assert.deepEqual(client.packets.at(-1), { type: 'attack', phase: 'press', isDash: false });
});

test('losing focus while disconnected clears inputs without sending to a closed socket', async () => {
  const client = await createClient();
  client.keyDown('KeyW');
  client.socket.readyState = 3;
  client.blur();
  assert.equal(client.packets.length, 0);
  client.socket.readyState = 1;
  client.tick();
  assert.deepEqual(client.input(), neutralInput);
});

test('a visible-tab event does not interrupt active movement', async () => {
  const client = await createClient();
  client.keyDown('ArrowRight');
  client.visibility(false);
  client.tick();
  assert.equal(client.input().mx, 1);
});

test('D moves right while J attacks and K performs a heavy attack', async () => {
  const client = await createClient();
  client.keyDown('KeyD');
  client.tick();
  assert.equal(client.input().mx, 1);
  client.keyUp('KeyD');
  assert.equal(client.packets.some(p => p.type === 'attack'), false);

  client.keyDown('KeyJ');
  client.keyUp('KeyJ');
  assert.deepEqual(client.packets.filter(p => p.type === 'attack').map(p => p.phase), ['press', 'release']);
  client.keyDown('KeyK');
  assert.equal(client.packets.at(-1).type, 'heavy');
});

test('focus loss cancels a held attack without firing it on keyup', async () => {
  const client = await createClient();
  client.keyDown('KeyJ');
  client.blur();
  client.keyUp('KeyJ');
  assert.deepEqual(client.packets.filter(p => p.type === 'attack').map(p => p.phase), ['press']);
  assert.ok(client.packets.some(p => p.type === 'cancel_targeting'));
});

test('existing skill hotkeys still cast and only transferable gear can be dropped from the HUD', async () => {
  const client = await createClient();
  for (const code of ['KeyQ', 'KeyE', 'KeyR', 'KeyF', 'KeyU', 'KeyI', 'KeyO', 'KeyP']) {
    client.keyDown(code);
    client.keyUp(code);
  }
  assert.deepEqual(client.packets.map(packet => packet.slot),
    ['weapon', 'armor', 'helmet', 'trinket', 'weapon', 'armor', 'helmet', 'trinket']);
  client.rightClickSkill('weapon');
  client.rightClickSkill('armor');
  assert.deepEqual(client.packets.slice(8), [{ type: 'drop_gear', slot: 'armor' }]);
});

test('modular window hotkeys toggle pop-ups without blocking combat keys or firing while typing', async () => {
  const client = await createClient();
  client.keyDown('KeyB');
  client.keyUp('KeyB');
  client.keyDown('KeyH');
  client.keyUp('KeyH');
  client.keyDown('KeyM');
  client.keyUp('KeyM');
  // Combat movement and attacks continue working while modular windows are open in HQ.
  client.keyDown('KeyW');
  client.tick();
  assert.equal(client.input().mz, -1);
  client.keyDown('KeyJ');
  assert.deepEqual(client.packets.at(-1), { type: 'attack', phase: 'press', isDash: false });
  client.keyUp('KeyW');
  client.keyUp('KeyJ');
});

test('holding Guard (L) plus a direction key performs a Roll/Dodge without triggering Dash', async () => {
  const client = await createClient();
  const start = client.packets.length;
  client.keyDown('KeyL');
  client.keyDown('KeyD');
  const sent = client.packets.slice(start);
  assert.equal(sent.some(p => p.type === 'dash'), false);
  const dodge = sent.find(p => p.type === 'dodge');
  assert.ok(dodge);
  assert.equal(dodge.dx, 1);
  assert.equal(dodge.dz, 0);
  client.keyUp('KeyD');
  client.keyUp('KeyL');
});

test('double-tap plus hold sustains sprint until movement stops or focus is lost', async () => {
  const client = await createClient();
  client.keyDown('KeyD');
  client.keyUp('KeyD');
  client.advance(100);
  client.keyDown('KeyD');
  client.tick();
  assert.equal(client.input().sprinting, true);
  assert.equal(client.input().mx, 1);
  client.keyUp('KeyD');
  client.tick();
  assert.equal(client.input().sprinting, false);
});

test('pressing a direction key during knockdown sends a Quick Wake-Up', async () => {
  const client = await createClient();
  const dispatchMsg = (payload) => client.socket.dispatchEvent(
    Object.assign(new Event('message'), { data: JSON.stringify(payload) })
  );
  dispatchMsg({ type: 'welcome', clientId: 'p1', rooms: [], lanAddresses: [] });
  dispatchMsg({
    type: 'state',
    roomId: 'LAN-1',
    mapId: 'sky_temple',
    mode: 'ffa',
    players: [{
      id: 'p1',
      name: 'Tester',
      heroId: 'knight',
      x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0,
      facing: 0, grounded: true, hp: 80, maxHp: 125,
      state: 'knockdown',
      gear: { weapon: 'knight', armor: 'knight', helmet: 'knight', trinket: 'knight' },
      skillGauges: { weapon: 100, armor: 100, helmet: 100, trinket: 100 },
      cooldowns: { weapon: 0, armor: 0, helmet: 0, trinket: 0 }
    }],
    projectiles: [],
    droppedGears: [],
    hazards: [],
    fx: [],
    killFeed: []
  });
  client.keyDown('KeyD');
  const wake = client.packets.find(p => p.type === 'wakeup');
  assert.ok(wake);
  assert.equal(wake.dx, 1);
  assert.equal(wake.dz, 0);
  client.keyUp('KeyD');
});
