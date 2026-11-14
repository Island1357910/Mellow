import { FAKE_NICKNAMES, randomFrom } from './fakeDanmu';

/** PK 围观弹幕池（比普通直播间更激动、更站队） */
export const PK_AUDIENCE_DANMU = [
  '左边冲啊别怂！',
  '右边这波稳了稳了',
  '我押左边赢一百块',
  '右边颜值碾压怎么输',
  '两边都帅我选不出来',
  '刷起来刷起来！',
  '这比分也太刺激了吧',
  '左边加油左边加油',
  '右边别给对面机会',
  'PK就要这种火药味',
  '我站左边一辈子',
  '右边粉丝团集合',
  '这局谁输谁尴尬',
  '礼物刷起来别手软',
  '左边这波喊话绝了',
  '右边反击太狠了哈哈哈',
  '围观群众已就位',
  '两边粉丝打起来了',
  '这PK我能看一晚上',
  '左边差一点点就反超',
  '右边稳住别浪',
  '姐姐快出手救救左边',
  '这比分看得我心跳加速',
  '押右边的朋友举个手',
  '左边今天状态拉满',
];

export const PK_ANCHOR_SPEECH_REACTION = [
  '左边这波喊话绝了',
  '右边反击太狠了哈哈哈',
  '这语气我站左边',
  '右边粉丝快来救场',
  '嗑到了嗑到了',
  '这谁顶得住啊',
  '左边求生欲拉满',
  '右边太会撩了',
];

export const PK_GIFT_REACTION = [
  '姐姐出手了！',
  '这礼物太狠了',
  '右边要翻盘了',
  '左边稳了稳了',
  '刷起来刷起来！',
  '姐姐威武',
];

export const PK_SCORE_GAP_REACTION = [
  '这比分也太刺激了吧',
  '左边差一点点就反超',
  '右边稳住别浪',
  '差距拉开了',
  '还能翻还能翻',
  '这局谁输谁尴尬',
];

export function pickPkAudienceDanmu(ctx?: {
  eventType?: 'anchor_speech' | 'player_gift' | 'score_gap';
  speakerSide?: 'A' | 'B';
}): { sender: string; content: string } {
  let pool = PK_AUDIENCE_DANMU;
  if (ctx?.eventType === 'anchor_speech') {
    pool = PK_ANCHOR_SPEECH_REACTION;
    if (ctx.speakerSide === 'A') {
      return { sender: randomFrom(FAKE_NICKNAMES), content: randomFrom(['左边说得太对了', '左边加油', ...PK_ANCHOR_SPEECH_REACTION]) };
    }
    if (ctx.speakerSide === 'B') {
      return { sender: randomFrom(FAKE_NICKNAMES), content: randomFrom(['右边反击漂亮', '右边冲啊', ...PK_ANCHOR_SPEECH_REACTION]) };
    }
  }
  if (ctx?.eventType === 'player_gift') pool = PK_GIFT_REACTION;
  if (ctx?.eventType === 'score_gap') pool = PK_SCORE_GAP_REACTION;

  return {
    sender: randomFrom(FAKE_NICKNAMES),
    content: randomFrom(pool),
  };
}
