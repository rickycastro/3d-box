import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/3d-box/",
  plugins: [react()],
  optimizeDeps: {
    exclude: ["opencascade.js"]
  },
  assetsInclude: ["**/*.wasm"]
});
