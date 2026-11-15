import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { embedLegacyPlugins } from '../../scripts/embedLegacyPlugin.ts'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  build: { cssTarget: 'chrome60', emptyOutDir: true },
  plugins: [react(), tailwindcss(), ...embedLegacyPlugins()],
})
