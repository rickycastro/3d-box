/// <reference types="svelte" />
/// <reference types="vite/client" />

// replicad-opencascadejs ships an Emscripten factory (default export) plus a
// sibling .wasm. The package has a .d.ts for the class surface but not for the
// factory default export, so declare it here.
declare module 'replicad-opencascadejs/src/replicad_single.js' {
  const initOpenCascade: (options?: {
    locateFile?: (path: string) => string;
    [key: string]: unknown;
  }) => Promise<any>;
  export default initOpenCascade;
}
