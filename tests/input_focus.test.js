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

  let nextTimeoutId = 1;
  const timeouts = new Map();
  function fakeSetTimeout(fn, delay = 0) {
    const id = nextTimeoutId++;
    timeouts.set(id, { fn, at: now + delay });
    return id;
  }
  function fakeClearTimeout(id) {
    timeouts.delete(id);
  }
  function flushTimeouts() {
    while (true) {
      let earliest = null;
      for (const [id, entry] of timeouts.entries()) {
        if (entry.at <= now && (!earliest || entry.at < earliest.entry.at)) {
          earliest = { id, entry };
        }
      }
      if (!earliest) break;
      timeouts.delete(earliest.id);
      earliest.entry.fn();
    }
  }

  vm.runInNewContext(clientSource, {
    window, document, WebSocket,
    location: { protocol: 'http:', host: 'localhost', search: '' },
    performance: { now: () => now },
    setInterval: callback => timers.push(callback),
    setTimeout: fakeSetTimeout,
    clearTimeout: fakeClearTimeout,
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
    advance: ms => { now += ms; flushTimeouts(); },
    tick() { timers.forEach(callback => callback()); },
    input: () => packets.filter(packet => packet.type === 'input').at(-1)
  };
}

const neutralInput = {
  type: 'input', mx: 0, mz: 0, guard: false, jumpHeld: false, sprinting: false
};

