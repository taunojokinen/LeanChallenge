import { fileURLToPath } from 'node:url'
import { defineConfig, searchForWorkspaceRoot } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    fs: {
      allow: [
        searchForWorkspaceRoot(fileURLToPath(new URL('.', import.meta.url))),
        fileURLToPath(new URL('../shared', import.meta.url)),
      ],
    },
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
})
