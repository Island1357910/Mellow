/** 主页地图新手引导：按顺序点击标签（与经营链 / 研发链一致） */

export const HUB_ONBOARDING_STEPS = [
  {
    pageId: 'procurement',
    title: '采购',
    lines: [
      '经营链第一步：在超市卖场采购原料，也可用购物车与 AI 生成条目。',
      '请点击地图上的「采购」标签进入。',
    ],
  },
  {
    pageId: 'craftFloor',
    title: '工坊',
    lines: [
      '经营链第二步：工坊内管理库存与仓库、制作馅料，并查看探索进度。',
      '请点击「工坊」标签。',
    ],
  },
  {
    pageId: 'gameBakery',
    title: '面包房',
    lines: [
      '经营链第三步：早晨整理与上架，白天制作与研发，夜晚查看结算。',
      '请点击「面包房」标签。',
    ],
  },
  {
    pageId: 'gameStore',
    title: '店面',
    lines: [
      '经营链第四步：开门营业后在此接待顾客、完成销售。',
      '请点击「店面」标签。',
    ],
  },
  {
    pageId: 'workshop',
    title: '工作室',
    lines: [
      '新品研发链：配方、原理、比赛、定制与主线/人物志等内容向玩法集中于此。',
      '请点击「工作室」标签。',
    ],
  },
  {
    pageId: 'settings',
    title: '设置',
    lines: [
      '可在此配置 AI 接口、背景音乐与其它偏好。',
      '最后点击「设置」了解入口位置即可。',
    ],
  },
];

export const HUB_ONBOARDING_EVENT = 'qianwei-hub-onboarding-changed';
