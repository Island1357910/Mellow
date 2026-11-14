import type { AnchorProfile } from '../types';

const IDLE_PROMPTS = [
  '（系统：直播进行中，请主动和全场观众说一句话，可以聊你正在做的事、撒撒娇或求虚拟礼物打赏，不要重复进房欢迎，不超过45字。）',
  '（系统：直播间有点安静，请随口和观众互动一下，符合人设，不要迎宾，不超过45字。）',
  '（系统：请分享一点此刻的真实状态或心情，让观众觉得你在陪她，不超过45字。）',
  '（系统：请用你的人设风格撩一下观众或暗示需要支持，不要重复上一句，不超过45字。）',
  '（系统：看到公屏弹幕，请自然接话或自言自语一句，不要迎宾，不超过45字。）',
];

const LOCAL_BY_TONE: Record<string, string[]> = {
  soft: ['姐姐还在吗…我这边有点想你了。', '今天状态还不错，有人陪我聊聊天吗？'],
  cool: ['嗯…还在播。', '随便看看，想留就留。'],
  playful: ['直播间好安静，我来搞点气氛！', '没人说话我要表演才艺了哈哈。'],
  dramatic: ['好安静哦…是不是都不理我了…', '姐姐你再不出声我要委屈了。'],
  gentle: ['慢慢看就好，我在呢。', '今天也想被温柔对待一下…'],
};

function detectTone(anchor: AnchorProfile): string {
  const text = `${anchor.personality}${anchor.speakingStyle}${anchor.tag}`;
  if (/冷|酷|高冷/.test(text)) return 'cool';
  if (/搞笑|幽默/.test(text)) return 'playful';
  if (/温柔|治愈/.test(text)) return 'gentle';
  if (/戏|绿茶|委屈/.test(text)) return 'dramatic';
  return 'soft';
}

export function pickIdleLivePrompt(): string {
  return IDLE_PROMPTS[Math.floor(Math.random() * IDLE_PROMPTS.length)];
}

export function pickLocalIdleBanter(anchor: AnchorProfile): string {
  const tone = detectTone(anchor);
  const pool = LOCAL_BY_TONE[tone] ?? LOCAL_BY_TONE.soft;
  return pool[Math.floor(Math.random() * pool.length)];
}

/** 40~60 秒基础间隔 + 随机抖动，避免过于规律 */
export function nextIdleSpeechDelayMs(): number {
  const base = 40000 + Math.random() * 20000;
  const jitter = 0.88 + Math.random() * 0.24;
  return Math.round(base * jitter);
}
