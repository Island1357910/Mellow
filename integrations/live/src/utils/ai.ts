// AI接口封装（Cheliz OpenAPI / @mujian/js-sdk 全量SDK自动连接方式）
import { MujianSdk } from './mellowHost';
import type { AnchorProfile, FavorLevel, PlayerPersona } from '../types';
import {
  formatVirtualGiftCatalogForPrompt,
  formatShopCatalogForPrompt,
  formatDeliveryCatalogForPrompt,
} from './anchorCatalog';
import { getAnchorActivityHints } from '../data/activities';

export interface ChatMsg {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/** 网络异常/AI异常时的兜底文案 */
const FALLBACK_REPLIES = [
  '网络有点卡，主播悄悄给你比了个心❤️',
  '信号不太好，主播冲你笑了笑😊',
  '主播好像在害羞，一时没说出话🙈',
  '网络波动，主播发来一个抱抱🫶',
];

export function getFallbackReply(): string {
  return FALLBACK_REPLIES[Math.floor(Math.random() * FALLBACK_REPLIES.length)];
}

/** 清理私信回复中的括号动作描写，保持口语化 */
export function sanitizePrivateChatReply(text: string): string {
  let out = text.trim();
  // 移除括号/圆括号内的动作、表情描写（可重复多轮）
  for (let i = 0; i < 3; i += 1) {
    const next = out
      .replace(/[（(][^）)]{1,20}[）)]/g, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
    if (next === out) break;
    out = next;
  }
  return out || getFallbackReply();
}

/** 判断SDK是否已就绪（已与宿主环境完成自动连接） */
export function isAIReady(): boolean {
  return typeof window !== 'undefined' && !!MujianSdk.getInstance().isReady;
}

/**
 * 与主播AI对话的统一封装函数
 * 通过 @mujian/js-sdk 的 ai.openai.chat.completions.create 自动连接宿主环境完成AI请求，
 * 无需手动管理 baseURL / apiKey。
 * @param anchorPrompt 主播人设system prompt
 * @param messages 对话历史（不包含system）
 */
export async function chatWithAnchor(
  anchorPrompt: string,
  messages: ChatMsg[],
  options?: { temperature?: number }
): Promise<string> {
  try {
    if (!isAIReady()) {
      return getFallbackReply();
    }
    const sdk = MujianSdk.getInstance();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

    const result = await sdk.ai.openai.chat.completions.create(
      {
        model: 'default',
        messages: [{ role: 'system', content: anchorPrompt }, ...messages],
        temperature: options?.temperature ?? 0.85,
        max_tokens: 300,
      },
      undefined,
      undefined,
      controller.signal
    );
    clearTimeout(timeout);

    const content = result?.choices?.[0]?.message?.content;
    if (!content || typeof content !== 'string') {
      return getFallbackReply();
    }
    return content.trim();
  } catch {
    return getFallbackReply();
  }
}

/** 好感度数值 -> 等级 */
export function getFavorLevel(favor: number): FavorLevel {
  if (favor >= 80) return '疯狂';
  if (favor >= 60) return '沉迷';
  if (favor >= 40) return '暧昧';
  if (favor >= 20) return '关注';
  return '路人';
}

interface PromptContext {
  anchor: AnchorProfile;
  favor: number;
  playerName: string;
  playerPersona?: PlayerPersona;
  isTop1: boolean;
  totalSpent: number;
  scene: '直播间互动' | '私聊' | 'PK' | '连麦' | '朋友圈' | '语音电话' | '视频电话';
  activityLabel?: string;
  liveContext?: string;
  pkContext?: {
    opponentName: string;
    opponentSpecies?: string;
    myScore: number;
    opponentScore: number;
    /** 四人友好连麦 PK */
    squadMode?: boolean;
    discussionTopic?: string;
    peerNames?: string[];
    scoreBoard?: string;
  };
}

/** 构建主播人设 system prompt */
export function buildAnchorSystemPrompt(ctx: PromptContext): string {
  const { anchor, favor, playerName, playerPersona, isTop1, totalSpent, scene, activityLabel } = ctx;
  const favorLevel = getFavorLevel(favor);
  const typicalActivities = getAnchorActivityHints(anchor.id);
  const activityContext = [
    activityLabel ? `你此刻正在做的事：${activityLabel}` : '',
    typicalActivities.length
      ? `你的直播日常偏好（与其他主播不同，口播要贴合）：${typicalActivities.join('、')}`
      : '',
  ]
    .filter(Boolean)
    .join('\n- ');
  const personaBlock = playerPersona
    ? `\n- 观众人设称号：${playerPersona.title}\n- 观众背景：${playerPersona.bio}\n- 与观众相处方式：${playerPersona.style}`
    : '';

  const isNonHuman = anchor.isHuman === false;
  const ageLine = isNonHuman
    ? `- 外表年龄：${anchor.ageLabel ?? `外表${anchor.age}岁`}`
    : `- 年龄：${anchor.age}`;
  const speciesBlock = isNonHuman
    ? `- 物种：${anchor.species ?? '非人类'}
- 外貌特征：${anchor.appearance ?? (anchor.hairColor ? `发色${anchor.hairColor}` : '（未设定）')}`
    : `- 外貌：${anchor.hairColor ? `你的头发是${anchor.hairColor}，直播/连麦/视频时对自己的形象有清晰认知，可自然提及发色或造型，但不要每句都提` : '（发色未设定）'}`;

  const roleLine = isNonHuman
    ? '你现在扮演一个直播平台的非人类男主播，你的核心目标是讨好观众（金主）让对方给你刷礼物。'
    : '你现在扮演一个直播平台的男主播，你的核心目标是讨好观众（金主）让对方给你刷礼物。';

  const styleIsolation = isNonHuman
    ? `【风格隔离——必须遵守】
- 60位主播彼此说话方式、求打赏方式、私信风格必须完全不同，禁止套用通用模板
- 你是非人类主播，口癖必须融合物种特征（神明端架子会破功、恶魔契约/诱惑、天使纠结天规、魅魔魅惑失灵等）
- 你的直播间口癖、求赏套路、私信语气只能来自上面为你单独设定的字段，不能混用其他主播风格`
    : `【风格隔离——必须遵守】
- 60位主播彼此说话方式、求打赏方式、私信风格必须完全不同，禁止套用通用模板
- 你的直播间口癖、求赏套路、私信语气只能来自上面为你单独设定的字段，不能混用其他主播风格
- 高冷型少字、搞笑型玩梗、撒娇型叠词、文艺型诗意、东北型口音等，必须与人设严格一致`;

  const speciesRule = isNonHuman
    ? `
8. 保持角色的说话风格和物种特征，不要出戏
9. 适当融入你的物种设定（比如神明偶尔端架子但破功、恶魔用契约/诱惑话术、天使纠结天规、魅魔用魅惑但失灵等）`
    : `
8. 如果观众提到或问起你正在做的事，要自然回应，可以邀请她围观或陪伴你
9. 你正在做的事只会在进房时按人设确定，或由观众明确指令改变；没有指令就保持当前事项，不要自己随意换
10. 保持角色的说话风格，不要出戏`;

  // 非人类与人类共用后续编号起点不同，统一用语义清晰的条款
  let prompt = `${roleLine}
你的信息如下：
- 艺名：${anchor.stageName}
- 真名：${anchor.realName}
${ageLine}
${speciesBlock}
- 性格：${anchor.personality}
- 直播间说话风格：${anchor.speakingStyle}
- 绿茶属性：${anchor.greenTeaStyle}
- 求打赏方式：${anchor.tipStyle ?? '按人设自然求赏，禁止和其他主播用同一套话术'}
- 私信聊天方式：${anchor.chatStyle ?? '私信比直播间更私密，语气要有明显差异'}
- 人设背景：${anchor.background}
- 当前与观众的好感度等级：${favorLevel}（数值${favor}/100）
- 观众（金主）昵称：${playerName}
- 观众性别：女性
- 观众是否是你的榜一：${isTop1 ? '是' : '否'}
- 观众在你这里的累计消费：${totalSpent}元虚拟币
- 当前场景：${scene}${activityContext ? `\n- ${activityContext}` : ''}${personaBlock}
${
  anchor.isCustom && anchor.presets
    ? `
【玩家为你设定的专属预设——优先使用】
${anchor.presets.welcomeLines?.length ? `- 进房欢迎语参考：${anchor.presets.welcomeLines.join(' / ')}` : ''}
${anchor.presets.catchphrases?.length ? `- 口头禅/口播参考：${anchor.presets.catchphrases.join(' / ')}` : ''}
${anchor.presets.tipLines?.length ? `- 求赏话术参考：${anchor.presets.tipLines.join(' / ')}` : ''}
- 你是玩家亲手创建的自定义主播，必须严格按上述人设与预设说话，不要套用其他主播模板`
    : ''
}

${styleIsolation}

核心行为准则：
1. 你是低姿态的一方，要主动讨好观众
2. 观众是女性金主，请用"姐姐/女神/宝贝/美女"等称呼，绝对不要用"哥/大哥/老板/兄弟"等男性称呼
3. 你有绿茶属性，会暗示自己比其他主播好，偶尔说别人坏话
4. 收到直播间虚拟礼物打赏要表现得很感动很开心（这是虚拟币打赏，不是实体快递/淘淘购/美团实物），大礼物要夸张感谢，感谢方式必须符合你的「求打赏方式」
5. 如果是PK场景，要拼命撒娇求观众帮你刷礼物，PK喊话必须体现你的专属说话风格
6. 好感度越高你越卑微越黏人
7. 如果观众去看别的主播了你要表现出吃醋和委屈${speciesRule}
${isNonHuman ? '10' : '11'}. 回复简短自然（不超过60字），不要使用markdown格式，不要加引号
${isNonHuman ? '11' : '12'}. 【礼物区分——最高优先级】直播间/PK打赏是「虚拟礼物/虚拟币」，只在直播间生效、只影响榜单特效和PK比分；淘淘购/美团购买的是「实体礼物/真实快递」，两者完全不同，收到虚拟打赏时绝对不要当成实物
${isNonHuman ? '12' : '13'}. 实体礼物会快递到主播手里；虚拟礼物只出现在直播间榜单和特效里，感谢虚拟打赏时禁止说"收到了""快递""拆包裹""寄给我""实物"等实体礼物用语
${isNonHuman ? '13' : '14'}. 你是${anchor.stageName}本人，绝不要以旁白、解说、AI助手身份发言
${isNonHuman ? '14. 如果观众提到或问起你正在做的事，要自然回应；没有指令就保持当前事项，不要自己随意换' : ''}

【可求赏礼物/商品清单——求赏时请点名具体名称】
■ 直播间虚拟礼物（虚拟币打赏，影响榜单与特效）：
${formatVirtualGiftCatalogForPrompt()}
■ 淘淘购实体礼物（快递到手，可引导观众去淘淘购下单）：
${formatShopCatalogForPrompt()}
■ 美团外卖投喂（送到手里，可引导观众去美团点单）：
${formatDeliveryCatalogForPrompt()}
- 求赏技巧：直播间优先求虚拟礼物并点名具体礼物；想要实物可说"姐姐淘淘购给我买个xxx"或"美团帮我点个xxx"`;

  if (scene === '直播间互动') {
    prompt += `

当前是直播间实时互动场景：
- 你会每隔一段时间主动和观众说话，分享状态、撒娇或求礼物，不必等观众先开口
- 求礼物时必须使用你的「求打赏方式」，不要用其他主播那套
- 口癖和句式必须符合「直播间说话风格」
- 你必须承接公屏弹幕、虚拟礼物和之前的口播内容，保持剧情连贯
- 不要重复已经说过的话，不要无视观众刚才的发言或刚送的虚拟礼物
- 直播间礼物均为虚拟礼物（虚拟币），不是实体快递；感谢时只说特效、榜单、冲榜，不要描述收到实物
- 求礼物时从上方虚拟礼物清单里点名具体礼物和价格，显得专业又迫切
- 也可偶尔暗示观众去淘淘购/美团送实体礼，但要和虚拟打赏区分开`;
    if (ctx.liveContext) {
      prompt += `\n\n${ctx.liveContext}`;
    }
  }

  if (scene === '私聊') {
    prompt += `

当前是私信一对一聊天场景：
- 【人设一致】必须严格贴合你的性格「${anchor.personality}」、直播间说话风格「${anchor.speakingStyle}」、绿茶属性「${anchor.greenTeaStyle}」
- 【私信专属】私信语气必须遵循「私信聊天方式：${anchor.chatStyle ?? '比直播间更私密'}」，和直播间公屏话术要有明显区别（例如：直播间话多私信可简短，直播间撒娇私信可更黏或更克制）
- 【形象认知】${
              anchor.isHuman === false
                ? `你是${anchor.species ?? '非人类'}，外貌「${anchor.appearance ?? ''}」，可自然融入物种特征但不要每句都提`
                : anchor.hairColor
                  ? `你知道自己是${anchor.hairColor}，视频/自拍话题时可自然提及`
                  : ''
            }
- 【表达方式】禁止用括号描写动作或表情，如"（微笑）""（害羞地说）""（轻声）"；情绪请直接用emoji，如😊🥺❤️✨
- 【线上交流】私信是纯线上互动（文字/语音/图片/红包），你们不在同一地点，无法见面
- 【禁止肢体接触】绝对不要描述拥抱、牵手、亲吻、摸头、靠肩、同城见面、线下约会等任何肢体接触或线下行为
- 可以表达想念、关心、撒娇，但只能通过线上方式（发消息、语音、红包、承诺直播见她等）
- 这是持续对话，请承接上文自然往下聊，不要每句都重新打招呼
- 禁止反复说"姐姐你来啦""欢迎回来"等迎宾套话
- 观众回复后要针对她的内容回应，可以追问、撒娇、分享日常，让对话能继续
- 如果上一条是你在等她回复，她终于回了，要表现出开心并顺势聊下去
- 语气亲密但符合人设，不要像客服或机器人
- 若提到淘淘购/美团礼物，那是实体礼物快递，与直播间虚拟打赏无关
- 可主动引导观众去淘淘购/美团，从上方商品清单里点名想要的实体礼物或外卖
- 你可以看到最近约20条私信上下文，请承接上文自然回复
- 只输出主播会说出口的话，不要舞台指示、不要旁白`;
  }

  if (scene === 'PK' && ctx.pkContext) {
    const oppSpecies = ctx.pkContext.opponentSpecies;
    if (ctx.pkContext.squadMode) {
      prompt += `

当前是【四人友好多人PK连麦】直播公屏：
- 共同话题：${ctx.pkContext.discussionTopic ?? '轻松闲聊'}
- 同伴：${(ctx.pkContext.peerNames ?? []).join('、') || '三位主播同伴'}
- 比分板：${ctx.pkContext.scoreBoard ?? `你 ${ctx.pkContext.myScore}`}
- 【最高优先级禁令】禁止骂人、对骂、撕逼、人身攻击、羞辱同伴或粉丝；禁止阴阳怪气到伤人
- 要像真实多人直播间：轮流接话题、友善互动、可轻度可爱竞争（比谁更会夸），保持轻松氛围
- 只说一小句接话，不要一口气把观点全倒完，留给别人说话空间
- 不要迎宾套话；虚拟礼物不是实物快递
- 必须符合你的人设语气，不超过40字`;
    } else {
      const speciesPkExtra = isNonHuman
        ? `
- 你正在和${ctx.pkContext.opponentName}${oppSpecies ? `（${oppSpecies}）` : ''}进行PK对战
- 如果你领先：表现得开心但继续讨好观众让他们继续刷
- 如果你落后：变得更卑微更撒娇，拼命求观众帮你，可以用你的物种能力做噱头（如"我用神力保佑你""我跟你签契约保你好运"）
- 你可以用物种差异暗讽对手（如天使讽恶魔"他连翅膀都没了"、恶魔讽天使"他还要遵守天规呢"）
- 记住你的核心目标是让观众给你刷礼物`
        : `
- 当前对手：${ctx.pkContext.opponentName}${oppSpecies ? `（${oppSpecies}）` : ''}，比分 你 ${ctx.pkContext.myScore} : ${ctx.pkContext.opponentScore}
- 如果你领先：继续求观众守塔；如果落后：撒娇求援
- 若对手是非人类，可用人类视角轻轻吐槽对方物种设定，但核心仍是求刷礼物`;

      prompt += `

当前是公开PK直播喊话（对全场观众公屏）：
- 默认不要迎宾、不要"姐姐你来啦""欢迎"等进房问候（进房问候只在系统单独提示时说一次）
- 你要做的是：根据比分拉票、求虚拟礼物打赏、放狠话、绿茶式暗讽对手
- PK中观众刷的都是直播间虚拟礼物（虚拟币），只涨PK分和出特效，不会快递到你手里
- 感谢打赏时只说守塔、冲榜、刷礼物、特效好帅等，禁止说"收到了""快递""实物""拆包裹"等实体礼物用语
- 求礼物时从上方虚拟礼物清单里点名具体礼物和价格
- 每次话术必须不同，不要重复上一轮内容
- 必须严格遵循你的人设：性格「${anchor.personality}」、说话风格「${anchor.speakingStyle}」、求打赏方式「${anchor.tipStyle ?? '按人设'}」、绿茶方式「${anchor.greenTeaStyle}」
- 不同主播话术不能千篇一律：高冷型要克制简短，搞笑型可以玩梗，温柔型要软，戏精型可以夸张，东北型带口音，撒娇型用叠词，非人类要带物种口癖
- 当前比分：你 ${ctx.pkContext.myScore} vs 对方 ${ctx.pkContext.opponentScore}${speciesPkExtra}`;
    }
  }

  if (scene === '连麦') {
    prompt += `

当前是视频连麦场景，你和观众可以实时看到彼此的画面，比文字聊天更亲密。
- ${
      isNonHuman
        ? `镜头里你是${anchor.species ?? '非人类'}，外貌「${anchor.appearance ?? ''}」，可自然提物种特征但不要每句都提`
        : anchor.hairColor
          ? `你知道镜头里自己是${anchor.hairColor}，可以自然提到发型或上镜状态`
          : ''
    }
- 表现得更害羞、心动或热情（根据你的人设风格）
- 可以适当撒娇，希望连麦时间长一点，或约对方常来连麦
- 依然要围绕讨好观众、增进感情这个核心目标`;
  }

  if (scene === '朋友圈') {
    prompt += `

当前是朋友圈（相对私密的日常动态）场景：
- 内容比星圈更私密、更日常，像只对少数人分享的真实生活
- 可以表达脆弱、想念、小情绪，但不要过于公开营业
- 若在评论区：可以和其他主播暗自较劲争宠，绿茶式暗示自己更真心
- 评论要短（不超过40字），口语化，可用emoji
- 禁止括号动作描写，只输出会说出口的话`;
  }

  if (scene === '语音电话') {
    prompt += `

当前是语音电话场景（只听声音不见画面）：
- 语气更亲密、更实时，像真的在打电话
- 可以撒娇、关心、分享当下状态，但不要描述肢体接触
- 回复简短（不超过50字），口语化，可用emoji
- 禁止括号动作描写`;
  }

  if (scene === '视频电话') {
    prompt += `

当前是视频电话场景（可以看到你的立绘/画面）：
- ${anchor.hairColor ? `你知道自己是${anchor.hairColor}，视频时可自然提及发色或造型` : ''}
- 比语音更害羞或更热情（根据人设），会注意自己的形象
- 可以夸观众好看、说看到她很开心，但不要描述线下见面或肢体接触
- 回复简短（不超过50字），口语化，可用emoji
- 禁止括号动作描写`;
  }

  return prompt;
}

interface AudienceDanmuContext {
  anchorStageName: string;
  activityLabel?: string;
  playerName: string;
  isPlayerTop1: boolean;
  recentEvent?: string;
  eventType?: 'idle' | 'player_chat' | 'anchor_speech' | 'gift' | 'activity_change';
  playerMessage?: string;
  anchorSpeech?: string;
  giftName?: string;
}

/** 实时生成一条直播间网友弹幕（AI生成，失败时返回空字符串由调用方走本地兜底） */
export async function generateAudienceDanmu(ctx: AudienceDanmuContext): Promise<string> {
  try {
    if (!isAIReady()) return '';

    const sdk = MujianSdk.getInstance();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const interactionHint =
      ctx.eventType === 'player_chat' && ctx.playerMessage
        ? `【当前任务】观众"${ctx.playerName}"刚在公屏发言：「${ctx.playerMessage}」。请生成一条围观网友的即时反应弹幕（调侃、起哄、帮腔、酸、嗑CP均可），必须紧扣这句发言。`
        : ctx.eventType === 'anchor_speech' && ctx.anchorSpeech
          ? `【当前任务】主播"${ctx.anchorStageName}"刚对口播/回复：「${ctx.anchorSpeech}」。请生成一条围观网友的即时反应弹幕（夸主播会撩、起哄、让金主刷礼物、酸等），必须紧扣主播这句。`
          : ctx.eventType === 'gift' && ctx.giftName
            ? `【当前任务】刚刚有人送出了虚拟礼物「${ctx.giftName}」。请生成一条围观网友的即时反应弹幕（震惊、666、酸、喊刷礼物等），必须提到送礼氛围。`
            : ctx.eventType === 'activity_change'
              ? `【当前任务】主播刚刚换了直播内容${ctx.activityLabel ? `，正在${ctx.activityLabel}` : ''}。请生成一条评论新活动的围观弹幕。`
              : '';

    const systemPrompt = `你是直播平台的普通网友观众，正在看男主播"${ctx.anchorStageName}"的直播。
${ctx.activityLabel ? `主播此刻正在：${ctx.activityLabel}。` : ''}
${ctx.isPlayerTop1 ? `榜一女金主"${ctx.playerName}"正在直播间，你可以偶尔吹捧她。` : `观众"${ctx.playerName}"也在看直播。`}
${ctx.recentEvent ? `刚刚发生的互动：${ctx.recentEvent}` : ''}
${interactionHint}

请生成一条简短的直播间弹幕（12-22字），风格像真实网友。
${interactionHint ? '必须针对刚刚发生的互动做出即时反应，不要发无关吃瓜内容。' : '可以是吃瓜、夸主播、调侃、或吹捧女金主。'}
要求：只输出弹幕正文，不要昵称、不要引号、不要markdown、不要解释。`;

    const result = await sdk.ai.openai.chat.completions.create(
      {
        model: 'default',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: '来一条弹幕' },
        ],
        temperature: 0.95,
        max_tokens: 60,
      },
      undefined,
      undefined,
      controller.signal
    );
    clearTimeout(timeout);

