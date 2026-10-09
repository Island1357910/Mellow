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
      transformIndexHtml(html) {
        const boot = `<meta name="mellow-build-id" content="${buildId}" /><script>(function(){var e=document.querySelector('meta[name="mellow-build-id"]')?.content;if(!e)return;var b=(document.querySelector("base")?.href||"/");fetch(b+"version.json?t="+Date.now(),{cache:"no-store"}).then(function(r){return r.ok?r.json():null}).then(function(v){if(v&&v.buildId&&v.buildId!==e&&!sessionStorage.getItem("mellow-boot-reload")){sessionStorage.setItem("mellow-boot-reload","1");location.reload()}}).catch(function(){})})();</script>`
        return html.replace('</head>', `${boot}</head>`)
      },
    },
  ],
  server: {
    port: 5173,
    host: true,
  },
})
