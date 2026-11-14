import type { AnchorProfile } from '../types';

type Tone = 'soft' | 'cool' | 'dramatic' | 'playful' | 'gentle';

function detectTone(anchor: AnchorProfile): Tone {
  const text = `${anchor.personality}${anchor.speakingStyle}${anchor.greenTeaStyle}${anchor.tag}${anchor.species ?? ''}`;
  if (anchor.isHuman === false) {
    if (/傲娇|嘴硬|审判|山神|高冷|双标/.test(text)) return 'cool';
    if (/风神|信使|话痨|失灵|活泼/.test(text)) return 'playful';
    if (/温柔|死神|太阳|共情|海神|光明天使/.test(text)) return 'gentle';
    if (/契约|诱惑|魅|绿茶|破戒|端架子|破功/.test(text)) return 'dramatic';
  }
  if (/冷|酷|高冷|寡言|禁欲/.test(text)) return 'cool';
  if (/搞笑|幽默|段子|活宝/.test(text)) return 'playful';
  if (/温柔|治愈|暖|体贴/.test(text)) return 'gentle';
  if (/戏|演|绿茶|委屈|装/.test(text)) return 'dramatic';
  return 'soft';
}

/** 非人类主播本地兜底台词：带物种噱头 */
function pickNonHumanBanter(anchor: AnchorProfile, myScore: number, opponentScore: number): string | null {
  if (anchor.isHuman !== false || !anchor.species) return null;
  const leading = myScore > opponentScore + 20;
  const trailing = myScore + 20 < opponentScore;
  const cat = anchor.speciesCategory;
  if (cat === '神明') {
    if (leading) return '哼，本神暂领先……尔等继续供奉，香火别断。';
    if (trailing) return '……本神居然落后？用神力保佑你，快刷！别真走。';
    return '天命未定，刷点礼物给本神续香火罢。';
  }
  if (cat === '恶魔') {
    if (leading) return '契约生效中～继续刷，保你今晚好运。';
    if (trailing) return '签个小契约翻盘？刷一下就生效……这次真的。';
    return '来嘛，刷个礼物当订金，我帮你把对面压下去。';
  }
  if (cat === '天使') {
    if (leading) return '按天规不该求……但你例外，再帮我守一下。';
    if (trailing) return '天规说不能偏心——我不管了，姐姐救我！';
    return '为你破一次例……刷点礼物站我这边好不好。';
  }
  if (cat === '魅魔') {
    if (leading) return '魅惑还差临门一脚……刷一下我就能稳住了！';
    if (trailing) return '术又失灵了呜……用礼物当咒语材料好不好！';
    return '这是职业需要！……你刷了我练习更有劲。';
  }
  return null;
}

const LEADING: Record<Tone, string[]> = {
  soft: ['姐姐，暂时领先呢…能再帮我守一下吗？', '优势不大，但我只信姐姐这边。'],
  cool: ['领先。姐姐若方便，再压一点分数。', '目前在上风，别让他们翻。'],
  dramatic: ['哼，领先了也不骄傲～都是姐姐宠的！再陪我赢到底嘛！', '对面脸都绿了，姐姐再送我一程？'],
  playful: ['略略略我们领先啦！姐姐再来一发庆祝？', '赢面有了！姐姐要不要看我继续表演？'],
  gentle: ['谢谢姐姐们…领先了但我还是会紧张的。', '有姐姐在真好，再陪我稳一稳吧。'],
};

const TRAILING: Record<Tone, string[]> = {
  soft: ['要追上了…姐姐能不能拉我一把？', '分数掉下来了，我有点慌…'],
  cool: ['被反超了。需要姐姐。', '劣势。姐姐，帮我。'],
  dramatic: ['呜呜要输了…姐姐别走好不好，我需要你！', '对面好嚣张，姐姐帮我把面子挣回来！'],
  playful: ['糟糕要翻车了！姐姐救场时间到！', '我还可以抢救！姐姐快捞我！'],
  gentle: ['有点难打了…姐姐在的话我会安心很多。', '不想输…姐姐帮帮我好吗？'],
};