test('losing focus immediately releases movement, guard, jump and sprint', async () => {
  const client = await createClient();
  for (const code of ['ArrowRight', 'ShiftLeft', 'Space', 'KeyK']) client.keyDown(code);
  client.advance(80);
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
  client.keyDown('KeyJ');
  client.blur();
  client.advance(100);
  client.focus();
  const start = client.packets.length;
  client.keyDown('ArrowRight');
  client.tick();
  assert.equal(client.input().mx, 1);
  assert.equal(client.input().sprinting, false);
  assert.equal(client.packets.slice(start).some(packet => packet.type === 'dash'), false);
  client.keyDown('KeyJ');
  client.keyUp('KeyJ');
  assert.equal(client.packets.at(-1).type, 'jump');
  client.keyDown('KeyL');
  client.advance(80);
  assert.deepEqual(client.packets.at(-1), { type: 'attack', phase: 'press', isDash: false });
  client.keyUp('KeyL');
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
  client.keyDown('KeyL');
  client.advance(80);
  assert.deepEqual(client.packets.at(-1), { type: 'attack', phase: 'press', isDash: true });
  client.keyUp('KeyL');
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
  client.keyDown('KeyL');
  client.advance(80);
  assert.deepEqual(client.packets.at(-1), { type: 'attack', phase: 'press', isDash: true });
  client.keyUp('KeyL');
  client.keyUp('ShiftLeft');
  client.tick();
  assert.equal(client.input().sprinting, false);
  client.keyDown('KeyL');
  client.advance(80);
  assert.deepEqual(client.packets.at(-1), { type: 'attack', phase: 'press', isDash: false });
  client.keyUp('KeyL');
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

test('D moves right while J jumps/glides, K guards, and L attacks or holds to charge/aim', async () => {
  const client = await createClient();
  client.keyDown('KeyD');
  client.tick();
  assert.equal(client.input().mx, 1);
  client.keyUp('KeyD');
  assert.equal(client.packets.some(p => p.type === 'attack'), false);

  // J tap jumps immediately on release, J hold sets jumpHeld for glide/fly
  client.keyDown('KeyJ');
  client.keyUp('KeyJ');
  assert.equal(client.packets.at(-1).type, 'jump');
  client.keyDown('KeyJ');
  client.advance(80);
  client.tick();
  assert.equal(client.input().jumpHeld, true);
  client.keyUp('KeyJ');

  // K holds guard
  client.keyDown('KeyK');
  client.advance(80);
  client.tick();
  assert.equal(client.input().guard, true);
  client.keyUp('KeyK');

  // L tap fires press+release immediately; L hold fires press then release on keyup
  const beforeAttack = client.packets.length;
  client.keyDown('KeyL');
  client.keyUp('KeyL');
  assert.deepEqual(client.packets.slice(beforeAttack).filter(p => p.type === 'attack').map(p => p.phase), ['press', 'release']);
  const beforeHold = client.packets.length;
  client.keyDown('KeyL');
  client.advance(80);
  assert.deepEqual(client.packets.slice(beforeHold).filter(p => p.type === 'attack').map(p => p.phase), ['press']);
  client.keyUp('KeyL');
  assert.deepEqual(client.packets.slice(beforeHold).filter(p => p.type === 'attack').map(p => p.phase), ['press', 'release']);
});

test('Lost Saga skill chords KL (weapon), JKL (armor), JL (helmet), JK (trinket) and glide+L jump attack work cleanly', async () => {
  const client = await createClient();
  const skillSlots = () => client.packets.filter(p => p.type === 'skill').map(p => p.slot);

  // KL -> weapon skill
  client.keyDown('KeyK');
  client.advance(20);
  client.keyDown('KeyL');
  client.advance(80);
  client.keyUp('KeyL');
  client.keyUp('KeyK');
  assert.deepEqual(skillSlots(), ['weapon']);

  // JKL -> armor skill (fires immediately on 3rd key!)
  client.keyDown('KeyJ');
  client.advance(15);
  client.keyDown('KeyK');
  client.advance(15);
  client.keyDown('KeyL');
  assert.deepEqual(skillSlots(), ['weapon', 'armor']);
  client.keyUp('KeyL');
  client.keyUp('KeyK');
  client.keyUp('KeyJ');

  // JL -> helmet skill
  client.keyDown('KeyJ');
  client.advance(20);
  client.keyDown('KeyL');
  client.keyUp('KeyL');
  client.keyUp('KeyJ');
  assert.deepEqual(skillSlots(), ['weapon', 'armor', 'helmet']);

  // JK -> trinket skill
  client.keyDown('KeyJ');
  client.advance(20);
  client.keyDown('KeyK');
  client.advance(80);
  client.keyUp('KeyK');
  client.keyUp('KeyJ');
  assert.deepEqual(skillSlots(), ['weapon', 'armor', 'helmet', 'trinket']);

  // Holding K (guarding) then tapping L casts weapon skill cleanly
  client.keyDown('KeyK');
  client.advance(200);
  client.keyDown('KeyL');
  client.advance(80);
  client.keyUp('KeyL');
  client.keyUp('KeyK');
  assert.deepEqual(skillSlots(), ['weapon', 'armor', 'helmet', 'trinket', 'weapon']);

  // Holding J (gliding) then tapping L performs a jump attack, NOT helmet skill
  const beforeGlideAttack = client.packets.length;
  client.keyDown('KeyJ');
  client.advance(200);
  client.keyDown('KeyL');
  client.keyUp('KeyL');
  client.keyUp('KeyJ');
  const glidePackets = client.packets.slice(beforeGlideAttack);
  assert.equal(glidePackets.some(p => p.type === 'skill'), false);
  assert.deepEqual(glidePackets.filter(p => p.type === 'attack').map(p => p.phase), ['press', 'release']);
});

test('focus loss cancels a held attack without firing it on keyup', async () => {
  const client = await createClient();
  client.keyDown('KeyL');
  client.advance(80);
  client.blur();
  client.keyUp('KeyL');
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
  client.keyDown('KeyL');
  client.advance(80);
  assert.deepEqual(client.packets.at(-1), { type: 'attack', phase: 'press', isDash: false });
  client.keyUp('KeyW');
  client.keyUp('KeyL');
});

test('holding Guard (K) plus a direction key performs a Roll/Dodge without triggering Dash', async () => {
  const client = await createClient();
  const start = client.packets.length;
  client.keyDown('KeyK');
  client.keyDown('KeyD');
  const sent = client.packets.slice(start);
  assert.equal(sent.some(p => p.type === 'dash'), false);
  const dodge = sent.find(p => p.type === 'dodge');
  assert.ok(dodge);
  assert.equal(dodge.dx, 1);
  assert.equal(dodge.dz, 0);
  client.keyUp('KeyD');
  client.keyUp('KeyK');
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