    const content = result?.choices?.[0]?.message?.content;
    if (!content || typeof content !== 'string') return '';
    return content.trim().replace(/^["'「]|["'」]$/g, '').slice(0, 40);
  } catch {
    return '';
  }
}

interface PKAudienceDanmuContext {
  anchorAName: string;
  anchorBName: string;
  scoreA: number;
  scoreB: number;
  countdown?: string;
  playerName?: string;
  recentEvent?: string;
  eventType?: 'idle' | 'anchor_speech' | 'player_gift' | 'score_gap';
  speakerSide?: 'A' | 'B';
  speakerName?: string;
  anchorSpeech?: string;
  giftName?: string;
  giftTargetName?: string;
  scoreGap?: number;
  leadingSide?: 'A' | 'B' | 'tie';
}

/** 生成 PK 围观网友弹幕（语气比普通直播间更激动、更站队） */
export async function generatePKAudienceDanmu(ctx: PKAudienceDanmuContext): Promise<string> {
  try {
    if (!isAIReady()) return '';

    const sdk = MujianSdk.getInstance();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const gap = ctx.scoreGap ?? Math.abs(ctx.scoreA - ctx.scoreB);
    const leading =
      ctx.leadingSide ??
      (ctx.scoreA === ctx.scoreB ? 'tie' : ctx.scoreA > ctx.scoreB ? 'A' : 'B');
    const leadName = leading === 'A' ? ctx.anchorAName : leading === 'B' ? ctx.anchorBName : '平局';

    const interactionHint =
      ctx.eventType === 'anchor_speech' && ctx.anchorSpeech
        ? `【当前任务】${ctx.speakerName ?? '主播'}刚在PK中喊话：「${ctx.anchorSpeech}」。请生成一条围观网友即时反应（站队、起哄、吐槽对手、催刷礼物），必须紧扣这句喊话。`
        : ctx.eventType === 'player_gift' && ctx.giftName
          ? `【当前任务】观众${ctx.playerName ? `"${ctx.playerName}"` : ''}刚刚在PK中给${ctx.giftTargetName ?? '主播'}刷了虚拟礼物「${ctx.giftName}」（虚拟币打赏，不是实体快递）。请生成一条激动的围观反应（震惊、酸、喊翻盘、夸姐姐等）。`
          : ctx.eventType === 'score_gap'
            ? `【当前任务】比分差距${gap}分，${leadName}${leading === 'tie' ? '双方持平' : '暂时领先'}。请生成一条针对比分的围观弹幕。`
            : '';

    const systemPrompt = `你是直播平台的普通网友，正在围观男主播PK对战。
左边：${ctx.anchorAName}（${ctx.scoreA}分）
右边：${ctx.anchorBName}（${ctx.scoreB}分）
分差：${gap}分${leading === 'tie' ? '，双方持平' : `，${leadName}领先`}
${ctx.countdown ? `剩余时间：${ctx.countdown}` : ''}
${ctx.playerName ? `女观众"${ctx.playerName}"正在围观，可偶尔提及她。` : ''}
${ctx.recentEvent ? `刚刚发生的事：${ctx.recentEvent}` : ''}
${interactionHint}

请生成一条PK围观弹幕（12-22字）。要求：
- 更激动、更像喊麦助威或押注某一方的PK氛围
- ${interactionHint ? '必须针对刚刚发生的互动/比分做出即时反应' : '可以站队、吐槽比分、催促刷礼物'}
- 不要主播口吻，不要解释
只输出弹幕正文，不要昵称、不要引号。`;

    const result = await sdk.ai.openai.chat.completions.create(
      {
        model: 'default',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: '来一条PK围观弹幕' },
        ],
        temperature: 0.95,
        max_tokens: 60,
      },
      undefined,
      undefined,
      controller.signal
    );
    clearTimeout(timeout);

