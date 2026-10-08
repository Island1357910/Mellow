import { readFileSync } from 'node:fs'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string }
const buildId = process.env.BUILD_ID || `${pkg.version}.${Date.now()}`

export default defineConfig({
  base: process.env.BASE_PATH || '/',
  define: {
    __MELLOW_BUILD_ID__: JSON.stringify(buildId),
    __MELLOW_APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'mellow-version-json',
      generateBundle() {
        this.emitFile({
          type: 'asset',
          fileName: 'version.json',
          source: JSON.stringify({ buildId, version: pkg.version }),
        })
      },
    },
  ],
  server: {
    port: 5173,
    host: true,
  },
})
