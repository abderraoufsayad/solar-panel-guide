# Hand-Built Solar Module

A complete guide and plan for hand-building a 36-cell, ~80 W monocrystalline solar panel as a university project: design, parts and budget, build procedure, an Arduino I–V curve tracer, measurement protocol, and a résumé-ready report structure.

**Live site:** https://abderraoufsayad.github.io/solar-panel-guide/
**Build hologram (full screen):** https://abderraoufsayad.github.io/solar-panel-guide/hologram.html (deep-link a stage with `#stage1` … `#stage8`)

## What's on the site

- **3D hero render**: a physically lit model of the finished module (clear-coated glass, metallic ribbons, aluminium L-frame, junction box and MC4 leads). Drag or use the arrow keys to turn it over and read the nameplate on the back.
- **Build hologram**: an eight-stage WebGL animation of the assembly (cell sorting, tabbing with a soldering head and sparks, serpentine stringing with live current flow, bypass diodes, encapsulation, framing, and power-on with a floating I–V curve).
- **I–V curve explorer**: a single-diode model of the panel with sliders for cell type, cells in series, irradiance and temperature, shown as 2D curves or as a 3D power surface P(V, G) with the max-power-point ridge.
- **Budget planner, build procedure with pass checks, tracer firmware and analysis script, troubleshooting table, 8-week plan.**

## Files

| File | Purpose |
|---|---|
| `index.html` | The guide. Text, tables and code are plain HTML so it stays readable, searchable and accessible. |
| `site3d.js` | WebGL layer for the guide: hero render, embedded hologram, 3D power surface. |
| `hologram.js` | Self-contained hologram component: `mountHologram(element, { mode: "embed" \| "full", stage })`. |
| `hologram.html` | Full-screen hologram page. |

Built with [three.js](https://threejs.org/) r160 (loaded from jsDelivr via an import map), with bloom post-processing, custom hologram shaders and anti-aliased wide lines. Rendering pauses when a scene is off screen, and all motion respects `prefers-reduced-motion`.

## Run locally

ES modules need a web server (opening the file directly won't load them):

```bash
python -m http.server 8000
```

Then open http://localhost:8000.