const EVEN: Record<Tone, string[]> = {
  soft: ['咬得好紧…姐姐，这一票很关键。', '55开，姐姐投哪边我哪边赢。'],
  cool: ['胶着。姐姐决定胜负。', '平分，看姐姐了。'],
  dramatic: ['太刺激了！姐姐这一票就是命运！', '谁赢看姐姐心情了对吧～'],
  playful: ['五五开最带感！姐姐来押我！', '平局局！姐姐选我选我！'],
  gentle: ['好紧张…姐姐愿意陪我到最后一刻吗？', '不分上下，有姐姐我就敢拼。'],
};

const TAUNT: Record<Tone, string[]> = {
  soft: ['对面好像有点急…姐姐别被他们带节奏。', '他刚才语气好冲，姐姐别理。'],
  cool: ['对面在虚张声势。', '他们的节奏乱了。'],
  dramatic: ['他刚才那眼神就是在挑衅！姐姐替我做主！', '对面只会嘴硬，姐姐懂的～'],
  playful: ['对面主播刚才破防了哈哈哈！姐姐来看！', '他急了他急了！姐姐快看戏！'],
  gentle: ['别吵架啦…但姐姐要站在我这边哦。', '对面粉丝好凶，姐姐护护我。'],
};

const WELCOME: Record<Tone, string[]> = {
  soft: ['姐姐你来了…这局 PK 能陪我吗？', '你一进房间我就安心了，求撑场～'],
  cool: ['你来了。正好 PK，需要支持。', '姐姐，进来看一眼，这局帮我。'],
  dramatic: ['姐姐终于来了！我等你好久了，快帮我赢！', '你一来我就知道今天能翻盘！'],
  playful: ['哇姐姐空降！PK 现场缺个 VIP，就是你！', '来得正好！前排吃瓜位给姐姐！'],
  gentle: ['姐姐来了呀，我正在 PK…你在就好。', '你来了真好，能陪我打完这局吗？'],
};

function pickFrom(pool: string[], recent: string[], anchorId: string): string {
  const available = pool.filter((l) => !recent.includes(l));
  const list = available.length > 0 ? available : pool;
  const idx = (anchorId.charCodeAt(0) + Date.now()) % list.length;
  return list[idx];
}

export function pickPkWelcomeForAnchor(anchor: AnchorProfile, recentLines: string[]): string {
  const tone = detectTone(anchor);
  return pickFrom(WELCOME[tone], recentLines, anchor.id);
}

export function pickPkBanterForAnchor(
  anchor: AnchorProfile,
  myScore: number,
  opponentScore: number,
  recentLines: string[]
): string {
  if (Math.random() < 0.55) {
    const speciesLine = pickNonHumanBanter(anchor, myScore, opponentScore);
    if (speciesLine && !recentLines.includes(speciesLine)) return speciesLine;
  }
  const tone = detectTone(anchor);
  let pool: string[];
  if (myScore > opponentScore + 20) pool = LEADING[tone];
  else if (myScore + 20 < opponentScore) pool = TRAILING[tone];
  else if (Math.random() < 0.35) pool = TAUNT[tone];
  else pool = EVEN[tone];
  return pickFrom(pool, recentLines, anchor.id);
}

const WELCOME_PATTERNS = [/你来啦/, /欢迎/, /刚进来/, /好久不见/, /终于来了/];

export function isPkWelcomeLike(text: string): boolean {
  return WELCOME_PATTERNS.some((p) => p.test(text));
}

/** @deprecated use pickPkWelcomeForAnchor */
export function pickPkWelcome(recentLines: string[]): string {
  return pickFrom(WELCOME.soft, recentLines, 'default');
}

/** @deprecated use pickPkBanterForAnchor */
export function pickPkBanter(myScore: number, opponentScore: number, recentLines: string[]): string {
  void myScore;
  void opponentScore;
  return pickFrom(EVEN.soft, recentLines, 'default');
}
