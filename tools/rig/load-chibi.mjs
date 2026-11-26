import { readFile } from 'node:fs/promises';
import GAME_DATA from '../../public/js/shared_data.js';

export { GAME_DATA };

let views;

// Three.js can load the real meshes and skin weights in Node. Texture decoding
// is stubbed because the tests and motion capture only read transforms.
export function loadChibiViews() {
  views ??= importViews();
  return views;
}

async function importViews() {
  const origin = 'http://motion-fixture.test';
  const NativeRequest = Request;
  const nativeFetch = fetch;
  const globals = { Request, fetch, self: globalThis.self, createImageBitmap: globalThis.createImageBitmap,
    ProgressEvent: globalThis.ProgressEvent, location: globalThis.location };

  globalThis.Request = class extends NativeRequest {
    constructor(input, options) {
      super(typeof input === 'string' ? new URL(input, origin) : input, options);
    }
  };
  globalThis.fetch = async (request, options) => {
    const url = new URL(request instanceof NativeRequest ? request.url : request);
    if (url.protocol === 'blob:') return nativeFetch(request, options);
    if (url.origin !== origin || !url.pathname.startsWith('/assets/models/')) {
      throw new Error(`Unexpected motion fixture asset: ${url}`);
    }
    const bytes = await readFile(new URL('../../public' + url.pathname, import.meta.url));
    return new Response(bytes, { headers: { 'Content-Length': bytes.length } });
  };
  globalThis.self = globalThis;
  globalThis.ProgressEvent = Event;
  globalThis.createImageBitmap = async () => ({ width: 1, height: 1 });
  globalThis.window = { GAME_DATA };
  try {
    globalThis.location = new URL(origin);
    const { ChibiView } = await import('../../public/js/three/chibi.js');
    globalThis.location = new URL('/?skinned=0', origin);
    const { ChibiView: ProceduralView } = await import('../../public/js/three/chibi.js?procedural-fixture');
    return { ChibiView, ProceduralView };
  } finally {
    Object.assign(globalThis, globals);
  }
}
