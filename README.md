# 3D Box Configurator

A static web app for parametrically configuring a two-piece snap-fit storage box — a tray plus a telescoping lid — and previewing it live in 3D. Every adjustable parameter is synced to the URL, so any configuration is bookmarkable and shareable. Export the result as **STEP** (B-rep CAD) or **STL**.

**Live:** https://rickycastro.github.io/3d-box/

No backend, no build server at runtime — the CAD kernel runs entirely in the browser via WebAssembly.

## Features

- Live 3D preview of a parametric tray + telescoping lid with snap engagement, dividers, and a thumb-relief cutout
- All parameters synced to the URL query string (`?w=…&l=…&h=…`) — copy the link to share an exact configuration
- Real B-rep geometry via a WASM CAD kernel, so **STEP export** is exact (not a tessellated approximation)
- STL export for 3D printing
- Responsive: floating properties panel on desktop, drag-handle bottom sheet on mobile

## Tech stack

- **[replicad](https://replicad.xyz)** — B-rep CAD scripting over OpenCascade.js (WASM). Chosen because true B-rep booleans and native STEP export are hard requirements.
- **three.js** for rendering, via `replicad-threejs-helper` for the mesh → `BufferGeometry` bridge
- **Vite + TypeScript + Svelte** (no SvelteKit — no routing/SSR needed)
- Geometry builds/tessellates/exports in a **Web Worker** to keep the UI responsive

## Development

Requires Node 22+.

```bash
npm install
npm run dev        # start the Vite dev server
npm run build      # type-check (svelte-check) + production build to dist/
npm run preview    # preview the production build locally
npm run smoke      # headless geometry gate — fails if the CAD build regresses
```

## Deployment

Pushing to `main` triggers `.github/workflows/deploy.yml`, which runs the smoke test, builds, and publishes to GitHub Pages.

> **Note:** `vite.config.ts` sets `base: '/3d-box/'`, which must match the repository name exactly. If the repo is renamed, update `base` or Pages will 404 on assets.

## Project layout

```
src/
  geometry/     pure geometry builder + parameter model (types, defaults, ranges)
  worker/       CAD kernel init, build, tessellate, export (+ main-thread client)
  stores/       Svelte stores with URL sync and clamping
  viewer/       three.js scene/camera/renderer/controls
  components/   Svelte UI (top bar, properties panel, viewport, export buttons)
  styles/       theme
docs/           design + geometry reference notes
sample-models/  reference STEP fixtures used to verify geometry
```

See [`docs/snap-box-configurator-plan.md`](docs/snap-box-configurator-plan.md) for the full geometry spec and design rationale.

## License

The bundled OpenCascade WASM is LGPL-2.1 with a linking exception; replicad and its helpers are MIT.
