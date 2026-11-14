// ================== 全局类型定义 ==================

/** 好感度等级 */
export type FavorLevel = '路人' | '关注' | '暧昧' | '沉迷' | '疯狂';

/** 非人类主播物种大类（筛选用） */
export type SpeciesCategory = '神明' | '恶魔' | '天使' | '魅魔';

/** 玩家自定义主播的预设口播/活动等 */
export interface CustomAnchorPresets {
  /** 进房欢迎语 */
  welcomeLines: string[];
  /** 口头禅 / 常用口播 */
  catchphrases: string[];
  /** 求赏话术 */
  tipLines: string[];
  /** 直播偏好活动（用于随机「正在做什么」） */
  activityLabels: string[];
  /** 自定义开播时段（小时 0–23）；不设则用默认档期 */
  liveStartHour?: number;
  liveEndHour?: number;
  /** 始终视为在播 */
  alwaysLive?: boolean;
}

/** 主播预设静态数据 */
export interface AnchorProfile {
  id: string;
  realName: string; // 真名
  stageName: string; // 艺名
  age: number;
  /** 外表年龄/存在年限完整描述（非人类常用，如「外表26岁/实际不详」） */
  ageLabel?: string;
  personality: string; // 性格
  speakingStyle: string; // 说话风格
  greenTeaStyle: string; // 绿茶方式
  background: string; // 人设背景
  tag: string; // 标签
  gradient: string; // 头像渐变色 (tailwind class)
  avatarLetter: string; // 头像显示字符
  /** 立绘/头像图片（无则使用渐变占位） */
  portraitUrl?: string;
  /** 发色，用于 AI 自我认知 */
  hairColor?: string;
  /** 直播间求打赏方式 */
  tipStyle?: string;
  /** 私信聊天方式（与直播间应有明显差异） */
  chatStyle?: string;
  /** 是否人类主播（默认 true） */
  isHuman: boolean;
  /** 物种（非人类主播） */
  species?: string;
  /** 物种大类：神明/恶魔/天使/魅魔 */
  speciesCategory?: SpeciesCategory;
  /** 外貌描述（AI prompt 形象一致性） */
  appearance?: string;
  /** 是否玩家自建主播 */
  isCustom?: boolean;
  /** 自定义主播预设内容 */
  presets?: CustomAnchorPresets;
}

/** 竞争对手（AI模拟的其他打赏观众） */
export interface RivalFan {
  name: string;
  score: number;
}

/** 主播当前正在做的事情（营造主播有自己生活的感觉） */
export interface AnchorActivityState {
  icon: string;
  label: string;
  changedAt: number;
}

/** 主播运行时状态（会持久化） */
export interface AnchorRuntimeState {
  id: string;
  favor: number; // 好感度 0-100
  totalSpent: number; // 玩家在该主播身上的累计消费（好感、钱包统计）
  /** 当前直播场次标识（游戏日 + 档口） */
  liveSessionKey: string;
  /** 本场直播玩家贡献（贡献榜用，退出再进同一场不重置） */
  liveSessionPlayerSpent: number;
  /** 本场直播 AI 竞争对手贡献 */
  liveSessionRivals: RivalFan[];
  isOnline: boolean;
  currentViewers: number; // 当前在线观众数（装饰用）
  lastInteractAt: number; // 玩家最后一次互动时间戳
  jealousNotifiedAt: number; // 上次因吃醋发私信的时间
  missNotifiedAt: number; // 上次因太久不来发私信的时间
  flirtNotifiedAt: number; // 上次主动撒娇/调情私信的时间
  pkHelpNotifiedAt: number; // 上次因PK向观众求助的时间
  /** 游戏日主动私信计数（每日最多 2~3 次） */
  proactiveDmGameDay: number;
  proactiveDmCount: number;
  lastProactiveDmGameSec: number;
  /** 未回复 follow-up 已处理的消息 id */
  unansweredFollowUpMsgId: string;
  rivals: RivalFan[]; // 历史兼容；贡献榜优先用 liveSessionRivals
  activity: AnchorActivityState; // 主播当前正在做的事
}

/** 礼物配置 */
export interface Gift {
  id: string;
  name: string;
  price: number;
  icon: string;
  isBig: boolean; // 是否触发全屏特效（>=1000）
  meaning?: string;
}

/** 弹幕消息 */
export interface DanmuItem {
  id: string;
  type: 'system' | 'player' | 'anchor' | 'gift' | 'audience';
  content: string;
  sender?: string;
  color?: string;
  giftName?: string;
  giftCount?: number;
  /** 礼物来源：直播虚拟打赏 vs 淘淘购/美团实体礼 */
  giftKind?: 'virtual' | 'physical';
}

