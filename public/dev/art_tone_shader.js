// ============================================================================
// Lab-only tone shader & silhouette outline for /dev/art-tone-lab.html
// Reproduces the "ลดโทน 3D" (illustration + #40332c silhouette + head boost)
// formula from public/dev/knight-sprite-proof.html in live 3D WebGL without
// modifying any production game material or renderer code.
// ============================================================================
import * as THREE from 'three';

export const DEFAULT_TONE_PARAMS = {
  paletteMix: 0.73,
  lightDirX: -0.46,
  lightDirY: 0.61,
  lightDirZ: 0.64,
  lowMin: -0.22,
  lowMax: -0.08,
  highMin: 0.50,
  highMax: 0.62,
  contourMin: 0.81,
  contourMax: 0.98,
  contourStrength: 0.65,
  headBoost: 1.22,
  outlinePx: 1.0,
  outlineAlpha: 0.95,
  outlineColor: '#40332c'
};

/**
 * Creates a lab-only material switcher for a ChibiView instance.
 * Preserves original materials so A/B switching is instant and reversible.
 */
export function createToneMaterialSet(view, initialParams = DEFAULT_TONE_PARAMS) {
  const baseHeadScale = view.R?.head ? view.R.head.scale.x : 1;
  const records = [];
  const matCache = new Map();
  const createdMaterials = [];

  const uniforms = {
    uPaletteMix: { value: initialParams.paletteMix },
    uLightDir: { value: new THREE.Vector3(initialParams.lightDirX, initialParams.lightDirY, initialParams.lightDirZ) },
    uLowRange: { value: new THREE.Vector2(initialParams.lowMin, initialParams.lowMax) },
    uHighRange: { value: new THREE.Vector2(initialParams.highMin, initialParams.highMax) },
    uContourRange: { value: new THREE.Vector2(initialParams.contourMin, initialParams.contourMax) },
    uContourStrength: { value: initialParams.contourStrength }
  };

  function makeIllustrationMaterial(source) {
    if (matCache.has(source)) return matCache.get(source);
    const mat = new THREE.MeshLambertMaterial({
      map: source.map || null,
      color: source.color ? source.color.clone() : new THREE.Color('#ffffff'),
      vertexColors: !!source.vertexColors,
      side: source.side ?? THREE.FrontSide,
      transparent: !!source.transparent,
      opacity: source.opacity ?? 1,
      alphaTest: source.alphaTest ?? 0,
      toneMapped: false
    });
    mat.customProgramCacheKey = () => 'art-tone-lab-illustration-v1';
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uPaletteMix = uniforms.uPaletteMix;
      shader.uniforms.uLightDir = uniforms.uLightDir;
      shader.uniforms.uLowRange = uniforms.uLowRange;
      shader.uniforms.uHighRange = uniforms.uHighRange;
      shader.uniforms.uContourRange = uniforms.uContourRange;
      shader.uniforms.uContourStrength = uniforms.uContourStrength;

      shader.fragmentShader =
        `uniform float uPaletteMix;\n` +
        `uniform vec3 uLightDir;\n` +
        `uniform vec2 uLowRange;\n` +
        `uniform vec2 uHighRange;\n` +
        `uniform vec2 uContourRange;\n` +
        `uniform float uContourStrength;\n` +
        shader.fragmentShader.replace('#include <opaque_fragment>', `
          vec3 base = diffuseColor.rgb;
          float lightness = dot(base, vec3(0.22, 0.68, 0.10));
          float blue = smoothstep(0.035, 0.15, base.b - base.r);
          float warm = smoothstep(0.025, 0.13, base.r - base.b) * (1.0 - blue);
          float value = smoothstep(0.10, 0.41, lightness);
          vec3 steel = mix(vec3(0.24, 0.24, 0.25), vec3(0.69, 0.65, 0.57), value);
          vec3 tanCol = mix(vec3(0.22, 0.11, 0.07), vec3(0.77, 0.53, 0.33), value);
          vec3 cloth = mix(vec3(0.05, 0.086, 0.19), vec3(0.14, 0.27, 0.48), value);
          vec3 palette = mix(mix(steel, tanCol, warm), cloth, blue);
          palette = mix(base, palette, uPaletteMix);
          vec3 nrm = normalize(normal);
          float v = dot(nrm, normalize(uLightDir));
          float low = smoothstep(uLowRange.x, uLowRange.y, v);
          float high = smoothstep(uHighRange.x, uHighRange.y, v);
          vec3 paint = mix(vec3(0.64, 0.57, 0.56), vec3(1.08, 0.99, 0.90), low);
          paint = mix(paint, vec3(1.27, 1.19, 1.03), high);
          float ndv = abs(dot(nrm, normalize(vViewPosition)));
          float contour = smoothstep(uContourRange.x, uContourRange.y, 1.0 - ndv);
          outgoingLight = mix(palette * paint, palette * vec3(0.48, 0.40, 0.36), uContourStrength * contour);
          #include <opaque_fragment>
        `);
    };
    matCache.set(source, mat);
    createdMaterials.push(mat);
    return mat;
  }

  view.root.traverse((obj) => {
    if (!obj.isMesh || !obj.material) return;
    const origMat = obj.material;
    const mapped = Array.isArray(origMat) ? origMat : [origMat];
    const isBackSideOutline = mapped.every((m) => m.side === THREE.BackSide);
    const toneMat = isBackSideOutline
      ? origMat
      : (Array.isArray(origMat) ? mapped.map(makeIllustrationMaterial) : makeIllustrationMaterial(origMat));
    records.push({
      mesh: obj,
      origMat,
      origVisible: obj.visible,
      isBackSideOutline,
      toneMat
    });
  });

  function syncUniforms(params) {
    uniforms.uPaletteMix.value = params.paletteMix;
    uniforms.uLightDir.value.set(params.lightDirX, params.lightDirY, params.lightDirZ);
    uniforms.uLowRange.value.set(params.lowMin, params.lowMax);
    uniforms.uHighRange.value.set(params.highMin, params.highMax);
    uniforms.uContourRange.value.set(params.contourMin, params.contourMax);
    uniforms.uContourStrength.value = params.contourStrength;
  }

  function applyOriginal() {
    for (const r of records) {
      r.mesh.material = r.origMat;
      r.mesh.visible = r.origVisible;
    }
    if (view.R?.head) {
      view.R.head.scale.setScalar(baseHeadScale);
    }
    view.root.updateMatrixWorld(true);
  }

  function applyTone(params) {
    syncUniforms(params);
    for (const r of records) {
      if (r.isBackSideOutline) {
        r.mesh.visible = false;
      } else {
        r.mesh.material = r.toneMat;
        r.mesh.visible = r.origVisible;
      }
    }
    if (view.R?.head) {
      view.R.head.scale.setScalar(baseHeadScale * params.headBoost);
    }
    view.root.updateMatrixWorld(true);
  }

  function dispose() {
    applyOriginal();
    for (const m of createdMaterials) m.dispose();
    createdMaterials.length = 0;
    matCache.clear();
  }

  return { baseHeadScale, syncUniforms, applyOriginal, applyTone, dispose };
}

