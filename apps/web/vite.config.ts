import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  // .env lives at the repo root (see .env.example), not apps/web/.
  envDir: "../..",
  server: {
    port: 5173,
  },
});
