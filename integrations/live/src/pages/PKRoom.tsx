import { pay } from '../utils/mellowHost';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import StatusBar from '../components/Phone/StatusBar';
import PKVersusStage from '../components/LiveList/PKVersusStage';
import DanmuList from '../components/LiveRoom/DanmuList';
import PKSpeechBubble from '../components/LiveRoom/PKSpeechBubble';
import PKGiftFeedStrip from '../components/LiveRoom/PKGiftFeedStrip';
import GiftPanel from '../components/Gift/GiftPanel';
import FullscreenGiftEffect, {
  type FullscreenGiftEffectItem,
} from '../components/Gift/FullscreenGiftEffect';
import { getAnchorById } from '../data/anchors';
import { pickRandomLivePair, tryStartPK } from '../utils/pkMatch';
import SquadPKRoom from '../components/LiveRoom/SquadPKRoom';
import { LIVE } from '../theme/liveTheme';
import { useToastStore } from '../stores/useToastStore';
import { useAnchorStore } from '../stores/useAnchorStore';
import { usePlayerStore } from '../stores/usePlayerStore';
import { useNavStore } from '../stores/useNavStore';
import { usePKStore } from '../stores/usePKStore';
import { usePKCountdown } from '../hooks/usePK';
import { useAI } from '../hooks/useAI';
import { pickPkBanterForAnchor, pickPkWelcomeForAnchor, isPkWelcomeLike } from '../data/pkBanter';
import { pickPkAudienceDanmu } from '../data/pkDanmu';
import { GIFTS } from '../data/gifts';
import { FAKE_NICKNAMES, randomFrom } from '../data/fakeDanmu';
import { generatePKAudienceDanmu } from '../utils/ai';
import { isActiveAiMode } from '../utils/aiMode';
import type { Gift, GiftFeedItem } from '../types';

const PK_SHOUT_PROMPTS = [
  '（公屏PK喊话：严格按你的人设语气，根据比分向全场拉票求礼物，不要迎宾，不超过45字。）',
  '（公屏PK喊话：按你的绿茶方式暗讽对手并求姐姐支持，语气要符合人设，不要迎宾，不超过45字。）',
  '（公屏PK喊话：比分紧张，用你惯常的说话风格煽情求援，不要迎宾，不超过45字。）',
  '（公屏PK喊话：放狠话证明你能赢，同时求刷礼物，措辞要有你的个人特色，不要迎宾，不超过45字。）',
  '（公屏PK喊话：点名求姐姐送具体虚拟礼物，语气要急迫、可怜或撒娇，不要迎宾，不超过45字。）',
  '（公屏PK喊话：强调PK快结束了，最后冲刺求打赏守塔或反超，不要迎宾，不超过45字。）',
];

/** PK 主播周期性拉票间隔（毫秒，偏频繁） */
const PK_SPEECH_DELAY_MIN = 3600;
const PK_SPEECH_DELAY_MAX = 5200;
const PK_SPEECH_START_DELAY = 1600;

/** PK 网友弹幕间隔（更密集） */
const PK_DANMU_DELAY_MIN = 1000;
const PK_DANMU_DELAY_MAX = 2100;
const PK_DANMU_START_DELAY = 600;

/** PK 网友模拟打赏间隔 */
const PK_NPC_GIFT_DELAY_MIN = 1600;
const PK_NPC_GIFT_DELAY_MAX = 3000;

type PkSide = 'A' | 'B';

interface SideSpeech {
  id: string;
  text: string;
}

type PkInteractionEventType = 'anchor_speech' | 'player_gift' | 'score_gap';

interface PkInteraction {
  eventType: PkInteractionEventType;
  summary: string;
  speakerSide?: PkSide;
  speakerName?: string;
  anchorSpeech?: string;
  giftName?: string;
  giftTargetName?: string;
}

function sideOfAnchor(anchorId: string, anchorAId: string): PkSide {
  return anchorId === anchorAId ? 'A' : 'B';
}

