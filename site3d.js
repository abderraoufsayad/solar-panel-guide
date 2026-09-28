// WebGL layer for the guide: hero panel render, embedded build hologram, 3D power surface.
// Text, tables and code stay plain HTML; this module only adds the visual pieces.
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { Line2 } from "three/addons/lines/Line2.js";
import { LineGeometry } from "three/addons/lines/LineGeometry.js";
import { LineSegments2 } from "three/addons/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";
import { mountHologram } from "./hologram.js";

const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

function makeRenderer(canvas, alpha) {
  try {
    const r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha, powerPreference: "high-performance" });
    r.setPixelRatio(Math.min(devicePixelRatio, 2));
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    return r;
  } catch (e) {
    return null;
  }
}

// Run a render loop only while the element is on screen
function loopWhileVisible(el, tick) {
  let visible = false, last = performance.now(), raf = 0;
  const step = (now) => {
    raf = requestAnimationFrame(step);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!document.hidden) tick(dt, now / 1000);
  };
  new IntersectionObserver((es) => {
    const v = es[0].isIntersecting;
    if (v && !visible) { last = performance.now(); raf = requestAnimationFrame(step); }
    if (!v && visible) cancelAnimationFrame(raf);
    visible = v;
  }).observe(el);
}

/* ================================================================== */
/* Hero: a physically lit render of the finished module                */
/* ================================================================== */
function drawFrontTexture() {
  // Physical layout in mm: glass area 775 × 705, 36 half-cells 78.4 × 156.75 in 4 rows of 9
  const S = 2.64; // px per mm
  const W = Math.round(775 * S), H = Math.round(705 * S);
  const col = document.createElement("canvas"), orm = document.createElement("canvas");
  col.width = orm.width = W; col.height = orm.height = H;
  const c = col.getContext("2d"), o = orm.getContext("2d");
  // backsheet: white, matte, non-metal (orm: R unused, G roughness, B metalness)
  c.fillStyle = "#E4E7EB"; c.fillRect(0, 0, W, H);
  o.fillStyle = "rgb(0,215,0)"; o.fillRect(0, 0, W, H);
  const cw = 78.4 * S, ch = 156.75 * S, gx = 2 * S, gz = 8 * S;
  const rowW = 9 * cw + 8 * gx, colD = 4 * ch + 3 * gz;
  const x0 = (W - rowW) / 2, y0 = (H - colD) / 2;
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let r = 0; r < 4; r++) {
    for (let k = 0; k < 9; k++) {
      const x = x0 + k * (cw + gx), y = y0 + r * (ch + gz);
      const tint = (rnd() - 0.5) * 10; // B-grade cells vary a little in colour
      const g = c.createLinearGradient(x, y, x + cw, y + ch);
      g.addColorStop(0, `rgb(${8 + tint},${20 + tint},${52 + tint})`);
      g.addColorStop(1, `rgb(${4 + tint},${11 + tint},${32 + tint})`);
      c.fillStyle = g; c.fillRect(x, y, cw, ch);
      o.fillStyle = "rgb(0,60,0)"; o.fillRect(x, y, cw, ch);
      // silver fingers, perpendicular to the busbars
      c.fillStyle = "rgba(150,170,205,0.09)";
      for (let fx = x + 2; fx < x + cw; fx += 5) c.fillRect(fx, y, 1, ch);
    }
    // five tabbing ribbons run the full length of each row
    for (let b = 1; b <= 5; b++) {
      const y = y0 + r * (ch + gz) + (b / 6) * ch;
      c.fillStyle = "#C9CFD7"; c.fillRect(x0 - 6 * S, y - 3, rowW + 12 * S, 6);
      c.fillStyle = "rgba(255,255,255,.55)"; c.fillRect(x0 - 6 * S, y - 3, rowW + 12 * S, 1.5);
      o.fillStyle = "rgb(0,60,255)"; o.fillRect(x0 - 6 * S, y - 3, rowW + 12 * S, 6);
    }
  }
  // bus ribbons joining the rows in a serpentine, and the three leads
  const bus = (x, y, w, h) => { c.fillStyle = "#C3C9D1"; c.fillRect(x, y, w, h); o.fillStyle = "rgb(0,60,255)"; o.fillRect(x, y, w, h); };
  const bw = 5 * S, rowMid = (r) => y0 + r * (ch + gz) + ch / 2;
  bus(x0 + rowW + 4 * S, y0 + ch * 0.15, bw, ch * 1.7 + gz);
  bus(x0 - 4 * S - bw, y0 + ch + gz + ch * 0.15, bw, ch * 1.7 + gz);
  bus(x0 + rowW + 4 * S, y0 + 2 * (ch + gz) + ch * 0.15, bw, ch * 1.7 + gz);
  [rowMid(0), (rowMid(1) + rowMid(2)) / 2, rowMid(3)].forEach((y) => bus(0, y - bw / 2, x0 - 4 * S, bw));
  return { col, orm, W, H };
}

