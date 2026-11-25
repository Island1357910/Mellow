import cascadeLayers from '@csstools/postcss-cascade-layers'
import colorMix from '@csstools/postcss-color-mix-function'
import oklab from '@csstools/postcss-oklab-function'
import legacy from '@vitejs/plugin-legacy'
import postcss from 'postcss'
import logical from 'postcss-logical'
import type { Plugin } from 'vite'

const boot = `<script>!function(){if(window.__mellowEmbedCss)return;window.__mellowEmbedCss=1;if(!window.CSS||!window.CSS.supports||!window.CSS.supports("color","color-mix(in srgb,red,blue)")||!("CSSLayerBlockRule"in window)){var s=document.createElement("link");s.rel="stylesheet";s.href="./compat.css";document.head.appendChild(s)}}();</script>`

function sameOriginTag(tag: string) {
  if (/https?:\/\//i.test(tag)) return tag
  return tag.replace(/ crossorigin(?:="[^"]*"|='[^']*'|=[^\s>]+)?/gi, '')
}

/** 内嵌页共用经典脚本入口，避免旧 WebView 的模块能力探测影响启动。 */
export function embedLegacyPlugins(): Plugin[] {
  return [
    ...legacy({
      targets: ['Chrome >= 60'],
      modernTargets: ['Chrome >= 64'],
    }) as Plugin[],
    {
      name: 'embed-legacy-css',
      enforce: 'post',
      generateBundle: {
        order: 'post',
        async handler(_options, bundle) {
          const css = Object.values(bundle)
            .filter(asset => asset.type === 'asset' && asset.fileName.endsWith('.css') && !asset.fileName.includes('compat'))
            .map(asset => asset.type === 'asset' ? String(asset.source) : '')
            .join('\n')
          if (!css.trim()) return
          const compatible = await postcss([
            logical(),
            cascadeLayers(),
            colorMix({ preserve: true }),
            oklab({ preserve: true }),
          ]).process(css, { from: undefined })
          this.emitFile({ type: 'asset', fileName: 'compat.css', source: compatible.css })
        },
      },
      transformIndexHtml: {
        order: 'post',
        handler(html, { bundle }) {
          if (!bundle) return html
          // Vite emits the stylesheet with its modern bundle. Only the classic scripts are needed in the page.
          return html
            .replace(/^[ \t]*<script type="module"[^>]*>[\s\S]*?<\/script>\s*$/gm, '')
            .replace(/^[ \t]*<script nomodule>[^<]*<\/script>\s*$/gm, '')
            .replace(/^[ \t]*<link rel="modulepreload"[^>]*>\s*$/gm, '')
            .replace(/<script nomodule(?=\s[^>]*\bid="vite-legacy-(?:polyfill|entry)")/g, '<script')
            .replace('</head>', `${boot}</head>`)
            .replace(/<(?:script|link)\b[^>]*>/gi, sameOriginTag)
        },
      },
    },
  ]
}
