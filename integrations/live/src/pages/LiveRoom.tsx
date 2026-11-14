import { pay } from '../utils/mellowHost';
import { useEffect, useRef, useState } from 'react';
import StatusBar from '../components/Phone/StatusBar';
import Avatar from '../components/Common/Avatar';
import AnchorImage, { anchorAvatarProps } from '../components/Common/AnchorImage';
import DanmuList from '../components/LiveRoom/DanmuList';
import Leaderboard from '../components/LiveRoom/Leaderboard';
import SubtitleBubble from '../components/LiveRoom/SubtitleBubble';
import LinkMicOverlay from '../components/LiveRoom/LinkMicOverlay';
import GiftFeedStrip from '../components/Gift/GiftFeedStrip';
import GiftPanel from '../components/Gift/GiftPanel';
import FullscreenGiftEffect, {
  type FullscreenGiftEffectItem,
} from '../components/Gift/FullscreenGiftEffect';
import FloatingGift, { type FloatingGiftItem } from '../components/Gift/FloatingGift';
import { parseActivityInstruction } from '../data/activities';
import { getAnchorById } from '../data/anchors';
import { useAnchorStore } from '../stores/useAnchorStore';
import { usePlayerStore } from '../stores/usePlayerStore';
import { useChatStore } from '../stores/useChatStore';
import { useNavStore } from '../stores/useNavStore';
import { useGameTimeStore } from '../stores/useGameTimeStore';
import { useSocialStore } from '../stores/useSocialStore';
import { useDanmu } from '../hooks/useDanmu';
import { useNpcGifts } from '../hooks/useNpcGifts';
import { useAI } from '../hooks/useAI';
import { useAnchorPeriodicSpeech } from '../hooks/useAnchorPeriodicSpeech';
import { triggerJealousy } from '../hooks/useBackgroundBehaviors';
import { isActiveAiMode } from '../utils/aiMode';
import { formatLiveRoomContext, extractLiveHighlights } from '../utils/liveContext';
import { getOfflineLiveToast } from '../utils/liveRoomEntry';
import { getLiveAnchorIds } from '../utils/pkMatch';
import { useToastStore } from '../stores/useToastStore';
import { getTodayScheduleDetail } from '../data/schedules';
import type { Gift, GiftFeedItem, DanmuItem } from '../types';
import type { ChatMsg } from '../utils/ai';

type CallPhase = 'idle' | 'connecting' | 'active';