function drawBackLabel() {
  const cv = document.createElement("canvas");
  cv.width = 1200; cv.height = 800;
  const c = cv.getContext("2d");
  c.fillStyle = "#FFFFFF"; c.fillRect(0, 0, 1200, 800);
  c.fillStyle = "#0E1B2A"; c.fillRect(0, 0, 1200, 170);
  c.fillStyle = "#FFFFFF";
  c.font = "800 72px Archivo, Arial, sans-serif";
  c.fillText("DIY-36M-HC", 56, 105);
  c.font = "600 30px 'JetBrains Mono', monospace";
  c.fillStyle = "#F0A868";
  c.fillText("HAND-BUILT PV MODULE", 58, 148);
  c.fillStyle = "#111";
  const rows = [["Max power (Pmax)", "75–85 W"], ["Open-circuit voltage", "≈ 24 V"], ["Short-circuit current", "≈ 4.7 A"], ["Voltage at Pmax", "≈ 20 V"], ["Current at Pmax", "≈ 4.0 A"], ["Cells", "36 half-cut mono"]];
  rows.forEach(([k, v], i) => {
    const y = 250 + i * 76;
    c.font = "500 38px Arial, sans-serif"; c.fillText(k, 56, y);
    c.font = "700 38px 'JetBrains Mono', monospace";
    c.fillText(v, 1144 - c.measureText(v).width, y);
    c.fillStyle = "#B8BEC6"; c.fillRect(56, y + 22, 1088, 3); c.fillStyle = "#111";
  });
  c.font = "600 26px 'JetBrains Mono', monospace";
  c.fillText("STC 1000 W/m² · AM1.5 · 25 °C      LIVE WHEN LIT", 56, 760);
  c.strokeStyle = "#111"; c.lineWidth = 10; c.strokeRect(5, 5, 1190, 790);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function mountHero(host) {
  const canvas = host.querySelector("canvas");
  const renderer = makeRenderer(canvas, true);
  if (!renderer) return;
  renderer.setClearColor(0x000000, 0);
  renderer.toneMappingExposure = 1.0;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;
  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
  camera.position.set(0, 0.4, 16.5);

  const sunLight = new THREE.DirectionalLight(0xfff1dc, 2.4);
  scene.add(sunLight, new THREE.HemisphereLight(0xdfefff, 0x404550, 0.4));

  const aniso = renderer.capabilities.getMaxAnisotropy();
  const tex = drawFrontTexture();
  const map = new THREE.CanvasTexture(tex.col); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = aniso;
  const ormTex = new THREE.CanvasTexture(tex.orm); ormTex.anisotropy = aniso;

  const panel = new THREE.Group();
  const face = new THREE.Mesh(new THREE.PlaneGeometry(7.75, 7.05), new THREE.MeshPhysicalMaterial({
    map, roughnessMap: ormTex, metalnessMap: ormTex, roughness: 1, metalness: 1,
    clearcoat: 0.7, clearcoatRoughness: 0.03, envMapIntensity: 0.4
  }));
  face.rotation.x = -Math.PI / 2;
  face.position.y = 0.1;
  panel.add(face);

  const back = new THREE.Mesh(new THREE.PlaneGeometry(7.75, 7.05), new THREE.MeshStandardMaterial({ color: 0xF1F2F4, roughness: 0.85 }));
  back.rotation.x = Math.PI / 2;
  back.position.y = -0.12;
  panel.add(back);

  const label = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 2.8), new THREE.MeshStandardMaterial({ map: drawBackLabel(), roughness: 0.6 }));
  label.material.map.anisotropy = renderer.capabilities.getMaxAnisotropy();
  label.rotation.x = Math.PI / 2;
  label.rotation.z = Math.PI;
  label.position.set(0.9, -0.125, 1.0);
  panel.add(label);

  const dark = new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: 0.55 });
  const jbox = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.3, 1.5), dark);
  jbox.position.set(-2.6, -0.27, -2.2);
  panel.add(jbox);
  [-0.35, 0.35].forEach((dx, i) => {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-2.6 + dx, -0.3, -2.95),
      new THREE.Vector3(-2.6 + dx * 2, -0.5, -3.6),
      new THREE.Vector3(-2.6 + dx * 4, -0.9, -4.3),
      new THREE.Vector3(-2.6 + dx * 6 + (i ? 0.4 : -0.4), -1.6, -4.6)
    ]);
    panel.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 40, 0.07, 10, false), dark));
    const end = curve.getPoint(1);
    const mc4 = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.7, 20), dark);
    mc4.position.copy(end);
    mc4.lookAt(curve.getPoint(0.95));
    mc4.rotateX(Math.PI / 2);
    panel.add(mc4);
  });

  // L-profile aluminium frame: wall, top lip and bottom flange on each side
  const alu = new THREE.MeshStandardMaterial({ color: 0xC8CCD2, metalness: 1, roughness: 0.3 });
  const FX = 3.95, FZ = 3.6;
  [[0, -FZ, 8.0, true, -1], [0, FZ, 8.0, true, 1], [-FX, 0, 7.3, false, -1], [FX, 0, 7.3, false, 1]].forEach(([x, z, len, alongX, s]) => {
    const g = new THREE.Group();
    const wall = new THREE.Mesh(new THREE.BoxGeometry(alongX ? len : 0.08, 0.36, alongX ? 0.08 : len), alu);
    const lip = new THREE.Mesh(new THREE.BoxGeometry(alongX ? len : 0.22, 0.04, alongX ? 0.22 : len), alu);
    const flange = new THREE.Mesh(new THREE.BoxGeometry(alongX ? len : 0.3, 0.04, alongX ? 0.3 : len), alu);
    lip.position.set(alongX ? 0 : -s * 0.07, 0.16, alongX ? -s * 0.07 : 0);
    flange.position.set(alongX ? 0 : -s * 0.11, -0.16, alongX ? -s * 0.11 : 0);
    g.add(wall, lip, flange);
    g.position.set(x, 0, z);
    panel.add(g);
  });

  // Panel faces the viewer, tilted back like a mounted module
  const tilt = new THREE.Group();
  tilt.rotation.x = Math.PI / 2 - 0.42;
  tilt.add(panel);
  const yaw = new THREE.Group();
  yaw.add(tilt);
  scene.add(yaw);

  // soft contact shadow
  const sh = document.createElement("canvas"); sh.width = sh.height = 128;
  const sc = sh.getContext("2d");
  const rg = sc.createRadialGradient(64, 64, 4, 64, 64, 64);
  rg.addColorStop(0, "rgba(0,0,0,.35)"); rg.addColorStop(1, "rgba(0,0,0,0)");
  sc.fillStyle = rg; sc.fillRect(0, 0, 128, 128);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(11, 3.2), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sh), transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = -4.6;
  scene.add(shadow);

  // Drag to turn it over, with inertia
  let yawV = 0, dragging = false, lastX = 0, idle = 0, pitch = 0, pitchT = 0;
  canvas.addEventListener("pointerdown", (e) => { dragging = true; lastX = e.clientX; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener("pointermove", (e) => {
    const r = canvas.getBoundingClientRect();
    pitchT = ((e.clientY - r.top) / r.height - 0.5) * 0.25;
    if (!dragging) return;
    const dx = e.clientX - lastX; lastX = e.clientX;
    yaw.rotation.y += dx * 0.008;
    yawV = dx * 0.008 / 0.016;
    idle = 0;
  });
  const end = () => { dragging = false; };
  canvas.addEventListener("pointerup", end);
  canvas.addEventListener("pointercancel", end);
  canvas.addEventListener("pointerleave", () => { pitchT = 0; });
  canvas.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") { yaw.rotation.y += e.key === "ArrowLeft" ? -0.3 : 0.3; idle = 0; e.preventDefault(); }
  });

  function resize() {
    const w = Math.max(1, host.clientWidth), h = Math.max(1, host.clientHeight);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w / h < 1.2 ? 34 : 28;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(host);
  resize();
  host.classList.add("is-live");
  yaw.rotation.y = -0.55;

  loopWhileVisible(host, (dt, t) => {
    if (!dragging) {
      yaw.rotation.y += yawV * dt;
      yawV *= Math.exp(-3 * dt);
      idle += dt;
      if (!reduce && idle > 2.5) yaw.rotation.y += dt * 0.22;
    }
    pitch += (pitchT - pitch) * (1 - Math.exp(-4 * dt));
    tilt.rotation.z = pitch * 0.4;
    yaw.position.y = reduce ? 0 : Math.sin(t * 0.8) * 0.12;
    // the sun drifts so a glint travels across the glass
    const a = reduce ? 0.6 : t * 0.25;
    sunLight.position.set(Math.cos(a) * 9, 7 + Math.sin(a * 0.7) * 2, 6 + Math.sin(a) * 4);
    renderer.render(scene, camera);
  });
}

