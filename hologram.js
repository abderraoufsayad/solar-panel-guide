// Solar module build hologram: a self-contained WebGL component.
// Usage: mountHologram(element, { mode: "embed" | "full" })
// Needs an import map that resolves "three" and "three/addons/".
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { LineSegments2 } from "three/addons/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js";
import { Line2 } from "three/addons/lines/Line2.js";
import { LineGeometry } from "three/addons/lines/LineGeometry.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";

/* ------------------------------------------------------------------ */
/* Build stages                                                        */
/* s: target state [ex, cells, rib, flow, jb, front, fv, fin, sun, power]
   cam: [azimuth, polar, distance]                                     */
/* ------------------------------------------------------------------ */
const K = ["ex", "cells", "rib", "flow", "jb", "front", "fv", "fin", "sun", "power"];
const STAGES = [
  { t: "Exploded view", d: "Every layer of the 80 W module, pulled apart: front sheet, 36 silicon cells, backing panel, junction box and frame.",
    s: [1, 1, 1, 0, 1, 1, 1, 0, 0, 0], cam: [0.75, 1.02, 19.5], dur: 7.5 },
  { t: "Sort the cells", d: "Each cell is measured and binned within ±3% current. In a series string, the weakest cell sets the pace for all 36.",
    s: [1, 1, 0, 0, 0, 0, 0, 0, 0, 0], cam: [0.25, 0.72, 14], dur: 7, enter: { cells: 0 } },
  { t: "Tab the busbars", d: "180 tinned-copper ribbons are soldered along the front busbars in single, steady strokes at about 340 °C.",
    s: [1, 1, 1, 0, 0, 0, 0, 0, 0, 0], cam: [-0.35, 0.62, 13.5], dur: 7, enter: { rib: 0 } },
  { t: "String and bus", d: "Four rows of nine, wired front-to-back in a serpentine so both leads exit on one edge. 36 cells × 0.675 V ≈ 24 V open-circuit.",
    s: [1, 1, 1, 1, 0, 0, 0, 0, 0, 0], cam: [0.05, 0.42, 14], dur: 7 },
  { t: "Bypass diodes", d: "Two 15 A Schottky diodes in the junction box each guard 18 cells, so shading one half of the panel doesn't shut down the other.",
    s: [1, 1, 1, 1, 1, 0, 0, 0, 0, 0], cam: [2.7, 1.95, 13], dur: 7 },
  { t: "Encapsulate", d: "The front sheet seals down onto butyl-tape spacers, with desiccant in the border and neutral-cure silicone at every seam.",
    s: [0.32, 1, 1, 0, 1, 1, 0, 0, 0, 0], cam: [1.05, 1.22, 14], dur: 7 },
  { t: "Frame", d: "Mitred 25 mm aluminium angle slides over the sandwich, bedded in silicone and riveted at the corners.",
    s: [0, 1, 1, 0, 1, 1, 1, 1, 0, 0], cam: [-0.7, 0.98, 14.5], dur: 7 },
  { t: "Power on", d: "In full sun the hand-built module targets ≈ 80 W at 20 V, enough to charge a 12 V battery. The floating curve is what your I–V tracer should record.",
    s: [0, 1, 1, 1, 1, 1, 1, 1, 1, 1], cam: [0.3, 1.02, 19.5], dur: 10 }
];

