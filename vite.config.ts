import { readFileSync } from 'node:fs'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import legacy from '@vitejs/plugin-legacy'
import cascadeLayers from '@csstools/postcss-cascade-layers'
import colorMix from '@csstools/postcss-color-mix-function'
import oklab from '@csstools/postcss-oklab-function'
import postcss from 'postcss'
import { defineConfig } from 'vite'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string }
const buildId = process.env.BUILD_ID || `${pkg.version}.${Date.now()}`

export default defineConfig({
  base: process.env.BASE_PATH || '/',
  build: { cssTarget: 'chrome60', cssCodeSplit: false },
  define: {
    __MELLOW_BUILD_ID__: JSON.stringify(buildId),
    __MELLOW_APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [
    react(),
    tailwindcss(),
    legacy({ targets: ['Chrome >= 60'], modernPolyfills: true }),
    {
      name: 'mellow-legacy-css',
      enforce: 'post',
      generateBundle: { order: 'post', async handler(_options, bundle) {
        const css = Object.values(bundle).filter(asset => asset.type === 'asset' && asset.fileName.endsWith('.css')).map(asset => asset.type === 'asset' ? String(asset.source) : '').join('\n')
        if (!css) return
        const compatible = await postcss([cascadeLayers(), colorMix({ preserve: true }), oklab({ preserve: true })]).process(css, { from: undefined })
        this.emitFile({ type: 'asset', fileName: 'compat.css', source: compatible.css })
      } },
    },
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
        const boot = `<meta name="mellow-build-id" content="${buildId}" /><script>(function(){var m=document.querySelector('meta[name="mellow-build-id"]');var e=m&&m.content;if(!e||!window.fetch)return;var base=document.querySelector('base');var b=base&&base.href||'/';fetch(b+'version.json?t='+Date.now(),{cache:'no-store'}).then(function(r){return r.ok?r.json():null}).then(function(v){try{if(v&&v.buildId&&v.buildId!==e&&!sessionStorage.getItem('mellow-boot-reload')){sessionStorage.setItem('mellow-boot-reload','1');location.reload()}}catch(ignore){}}).catch(function(){})})();</script>`
        return html.replace('</head>', `${boot}</head>`)
      },
    },
  ],
  server: {
    port: 5173,
    host: true,
  },
})
