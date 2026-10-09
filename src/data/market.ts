import type { MarketListing } from '../types/index.ts'

export const MARKET_LISTINGS: MarketListing[] = [
  { id: 'diary', name: '日记', category: 'life', description: '只写给自己的一页。角色不会自动翻开，除非你愿意提起。', status: 'ready' },
  { id: 'star', name: '星博', category: 'social', description: '很多人一起发生活。可以看详情、评论、点赞，自己也可以写。', status: 'ready' },
  { id: 'duotao', name: '多淘', category: 'life', description: '加进购物车再一起结账。可以买给自己，也可以买给某个人。大概两三天到。', status: 'ready' },
  { id: 'flash', name: '闪送', category: 'life', description: '像点一份吃的。进购物车结账，同样要等送达。', status: 'ready' },
  { id: 'huizhen', name: '回针', category: 'social', description: '绑定之后看 TA 愿意打开的应用。右上角是你给 TA 看的权限。', status: 'ready' },
  { id: 'table', name: '桌游', category: 'fun', description: '海龟汤、剧本杀、你画我猜、你说我猜、狼人杀、UNO、五子棋、象棋。双人或多人都行。', status: 'ready' },
  { id: 'pet', name: '宠物日记', category: 'life', description: '喂一喂、玩一玩，把家里的小动物记下来。', status: 'ready' },
  { id: 'plant', name: '植物管家', category: 'life', description: '浇水、发蔫、被忘记。', status: 'ready' },
  { id: 'body', name: '身体记录', category: 'life', description: '睡觉、吃饭、身体。关心的人以后会问。', status: 'ready' },
  { id: 'dream', name: '梦境电台', category: 'life', description: '把梦留下。它可能会漏到别的地方。', status: 'ready' },
  { id: 'spark', name: '灵感捕手', category: 'create', description: '一句没写完的话，先抓住。', status: 'ready' },
  { id: 'write', name: '写作助手', category: 'create', description: '陪你把一段写完。', status: 'ready' },
  { id: 'music', name: '音乐速记', category: 'create', description: '一段旋律，一句词。', status: 'ready' },
  { id: 'create', name: '创作', category: 'create', description: '写好想要的人，一键出整张角色卡。可以沿用世界书里已经启用的世界观。', status: 'ready' },
  { id: 'forum', name: '论坛', category: 'social', description: '发帖、看帖、评论。也可以丢一句想看的剧情，让路人或角色写出来。', status: 'ready' },
  { id: 'jiushi', name: '旧世', category: 'story', description: '穿书入境：导入古风卡、入幕演绎、传书短笺。与 modern 短信分开，模拟旧世小手机。', status: 'ready' },
  { id: 'worldforge', name: '世界搭建', category: 'create', description: '导入 JSON/txt/doc 大世界卡或文档，AI 整理后拆成世界书 + 多位角色。', status: 'ready' },
]

export const CATEGORY_LABEL: Record<MarketListing['category'], string> = {
  life: '生活',
  create: '创作',
  social: '社交',
  fun: '娱乐',
  explore: '探索',
  story: '叙事',
}