/* ================================================================== */
/* 3D power surface: P(V, G) for the configured panel                  */
/* ================================================================== */
function mountSurface(host) {
  const canvas = host.querySelector("canvas");
  const renderer = makeRenderer(canvas, false);
  if (!renderer) { host.querySelector("[data-surface-msg]").textContent = "3D view isn't available in this browser."; return null; }
  renderer.setClearColor(0x06121c, 1);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  camera.position.set(9.5, 7.2, 11.5);
  const controls = new OrbitControls(camera, canvas);
  canvas.style.touchAction = "pan-y";
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.enableZoom = false;
  controls.target.set(0, 1.2, 0);
  controls.maxPolarAngle = 1.45;
  controls.autoRotate = !reduce;
  controls.autoRotateSpeed = 0.45;
  controls.addEventListener("start", () => { controls.autoRotate = false; });

  scene.add(new THREE.HemisphereLight(0xcfefff, 0x0a1a28, 0.9));
  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(4, 10, 6);
  scene.add(key);

  const W = 8, D = 6, H = 4;
  const lineMats = [];
  const lm = (color, width, opacity) => {
    const m = new LineMaterial({ color, linewidth: width, transparent: true, opacity, depthWrite: false });
    lineMats.push(m); return m;
  };

  // box grid: floor + two back walls
  const gp = [];
  for (let i = 0; i <= 10; i++) {
    const x = -W / 2 + (i / 10) * W, z = -D / 2 + (i / 10) * D;
    gp.push(x, 0, -D / 2, x, 0, D / 2, -W / 2, 0, z, W / 2, 0, z);
    gp.push(x, 0, -D / 2, x, H, -D / 2);
    gp.push(-W / 2, 0, z, -W / 2, H, z);
  }
  for (let i = 1; i <= 4; i++) {
    const y = (i / 4) * H;
    gp.push(-W / 2, y, -D / 2, W / 2, y, -D / 2, -W / 2, y, -D / 2, -W / 2, y, D / 2);
  }
  const gridG = new LineSegmentsGeometry(); gridG.setPositions(gp);
  scene.add(new LineSegments2(gridG, lm(0x1d4a60, 1, 0.8)));

  const surfMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.05, side: THREE.DoubleSide, transparent: true, opacity: 0.92 });
  let surf = null, wire = null;
  const slice = new Line2(new LineGeometry(), lm(0xffffff, 4, 1));
  const ridge = new Line2(new LineGeometry(), lm(0xffb050, 2.4, 0.95));
  scene.add(slice, ridge);
  const mpp = new THREE.Mesh(new THREE.SphereGeometry(0.12, 24, 16), new THREE.MeshBasicMaterial({ color: 0xffb050 }));
  const halo = new THREE.Mesh(new THREE.SphereGeometry(0.26, 24, 16), new THREE.MeshBasicMaterial({ color: 0xffb050, transparent: true, opacity: 0.25, depthWrite: false }));
  scene.add(mpp, halo);

  // axis labels as HTML so they stay crisp
  const layer = host.querySelector("[data-surface-labels]");
  const labels = [];
  const addLabel = (cls) => { const el = document.createElement("div"); el.className = "sl " + cls; layer.append(el); const L = { el, p: new THREE.Vector3() }; labels.push(L); return L; };
  const vTicks = [0, 1, 2].map(() => addLabel("tick"));
  const gTicks = [0, 1, 2].map(() => addLabel("tick"));
  const pTicks = [0, 1, 2].map(() => addLabel("tick"));
  const tV = addLabel("title"), tG = addLabel("title"), tP = addLabel("title"), tM = addLabel("mpp");
  tV.el.textContent = "Voltage (V)"; tG.el.textContent = "Irradiance (W/m²)"; tP.el.textContent = "Power (W)";

  const ramp = [new THREE.Color("#0B3D5C"), new THREE.Color("#1FA8D6"), new THREE.Color("#3FE0FF"), new THREE.Color("#FFD08A"), new THREE.Color("#FFB050")];
  const colorAt = (t, out) => {
    const f = Math.min(0.9999, Math.max(0, t)) * (ramp.length - 1), i = Math.floor(f);
    return out.copy(ramp[i]).lerp(ramp[i + 1], f - i);
  };

  function build(p) {
    const { model, CELLS } = window.solarModel;
    const cell = CELLS[p.cellType];
    const xMax = model(cell, p.ns, 1100, 0).Voc * 1.02;
    const pMax = model(cell, p.ns, 1100, 0).mpp.P * 1.05;
    const X = (v) => -W / 2 + (v / xMax) * W, Y = (pp) => (pp / pMax) * H, Z = (g) => D / 2 - ((g - 100) / 1000) * D;
    const ROWS = 41, COLS = 61;
    const pos = new Float32Array(ROWS * COLS * 3), colr = new Float32Array(ROWS * COLS * 3), idx = [];
    const c = new THREE.Color();
    const ridgePts = [];
    for (let r = 0; r < ROWS; r++) {
      const G = 100 + (r / (ROWS - 1)) * 1000;
      const m = model(cell, p.ns, G, p.temp);
      for (let k = 0; k < COLS; k++) {
        const pt = m.pts[Math.round((k / (COLS - 1)) * (m.pts.length - 1))];
        const i = (r * COLS + k) * 3;
        pos[i] = X(pt.V); pos[i + 1] = Y(pt.P); pos[i + 2] = Z(G);
        colorAt(pt.P / pMax, c);
        colr[i] = c.r; colr[i + 1] = c.g; colr[i + 2] = c.b;
      }
      ridgePts.push(X(m.mpp.V), Y(m.mpp.P) + 0.01, Z(G));
    }
    for (let r = 0; r < ROWS - 1; r++) for (let k = 0; k < COLS - 1; k++) {
      const a = r * COLS + k, b = a + 1, d = a + COLS, e = d + 1;
      idx.push(a, d, b, b, d, e);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.BufferAttribute(colr, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    if (surf) { scene.remove(surf); surf.geometry.dispose(); }
    surf = new THREE.Mesh(g, surfMat);
    scene.add(surf);

    // iso-lines every 100 W/m²
    const wp = [];
    for (let r = 0; r < ROWS; r += 4) for (let k = 0; k < COLS - 1; k++) {
      const i = (r * COLS + k) * 3, j = i + 3;
      wp.push(pos[i], pos[i + 1] + 0.005, pos[i + 2], pos[j], pos[j + 1] + 0.005, pos[j + 2]);
    }
    const wg = new LineSegmentsGeometry(); wg.setPositions(wp);
    if (wire) { scene.remove(wire); wire.geometry.dispose(); }
    wire = new LineSegments2(wg, wire ? wire.material : lm(0x02121e, 1, 0.55));
    scene.add(wire);

    ridge.geometry.dispose();
    ridge.geometry = new LineGeometry(); ridge.geometry.setPositions(ridgePts);
    ridge.computeLineDistances();

    const cm = model(cell, p.ns, p.irr, p.temp);
    const sp = [];
    cm.pts.forEach((pt, i) => { if (i % 2 === 0) sp.push(X(pt.V), Y(pt.P) + 0.05, Z(p.irr)); });
    slice.geometry.dispose();
    slice.geometry = new LineGeometry(); slice.geometry.setPositions(sp);
    mpp.position.set(X(cm.mpp.V), Y(cm.mpp.P) + 0.02, Z(p.irr));
    halo.position.copy(mpp.position);

    const nice = (v) => (v >= 100 ? Math.round(v) : +v.toFixed(1));
    [0, 0.5, 1].forEach((f, i) => {
      vTicks[i].el.textContent = nice(xMax * f); vTicks[i].p.set(-W / 2 + f * W, 0, D / 2 + 0.35);
      gTicks[i].el.textContent = Math.round(100 + f * 1000); gTicks[i].p.set(W / 2 + 0.35, 0, D / 2 - f * D);
      pTicks[i].el.textContent = nice(pMax * f); pTicks[i].p.set(-W / 2 - 0.25, f * H, -D / 2);
    });
    tV.p.set(0, 0, D / 2 + 1.0); tG.p.set(W / 2 + 1.2, 0, 0); tP.p.set(-W / 2 - 0.3, H + 0.45, -D / 2);
    tM.el.textContent = `MPP ${cm.mpp.P.toFixed(1)} W`;
    tM.p.copy(mpp.position).add(new THREE.Vector3(0.2, 0.35, 0));
  }

  function resize() {
    const w = Math.max(1, host.clientWidth), h = Math.max(1, host.clientHeight);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.position.setLength(w / h < 1 ? 23 : 17.5);
    camera.updateProjectionMatrix();
    lineMats.forEach((m) => m.resolution.set(w, h));
  }
  new ResizeObserver(resize).observe(host);
  resize();

  const v = new THREE.Vector3();
  loopWhileVisible(host, (dt, t) => {
    controls.update();
    halo.scale.setScalar(1 + 0.25 * Math.sin(t * 4));
    const w = host.clientWidth, h = host.clientHeight;
    labels.forEach((L) => {
      v.copy(L.p).project(camera);
      L.el.style.transform = `translate(${((v.x * 0.5 + 0.5) * w).toFixed(1)}px, ${((-v.y * 0.5 + 0.5) * h).toFixed(1)}px) translate(-50%, -50%)`;
      L.el.style.opacity = v.z < 1 ? 1 : 0;
    });
    renderer.render(scene, camera);
  });
  host.querySelector("[data-surface-msg]").hidden = true;
  return build;
}

/* ================================================================== */
/* Boot                                                                */
/* ================================================================== */
const hero = document.getElementById("heroPanel");
if (hero) mountHero(hero);

const holo = document.getElementById("holoEmbed");
if (holo) mountHologram(holo, { mode: "embed" });

// The 3D surface mounts the first time its tab is opened
const surfaceHost = document.getElementById("ivSurface");
let buildSurface = null, lastParams = window.solarModel ? window.solarModel.params() : null;
addEventListener("ivchange", (e) => { lastParams = e.detail; if (buildSurface) buildSurface(lastParams); });
addEventListener("ivview", (e) => {
  if (e.detail !== "surface" || buildSurface || !surfaceHost) return;
  buildSurface = mountSurface(surfaceHost);
  if (buildSurface && lastParams) buildSurface(lastParams);
});
if (surfaceHost && !surfaceHost.hidden) dispatchEvent(new CustomEvent("ivview", { detail: "surface" }));
