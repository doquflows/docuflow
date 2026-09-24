import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8')) as { version: string };

// API backend port — override with VITE_API_PORT env var for dev
// e.g.  VITE_API_PORT=3333 npm run dev
const apiPort = process.env.VITE_API_PORT ?? '48821';
const apiUrl  = process.env.VITE_API_URL  ?? `http://localhost:${apiPort}`;

export default defineConfig({
  plugins: [react()],
  build: {
    // Keep UI bundle separate from MCP server's `dist/` (tsc writes to dist/, vite writes to ui-dist/)
    outDir: 'ui-dist',
    emptyOutDir: true,
  },
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    // Expose resolved API URL to the app at build time
    'import.meta.env.VITE_API_URL': JSON.stringify(apiUrl),
  },
  server: {
    port: 5173,
    proxy: {
      // Proxy all /api/* calls to the backend (avoids CORS in dev)
      '/api': {
        target: apiUrl,
        changeOrigin: true,
      },
    },
  },
});