export default function LiveRoom({ anchorId }: { anchorId: string }) {
  const anchor = getAnchorById(anchorId);
  const back = useNavStore((s) => s.back);
  const push = useNavStore((s) => s.push);
  const playerName = usePlayerStore((s) => s.playerName);
  const ensureInit = useAnchorStore((s) => s.ensureInit);
  const getRuntime = useAnchorStore((s) => s.getRuntime);
  const runtime = useAnchorStore((s) => s.runtime[anchorId]);
  const addSpend = useAnchorStore((s) => s.addSpend);
  const ensureLiveSession = useAnchorStore((s) => s.ensureLiveSession);
  const boostFavor = useAnchorStore((s) => s.boostFavor);
  const setActivity = useAnchorStore((s) => s.setActivity);
  const markInteract = useAnchorStore((s) => s.markInteract);
  const isTop1Fn = useAnchorStore((s) => s.isTop1);
  const liveSessionPlayerSpent = useAnchorStore((s) => s.runtime[anchorId]?.liveSessionPlayerSpent ?? 0);
  const liveSessionRivals = useAnchorStore((s) => s.runtime[anchorId]?.liveSessionRivals ?? []);
  const addSpendRecord = usePlayerStore((s) => s.addSpendRecord);
  const setCurrentLiveAnchor = usePlayerStore((s) => s.setCurrentLiveAnchor);
  const { generateAnchorReply, isLoading } = useAI();

  const isOnline = runtime?.isOnline === true;

  useEffect(() => {
    ensureInit();
    if (anchorId) getRuntime(anchorId);
  }, [anchorId, ensureInit, getRuntime]);

  useEffect(() => {
    if (!anchor || isOnline) return;
    useToastStore.getState().show(getOfflineLiveToast(anchorId));
  }, [anchor, anchorId, isOnline]);

  const isTop1 = isTop1Fn(anchorId);
  const { danmuList, pushDanmu, pushGiftReaction, pushPlayerChatReaction, pushAnchorSpeechReaction, pushActivityChangeReaction } = useDanmu(!!anchor, {
    anchorStageName: anchor?.stageName ?? '',
    playerName: playerName || '姐姐',
    isPlayerTop1: isTop1,
    activityLabel: runtime?.activity?.label,
  });

  const isFollowed = useAnchorStore((s) => s.isFollowed(anchorId));
  const toggleFollow = useAnchorStore((s) => s.toggleFollow);
  const [giftPanelOpen, setGiftPanelOpen] = useState(false);
  const [inputText, setInputText] = useState('');
  const [fullscreenFx, setFullscreenFx] = useState<FullscreenGiftEffectItem[]>([]);
  const [floatItems, setFloatItems] = useState<FloatingGiftItem[]>([]);
  const [giftFeedItems, setGiftFeedItems] = useState<GiftFeedItem[]>([]);
  const [subtitle, setSubtitle] = useState<{ id: string; text: string } | null>(null);

  const [callPhase, setCallPhase] = useState<CallPhase>('idle');
  const [callSeconds, setCallSeconds] = useState(0);
  const [callInput, setCallInput] = useState('');
  const [callSubtitle, setCallSubtitle] = useState<{ id: string; text: string } | null>(null);
  const [boardCollapsed, setBoardCollapsed] = useState(false);

  const historyRef = useRef<ChatMsg[]>([]);
  const danmuRef = useRef<DanmuItem[]>([]);
  const enteredRef = useRef(false);
  const subtitleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    danmuRef.current = danmuList;
  }, [danmuList]);

  const getLiveContext = () =>
    formatLiveRoomContext(danmuRef.current, { playerName: playerName || '姐姐' });

  const pushHistory = (role: ChatMsg['role'], content: string) => {
    historyRef.current = [...historyRef.current, { role, content }].slice(-12);
  };

  const showAnchorSpeech = (text: string) => {
    if (!text || !anchor) return;
    const id = `sub_${Date.now()}`;
    setSubtitle({ id, text });
    pushDanmu({ type: 'anchor', content: text, sender: anchor.stageName });
    pushAnchorSpeechReaction(text);
    if (subtitleTimerRef.current) clearTimeout(subtitleTimerRef.current);
    subtitleTimerRef.current = setTimeout(() => {
      setSubtitle((cur) => (cur?.id === id ? null : cur));
    }, 7000);
  };

  const anchorIsTyping = isLoading(anchorId);
  const { bumpPlayerAction } = useAnchorPeriodicSpeech({
    anchorId,
    active: !!anchor && isActiveAiMode(),
    paused: callPhase !== 'idle' || anchorIsTyping,
    getLiveContext,
    getHistory: () => historyRef.current,
    onSpeech: showAnchorSpeech,
    onHistory: (text) => pushHistory('assistant', text),
    generateAnchorReply,
  });

  const pushGiftFeed = (item: GiftFeedItem) => {
    setGiftFeedItems((prev) => [...prev, item]);
  };

  useNpcGifts(!!anchor, (item) => {
    pushGiftFeed(item);
    pushDanmu({
      type: 'gift',
      content: `送出了虚拟礼物 ${item.giftIcon} ${item.giftName}`,
      sender: item.sender,
      giftName: item.giftName,
      giftCount: 1,
      giftKind: 'virtual',
    });
  });

  useEffect(() => {
    if (!anchor || !isOnline) return;
    ensureLiveSession(anchorId);
    useAnchorStore.getState().markInteract(anchorId);

    if (!enteredRef.current) {
      enteredRef.current = true;
      const prevAnchorId = usePlayerStore.getState().currentLiveAnchorId;
      if (prevAnchorId && prevAnchorId !== anchorId) {
        void triggerJealousy(anchorId, generateAnchorReply);
      }
      setCurrentLiveAnchor(anchorId);

      if (isActiveAiMode()) {
        (async () => {
          bumpPlayerAction();
          const activity = useAnchorStore.getState().getRuntime(anchorId).activity;
          const customWelcome = anchor.presets?.welcomeLines;
          const welcomeHint =
            customWelcome && customWelcome.length > 0
              ? `，可参考这些欢迎语风格：${customWelcome.join(' / ')}`
              : '';
          const reply = await generateAnchorReply({
            anchorId,
            scene: '直播间互动',
            userMessage: `（系统事件：观众刚刚进入了你的直播间，请你主动打招呼欢迎她${
              activity ? `，可以提一下你正在${activity.label}` : ''
            }${welcomeHint}。）`,
            liveContext: getLiveContext(),
          });
          showAnchorSpeech(reply);
          pushHistory('assistant', reply);
        })();
      }
    }
    return () => {
      if (subtitleTimerRef.current) clearTimeout(subtitleTimerRef.current);
      if (callTimerRef.current) clearInterval(callTimerRef.current);
      const highlights = extractLiveHighlights(danmuRef.current, playerName || '姐姐');
      if (highlights.length >= 2) {
        useSocialStore.getState().addLiveRecap(anchorId, highlights, playerName || '姐姐');
      }
      usePlayerStore.getState().setCurrentLiveAnchor(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchorId]);

  if (!anchor || !runtime) {
    return <div className="flex h-full items-center justify-center bg-[#0c0614] text-[#9b8fb0]">主播不存在</div>;
  }

  if (!isOnline) {
    const clock = useGameTimeStore.getState().getClock();
    return (
      <div className="flex h-full min-h-0 flex-col bg-[#0c0614]">
        <StatusBar />
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#1e1030] text-2xl text-[#9b8fb0]">
            ◯
          </div>
          <p className="text-[17px] font-extrabold text-[#f3eef9]">{anchor.stageName} 暂未开播</p>
          <p className="text-[14px] leading-5 text-[#9b8fb0]">{getTodayScheduleDetail(anchorId, clock)}</p>
          <button
            type="button"
            onClick={back}
            className="mt-2 rounded-full bg-[#9b5cff] px-8 py-2.5 text-[14px] font-bold text-white active:scale-95"
          >
            返回
          </button>
        </div>
      </div>
    );
  }

  const handle = `@${anchor.realName.replace(/\s+/g, '').toLowerCase()}`;

  const sendDanmu = async () => {
    const text = inputText.trim();
    if (!text) return;
    bumpPlayerAction();
    setInputText('');
    pushDanmu({ type: 'player', content: text, sender: playerName || '你' });
    pushPlayerChatReaction(text);
    markInteract(anchorId);

    const activityInstruction = parseActivityInstruction(text);
    if (activityInstruction) {
      setActivity(anchorId, activityInstruction);
      pushDanmu({
        type: 'system',
        content: `${anchor.stageName} 开始${activityInstruction.label.replace(/^正在|^在/, '')}了～`,
      });
      pushActivityChangeReaction(activityInstruction.label);
    }

    const priorHistory = historyRef.current;
    pushHistory('user', text);

    const activityHint = activityInstruction
      ? `（系统：观众刚刚指令你改为${activityInstruction.label}，请自然回应并表现出愿意配合。）`
      : '';

    const reply = await generateAnchorReply({
      anchorId,
      scene: '直播间互动',
      userMessage: activityHint ? `${text}\n${activityHint}` : text,
      history: priorHistory,
      liveContext: getLiveContext(),
    });
    showAnchorSpeech(reply);
    pushHistory('assistant', reply);
  };

  const sendGift = async (gift: Gift) => {
    if (!(await pay(gift.price))) return;
    setGiftPanelOpen(false);
    bumpPlayerAction();
    ensureLiveSession(anchorId);
    const wasTop1 = isTop1Fn(anchorId);

    pushDanmu({
      type: 'gift',
      content: `送出了虚拟礼物 ${gift.icon} ${gift.name} x1`,
      sender: playerName || '你',
      giftName: gift.name,
      giftCount: 1,
      giftKind: 'virtual',
    });
    pushGiftReaction(gift.name, playerName || '你');
    pushGiftFeed({
      id: `player_gift_${Date.now()}`,
      sender: playerName || '你',
      giftIcon: gift.icon,
      giftName: gift.name,
      count: 1,
      isPlayer: true,
    });
    addSpend(anchorId, gift.price);
    addSpendRecord({ anchorId, giftId: gift.id, giftName: gift.name, price: gift.price });
    markInteract(anchorId);

    if (gift.isBig) {
      const fxId = `fx_${Date.now()}`;
      setFullscreenFx((prev) => [
        ...prev,
        {
          id: fxId,
          icon: gift.icon,
          giftName: gift.name,
          senderName: playerName || '你',
          targetName: anchor.stageName,
        },
      ]);
    } else {
      const floatId = `float_${Date.now()}_${Math.random()}`;
      setFloatItems((prev) => [...prev, { id: floatId, icon: gift.icon }]);
    }

    const nowTop1 = isTop1Fn(anchorId);
    const becameTop1 = !wasTop1 && nowTop1;

    if (gift.isBig || gift.price >= 520) {
      useSocialStore.getState().addLiveMoment(
        anchorId,
        `${playerName || '姐姐'}在直播间送了虚拟礼物「${gift.name}」`,
        playerName || '姐姐'
      );
    }

    const tipHint =
      anchor.presets?.tipLines?.length
        ? `可参考求赏话术：${anchor.presets.tipLines.join(' / ')}。`
        : '';

    const reply = await generateAnchorReply({
      anchorId,
      scene: '直播间互动',
      userMessage: `（系统事件：观众刚刚在直播间送出了【虚拟礼物】${gift.name}，价值${gift.price}虚拟币（不是实体快递/淘淘购/美团实物，只影响榜单和特效）。${
        becameTop1 ? '观众因此成为了你的榜一女王！' : ''
      }${tipHint}请你对此表现出感谢和开心${gift.isBig ? '，并且要非常夸张地感谢，这是大礼物' : ''}，感谢时不要说收到实物、快递或拆包裹，并承接刚才公屏上下文。）`,
      history: historyRef.current.slice(-8),
      liveContext: getLiveContext(),
    });
    showAnchorSpeech(reply);
    pushHistory('assistant', reply);
  };

  const startCall = () => {
    if (callPhase !== 'idle') return;
    setCallPhase('connecting');
    markInteract(anchorId);
    setTimeout(async () => {
      setCallPhase('active');
      setCallSeconds(0);
      callTimerRef.current = setInterval(() => setCallSeconds((s) => s + 1), 1000);
      const reply = await generateAnchorReply({
        anchorId,
        scene: '连麦',
        userMessage: '（系统事件：你和观众刚刚视频连麦接通了，你能实时看到她的画面。请你热情地打招呼，表现出害羞或开心，不超过50字。）',
        history: historyRef.current.slice(-4),
      });
      setCallSubtitle({ id: `call_${Date.now()}`, text: reply });
      pushHistory('assistant', reply);
    }, 1600);
  };

  const sendCallMessage = async () => {
    const text = callInput.trim();
    if (!text) return;
    setCallInput('');
    markInteract(anchorId);
    pushHistory('user', text);
    const reply = await generateAnchorReply({
      anchorId,
      scene: '连麦',
      userMessage: text,
      history: historyRef.current.slice(-8),
    });
    setCallSubtitle({ id: `call_${Date.now()}_${Math.random()}`, text: reply });
    pushHistory('assistant', reply);
  };

  const endCall = () => {
    if (callTimerRef.current) clearInterval(callTimerRef.current);
    callTimerRef.current = null;
    const bonus = Math.min(8, Math.max(2, Math.floor(callSeconds / 12)));
    boostFavor(anchorId, bonus);
    setCallPhase('idle');
    setCallSubtitle(null);
    setCallSeconds(0);
    (async () => {
      const reply = await generateAnchorReply({
        anchorId,
        scene: '私聊',
        userMessage: '（系统事件：视频连麦刚刚结束了，请你表现出意犹未尽、不舍得挂断的感觉，发一句依依不舍的话，不超过40字。）',
      });
      useChatStore.getState().addMessage(anchorId, 'anchor', reply);
    })();
  };

  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden bg-[#1e1030]">
      {/* 角色立绘：全屏填充背景 */}
      <div className="pointer-events-none absolute inset-0">
        <AnchorImage anchor={anchor} fit="cover" className="h-full w-full" />
      </div>

      <div className="relative z-10 flex h-full min-h-0 flex-col">
        <StatusBar />

        {/* 顶部信息 + 连麦/PK：叠在立绘上方，半透明白渐变 */}
        <div className="shrink-0 bg-gradient-to-b from-[#0c0614]/95 via-[#160b24]/75 to-transparent px-2 pb-3 pt-1">
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
            <button
              type="button"
              onClick={() => push('anchorProfile', { anchorId })}
              className="shrink-0"
            >
              <Avatar {...anchorAvatarProps(anchor)} size={36} ring={isTop1} />
            </button>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="rounded-sm bg-[#f4212e] px-1.5 py-0.5 text-[10px] font-extrabold tracking-wide text-white">
                  LIVE
                </span>
                <p className="truncate text-[14px] font-extrabold text-[#f3eef9]">{anchor.stageName}</p>
              </div>
              <p className="truncate text-[11px] text-[#9b8fb0]">
                {handle} · {formatViewers(runtime.currentViewers)} 观看 · 好感{Math.floor(runtime.favor)}
                {isTop1 ? ' · 榜一' : ''}
              </p>
              {runtime.activity && (
                <p className="truncate text-[11px] text-[#9b5cff]">
                  {runtime.activity.icon} {runtime.activity.label}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => toggleFollow(anchorId)}
              className={`shrink-0 rounded-full px-2.5 py-1 text-[12px] font-bold transition active:scale-95 ${
                isFollowed
                  ? 'border border-[#3d2a55] bg-[#0c0614]/70 text-[#f3eef9]'
                  : 'bg-[#0c0614] text-white'
              }`}
            >
              {isFollowed ? '正在关注' : '关注'}
            </button>
          </div>

          <div className="mt-2 flex items-center gap-2 px-1">
            <button
              type="button"
              onClick={startCall}
              disabled={callPhase !== 'idle'}
              className="rounded-full border border-[#3d2a55] bg-[#0c0614]/75 px-3 py-1 text-[12px] font-bold text-[#f3eef9] disabled:opacity-40"
            >
              连麦
            </button>
            <button
              type="button"
              onClick={() => {
                const othersLive = getLiveAnchorIds().filter((id) => id !== anchorId);
                if (othersLive.length === 0) {
                  useToastStore.getState().show('暂无其他直播中主播可进行 PK');
                  return;
                }
                push('pkRoom', { seedAnchorId: anchorId });
              }}
              disabled={callPhase !== 'idle'}
              className="rounded-full border border-[#3d2a55] bg-[#0c0614]/75 px-3 py-1 text-[12px] font-bold text-[#f3eef9] disabled:opacity-40"
            >
              PK
            </button>
            <p className="min-w-0 flex-1 truncate text-[12px] text-[#9b8fb0]">
              {anchor.tag}
              {anchor.isHuman === false ? ` · ${anchor.species}` : ''}
            </p>
          </div>
        </div>

        {/* 中部留白看立绘：口播 + 贡献榜 + 礼物条 */}
        <div className="relative min-h-0 flex-1">
          <div className="absolute left-2 top-1 z-10">
            <GiftFeedStrip items={giftFeedItems} />
          </div>
          <div
            className={`absolute z-20 transition-all duration-200 ${
              boardCollapsed ? 'right-0 top-6' : 'right-3 top-1'
            }`}
          >
            <Leaderboard
              playerScore={liveSessionPlayerSpent}
              rivals={liveSessionRivals}
              collapsed={boardCollapsed}
              onToggle={() => setBoardCollapsed((v) => !v)}
            />
          </div>
          <div className="absolute inset-x-3 bottom-2 z-10">
            <SubtitleBubble
              id={subtitle?.id ?? null}
              text={subtitle?.text ?? null}
              anchorName={anchor.stageName}
            />
            {anchorIsTyping && !subtitle && (
              <p className="rounded-full bg-[#0c0614]/80 px-3 py-1 text-center text-[12px] text-white/80 backdrop-blur-sm">
                {anchor.stageName} 正在说话…
              </p>
            )}
          </div>
        </div>

        {/* 弹幕区：固定高度，叠在立绘下半部，半透明白渐变，黑字 */}
        <div className="flex h-44 shrink-0 flex-col bg-gradient-to-t from-[#0c0614] via-[#0c0614]/92 to-[#160b24]/55 backdrop-blur-[2px]">
          <div className="min-h-0 flex-1">
            <DanmuList
              list={danmuList.filter((d) => d.type !== 'anchor')}
              anchorTyping={false}
              anchorName={anchor.stageName}
              variant="overlay"
            />
          </div>
        </div>

        {/* 底部输入 */}
        <div className="flex shrink-0 items-center gap-2 border-t border-[#3d2a55] bg-[#0c0614]/95 px-3 py-2.5 backdrop-blur-sm">
          <input
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendDanmu()}
            placeholder={
              runtime.activity
                ? `他正在${runtime.activity.label}，说点什么…`
                : '发一条互动…'
            }
            className="flex-1 rounded-full border border-[#3d2a55] bg-[#1e1030] px-4 py-2 text-[14px] text-[#f3eef9] placeholder:text-[#9b8fb0] outline-none focus:border-[#9b5cff] focus:bg-[#160b24]"
          />
          <button
            type="button"
            onClick={sendDanmu}
            disabled={!inputText.trim()}
            className="rounded-full bg-[#9b5cff] px-3.5 py-2 text-[13px] font-bold text-white disabled:opacity-40 active:scale-95"
          >
            发送
          </button>
          <button
            type="button"
            onClick={() => setGiftPanelOpen(true)}
            className="rounded-full bg-[#7c3aed] px-3.5 py-2 text-[13px] font-bold text-white active:scale-95"
          >
            礼物
          </button>
        </div>
      </div>

      <GiftPanel open={giftPanelOpen} onClose={() => setGiftPanelOpen(false)} onSelect={sendGift} />
      <FloatingGift items={floatItems} onDone={(id) => setFloatItems((prev) => prev.filter((i) => i.id !== id))} />
      <FullscreenGiftEffect
        effects={fullscreenFx}
        onDone={(id) => setFullscreenFx((prev) => prev.filter((i) => i.id !== id))}
      />

      <LinkMicOverlay
        open={callPhase !== 'idle'}
        phase={callPhase === 'idle' ? 'connecting' : callPhase}
        anchor={anchor}
        playerName={playerName}
        callSeconds={callSeconds}
        subtitle={callSubtitle}
        anchorTyping={isLoading(anchorId)}
        input={callInput}
        onInputChange={setCallInput}
        onSend={sendCallMessage}
        onHangup={endCall}
      />
    </div>
  );
}

function formatViewers(n: number) {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}万`;
  return `${n}`;
}
