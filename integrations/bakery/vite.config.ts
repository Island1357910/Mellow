import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { embedLegacyPlugins } from '../../scripts/embedLegacyPlugin.ts'

export default defineConfig({
  base: './',
  publicDir: false,
  build: { cssTarget: 'chrome60', emptyOutDir: false },
  plugins: [react(), ...embedLegacyPlugins()],
})