/** 私信消息类型 */
export type ChatMessageKind = 'text' | 'redpacket' | 'voice' | 'image';

/** 聊天消息 */
export interface ChatMessage {
  id: string;
  anchorId: string;
  role: 'anchor' | 'player';
  content: string;
  timestamp: number;
  kind?: ChatMessageKind;
  /** 红包金额（虚拟币） */
  redPacketAmount?: number;
  /** 语音条对应文字 */
  voiceText?: string;
  /** 图片描述 */
  imageDesc?: string;
}

/** 聊天会话摘要 */
export interface ChatSession {
  anchorId: string;
  lastMessage: string;
  lastTimestamp: number;
  unread: boolean;
}

/** PK状态 */
export interface PKState {
  active: boolean;
  mode?: 'duo' | 'squad';
  participants?: string[];
  scores?: Record<string, number>;
  anchorA: string | null;
  anchorB: string | null;
  scoreA: number;
  scoreB: number;
  endTime: number; // 时间戳
  result: 'A' | 'B' | null;
  winnerId?: string | null;
  danmu: DanmuItem[];
  focusAnchorId?: string | null;
  discussionTopic?: string;
}

/** 直播虚拟礼物消费记录（非实体礼） */
export interface SpendRecord {
  id: string;
  kind: 'virtual';
  anchorId: string;
  giftId: string;
  giftName: string;
  price: number;
  timestamp: number;
}

/** 社媒帖子类型 */
export type SocialPostType = 'daily' | 'live_notice' | 'leave_notice' | 'live_recap';

export interface SocialComment {
  id: string;
  author: string;
  content: string;
  timestamp: number;
}

export interface SocialPost {
  id: string;
  anchorId: string;
  type: SocialPostType;
  content: string;
  timestamp: number;
  likes: number;
  comments: SocialComment[];
  /** 与某场直播挂钩的摘要 */
  liveHighlights?: string[];
}

/** 购物/外卖商品 */
export interface CommerceProduct {
  id: string;
  name: string;
  price: number;
  icon: string;
  desc: string;
  category: string;
}

export interface CommerceOrder {
  id: string;
  anchorId: string;
  productId: string;
  productName: string;
  price: number;
  type: 'shop' | 'delivery';
  timestamp: number;
}

/** 直播间礼物展示条（抖音式左上） */
export interface GiftFeedItem {
  id: string;
  sender: string;
  giftIcon: string;
  giftName: string;
  count: number;
  isPlayer: boolean;
  /** PK 场景：礼物送给哪一侧主播（二人） */
  side?: 'A' | 'B';
  /** 四人 PK：目标主播 id */
  targetAnchorId?: string;
  targetName?: string;
}

/** 壁纸预设 */
export type WallpaperId =
  | 'dawn'
  | 'night'
  | 'mint'
  | 'sunset'
  | 'rose'
  | 'photo1'
  | 'photo2'
  | 'photo3'
  | 'photo4'
  | 'photo5'
  | 'photo6'
  | 'photo7'
  | 'photo8'
  | 'custom';

/** 本地导入的资源（图片/字体等，新档不重置） */
export interface ImportedAsset {
  id: string;
  name: string;
  dataUrl: string;
  createdAt: number;
}

/** 主界面文字颜色预设 */
export type HomeTextColorId =
  | 'auto'
  | 'white'
  | 'black'
  | 'cream'
  | 'sky'
  | 'pink'
  | 'rose'
  | 'violet'
  | 'custom';

/** 字体预设 */
export type FontPresetId = 'default' | 'heiti' | 'serif' | 'round' | 'mono' | 'custom';

/** 图标风格 */
export type IconStyleId = 'classic' | 'cute' | 'minimal' | 'luxury' | 'custom';

/** AI 互动模式：主动式后台推演 / 被动式仅响应玩家操作 */
export type AiInteractionMode = 'active' | 'passive';

/** 玩家人设（影响 AI 对玩家的称呼与互动） */
export interface PlayerPersona {
  title: string;
  bio: string;
  style: string;
}

/** 朋友圈评论 */
export interface MomentComment {
  id: string;
  authorType: 'anchor' | 'player';
  authorId: string;
  authorName: string;
  content: string;
  timestamp: number;
}

/** 朋友圈动态 */
export interface MomentPost {
  id: string;
  authorType: 'anchor' | 'player';
  authorId: string;
  content: string;
  timestamp: number;
  likedBy: string[];
  comments: MomentComment[];
}
