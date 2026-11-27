// The Knight's body as a field of skinned surface points, to ask how deep a point is inside it.
// Used by the self-collision report and by the bake, which keeps the blade out of the body.
// The arm that holds the sword and the cape are left out of the field.
import { Vector3, Matrix3 } from 'three';

const CELL = 0.06;
const REACH = 0.14;
const SKIP = new Set(['armR', 'foreR', 'handR']);

export class BodyField {
  constructor(view) {
    this.view = view;
    const R = view.R;
    this.boneName = new Map(Object.entries(R).filter(([, v]) => v && v.isBone || (v && v.isObject3D)).map(([k, v]) => [v, k]));
    this.skinned = [];
    this.rigid = [];
    view.root.traverse(o => {
      if (!o.isMesh) return;
      if (o.isSkinnedMesh) { if (!/cape/i.test(o.name)) this.skinned.push(o); return; }
      for (let p = o.parent; p; p = p.parent) if (p === R.swordMount) return;
      this.rigid.push(o);
    });
    this.sword = [];
    R.swordMount.traverse(o => { if (o.isMesh) this.sword.push(o); });
    // Which rig joint a skinned vertex follows most.
    this.owner = this.skinned.map(mesh => {
      const { skinIndex, skinWeight } = mesh.geometry.attributes;
      const names = mesh.skeleton.bones.map(bone => this.boneName.get(bone) || bone.name);
      const out = new Array(skinIndex.count);
      for (let i = 0; i < skinIndex.count; i++) {
        let best = 0, bestW = -1;
        for (let c = 0; c < 4; c++) if (skinWeight.getComponent(i, c) > bestW) { bestW = skinWeight.getComponent(i, c); best = skinIndex.getComponent(i, c); }
        out[i] = names[best];
      }
      return out;
    });
  }

  // Skin everything for the current pose into points + normals and index them on a grid.
  build() {
    this.points = [];
    this.normals = [];
    this.names = [];
    const p = new Vector3();
    const normalMatrix = new Matrix3();
    this.skinned.forEach((mesh, m) => {
      mesh.skeleton.update();
      const position = mesh.geometry.attributes.position;
      const index = mesh.geometry.index;
      const world = new Float32Array(position.count * 3);
      for (let i = 0; i < position.count; i++) {
        mesh.getVertexPosition(i, p);
        mesh.localToWorld(p);
        world.set([p.x, p.y, p.z], i * 3);
      }
      const normal = new Float32Array(position.count * 3);
      const a = new Vector3(), b = new Vector3(), c = new Vector3(), n = new Vector3();
      const tri = index ? index.count / 3 : position.count / 3;
      for (let t = 0; t < tri; t++) {
        const [i0, i1, i2] = index ? [index.getX(t * 3), index.getX(t * 3 + 1), index.getX(t * 3 + 2)] : [t * 3, t * 3 + 1, t * 3 + 2];
        a.fromArray(world, i0 * 3); b.fromArray(world, i1 * 3); c.fromArray(world, i2 * 3);
        n.subVectors(b, a).cross(c.sub(a));
        for (const i of [i0, i1, i2]) { normal[i * 3] += n.x; normal[i * 3 + 1] += n.y; normal[i * 3 + 2] += n.z; }
      }
      for (let i = 0; i < position.count; i++) {
        if (SKIP.has(this.owner[m][i])) continue;
        n.fromArray(normal, i * 3);
        if (n.lengthSq() < 1e-12) continue;
        this.points.push(new Vector3().fromArray(world, i * 3));
        this.normals.push(n.clone().normalize());
        this.names.push(this.owner[m][i]);
      }
    });
    for (const mesh of this.rigid) {
      mesh.updateWorldMatrix(true, false);
      normalMatrix.getNormalMatrix(mesh.matrixWorld);
      const position = mesh.geometry.attributes.position;
      const normals = mesh.geometry.attributes.normal;
      if (!normals) continue;
      let owner = 'rigid';
      for (let q = mesh.parent; q; q = q.parent) {
        if (q === this.view.R.handL) { owner = 'shield'; break; }
        if (q === this.view.R.head) { owner = 'helmet'; break; }
      }
      for (let i = 0; i < position.count; i += 1) {
        this.points.push(p.fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld).clone());
        this.normals.push(new Vector3().fromBufferAttribute(normals, i).applyMatrix3(normalMatrix).normalize());
        this.names.push(owner);
      }
    }
    this.grid = new Map();
    this.points.forEach((q, i) => {
      const key = `${Math.floor(q.x / CELL)},${Math.floor(q.y / CELL)},${Math.floor(q.z / CELL)}`;
      if (!this.grid.has(key)) this.grid.set(key, []);
      this.grid.get(key).push(i);
    });
  }

  // How deep `q` is behind the nearest body surface (0 when outside), and which part.
  depth(q) {
    const cx = Math.floor(q.x / CELL), cy = Math.floor(q.y / CELL), cz = Math.floor(q.z / CELL);
    const span = Math.ceil(REACH / CELL);
    let best = Infinity, at = -1;
    for (let x = -span; x <= span; x++) for (let y = -span; y <= span; y++) for (let z = -span; z <= span; z++) {
      const cell = this.grid.get(`${cx + x},${cy + y},${cz + z}`);
      if (!cell) continue;
      for (const i of cell) {
        const d = q.distanceToSquared(this.points[i]);
        if (d < best) { best = d; at = i; }
      }
    }
    if (at < 0 || best > REACH * REACH) return { depth: 0, part: null };
    const behind = -(q.clone().sub(this.points[at]).dot(this.normals[at]));
    return { depth: Math.max(0, behind), part: this.names[at] };
  }

  // Sampled sword points in the current pose.
  swordPoints(stride = 4) {
    const out = [];
    const p = new Vector3();
    for (const mesh of this.sword) {
      mesh.updateWorldMatrix(true, false);
      const position = mesh.geometry.attributes.position;
      for (let i = 0; i < position.count; i += stride) out.push(p.fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld).clone());
    }
    return out;
  }

  // Deepest penetration of the sword in the pose now on the view.
  worst() {
    this.build();
    let top = { depth: 0, part: null };
    let inside = 0;
    for (const q of this.swordPoints()) {
      const hit = this.depth(q);
      if (hit.depth > 0.01) inside++;
      if (hit.depth > top.depth) top = hit;
    }
    return { ...top, inside };
  }
}

