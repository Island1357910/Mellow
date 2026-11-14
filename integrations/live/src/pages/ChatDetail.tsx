import { pay } from '../utils/mellowHost';
import { useCallback, useEffect, useRef, useState } from 'react';
import StatusBar from '../components/Phone/StatusBar';
import ScreenHeader from '../components/Common/ScreenHeader';
import Avatar from '../components/Common/Avatar';
import { anchorAvatarProps } from '../components/Common/AnchorImage';
import Loading from '../components/Common/Loading';
import { ChatBubble } from '../components/Chat/ChatBubble';
import { RedPacketSheet, VoiceSheet, ImageSheet } from '../components/Chat/ChatExtras';
import ChatExtraPanel, { type ChatExtraAction } from '../components/Chat/ChatExtraPanel';
import ChatBackgroundSheet from '../components/Chat/ChatBackgroundSheet';
import { VoiceCallOverlay, VideoCallOverlay } from '../components/Chat/CallOverlays';
import { resolveChatBackground } from '../data/chatAppearance';
import { getAnchorById } from '../data/anchors';
import { chatMessageToAiText, CHAT_AI_HISTORY_LIMIT, useChatStore } from '../stores/useChatStore';
import { useAnchorStore } from '../stores/useAnchorStore';
import { usePlayerStore } from '../stores/usePlayerStore';
import { useNavStore } from '../stores/useNavStore';
import { useSettingsStore } from '../stores/useSettingsStore';
import { useAI } from '../hooks/useAI';
import type { ChatMessage } from '../types';

type ExtraSheet = 'redpacket' | 'voice' | 'image' | null;
type CallMode = 'voice' | 'video' | null;

