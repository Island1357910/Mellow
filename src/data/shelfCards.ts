export type ShelfEra = 'modern' | 'ancient'

export interface ShelfCard {
  id: string
  name: string
  era: ShelfEra
  file: string
  blurb: string
  intro: string
}

export const SHELF_CARDS: ShelfCard[] = [
  { id: 'yan-changzhi', name: '严长知', era: 'modern', file: 'yan-changzhi.png', blurb: '投资公司创始人', intro: '做事干脆，话不多，决定下得快。适合想要一个清醒、有主见的现代对象。' },
  { id: 'xu-lanqing', name: '徐兰青', era: 'modern', file: 'xu-lanqing.png', blurb: '财阀掌权人', intro: '家里生意的掌事人。场面里从容，私下有自己的分寸。适合想要一个沉稳的现代对象。' },
  { id: 'fang-tang', name: '方唐', era: 'modern', file: 'fang-tang.png', blurb: '外表张扬，心里很软', intro: '看着张扬，相处久了会露出软的一面。适合想要一个外热内软的现代对象。' },
  { id: 'yin-zhean', name: '殷折安', era: 'modern', file: 'yin-zhean.png', blurb: '娱乐经纪人', intro: '给人安排行程的经纪人。会照顾人，也会把话说清楚。适合想要一个会张罗的现代对象。' },
  { id: 'lan-yuzhou', name: '蓝与舟', era: 'modern', file: 'lan-yuzhou.png', blurb: '都市青年，破镜重圆', intro: '城市里重新遇见的年轻人。旧事还在，语气已经放轻。适合一段把关系慢慢接回去的现代故事。' },
  { id: 'lu-huaiyuan', name: '路怀远', era: 'modern', file: 'lu-huaiyuan.png', blurb: '温和靠谱', intro: '说话温和，做事靠得住。适合想要一个让人安心的现代对象。' },
  { id: 'stardew', name: '欢迎来到星露谷', era: 'modern', file: 'stardew.json', blurb: '鹈鹕镇的农场生活', intro: '这是一张世界卡，不是单独一个人。装进去之后，会在鹈鹕镇过农场和邻居的日子。' },
  { id: 'yin-zhenya', name: '殷枕崖', era: 'ancient', file: 'yin-zhenya.png', blurb: '内阁首辅', intro: '古风里的内阁首辅。话有分量，也会把人放在心上。只会进旧世，不会出现在现代短信里。' },
]

export function shelfCardUrl(card: ShelfCard): string {
  return `${import.meta.env.BASE_URL}cards/${card.file}`
}

export function shelfWhere(card: ShelfCard): string {
  if (card.era === 'ancient') return '这是古风卡，会进旧世，不出现在现代短信里。'
  if (card.id === 'stardew') return '这是现代世界卡，会进短信，由它带你过鹈鹕镇的日子。'
  return '这是现代卡，会进短信。'
}
