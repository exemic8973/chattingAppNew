import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    // Only use HTTPS if certificate files exist (local development)
    https: fs.existsSync('./key.pem') && fs.existsSync('./cert.pem')
      ? {
          key: fs.readFileSync('./key.pem'),
          cert: fs.readFileSync('./cert.pem'),
        }
      : undefined,
    proxy: {
      '/api': {
        target: 'https://localhost:3001',
        changeOrigin: true,
        secure: false, // Allow self-signed certs
      },
      '/uploads': {
        target: 'https://localhost:3001',
        changeOrigin: true,
        secure: false,
      }
    }
  }
})

