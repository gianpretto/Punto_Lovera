import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// En dev, el backend (backend/, puerto 4000) se sirve detrás del mismo
// origen que Vite: así no hay CORS y Socket.io usa la misma URL.
const BACKEND = 'http://localhost:4000'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': BACKEND,
      '/uploads': BACKEND,
      '/socket.io': { target: BACKEND, ws: true },
    },
  },
})
