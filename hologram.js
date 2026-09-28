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
    s: [1, 1, 1, 0, 1, 1, 1, 0, 0, 0], cam: [0.75, 1.02, 21.5], dur: 7.5 },
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
.holo .holo-leaders{position:absolute;inset:0;width:100%;height:100%;z-index:3;pointer-events:none;overflow:visible}
.holo .holo-leaders path{fill:none;stroke:var(--h-cyan);stroke-width:1;opacity:0;transition:opacity .5s;filter:drop-shadow(0 0 3px rgba(70,232,255,.8))}
.holo .holo-leaders circle{fill:var(--h-bg);stroke:var(--h-cyan);stroke-width:1.5;opacity:0;transition:opacity .5s;filter:drop-shadow(0 0 4px rgba(70,232,255,.9))}
.holo .holo-label.call{padding:6px 11px;border:1px solid rgba(70,232,255,.5);border-radius:2px;background:rgba(2,16,26,.78);box-shadow:0 0 14px -4px rgba(70,232,255,.45)}
.holo .holo-leaders path.amber{stroke:var(--h-amber);filter:drop-shadow(0 0 3px rgba(255,179,92,.8))}
.holo .holo-leaders circle.amber{stroke:var(--h-amber);filter:drop-shadow(0 0 4px rgba(255,179,92,.9))}
.holo .holo-label.call.amber{border-color:rgba(255,179,92,.55);box-shadow:0 0 14px -4px rgba(255,179,92,.45)}
.holo .holo-label.call::before,.holo .holo-label.call::after{display:none}
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
.holo .holo-zoom{display:flex;gap:6px}
.holo .holo-zoom .holo-btn{width:34px;padding:6px 0;font-size:.95rem;line-height:1}
.holo .holo-parts{flex-basis:100%;display:flex;flex-wrap:wrap;align-items:center;gap:6px}
.holo .holo-parts span{font-size:.64rem;letter-spacing:.16em;text-transform:uppercase;color:var(--h-dim);margin-right:4px}
.holo .holo-parts button{font-family:var(--h-mono);font-size:.66rem;letter-spacing:.08em;text-transform:uppercase;color:var(--h-ink);background:transparent;border:1px solid #16404F;border-radius:12px;padding:4px 10px;cursor:pointer}
.holo .holo-parts button:hover{border-color:var(--h-cyan);color:var(--h-cyan)}
.holo .holo-parts button[aria-pressed="true"]{background:rgba(70,232,255,.14);border-color:var(--h-cyan);color:var(--h-cyan)}
.holo .holo-parts button:focus-visible{outline:2px solid var(--h-amber);outline-offset:2px}
.holo .holo-label.call[data-part]{pointer-events:auto;cursor:pointer}
.holo .holo-label.call[data-part]:hover{border-color:var(--h-cyan);background:rgba(8,38,51,.9)}
.holo .holo-caption{transition:opacity .4s}
.holo.is-inspecting .holo-caption{opacity:0}
.holo .holo-inspect{position:absolute;z-index:4;top:12px;right:12px;bottom:12px;width:min(360px,42%);overflow:auto;padding:16px 18px 18px;
  background:rgba(3,18,28,.88);border:1px solid rgba(70,232,255,.35);border-radius:6px;box-shadow:0 0 30px -8px rgba(70,232,255,.35);
  backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);transform:translateX(calc(100% + 24px));opacity:0;pointer-events:none;
  transition:transform .55s cubic-bezier(.2,.8,.2,1),opacity .4s}
