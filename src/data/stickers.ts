import { PACK_STICKERS } from './stickers-pack.ts'

export interface Sticker {
  url: string
  label: string
}

export const SMS_STICKERS: Sticker[] = [
  { url: 'https://pic1.imgdb.cn/i/033tXLDKaBIYFH0cgM4JOb.jpg', label: '小猫跺脚耍小脾气' },
  { url: 'https://pic1.imgdb.cn/i/033tXLDFPmzwIpwljDRydZ.jpg', label: '小猫叼玫瑰满屏爱心' },
  { url: 'https://pic1.imgdb.cn/i/033tXLCyeY55ZZpLoGlnzR.jpg', label: '不对劲' },
  { url: 'https://pic1.imgdb.cn/i/033tXLDJbxwroKIbGHe6ks.jpg', label: '暖好被窝，好舒服' },
  { url: 'https://pic1.imgdb.cn/i/033tXLD38WxCHFw91sIhSC.jpg', label: '咬' },
  { url: 'https://pic1.imgdb.cn/i/033tXnF1M7BRMJsO6HvbAl.jpg', label: '手机坏掉了，都收不到你的消息' },
  { url: 'https://pic1.imgdb.cn/i/033tXnEtMKNgAriQ5aEv5O.jpg', label: '收到' },
  { url: 'https://pic1.imgdb.cn/i/033tXwvBkgRgL37YYipqVe.jpg', label: '小猫一拳被打成猫饼' },
  { url: 'https://pic1.imgdb.cn/i/033tXnF2WYWeRbA78SURXJ.jpg', label: '九九成稀罕物' },
  { url: 'https://pic1.imgdb.cn/i/033tWPWeOnGQafzIhKOQIy.jpg', label: '小猫躲在墙边偷看' },
  { url: 'https://pic1.imgdb.cn/i/033tY82Oq1MCIZlgWKWAML.jpg', label: '咪' },
  { url: 'https://pic1.imgdb.cn/i/033tY81edBVFmIywVioo47.jpg', label: '思考' },
  { url: 'https://pic1.imgdb.cn/i/033tY81jPVZmiSteJ7xvqa.jpg', label: '略——！' },
  { url: 'https://pic1.imgdb.cn/i/033tY8244mEAmlsFPPsHkX.jpg', label: '被后颈提起来' },
  { url: 'https://pic1.imgdb.cn/i/033tY81j7TVsjeu81TkP82.jpg', label: '躺靠枕头玩手机超开心' },
  { url: 'https://pic1.imgdb.cn/i/033tY81rJDPdjWobxZ27xB.jpg', label: '啧' },
  { url: 'https://pic1.imgdb.cn/i/033tY82Ok3Qy7GCVlZipL6.jpg', label: '满脸不爽' },
  { url: 'https://pic1.imgdb.cn/i/033tWRvnARtM7esVyWA9tG.jpg', label: '捧着手机疯狂大哭' },
  { url: 'https://pic1.imgdb.cn/i/033tWUP0JHB7kbkSQi8thE.jpg', label: '无语省略号' },
  { url: 'https://pic1.imgdb.cn/i/033tWbBYI78vcPKl6VQL6J.jpg', label: '额头冒怒气' },
  { url: 'https://pic1.imgdb.cn/i/033tWtZdSJyHRTIzCwharm.jpg', label: '头顶大问号' },
  { url: 'https://pic1.imgdb.cn/i/033tX0fFU2BrPLZ9H5yR4e.jpg', label: '我恨！！！' },
  { url: 'https://pic1.imgdb.cn/i/033tX4o1jaC69ptwRWTm9c.jpg', label: '脸上冒虚汗' },
  { url: 'https://pic1.imgdb.cn/i/033tX6P7uPsETPypdTDlRt.jpg', label: '周围飘爱心' },
  { url: 'https://s41.ax1x.com/2026/02/11/pZbVlQJ.jpg', label: '女士们注意了色狼来了' },
  { url: 'https://s41.ax1x.com/2026/06/21/pmJpwoF.jpg', label: '哪儿来那么多规矩' },
  { url: 'https://pic1.imgdb.cn/item/6a4caf33531aaa3c3f26590c.jpg', label: '命苦' },
  { url: 'https://s41.ax1x.com/2026/06/21/pmJpXTS.jpg', label: '抵制恶俗自觉从良' },
  { url: 'https://pic1.imgdb.cn/item/6a4cb261531aaa3c3f269ed7.jpg', label: '缩成一团哭唧唧' },
  { url: 'https://pic1.imgdb.cn/item/6a4cb261531aaa3c3f269ed6.jpg', label: '一笑了之' },
  { url: 'https://pic1.imgdb.cn/item/6a4caf33531aaa3c3f26590f.jpg', label: '你就是我的宝宝' },
  { url: 'https://pic1.imgdb.cn/item/6a4cab64531aaa3c3f265491.jpg', label: '聊几句又不回了，我是小三吗？' },
  { url: 'https://pic1.imgdb.cn/item/6a4caf33531aaa3c3f26590d.jpg', label: '出来亲嘴' },
]

export const ALL_SMS_STICKERS: Sticker[] = [...SMS_STICKERS, ...PACK_STICKERS]

export function stickerLabel(content: string): string {
  return ALL_SMS_STICKERS.find((item) => item.url === content)?.label ?? '表情'
}
