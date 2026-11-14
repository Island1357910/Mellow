import { pay } from '../../utils/mellowHost';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import StatusBar from '../Phone/StatusBar';
import SquadPKStage from '../LiveList/SquadPKStage';
import DanmuList from './DanmuList';
import GiftPanel from '../Gift/GiftPanel';
import FullscreenGiftEffect, {
  type FullscreenGiftEffectItem,
} from '../Gift/FullscreenGiftEffect';
import { getAnchorById } from '../../data/anchors';
import { buildSquadDiscussionPrompt } from '../../data/pkDiscussion';
import { FAKE_NICKNAMES, randomFrom } from '../../data/fakeDanmu';
import { GIFTS } from '../../data/gifts';
import { useAI } from '../../hooks/useAI';
import { usePKCountdown } from '../../hooks/usePK';
import { useAnchorStore } from '../../stores/useAnchorStore';
import { useNavStore } from '../../stores/useNavStore';
import { usePKStore } from '../../stores/usePKStore';
import { usePlayerStore } from '../../stores/usePlayerStore';
import { useToastStore } from '../../stores/useToastStore';
import { isActiveAiMode } from '../../utils/aiMode';
import { LIVE } from '../../theme/liveTheme';
import type { Gift, GiftFeedItem } from '../../types';

const SPEECH_GAP_MIN = 4200;
const SPEECH_GAP_MAX = 6800;
const SPEECH_SHOW_MS = 5200;
const TOPIC_ROTATE_MS = 48_000;
const DANMU_DELAY_MIN = 1400;
const DANMU_DELAY_MAX = 2600;
const NPC_GIFT_MIN = 2200;
const NPC_GIFT_MAX = 4000;

interface ActiveSpeech {
  id: string;
  anchorId: string;
  text: string;
}

