export interface GiftItem {
  id: string
  icon: string
  name: string
  price: number
  /** 实物礼物的简介 */
  note?: string
}

/** 虚拟礼物，用乘风赚来的糖币买，送出就是一份心意。 */
export const VIRTUAL_GIFTS: GiftItem[] = [
  { id: 'heart', icon: '💗', name: '比心', price: 1 },
  { id: 'rose', icon: '🌹', name: '玫瑰', price: 2 },
  { id: 'candy', icon: '🍬', name: '半糖', price: 3 },
  { id: 'milktea', icon: '🧋', name: '奶茶', price: 5 },
  { id: 'star', icon: '🌟', name: '星星', price: 8 },
  { id: 'cake', icon: '🎂', name: '蛋糕', price: 12 },
  { id: 'crown', icon: '👑', name: '皇冠', price: 20 },
  { id: 'rocket', icon: '🚀', name: '火箭', price: 52 },
  { id: 'castle', icon: '🏰', name: '城堡', price: 99 },
]

/** 实物礼物，下单后由小手机里的快递送到对方手上。 */
export const REAL_GIFTS: GiftItem[] = [
  { id: 'bouquet', icon: '💐', name: '一束小雏菊', price: 18, note: '同城两小时送达' },
  { id: 'strawberry', icon: '🍓', name: '草莓蛋糕', price: 26, note: '六寸，附手写卡' },
  { id: 'plush', icon: '🧸', name: '小熊玩偶', price: 32, note: '抱起来软乎乎' },
  { id: 'scarf', icon: '🧣', name: '羊绒围巾', price: 45, note: '奶油白，礼盒装' },
  { id: 'perfume', icon: '🫧', name: '香水小样', price: 38, note: '白茶与无花果' },
  { id: 'headphone', icon: '🎧', name: '无线耳机', price: 88, note: '一起听歌刚好' },
]

export const GIFT_COUNTS = [1, 3, 10, 66] as const
