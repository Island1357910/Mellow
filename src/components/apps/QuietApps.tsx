import { useState } from 'react'
import { CATEGORY_LABEL, MARKET_LISTINGS } from '../../data/market.ts'
import { useMellow } from '../../store/useMellow.ts'
import type { MarketListing } from '../../types/index.ts'
import { Screen } from '../ui/primitives.tsx'
import { StoryApp } from './StoryApp.tsx'

export function OfflineApp(props: { onBack: () => void }) {
  return <StoryApp mode="offline" onBack={props.onBack} />
}

export function SideApp(props: { onBack: () => void }) {
  return <StoryApp mode="side" onBack={props.onBack} />
}

type MarketTab = 'all' | 'mine' | MarketListing['category']

const TINTS = ['#F8D0DC', '#D5F0E4', '#F8E6C0', '#E6DDF8', '#D7E7F8', '#FBE0D2']
const ICONS: Record<string, string> = { diary: '📔', star: '⭐', duotao: '🛍️', flash: '🛵', huizhen: '🪡', table: '🎲', pet: '🐾', plant: '🪴', body: '🩺', dream: '🌙', spark: '💡', write: '✒️', music: '🎼', create: '✒️', forum: '💬' }

export function MarketApp(props: { onBack: () => void }) {
  const settings = useMellow((state) => state.settings)
  const patchSettings = useMellow((state) => state.patchSettings)
  const [tab, setTab] = useState<MarketTab>('all')
  const installed = new Set(settings.installedApps)
  const categories = (Object.keys(CATEGORY_LABEL) as Array<MarketListing['category']>).filter((key) => MARKET_LISTINGS.some((item) => item.category === key))
  const tabs: Array<[MarketTab, string, string]> = [
    ['all', '全部', '#F3A8BA'],
    ['mine', '已装上', '#9ED9C4'],
    ...categories.map((key, index) => [key, CATEGORY_LABEL[key], ['#F0D48A', '#C9B6E8', '#A9CBEF', '#F4B79A'][index % 4]] as [MarketTab, string, string]),
  ]
  const toggle = (id: string) => {
    const next = installed.has(id) ? settings.installedApps.filter((item) => item !== id) : [...settings.installedApps, id]
    void patchSettings({ installedApps: next })
  }
  const list = MARKET_LISTINGS.filter((item) => (tab === 'all' ? true : tab === 'mine' ? installed.has(item.id) : item.category === tab))
  const ready = list.filter((item) => item.status === 'ready')
  const soon = list.filter((item) => item.status !== 'ready')
  const mineCount = MARKET_LISTINGS.filter((item) => installed.has(item.id)).length
  const pending = MARKET_LISTINGS.filter((item) => item.status !== 'ready').length

  const row = (item: MarketListing, index: number) => (
    <li key={item.id} className="flex items-center gap-3 px-3 py-3">
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-[16px] text-[22px] shadow-[inset_0_-3px_0_rgba(0,0,0,0.04)]" style={{ background: TINTS[index % TINTS.length] }}>
        {ICONS[item.id] ?? item.name.slice(0, 1)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-[15px] font-medium">{item.name}</span>
          <span className="shrink-0 rounded-full bg-black/[0.04] px-1.5 text-[10px]" style={{ color: 'var(--m-text-secondary)' }}>{CATEGORY_LABEL[item.category]}</span>
        </span>
        <span className="mt-0.5 line-clamp-2 block text-xs leading-[18px]" style={{ color: 'var(--m-text-secondary)' }}>{item.description}</span>
      </span>
      {item.status === 'ready' ? (
        <button type="button" className={installed.has(item.id) ? 'chip chip-mint shrink-0' : 'chip chip-pink shrink-0'} style={{ fontSize: 12, padding: '5px 14px' }} onClick={() => toggle(item.id)}>
          {installed.has(item.id) ? '已装上' : '装上'}
        </button>
      ) : (
        <span className="chip chip-butter shrink-0 cursor-default" style={{ fontSize: 12, padding: '5px 12px' }}>即将上架</span>
      )}
    </li>
  )

  return (
    <div className="sms-shell relative h-full min-h-0">
      <Screen title="市场" subtitle="装上就出现在主页" onBack={props.onBack}>
        <div className="mb-3 flex gap-1 rounded-full bg-white/55 p-1 text-xs shadow-[0_8px_18px_rgba(120,80,100,0.05)]">
          {tabs.map(([id, label, color]) => (
            <button key={id} type="button" className="flex-1 whitespace-nowrap rounded-full py-1.5" style={{ background: tab === id ? color : 'transparent' }} onClick={() => setTab(id)}>
              {label}
            </button>
          ))}
        </div>
        {tab === 'all' ? (
          <div className="mb-3 flex items-center gap-3 rounded-[24px] p-4 shadow-[0_10px_22px_rgba(243,168,186,0.18)]" style={{ background: 'linear-gradient(135deg,#FFE3EE,#EFE6FF 60%,#DDF3EA)' }}>
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-[16px] bg-white/80 text-2xl">🧁</span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-semibold">今日上新</span>
              <span className="block text-xs" style={{ color: 'var(--m-text-secondary)' }}>{pending ? `已装上 ${mineCount} 个 · 还有 ${pending} 个在路上` : `已装上 ${mineCount} 个 · 这一页都可以装`}</span>
            </span>
          </div>
        ) : null}
        {ready.length ? (
          <ul className="divide-y divide-black/[0.05] overflow-hidden rounded-[24px] bg-white/85 shadow-[0_8px_18px_rgba(120,80,100,0.05)]">
            {ready.map((item, index) => row(item, index))}
          </ul>
        ) : null}
        {soon.length ? (
          <>
            <p className="mb-2 ml-1 mt-4 text-xs" style={{ color: 'var(--m-text-secondary)' }}>即将上架</p>
            <ul className="divide-y divide-black/[0.05] overflow-hidden rounded-[24px] bg-white/70 shadow-[0_8px_18px_rgba(120,80,100,0.04)]">
              {soon.map((item, index) => row(item, index + ready.length))}
            </ul>
          </>
        ) : null}
        {list.length === 0 ? <p className="mt-10 text-center text-sm" style={{ color: 'var(--m-text-secondary)' }}>还没有装上的应用，去「全部」里挑一个</p> : null}
      </Screen>
    </div>
  )
}
