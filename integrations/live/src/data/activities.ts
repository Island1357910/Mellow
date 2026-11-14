// 主播"自己的事情"：营造主播并非一直空等观众，而是有自己生活节奏的感觉
import { getAnchorById } from './anchors';
import type { AnchorProfile } from '../types';

export interface AnchorActivity {
  icon: string;
  label: string;
}

export const ANCHOR_ACTIVITIES: AnchorActivity[] = [
  { icon: '🎮', label: '正在打游戏' },
  { icon: '🎤', label: '正在唱歌' },
  { icon: '🍜', label: '正在吃夜宵' },
  { icon: '💪', label: '正在健身' },
  { icon: '🎨', label: '正在画画' },
  { icon: '📖', label: '正在看书' },
  { icon: '🐱', label: '正在撸猫' },
  { icon: '☕', label: '正在喝咖啡' },
  { icon: '🛏️', label: '刚睡醒还有点迷糊' },
  { icon: '📸', label: '在对镜自拍' },
  { icon: '🧹', label: '在收拾房间' },
  { icon: '🎧', label: '在听歌放空' },
  { icon: '🏀', label: '在颠篮球' },
  { icon: '🍳', label: '在给自己做饭' },
  { icon: '💌', label: '在回粉丝私信' },
  { icon: '🚬', label: '在阳台发呆' },
  { icon: '🪞', label: '在臭美打扮' },
  { icon: '🎬', label: '在看一部电影' },
  { icon: '💃', label: '正在练舞' },
  { icon: '🍸', label: '在调酒' },
  { icon: '💻', label: '在写代码' },
  { icon: '🧁', label: '在做甜点' },
  { icon: '🎸', label: '在弹吉他' },
  { icon: '📷', label: '在修图选片' },
];

const ACTIVITY_BY_KEY: Record<string, AnchorActivity> = Object.fromEntries(
  ANCHOR_ACTIVITIES.map((a) => [a.label, a])
);

