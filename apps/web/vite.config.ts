import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // TDesign 体积较大，主包约 580 kB（gzip 180 kB），非首页已按路由拆分
  build: { chunkSizeWarningLimit: 700 },
  // 开发时把 /api 转发到本地 Spring Boot（apps/server）
  server: { proxy: { "/api": "http://localhost:8080" } },
})
