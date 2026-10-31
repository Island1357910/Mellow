import { APPLE_THEME } from '../../theme/apple.ts'
import { useEffect, useRef, useState } from 'react'
import { BUNDLED_THEMES } from '../../theme/themes.ts'
import { useMellow } from '../../store/useMellow.ts'
import { storage } from '../../storage/StorageService.ts'
import { readCoins, spendCoins } from '../../lib/wallet.ts'
import { Screen } from '../ui/primitives.tsx'
import type { Theme } from '../../types/index.ts'
const BASE = BUNDLED_THEMES.find(t => t.id === 'theme_macaron')!
const PACKS: Array<{ theme: Theme; price: number; description: string }> = [
  { theme: BUNDLED_THEMES.find(t => t.id === 'theme_halloween')!, price: 0, description: '南瓜烛光、葡萄紫与幽雾，夜里的小小恶作剧。10 月 31 日自动装扮。' },
  { theme: { ...BASE, id: 'theme_shop_stars', name: '星屑邮局', effect: 'stars', customPalette: true, colors: { ...BASE.colors, primary: '#BDA5EE', secondary: '#E0B5CF', background: '#211E39', surface: '#34304D', text: '#FAF1E8', textSecondary: '#C7BBD8' } }, price: 30, description: '深蓝信封、细碎星光和柔紫卡片，让每一条消息都有抵达的方向。' },
  { theme: { ...BASE, id: 'theme_shop_mist', name: '雾中温室', effect: 'mist', customPalette: true, colors: { ...BASE.colors, primary: '#6C9E8A', secondary: '#B8CFB5', background: '#E4EEE8', surface: '#F4F8ED', text: '#263F37', textSecondary: '#5F7467' } }, price: 24, description: '低饱和鼠尾草、轻雾背景、奶油色纸张，适合慢慢读一段故事。' },
]
export function ThemeShopApp({ onBack }: { onBack: () => void }) {
  const state = useMellow()
  const phone = state.identities.find(i => i.id === state.activeIdentityId)
  const [owned, setOwned] = useState<string[]>([])
  const [balance, setBalance] = useState(0)
  const [note, setNote] = useState('')
  const [ready, setReady] = useState(false)
  const busy = useRef(false)
  useEffect(() => { let alive=true; if(phone) void Promise.all([storage.getBag<string[]>(phone.namespace,'owned_themes'),readCoins(phone.namespace)]).then(([o,b])=>{if(alive){setOwned(o??[]);setBalance(b);setReady(true)}});return()=>{alive=false} },[phone])
  const buy = async (pack: typeof PACKS[number]) => {
    if (!phone || busy.current || !ready) return
    busy.current=true
    try {
      if (!owned.includes(pack.theme.id) && pack.price) { const next=await spendCoins(phone.namespace,pack.price);setBalance(next);const ids=[...owned,pack.theme.id];await storage.setBag(phone.namespace,'owned_themes',ids);setOwned(ids) }
      await storage.saveTheme(pack.theme);await state.reloadLibraries();await state.patchSettings({themeId:pack.theme.id});setNote(`已选择「${pack.theme.name}」${new Date().getMonth()===9 && new Date().getDate()===31 ? '，万圣节结束后生效' : ''}`)
    }catch(e){setNote(e instanceof Error?e.message:'购买失败')}finally{busy.current=false}
  }
  return <div className="sms-shell h-full"><Screen title="主题衣橱" subtitle={`给小手机换一种心情 · 余额 ${balance} 枚`} onBack={onBack}>
    <div className="mb-4 rounded-3xl p-5" style={{background:'linear-gradient(135deg,var(--m-primary),var(--m-secondary))'}}><p className="text-xs">MELLOW ATELIER</p><h2 className="mt-2 text-2xl font-semibold">把喜欢穿在屏幕上</h2><p className="mt-2 text-xs">用乘风赚来的货币收藏装扮。购买永久保留在当前身份。</p></div>
    <div className="space-y-4">{[...PACKS,...(state.themes.some(t=>t.id===APPLE_THEME.id)?[{theme:APPLE_THEME,price:0,description:'开群纪念 · 已兑换获得。红苹果、果肉粉黄与叶绿，封面 Logo 同步变色。'}]:[])].map(pack=><article className="menu-card" key={pack.theme.id}><div data-holiday-preserve className="relative h-28 overflow-hidden rounded-2xl p-4" style={{background:pack.theme.colors.background,color:pack.theme.colors.text}}><span className="text-3xl">{pack.theme.effect==='stars'?'✦':pack.theme.effect==='mist'?'☁':'☾'}</span><p className="mt-2 font-semibold">{pack.theme.name}</p><div className="absolute right-4 top-4 flex gap-1">{[pack.theme.colors.primary,pack.theme.colors.secondary,pack.theme.colors.accent].map((c,i)=><span key={i} className="h-5 w-5 rounded-full" style={{background:c}}/>)}</div></div><p className="my-3 text-xs leading-5">{pack.description}</p><button className="chip chip-solid" disabled={!ready} onClick={()=>void buy(pack)}>{owned.includes(pack.theme.id)||!pack.price?'应用套组':`购买并应用 · ${pack.price} 枚`}</button></article>)}</div>
    {note&&<p className="mt-3 text-xs" role="status">{note}</p>}<button className="chip mt-4" onClick={()=>state.openApp('settings')}>去设置自由设计主题</button>
  </Screen></div>
}
