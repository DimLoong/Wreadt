import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // TDesign 体积较大，主包约 580 kB（gzip 180 kB），非首页已按路由拆分
  build: { chunkSizeWarningLimit: 700 },
})
