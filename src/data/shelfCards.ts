export type ShelfEra = 'modern' | 'ancient'

export interface ShelfCard {
  id: string
  name: string
  era: ShelfEra
  file: string
  blurb: string
}

export const SHELF_CARDS: ShelfCard[] = [
  { id: 'yan-changzhi', name: '严长知', era: 'modern', file: 'yan-changzhi.png', blurb: '投资公司创始人' },
  { id: 'xu-lanqing', name: '徐兰青', era: 'modern', file: 'xu-lanqing.png', blurb: '财阀掌权人' },
  { id: 'fang-tang', name: '方唐', era: 'modern', file: 'fang-tang.png', blurb: '外表张扬，心里很软' },
  { id: 'yin-zhean', name: '殷折安', era: 'modern', file: 'yin-zhean.png', blurb: '娱乐经纪人' },
  { id: 'lan-yuzhou', name: '蓝与舟', era: 'modern', file: 'lan-yuzhou.png', blurb: '都市青年，破镜重圆' },
  { id: 'lu-huaiyuan', name: '路怀远', era: 'modern', file: 'lu-huaiyuan.png', blurb: '温和靠谱' },
  { id: 'stardew', name: '欢迎来到星露谷', era: 'modern', file: 'stardew.json', blurb: '鹈鹕镇的农场生活' },
  { id: 'yin-zhenya', name: '殷枕崖', era: 'ancient', file: 'yin-zhenya.png', blurb: '内阁首辅' },
]

export function shelfCardUrl(card: ShelfCard): string {
  return `${import.meta.env.BASE_URL}cards/${card.file}`
}

export function shelfWhere(card: ShelfCard): string {
  if (card.era === 'ancient') return '这是古风卡，会进旧世，不出现在现代短信里。'
  if (card.id === 'stardew') return '这是现代世界卡，会进短信，由它带你过鹈鹕镇的日子。'
  return '这是现代卡，会进短信。'
}
