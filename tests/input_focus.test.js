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
  assert.deepEqual(client.packets.at(-1), { type: 'attack', isDash: false });
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
  client.keyDown('ArrowRight');
  client.keyUp('ArrowRight');
  client.advance(100);
  client.keyDown('ArrowRight');
  assert.equal(client.packets.at(-1).type, 'dash');
  client.keyDown('KeyJ');
  assert.deepEqual(client.packets.at(-1), { type: 'attack', isDash: true });
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
  assert.deepEqual(client.packets.at(-1), { type: 'attack', isDash: true });
  client.keyUp('ShiftLeft');
  client.tick();
  assert.equal(client.input().sprinting, false);
  client.keyDown('KeyJ');
  assert.deepEqual(client.packets.at(-1), { type: 'attack', isDash: false });
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

test('D sends one attack press and release without moving right', async () => {
  const client = await createClient();
  client.keyDown('KeyD');
  client.keyDown('KeyD');
  client.tick();
  assert.equal(client.input().mx, 0);
  client.keyUp('KeyD');
  assert.deepEqual(client.packets.filter(p => p.type === 'attack').map(p => p.phase), ['press', 'release']);
});

test('focus loss cancels a held attack without firing it on keyup', async () => {
  const client = await createClient();
  client.keyDown('KeyD');
  client.blur();
  client.keyUp('KeyD');
  assert.deepEqual(client.packets.filter(p => p.type === 'attack').map(p => p.phase), ['press']);
  assert.ok(client.packets.some(p => p.type === 'cancel_targeting'));
});
