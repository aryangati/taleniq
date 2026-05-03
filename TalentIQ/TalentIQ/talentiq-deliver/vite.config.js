import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  if (!env.ANTHROPIC_API_KEY) {
    console.warn('\n⚠  ANTHROPIC_API_KEY not found in .env — AI match will return 401.\n')
  }

  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api/anthropic': {
          target: 'https://api.anthropic.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/anthropic/, ''),
          headers: {
            'x-api-key': env.ANTHROPIC_API_KEY || '',
            'anthropic-version': '2023-06-01',
            // Required when the request carries a browser Origin header.
            // The Vite proxy forwards Origin from the browser, so Anthropic
            // demands this explicit opt-in for CORS-originated requests.
            'anthropic-dangerous-direct-browser-access': 'true',
          },
        },
      },
    },
  }
})