export default function PKRoom({ seedAnchorId }: { seedAnchorId?: string }) {
  const back = useNavStore((s) => s.back);
  const goHome = useNavStore((s) => s.goHome);

  const active = usePKStore((s) => s.active);
  const mode = usePKStore((s) => s.mode);
  const anchorAId = usePKStore((s) => s.anchorA);
  const anchorBId = usePKStore((s) => s.anchorB);
  const scoreA = usePKStore((s) => s.scoreA);
  const scoreB = usePKStore((s) => s.scoreB);
  const result = usePKStore((s) => s.result);
  const danmu = usePKStore((s) => s.danmu);
  const resetPK = usePKStore((s) => s.reset);

  const { label, isUrgent } = usePKCountdown();
  const { generateAnchorReply, isLoading } = useAI();

  const [giftSide, setGiftSide] = useState<PkSide | null>(null);
  const [fullscreenFx, setFullscreenFx] = useState<FullscreenGiftEffectItem[]>([]);
  const [speechA, setSpeechA] = useState<SideSpeech | null>(null);
  const [speechB, setSpeechB] = useState<SideSpeech | null>(null);
  const [giftFeedItems, setGiftFeedItems] = useState<GiftFeedItem[]>([]);
  const initRef = useRef(false);
  const pkPromptIdxRef = useRef(0);
  const recentPkLinesRef = useRef<string[]>([]);
  const entryWelcomeSentRef = useRef(false);
  const speechTimerARef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const speechTimerBRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const labelRef = useRef(label);
  labelRef.current = label;

  const audienceDanmu = useMemo(
    () => danmu.filter((d) => d.type === 'audience' || d.type === 'gift'),
    [danmu]
  );

  const pushPkGiftFeed = useCallback((item: Omit<GiftFeedItem, 'id'> & { id?: string }) => {
    setGiftFeedItems((prev) => [
      ...prev,
      { ...item, id: item.id ?? `pkgift_${Date.now()}_${Math.random()}` },
    ]);
  }, []);

  const pushPkDanmuLocal = useCallback((interaction?: PkInteraction) => {
    const fallback = pickPkAudienceDanmu({
      eventType: interaction?.eventType,
      speakerSide: interaction?.speakerSide,
    });
    usePKStore.getState().addDanmu({
      id: `pkdm_aud_${Date.now()}_${Math.random()}`,
      type: 'audience',
      content: fallback.content,
      sender: fallback.sender,
    });
  }, []);

  const emitPkDanmu = useCallback((interaction?: PkInteraction) => {
    pushPkDanmuLocal(interaction);
    if (!isActiveAiMode()) return;
    void (async () => {
      const state = usePKStore.getState();
      if (!state.active || !state.anchorA || !state.anchorB) return;
      const anchorLeft = getAnchorById(state.anchorA);
      const anchorRight = getAnchorById(state.anchorB);
      if (!anchorLeft || !anchorRight) return;

      const scoreGap = Math.abs(state.scoreA - state.scoreB);
      const playerName = usePlayerStore.getState().playerName || '姐姐';
      const ctx = {
        anchorAName: anchorLeft.stageName,
        anchorBName: anchorRight.stageName,
        scoreA: state.scoreA,
        scoreB: state.scoreB,
        countdown: labelRef.current,
        playerName,
        recentEvent: interaction?.summary,
        eventType: interaction?.eventType ?? ('idle' as const),
        speakerSide: interaction?.speakerSide,
        speakerName: interaction?.speakerName,
        anchorSpeech: interaction?.anchorSpeech,
        giftName: interaction?.giftName,
        giftTargetName: interaction?.giftTargetName,
        scoreGap,
        leadingSide:
          state.scoreA === state.scoreB ? ('tie' as const) : state.scoreA > state.scoreB ? ('A' as const) : ('B' as const),
      };

      try {
        const aiText = await generatePKAudienceDanmu(ctx);
        if (aiText) {
          usePKStore.getState().addDanmu({
            id: `pkdm_aud_${Date.now()}_${Math.random()}`,
            type: 'audience',
            content: aiText,
            sender: randomFrom(FAKE_NICKNAMES),
          });
        }
      } catch {
        // 本地弹幕已即时展示，AI 失败不影响连续性
      }
    })();
  }, [pushPkDanmuLocal]);

  const pushPkAudienceReaction = useCallback(
    (interaction: PkInteraction) => {
      const count = 2 + Math.floor(Math.random() * 2);
      for (let i = 0; i < count; i += 1) {
        setTimeout(() => {
          emitPkDanmu(interaction);
        }, 300 + i * 480 + Math.random() * 320);
      }
    },
    [emitPkDanmu]
  );

  const recordPkGift = useCallback(
    (side: PkSide, gift: Gift, sender: string, isPlayer: boolean) => {
      const target = side === 'A' ? getAnchorById(anchorAId!) : getAnchorById(anchorBId!);
      if (!target) return;

      usePKStore.getState().addDanmu({
        id: `pkdm_gift_${Date.now()}_${Math.random()}`,
        type: 'gift',
        content: `送出了虚拟礼物 ${gift.icon} ${gift.name}`,
        sender,
        giftName: gift.name,
        giftCount: 1,
        giftKind: 'virtual',
      });
      pushPkGiftFeed({
        sender,
        giftIcon: gift.icon,
        giftName: gift.name,
        count: 1,
        isPlayer,
        side,
        targetName: target.stageName,
      });
      pushPkAudienceReaction({
        eventType: 'player_gift',
        summary: `${sender}给${target.stageName}刷了虚拟礼物${gift.name}`,
        speakerSide: side,
        giftName: gift.name,
        giftTargetName: target.stageName,
      });
    },
    [anchorAId, anchorBId, pushPkGiftFeed, pushPkAudienceReaction]
  );

  const showAnchorSpeech = useCallback(
    (side: PkSide, text: string, anchorName: string) => {
      if (!text) return;
      const id = `pk_sub_${side}_${Date.now()}`;
      const patch = { id, text };
      if (side === 'A') {
        setSpeechA(patch);
        if (speechTimerARef.current) clearTimeout(speechTimerARef.current);
        speechTimerARef.current = setTimeout(() => {
          setSpeechA((cur) => (cur?.id === id ? null : cur));
        }, 7000);
      } else {
        setSpeechB(patch);
        if (speechTimerBRef.current) clearTimeout(speechTimerBRef.current);
        speechTimerBRef.current = setTimeout(() => {
          setSpeechB((cur) => (cur?.id === id ? null : cur));
        }, 7000);
      }

      pushPkAudienceReaction({
        eventType: 'anchor_speech',
        summary: `${anchorName}刚喊话：「${text}」`,
        speakerSide: side,
        speakerName: anchorName,
        anchorSpeech: text,
      });
    },
    [pushPkAudienceReaction]
  );

  useEffect(
    () => () => {
      if (speechTimerARef.current) clearTimeout(speechTimerARef.current);
      if (speechTimerBRef.current) clearTimeout(speechTimerBRef.current);
    },
    []
  );

  // 进入 PK 间时：仅一次迎宾
  useEffect(() => {
    if (!active || !anchorAId || !anchorBId || entryWelcomeSentRef.current) return;
    entryWelcomeSentRef.current = true;

    const welcomeAnchorId =
      seedAnchorId && [anchorAId, anchorBId].includes(seedAnchorId) ? seedAnchorId : anchorAId;
    const welcomeAnchor = getAnchorById(welcomeAnchorId);
    const opponentId = welcomeAnchorId === anchorAId ? anchorBId : anchorAId;
    const opponent = getAnchorById(opponentId);
    if (!welcomeAnchor || !opponent) return;

    const state = usePKStore.getState();
    const myScore = welcomeAnchorId === anchorAId ? state.scoreA : state.scoreB;
    const oppScore = welcomeAnchorId === anchorAId ? state.scoreB : state.scoreA;
    const playerName = usePlayerStore.getState().playerName || '姐姐';
    const side = sideOfAnchor(welcomeAnchorId, anchorAId);

    void (async () => {
      let reply = await generateAnchorReply({
        anchorId: welcomeAnchorId,
        scene: 'PK',
        userMessage: `（系统：观众"${playerName}"刚进入PK直播间，请简短欢迎一句并顺带提到正在和${opponent.stageName}PK、求她支持，只迎宾这一次，不超过45字。）`,
        pkContext: {
          opponentName: opponent.stageName,
          opponentSpecies: opponent.species,
          myScore,
          opponentScore: oppScore,
        },
      });
      if (!reply) reply = pickPkWelcomeForAnchor(welcomeAnchor, recentPkLinesRef.current);
      recentPkLinesRef.current = [...recentPkLinesRef.current, reply].slice(-8);
      showAnchorSpeech(side, reply, welcomeAnchor.stageName);
    })();
  }, [active, anchorAId, anchorBId, seedAnchorId, generateAnchorReply, showAnchorSpeech]);

  useEffect(() => {
    if (initRef.current) return;
    const state = usePKStore.getState();
    if (state.active && state.participants.length >= 2) {
      initRef.current = true;
      return;
    }
    if (state.anchorA && state.anchorB) {
      initRef.current = true;
      return;
    }
    initRef.current = true;

    const pair = pickRandomLivePair(seedAnchorId);
    if (!pair) {
      useToastStore.getState().show('当前在播主播不足两人，无法开启 PK');
      back();
      return;
    }
    if (!tryStartPK(pair[0], pair[1])) {
      back();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const anchorA = anchorAId ? getAnchorById(anchorAId) : null;
  const anchorB = anchorBId ? getAnchorById(anchorBId) : null;

  useEffect(() => {
    if (mode === 'squad') return;
    if (!active || !anchorAId || !anchorBId) return;
    let turnA = true;
    let cancelled = false;
    let timerId: ReturnType<typeof setTimeout> | null = null;

    const scheduleSpeech = () => {
      const delay = PK_SPEECH_DELAY_MIN + Math.random() * (PK_SPEECH_DELAY_MAX - PK_SPEECH_DELAY_MIN);
      timerId = setTimeout(() => {
        if (cancelled) return;
        const state = usePKStore.getState();
        if (!state.active) return;

        scheduleSpeech();

        const side: PkSide = turnA ? 'A' : 'B';
        turnA = !turnA;
        const speakerId = side === 'A' ? state.anchorA! : state.anchorB!;
        const opponentId = side === 'A' ? state.anchorB! : state.anchorA!;
        const speaker = getAnchorById(speakerId);
        const opponent = getAnchorById(opponentId);
        if (!speaker || !opponent) return;

        const myScore = side === 'A' ? state.scoreA : state.scoreB;
        const oppScore = side === 'A' ? state.scoreB : state.scoreA;
        const prompt = PK_SHOUT_PROMPTS[pkPromptIdxRef.current % PK_SHOUT_PROMPTS.length];
        pkPromptIdxRef.current += 1;

        const localReply = pickPkBanterForAnchor(speaker, myScore, oppScore, recentPkLinesRef.current);
        recentPkLinesRef.current = [...recentPkLinesRef.current, localReply].slice(-8);
        showAnchorSpeech(side, localReply, speaker.stageName);

        void (async () => {
          if (!isActiveAiMode()) return;
          let reply = '';
          try {
            reply = await generateAnchorReply({
              anchorId: speakerId,
              scene: 'PK',
              userMessage: prompt,
              pkContext: {
                opponentName: opponent.stageName,
                opponentSpecies: opponent.species,
                myScore,
                opponentScore: oppScore,
              },
            });
          } catch {
            reply = '';
          }

          if (!reply || isPkWelcomeLike(reply) || reply === localReply) return;
          if (cancelled || !usePKStore.getState().active) return;
          recentPkLinesRef.current = [...recentPkLinesRef.current, reply].slice(-8);
          showAnchorSpeech(side, reply, speaker.stageName);
        })();
      }, delay);
    };

    const startDelay = setTimeout(scheduleSpeech, PK_SPEECH_START_DELAY);

    // 进入 PK 后立刻先拉一轮票，不等 AI
    const state = usePKStore.getState();
    const firstSpeaker = getAnchorById(state.anchorA!);
    const firstOpponent = getAnchorById(state.anchorB!);
    if (firstSpeaker && firstOpponent) {
      const localReply = pickPkBanterForAnchor(
        firstSpeaker,
        state.scoreA,
        state.scoreB,
        recentPkLinesRef.current
      );
      recentPkLinesRef.current = [...recentPkLinesRef.current, localReply].slice(-8);
      showAnchorSpeech('A', localReply, firstSpeaker.stageName);
    }

    return () => {
      cancelled = true;
      clearTimeout(startDelay);
      if (timerId) clearTimeout(timerId);
    };
  }, [active, anchorAId, anchorBId, generateAnchorReply, showAnchorSpeech]);

  // PK 围观网友弹幕：独立定时器持续刷新，不等待 AI
  useEffect(() => {
    if (!active || !anchorA || !anchorB) return;
    let cancelled = false;
    let timerId: ReturnType<typeof setTimeout> | null = null;

    const scheduleNext = () => {
      const delay = PK_DANMU_DELAY_MIN + Math.random() * (PK_DANMU_DELAY_MAX - PK_DANMU_DELAY_MIN);
      timerId = setTimeout(() => {
        if (cancelled) return;
        const state = usePKStore.getState();
        if (!state.active) return;

        scheduleNext();

        const scoreGap = Math.abs(state.scoreA - state.scoreB);
        if (scoreGap >= 120 && Math.random() < 0.28) {
          emitPkDanmu({ eventType: 'score_gap', summary: `比分差距${scoreGap}分` });
        } else {
          emitPkDanmu();
        }
      }, delay);
    };

    pushPkDanmuLocal();
    const startDelay = setTimeout(scheduleNext, PK_DANMU_START_DELAY);
    return () => {
      cancelled = true;
      clearTimeout(startDelay);
      if (timerId) clearTimeout(timerId);
    };
  }, [active, anchorA, anchorB, emitPkDanmu, pushPkDanmuLocal]);

  // PK 网友模拟打赏（左右两侧随机送礼）
  useEffect(() => {
    if (!active || !anchorAId || !anchorBId) return;
    let cancelled = false;
    let timerId: ReturnType<typeof setTimeout> | null = null;
    const affordable = GIFTS.filter((g) => g.price <= 520);

    const scheduleNext = () => {
      const delay = PK_NPC_GIFT_DELAY_MIN + Math.random() * (PK_NPC_GIFT_DELAY_MAX - PK_NPC_GIFT_DELAY_MIN);
      timerId = setTimeout(() => {
        if (cancelled) return;
        const state = usePKStore.getState();
        if (!state.active) return;

        scheduleNext();

        if (affordable.length > 0 && Math.random() < 0.78) {
          const side: PkSide = Math.random() < 0.5 ? 'A' : 'B';
          const gift = affordable[Math.floor(Math.random() * affordable.length)];
          const sender = randomFrom(FAKE_NICKNAMES);
          usePKStore.getState().addGiftToSide(side, gift.price, false);
          recordPkGift(side, gift, sender, false);
        }
      }, delay);
    };

    const startDelay = setTimeout(scheduleNext, 1200);

    // 进入 PK 后尽快出现一笔网友打赏
    if (affordable.length > 0) {
      const side: PkSide = Math.random() < 0.5 ? 'A' : 'B';
      const gift = affordable[Math.floor(Math.random() * affordable.length)];
      const sender = randomFrom(FAKE_NICKNAMES);
      usePKStore.getState().addGiftToSide(side, gift.price, false);
      recordPkGift(side, gift, sender, false);
    }

    return () => {
      cancelled = true;
      clearTimeout(startDelay);
      if (timerId) clearTimeout(timerId);
    };
  }, [active, anchorAId, anchorBId, recordPkGift]);

  useEffect(() => {
    if (result) setGiftSide(null);
  }, [result]);

  const handleGift = async (gift: Gift) => {
    if (!giftSide || !anchorAId || !anchorBId) return;
    setGiftSide(null);
    const sideAnchorId = giftSide === 'A' ? anchorAId : anchorBId;
    const opponentId = giftSide === 'A' ? anchorBId : anchorAId;
    const anchor = getAnchorById(sideAnchorId);
    const opponent = getAnchorById(opponentId);
    if (!anchor || !opponent) return;

    if (!(await pay(gift.price))) return;
    usePKStore.getState().addGiftToSide(giftSide, gift.price, true);
    useAnchorStore.getState().addSpend(sideAnchorId, gift.price);
    useAnchorStore.getState().markInteract(sideAnchorId);
    usePlayerStore
      .getState()
      .addSpendRecord({ anchorId: sideAnchorId, giftId: gift.id, giftName: gift.name, price: gift.price });

    const playerName = usePlayerStore.getState().playerName || '姐姐';
    recordPkGift(giftSide, gift, playerName || '你', true);

    if (gift.isBig) {
      const fxId = `fx_${Date.now()}`;
      setFullscreenFx((prev) => [
        ...prev,
        {
          id: fxId,
          icon: gift.icon,
          giftName: gift.name,
          senderName: usePlayerStore.getState().playerName || '你',
          targetName: anchor.stageName,
        },
      ]);
    }

    const state = usePKStore.getState();
    const myScore = giftSide === 'A' ? state.scoreA : state.scoreB;
    const oppScore = giftSide === 'A' ? state.scoreB : state.scoreA;

    const reply = await generateAnchorReply({
      anchorId: sideAnchorId,
      scene: 'PK',
      userMessage: `（系统事件：观众刚刚在PK中送出了【虚拟礼物】${gift.name}，价值${gift.price}虚拟币（不是实体快递/淘淘购/美团实物，只涨PK分和出特效）。请表现出感激和兴奋，继续撒娇求更多虚拟礼物支持${gift.isBig ? '，这是大礼物要夸张感谢' : ''}，感谢时不要说收到实物或快递，不超过60字。）`,
      pkContext: {
        opponentName: opponent.stageName,
        opponentSpecies: opponent.species,
        myScore,
        opponentScore: oppScore,
      },
    });
    showAnchorSpeech(giftSide, reply, anchor.stageName);
  };

  if (mode === 'squad') {
    return <SquadPKRoom />;
  }

  if (!anchorA || !anchorB || !anchorAId || !anchorBId) {
    return (
      <div className="flex h-full items-center justify-center text-[#9b8fb0]" style={{ background: LIVE.bg }}>
        正在匹配 PK…
      </div>
    );
  }

  const typingSide: PkSide | null = isLoading(anchorAId) ? 'A' : isLoading(anchorBId) ? 'B' : null;

  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden bg-[#0c0614]">
      {/* 顶部时间栏：不铺立绘 */}
      <StatusBar />

      {/* 对战立绘：从状态栏下方开始铺满 */}
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <div className="pointer-events-none absolute inset-0">
          <PKVersusStage
            variant="screen"
            hideCountdown
            anchorAId={anchorAId}
            anchorBId={anchorBId}
            scoreA={scoreA}
            scoreB={scoreB}
            countdown={label}
            urgent={isUrgent}
            className="h-full w-full"
          />
        </div>

        <div className="relative z-10 flex h-full min-h-0 flex-col">
          {/* 顶部信息：半透明白渐变 */}
          <div className="shrink-0 bg-gradient-to-b from-[#0c0614]/95 via-[#160b24]/75 to-transparent px-2 pb-3 pt-1">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={back}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#f3eef9] hover:bg-black/[0.06]"
              >
                <svg width="10" height="16" viewBox="0 0 10 16" fill="none">
                  <path d="M9 1L2 8l7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="rounded-sm bg-[#f4212e] px-1.5 py-0.5 text-[10px] font-extrabold tracking-wide text-white">
                    PK
                  </span>
                  <p className="truncate text-[14px] font-extrabold text-[#f3eef9]">
                    {anchorA.stageName}
                    <span className="mx-1 font-bold text-[#536471]">vs</span>
                    {anchorB.stageName}
                  </p>
                </div>
                <p className="truncate text-[13px] text-[#c4b5fd]">
                  <span className="text-[18px] font-black tabular-nums text-white">{scoreA}</span>
                  <span className="mx-1.5 font-bold text-[#9b8fb0]">:</span>
                  <span className="text-[18px] font-black tabular-nums text-white">{scoreB}</span>
                  <span className="mx-1.5">·</span>
                  <span className={isUrgent ? 'font-bold text-[#f4212e]' : 'text-[#9b8fb0]'}>{label}</span>
                </p>
              </div>
            </div>
          </div>

          {/* 中部：礼物飘条 + 口播 */}
          <div className="relative min-h-0 flex-1 px-2">
            <PKGiftFeedStrip items={giftFeedItems} />
            <div className="absolute inset-x-2 bottom-2 z-10 space-y-1.5">
              <div className="flex items-end justify-between gap-2">
                <div className="w-[48%]">
                  {speechA && (
                    <PKSpeechBubble
                      side="A"
                      id={speechA.id}
                      text={speechA.text}
                      anchorName={anchorA.stageName}
                    />
                  )}
                  {typingSide === 'A' && !speechA && (
                    <p className="rounded-full bg-[#0c0614]/80 px-2.5 py-1 text-[11px] text-[#9b5cff] backdrop-blur-sm">
                      {anchorA.stageName} 正在说话…
                    </p>
                  )}
                </div>
                <div className="w-[48%]">
                  {speechB && (
                    <PKSpeechBubble
                      side="B"
                      id={speechB.id}
                      text={speechB.text}
                      anchorName={anchorB.stageName}
                    />
                  )}
                  {typingSide === 'B' && !speechB && (
                    <p className="rounded-full bg-[#0c0614]/80 px-2.5 py-1 text-right text-[11px] text-[#d946ef] backdrop-blur-sm">
                      {anchorB.stageName} 正在说话…
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 弹幕区：固定高度，半透明白渐变，黑字 */}
          <div className="flex h-44 shrink-0 flex-col bg-gradient-to-t from-[#0c0614] via-[#0c0614]/92 to-[#160b24]/55 backdrop-blur-[2px]">
            <div className="min-h-0 flex-1">
              <DanmuList list={audienceDanmu} variant="overlay" />
            </div>
          </div>

          {/* 底部打赏 */}
          <div className="flex shrink-0 items-center gap-2 border-t border-[#3d2a55] bg-[#0c0614]/95 px-3 py-2.5 backdrop-blur-sm">
            <button
              type="button"
              onClick={() => setGiftSide('A')}
              disabled={!!result}
              className="min-w-0 flex-1 truncate rounded-full bg-[#9b5cff] px-3 py-2.5 text-[13px] font-bold text-white disabled:opacity-40 active:scale-95"
            >
              礼物 · {anchorA.stageName}
            </button>
            <button
              type="button"
              onClick={() => setGiftSide('B')}
              disabled={!!result}
              className="min-w-0 flex-1 truncate rounded-full bg-[#7c3aed] px-3 py-2.5 text-[13px] font-bold text-white disabled:opacity-40 active:scale-95"
            >
              礼物 · {anchorB.stageName}
            </button>
          </div>
        </div>

        {result && (
          <div className="absolute inset-0 z-[70] flex flex-col items-center justify-center gap-4 bg-[#0c0614]/85 px-6 text-center backdrop-blur-sm">
            <div className="text-4xl">🏆</div>
            <p className="text-[17px] font-extrabold text-white">
              {result === 'A' ? anchorA.stageName : anchorB.stageName} 获胜！
            </p>
            <p className="text-[13px] text-[#3d2a55]">
              {scoreA} : {scoreB}，双方都已经私信你啦～
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  resetPK();
                  back();
                }}
                className="rounded-full border border-[#3d2a55] bg-[#0c0614]/10 px-5 py-2 text-[13px] font-bold text-white"
              >
                返回
              </button>
              <button
                type="button"
                onClick={() => {
                  resetPK();
                  goHome();
                }}
                className="rounded-full bg-[#9b5cff] px-5 py-2 text-[13px] font-bold text-white"
              >
                回到桌面
              </button>
            </div>
          </div>
        )}
      </div>

      <GiftPanel open={giftSide !== null} onClose={() => setGiftSide(null)} onSelect={handleGift} />
      <FullscreenGiftEffect
        effects={fullscreenFx}
        onDone={(id) => setFullscreenFx((prev) => prev.filter((i) => i.id !== id))}
      />
    </div>
  );
}