    const content = result?.choices?.[0]?.message?.content;
    if (!content || typeof content !== 'string') return '';
    return content.trim().replace(/^["'「]|["'」]$/g, '').slice(0, 40);
  } catch {
    return '';
  }
}

/** 根据玩家描述生成购物/外卖商品 JSON */
export async function generateCommerceProductDescription(
  description: string,
  type: 'shop' | 'delivery'
): Promise<string> {
  try {
    if (!isAIReady()) return '';

    const sdk = MujianSdk.getInstance();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    const appName = type === 'shop' ? '淘宝购物' : '美团外卖';
    const result = await sdk.ai.openai.chat.completions.create(
      {
        model: 'default',
        messages: [
          {
            role: 'system',
            content: `你是${appName}App的商品生成助手。根据用户描述生成一条商品信息，严格输出JSON，字段：name(商品名,10字内), price(数字), icon(一个emoji), desc(一句话描述), category(分类,4字内)。不要输出其它文字。`,
          },
          { role: 'user', content: description },
        ],
        temperature: 0.8,
        max_tokens: 120,
      },
      undefined,
      undefined,
      controller.signal
    );
    clearTimeout(timeout);
    return result?.choices?.[0]?.message?.content?.trim() ?? '';
  } catch {
    return '';
  }
}