/**
 * Renders the 2D outer silhouette matte (#40332c, matching snapshot() in
 * knight-sprite-proof.html) around the Knight in live 3D WebGL.
 */
export class ToneOutlinePass {
  constructor() {
    this.maskRT = new THREE.WebGLRenderTarget(1, 1, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: true,
      stencilBuffer: false
    });
    this.depthOnlyMat = new THREE.MeshBasicMaterial({
      colorWrite: false,
      depthWrite: true
    });
    this.maskWhiteMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      side: THREE.DoubleSide
    });
    this.outlineMat = new THREE.ShaderMaterial({
      transparent: true,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
      uniforms: {
        tMask: { value: this.maskRT.texture },
        uTexel: { value: new THREE.Vector2(1, 1) },
        uRadius: { value: 1.0 },
        uColor: { value: new THREE.Color('#40332c') },
        uAlpha: { value: 0.95 }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D tMask;
        uniform vec2 uTexel;
        uniform float uRadius;
        uniform vec3 uColor;
        uniform float uAlpha;
        varying vec2 vUv;
        void main() {
          float center = texture2D(tMask, vUv).a;
          if (center > 0.5) discard;
          vec2 stepPx = uTexel * uRadius;
          float n = 0.0;
          n = max(n, texture2D(tMask, vUv + vec2( stepPx.x, 0.0)).a);
          n = max(n, texture2D(tMask, vUv + vec2(-stepPx.x, 0.0)).a);
          n = max(n, texture2D(tMask, vUv + vec2(0.0,  stepPx.y)).a);
          n = max(n, texture2D(tMask, vUv + vec2(0.0, -stepPx.y)).a);
          vec2 diag = stepPx * 0.7071;
          n = max(n, texture2D(tMask, vUv + vec2( diag.x,  diag.y)).a);
          n = max(n, texture2D(tMask, vUv + vec2(-diag.x,  diag.y)).a);
          n = max(n, texture2D(tMask, vUv + vec2( diag.x, -diag.y)).a);
          n = max(n, texture2D(tMask, vUv + vec2(-diag.x, -diag.y)).a);
          float edge = clamp((n - center) * 1.15, 0.0, 1.0) * uAlpha;
          if (edge < 0.02) discard;
          gl_FragColor = vec4(uColor, edge);
          #include <colorspace_fragment>
        }
      `
    });
    this.quadGeo = new THREE.PlaneGeometry(2, 2);
    this.outlineScene = new THREE.Scene();
    this.outlineScene.add(new THREE.Mesh(this.quadGeo, this.outlineMat));
    this.outlineCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  }

  ensureSize(w, h) {
    if (this.maskRT.width !== w || this.maskRT.height !== h) {
      this.maskRT.setSize(w, h);
    }
  }

  render(renderer, scene, camera, { stageGroup, knightRoot, hiddenDuringMask = [], vx, vy, vw, vh, dpr, params }) {
    if (params.outlinePx <= 0.01 || params.outlineAlpha <= 0.01) return;
    const rtW = Math.max(1, Math.round(vw * dpr));
    const rtH = Math.max(1, Math.round(vh * dpr));
    this.ensureSize(rtW, rtH);

    const prevBg = scene.background;
    const prevFog = scene.fog;
    const prevOverride = scene.overrideMaterial;
    const prevAutoClear = renderer.autoClear;
    const prevScissorTest = renderer.getScissorTest();
    const prevStageVis = stageGroup ? stageGroup.visible : true;
    const prevKnightVis = knightRoot.visible;
    const prevHiddenVis = hiddenDuringMask.map((o) => (o ? o.visible : false));

    scene.background = null;
    scene.fog = null;

    // 1. Render stage depth into maskRT so obscured character parts do not emit outlines.
    renderer.setRenderTarget(this.maskRT);
    renderer.setScissorTest(false);
    renderer.setClearColor(0x000000, 0);
    renderer.clear(true, true, false);
    renderer.autoClear = false;

    for (const o of hiddenDuringMask) if (o) o.visible = false;
    knightRoot.visible = false;
    if (stageGroup) stageGroup.visible = true;
    scene.overrideMaterial = this.depthOnlyMat;
    renderer.render(scene, camera);

    // 2. Render Knight silhouette white mask into maskRT against stage depth.
    if (stageGroup) stageGroup.visible = false;
    knightRoot.visible = true;
    scene.overrideMaterial = this.maskWhiteMat;
    renderer.render(scene, camera);

    // Restore scene state before compositing onto the main framebuffer.
    scene.overrideMaterial = prevOverride;
    scene.background = prevBg;
    scene.fog = prevFog;
    if (stageGroup) stageGroup.visible = prevStageVis;
    knightRoot.visible = prevKnightVis;
    for (let i = 0; i < hiddenDuringMask.length; i++) {
      if (hiddenDuringMask[i]) hiddenDuringMask[i].visible = prevHiddenVis[i];
    }

    // 3. Composite warm #40332c silhouette rim onto the active screen viewport.
    renderer.setRenderTarget(null);
    renderer.setViewport(vx, vy, vw, vh);
    renderer.setScissorTest(true);
    renderer.setScissor(vx, vy, vw, vh);
    this.outlineMat.uniforms.uTexel.value.set(1 / rtW, 1 / rtH);
    this.outlineMat.uniforms.uRadius.value = params.outlinePx * dpr;
    this.outlineMat.uniforms.uColor.value.set(params.outlineColor);
    this.outlineMat.uniforms.uAlpha.value = params.outlineAlpha;
    renderer.render(this.outlineScene, this.outlineCamera);

    renderer.autoClear = prevAutoClear;
    renderer.setScissorTest(prevScissorTest);
  }

  dispose() {
    this.maskRT.dispose();
    this.depthOnlyMat.dispose();
    this.maskWhiteMat.dispose();
    this.outlineMat.dispose();
    this.quadGeo.dispose();
  }
}
