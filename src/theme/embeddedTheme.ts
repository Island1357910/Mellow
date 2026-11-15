import embeddedSeine from './seine-embedded.css?url'

export function applyEmbeddedTheme(frame: HTMLIFrameElement, app: 'live' | 'bakery') {
  const document = frame.contentDocument
  if (!document || document.URL !== frame.src) return
  const themed = frame.closest('.device')?.getAttribute('data-theme-pack') === 'seine'
  document.documentElement.dataset.seineApp = themed ? app : ''
  if (themed && !document.getElementById('mellow-seine-theme')) {
    const stylesheet = document.createElement('link')
    stylesheet.id = 'mellow-seine-theme'
    stylesheet.rel = 'stylesheet'
    stylesheet.href = new URL(embeddedSeine, frame.ownerDocument.baseURI).href
    document.head.append(stylesheet)
  }
}