/** 每位主播本场直播更偏爱的活动（至少 2 项，保证人设差异） */
export const ANCHOR_LIVE_ACTIVITY_MAP: Record<string, string[]> = {
  anchor_1: ['正在喝咖啡', '在回粉丝私信', '正在看书'],
  anchor_2: ['在修图选片', '在阳台发呆', '正在喝咖啡'],
  anchor_3: ['正在打游戏', '正在吃夜宵', '在听歌放空'],
  anchor_4: ['在弹吉他', '正在唱歌', '在听歌放空'],
  anchor_5: ['正在看书', '正在喝咖啡', '在回粉丝私信'],
  anchor_6: ['正在健身', '在颠篮球', '在给自己做饭'],
  anchor_7: ['正在撸猫', '在臭美打扮', '在回粉丝私信'],
  anchor_8: ['正在喝咖啡', '在听歌放空', '在回粉丝私信'],
  anchor_9: ['正在画画', '在听歌放空', '在阳台发呆'],
  anchor_10: ['正在看书', '正在喝咖啡', '在弹吉他'],
  anchor_11: ['正在打游戏', '在颠篮球', '正在吃夜宵'],
  anchor_12: ['在弹吉他', '正在唱歌', '在阳台发呆'],
  anchor_13: ['在听歌放空', '正在吃夜宵', '在回粉丝私信'],
  anchor_14: ['正在看书', '正在喝咖啡', '在写代码'],
  anchor_15: ['在阳台发呆', '在回粉丝私信', '在听歌放空'],
  anchor_16: ['在回粉丝私信', '在听歌放空', '正在吃夜宵'],
  anchor_17: ['在臭美打扮', '在对镜自拍', '正在看书'],
  anchor_18: ['正在打游戏', '在颠篮球', '正在健身'],
  anchor_19: ['正在喝咖啡', '在看一部电影', '在听歌放空'],
  anchor_20: ['在调酒', '正在喝咖啡', '在听歌放空'],
  anchor_21: ['正在健身', '在颠篮球', '在给自己做饭'],
  anchor_22: ['在对镜自拍', '在臭美打扮', '在修图选片'],
  anchor_23: ['正在喝咖啡', '在阳台发呆', '刚睡醒还有点迷糊'],
  anchor_24: ['在修图选片', '在阳台发呆', '在听歌放空'],
  anchor_25: ['在给自己做饭', '正在健身', '在听歌放空'],
  anchor_26: ['在给自己做饭', '正在吃夜宵', '在收拾房间'],
  anchor_27: ['正在练舞', '在对镜自拍', '在听歌放空'],
  anchor_28: ['在做甜点', '在给自己做饭', '在收拾房间'],
  anchor_29: ['在臭美打扮', '在对镜自拍', '在回粉丝私信'],
  anchor_30: ['正在看书', '在回粉丝私信', '正在喝咖啡'],
  anchor_31: ['正在打游戏', '在听歌放空', '正在吃夜宵'],
  anchor_32: ['正在画画', '在听歌放空', '刚睡醒还有点迷糊'],
  anchor_33: ['在写代码', '正在喝咖啡', '在回粉丝私信'],
  anchor_34: ['正在吃夜宵', '在给自己做饭', '在听歌放空'],
  anchor_35: ['正在撸猫', '在阳台发呆', '在臭美打扮'],
  anchor_36: ['在弹吉他', '正在唱歌', '在听歌放空'],
  // 非人类主播（anchor_37 ~ anchor_60）
  anchor_37: ['在阳台发呆', '正在喝咖啡', '在回粉丝私信'], // 山神
  anchor_38: ['在听歌放空', '在阳台发呆', '正在喝咖啡'], // 海神
  anchor_39: ['正在健身', '在颠篮球', '在回粉丝私信'], // 火神
  anchor_40: ['在听歌放空', '正在打游戏', '在阳台发呆'], // 风神
  anchor_41: ['刚睡醒还有点迷糊', '在听歌放空', '在阳台发呆'], // 冥神
  anchor_42: ['正在喝咖啡', '在阳台发呆', '在回粉丝私信'], // 太阳神
  anchor_43: ['在回粉丝私信', '正在喝咖啡', '在听歌放空'], // 契约恶魔
  anchor_44: ['在阳台发呆', '在听歌放空', '在回粉丝私信'], // 堕天傲娇
  anchor_45: ['刚睡醒还有点迷糊', '在听歌放空', '在阳台发呆'], // 深渊魔君
  anchor_46: ['在臭美打扮', '在对镜自拍', '在回粉丝私信'], // 诱惑恶魔
  anchor_47: ['在回粉丝私信', '正在撸猫', '在阳台发呆'], // 厄运小恶魔
  anchor_48: ['在听歌放空', '正在喝咖啡', '在回粉丝私信'], // 死神使者
  anchor_49: ['在回粉丝私信', '正在看书', '正在喝咖啡'], // 守护天使
  anchor_50: ['在回粉丝私信', '正在吃夜宵', '在听歌放空'], // 信使天使
  anchor_51: ['在回粉丝私信', '正在看书', '在听歌放空'], // 情感天使
  anchor_52: ['正在看书', '正在喝咖啡', '在阳台发呆'], // 审判天使
  anchor_53: ['在阳台发呆', '正在看书', '在听歌放空'], // 预言天使
  anchor_54: ['在听歌放空', '刚睡醒还有点迷糊', '在回粉丝私信'], // 光明天使
  anchor_55: ['在臭美打扮', '在对镜自拍', '在回粉丝私信'], // 初阶魅魔
  anchor_56: ['刚睡醒还有点迷糊', '在听歌放空', '在看一部电影'], // 梦境魅魔
  anchor_57: ['正在喝咖啡', '在听歌放空', '在回粉丝私信'], // 高阶魅魔
  anchor_58: ['在对镜自拍', '在臭美打扮', '正在打游戏'], // 反向魅魔
  anchor_59: ['正在看书', '正在喝咖啡', '在听歌放空'], // 堕落魅魔
  anchor_60: ['在回粉丝私信', '在听歌放空', '刚睡醒还有点迷糊'], // 情感寄生魅魔
};

