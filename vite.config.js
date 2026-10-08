import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// 开发模式下前端跑在 5173，/api 反向代理到本地 FastAPI（8765）；
// 生产构建产物由 FastAPI 直接托管，同源访问，无需代理。
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8765",
        changeOrigin: false,
      },
    },
  },
});