/* ------------------------------------------------------------------ */
/* Component styles (injected once)                                    */
/* ------------------------------------------------------------------ */
const CSS = `
.holo{--h-bg:#020B12;--h-ink:#BDF4FF;--h-cyan:#46E8FF;--h-amber:#FFB35C;--h-dim:#5E8C99;--h-edge:#0E3140;--h-bar:#03121C;
  --h-display:"Archivo","Arial Narrow",Arial,sans-serif;--h-mono:"JetBrains Mono",Consolas,"Courier New",monospace;
  position:relative;display:grid;grid-template-rows:minmax(0,1fr) auto;background:var(--h-bg);color:var(--h-ink);overflow:hidden;font-family:var(--h-mono);color-scheme:dark}
.holo--full{height:100%}
.holo--embed{border:1px solid var(--h-edge);border-radius:8px;box-shadow:0 30px 60px -34px rgba(0,30,50,.75)}
.holo--embed .holo-stage{aspect-ratio:16/10}
@media (max-width:640px){.holo--embed .holo-stage{aspect-ratio:4/5}}
.holo .holo-stage{position:relative;min-height:0;background:radial-gradient(ellipse at 50% 64%,#07293B 0%,#020B12 70%)}
.holo canvas{position:absolute;inset:0;width:100%;height:100%;display:block;cursor:grab;outline:none}
.holo canvas:active{cursor:grabbing}
.holo .holo-stage::before{content:"";position:absolute;inset:0;pointer-events:none;z-index:2;background:repeating-linear-gradient(0deg,rgba(70,232,255,.04) 0 1px,transparent 1px 3px)}
.holo .holo-stage::after{content:"";position:absolute;inset:0;pointer-events:none;z-index:2;background:radial-gradient(ellipse at center,transparent 58%,rgba(0,0,0,.6))}
.holo .holo-hud{position:absolute;z-index:3;font-size:.66rem;letter-spacing:.16em;text-transform:uppercase;color:var(--h-cyan);text-shadow:0 0 8px rgba(70,232,255,.6);pointer-events:none;line-height:1.6}
.holo .holo-hud.tl{top:14px;left:18px}
.holo .holo-hud.tr{top:14px;right:18px;text-align:right}
.holo .holo-hud .dim{color:var(--h-dim)}
.holo .holo-corner{position:absolute;z-index:3;width:22px;height:22px;border:1px solid var(--h-cyan);opacity:.5;pointer-events:none}
.holo .holo-corner.a{top:8px;left:8px;border-right:0;border-bottom:0}.holo .holo-corner.b{top:8px;right:8px;border-left:0;border-bottom:0}
.holo .holo-corner.c{bottom:8px;left:8px;border-right:0;border-top:0}.holo .holo-corner.d{bottom:8px;right:8px;border-left:0;border-top:0}
.holo .holo-caption{position:absolute;z-index:3;left:0;right:0;bottom:0;padding:56px 20px 16px;pointer-events:none;background:linear-gradient(180deg,transparent,rgba(2,11,18,.9) 60%)}
.holo .holo-caption .inner{max-width:600px}
.holo .holo-caption .n{font-size:.7rem;color:var(--h-amber);letter-spacing:.18em}
.holo .holo-title{display:block;font-family:var(--h-display);font-stretch:125%;font-weight:800;font-size:clamp(1.25rem,3.2vw,2rem);line-height:1.1;margin:.14em 0 .22em;color:#EAFDFF;text-shadow:0 0 16px rgba(70,232,255,.55);text-wrap:balance}
.holo .holo-caption p{margin:0;font-family:var(--h-mono);font-size:.82rem;line-height:1.55;color:var(--h-ink);max-width:62ch}
.holo .holo-label{position:absolute;z-index:3;left:0;top:0;font-size:.7rem;letter-spacing:.1em;text-transform:uppercase;color:var(--h-cyan);white-space:nowrap;pointer-events:none;opacity:0;transition:opacity .5s;padding:3px 8px 3px 20px;background:linear-gradient(90deg,transparent,rgba(2,11,18,.55) 18px);text-shadow:0 0 6px rgba(70,232,255,.75);will-change:transform}
.holo .holo-label.flip{padding:3px 20px 3px 8px;background:linear-gradient(270deg,transparent,rgba(2,11,18,.55) 18px)}
.holo .holo-label.flip::before{left:auto;right:0}
.holo .holo-label.flip::after{left:auto;right:-3px}
.holo .holo-label.amber{color:var(--h-amber);text-shadow:0 0 6px rgba(255,179,92,.75)}
.holo .holo-label::before{content:"";position:absolute;left:0;top:50%;width:14px;height:1px;background:currentColor;box-shadow:0 0 6px currentColor}
.holo .holo-label::after{content:"";position:absolute;left:-3px;top:calc(50% - 3px);width:6px;height:6px;border-radius:50%;background:currentColor;box-shadow:0 0 10px currentColor}
.holo .holo-power{position:absolute;z-index:3;top:58px;right:18px;font-size:.64rem;letter-spacing:.14em;text-transform:uppercase;text-align:right;color:var(--h-amber);text-shadow:0 0 10px rgba(255,179,92,.7);pointer-events:none;opacity:0;transition:opacity .6s}
.holo .holo-power b{display:block;font-family:var(--h-display);font-stretch:125%;font-weight:800;font-size:clamp(1.8rem,5vw,3rem);letter-spacing:0;line-height:1.05;font-variant-numeric:tabular-nums}
.holo .holo-controls{display:flex;flex-wrap:wrap;align-items:center;gap:10px 12px;padding:12px 16px;border-top:1px solid var(--h-edge);background:var(--h-bar)}
.holo--full .holo-controls{padding-bottom:calc(env(safe-area-inset-bottom,0px) + 12px)}
.holo .holo-btn{font-family:var(--h-mono);font-size:.72rem;letter-spacing:.12em;text-transform:uppercase;color:var(--h-cyan);background:transparent;border:1px solid #1B5566;border-radius:3px;padding:7px 13px;cursor:pointer}
.holo .holo-btn:hover{background:#082633}
.holo .holo-btn:focus-visible,.holo .holo-dots button:focus-visible,.holo canvas:focus-visible{outline:2px solid var(--h-amber);outline-offset:2px}
.holo .holo-dots{display:flex;gap:6px;flex:1 1 220px;min-width:0}
.holo .holo-dots button{flex:1;border:0;background:transparent;cursor:pointer;padding:8px 0;min-width:10px}
.holo .holo-dots button span{display:block;height:5px;border-radius:3px;background:#12394A;transition:background .3s,box-shadow .3s}
.holo .holo-dots button.done span{background:#1E6A80}
.holo .holo-dots button.on span{background:var(--h-cyan);box-shadow:0 0 10px var(--h-cyan)}
.holo .holo-fallback{position:absolute;inset:0;display:grid;place-items:center;text-align:center;padding:24px 24px 140px;z-index:3;font-size:.8rem;letter-spacing:.06em;color:var(--h-dim)}
`;

function injectCSS() {
  if (document.getElementById("holo-css")) return;
  const s = document.createElement("style");
  s.id = "holo-css";
  s.textContent = CSS;
  document.head.append(s);
}

const pad = (n) => String(n).padStart(2, "0");

/* Single-diode model of the 36-cell module (same model as the site's explorer) */
function ivCurve(scaleToWatts) {
  const q = 1.602e-19, kB = 1.381e-23, n = 1.2, Ns = 36, isc = 4.75, voc = 0.675, Rs = 0.006;
  const Vt = kB * 298.15 / q;
  const I0 = isc / (Math.exp(voc / (n * Vt)) - 1);
  const raw = [];
  for (let j = 0; j <= 160; j++) {
    const I = isc * j / 160;
    const V = Math.max(0, Ns * (n * Vt * Math.log((isc - I) / I0 + 1) - I * Rs));
    raw.push({ V, I });
  }
  raw.reverse(); // from V = 0 (short circuit) to Voc
  const pIdeal = Math.max(...raw.map((p) => p.V * p.I));
  const k = scaleToWatts / pIdeal; // hand-built losses show up as lost current
  return raw.map((p) => ({ V: p.V, I: p.I * k, P: p.V * p.I * k }));
}