/** 四人 PK 直播间：聚焦打赏 + 同话题错峰发言 */
export default function SquadPKRoom() {
  const back = useNavStore((s) => s.back);
  const goHome = useNavStore((s) => s.goHome);

  const participants = usePKStore((s) => s.participants);
  const scores = usePKStore((s) => s.scores);
  const focusAnchorId = usePKStore((s) => s.focusAnchorId);
  const discussionTopic = usePKStore((s) => s.discussionTopic);
  const winnerId = usePKStore((s) => s.winnerId);
  const active = usePKStore((s) => s.active);
  const danmu = usePKStore((s) => s.danmu);
  const resetPK = usePKStore((s) => s.reset);
  const setFocusAnchor = usePKStore((s) => s.setFocusAnchor);
  const rotateDiscussionTopic = usePKStore((s) => s.rotateDiscussionTopic);

  const { label, isUrgent } = usePKCountdown();
  const { generateAnchorReply, isLoading } = useAI();

  const [giftOpen, setGiftOpen] = useState(false);
  const [fullscreenFx, setFullscreenFx] = useState<FullscreenGiftEffectItem[]>([]);
  const [speech, setSpeech] = useState<ActiveSpeech | null>(null);
  const [giftFeedItems, setGiftFeedItems] = useState<GiftFeedItem[]>([]);
  const [equalHint, setEqualHint] = useState(true);

  const speakBusyRef = useRef(false);
  const speakingRef = useRef(false);
  const nextSpeakerIdxRef = useRef(0);
  const recentLinesRef = useRef<string[]>([]);
  const speechClearRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const audienceDanmu = useMemo(
    () => danmu.filter((d) => d.type === 'audience' || d.type === 'gift'),
    [danmu]
  );

  const focusAnchor = focusAnchorId ? getAnchorById(focusAnchorId) : null;
  const finished = !active && !!winnerId;

  const showSpeech = useCallback((anchorId: string, text: string) => {
    const id = `sqsp_${Date.now()}_${Math.random()}`;
    speakingRef.current = true;
    setSpeech({ id, anchorId, text });
    if (speechClearRef.current) clearTimeout(speechClearRef.current);
    speechClearRef.current = setTimeout(() => {
      setSpeech(null);
      speakingRef.current = false;
    }, SPEECH_SHOW_MS);
    recentLinesRef.current = [...recentLinesRef.current.slice(-5), text];
  }, []);

  // 进入时短暂均分展示，再保持当前 focus
  useEffect(() => {
    const t = setTimeout(() => setEqualHint(false), 900);
    return () => clearTimeout(t);
  }, []);

  // 话题轮换
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => {
      rotateDiscussionTopic();
      usePKStore.getState().addDanmu({
        id: `sq_topic_${Date.now()}`,
        type: 'system',
        content: `话题切换：${usePKStore.getState().discussionTopic}`,
      });
    }, TOPIC_ROTATE_MS);
    return () => clearInterval(timer);
  }, [active, rotateDiscussionTopic]);

  // 错峰发言：同一时间只生成/展示一人，轮流围绕共同话题
  useEffect(() => {
    if (!active || participants.length !== 4) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const schedule = (delay: number) => {
      timer = setTimeout(async () => {
        if (cancelled) return;
        const state = usePKStore.getState();
        if (!state.active || state.mode !== 'squad') return;

        if (speakBusyRef.current || speakingRef.current) {
          schedule(1200);
          return;
        }

        speakBusyRef.current = true;
        const idx = nextSpeakerIdxRef.current % state.participants.length;
        nextSpeakerIdxRef.current = idx + 1;
        const speakerId = state.participants[idx];
        const speaker = getAnchorById(speakerId);
        const peers = state.participants
          .filter((id) => id !== speakerId)
          .map((id) => getAnchorById(id)?.stageName)
          .filter(Boolean) as string[];

        if (!speaker) {
          speakBusyRef.current = false;
          schedule(SPEECH_GAP_MIN);
          return;
        }

        const topic = state.discussionTopic || '互相友好处友';
        const myScore = state.scores[speakerId] ?? 0;
        const scoreLine = state.participants
          .map((id) => `${getAnchorById(id)?.stageName}:${state.scores[id] ?? 0}`)
          .join(' / ');

        let line = `${topic}……我觉得挺有意思的，大家也说说嘛～`;
        if (isActiveAiMode()) {
          try {
            const reply = await generateAnchorReply({
              anchorId: speakerId,
              scene: 'PK',
              userMessage: buildSquadDiscussionPrompt(topic, speaker.stageName, peers),
              pkContext: {
                opponentName: peers[0] ?? '同伴',
                myScore,
                opponentScore: Math.max(
                  ...state.participants.filter((id) => id !== speakerId).map((id) => state.scores[id] ?? 0),
                  0
                ),
                squadMode: true,
                discussionTopic: topic,
                peerNames: peers,
                scoreBoard: scoreLine,
              },
            });
            if (reply && !/傻逼|去死|滚|骂|撕逼|打架|废物|垃圾人/.test(reply)) {
              line = reply;
            }
          } catch {
            // fallback
          }
        }

        if (!cancelled && usePKStore.getState().active) {
          showSpeech(speakerId, line);
          usePKStore.getState().addDanmu({
            id: `sq_sp_${Date.now()}`,
            type: 'audience',
            content: line,
            sender: speaker.stageName,
          });
        }

        speakBusyRef.current = false;
        const gap = SPEECH_GAP_MIN + Math.random() * (SPEECH_GAP_MAX - SPEECH_GAP_MIN);
        schedule(gap);
      }, delay);
    };

    schedule(2200);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      if (speechClearRef.current) clearTimeout(speechClearRef.current);
    };
  }, [active, participants, generateAnchorReply, showSpeech]);

  // 围观弹幕
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const tick = () => {
      const delay = DANMU_DELAY_MIN + Math.random() * (DANMU_DELAY_MAX - DANMU_DELAY_MIN);
      timer = setTimeout(() => {
        if (cancelled || !usePKStore.getState().active) return;
        const topic = usePKStore.getState().discussionTopic;
        const lines = [
          `这个话题「${topic.slice(0, 8)}」好温柔啊`,
          '四个人一起聊好热闹',
          '别吵啊多友好多好',
          '姐姐给他们都刷一点吧',
          '氛围也太好了吧',
          '谁在主要位呀点一下',
        ];
        usePKStore.getState().addDanmu({
          id: `sq_dm_${Date.now()}`,
          type: 'audience',
          content: randomFrom(lines),
          sender: randomFrom(FAKE_NICKNAMES),
        });
        tick();
      }, delay);
    };
    tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [active]);

  // NPC 打赏随机一人
  useEffect(() => {
    if (!active || participants.length !== 4) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const affordable = GIFTS.filter((g) => g.price <= 520);

    const tick = () => {
      const delay = NPC_GIFT_MIN + Math.random() * (NPC_GIFT_MAX - NPC_GIFT_MIN);
      timer = setTimeout(() => {
        if (cancelled || !usePKStore.getState().active) return;
        if (affordable.length > 0 && Math.random() < 0.7) {
          const state = usePKStore.getState();
          const targetId = randomFrom(state.participants);
          const gift = randomFrom(affordable);
          const sender = randomFrom(FAKE_NICKNAMES);
          const target = getAnchorById(targetId);
          usePKStore.getState().addGiftToAnchor(targetId, gift.price, false);
          usePKStore.getState().addDanmu({
            id: `sq_gf_${Date.now()}`,
            type: 'gift',
            content: `送出了虚拟礼物 ${gift.icon} ${gift.name}`,
            sender,
            giftName: gift.name,
            giftCount: 1,
            giftKind: 'virtual',
          });
          setGiftFeedItems((prev) => [
            ...prev.slice(-8),
            {
              id: `sqf_${Date.now()}`,
              sender,
              giftIcon: gift.icon,
              giftName: gift.name,
              count: 1,
              isPlayer: false,
              targetName: target?.stageName,
              targetAnchorId: targetId,
            },
          ]);
        }
        tick();
      }, delay);
    };
    tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [active, participants]);

  const handleSelect = (anchorId: string) => {
    setFocusAnchor(anchorId);
    setEqualHint(false);
    const name = getAnchorById(anchorId)?.stageName ?? '主播';
    useToastStore.getState().show(`已将 ${name} 设为主要主播，可打赏`);
  };

  const openGift = () => {
    if (!focusAnchorId) {
      useToastStore.getState().show('请先点击一位主播，设为主要主播后再打赏');
      return;
    }
    setGiftOpen(true);
  };

  const handleGift = async (gift: Gift) => {
    if (!focusAnchorId) return;
    setGiftOpen(false);
    const anchor = getAnchorById(focusAnchorId);
    if (!anchor) return;

    if (!(await pay(gift.price))) return;
    usePKStore.getState().addGiftToAnchor(focusAnchorId, gift.price, true);
    useAnchorStore.getState().addSpend(focusAnchorId, gift.price);
    useAnchorStore.getState().markInteract(focusAnchorId);
    usePlayerStore.getState().addSpendRecord({
      anchorId: focusAnchorId,
      giftId: gift.id,
      giftName: gift.name,
      price: gift.price,
    });

    const playerName = usePlayerStore.getState().playerName || '姐姐';
    usePKStore.getState().addDanmu({
      id: `sq_pg_${Date.now()}`,
      type: 'gift',
      content: `送出了虚拟礼物 ${gift.icon} ${gift.name}`,
      sender: playerName,
      giftName: gift.name,
      giftCount: 1,
      giftKind: 'virtual',
    });
    setGiftFeedItems((prev) => [
      ...prev,
      {
        id: `sqf_p_${Date.now()}`,
        sender: playerName,
        giftIcon: gift.icon,
        giftName: gift.name,
        count: 1,
        isPlayer: true,
        targetName: anchor.stageName,
        targetAnchorId: focusAnchorId,
      },
    ]);

    if (gift.isBig) {
      setFullscreenFx((prev) => [
        ...prev,
        {
          id: `fx_${Date.now()}`,
          icon: gift.icon,
          giftName: gift.name,
          senderName: playerName,
          targetName: anchor.stageName,
        },
      ]);
    }

    // 打赏感谢也排队，不打断正在说的话题发言太狠——略延迟
    setTimeout(async () => {
      if (speakBusyRef.current) return;
      speakBusyRef.current = true;
      try {
        const state = usePKStore.getState();
        const peers = state.participants
          .filter((id) => id !== focusAnchorId)
          .map((id) => getAnchorById(id)?.stageName)
          .filter(Boolean) as string[];
        const reply = await generateAnchorReply({
          anchorId: focusAnchorId,
          scene: 'PK',
          userMessage: `（系统：观众刚送出虚拟礼物【${gift.name}】。请友善感谢，可轻轻接回话题「${state.discussionTopic}」，禁止骂人吵架，不超过40字。）`,
          pkContext: {
            opponentName: peers[0] ?? '同伴',
            myScore: state.scores[focusAnchorId] ?? 0,
            opponentScore: 0,
            squadMode: true,
            discussionTopic: state.discussionTopic,
            peerNames: peers,
          },
        });
        if (reply) showSpeech(focusAnchorId, reply);
      } catch {
        showSpeech(focusAnchorId, `谢谢姐姐的${gift.name}～我们继续聊～`);
      } finally {
        speakBusyRef.current = false;
      }
    }, 800);
  };

  const displayFocus = equalHint ? null : focusAnchorId;

  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden" style={{ background: LIVE.bg }}>
      <StatusBar />

      <div className="relative z-10 flex min-h-0 flex-1 flex-col">
        {/* 顶部信息 */}
        <div
          className="shrink-0 px-2 pb-2 pt-1"
          style={{
            background: 'linear-gradient(to bottom, rgba(12,6,20,0.95) 0%, rgba(12,6,20,0.55) 70%, transparent)',
          }}
        >
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={back}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#f3eef9] hover:bg-white/10"
            >
              <svg width="10" height="16" viewBox="0 0 10 16" fill="none">
                <path d="M9 1L2 8l7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="rounded-sm bg-[#9b5cff] px-1.5 py-0.5 text-[10px] font-extrabold text-white">
                  四人PK
                </span>
                <p className="truncate text-[13px] font-extrabold text-[#f3eef9]">多人连麦对战</p>
              </div>
              <p className={`truncate text-[11px] ${isUrgent ? 'font-bold text-[#f4212e]' : 'text-[#9b8fb0]'}`}>
                {label} · 点击立绘切换主要主播
              </p>
            </div>
          </div>
          {discussionTopic && (
            <p className="mt-2 truncate rounded-full border border-[#3d2a55] bg-[#160b24]/80 px-3 py-1 text-[11px] text-[#c4b5fd]">
              话题：{discussionTopic}
            </p>
          )}
        </div>

        {/* 立绘区：仅占弹幕上方，避免次要主播被挡住 */}
        <div className="relative min-h-0 flex-1 overflow-hidden px-1.5">
          <SquadPKStage
            participantIds={participants}
            scores={scores}
            focusAnchorId={displayFocus}
            onSelect={handleSelect}
          />

          <div className="pointer-events-none absolute left-1 top-1 z-20 flex max-w-[55%] flex-col gap-1">
            {giftFeedItems.slice(-3).map((item) => (
              <GiftChip key={item.id} item={item} />
            ))}
          </div>

          {speech && (
            <div className="pointer-events-none absolute inset-x-2 bottom-2 z-20">
              <div className="rounded-2xl border border-[#9b5cff]/40 bg-[#1a0f2a]/92 px-3 py-2 backdrop-blur-sm">
                <p className="mb-0.5 text-[11px] font-bold text-[#9b5cff]">
                  {getAnchorById(speech.anchorId)?.stageName ?? '主播'} 说
                </p>
                <p className="text-[13px] leading-snug text-white">{speech.text}</p>
              </div>
            </div>
          )}
          {!speech && focusAnchorId && isLoading(focusAnchorId) && (
            <p className="absolute inset-x-2 bottom-2 rounded-full bg-[#160b24]/85 px-3 py-1 text-center text-[11px] text-white/80">
              {focusAnchor?.stageName} 正在说话…
            </p>
          )}
        </div>

        {/* 弹幕区 */}
        <div
          className="flex h-36 shrink-0 flex-col"
          style={{
            background: 'linear-gradient(to top, #0c0614 0%, rgba(12,6,20,0.92) 55%, rgba(22,11,36,0.55) 100%)',
          }}
        >
          <div className="min-h-0 flex-1">
            <DanmuList list={audienceDanmu} variant="overlay" />
          </div>
        </div>

        {/* 底部打赏 */}
        <div
          className="flex shrink-0 items-center gap-2 border-t px-3 py-2.5"
          style={{ borderColor: LIVE.border, background: 'rgba(12,6,20,0.96)' }}
        >
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12px] font-bold text-[#f3eef9]">
              {focusAnchor ? `打赏给：${focusAnchor.stageName}` : '先点选主要主播'}
            </p>
            <p className="truncate text-[10px] text-[#9b8fb0]">次要主播需先点选为主要才可打赏</p>
          </div>
          <button
            type="button"
            onClick={openGift}
            disabled={finished}
            className="shrink-0 rounded-full bg-[#9b5cff] px-4 py-2.5 text-[13px] font-bold text-white disabled:opacity-40 active:scale-95"
          >
            礼物
          </button>
        </div>
      </div>

      {finished && winnerId && (
        <div
          className="absolute inset-0 z-[70] flex flex-col items-center justify-center gap-4 px-6 text-center backdrop-blur-sm"
          style={{ background: LIVE.overlay }}
        >
          <div className="text-4xl">🏆</div>
          <p className="text-[17px] font-extrabold text-white">
            {getAnchorById(winnerId)?.stageName ?? '主播'} 获胜！
          </p>
          <p className="text-[13px] text-[#c4b5fd]">
            {participants.map((id) => `${getAnchorById(id)?.stageName} ${scores[id] ?? 0}`).join(' · ')}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                resetPK();
                back();
              }}
              className="rounded-full border border-[#3d2a55] px-5 py-2 text-[13px] font-bold text-white"
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

      <GiftPanel open={giftOpen} onClose={() => setGiftOpen(false)} onSelect={handleGift} />
      <FullscreenGiftEffect
        effects={fullscreenFx}
        onDone={(id) => setFullscreenFx((prev) => prev.filter((i) => i.id !== id))}
      />
    </div>
  );
}

function GiftChip({ item }: { item: GiftFeedItem }) {
  return (
    <div
      className={`flex max-w-full items-center gap-1.5 rounded-2xl px-2 py-1 shadow-lg ring-2 ${
        item.isPlayer ? 'bg-[#9b5cff] ring-white/80' : 'bg-gradient-to-r from-[#7c3aed] to-[#0c0614] ring-[#9b5cff]/40'
      }`}
    >
      <span className="text-base">{item.giftIcon}</span>
      <div className="min-w-0">
        <p className="truncate text-[10px] font-extrabold text-white">{item.sender}</p>
        <p className="truncate text-[9px] font-semibold text-white">
          送 {item.targetName} {item.giftName}
        </p>
      </div>
    </div>
  );
}