function findActivity(label: string): AnchorActivity | undefined {
  return ACTIVITY_BY_KEY[label];
}

function coreKeyword(label: string): string {
  return label.replace(/^(正在|在)/, '');
}

function pickFromLabels(labels: string[]): AnchorActivity {
  const pool = labels.map(findActivity).filter((a): a is AnchorActivity => !!a);
  if (pool.length === 0) return { icon: '🎧', label: '在听歌放空' };
  return pool[Math.floor(Math.random() * pool.length)];
}

/** 根据主播 id / 人设挑选活动（优先专属池，保证人设差异） */
export function pickActivityForAnchor(anchor: AnchorProfile): AnchorActivity {
  const customLabels = anchor.presets?.activityLabels;
  if (customLabels?.length) {
    const matched = customLabels.map(findActivity).filter((a): a is AnchorActivity => !!a);
    if (matched.length) return matched[Math.floor(Math.random() * matched.length)];
    const raw = customLabels[Math.floor(Math.random() * customLabels.length)];
    return { icon: '✨', label: raw };
  }

  const preset = ANCHOR_LIVE_ACTIVITY_MAP[anchor.id];
  if (preset?.length) {
    return pickFromLabels(preset);
  }

  const text = `${anchor.personality}${anchor.speakingStyle}${anchor.tag}${anchor.background}${anchor.species ?? ''}`;
  const pool: AnchorActivity[] = [];

  const add = (...labels: string[]) => {
    for (const label of labels) {
      const act = findActivity(label);
      if (act) pool.push(act);
    }
  };

  if (anchor.isHuman === false) {
    if (/冥|梦|夜|死神/.test(text)) add('刚睡醒还有点迷糊', '在听歌放空', '在阳台发呆');
    if (/火|战/.test(text)) add('正在健身', '在颠篮球');
    if (/风|信使|话痨/.test(text)) add('在听歌放空', '在回粉丝私信', '正在打游戏');
    if (/魅|诱惑|撩/.test(text)) add('在臭美打扮', '在对镜自拍', '在回粉丝私信');
    if (/天使|神明|神/.test(text)) add('正在喝咖啡', '在阳台发呆', '正在看书');
    if (/恶魔|深渊|契约/.test(text)) add('在听歌放空', '在阳台发呆', '在回粉丝私信');
  }

  if (/游戏|电竞|中二|热血|彩虹|搞笑|哈哈|段子/.test(text)) {
    add('正在打游戏', '在颠篮球');
  }
  if (/歌|音乐|文艺|忧郁|emo|情话|古风|仪式/.test(text)) {
    add('正在唱歌', '在听歌放空', '在弹吉他', '正在画画');
  }
  if (/健身|体育|蛋白|阳光|忠犬|骑士/.test(text)) {
    add('正在健身', '在颠篮球');
  }
  if (/厨|食堂|做饭|吃|烘焙|甜点/.test(text)) {
    add('在给自己做饭', '正在吃夜宵', '在做甜点');
  }
  if (/猫|奶狗|撒娇|黏人|话痨|治愈/.test(text)) {
    add('正在撸猫', '在听歌放空');
  }
  if (/高冷|神秘|欲擒|钓鱼|禁欲|寡言|阳台|佛系|摸鱼/.test(text)) {
    add('在阳台发呆', '正在喝咖啡', '在听歌放空');
  }
  if (/绿茶|温柔|暧昧|自拍|臭美|自恋|打扮/.test(text)) {
    add('在对镜自拍', '在臭美打扮', '在回粉丝私信');
  }
  if (/学霸|解题|研究生|一本正经|程序/.test(text)) {
    add('正在看书', '正在喝咖啡', '在写代码');
  }
  if (/旅|漂流|孤独|自由|摄影/.test(text)) {
    add('在阳台发呆', '在听歌放空', '在修图选片');
  }
  if (/Daddy|掌控|低音|成熟|稳重/.test(text)) {
    add('正在喝咖啡', '在听歌放空', '在回粉丝私信');
  }
  if (/舞|跳/.test(text)) {
    add('正在练舞', '在对镜自拍');
  }
  if (/调酒|洋气|chill/i.test(text)) {
    add('在调酒', '正在喝咖啡');
  }

  if (pool.length === 0) {
    add('在听歌放空', '正在喝咖啡', '在回粉丝私信');
  }

  const unique = [...new Map(pool.map((a) => [a.label, a])).values()];
  return unique[Math.floor(Math.random() * unique.length)];
}

