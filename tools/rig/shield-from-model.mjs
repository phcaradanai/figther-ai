// Prints the wrist rotation that holds the Knight's shield at the angle the Mixamo
// model holds its own (see shieldHold in bake-mixamo.mjs). Usage:
//   node tools/rig/shield-from-model.mjs <model.glb> [shield mesh name]
// The model file is a Mixamo character with its sword and shield, converted by
// Blender with skins kept. Keep it out of the repo; only the printed constant is stored.
import { readFile } from 'node:fs/promises';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { shieldHold } from './bake-mixamo.mjs';

const [file, meshName = 'Paladin_J_Nordstrom_Helmet'] = process.argv.slice(2);
const bytes = await readFile(file);
const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
const clip = gltf.animations.find(a => a.duration > 0.05);
for (const upSign of [1, -1]) {
  // The scene is posed by the first call, so reload for the second.
  const again = upSign === 1 ? gltf : await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  const { wrist, normal, crest, extents } = shieldHold(again.scene, clip, meshName, upSign);
  console.log(`crest ${upSign > 0 ? '+' : '-'} long axis: wrist [${wrist.toArray().map(x => x.toFixed(4)).join(', ')}]`,
    'face(world)', normal.toArray().map(x => x.toFixed(2)).join(','), 'crest(world)', crest.toArray().map(x => x.toFixed(2)).join(','),
    'extents', extents.map(x => x.toFixed(3)).join(' x '));
}
