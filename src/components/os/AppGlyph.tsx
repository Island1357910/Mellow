import { BookHeart, Clapperboard, Globe, Bike, BookMarked, BookOpen, Bot, Coffee, Dices, Feather, Hammer, HeartPulse, IdCard, Library, Lightbulb, Map, MessageCircle, Moon, Music, NotebookPen, PawPrint, PenLine, Radio, ScanLine, Scroll, Settings, ShoppingBag, Sparkles, Sprout, Store, Wind } from 'lucide-react'
import { useMellow } from '../../store/useMellow.ts'

const ICONS = {
  life: BookHeart,
  themes: Sparkles,
  connections: Globe,
  messages: MessageCircle,
  offline: Coffee,
  side: BookOpen,
  romance: Bot,
  market: Store,
  chengfeng: Wind,
  create: PenLine,
  worldbook: Library,
  forum: BookMarked,
  map: Map,
  settings: Settings,
  diary: NotebookPen,
  star: Sparkles,
  duotao: ShoppingBag,
  flash: Bike,
  huizhen: ScanLine,
  table: Dices,
  pet: PawPrint,
  plant: Sprout,
  body: HeartPulse,
  dream: Moon,
  spark: Lightbulb,
  write: Feather,
  music: Music,
  jiushi: Scroll,
  worldforge: Hammer,
  bazaar: IdCard,
  stage: Clapperboard,
  live: Radio,
}

export function AppGlyph(props: { id: string; tint: string; size?: number; ignoreCustom?: boolean }) {
  const custom = useMellow((state) => props.ignoreCustom ? undefined : state.settings.appIcons[props.id])
  const Icon = ICONS[props.id as keyof typeof ICONS] ?? MessageCircle
  const box = props.size ?? 54
  return (
    <span
      className="app-glyph grid place-items-center overflow-hidden"
      style={{
        width: box,
        height: box,
        borderRadius: Math.round(box * 0.32),
        background: props.tint,
        color: '#3a3a3a',
        boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.35)',
      }}
    >
      {custom?.startsWith('data:') ? (
        <img src={custom} alt="" className="h-full w-full object-cover" />
      ) : custom ? (
        <span className="text-xl">{custom}</span>
      ) : (
        <Icon size={box > 52 ? 26 : box >= 40 ? 22 : Math.max(11, Math.round(box * 0.62))} strokeWidth={1.75} />
      )}
    </span>
  )
}
