import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [
    react(),
    // Vite adds `crossorigin` on module script tags which breaks
    // Electron's file:// protocol (CORS check fails with no headers).
    {
      name: "remove-crossorigin-for-electron",
      transformIndexHtml(html) {
        return html.replace(/\s*crossorigin\s*/g, " ");
      },
      enforce: "post" as const,
    },
  ],
  base: "./",
  root: ".",
  build: {
    outDir: "dist/renderer",
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "src/shared"),
    },
  },
  server: {
    port: 5173,
  },
});
