// Headless geometry smoke test: init OpenCascade in Node, build the box for a
// few param sets, assert bounding boxes match the reverse-engineered dimensions,
// and confirm STEP/STL export produces non-empty blobs. Guards against loft /
// boolean regressions that a bundle-only build would never catch.
//
// Runs in a fully-CommonJS context on purpose: the Emscripten OC glue mixes
// require() + top-level await, which Node's ESM loader rejects
// (ERR_AMBIGUOUS_MODULE_SYNTAX) when it's pulled into an ESM graph. In the real
// app Vite handles this in the worker; this is a Node-only harness.
//
// Run: npm run smoke
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const ts = require('typescript');
const replicad = require('replicad');

const root = path.join(__dirname, '..');

function loadDefault(mod) {
  return mod && mod.default ? mod.default : mod;
}

// Absolute path to the already-initialised replicad instance, so the temp-dir
// modules resolve to the SAME cached module (not a fresh one without OC set).
const replicadPath = require.resolve('replicad');

// Transpile a TS source to CJS in a temp dir, rewriting the ./types and replicad
// imports so they resolve from outside the project tree.
function transpileToCjs(tmp, srcRel, outName) {
  const src = fs.readFileSync(path.join(root, srcRel), 'utf8');
  let js = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  js = js
    .replace(/(['"])\.\/types\1/g, '"./types.cjs"')
    .replace(/(['"])replicad\1/g, JSON.stringify(replicadPath));
  fs.writeFileSync(path.join(tmp, outName), js);
}

// --- assertions ------------------------------------------------------------
let failures = 0;
const approx = (a, b, tol = 0.02) => Math.abs(a - b) <= tol;

function bounds(shape) {
  const bb = shape.boundingBox;
  const b = bb.bounds ? bb.bounds : [bb.min, bb.max];
  return { min: b[0], max: b[1] };
}
function check(name, cond, detail) {
  if (cond) console.log(`  ✓ ${name}`);
  else {
    console.log(`  ✗ ${name}  ${detail || ''}`);
    failures++;
  }
}
function checkBox(label, shape, expMin, expMax) {
  const { min, max } = bounds(shape);
  const ok =
    expMin.every((v, i) => approx(min[i], v)) && expMax.every((v, i) => approx(max[i], v));
  check(
    `${label} bbox`,
    ok,
    `got min=[${min.map((n) => n.toFixed(2))}] max=[${max.map((n) => n.toFixed(2))}] want min=[${expMin}] max=[${expMax}]`,
  );
}
const blobSize = (b) => (b && typeof b.size === 'number' ? b.size : 0);

(async () => {
  // The Emscripten factory re-loads itself as ESM when called, where __dirname
  // and require don't exist. Inject them as globals so its Node branch resolves.
  const ocDir = path.join(root, 'node_modules/replicad-opencascadejs/src');
  globalThis.__dirname = ocDir;
  globalThis.require = require;

  const initOpenCascade = loadDefault(require('replicad-opencascadejs/src/replicad_single.js'));
  const OC = await initOpenCascade({ locateFile: (f) => path.join(ocDir, f) });
  replicad.setOC(OC);

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'snapbox-smoke-'));
  transpileToCjs(tmp, 'src/geometry/types.ts', 'types.cjs');
  transpileToCjs(tmp, 'src/geometry/buildSnapBox.ts', 'buildSnapBox.cjs');
  const { buildSnapBox } = require(path.join(tmp, 'buildSnapBox.cjs'));

  const base = { snapDepth: 1, thickness: 1.67, clearance: 0.2, thumbDiameter: 20 };

  console.log('\n[default 75x50x25]');
  {
    const { tray, lid } = buildSnapBox({ w: 75, l: 50, h: 25, wDivisions: 1, lDivisions: 1, ...base });
    checkBox('tray', tray, [-39.17, -26.67, 0], [39.17, 26.67, 26.67]);
    checkBox('lid', lid, [-41.04, -28.54, 0], [41.04, 28.54, 28.34]);
    const step = tray.blobSTEP();
    const stl = tray.blobSTL({ tolerance: 0.05, angularTolerance: 0.3 });
    check('tray STEP non-empty', blobSize(step) > 1000, `size=${blobSize(step)}`);
    check('tray STL non-empty', blobSize(stl) > 1000, `size=${blobSize(stl)}`);
    console.log(`    STEP ${blobSize(step)} B, STL ${blobSize(stl)} B`);
    tray.delete();
    lid.delete();
  }

  console.log('\n[dividers 75(4)x50(2)x25]');
  {
    const { tray, lid } = buildSnapBox({ w: 75, l: 50, h: 25, wDivisions: 4, lDivisions: 2, ...base });
    checkBox('tray', tray, [-39.17, -26.67, 0], [39.17, 26.67, 26.67]);
    const step = tray.blobSTEP();
    check('divided tray STEP non-empty', blobSize(step) > 1000, `size=${blobSize(step)}`);
    console.log(`    STEP ${blobSize(step)} B`);
    tray.delete();
    lid.delete();
  }

  console.log('\n[square 40x40x30 → all 4 walls]');
  {
    const { tray, lid } = buildSnapBox({ w: 40, l: 40, h: 30, wDivisions: 1, lDivisions: 1, ...base });
    checkBox('tray', tray, [-21.67, -21.67, 0], [21.67, 21.67, 31.67]);
    tray.delete();
    lid.delete();
  }

  console.log('\n[tall 80x30x50]');
  {
    const { tray, lid } = buildSnapBox({ w: 80, l: 30, h: 50, wDivisions: 1, lDivisions: 1, ...base });
    checkBox('tray', tray, [-41.67, -16.67, 0], [41.67, 16.67, 51.67]);
    tray.delete();
    lid.delete();
  }

  console.log(`\n${failures === 0 ? 'PASS ✓ all checks' : `FAIL ✗ ${failures} check(s)`}`);
  process.exit(failures === 0 ? 0 : 1);
})().catch((err) => {
  console.error('\nsmoke test threw:', err && err.stack ? err.stack : err);
  process.exit(1);
});
