import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// The API (screener_core, /api/v2) runs on uvicorn :8899. Proxying keeps the
// front same-origin, so no CORS configuration is needed on the core.
const API = process.env.SYNOPSIS_API ?? 'http://localhost:8899'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5180,
    proxy: { '/api': { target: API, changeOrigin: true } },
  },
})
