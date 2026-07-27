/// <reference lib="webworker" />
// OpenCascade runs here, off the main thread — its booleans are synchronous and
// would otherwise freeze the UI.

import initOpenCascade from 'replicad-opencascadejs/src/replicad_single.js';
// Import the wasm binary as a URL. Do NOT rely on import.meta.url resolution
// inside worker code (Vite bug vitejs/vite#5087). The ?url suffix + a split
// (non-inlined) build is what makes this resolve correctly.
import opencascadeWasmUrl from 'replicad-opencascadejs/src/replicad_single.wasm?url';
import { setOC } from 'replicad';

import { buildSnapBox, type SnapBoxSolids } from '../geometry/buildSnapBox';
import type { SnapBoxParams } from '../geometry/types';

// ---- Message protocol -------------------------------------------------------

export type PartName = 'tray' | 'lid';

export interface BuildRequest {
  type: 'build';
  requestId: number;
  params: SnapBoxParams;
}
export interface ExportRequest {
  type: 'export';
  requestId: number;
  params: SnapBoxParams;
  format: 'step' | 'stl';
  part: PartName;
}
export type WorkerRequest = BuildRequest | ExportRequest;

export interface MeshFaces {
  vertices: Float32Array;
  triangles: Uint32Array;
  normals: Float32Array;
  faceGroups?: { start: number; count: number; faceId: number }[];
}
export interface MeshEdges {
  lines: Float32Array;
  edgeGroups?: { start: number; count: number; edgeId: number }[];
}
export interface PartMesh {
  faces: MeshFaces;
  edges: MeshEdges;
}

export interface BuildResponse {
  type: 'build';
  requestId: number;
  tray: PartMesh;
  lid: PartMesh;
}
export interface ExportResponse {
  type: 'export';
  requestId: number;
  blob: Blob;
  filename: string;
}
export interface ReadyResponse {
  type: 'ready';
}
export interface ErrorResponse {
  type: 'error';
  requestId?: number;
  message: string;
}
export type WorkerResponse =
  | BuildResponse
  | ExportResponse
  | ReadyResponse
  | ErrorResponse;

// Tessellation tolerances (mm / rad). Tight enough for a clean snap preview
// without exploding vertex counts on mobile.
const MESH_TOLERANCE = 0.05;
const MESH_ANGULAR_TOLERANCE = 0.3;

// ---- OpenCascade init -------------------------------------------------------

let ocReady: Promise<void> | null = null;

function ensureOC(): Promise<void> {
  if (!ocReady) {
    ocReady = initOpenCascade({
      locateFile: () => opencascadeWasmUrl,
    }).then((OC: unknown) => {
      setOC(OC as never);
    });
  }
  return ocReady;
}

// ---- Build cache (for export reuse + disposal) ------------------------------

let cache: { key: string; solids: SnapBoxSolids } | null = null;

function paramsKey(p: SnapBoxParams): string {
  return JSON.stringify(p);
}

function disposeSolids(s: SnapBoxSolids) {
  s.tray.delete();
  s.lid.delete();
}

/** Build (or reuse cached) solids for these params. The cache owns the solids. */
function getSolids(params: SnapBoxParams): SnapBoxSolids {
  const key = paramsKey(params);
  if (cache && cache.key === key) return cache.solids;
  if (cache) disposeSolids(cache.solids);
  const solids = buildSnapBox(params);
  cache = { key, solids };
  return solids;
}

// ---- Meshing ----------------------------------------------------------------

function meshPart(solid: SnapBoxSolids['tray']): { mesh: PartMesh; transfer: ArrayBuffer[] } {
  const faces = solid.mesh({
    tolerance: MESH_TOLERANCE,
    angularTolerance: MESH_ANGULAR_TOLERANCE,
  });
  const edges = solid.meshEdges();

  const vertices = new Float32Array(faces.vertices);
  const triangles = new Uint32Array(faces.triangles);
  const normals = new Float32Array(faces.normals ?? []);
  const lines = new Float32Array(edges.lines);

  const mesh: PartMesh = {
    faces: { vertices, triangles, normals, faceGroups: faces.faceGroups },
    edges: { lines, edgeGroups: edges.edgeGroups },
  };
  return {
    mesh,
    transfer: [vertices.buffer, triangles.buffer, normals.buffer, lines.buffer],
  };
}

// ---- Request handling -------------------------------------------------------

const post = (msg: WorkerResponse, transfer?: Transferable[]) =>
  (self as DedicatedWorkerGlobalScope).postMessage(msg, transfer ?? []);

function handleBuild(req: BuildRequest) {
  const solids = getSolids(req.params);
  const tray = meshPart(solids.tray);
  const lid = meshPart(solids.lid);
  post(
    { type: 'build', requestId: req.requestId, tray: tray.mesh, lid: lid.mesh },
    [...tray.transfer, ...lid.transfer],
  );
}

function handleExport(req: ExportRequest) {
  const solids = getSolids(req.params);
  const solid = req.part === 'tray' ? solids.tray : solids.lid;
  const p = req.params;
  const dims = `w${p.w}-l${p.l}-h${p.h}`;
  if (req.format === 'step') {
    const blob = solid.blobSTEP();
    post({
      type: 'export',
      requestId: req.requestId,
      blob,
      filename: `snapbox-${req.part}-${dims}.step`,
    });
  } else {
    const blob = solid.blobSTL({
      tolerance: MESH_TOLERANCE,
      angularTolerance: MESH_ANGULAR_TOLERANCE,
    });
    post({
      type: 'export',
      requestId: req.requestId,
      blob,
      filename: `snapbox-${req.part}-${dims}.stl`,
    });
  }
}

self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const req = e.data;
  try {
    await ensureOC();
    if (req.type === 'build') handleBuild(req);
    else if (req.type === 'export') handleExport(req);
  } catch (err) {
    post({
      type: 'error',
      requestId: 'requestId' in req ? req.requestId : undefined,
      message: err instanceof Error ? err.message : String(err),
    });
  }
};

// Kick off OC init eagerly and announce readiness so the UI can show progress.
ensureOC()
  .then(() => post({ type: 'ready' }))
  .catch((err) =>
    post({ type: 'error', message: err instanceof Error ? err.message : String(err) }),
  );
