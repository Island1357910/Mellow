// 模拟观众弹幕 & AI竞争对手刷礼物逻辑（本地实时随机生成，营造直播间热闹氛围）

import type { DanmuItem } from '../types';
import {
  FAKE_NICKNAMES,
  NORMAL_DANMU,
  PLAYER_PRAISE_DANMU,
  GIFT_REACTION_DANMU,
  ACTIVITY_COMMENT_TEMPLATES,
  PLAYER_CHAT_REACTION_DANMU,
  ANCHOR_SPEECH_REACTION_DANMU,
  randomFrom,
} from '../data/fakeDanmu';

let danmuIdCounter = 0;
export function genDanmuId(): string {
  danmuIdCounter += 1;
  return `dm_${Date.now()}_${danmuIdCounter}`;
}

export interface DanmuInteractionContext {
  eventType?: 'player_chat' | 'anchor_speech' | 'gift' | 'activity_change';
  playerMessage?: string;
  anchorSpeech?: string;
  giftName?: string;
  playerName?: string;
  activityLabel?: string;
}

/** 实时生成一条模拟观众弹幕（含少量对玩家的吹捧、以及对主播当前动态的评论） */
export function generateFakeDanmu(
  isPlayerTop1: boolean,
  activityLabel?: string,
  interaction?: DanmuInteractionContext
): DanmuItem {
  if (interaction?.eventType === 'player_chat') {
    return {
      id: genDanmuId(),
      type: 'audience',
      content: randomFrom(PLAYER_CHAT_REACTION_DANMU),
      sender: randomFrom(FAKE_NICKNAMES),
    };
  }
  if (interaction?.eventType === 'anchor_speech') {
    return {
      id: genDanmuId(),
      type: 'audience',
      content: randomFrom(ANCHOR_SPEECH_REACTION_DANMU),
      sender: randomFrom(FAKE_NICKNAMES),
    };
  }
  if (interaction?.eventType === 'gift' && interaction.giftName) {
    return {
      id: genDanmuId(),
      type: 'audience',
      content: `${randomFrom(GIFT_REACTION_DANMU)} ${interaction.giftName}！`,
      sender: randomFrom(FAKE_NICKNAMES),
    };
  }
  if (interaction?.eventType === 'activity_change') {
    const label = interaction.activityLabel ?? activityLabel;
    if (label) {
      return {
        id: genDanmuId(),
        type: 'audience',
        content: randomFrom(ACTIVITY_COMMENT_TEMPLATES).replace('{activity}', label),
        sender: randomFrom(FAKE_NICKNAMES),
      };
    }
  }

  // 玩家是榜一时，吹捧概率更高
  const praiseChance = isPlayerTop1 ? 0.45 : 0.2;
  const activityChance = activityLabel ? 0.18 : 0;
  const roll = Math.random();

  let content: string;
  if (roll < activityChance) {
    content = randomFrom(ACTIVITY_COMMENT_TEMPLATES).replace('{activity}', activityLabel!);
  } else if (roll < activityChance + praiseChance) {
    content = randomFrom(PLAYER_PRAISE_DANMU);
  } else {
    content = randomFrom(NORMAL_DANMU);
  }

  return {
    id: genDanmuId(),
    type: 'audience',
    content,
    sender: randomFrom(FAKE_NICKNAMES),
  };
}

/** 送礼后紧跟生成的观众围观反应弹幕 */
export function generateGiftReactionDanmu(): DanmuItem {
  return {
    id: genDanmuId(),
    type: 'audience',
    content: randomFrom(GIFT_REACTION_DANMU),
    sender: randomFrom(FAKE_NICKNAMES),
  };
}

/** 模拟竞争对手（虚拟观众）随时间小幅刷礼物，但增长有上限，且远比不上玩家 */
export function tickRivalScore(current: number): number {
  // 随机小幅增长，模拟"别人也在刷"，但增长速度较慢
  if (Math.random() < 0.35) {
    const increment = Math.floor(Math.random() * 30) + 5;
    return current + increment;
  }
  return current;
}
