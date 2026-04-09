import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/fundTool",
  plugins: [react()],
  server: {
    port: 3000,
    hmr: {
      overlay: true,
    },
    watch: {
      usePolling: true,
      interval: 1000,
    },
    proxy: {
      "/fundTool/api": {
        target: "http://localhost:3035",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/fundTool\/api/, "/api"),
      },
    },
  },
});