export function mountHologram(root, { mode = "embed", stage: startStage = 0 } = {}) {
  injectCSS();
  root.classList.add("holo", mode === "full" ? "holo--full" : "holo--embed");
  root.innerHTML = `
    <div class="holo-stage">
      <canvas tabindex="0" role="img" aria-label="Animated 3D hologram of the solar module being assembled, stage by stage. Drag to rotate; left and right arrow keys change stage."></canvas>
      <span class="holo-corner a"></span><span class="holo-corner b"></span><span class="holo-corner c"></span><span class="holo-corner d"></span>
      <div class="holo-hud tl">DIY-36M-HC<br><span class="dim">Build sequence // 36-cell module</span></div>
      <div class="holo-hud tr" data-meta></div>
      <div class="holo-power" data-power>Output · hand-built target<b data-watts>0.0 W</b><span data-vi>0.0 V · 0.00 A</span></div>
      <div data-labels></div>
      <div class="holo-caption" aria-live="polite"><div class="inner"><span class="n" data-n></span><strong class="holo-title" data-title></strong><p data-text></p></div></div>
      <div class="holo-fallback" data-fallback hidden></div>
    </div>
    <div class="holo-controls">
      <button class="holo-btn" type="button" data-prev aria-label="Previous stage">Prev</button>
      <button class="holo-btn" type="button" data-play>Pause</button>
      <button class="holo-btn" type="button" data-next aria-label="Next stage">Next</button>
      <div class="holo-dots" data-dots role="group" aria-label="Build stages"></div>
    </div>`;

  const $ = (s) => root.querySelector(s);
  const stageEl = $(".holo-stage"), canvas = $("canvas"), fallback = $("[data-fallback]");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------------- UI (works even without WebGL) ---------------- */
  let stage = 0, playing = !reduce, stageClock = 0;
  const dotsEl = $("[data-dots]"), playBtn = $("[data-play]");
  const dots = STAGES.map((st, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.setAttribute("aria-label", `Stage ${i + 1}: ${st.t}`);
    b.append(document.createElement("span"));
    b.addEventListener("click", () => go(i, true));
    dotsEl.append(b);
    return b;
  });
  function caption() {
    const st = STAGES[stage];
    $("[data-n]").textContent = `${pad(stage + 1)} / ${pad(STAGES.length)}`;
    $("[data-title]").textContent = st.t;
    $("[data-text]").textContent = st.d;
    $("[data-meta]").innerHTML = `Stage ${pad(stage + 1)} / ${pad(STAGES.length)}<br><span class="dim">Drag to rotate</span>`;
    dots.forEach((d, i) => {
      d.classList.toggle("on", i === stage);
      d.classList.toggle("done", i < stage);
      if (i === stage) d.setAttribute("aria-current", "step"); else d.removeAttribute("aria-current");
    });
    playBtn.textContent = playing ? "Pause" : "Play";
  }
  let onStage = () => {};
  function go(i, byUser, instant = false) {
    stage = (i + STAGES.length) % STAGES.length;
    stageClock = 0;
    if (byUser && reduce) playing = false;
    caption();
    onStage(stage, instant);
  }
  $("[data-prev]").addEventListener("click", () => go(stage - 1, true));
  $("[data-next]").addEventListener("click", () => go(stage + 1, true));
  playBtn.addEventListener("click", () => { playing = !playing; stageClock = 0; caption(); });
  root.addEventListener("keydown", (e) => {
    if (e.target.closest("button") && e.key === " ") return;
    if (e.key === "ArrowRight") { go(stage + 1, true); e.preventDefault(); }
    else if (e.key === "ArrowLeft") { go(stage - 1, true); e.preventDefault(); }
    else if (e.key === " " && e.target === canvas) { playing = !playing; caption(); e.preventDefault(); }
  });
  caption();

  /* ---------------- Renderer ---------------- */
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  } catch (err) {
    fallback.hidden = false;
    fallback.textContent = "The 3D view isn't available in this browser. Use the stage controls below to follow the build.";
    playing = false; caption();
    return { go };
  }
  const PR = () => Math.min(devicePixelRatio, 1.75);
  renderer.setPixelRatio(PR());
  renderer.setClearColor(0x020b12, 1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.9;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 200);
  const controls = new OrbitControls(camera, canvas);
  canvas.style.touchAction = "pan-y"; // let phones scroll past the hologram
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.enablePan = false;
  controls.enableZoom = false;
  controls.rotateSpeed = 0.55;
  controls.minPolarAngle = 0.15;
  controls.maxPolarAngle = 2.25;
  controls.autoRotateSpeed = 0.35;
  controls.target.set(0, -0.2, 0);

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.75, 0.45, 0.3);
  composer.addPass(bloom);
  const lens = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uAmt: { value: 0.012 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`
      uniform sampler2D tDiffuse; uniform float uTime; uniform float uAmt; varying vec2 vUv;
      void main(){
        vec2 c = vUv - 0.5; float d = dot(c, c);
        vec2 off = c * d * uAmt * 4.0;
        vec4 col = vec4(texture2D(tDiffuse, vUv + off).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - off).b, 1.0);
        float n = fract(sin(dot(vUv * 913.0 + uTime, vec2(12.9898, 78.233))) * 43758.5453);
        col.rgb += (n - 0.5) * 0.018;
        gl_FragColor = col;
      }`
  });
  composer.addPass(lens);
  composer.addPass(new OutputPass());

  /* ---------------- Materials ---------------- */
  const C = {
    cyan: new THREE.Color("#3FE0FF"), amber: new THREE.Color("#FFB050"), glass: new THREE.Color("#BFF6FF"),
    ribbon: new THREE.Color("#FFD79A"), frame: new THREE.Color("#8CCBFF"), deep: new THREE.Color("#1FA8D6"), white: new THREE.Color("#E8FDFF")
  };
  const shared = { uTime: { value: 0 }, uFlick: { value: 1 } };

  const HOLO_VS = /* glsl */`
    varying vec3 vN; varying vec3 vW; varying vec2 vUv;
    void main(){
      vUv = uv;
      vec4 w = modelMatrix * vec4(position, 1.0);
      vW = w.xyz;
      vN = normalize(mat3(modelMatrix) * normal);
      gl_Position = projectionMatrix * viewMatrix * w;
    }`;
  const HOLO_FS = /* glsl */`
    uniform vec3 uColor; uniform float uOpacity; uniform float uTime; uniform float uFlick;
    uniform sampler2D uMap; uniform float uUseMap; uniform float uBase; uniform float uRim; uniform float uGlow; uniform float uPulse;
    varying vec3 vN; varying vec3 vW; varying vec2 vUv;
    void main(){
      vec3 V = normalize(cameraPosition - vW);
      float fres = pow(1.0 - abs(dot(normalize(vN), V)), 2.4);
      float scan = 0.82 + 0.18 * sin(vW.y * 60.0 + vW.x * 3.0 - uTime * 5.0);
      float band = pow(max(0.0, 1.0 - abs(fract(vW.z * 0.11 + vW.y * 0.22 - uTime * 0.16) - 0.5) * 2.0), 20.0);
      float m = uUseMap > 0.5 ? texture2D(uMap, vUv).r : 0.0;
      float a = (uBase + fres * uRim + m * 0.42 + band * 0.18 + uPulse * 0.35) * scan * uOpacity * uFlick;
      vec3 col = uColor * (0.42 + fres * 0.8 + m * 0.95 + band * 0.7) * (1.0 + uPulse * 1.8);
      col = mix(col, vec3(1.0, 0.7, 0.32) * (1.0 + m * 2.2), uGlow * 0.65);
      gl_FragColor = vec4(col, clamp(a, 0.0, 1.0));
    }`;
  function holoMat(color, { map = null, base = 0.08, rim = 0.6 } = {}) {
    return new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: color.clone() }, uOpacity: { value: 1 }, uTime: shared.uTime, uFlick: shared.uFlick,
        uMap: { value: map }, uUseMap: { value: map ? 1 : 0 }, uBase: { value: base }, uRim: { value: rim },
        uGlow: { value: 0 }, uPulse: { value: 0 }
      },
      vertexShader: HOLO_VS, fragmentShader: HOLO_FS,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide
    });
  }
  const lineMats = [];
  function lineMat(color, width, opacity) {
    const m = new LineMaterial({ color, linewidth: width, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending });
    m.userData.base = opacity;
    lineMats.push(m);
    return m;
  }
  function holoBox(w, h, d, color, opts, edgeW = 1.2, edgeO = 0.85) {
    const g = new THREE.BoxGeometry(w, h, d);
    const mesh = new THREE.Mesh(g, holoMat(color, opts));
    const edges = new LineSegments2(new LineSegmentsGeometry().fromEdgesGeometry(new THREE.EdgesGeometry(g)), lineMat(color, edgeW, edgeO));
    const grp = new THREE.Group();
    grp.add(mesh, edges);
    grp.userData = { mesh, edges };
    return grp;
  }
  function setVis(grp, v) {
    grp.visible = v > 0.004;
    grp.userData.mesh.material.uniforms.uOpacity.value = v;
    const lm = grp.userData.edges.material;
    lm.opacity = lm.userData.base * v * shared.uFlick.value;
    (grp.userData.extra || []).forEach((x) => setVis(x, v));
  }
  function fadeLine(obj, v) {
    obj.visible = v > 0.004;
    obj.material.opacity = obj.material.userData.base * v * shared.uFlick.value;
  }
  function segs(positions, color, width, opacity) {
    const g = new LineSegmentsGeometry();
    g.setPositions(positions);
    return new LineSegments2(g, lineMat(color, width, opacity));
  }

  // Soft glowing points: current, sparks, dust, the sun
  const POINT_VS = /* glsl */`
    attribute float aSize; uniform float uScale;
    void main(){
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      gl_PointSize = aSize * uScale / max(0.1, -mv.z);
      gl_Position = projectionMatrix * mv;
    }`;
  const POINT_FS = /* glsl */`
    uniform vec3 uColor; uniform float uOpacity; uniform float uFlick;
    void main(){
      float d = length(gl_PointCoord - 0.5);
      float a = smoothstep(0.5, 0.0, d); a *= a;
      gl_FragColor = vec4(uColor * (1.0 + a * 2.5), a * uOpacity * uFlick);
    }`;
  const pointScale = { value: 400 };
  function makePoints(count, color, opacity) {
    const pos = new Float32Array(count * 3), size = new Float32Array(count);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
    const p = new THREE.Points(g, new THREE.ShaderMaterial({
      uniforms: { uColor: { value: color.clone() }, uOpacity: { value: opacity }, uScale: pointScale, uFlick: shared.uFlick },
      vertexShader: POINT_VS, fragmentShader: POINT_FS,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
    }));
    p.frustumCulled = false;
    return { p, pos, size, g };
  }

  /* ---------------- Cell texture: fingers + 5 busbars ---------------- */
  const cv = document.createElement("canvas");
  cv.width = 256; cv.height = 512;
  const cx = cv.getContext("2d");
  cx.fillStyle = "#000"; cx.fillRect(0, 0, 256, 512);
  cx.fillStyle = "rgb(60,60,60)";
  for (let x = 5; x < 256; x += 7) cx.fillRect(x, 0, 1, 512);
  cx.fillStyle = "#fff";
  for (let b = 1; b <= 5; b++) cx.fillRect(0, Math.round(b * 512 / 6) - 3, 256, 6);
  cx.strokeStyle = "rgb(170,170,170)"; cx.lineWidth = 4; cx.strokeRect(2, 2, 252, 508);
  const cellTex = new THREE.CanvasTexture(cv);
  cellTex.anisotropy = renderer.capabilities.getMaxAnisotropy();

  /* ---------------- Geometry: 36 half-cells, 4 rows of 9 (1 unit = 100 mm) ---------------- */
  const CW = 0.784, CH = 1.5675, GX = 0.02, GZ = 0.08;
  const ROW_W = 9 * CW + 8 * GX, COL_D = 4 * CH + 3 * GZ;
  const cellX = (c) => -ROW_W / 2 + CW / 2 + c * (CW + GX);
  const rowZ = (r) => -COL_D / 2 + CH / 2 + r * (CH + GZ);
  const LEAD_X = -ROW_W / 2 - 0.4;

  const model = new THREE.Group();
  scene.add(model);

  const backing = holoBox(7.75, 0.05, 7.05, C.deep, { base: 0.03, rim: 0.2 }, 1.0, 0.45);
  model.add(backing);

  // Dimension lines, shown in the exploded view (790 × 715 mm outer frame)
  const HX = 3.95, HZ = 3.575, T = 0.12;
  const dims = segs([
    -HX, 0, HZ + 0.2, -HX, 0, HZ + 0.95, HX, 0, HZ + 0.2, HX, 0, HZ + 0.95,
    -HX, 0, HZ + 0.7, HX, 0, HZ + 0.7,
    -HX - T, 0, HZ + 0.7 + T, -HX + T, 0, HZ + 0.7 - T, HX - T, 0, HZ + 0.7 + T, HX + T, 0, HZ + 0.7 - T,
    HX + 0.2, 0, -HZ, HX + 0.95, 0, -HZ, HX + 0.2, 0, HZ, HX + 0.95, 0, HZ,
    HX + 0.7, 0, -HZ, HX + 0.7, 0, HZ,
    HX + 0.7 - T, 0, -HZ - T, HX + 0.7 + T, 0, -HZ + T, HX + 0.7 - T, 0, HZ - T, HX + 0.7 + T, 0, HZ + T
  ], C.cyan, 1.1, 0.7);
  backing.add(dims);

  const cellsG = new THREE.Group();
  model.add(cellsG);
  const cells = [];
  for (let r = 0; r < 4; r++) {
    for (let k = 0; k < 9; k++) {
      const c = r % 2 ? 8 - k : k;           // serpentine order = assembly order
      const cell = holoBox(CW * 0.985, 0.014, CH * 0.985, C.cyan, { map: cellTex, base: 0.06, rim: 0.12 }, 1.0, 0.5);
      cell.position.set(cellX(c), 0, rowZ(r));
      cellsG.add(cell);
      cells.push(cell);
    }
  }

  // Tabbing ribbons: 5 per row, drawn growing along the row
  const RIB_L = ROW_W + 0.16;
  const ribbons = [];
  for (let r = 0; r < 4; r++) {
    const pos = [];
    for (let b = 1; b <= 5; b++) {
      const z = (b / 6 - 0.5) * CH * 0.985;
      pos.push(-RIB_L / 2, 0, z, RIB_L / 2, 0, z);
    }
    const line = segs(pos, C.ribbon, 1.7, 0.95);
    line.position.set(0, 0.016, rowZ(r));
    line.userData.dir = r % 2 ? 1 : -1;
    cellsG.add(line);
    ribbons.push(line);
  }

  // Soldering head and sparks, active while ribbons are going down
  const tip = makePoints(2, C.amber, 0);
  tip.size.set([0.5, 1.4]);
  cellsG.add(tip.p);
  const N_SPARK = 80;
  const sparks = makePoints(N_SPARK, C.amber, 1);
  const sparkVel = new Float32Array(N_SPARK * 3), sparkLife = new Float32Array(N_SPARK);
  cellsG.add(sparks.p);
  let sparkNext = 0;

  // Bus ribbons at the row turnarounds, plus the three leads A / B / C
  const zMid = (r) => rowZ(r) + (CH + GZ) / 2;
  const bus = segs([
    ROW_W / 2 + 0.08, 0, rowZ(0), ROW_W / 2 + 0.08, 0, rowZ(1),
    -ROW_W / 2 - 0.08, 0, rowZ(1), -ROW_W / 2 - 0.08, 0, rowZ(2),
    ROW_W / 2 + 0.08, 0, rowZ(2), ROW_W / 2 + 0.08, 0, rowZ(3),
    -ROW_W / 2 - 0.08, 0, rowZ(0), LEAD_X, 0, rowZ(0),
    -ROW_W / 2 - 0.08, 0, zMid(1), LEAD_X, 0, zMid(1),
    -ROW_W / 2 - 0.08, 0, rowZ(3), LEAD_X, 0, rowZ(3)
  ], C.ribbon, 3.0, 0.9);
  bus.position.y = 0.016;
  cellsG.add(bus);

  // Current path through the serpentine
  const path = [new THREE.Vector3(LEAD_X, 0.03, rowZ(0))];
  for (let r = 0; r < 4; r++) {
    for (let k = 0; k < 9; k++) path.push(new THREE.Vector3(cellX(r % 2 ? 8 - k : k), 0.03, rowZ(r)));
  }
  path.push(new THREE.Vector3(LEAD_X, 0.03, rowZ(3)));
  const pathGeo = new LineGeometry();
  pathGeo.setPositions(path.flatMap((p) => [p.x, p.y, p.z]));
  const flowLine = new Line2(pathGeo, lineMat(C.amber, 2.4, 0.55));
  cellsG.add(flowLine);
  const segLen = [], cum = [0];
  for (let i = 1; i < path.length; i++) { segLen.push(path[i].distanceTo(path[i - 1])); cum.push(cum[i - 1] + segLen[i - 1]); }
  const PATH_LEN = cum[cum.length - 1];
  const N_FLOW = 110;
  const flow = makePoints(N_FLOW, C.amber, 0);
  for (let i = 0; i < N_FLOW; i++) flow.size[i] = i % 5 === 0 ? 0.34 : 0.2;
  cellsG.add(flow.p);
  function pointAt(dist, out) {
    let i = 1;
    while (i < cum.length - 1 && cum[i] < dist) i++;
    const t = (dist - cum[i - 1]) / (segLen[i - 1] || 1);
    return out.lerpVectors(path[i - 1], path[i], t);
  }

  // Front sheet
  const front = holoBox(7.75, 0.04, 7.05, C.glass, { base: 0.015, rim: 0.25 }, 1.4, 0.75);
  model.add(front);

  // Junction box with two bypass diodes and output leads
  const jbox = holoBox(0.95, 0.3, 1.9, C.amber, { base: 0.08, rim: 0.7 }, 1.3, 0.9);
  const diodes = [-0.4, 0.4].map((z) => {
    const d = holoBox(0.46, 0.13, 0.2, C.amber, { base: 0.35, rim: 0.6 }, 1.1, 1);
    d.position.set(0, 0, z);
    jbox.add(d);
    return d;
  });
  jbox.userData.extra = diodes;
  const leads = segs([-0.48, 0, -0.55, -1.6, -0.45, -0.95, -0.48, 0, 0.55, -1.6, -0.45, 0.95], C.amber, 2.2, 0.8);
  jbox.add(leads);
  model.add(jbox);

  // Aluminium frame: four L-profile bars
  const frameBars = [];
  const FX = 3.93, FZ = 3.58;
  [[0, -FZ, 7.96, "x", [0, 0, -1]], [0, FZ, 7.96, "x", [0, 0, 1]], [-FX, 0, 7.26, "z", [-1, 0, 0]], [FX, 0, 7.26, "z", [1, 0, 0]]].forEach(([x, z, len, ax, dir]) => {
    const along = ax === "x";
    const wall = holoBox(along ? len : 0.07, 0.28, along ? 0.07 : len, C.frame, { base: 0.05, rim: 0.3 }, 1.3, 0.85);
    const lip = holoBox(along ? len : 0.24, 0.03, along ? 0.24 : len, C.frame, { base: 0.05, rim: 0.25 }, 1.0, 0.6);
    lip.position.set(-dir[0] * 0.085, 0.125, -dir[2] * 0.085);
    wall.add(lip);
    wall.userData.extra = [lip];
    wall.userData.home = new THREE.Vector3(x, 0.03, z);
    wall.userData.dir = new THREE.Vector3(...dir);
    model.add(wall);
    frameBars.push(wall);
  });

  /* ---------------- Floating I–V curve (power-on stage) ---------------- */
  const IV = ivCurve(80.2);
  const MPP = IV.reduce((a, b) => (b.P > a.P ? b : a));
  const VOC = IV[IV.length - 1].V;
  const CX0 = -3.3, CX1 = 3.3, CY0 = 0.7, CY1 = 3.5, CZ = -4.7;
  const vx = (v) => CX0 + (v / 26) * (CX1 - CX0);
  const iy = (i) => CY0 + (i / 5) * (CY1 - CY0);
  const py = (p) => CY0 + (p / 100) * (CY1 - CY0);
  const curveG = new THREE.Group();
  scene.add(curveG);
  const axes = segs([CX0, CY0, CZ, CX1, CY0, CZ, CX0, CY0, CZ, CX0, CY1, CZ,
    ...[5, 10, 15, 20, 25].flatMap((v) => [vx(v), CY0, CZ, vx(v), CY0 - 0.12, CZ]),
    ...[1, 2, 3, 4, 5].flatMap((i) => [CX0, iy(i), CZ, CX0 - 0.12, iy(i), CZ])], C.cyan, 1.2, 0.7);
  curveG.add(axes);
  const ivGeo = new LineGeometry(); ivGeo.setPositions(IV.flatMap((p) => [vx(p.V), iy(p.I), CZ]));
  const ivLine = new Line2(ivGeo, lineMat(C.white, 2.6, 1));
  const pvGeo = new LineGeometry(); pvGeo.setPositions(IV.flatMap((p) => [vx(p.V), py(p.P), CZ]));
  const pvLine = new Line2(pvGeo, lineMat(C.amber, 2.6, 1));
  curveG.add(ivLine, pvLine);
  const mppDot = makePoints(2, C.amber, 0);
  mppDot.pos.set([vx(MPP.V), py(MPP.P), CZ, vx(MPP.V), py(MPP.P), CZ]);
  mppDot.size.set([0.35, 1.2]);
  curveG.add(mppDot.p);
  const mppDrop = segs([vx(MPP.V), py(MPP.P), CZ, vx(MPP.V), CY0, CZ], C.amber, 1, 0.6);
  curveG.add(mppDrop);
  const IV_SEGS = IV.length - 1;

  /* ---------------- Projector, light cone, dust, scan ring, sun ---------------- */
  const BASE_Y = -3.4;
  const simpleVS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;
  const disc = new THREE.Mesh(new THREE.CircleGeometry(6.6, 128), new THREE.ShaderMaterial({
    uniforms: { uTime: shared.uTime, uFlick: shared.uFlick, uColor: { value: C.cyan.clone() } },
    vertexShader: simpleVS,
    fragmentShader: /* glsl */`
      uniform float uTime; uniform float uFlick; uniform vec3 uColor; varying vec2 vUv;
      void main(){
        vec2 p = vUv - 0.5; float r = length(p) * 2.0; if (r > 1.0) discard;
        float ang = atan(p.y, p.x);
        float glow = pow(1.0 - r, 3.0) * 0.32;
        float ring = smoothstep(0.012, 0.0, abs(r - 0.98)) + smoothstep(0.008, 0.0, abs(r - 0.74)) * 0.7 + smoothstep(0.006, 0.0, abs(r - 0.46)) * 0.5;
        float ticks = step(0.62, fract((ang + uTime * 0.12) * 60.0 / 6.2831853)) * step(0.87, r) * step(r, 0.93) * 0.55;
        float sweep = pow(max(0.0, cos(ang - uTime * 0.55)), 30.0) * step(r, 0.98) * 0.4 * (1.0 - r * 0.4);
        gl_FragColor = vec4(uColor * (1.0 + ring), (glow + ring + ticks + sweep) * uFlick);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide
  }));
  disc.rotation.x = -Math.PI / 2;
  disc.position.y = BASE_Y;
  scene.add(disc);

  const cone = new THREE.Mesh(new THREE.CylinderGeometry(5.3, 6.4, 6.2, 128, 1, true), new THREE.ShaderMaterial({
    uniforms: { uTime: shared.uTime, uFlick: shared.uFlick, uColor: { value: C.cyan.clone() } },
    vertexShader: simpleVS,
    fragmentShader: /* glsl */`
      uniform float uTime; uniform float uFlick; uniform vec3 uColor; varying vec2 vUv;
      void main(){
        float fade = pow(1.0 - vUv.y, 1.7);
        float streak = 0.65 + 0.35 * sin(vUv.x * 6.2831853 * 48.0 + uTime * 0.8);
        gl_FragColor = vec4(uColor, fade * streak * 0.085 * uFlick);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide
  }));
  cone.position.y = BASE_Y + 3.1;
  scene.add(cone);

  const N_DUST = 420;
  const dust = makePoints(N_DUST, C.cyan, 0.55);
  const dustSpeed = new Float32Array(N_DUST);
  for (let i = 0; i < N_DUST; i++) {
    const a = Math.random() * Math.PI * 2, rr = Math.sqrt(Math.random()) * 6.8;
    dust.pos[i * 3] = Math.cos(a) * rr; dust.pos[i * 3 + 1] = BASE_Y + Math.random() * 7.5; dust.pos[i * 3 + 2] = Math.sin(a) * rr;
    dust.size[i] = 0.03 + Math.random() * 0.06;
    dustSpeed[i] = 0.05 + Math.random() * 0.14;
  }
  scene.add(dust.p);

  const scanGeo = new LineGeometry();
  scanGeo.setPositions([-4.3, 0, -3.95, 4.3, 0, -3.95, 4.3, 0, 3.95, -4.3, 0, 3.95, -4.3, 0, -3.95]);
  const scanRing = new Line2(scanGeo, lineMat(C.cyan, 2.0, 1));
  scene.add(scanRing);
  let scanT = 1;

  const SUN = new THREE.Vector3(-5.8, 5.6, 2.4);
  const sun = makePoints(2, C.amber, 0);
  sun.pos.set([SUN.x, SUN.y, SUN.z, SUN.x, SUN.y, SUN.z]);
  sun.size.set([1.6, 4.4]);
  scene.add(sun.p);
  const rayPos = [];
  for (let i = 0; i < 14; i++) rayPos.push(SUN.x, SUN.y, SUN.z, (Math.random() - 0.5) * 7, 0.2, (Math.random() - 0.5) * 6.4);
  const rays = segs(rayPos, C.amber, 1.2, 0.35);
  scene.add(rays);

  /* ---------------- Labels ---------------- */
  const LABELS = [
    { t: "Front sheet · 3 mm polycarbonate", o: front, p: [3.7, 0, -3.3], s: [0, 5] },
    { t: "36 × PERC half-cells", o: cellsG, p: [3.5, 0, 2.9], s: [0, 1] },
    { t: "Tabbing ribbon · 180 pcs", o: cellsG, p: [0.8, 0.02, rowZ(1) + 0.4], s: [2] },
    { t: "Series string · ≈ 24 V open-circuit", o: cellsG, p: [LEAD_X, 0.03, rowZ(0)], s: [3] },
    { t: "Backing panel · aluminium composite", o: backing, p: [-3.7, 0, 3.3], s: [0] },
    { t: "790 mm", o: backing, p: [0.2, 0, HZ + 0.7], s: [0] },
    { t: "715 mm", o: backing, p: [HX + 0.7, 0, 0.2], s: [0] },
    { t: "J-box · 2 × 15 A bypass diodes", o: jbox, p: [0.3, 0, 0.95], s: [0, 4] },
    { t: "Aluminium frame · 25 mm angle", o: frameBars[1], p: [2.8, 0.15, 0], s: [0, 6] },
    { t: "≈ 1000 W/m² sunlight", o: scene, p: [SUN.x, SUN.y, SUN.z], s: [7], amber: true },
    { t: `Max power point · ${MPP.P.toFixed(0)} W @ ${MPP.V.toFixed(1)} V`, o: scene, p: [vx(MPP.V), py(MPP.P), CZ], s: [7], amber: true },
    { t: `I–V curve · Voc ${VOC.toFixed(1)} V`, o: scene, p: [CX0, CY1 - 0.4, CZ], s: [7] }
  ];
  const labelLayer = $("[data-labels]");
  LABELS.forEach((L) => {
    L.el = document.createElement("div");
    L.el.className = "holo-label" + (L.amber ? " amber" : "");
    L.el.textContent = L.t;
    L.el.setAttribute("aria-hidden", "true");
    labelLayer.append(L.el);
    L.v = new THREE.Vector3();
  });

  /* ---------------- State and choreography ---------------- */
  const cur = {}, tgt = {};
  K.forEach((k, i) => { cur[k] = tgt[k] = STAGES[0].s[i]; });
  cur.dim = tgt.dim = 1;
  let flick = 0;
  const sph = new THREE.Spherical();
  let camAnim = null, idleHold = 0, sizeMul = 1;

  const camFor = (i) => { const [az, pol, dist] = STAGES[i].cam; return { az, pol, dist: dist * sizeMul }; };
  function placeCam(v) {
    sph.set(v.dist, v.pol, v.az);
    camera.position.setFromSpherical(sph).add(controls.target);
    camera.lookAt(controls.target);
  }
  onStage = (i, instant) => {
    const snap = reduce || instant;
    const st = STAGES[i];
    K.forEach((k, j) => { tgt[k] = st.s[j]; });
    tgt.dim = i === 0 ? 1 : 0;
    if (st.enter) Object.assign(cur, st.enter);
    if (i === 7) cur.power = 0;
    sph.setFromVector3(camera.position.clone().sub(controls.target));
    const to = camFor(i);
    let dAz = to.az - sph.theta;
    dAz = Math.atan2(Math.sin(dAz), Math.cos(dAz));
    camAnim = { from: { az: sph.theta, pol: sph.phi, dist: sph.radius }, to: { az: sph.theta + dAz, pol: to.pol, dist: to.dist }, t: snap ? 1 : 0 };
    if (snap) { K.forEach((k) => { cur[k] = tgt[k]; }); cur.dim = tgt.dim; placeCam(to); camAnim = null; }
    scanT = snap ? 1 : 0;
    flick = snap ? 0 : 0.28;
  };
  controls.addEventListener("start", () => { camAnim = null; idleHold = 5; });

  /* ---------------- Resize ---------------- */
  function resize() {
    const w = Math.max(1, stageEl.clientWidth), h = Math.max(1, stageEl.clientHeight);
    const pr = PR();
    renderer.setPixelRatio(pr);
    renderer.setSize(w, h, false);
    composer.setPixelRatio(pr);
    composer.setSize(w, h);
    bloom.resolution.set(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    lineMats.forEach((m) => m.resolution.set(w, h));
    pointScale.value = (h * pr) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
    const mul = w / h < 0.9 ? 1.55 : w / h < 1.3 ? 1.2 : 1;
    if (mul !== sizeMul) { sizeMul = mul; if (!camAnim) placeCam(camFor(stage)); }
  }
  new ResizeObserver(resize).observe(stageEl);
  resize();
  placeCam(camFor(0));
  controls.update();

  /* ---------------- Frame loop ---------------- */
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const approach = (k, rate, dt) => { cur[k] += (tgt[k] - cur[k]) * (1 - Math.exp(-rate * dt)); };
  const linear = (k, speed, dt) => { const d = tgt[k] - cur[k]; cur[k] += Math.sign(d) * Math.min(Math.abs(d), speed * dt); };
  const clamp01 = (x) => THREE.MathUtils.clamp(x, 0, 1);
  const tmp = new THREE.Vector3();
  const powerEl = $("[data-power]"), wattsEl = $("[data-watts]"), viEl = $("[data-vi]");
  let last = performance.now(), visible = true, time = 0;
  new IntersectionObserver((es) => { visible = es[0].isIntersecting; if (visible) last = performance.now(); }).observe(stageEl);

  function frame(now) {
    requestAnimationFrame(frame);
    if (!visible || document.hidden) { last = now; return; }
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    time += dt;
    shared.uTime.value = time;
    lens.uniforms.uTime.value = time % 10;

    if (playing && idleHold <= 0) {
      stageClock += dt;
      if (stageClock > STAGES[stage].dur) go(stage + 1, false);
    }
    idleHold = Math.max(0, idleHold - dt);

    if (!reduce && Math.random() < 0.003) flick = Math.max(flick, 0.07);
    flick = Math.max(0, flick - dt);
    shared.uFlick.value = flick > 0 ? 0.55 + Math.random() * 0.45 : 1;

    ["ex", "flow", "jb", "front", "fv", "fin", "sun", "dim"].forEach((k) => approach(k, 2.2, dt));
    linear("cells", 0.42, dt);
    linear("rib", 0.5, dt);
    linear("power", 0.45, dt);

    if (camAnim) {
      camAnim.t = Math.min(1, camAnim.t + dt / 2.0);
      const e = ease(camAnim.t), f = camAnim.from, t2 = camAnim.to;
      placeCam({ az: f.az + (t2.az - f.az) * e, pol: f.pol + (t2.pol - f.pol) * e, dist: f.dist + (t2.dist - f.dist) * e });
      if (camAnim.t >= 1) camAnim = null;
    }
    controls.autoRotate = !reduce && !camAnim && idleHold <= 0;
    controls.update();

    const ex = cur.ex;
    backing.position.y = -1.05 * ex;
    setVis(backing, 0.9);
    fadeLine(dims, cur.dim);

    cellsG.position.y = 0.06 + 0.9 * ex;
    const glow = cur.sun * 0.85;
    cells.forEach((cell, i) => {
      const v = clamp01(cur.cells * 36 - i);
      cell.position.y = (1 - v) * 0.8;
      setVis(cell, v);
      const u = cell.userData.mesh.material.uniforms;
      u.uGlow.value = glow;
      u.uPulse.value = v > 0 && v < 1 ? Math.sin(v * Math.PI) : 0;
    });

    ribbons.forEach((line, r) => {
      const rp = clamp01(cur.rib * 4 - r);
      line.scale.x = Math.max(rp, 1e-4);
      line.position.x = line.userData.dir * (RIB_L / 2) * (1 - rp);
      fadeLine(line, rp > 0 ? 1 : 0);
    });
    fadeLine(bus, clamp01((cur.rib - 0.8) * 5));

    // soldering head rides the growing ribbon front
    const soldering = cur.rib > 0.001 && cur.rib < 0.999 && tgt.rib === 1;
    if (soldering) {
      const r = Math.min(3, Math.floor(cur.rib * 4)), rp = cur.rib * 4 - r;
      const x = r % 2 ? RIB_L / 2 - rp * RIB_L : -RIB_L / 2 + rp * RIB_L;
      tip.pos.set([x, 0.06, rowZ(r), x, 0.06, rowZ(r)]);
      tip.g.attributes.position.needsUpdate = true;
      for (let s = 0; s < 3; s++) {
        const i = sparkNext; sparkNext = (sparkNext + 1) % N_SPARK;
        sparks.pos[i * 3] = x; sparks.pos[i * 3 + 1] = 0.06; sparks.pos[i * 3 + 2] = rowZ(r) + (Math.random() - 0.5) * CH * 0.8;
        sparkVel[i * 3] = (Math.random() - 0.5) * 1.6; sparkVel[i * 3 + 1] = 0.8 + Math.random() * 1.6; sparkVel[i * 3 + 2] = (Math.random() - 0.5) * 1.6;
        sparkLife[i] = 0.35 + Math.random() * 0.35;
      }
    }
    tip.p.visible = soldering;
    tip.p.material.uniforms.uOpacity.value = 0.8 + 0.2 * Math.sin(time * 40);
    for (let i = 0; i < N_SPARK; i++) {
      if (sparkLife[i] <= 0) { sparks.size[i] = 0; continue; }
      sparkLife[i] -= dt;
      sparkVel[i * 3 + 1] -= 6 * dt;
      sparks.pos[i * 3] += sparkVel[i * 3] * dt;
      sparks.pos[i * 3 + 1] = Math.max(0.02, sparks.pos[i * 3 + 1] + sparkVel[i * 3 + 1] * dt);
      sparks.pos[i * 3 + 2] += sparkVel[i * 3 + 2] * dt;
      sparks.size[i] = Math.max(0, sparkLife[i]) * 0.16;
    }
    sparks.g.attributes.position.needsUpdate = true;
    sparks.g.attributes.aSize.needsUpdate = true;

    fadeLine(flowLine, cur.flow);
    flow.p.visible = cur.flow > 0.004;
    flow.p.material.uniforms.uOpacity.value = cur.flow * (0.75 + cur.sun * 0.5);
    if (flow.p.visible) {
      const speed = 0.9 + cur.sun * 1.4;
      for (let i = 0; i < N_FLOW; i++) {
        const d = ((i / N_FLOW) * PATH_LEN + time * speed) % PATH_LEN;
        pointAt(d, tmp);
        flow.pos[i * 3] = tmp.x; flow.pos[i * 3 + 1] = tmp.y + 0.02; flow.pos[i * 3 + 2] = tmp.z;
      }
      flow.g.attributes.position.needsUpdate = true;
    }

    jbox.position.set(-2.9, -0.24 - 2.0 * ex - (1 - cur.jb) * 1.4, 0);
    setVis(jbox, cur.jb);
    fadeLine(leads, cur.jb);
    diodes.forEach((d, i) => { d.userData.mesh.material.uniforms.uPulse.value = stage === 4 ? 0.5 + 0.5 * Math.sin(time * 4 + i * Math.PI) : 0; });

    front.position.y = 0.13 + 2.35 * ex + (1 - cur.front) * 2.4;
    setVis(front, cur.front);

    frameBars.forEach((bar) => {
      bar.position.copy(bar.userData.home).addScaledVector(bar.userData.dir, (1 - cur.fin) * 2.4);
      setVis(bar, cur.fv);
    });

    sun.p.visible = cur.sun > 0.004;
    sun.p.material.uniforms.uOpacity.value = cur.sun * (0.85 + 0.15 * Math.sin(time * 2.1));
    fadeLine(rays, cur.sun * (0.55 + 0.45 * Math.sin(time * 3.3)));

    // floating I–V curve draws itself as power comes up
    const pw = ease(clamp01(cur.power));
    const curveOn = cur.sun;
    fadeLine(axes, curveOn);
    fadeLine(ivLine, curveOn);
    fadeLine(pvLine, curveOn);
    const shown = Math.max(1, Math.round(IV_SEGS * pw));
    ivLine.geometry.instanceCount = shown;
    pvLine.geometry.instanceCount = shown;
    const mppOn = curveOn * clamp01((pw - 0.9) * 10);
    mppDot.p.visible = mppOn > 0.01;
    mppDot.p.material.uniforms.uOpacity.value = mppOn * (0.8 + 0.2 * Math.sin(time * 5));
    fadeLine(mppDrop, mppOn);

    if (scanT < 1) {
      scanT = Math.min(1, scanT + dt / 1.4);
      scanRing.position.y = 3.4 - scanT * 6.6;
      fadeLine(scanRing, Math.sin(scanT * Math.PI));
    } else scanRing.visible = false;

    for (let i = 0; i < N_DUST; i++) {
      let y = dust.pos[i * 3 + 1] + dustSpeed[i] * dt;
      if (y > BASE_Y + 7.5) y = BASE_Y;
      dust.pos[i * 3 + 1] = y;
    }
    dust.g.attributes.position.needsUpdate = true;
    disc.rotation.z = time * 0.02;

    powerEl.style.opacity = cur.power > 0.01 && stage === 7 ? 1 : 0;
    wattsEl.textContent = (MPP.P * pw).toFixed(1) + " W";
    viEl.textContent = (MPP.V * Math.min(1, pw * 1.15)).toFixed(1) + " V · " + (MPP.I * pw).toFixed(2) + " A";

    const w = stageEl.clientWidth, h = stageEl.clientHeight;
    LABELS.forEach((L) => {
      L.v.set(...L.p);
      L.o.localToWorld(L.v);
      L.v.project(camera);
      const on = L.s.includes(stage) && L.o.visible !== false && L.v.z < 1 && (stage !== 7 || pw > 0.85 || !L.amber);
      const x = (L.v.x * 0.5 + 0.5) * w, y = (-L.v.y * 0.5 + 0.5) * h;
      const inside = x > 8 && x < w - 8 && y > 50 && y < h - 110;
      const flip = x > w * 0.58;
      L.el.classList.toggle("flip", flip);
      L.el.style.opacity = on && inside ? 1 : 0;
      L.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(${flip ? "-100%" : "0"}, -50%)`;
    });

    composer.render();
  }
  requestAnimationFrame(frame);
  go(Math.min(STAGES.length - 1, Math.max(0, startStage | 0)), false, startStage > 0);
  return { go };
}