export default function ChatDetail({ anchorId }: { anchorId: string }) {
  const anchor = getAnchorById(anchorId);
  const back = useNavStore((s) => s.back);
  const messages = useChatStore((s) => s.getMessages(anchorId));
  const markRead = useChatStore((s) => s.markRead);
  const addMessage = useChatStore((s) => s.addMessage);
  const runtime = useAnchorStore((s) => s.runtime[anchorId]);
  const markInteract = useAnchorStore((s) => s.markInteract);
  const addSpend = useAnchorStore((s) => s.addSpend);
  const chatBackground = useSettingsStore((s) => s.chatBackgrounds[anchorId]);
  const { generateAnchorReply, isLoading } = useAI();

  const [input, setInput] = useState('');
  const [toolsOpen, setToolsOpen] = useState(false);
  const [extraSheet, setExtraSheet] = useState<ExtraSheet>(null);
  const [bgSheetOpen, setBgSheetOpen] = useState(false);
  const [callMode, setCallMode] = useState<CallMode>(null);
  const [callStatus, setCallStatus] = useState<string | undefined>();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    useChatStore.getState().markRead(anchorId);
  }, [anchorId]);

  const anchorIsTyping = isLoading(anchorId);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, anchorIsTyping, toolsOpen]);

  const handleBack = () => {
    markRead(anchorId);
    back();
  };

  const buildHistory = useCallback(
    (list: ChatMessage[]) =>
      list.slice(-CHAT_AI_HISTORY_LIMIT).map((m) => ({
        role: (m.role === 'anchor' ? 'assistant' : 'user') as 'assistant' | 'user',
        content: chatMessageToAiText(m),
      })),
    []
  );

  const requestAnchorReply = useCallback(
    async (userMessage: string, priorMessages: ChatMessage[], scene: '私聊' | '语音电话' | '视频电话' = '私聊') => {
      const reply = await generateAnchorReply({
        anchorId,
        scene,
        userMessage,
        history: buildHistory(priorMessages),
      });
      if (scene === '私聊') {
        addMessage(anchorId, 'anchor', reply);
      }
      return reply;
    },
    [anchorId, addMessage, buildHistory, generateAnchorReply]
  );

  if (!anchor) {
    return <div className="flex h-full items-center justify-center bg-white text-slate-400">主播不存在</div>;
  }

  const bgStyle = resolveChatBackground(chatBackground);

  const afterPlayerSend = () => {
    markInteract(anchorId);
    useAnchorStore.getState().clearUnansweredFollowUp(anchorId);
  };

  const sendText = async () => {
    const text = input.trim();
    if (!text) return;
    setInput('');
    addMessage(anchorId, 'player', text);
    afterPlayerSend();
    await requestAnchorReply(text, messages);
  };

  const sendRedPacket = async (amount: number, blessing: string) => {
    if (!(await pay(amount))) return;
    addMessage(anchorId, 'player', blessing, {
      kind: 'redpacket',
      redPacketAmount: amount,
    });
    addSpend(anchorId, amount);
    usePlayerStore.getState().addSpendRecord({
      anchorId,
      giftId: 'redpacket',
      giftName: `私信红包「${blessing}」`,
      price: amount,
    });
    afterPlayerSend();

    const prior = [...messages];
    await requestAnchorReply(
      `（系统事件：观众在私信给你发了虚拟红包${amount}虚拟币，祝福语：${blessing}。请表达惊喜和感谢，可以撒娇。）`,
      prior
    );
  };

  const sendVoice = async (text: string) => {
    addMessage(anchorId, 'player', text, { kind: 'voice', voiceText: text });
    afterPlayerSend();
    await requestAnchorReply(
      `（系统事件：观众在私信给你发了一条语音消息，转文字内容：${text}。请针对语音内容自然回复。）`,
      messages
    );
  };

  const sendImage = async (desc: string) => {
    addMessage(anchorId, 'player', desc, { kind: 'image', imageDesc: desc });
    afterPlayerSend();
    await requestAnchorReply(
      `（系统事件：观众在私信给你发了一张图片，图片描述：${desc}。请根据描述想象画面并自然回应，可以夸她。）`,
      messages
    );
  };

  const startCall = async (mode: 'voice' | 'video') => {
    setToolsOpen(false);
    setCallMode(mode);
    setCallStatus('正在接通…');
    const scene = mode === 'voice' ? '语音电话' : '视频电话';
    const label = mode === 'voice' ? '语音电话' : '视频电话';
    addMessage(anchorId, 'player', `[发起${label}]`);
    afterPlayerSend();

    const reply = await requestAnchorReply(
      `（系统事件：观众向你发起了${label}，请像真的接通了一样打招呼，语气亲密自然。）`,
      messages,
      scene
    );
    setCallStatus(reply || `${anchor.stageName}正在通话中`);
  };

  const endCall = async () => {
    const mode = callMode;
    setCallMode(null);
    setCallStatus(undefined);
    if (!mode) return;
    const label = mode === 'voice' ? '语音电话' : '视频电话';
    addMessage(anchorId, 'player', `[结束${label}]`);
    await requestAnchorReply(
      `（系统事件：观众挂断了${label}。请简短表达不舍或约定下次再聊。）`,
      messages,
      mode === 'voice' ? '语音电话' : '视频电话'
    ).then((reply) => {
      if (reply) addMessage(anchorId, 'anchor', reply);
    });
  };

  const handleExtraSelect = (action: ChatExtraAction) => {
    setToolsOpen(false);
    if (action === 'voice_call') {
      void startCall('voice');
      return;
    }
    if (action === 'video_call') {
      void startCall('video');
      return;
    }
    setExtraSheet(action);
  };

  const isNightBg = chatBackground === 'night';

  return (
    <div
      className="relative flex h-full min-h-0 flex-col bg-white"
      style={bgStyle}
    >
      <StatusBar />
      <ScreenHeader
        title={anchor.stageName}
        onBack={handleBack}
        right={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setBgSheetOpen(true)}
              className="text-[10px] text-sky-500"
            >
              背景
            </button>
            <span className={`text-[10px] ${isNightBg ? 'text-pink-200' : 'text-pink-400'}`}>
              {runtime ? `好感${Math.floor(runtime.favor)}` : ''}
            </span>
          </div>
        }
      />

      <div className="no-scrollbar min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3">
        {messages.length === 0 && (
          <div className="mt-8 flex flex-col items-center gap-3 px-6 text-center">
            <Avatar {...anchorAvatarProps(anchor)} size={64} />
            <p className={`text-sm font-semibold ${isNightBg ? 'text-white/90' : 'text-slate-700'}`}>
              {anchor.stageName}
            </p>
            <p className={`text-xs leading-relaxed ${isNightBg ? 'text-white/55' : 'text-slate-500'}`}>
              {runtime && runtime.favor > 0
                ? `好感度 ${Math.floor(runtime.favor)} · 发一条消息开始聊天吧`
                : '聊天记录将显示在这里'}
            </p>
          </div>
        )}
        {messages.map((m) => (
          <ChatBubble key={m.id} anchor={anchor} message={m} />
        ))}
        {anchorIsTyping && !callMode && (
          <div className="flex items-center gap-2">
            <Avatar {...anchorAvatarProps(anchor)} size={30} />
            <div className="rounded-2xl rounded-tl-sm bg-white/90 px-3 py-2 shadow-sm">
              <Loading small text="正在输入" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="shrink-0 border-t border-blue-100/80 bg-white/90 backdrop-blur-sm">
        <ChatExtraPanel open={toolsOpen} onSelect={handleExtraSelect} />
        <div className="flex items-center gap-2 px-3 pb-2">
          <button
            type="button"
            onClick={() => setToolsOpen((v) => !v)}
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-lg transition-transform ${
              toolsOpen
                ? 'rotate-45 border-sky-200 bg-sky-50 text-sky-500'
                : 'border-slate-200 bg-slate-50 text-slate-500'
            }`}
            aria-label={toolsOpen ? '收起功能' : '展开功能'}
          >
            +
          </button>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void sendText()}
            onFocus={() => setToolsOpen(false)}
            placeholder="回复一下他吧..."
            className="flex-1 rounded-full border border-blue-100 bg-white px-4 py-2 text-[13px] text-slate-700 placeholder:text-slate-300 outline-none"
          />
          <button
            type="button"
            onClick={() => void sendText()}
            className="rounded-full bg-[#1d9bf0] px-4 py-2 text-[12px] font-bold text-white active:scale-95"
          >
            发送
          </button>
        </div>
      </div>

      <RedPacketSheet
        open={extraSheet === 'redpacket'}
        onClose={() => setExtraSheet(null)}
        onSend={(amount, blessing) => void sendRedPacket(amount, blessing)}
      />
      <VoiceSheet
        open={extraSheet === 'voice'}
        onClose={() => setExtraSheet(null)}
        onSend={(text) => void sendVoice(text)}
      />
      <ImageSheet
        open={extraSheet === 'image'}
        onClose={() => setExtraSheet(null)}
        onSend={(desc) => void sendImage(desc)}
      />
      <ChatBackgroundSheet anchorId={anchorId} open={bgSheetOpen} onClose={() => setBgSheetOpen(false)} />

      {callMode === 'voice' && (
        <VoiceCallOverlay anchor={anchor} statusLine={callStatus} onEnd={() => void endCall()} />
      )}
      {callMode === 'video' && (
        <VideoCallOverlay anchor={anchor} statusLine={callStatus} onEnd={() => void endCall()} />
      )}
    </div>
  );
}
