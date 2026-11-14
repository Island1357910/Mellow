/** 四人 PK 共同讨论话题（友好、轻松，禁止骂架向） */
const SQUAD_TOPICS = [
  '今晚谁的造型最好看，互相夸夸',
  '用一句家乡话给姐姐们问好',
  '分享最近一件超开心的小事',
  '如果突然放假一天最想做什么',
  '推荐一道自己会做的拿手菜',
  '最近在听什么歌，互相安利',
  '聊聊自己直播间的小习惯',
  '用三个词形容今天的心情',
  '说说自己最怕的可爱小事',
  '假如一起出门玩，想去哪里',
  '互相给对方一个温柔的外号',
  '聊聊第一次开播时的紧张感',
  '分享一个想对粉丝说的感谢',
  '今晚的主题：温柔接话接龙',
  '比一比谁更会夸姐姐（友善版）',
  '聊聊最近学到的一个新技能',
  '如果可以互换一天身份，想体验谁',
  '一起想想下次联动可以玩什么',
];

export function pickSquadDiscussionTopic(exclude?: string): string {
  const pool = exclude ? SQUAD_TOPICS.filter((t) => t !== exclude) : SQUAD_TOPICS;
  if (pool.length === 0) return SQUAD_TOPICS[0];
  return pool[Math.floor(Math.random() * pool.length)];
}

export function buildSquadDiscussionPrompt(topic: string, speakerName: string, peers: string[]): string {
  return (
    `（系统：四人友好PK连麦中。当前共同话题：「${topic}」。` +
    `你是${speakerName}，同伴有：${peers.join('、')}。` +
    `请围绕该话题自然接话或补充，像真人直播间轮流聊天。` +
    `【硬性禁止】骂人、对骂、撕逼、人身攻击、阴阳怪气羞辱同伴或粉丝。` +
    `要友善、轻松、可带点可爱竞争（比谁更会夸人），不要攻击性。` +
    `不要一口气把话全说完、不要点名攻击，不超过40字。）`
  );
}
