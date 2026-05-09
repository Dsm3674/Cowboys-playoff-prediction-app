import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// During `npm run dev`, requests to localhost:5173 with a path matching
// the patterns below get proxied to the backend running on :3001.
// In production, your backend is at a different origin — api.js handles that
// by reading window.location.hostname.
export default defineConfig({
  plugins: [react()],
  // Vite expects .js files to use ES modules. Our .jsx files include JSX,
  // so allow the React plugin to handle them automatically.
  esbuild: {
    loader: "jsx",
    include: /src\/.*\.jsx?$/,
    exclude: [],
  },
  optimizeDeps: {
    esbuildOptions: {
      loader: { ".js": "jsx" },
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:3001",
      "/cowboys": "http://localhost:3001",
      "/teams": "http://localhost:3001",
      "/players": "http://localhost:3001",
      "/predictions": "http://localhost:3001",
      "/simulation": "http://localhost:3001",
      "/timeline": "http://localhost:3001",
      "/analytics": "http://localhost:3001",
      "/auth": "http://localhost:3001",
      "/billing": "http://localhost:3001",
    },
  },
  build: {
    outDir: "dist",
    minify: false,
    sourcemap: true,
  },
});
