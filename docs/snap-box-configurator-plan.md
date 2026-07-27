# 3D Snap-Box Configurator — Static Web App

## Context

`3d-snap-box` currently contains only `sample-models/` (7 reference `.step` files of a two-piece parametric divided storage box: a tray + a telescoping lid) and no source code. The goal is a standalone, static webpage — hosted on GitHub Pages, zero backend — that lets a user parametrically configure this box and preview it live in 3D, with every adjustable parameter synced to the URL query string so specific configurations are bookmarkable/shareable. Mobile is a first-class target.

The exact tray/lid/divider/snap geometry was reverse-engineered from the sample STEP files (coordinate clustering, cross-verified across 3 files with exact arithmetic matches) and then corrected/completed against Fusion 360 screenshots and direct descriptions from the project owner for the one feature STEP-parsing couldn't resolve: the snap engagement detail. All geometry facts below are now confirmed, not guessed.

## Stack Decisions (settled, do not revisit)

- **CAD engine:** [replicad](https://replicad.xyz) (wraps OpenCascade.js — a real WASM B-rep CAD kernel). Chosen over OpenSCAD because OpenSCAD is architecturally CSG/F-rep and cannot export STEP; chosen over hand-rolled three.js CSG because true B-rep booleans + native STEP export are required (the sample models are STEP, and STEP export is a hard requirement).
- **Packages:** `replicad`, `replicad-opencascadejs` (trimmed OCCT build, ~7MB/2.4MB compressed, NOT the full `opencascade.js`), `replicad-threejs-helper` (official mesh→BufferGeometry bridge — no hand-rolled tessellation), `three`.
- **Bundler/UI:** Vite + TypeScript + Svelte (near-zero runtime overhead on top of an already-heavy WASM payload; Svelte stores fit param↔URL sync naturally). No SvelteKit needed (no routing/SSR).
- **Licensing:** replicad + helper are MIT; OpenCASCADE is LGPL-2.1 + linking exception — safe to ship compiled WASM in a public static site.
- **Aesthetic:** Figma-style light theme — light gray canvas (~#F0F0F0), white panels with 1px #E5E5E5 borders, 8–10px rounded corners, subtle shadows, Figma blue `#0D99FF` as the single accent, Inter font, compact labeled number-input+slider pairs. Top bar (~48px) with title + blue pill "Copy link" button. Right-side floating properties panel on desktop; collapses into a bottom sheet with a drag handle on mobile — one responsive layout, not two.

## Directory Layout

```
/Users/ricky/dev/3d-snap-box/
  index.html
  package.json
  vite.config.ts
  tsconfig.json
  .github/workflows/deploy.yml
  src/
    main.ts                    # Svelte app mount; parses URL params before first render
    App.svelte
    geometry/
      buildSnapBox.ts          # pure geometry builder (see below)
      types.ts                 # SnapBoxParams interface, DEFAULTS, RANGES
    worker/
      cad.worker.ts            # OC init + build + tessellate + export
      workerClient.ts          # main-thread promise-based wrapper
    stores/
      params.ts                # Svelte writable store + URL sync + clamping
    viewer/
      SceneManager.ts          # three.js scene/camera/renderer/controls
    components/
      TopBar.svelte
      PropertiesPanel.svelte
      ParamField.svelte        # labeled number-input + slider pair
      Viewport.svelte
      ExportButtons.svelte
    styles/
      theme.css                # CSS custom properties for the Figma palette
  sample-models/                # unchanged, used as verification fixtures
```

`vite.config.ts`: `base: '/3d-snap-box/'` (must match the repo name exactly — mismatch is the #1 cause of blank-page/404 asset errors on GitHub Pages project sites), `plugins: [svelte()]`, `worker: { format: 'es' }`.

## Parameters

**Adjustable, URL-synced** (query keys: `w`, `l`, `h`, `wDiv`, `lDiv`, `snapDepth`, `thickness`, `clearance`, `thumbDiameter`):
- `w`, `l`, `h` — interior width/length/height, mm.
- `wDivisions`, `lDivisions` — compartment counts along w and l.
- `snapDepth` — depth of the male snap protrusion, mm, default **1**.
- `thickness` — wall/floor thickness, mm, default **1.67**.
- `clearance` — lid/tray fit gap (also the female-pocket oversize offset), mm, default **0.2**.
- `thumbDiameter` — thumb notch diameter, mm, default **20**. The snap slot's length (`SNAP_LENGTH`) is derived from this (`SNAP_LENGTH = thumbDiameter`), not an independent value — same "tied together" relationship as before, just now tracking a live parameter instead of a fixed constant.

**Fixed constants** (not user-facing):
- `SNAP_TAPER_ANGLE = 45°`. Note: the snap ridge's base height is **not** an independent fixed constant — it's derived from `snapDepth` (see Geometry Construction below): for a symmetric 45°-sided pyramid, each side consumes exactly `snapDepth` vertically, so `baseHeight = 2 * snapDepth`. This means the ridge is always a true full pyramid (tip converges to an exact point/ridge line) for *any* `snapDepth` value, not just at the 1mm default.
- Small cosmetic chamfers: tray rim lead-in ~1.14mm, lid notch-edge chamfer ~1.0mm.

**Validation model (`src/stores/params.ts`)** — two tiers, handled differently:

1. **Hard per-field bounds** (silently clamped, since values outside these are never meaningful): `thickness` 0.8–5mm, `clearance` 0.05–1mm, `thumbDiameter` 10–40mm, `snapDepth` **0.2–2mm** (a generous outer bound on the ridge protrusion itself; the actual binding limit in most cases comes from the cross-parameter check below, not this range), `wDivisions`/`lDivisions` integers ≥1, `w`/`l`/`h` kept within a generous absolute floor/ceiling (e.g. 1–300mm) just to reject garbage input (negative numbers, NaN, absurd values) — these clamps happen immediately in the store's `set`/`update` path.
2. **Cross-parameter compatibility checks** (NOT auto-clamped — surfaced as validation errors the user must resolve themselves):
   - **Print-volume fit:** lid exterior footprint `w/l + 4*thickness + 2*clearance` must be ≤250mm, and lid height `h + 2*thickness` ≤250mm — using **250mm** rather than the raw 256mm spec number, both as a safety margin against the P1S's usable-plate corners typically being slightly less than the nominal 256×256, and because this assumes the box prints standing at full height (tall/narrow orientation); if tray+lid are instead meant to print lying flat, footprint would need checking against a different axis pairing — worth confirming the intended print orientation during implementation so the validation message points at the right dimension. If violated, flag `w`, `l`, and/or `h` (whichever dimension(s) push it over) as invalid.
   - **Compartment size floor:** `compartmentSize = (dim - (n-1)*thickness)/n` must be **≥1mm**. If violated, flag `wDivisions`/`lDivisions` (and/or the corresponding `w`/`l`) as invalid.
   - **Thumb notch fit:** `thumbDiameter` (which also equals `SNAP_LENGTH`) must fit within the span of the wall it's cut into, minus corner-fillet margin on both ends: `thumbDiameter + 2*CLEARANCE ≤ (wall span) - 2*WALL` (the `+2*CLEARANCE` accounts for the female pockets being the widest feature on that wall). The wall span is a single, definite dimension — see the wall-selection rule in Geometry Construction, which pins down exactly which wall and therefore whether the span is `w` or `l`. If violated, flag `thumbDiameter` and the relevant dimension as invalid.
   - **Snap depth vs wall thickness:** the female pocket is cut into the tray's exterior wall face to a depth of `snapDepth + clearance`; if that depth reaches or exceeds the wall thickness, the cut punches straight through to the inside of the compartment, creating an unintended hole rather than a blind pocket. The check is therefore `snapDepth + clearance < thickness` (strict — equality leaves zero remaining wall; ideally subtract a small printability margin, e.g. `snapDepth + clearance ≤ thickness - 0.4mm`). Note this is stricter than a naive `snapDepth ≤ thickness` and is the term that actually governs. If violated, flag both `snapDepth` and `thickness` as invalid (either one could be adjusted to fix it).

   A `validate(params): ValidationError[]` function computes this on every change, each error carrying the offending param key(s) and a human-readable reason (e.g. "Compartment size would be 0.4mm — increase w or reduce wDivisions"). The store exposes both the raw params and this derived error list; the UI is responsible for highlighting the implicated fields (see UI Components) and geometry rebuild is **skipped** while any error exists (worker is not asked to build known-invalid geometry) — show the last valid render dimmed/frozen with an error banner instead of attempting a build that would fail inside OpenCascade.
   - URL sync still reflects whatever the user typed (including invalid combos), so a broken bookmark link reproduces the same error state rather than silently "fixing" the user's intent on load.

## Geometry Construction (`src/geometry/buildSnapBox.ts`)

Pure function `buildSnapBox(params): { tray: Solid; lid: Solid }`, using only the `replicad` API (no OC-init side effects — init happens once in the worker). All facts below are confirmed exact (cross-verified across 3 sample STEP files, plus Fusion screenshots for the snap feature).

**Wall-selection rule (defined once, referenced by both parts):** the thumb notch, the male ridge, and both female pockets all apply to the same wall(s) — the **end wall(s) whose outward normal is parallel to the ±X (w) axis**. Such a wall's in-plane span (the direction the notch/snap length runs) is therefore the `l` dimension, so `SNAP_LENGTH`/`thumbDiameter` is checked against **`l`** in the Thumb-notch-fit validation above. Default: one such wall (pick +X). **Special case: if `w === l`, all four walls** (orientation is ambiguous for a square footprint; in this case the span is `w = l`). The notch and ridge are lid features on this wall; the two female pockets are the corresponding tray wall's features at the same in-plane position. **Confirm against the sample STEP files during implementation** which physical wall the real notch sits on — if it turns out to run along `w` instead, swap the span dimension in this rule and the validation together (they must stay consistent).

**Build order principle (applies to both parts) — two distinct classes of edge treatment, do not conflate them:**
1. **Per-feature edge chamfers** that reference an edge created by one specific cut (the notch lead-in chamfer, and any chamfer on a pocket edge) are applied **immediately after that individual cut**, before the next boolean — edge references go stale across subsequent boolean ops, so these cannot be deferred.
2. **Global corner fillets** (the vertical corner fillets, and the top-rim cosmetic chamfer) are applied **last, after all additive/subtractive booleans are done**, because their edge-finder references (corner extremes, rim height) are only reliable against final topology.

So the sequence is: all bulk booleans (cavity, dividers, ridges, notches, pockets) with each notch/pocket's own edge chamfer applied inline right after its cut → then the global corner fillets and rim chamfer at the very end. The earlier "booleans first, fillets/chamfers last" shorthand refers specifically to class 2.

**Tray ("bottom"):**
1. Exterior footprint = interior `w × l` + `2*WALL` on each axis. Exterior height = `h + WALL` (floor thickness = `WALL`, interior wall height = `h` exactly, **no stepped-up rim** — the wall top is flush).
2. Cut interior cavity: box `w × l × (h + margin)` positioned at `(WALL, WALL, WALL)`, cut a hair taller than needed to guarantee a clean boolean against the open top face.
3. Divider grid: for each axis where `divisions > 1`, `compartmentSize = (dim - (divisions-1)*WALL) / divisions`; place `divisions-1` full-height (`WALL` to `WALL+h`), full-depth divider slabs of thickness `WALL` at the resulting evenly-spaced offsets. Repeat independently for `wDivisions` (dividers perpendicular to w) and `lDivisions` (perpendicular to l). Fuse all dividers into the tray body.
4. **Female snap pockets** (see below) cut into the exterior face of the wall(s) per the wall-selection rule.
5. Fillet all 4 vertical corners, radius `WALL` — done **last**, using an edge finder that selects vertical edges (direction parallel to Z) whose (x,y) position matches one of the 4 exterior corner extremes (e.g. `|x| ≈ maxX` and `|y| ≈ maxY` within a tolerance), which naturally excludes interior divider edges and the pocket/notch edges since those never sit at the corner extremes.
6. Chamfer the top-rim edges of the two w-facing end walls, radius ~1.14mm (cosmetic lead-in) — also last, selected by edge midpoint Z ≈ rim height and face normal matching the end-wall direction.

**Lid ("top"):**
1. Inner skirt footprint = tray exterior footprint + `2*CLEARANCE`; outer skirt footprint = inner + `2*WALL`. `lidHeight = h + 2*WALL` (telescoping skirt reaches all the way down past the tray's full exterior height — no stepped shoulder; this is why clearance lives entirely in the lid's own offsets, not a lip on the tray).
2. Cavity open at the bottom, cap solid at the top, cap thickness = `WALL`.
3. **Thumb notch(es):** semicircular cutter, radius `THUMB_RADIUS`, full wall-thickness deep, centered on the bottom/opening edge of the target wall's midpoint, `.cut()`, per the wall-selection rule above. Apply the ~1.0mm chamfer to each notch's cut edge immediately after that individual cut (per-cut, not batched — edge references go stale across subsequent boolean ops).
4. **Male snap ridge(s)** (see below), fused onto the interior face of the same wall(s), per the wall-selection rule. **Z-position (make explicit — do not leave to inference):** center the ridge `WALL` below the cap's underside (interior top face). This is what makes it land, in assembled coordinates, at the same Z as the tray's **top** female pocket (which is `WALL` below the tray rim, and the tray rim aligns with the cap underside when installed). The same ridge engages the tray's **bottom** female pocket in the flipped/alternate nesting mode.
5. Nested corner fillets, done **last**: inner cavity vertical edges at `WALL + CLEARANCE` (1.87mm), outer skirt vertical edges at that + `WALL` (3.54mm), using the same corner-extreme edge-finder strategy as the tray.

**Snap feature — now fully specified (confirmed via Fusion screenshots + direct description, supersedes earlier STEP-derived guess):**

- **Male (lid only):** a "slot" profile (Fusion term — a stadium/capsule: a rectangle capped by two semicircles) oriented horizontally, overall length `SNAP_LENGTH = thumbDiameter`, base height `2 * snapDepth` (derived, **not** a fixed constant — see below). Extruded outward from the lid's **interior** wall face by `snapDepth` (default 1mm), tapering symmetrically inward on the top and bottom edges (in Z, the height direction) at `45°` as it protrudes to an exact point — i.e. **not** a lead-in chamfer on one edge, but a true symmetric wedge/pyramid: sliced perpendicular to its length, the cross-section is a triangle, base at the wall face narrowing evenly from both top and bottom to a point at the tip. **Deliberately symmetric so the mechanism is equally easy to snap closed and to pry open** — a one-sided ramp would make it a one-way ratchet (easy in, hard out), which is explicitly not wanted here.

  **Base-height derivation:** for a symmetric 45°-sided pyramid, each of the top and bottom edges tapers inward by exactly `depth × tan(45°) = depth` as it extrudes to depth `snapDepth`, converging to a point. So the base height (at the wall face, `depth=0`) must be `2 * snapDepth` for the pyramid to close exactly at the tip — e.g. at the default `snapDepth = 1mm`, base height is `2mm`, tip is `0mm` (an exact point/ridge line). This holds for *any* `snapDepth` value, always producing a full pyramid, never a frustum with a flat tip. Construction note: replicad's `extrude()` end-factor scales the end profile proportionally about its center and does **not** produce this constant-offset taper directly — build this as a **loft** between the base capsule profile (length `SNAP_LENGTH`, height `2*snapDepth`) and a degenerate end profile at depth `snapDepth`, fused onto the lid as part of the additive-boolean phase, before fillets.

  **Prototype this solid first, in isolation, before wiring it into the full build — it is the single remaining geometric unknown.** Two things are under-specified and must be resolved by building it: (1) the taper is described as Z-only (top and bottom edges move inward, length stays `SNAP_LENGTH`), which means the end profile is not a point but a **ridge line** of length `SNAP_LENGTH` — decide and fix whether the semicircular end-caps of the stadium also taper (making a true rounded point) or stay vertical (making a flat-ended wedge with rounded plan-view ends); the female pocket must mate the *same* surface either way, so build male and female from one shared helper differing only by the `CLEARANCE` offset. (2) OCCT lofting to a fully degenerate vertex is fragile — lofting to a short ridge *line* segment is more robust; verify the resulting solid is valid (no self-intersection, closes cleanly) and that the `.cut()` female version produces a clean blind pocket before trusting it in the pipeline.
- **Female (tray only, TWO pockets per wall):** the same symmetric pyramid/wedge solid as the male, but **rebuilt larger by `CLEARANCE = 0.2mm`** (not proportionally scaled) — i.e. the base capsule profile has length `SNAP_LENGTH + 2*CLEARANCE` and, following the same 45°-pyramid derivation at the female's own (deeper) cut depth of `snapDepth + CLEARANCE`, base height `2 * (snapDepth + CLEARANCE)`, lofted to a point at that depth — used as a `.cut()` tool against the tray's exterior wall face. Two pockets per affected wall:
  - **Top pocket:** centered `1*WALL` below the tray's top rim edge — this is the position that mirrors and engages the lid's male ridge when assembled (both references land on the same assembled Z-height, since the lid's interior top face aligns with the tray's rim top when installed).
  - **Bottom pocket:** centered `1*WALL` above the tray's bottom exterior edge — mirrors the top pocket's measurement convention from the opposite edge. In **normal assembly** (lid right-side-up, telescoping down over the tray) this pocket is not engaged by any male feature — it's exposed near the base of the assembled box, giving a fingernail-catch point for prying the lid off. But it's not merely decorative: in an **alternate assembly mode** — lid flipped upside-down (used as a bowl, open skirt facing up) with the tray nested *inside* the lid's cavity from above — the lid's male ridge (which is near the lid's own top/cap, now at the bottom of the inverted lid) lines up with and snaps into this same bottom pocket (now near the bottom of the inverted assembly). This is the intended meaning of "flip the lid over, it will still snap" — both nesting orientations are valid, functional configurations, not just the normal one.
- Cut both female pockets into the tray as part of the additive-boolean phase, before fillets/chamfers, same reasoning as the lid.

The overall snap mechanism (placement, dual pockets, alternate nesting mode, and the symmetric-pyramid taper geometry) is now fully specified — this closes out what was previously the single highest-uncertainty part of the plan.

## Web Worker Architecture

OpenCascade must run in a Web Worker (blocking/synchronous ops would freeze the UI otherwise).

- **Worker (`cad.worker.ts`):** on startup, import the wasm-loader entry from `replicad-opencascadejs` and the `.wasm` binary via Vite's `?url` suffix (do **not** rely on `import.meta.url` resolution inside worker code — known Vite bug, vitejs/vite#5087, breaks worker asset resolution), call it with `locateFile` pointing at that URL, then `setOC(...)` into `replicad`. Verify during implementation that the specific `replicad-opencascadejs` build variant in use (a) ships as a **split** build (separate `.wasm` file compatible with `?url`, not a base64-inlined single-file build) and (b) actually initializes correctly as an ES-module worker (`worker: { format: 'es' }`) — Emscripten glue doesn't always run cleanly as ESM; fall back to a classic worker if it doesn't. Message protocol (discriminated union):
  - `{ type: "build", requestId, params }` → build tray+lid via `buildSnapBox`, tessellate with `replicad-threejs-helper`'s `syncFaces()`/`syncLines()`, post back transferable typed arrays for faces+edges of both parts.
  - `{ type: "export", requestId, params, format: "step"|"stl", part }` → rebuild (or reuse a params-hash-keyed cache of the last build), call `.blobSTEP()` / `.blobSTL({ tolerance, angularTolerance })`, post the `Blob` back (structured-cloneable, no special handling).
  - **Shape disposal (important, easy to miss):** OpenCascade.js/replicad shapes hold WASM-heap memory that is not JS-garbage-collected. Every intermediate shape produced during a build (boolean results, the previous cached build before it's replaced) must be explicitly disposed (`.delete()`/equivalent) once superseded. Without this, repeated rebuilds during slider dragging will leak the WASM heap until the tab runs out of memory — worst on mobile. This is a correctness requirement, not an optimization.
- **Main thread (`workerClient.ts`):** promise-per-`requestId` wrapper so callers can `await workerClient.build(params)` / `await workerClient.export(params, "step")`. Track `latestRequestId` and discard responses that don't match it, so a rapid slider drag never lets a slow stale build clobber a newer one. Consider also coalescing on the worker side (drop an in-progress/queued build if a newer request arrives) so the worker doesn't serially chew through every intermediate value during a fast drag — discarding stale *responses* alone doesn't stop stale *work* from delaying the latest one.
- **Loading/error UX:** the first visit pays for the multi-MB WASM download + OC init before any mesh can render — show a loading state on the viewport until the first successful build, not just a blank canvas. Separately, an unexpected OCCT failure (something the validation layer didn't anticipate) should surface as a distinct runtime-error banner, not be confused with a validation error.

## State / URL Sync (`src/stores/params.ts`)

- Svelte `writable<SnapBoxParams>`, every `set`/`update` routed through a `clamp()` function per the hard per-field bounds above — the store never holds *garbage* (NaN, out-of-absolute-range) values, but **can** and does hold combinations that are cross-parameter invalid (that's exactly what `validate()`'s tier-2 checks are for — the store's raw state and the derived validity state are two different things).
- On boot (`main.ts`, before mounting `App.svelte`): parse `location.search` via `URLSearchParams`, merge finite numeric values over `DEFAULTS = { w: 75, l: 50, h: 25, wDivisions: 1, lDivisions: 1, snapDepth: 1, thickness: 1.67, clearance: 0.2, thumbDiameter: 20 }` (matches sample `ai-75(1)-50(1)-25.step`, giving both a known-good default render and a direct anchor for the STEP-export verification test), hard-clamp, then initialize the store. Note: hard-clamping on load means a bookmarked URL with an out-of-absolute-range value (e.g. `thickness=0.01`) is silently corrected to the nearest valid bound — only cross-parameter-invalid combinations are preserved as-is and surfaced via the error UI, not silently fixed.
- Two independent debounced subscribers: (a) ~150–300ms → serialize params to `URLSearchParams`, `history.replaceState` (not pushState — dragging a slider shouldn't spam history) — this one always runs, regardless of validity; (b) ~200ms → checks `validate(params)` first and **no-ops if any errors exist**, otherwise calls `workerClient.build(params)` and pipes mesh data into `Viewport`/`SceneManager`.
- "Copy link" button: `navigator.clipboard.writeText(location.href)` — no extra serialization needed since the URL is already kept live.

## UI Components

- **`App.svelte`:** CSS grid — fixed 48px `TopBar` + main area (`Viewport` flex-grow + `PropertiesPanel`). Desktop: panel floats top-right. Mobile (media query ~768px): panel becomes a `position: fixed` bottom sheet with a drag handle; tap-to-expand/collapse with a CSS transition is an acceptable v1 scope (full physical drag-gesture can be a follow-up).
- **`TopBar.svelte`:** title + blue pill "Copy link" button (`#0D99FF`, white text, fully rounded), white background, 1px `#E5E5E5` bottom border.
- **`PropertiesPanel.svelte`:** white card, 1px `#E5E5E5` border, 8–10px radius, subtle shadow; one `ParamField` per adjustable param + `ExportButtons`.
- **`ParamField.svelte`:** compact `<input type="number">` (paired, two-way bound) + `<input type="range">`, Figma-style small (11–13px) Inter labels. Number input text itself must be `font-size: 16px` minimum to avoid iOS Safari's auto-zoom-on-focus — do **not** fake sub-16px text with CSS `transform: scale()`, since that desyncs visual size from layout/hit-target geometry (misaligned focus rings, wrong tap targets). Keep the *field* visually compact via tight padding/height instead, accepting 16px as the actual text size. Accepts an optional `error` prop: when set, the field gets a red border + a small inline error message beneath it (Figma-style destructive-red, e.g. `#F24822`), driven by the store's derived error list keyed by param name.
- **`PropertiesPanel.svelte`** (addition): when `validate(params)` returns any errors, show a small error banner at the top of the panel (e.g. "Doesn't fit — adjust the highlighted dimensions") in addition to each field's individual highlight, and visually indicate the 3D viewport is showing a frozen/stale render (e.g. a subtle dimmed overlay) rather than attempting to rebuild invalid geometry.
- **`Viewport.svelte`:** mounts a canvas, owns `SceneManager` lifecycle (create in `onMount`, dispose in `onDestroy`). `SceneManager` owns camera/renderer/`OrbitControls` (touch pinch/pan/rotate works out of the box), light gray background, a subtle `GridHelper` floor, soft neutral lighting (hemisphere + 2–3 directional lights).
- **`ExportButtons.svelte`:** "Export STEP" / "Export STL" buttons → `workerClient.export()` → `Blob` → temporary `<a download>` click. Name files after the current params, e.g. `snapbox-tray-w75-l50-h25.step` / `snapbox-lid-...`. **Disable both buttons whenever `validate(params)` returns any errors** — the same gate that skips the live build must also block export, otherwise export would ask the worker to build known-invalid geometry (and there is no valid last-build to fall back on if the very first render was invalid). Optionally, also disable them until the first successful build has completed.
- **`styles/theme.css`:** CSS custom properties for the palette (`--color-bg`, `--color-panel`, `--color-border`, `--color-accent`, `--radius`), Inter font declaration.

## GitHub Pages Deployment

`.github/workflows/deploy.yml`: standard two-job pattern — `build` (checkout, `actions/setup-node@v4`, `npm ci`, `npm run build`, `actions/upload-pages-artifact@v3` on `dist/`) → `deploy` (needs `build`, `permissions: {pages: write, id-token: write}`, `environment: github-pages`, `actions/deploy-pages@v4`). Trigger on push to `main` + `workflow_dispatch`.

**One-time manual step (cannot be done by committing files):** in the repo's Settings → Pages, set Source to "GitHub Actions" (not "Deploy from a branch"). Flag this to the user after the workflow is merged — it needs a human with repo admin access to click it once.

**Optional but cheap CI gate:** the `build` job currently only bundles the app; it does not exercise `buildSnapBox` or OC init, so a geometry regression (a failed boolean, a bad loft) ships silently. Consider adding a headless smoke test — e.g. a Node/Vitest script that initializes OpenCascade, runs `buildSnapBox(DEFAULTS)`, and asserts both solids build and export a non-empty STEP blob without throwing — run before `npm run build` in the workflow. Guards against exactly the loft/boolean fragility called out above.

## Verification Plan

**Local (`npm run dev`):**
- Confirm the worker initializes without console errors and the `.wasm` request resolves to a real payload (not a 404/HTML fallback) in the Network tab.
- Drag each control and confirm: 3D view updates within the debounce window, URL query string updates, and reloading a hand-edited/bookmarked URL reproduces the exact model. Test "Copy link" round-trip in a new tab.
- Mobile viewport (DevTools device mode + a real device if available): bottom sheet doesn't obscure the viewport, touch orbit/pinch works, number inputs don't trigger unwanted iOS zoom.

**Edge cases:**
- `w === l`: confirm thumb notch **and** the male/female snap slot both appear on all four walls, not just one.
- `wDivisions=1`/`lDivisions=1`: zero interior dividers generated, no stray zero-thickness geometry.
- Divisions pushed just up to (and just past) the compartment-size floor for a given dimension: at the last valid count `compartmentSize` stays ≥1mm and builds cleanly with no OC boolean failures; one count higher trips the tier-2 compatibility error and the build is skipped (divisions are *not* auto-clamped — the floor is enforced as a validation error, not a hard bound).
- Small/near-degenerate dimensions: fillets/chamfers don't exceed available wall length (the clamped minimums for `w`/`l` should already prevent this — verify).
- Rapid slider dragging: stale worker responses are discarded, no flicker back to an older state.
- **Validation/highlighting:** deliberately create each incompatible combination (dimensions that overflow the P1S build volume, divisions that push compartment size below 1mm, a `thumbDiameter` too large for the current `w`/`l`, a `snapDepth` at or above the current `thickness`) and confirm the exact offending field(s) get highlighted with a clear message, the 3D view freezes on the last valid render instead of attempting a build, and correcting the field clears the error and resumes live rebuilding.
- **Alternate nesting mode:** with the lid flipped upside-down and the tray dropped into its cavity from above, confirm the male ridge engages the tray's bottom female pocket and produces a valid snap — not just the normal (lid-over-tray) configuration.

**STEP/STL export sanity check:**
- Export STEP for a param set matching an existing sample (e.g. `w=75, wDivisions=4, l=50, lDivisions=2, h=25` → compare against `ai-75(4)-50(2)-25.step`). Open both in a STEP-capable viewer (FreeCAD or similar) side-by-side: compartment spacing, wall thickness, corner fillets, chamfers, and — now that it's fully specified — the male ridge / two female pockets, checking position and taper against the Fusion screenshots.
- Export STL, confirm it opens cleanly in a mesh viewer/slicer with no non-manifold warnings.
- Confirm exported STEP file sizes are in the same ballpark as the ~77–130KB samples (a wildly different size suggests leftover topology issues from failed boolean cleanups).

### Critical Files
- `src/geometry/buildSnapBox.ts`
- `src/worker/cad.worker.ts`
- `src/stores/params.ts`
- `vite.config.ts`
- `.github/workflows/deploy.yml`
