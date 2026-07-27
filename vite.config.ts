import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

// base MUST match the GitHub Pages project path exactly (the repo name).
// A mismatch is the #1 cause of blank-page / 404 asset errors on Pages.
export default defineConfig({
  base: '/3d-box/',
  plugins: [svelte()],
  worker: {
    format: 'es',
  },
  build: {
    target: 'esnext',
  },
  // OpenCascade's wasm is large; don't let Vite try to inline or prebundle it.
  optimizeDeps: {
    exclude: ['replicad-opencascadejs'],
  },
});
