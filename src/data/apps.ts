export interface PhoneApp {
  id: string
  name: string
  blurb: string
  tint: string
  dock: boolean
  fixed: boolean
  /** 出现在主页图标网格里。搜索栏是应用，但不是这种图标。 */
  home: boolean
  /** 新应用直接放第三页，不挤进第二页。 */
  late?: boolean
}

export const PHONE_APPS: PhoneApp[] = [
  { id: 'messages', name: '短信', blurb: '消息', tint: '#F3A8BA', dock: true, fixed: true, home: true },
  { id: 'offline', name: '线下', blurb: '面对面', tint: '#9ED9C4', dock: true, fixed: true, home: true },
  { id: 'side', name: '番外', blurb: '另一条线', tint: '#C9B6E8', dock: false, fixed: true, home: true },
  { id: 'market', name: '市场', blurb: '装应用', tint: '#F0D48A', dock: false, fixed: true, home: true },
  { id: 'chengfeng', name: '乘风', blurb: '小游戏', tint: '#F2B48A', dock: false, fixed: true, home: true },
  { id: 'worldbook', name: '世界书', blurb: '这个身份的设定', tint: '#E7B7C9', dock: false, fixed: true, home: true },
  { id: 'map', name: '地图', blurb: '走走看看', tint: '#9ED9C4', dock: false, fixed: true, home: true },
  { id: 'settings', name: '设置', blurb: '接口与外观', tint: '#A9CDE8', dock: true, fixed: true, home: true },
  { id: 'search', name: '搜索', blurb: '地址栏', tint: '#E7E0D8', dock: false, fixed: true, home: false },
  { id: 'diary', name: '日记', blurb: '自己的一页', tint: '#E8D4B0', dock: false, fixed: false, home: true },
  { id: 'star', name: '星博', blurb: '大家的生活', tint: '#F0B7A8', dock: false, fixed: false, home: true },
  { id: 'duotao', name: '多淘', blurb: '购物车结账', tint: '#F3C27A', dock: false, fixed: false, home: true },
  { id: 'flash', name: '闪送', blurb: '点餐', tint: '#F0C56A', dock: false, fixed: false, home: true },
  { id: 'huizhen', name: '回针', blurb: '互相看手机', tint: '#B7C9E8', dock: false, fixed: false, home: true },
  { id: 'table', name: '桌游', blurb: '和人一起玩', tint: '#C9B6E8', dock: false, fixed: false, home: true },
  { id: 'pet', name: '宠物日记', blurb: '家里的小动物', tint: '#F0C2B0', dock: false, fixed: false, home: true },
  { id: 'plant', name: '植物管家', blurb: '浇水', tint: '#9ED9C4', dock: false, fixed: false, home: true },
  { id: 'body', name: '身体记录', blurb: '睡和吃', tint: '#F2B48A', dock: false, fixed: false, home: true },
  { id: 'dream', name: '梦境电台', blurb: '把梦留下', tint: '#C9B6E8', dock: false, fixed: false, home: true },
  { id: 'spark', name: '灵感捕手', blurb: '一句没写完', tint: '#F0D48A', dock: false, fixed: false, home: true },
  { id: 'write', name: '写作助手', blurb: '把一段写完', tint: '#E7B7C9', dock: false, fixed: false, home: true },
  { id: 'music', name: '音乐速记', blurb: '旋律和一句词', tint: '#A9CDE8', dock: false, fixed: false, home: true },
  { id: 'create', name: '创作', blurb: '一键出卡', tint: '#E7B7C9', dock: false, fixed: false, home: true, late: true },
  { id: 'forum', name: '论坛', blurb: '帖子和吃瓜', tint: '#F0C56A', dock: false, fixed: false, home: true, late: true },
  { id: 'jiushi', name: '旧世', blurb: '穿书入境', tint: '#D4C4A8', dock: false, fixed: false, home: true, late: true },
  { id: 'worldforge', name: '世界搭建', blurb: '拆大世界卡', tint: '#B8C9D4', dock: false, fixed: false, home: true, late: true },
]

/** 第二页图标再多就放不下，多出来的和新应用去第三页。 */
export const HOME_PAGE_CAP = 12

export function homePages(installed: string[]): { page2: PhoneApp[]; page3: PhoneApp[] } {
  const apps = homeApps(installed)
  const primary = apps.filter((app) => !app.late)
  const extra = apps.filter((app) => app.late)
  return {
    page2: primary.slice(0, HOME_PAGE_CAP),
    page3: [...primary.slice(HOME_PAGE_CAP), ...extra],
  }
}

export const APP_BY_ID = Object.fromEntries(PHONE_APPS.map((app) => [app.id, app]))

export function homeApps(installed: string[]): PhoneApp[] {
  return PHONE_APPS.filter((app) => app.home && (app.fixed || installed.includes(app.id)))
}
