// Isolated QA uses real home components and a stylesheet with old-engine features removed.
import '../../src/lib/runtimeCompat.ts'
import { createRoot } from 'react-dom/client'
import { HomeScreen } from '../../src/components/os/HomeScreen.tsx'
import { Wallpaper } from '../../src/components/os/LockScreen.tsx'
import { useMellow } from '../../src/store/useMellow.ts'
import { themeStyle } from '../../src/theme/applyTheme.ts'
import { BUNDLED_THEMES } from '../../src/theme/themes.ts'
if (location.search.includes('legacy')) {
  await new Promise<void>((resolve, reject) => { const link = document.createElement('link'); link.rel='stylesheet'; link.href='/artifacts/home-legacy.css'; link.onload=()=>resolve(); link.onerror=reject; document.head.appendChild(link) })
} else await import('../../src/index.css')
await useMellow.getState().boot()
await useMellow.getState().patchSettings({ themeId: 'theme_macaron' })
createRoot(document.getElementById('root')!).render(<div className="stage"><div className="device" style={themeStyle(BUNDLED_THEMES.find(theme=>theme.id==='theme_macaron')!)}><div className="relative min-h-0 flex-1"><Wallpaper/><HomeScreen/></div></div></div>)