export function pickRandomActivity(excludeLabel?: string): AnchorActivity {
  const pool = excludeLabel
    ? ANCHOR_ACTIVITIES.filter((a) => a.label !== excludeLabel)
    : ANCHOR_ACTIVITIES;
  return pool[Math.floor(Math.random() * pool.length)];
}

/** 解析玩家弹幕/指令，要求主播切换正在做的事 */
export function parseActivityInstruction(text: string): AnchorActivity | null {
  const t = text.trim();
  if (!t || t.length < 2) return null;

  const hasDirective =
    /去|别|不要|停下|停止|换|改成|改为|先来|先|让你|给我|帮忙|来(个|一首|一下)?/.test(t);
  if (!hasDirective && t.length < 4) return null;

  for (const act of ANCHOR_ACTIVITIES) {
    const core = coreKeyword(act.label);
    if (core.length >= 2 && (t.includes(core) || t.includes(act.label))) {
      if (hasDirective || t.includes(`去${core}`) || t.includes(`来${core}`)) {
        return act;
      }
    }
  }

  const shortcuts: [RegExp, string][] = [
    [/唱|k歌|嗨歌|来首/, '正在唱歌'],
    [/弹吉他|吉他/, '在弹吉他'],
    [/打游戏|玩游戏|开黑|上分/, '正在打游戏'],
    [/健身|练肌肉|举铁|锻炼/, '正在健身'],
    [/做饭|下厨|炒菜/, '在给自己做饭'],
    [/甜点|烘焙|做蛋糕/, '在做甜点'],
    [/吃(点|个)?夜宵|饿了|点外卖/, '正在吃夜宵'],
    [/撸猫|逗猫|吸猫/, '正在撸猫'],
    [/咖啡|喝咖啡/, '正在喝咖啡'],
    [/画画|作画|涂色|插画/, '正在画画'],
    [/看书|读会书|学习/, '正在看书'],
    [/自拍|拍张照|对镜/, '在对镜自拍'],
    [/收拾|打扫|整理房间/, '在收拾房间'],
    [/听歌|放歌|音乐/, '在听歌放空'],
    [/篮球|打球|运球/, '在颠篮球'],
    [/电影|看片|追剧/, '在看一部电影'],
    [/打扮|化妆|梳头|臭美/, '在臭美打扮'],
    [/发呆|放空|歇会|休息/, '在阳台发呆'],
    [/睡|困|迷糊/, '刚睡醒还有点迷糊'],
    [/回私信|看消息/, '在回粉丝私信'],
    [/练舞|跳舞|热舞/, '正在练舞'],
    [/调酒|鸡尾酒/, '在调酒'],
    [/写代码|敲代码|编程/, '在写代码'],
    [/修图|选片|摄影/, '在修图选片'],
  ];

  for (const [re, label] of shortcuts) {
    if (re.test(t) && hasDirective) {
      return findActivity(label) ?? null;
    }
  }

  return null;
}

/** 某主播更常做的活动标签（供展示/兜底） */
export function getAnchorActivityHints(anchorId: string): string[] {
  const mapped = ANCHOR_LIVE_ACTIVITY_MAP[anchorId];
  if (mapped?.length) return mapped;
  const anchor = getAnchorById(anchorId);
  return anchor?.presets?.activityLabels ?? [];
}