.holo.is-inspecting .holo-inspect{transform:none;opacity:1;pointer-events:auto}
@media (max-width:640px){
  .holo .holo-inspect{left:10px;right:10px;top:auto;bottom:10px;width:auto;max-height:60%;transform:translateY(calc(100% + 24px))}
}
.holo .hi-top{display:flex;justify-content:space-between;align-items:center;gap:8px}
.holo .hi-k{font-size:.64rem;letter-spacing:.18em;text-transform:uppercase;color:var(--h-amber)}
.holo .hi-x{background:none;border:1px solid #1B5566;border-radius:3px;color:var(--h-cyan);width:28px;height:28px;cursor:pointer;font-size:1rem;line-height:1}
.holo .hi-x:hover{background:#082633}
.holo .hi-x:focus-visible{outline:2px solid var(--h-amber);outline-offset:2px}
.holo .hi-name{display:block;font-family:var(--h-display);font-stretch:125%;font-weight:800;font-size:1.45rem;line-height:1.1;margin:.35em 0 .15em;color:#EAFDFF;text-shadow:0 0 14px rgba(70,232,255,.45)}
.holo .hi-role{display:block;font-size:.72rem;color:var(--h-cyan);letter-spacing:.04em}
.holo .hi-specs{display:grid;grid-template-columns:auto 1fr;gap:4px 12px;margin:14px 0 4px;padding:10px 0;border-top:1px solid #12394A;border-bottom:1px solid #12394A;font-size:.72rem}
.holo .hi-specs dt{color:var(--h-dim);text-transform:uppercase;letter-spacing:.08em;font-size:.64rem;align-self:center}
.holo .hi-specs dd{margin:0;color:#EAFDFF;text-align:right;font-variant-numeric:tabular-nums}
.holo .holo-inspect h4{margin:14px 0 4px;font-size:.64rem;letter-spacing:.18em;text-transform:uppercase;color:var(--h-cyan);font-weight:600}
.holo .holo-inspect p{margin:0;font-size:.8rem;line-height:1.6;color:var(--h-ink)}
.holo .hi-nav{display:flex;justify-content:space-between;gap:8px;margin-top:16px}
.holo .hi-back{width:100%;margin-top:8px;border-color:var(--h-cyan)}
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

/* Parts you can click to inspect. view: camera centre [x, y, z], azimuth, polar angle, distance */
const PARTS = [
  { id: "front", name: "Front sheet", role: "3 mm UV-stabilised polycarbonate",
    specs: [["Light through", "≈ 88–91%"], ["Thickness", "3 mm"], ["Cost", "$25–50"]],
    does: "Shields the cells from rain, hail, dust and fingers while letting almost all of the sunlight through. It sits on butyl-tape spacers just above the cells.",
    why: "Silicon cells are about 0.18 mm thick and crack under a light knock. The trade-off is optical: the air gap under the sheet adds two reflecting surfaces and costs roughly 8% of the power.",
    view: { c: [0, 2.48, 0], az: 0.6, pol: 0.95, dist: 14 } },
  { id: "cells", name: "Solar cells", role: "36 half-cut mono PERC, in series",
    specs: [["Size", "156.75 × 78.4 mm"], ["Per cell", "0.675 V · 4.75 A"], ["String", "≈ 24 V open-circuit"]],
    does: "Each cell turns light into about 0.6 V. Wired in series, 36 of them add up to ≈ 24 V open-circuit and ≈ 20 V at max power, enough to charge a 12 V battery even on a hot day.",
    why: "Half-cut cells carry half the current of full cells, so less power is lost as heat in the ribbons. A series string runs at its weakest cell's current, which is why the guide sorts cells within ±3%.",
    view: { c: [0, 0.96, 0], az: 0.3, pol: 0.7, dist: 12.5 } },
  { id: "ribbons", name: "Tabbing and bus ribbon", role: "Tinned copper, 2 × 0.15 mm and 5 × 0.25 mm",
    specs: [["Tabbing", "180 pieces"], ["Soldering", "≈ 340 °C, one stroke"], ["Leads out", "A · B · C"]],
    does: "Tabbing ribbon runs along each cell's front busbars and onto the back of the next cell, joining them in series. Wider bus ribbon links the rows at the ends and brings three leads out to the junction box.",
    why: "Every joint is a place to lose power or fail. Dull, cold joints raise resistance and lower the fill factor, and a single broken ribbon drops the whole string to zero.",
    view: { c: [0, 0.96, 0], az: -0.35, pol: 0.55, dist: 9 }, state: { flow: 1 } },
  { id: "backing", name: "Backing panel", role: "3 mm aluminium composite panel",
    specs: [["Material", "ACM, painted"], ["Cells held by", "1 silicone dab each"], ["Cost", "$12–28 with film"]],
    does: "Gives the sandwich its stiffness and seals it from behind. Each cell rests on it with a single dab of neutral-cure silicone, which lets the cells expand in the heat without cracking.",
    why: "The skins are aluminium, so lay an insulating film (PET or backsheet) over the panel before the cells go down. No ribbon or lead should ever be able to touch bare metal.",
    view: { c: [0, -1.05, 0], az: 0.9, pol: 1.05, dist: 14.5 } },
  { id: "jbox", name: "Junction box", role: "IP65 box with 2 bypass diodes",
    specs: [["Diodes", "2 × 15 A Schottky"], ["Each guards", "18 cells"], ["Output", "4 mm² cable, MC4"]],
    does: "Collects the three leads from the cell string and connects them to the output cable. Inside, two bypass diodes each span half of the panel.",
    why: "If part of the panel is shaded, a diode lets current flow around those 18 cells instead of through them. Without it, one shaded cell would limit the whole panel and could overheat into a hot spot.",
    view: { c: [-2.9, -2.24, 0], az: 0.95, pol: 1.25, dist: 6.5 } },
  { id: "frame", name: "Aluminium frame", role: "25 × 25 × 2 mm L-angle",
    specs: [["Length", "≈ 3 m total"], ["Corners", "Mitred, riveted"], ["Cost", "$15–25"]],
    does: "Clamps the front sheet, cells and backing into one rigid module and gives you something to bolt it down by.",
    why: "It protects the fragile edges of the front sheet and stops the panel flexing, because flexing cracks cells. Bedded in silicone, the frame edge is the first line of defence against water.",
    view: { c: [0, 0.03, 0], az: -0.6, pol: 0.95, dist: 15 }, state: { fin: 1, ex: 0.25 } }
];
const PART_INDEX = Object.fromEntries(PARTS.map((P, i) => [P.id, i]));
const PICK_PRIORITY = ["jbox", "frame", "cells", "ribbons", "front", "backing"];

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
      <svg class="holo-leaders" data-leaders aria-hidden="true"></svg>
      <div data-labels></div>
      <aside class="holo-inspect" data-inspect aria-label="Part details" inert>
        <div class="hi-top"><span class="hi-k" data-hi-k></span><button class="hi-x" type="button" data-hi-close aria-label="Close part details">×</button></div>
        <strong class="hi-name" data-hi-name></strong>
        <span class="hi-role" data-hi-role></span>
        <dl class="hi-specs" data-hi-specs></dl>
        <h4>What it does</h4><p data-hi-does></p>
        <h4>Why it matters</h4><p data-hi-why></p>
        <div class="hi-nav"><button class="holo-btn" type="button" data-hi-prev>‹ Prev part</button><button class="holo-btn" type="button" data-hi-next>Next part ›</button></div>
        <button class="holo-btn hi-back" type="button" data-hi-close>Back to the build</button>
      </aside>
      <div class="holo-caption" aria-live="polite"><div class="inner"><span class="n" data-n></span><strong class="holo-title" data-title></strong><p data-text></p></div></div>
      <div class="holo-fallback" data-fallback hidden></div>
    </div>
    <div class="holo-controls">
      <button class="holo-btn" type="button" data-prev aria-label="Previous stage">Prev</button>
      <button class="holo-btn" type="button" data-play>Pause</button>
      <button class="holo-btn" type="button" data-next aria-label="Next stage">Next</button>
      <div class="holo-dots" data-dots role="group" aria-label="Build stages"></div>
      <div class="holo-zoom"><button class="holo-btn" type="button" data-zoom-out aria-label="Zoom out">−</button><button class="holo-btn" type="button" data-zoom-in aria-label="Zoom in">+</button></div>
      <div class="holo-parts" data-parts role="group" aria-label="Inspect a part"><span>Inspect</span></div>
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
    $("[data-meta]").innerHTML = `Stage ${pad(stage + 1)} / ${pad(STAGES.length)}<br><span class="dim">Drag to rotate · click a part</span>`;
    dots.forEach((d, i) => {
      d.classList.toggle("on", i === stage);
      d.classList.toggle("done", i < stage);
      if (i === stage) d.setAttribute("aria-current", "step"); else d.removeAttribute("aria-current");
    });
    playBtn.textContent = playing ? "Pause" : "Play";
  }
  let onStage = () => {}, leaveInspect = () => {}, openPart = () => {}, zoomBy = () => {};
  let inspect = null;
  function go(i, byUser, instant = false) {
    if (inspect !== null) leaveInspect(false);
    stage = (i + STAGES.length) % STAGES.length;
    stageClock = 0;
    if (byUser && reduce) playing = false;
    caption();
    onStage(stage, instant);
  }
  $("[data-prev]").addEventListener("click", () => go(stage - 1, true));
  $("[data-next]").addEventListener("click", () => go(stage + 1, true));
  playBtn.addEventListener("click", () => {
    if (inspect !== null) { leaveInspect(true); playing = true; caption(); return; }
    playing = !playing; stageClock = 0; caption();
  });
  $("[data-zoom-in]").addEventListener("click", () => zoomBy(0.8));
  $("[data-zoom-out]").addEventListener("click", () => zoomBy(1.25));
  const partBtns = PARTS.map((P, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = P.name;
    b.setAttribute("aria-pressed", "false");
    b.addEventListener("click", () => (inspect === i ? leaveInspect(true) : openPart(i)));
    $("[data-parts]").append(b);
    return b;
  });
  root.querySelectorAll("[data-hi-close]").forEach((b) => b.addEventListener("click", () => leaveInspect(true)));
  $("[data-hi-prev]").addEventListener("click", () => openPart((inspect + PARTS.length - 1) % PARTS.length));
  $("[data-hi-next]").addEventListener("click", () => openPart((inspect + 1) % PARTS.length));
  root.addEventListener("keydown", (e) => {
    if (e.target.closest("button") && e.key === " ") return;
    if (e.key === "Escape" && inspect !== null) { leaveInspect(true); e.preventDefault(); return; }
    if (e.key === "+" || e.key === "=") { zoomBy(0.8); e.preventDefault(); return; }
    if (e.key === "-" || e.key === "_") { zoomBy(1.25); e.preventDefault(); return; }
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
  renderer.toneMappingExposure = 0.72;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 200);
  const controls = new OrbitControls(camera, canvas);
  canvas.style.touchAction = "pan-y"; // let phones scroll past the hologram
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.enablePan = false;
  controls.enableZoom = mode === "full"; // embedded in the site, the wheel keeps scrolling the page
  controls.zoomSpeed = 0.7;
  controls.minDistance = 4;
  controls.maxDistance = 48;
  controls.rotateSpeed = 0.55;
  controls.minPolarAngle = 0.15;
  controls.maxPolarAngle = 2.25;
  controls.autoRotateSpeed = 0.35;
  controls.target.set(0, -0.2, 0);

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.55, 0.4, 0.38);
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
      vec3 col = uColor * (0.34 + fres * 0.65 + m * 0.7 + band * 0.55) * (1.0 + uPulse * 1.8);
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
  function setPulse(grp, p) {
    grp.userData.mesh.material.uniforms.uPulse.value = p;
    (grp.userData.extra || []).forEach((x) => setPulse(x, p));
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
    { t: "Front sheet · 3 mm polycarbonate", o: front, p: [3.2, 0, -2.9], s: [0, 5], call: true, part: "front" },
    { t: "36 × PERC half-cells", o: cellsG, p: [2.6, 0, 2.2], s: [0, 1], call: true, part: "cells" },
    { t: "Tabbing ribbon · 180 pcs", o: cellsG, p: [0.8, 0.02, rowZ(1) + 0.4], s: [2], call: true, part: "ribbons" },
    { t: "Series string · ≈ 24 V open-circuit", o: cellsG, p: [LEAD_X, 0.03, rowZ(0)], s: [3], call: true, part: "ribbons" },
    { t: "Backing panel · aluminium composite", o: backing, p: [-3.2, 0, 2.9], s: [0], call: true, part: "backing" },
    { t: "790 mm", o: backing, p: [0.2, 0, HZ + 0.7], s: [0] },
    { t: "715 mm", o: backing, p: [HX + 0.7, 0, 0.2], s: [0] },
    { t: "J-box · 2 × 15 A bypass diodes", o: jbox, p: [0, 0.15, 0], s: [0, 4], call: true, part: "jbox" },
    { t: "Aluminium frame · 25 mm angle", o: frameBars[1], p: [2.8, 0.15, 0], s: [0, 6], call: true, part: "frame" },
    { t: "≈ 1000 W/m² sunlight", o: scene, p: [SUN.x, SUN.y, SUN.z], s: [7], amber: true, call: true },
    { t: `Max power point · ${MPP.P.toFixed(0)} W @ ${MPP.V.toFixed(1)} V`, o: scene, p: [vx(MPP.V), py(MPP.P), CZ], s: [7], amber: true, call: true },
    { t: `I–V curve · Voc ${VOC.toFixed(1)} V`, o: scene, p: [CX0, CY1 - 0.4, CZ], s: [7], call: true }
  ];
  const labelLayer = $("[data-labels]"), leaderLayer = $("[data-leaders]");
  LABELS.forEach((L) => {
    L.el = document.createElement("div");
    L.el.className = "holo-label" + (L.amber ? " amber" : "");
    L.el.textContent = L.t;
    L.el.setAttribute("aria-hidden", "true");
    if (L.part) {
      L.el.dataset.part = L.part;
      L.el.addEventListener("click", () => openPart(PART_INDEX[L.part]));
    }
    labelLayer.append(L.el);
    L.v = new THREE.Vector3();
    if (L.call) {
      L.line = document.createElementNS("http://www.w3.org/2000/svg", "path");
      L.dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      L.dot.setAttribute("r", "3");
      if (L.amber) { L.line.classList.add("amber"); L.dot.classList.add("amber"); }
      leaderLayer.append(L.line, L.dot);
    }
  });

  /* ---------------- State and choreography ---------------- */
  const cur = {}, tgt = {};
  K.forEach((k, i) => { cur[k] = tgt[k] = STAGES[0].s[i]; });
  cur.dim = tgt.dim = 1;
  let flick = 0, viewOff = 0;
  const mul = { front: 1, cells: 1, ribbons: 1, backing: 1, jbox: 1, frame: 1, fx: 1 };
  const sph = new THREE.Spherical();
  let camAnim = null, zoomAnim = null, idleHold = 0, sizeMul = 1, userZoom = 1, viewBase = 20, resumePlay = false, hovered = null;
  const HOME = new THREE.Vector3(0, -0.2, 0);
  const ZMIN = 0.45, ZMAX = 1.9;

  // Camera view for the current stage, or for the part being inspected
  function viewFor() {
    if (inspect !== null) {
      const v = PARTS[inspect].view;
      return { az: v.az, pol: v.pol, base: v.dist * sizeMul, target: new THREE.Vector3(...v.c) };
    }
    const [az, pol, dist] = STAGES[stage].cam;
    return { az, pol, base: dist * sizeMul, target: HOME };
  }
  const camFor = () => { const v = viewFor(); return { az: v.az, pol: v.pol, dist: v.base * userZoom }; };
  function placeCam(v) {
    sph.set(v.dist, v.pol, v.az);
    camera.position.setFromSpherical(sph).add(controls.target);
    camera.lookAt(controls.target);
  }
  function flyTo(snap) {
    const v = viewFor();
    viewBase = v.base;
    sph.setFromVector3(camera.position.clone().sub(controls.target));
    let dAz = v.az - sph.theta;
    dAz = Math.atan2(Math.sin(dAz), Math.cos(dAz));
    camAnim = {
      from: { az: sph.theta, pol: sph.phi, dist: sph.radius },
      to: { az: sph.theta + dAz, pol: v.pol, dist: v.base * userZoom },
      tFrom: controls.target.clone(), tTo: v.target.clone(), t: 0
    };
    zoomAnim = null;
    if (snap) { controls.target.copy(v.target); placeCam({ az: v.az, pol: v.pol, dist: v.base * userZoom }); camAnim = null; }
  }
  zoomBy = (f) => {
    userZoom = THREE.MathUtils.clamp(userZoom * f, ZMIN, ZMAX);
    if (camAnim) { camAnim.to.dist = viewBase * userZoom; return; }
    zoomAnim = { from: camera.position.distanceTo(controls.target), to: viewBase * userZoom, t: reduce ? 1 : 0 };
    idleHold = Math.max(idleHold, 3);
  };
  controls.addEventListener("end", () => {
    if (!camAnim) userZoom = THREE.MathUtils.clamp(camera.position.distanceTo(controls.target) / viewBase, ZMIN, ZMAX);
  });

  const inspectEl = $("[data-inspect]");
  function fillPanel(i) {
    const P = PARTS[i];
    $("[data-hi-k]").textContent = `Part ${pad(i + 1)} / ${pad(PARTS.length)}`;
    $("[data-hi-name]").textContent = P.name;
    $("[data-hi-role]").textContent = P.role;
    $("[data-hi-specs]").replaceChildren(...P.specs.flatMap(([k, v]) => {
      const dt = document.createElement("dt"); dt.textContent = k;
      const dd = document.createElement("dd"); dd.textContent = v;
      return [dt, dd];
    }));
    $("[data-hi-does]").textContent = P.does;
    $("[data-hi-why]").textContent = P.why;
  }
  const markParts = () => partBtns.forEach((b, i) => b.setAttribute("aria-pressed", String(i === inspect)));
  openPart = (i) => {
    if (inspect === null) resumePlay = playing;
    playing = false;
    inspect = i;
    const INSPECT = [1, 1, 1, 0, 1, 1, 1, 0, 0, 0];
    K.forEach((k, j) => { tgt[k] = INSPECT[j]; });
    Object.assign(tgt, PARTS[i].state || {});
    tgt.dim = PARTS[i].id === "backing" ? 1 : 0;
    fillPanel(i);
    root.classList.add("is-inspecting");
    inspectEl.inert = false;
    markParts();
    caption();
    flyTo(reduce);
    if (reduce) { K.forEach((k) => { cur[k] = tgt[k]; }); cur.dim = tgt.dim; }
    flick = reduce ? 0 : 0.16;
  };
  leaveInspect = (restore) => {
    if (inspect === null) return;
    inspect = null;
    root.classList.remove("is-inspecting");
    inspectEl.inert = true;
    markParts();
    if (restore) { playing = resumePlay; stageClock = 0; caption(); onStage(stage); }
  };
  onStage = (i, instant) => {
    const snap = reduce || instant;
    const st = STAGES[i];
    K.forEach((k, j) => { tgt[k] = st.s[j]; });
    tgt.dim = i === 0 ? 1 : 0;
    if (st.enter) Object.assign(cur, st.enter);
    if (i === 7) cur.power = 0;
    flyTo(snap);
    if (snap) { K.forEach((k) => { cur[k] = tgt[k]; }); cur.dim = tgt.dim; }
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
    if (mul !== sizeMul) { sizeMul = mul; viewBase = viewFor().base; if (!camAnim) placeCam(camFor()); }
  }
  new ResizeObserver(resize).observe(stageEl);
  resize();
  controls.target.copy(HOME);
  placeCam(camFor());
  controls.update();

  /* ---------------- Picking: hover and click a part ---------------- */
  const pickables = [];
  const register = (obj, id) => obj.traverse((o) => { if (o.isMesh && !o.isLineSegments2 && !o.isLine2) { o.userData.part = id; pickables.push(o); } });
  register(front, "front"); register(backing, "backing"); register(jbox, "jbox");
  cells.forEach((c) => register(c, "cells"));
  frameBars.forEach((b) => register(b, "frame"));
  const raycaster = new THREE.Raycaster(), ndc = new THREE.Vector2();
  const shown = (o) => { for (let n = o; n; n = n.parent) if (!n.visible) return false; return true; };
  function pickAt(clientX, clientY) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    let best = null;
    for (const h of raycaster.intersectObjects(pickables, false)) {
      if (!shown(h.object)) continue;
      const id = h.object.userData.part;
      if (best === null || PICK_PRIORITY.indexOf(id) < PICK_PRIORITY.indexOf(best)) best = id;
    }
    return best;
  }
  let down = null;
  canvas.addEventListener("pointerdown", (e) => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
  canvas.addEventListener("pointerup", (e) => {
    if (!down) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y), quick = performance.now() - down.t < 500;
    down = null;
    if (moved > 6 || !quick) return;
    const id = pickAt(e.clientX, e.clientY);
    if (id) openPart(PART_INDEX[id]);
    else if (inspect !== null) leaveInspect(true);
  });
  canvas.addEventListener("pointermove", (e) => {
    if (e.buttons) return;
    hovered = pickAt(e.clientX, e.clientY);
    canvas.style.cursor = hovered ? "pointer" : "";
  });
  canvas.addEventListener("pointerleave", () => { hovered = null; canvas.style.cursor = ""; });

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

    if (playing && idleHold <= 0 && inspect === null) {
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
      camAnim.t = Math.min(1, camAnim.t + dt / 1.8);
      const e = ease(camAnim.t), f = camAnim.from, t2 = camAnim.to;
      controls.target.lerpVectors(camAnim.tFrom, camAnim.tTo, e);
      placeCam({ az: f.az + (t2.az - f.az) * e, pol: f.pol + (t2.pol - f.pol) * e, dist: f.dist + (t2.dist - f.dist) * e });
      if (camAnim.t >= 1) camAnim = null;
    } else if (zoomAnim) {
      zoomAnim.t = Math.min(1, zoomAnim.t + dt / 0.5);
      const r = zoomAnim.from + (zoomAnim.to - zoomAnim.from) * ease(zoomAnim.t);
      camera.position.sub(controls.target).setLength(r).add(controls.target);
      if (zoomAnim.t >= 1) zoomAnim = null;
    }

    // isolation: the inspected part stays lit, everything else fades back
    for (const id of Object.keys(mul)) {
      const goal = inspect === null ? 1 : id === "fx" ? 0 : id === PARTS[inspect].id ? 1 : 0.06;
      mul[id] += (goal - mul[id]) * (1 - Math.exp(-4 * dt));
    }
    const hp = (id) => (hovered === id ? 0.35 : 0);
    // slide the scene left (up on phones) to make room for the part panel
    const w0 = stageEl.clientWidth, h0 = stageEl.clientHeight, narrow = w0 < 640;
    viewOff += ((inspect === null ? 0 : 1) - viewOff) * (1 - Math.exp(-4 * dt));
    if (viewOff > 0.002) camera.setViewOffset(w0, h0, narrow ? 0 : viewOff * w0 * 0.2, narrow ? viewOff * h0 * 0.2 : 0, w0, h0);
    else if (camera.view && camera.view.enabled) camera.clearViewOffset();
    controls.autoRotate = !reduce && !camAnim && idleHold <= 0;
    controls.update();

    const ex = cur.ex;
    backing.position.y = -1.05 * ex;
    setVis(backing, 0.9 * mul.backing);
    setPulse(backing, hp("backing"));
    fadeLine(dims, cur.dim * mul.backing);

    cellsG.position.y = 0.06 + 0.9 * ex;
    const glow = cur.sun * 0.85;
    cells.forEach((cell, i) => {
      const v = clamp01(cur.cells * 36 - i);
      cell.position.y = (1 - v) * 0.8;
      setVis(cell, v * mul.cells);
      const u = cell.userData.mesh.material.uniforms;
      u.uGlow.value = glow;
      u.uPulse.value = Math.max(v > 0 && v < 1 ? Math.sin(v * Math.PI) : 0, hp("cells"));
    });

    ribbons.forEach((line, r) => {
      const rp = clamp01(cur.rib * 4 - r);
      line.scale.x = Math.max(rp, 1e-4);
      line.position.x = line.userData.dir * (RIB_L / 2) * (1 - rp);
      fadeLine(line, (rp > 0 ? 1 : 0) * mul.ribbons);
    });
    fadeLine(bus, clamp01((cur.rib - 0.8) * 5) * mul.ribbons);

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

    fadeLine(flowLine, cur.flow * mul.ribbons);
    flow.p.visible = cur.flow > 0.004;
    flow.p.material.uniforms.uOpacity.value = cur.flow * (0.75 + cur.sun * 0.5) * mul.ribbons;
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
    setVis(jbox, cur.jb * mul.jbox);
    setPulse(jbox, hp("jbox"));
    fadeLine(leads, cur.jb * mul.jbox);
    const diodeBeat = stage === 4 || (inspect !== null && PARTS[inspect].id === "jbox");
    diodes.forEach((d, i) => { d.userData.mesh.material.uniforms.uPulse.value = Math.max(diodeBeat ? 0.5 + 0.5 * Math.sin(time * 4 + i * Math.PI) : 0, hp("jbox")); });

    front.position.y = 0.13 + 2.35 * ex + (1 - cur.front) * 2.4;
    setVis(front, cur.front * mul.front);
    setPulse(front, hp("front"));

    frameBars.forEach((bar) => {
      bar.position.copy(bar.userData.home).addScaledVector(bar.userData.dir, (1 - cur.fin) * 2.4);
      setVis(bar, cur.fv * mul.frame);
      setPulse(bar, hp("frame"));
    });

    sun.p.visible = cur.sun > 0.004;
    sun.p.material.uniforms.uOpacity.value = cur.sun * (0.85 + 0.15 * Math.sin(time * 2.1)) * mul.fx;
    fadeLine(rays, cur.sun * (0.55 + 0.45 * Math.sin(time * 3.3)) * mul.fx);

    // floating I–V curve draws itself as power comes up
    const pw = ease(clamp01(cur.power));
    const curveOn = cur.sun * mul.fx;
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

    powerEl.style.opacity = cur.power > 0.01 && stage === 7 && inspect === null ? 1 : 0;
    wattsEl.textContent = (MPP.P * pw).toFixed(1) + " W";
    viEl.textContent = (MPP.V * Math.min(1, pw * 1.15)).toFixed(1) + " V · " + (MPP.I * pw).toFixed(2) + " A";

    const w = stageEl.clientWidth, h = stageEl.clientHeight;
    const callouts = { left: [], right: [] };
    LABELS.forEach((L) => {
      L.v.set(...L.p);
      L.o.localToWorld(L.v);
      L.v.project(camera);
      const on = inspect === null && L.s.includes(stage) && L.o.visible !== false && L.v.z < 1 && (stage !== 7 || pw > 0.85 || !L.amber);
      const x = (L.v.x * 0.5 + 0.5) * w, y = (-L.v.y * 0.5 + 0.5) * h;
      const asCallout = !!L.call && w >= 560;
      L.el.classList.toggle("call", asCallout);
      if (L.line) {
        L.line.style.opacity = asCallout && on ? 1 : 0;
        L.dot.style.opacity = asCallout && on ? 1 : 0;
      }
      if (asCallout) {
        L.ax = x; L.ay = y;
        L.el.classList.remove("flip");
        L.el.style.opacity = on ? 1 : 0;
        if (on) callouts[x < w / 2 ? "left" : "right"].push(L);
        return;
      }
      const inside = x > 8 && x < w - 8 && y > 50 && y < h - 110;
      const flip = x > w * 0.58;
      L.el.classList.toggle("flip", flip);
      L.el.style.opacity = on && inside ? 1 : 0;
      L.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(${flip ? "-100%" : "0"}, -50%)`;
    });
    // Part names sit in columns at the sides, with leader lines back to each part
    const BOTTOM = h - 200, GAP = 40, EDGE = 18;
    for (const side of ["left", "right"]) {
      const TOP = side === "right" && stage === 7 ? 165 : 88; // clear the power readout
      const list = callouts[side].sort((a, b) => a.ay - b.ay);
      list.forEach((L, i) => { L.cy = Math.max(TOP, Math.min(BOTTOM, L.ay)); if (i) L.cy = Math.max(L.cy, list[i - 1].cy + GAP); });
      for (let i = list.length - 1; i >= 0; i--) {
        const limit = i === list.length - 1 ? BOTTOM : list[i + 1].cy - GAP;
        if (list[i].cy > limit) list[i].cy = limit;
      }
      list.forEach((L) => {
        const lw = L.el.offsetWidth, left = side === "left";
        const edge = left ? EDGE + lw : w - EDGE - lw;
        const elbow = left ? edge + 26 : edge - 26;
        L.el.style.transform = left
          ? `translate(${EDGE}px, ${L.cy.toFixed(1)}px) translateY(-50%)`
          : `translate(${(w - EDGE).toFixed(1)}px, ${L.cy.toFixed(1)}px) translate(-100%, -50%)`;
        L.line.setAttribute("d", `M${edge.toFixed(1)} ${L.cy.toFixed(1)} H${elbow.toFixed(1)} L${L.ax.toFixed(1)} ${L.ay.toFixed(1)}`);
        L.dot.setAttribute("cx", L.ax.toFixed(1));
        L.dot.setAttribute("cy", L.ay.toFixed(1));
      });
    }

    composer.render();
  }
  requestAnimationFrame(frame);
  go(Math.min(STAGES.length - 1, Math.max(0, startStage | 0)), false, startStage > 0);
  return { go };
}
