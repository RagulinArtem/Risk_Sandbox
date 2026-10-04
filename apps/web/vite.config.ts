import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  // .env lives at the repo root (see .env.example), not apps/web/.
  envDir: "../..",
  build: {
    // Keep the entry bundle small enough for reliable delivery through the
    // production reverse proxy. Charts are a distinct, cacheable dependency
    // and do not need to be downloaded as part of the application shell.
    rollupOptions: {
      output: {
        // `r2` intentionally invalidates asset URLs from the earlier
        // uncompressed deployment; those responses were cacheable for a year.
        entryFileNames: "assets/[name]-r2-[hash].js",
        chunkFileNames: "assets/[name]-r2-[hash].js",
        assetFileNames: "assets/[name]-r2-[hash][extname]",
        manualChunks(id) {
          if (id.indexOf("node_modules") === -1) return undefined;
          if (id.indexOf("/react/") !== -1 || id.indexOf("/react-dom/") !== -1 || id.indexOf("/scheduler/") !== -1) {
            return "react-vendor";
          }
          if (id.indexOf("/recharts/") !== -1) return "recharts";
          if (id.indexOf("/d3-") !== -1 || id.indexOf("/victory-vendor/") !== -1) return "chart-math";
          return "vendor";
        },
      },
    },
  },
  server: {
    port: 5173,
  },
});
