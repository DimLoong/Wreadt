import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // TDesign 体积较大，主包约 580 kB（gzip 180 kB），非首页已按路由拆分
  build: {
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        // 很少变动的基础依赖单独成块：发版后浏览器缓存仍然有效
        manualChunks(id) {
          if (/node_modules\/\.pnpm\/(react|react-dom|scheduler|react-router|react-router-dom|cookie|set-cookie-parser)@/.test(id)) return "react";
          if (/node_modules\/\.pnpm\/(dexie|dexie-react-hooks)@/.test(id)) return "dexie";
        },
      },
    },
  },
  // 开发时把 /api 转发到本地 Spring Boot（apps/server）
  server: { port: 25173, strictPort: true, proxy: { "/api": "http://localhost:8080" } },
  preview: { port: 25173, strictPort: true },
})
