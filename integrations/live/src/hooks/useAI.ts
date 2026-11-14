import { useCallback, useRef, useState } from 'react';
import { chatWithAnchor, buildAnchorSystemPrompt, sanitizePrivateChatReply, type ChatMsg } from '../utils/ai';
import { getAnchorById } from '../data/anchors';
import { useAnchorStore } from '../stores/useAnchorStore';
import { usePlayerStore } from '../stores/usePlayerStore';
import { getPlayerPersona } from '../stores/useSettingsStore';
import { useMomentsStore } from '../stores/useMomentsStore';

type AIScene = '直播间互动' | '私聊' | 'PK' | '连麦' | '朋友圈' | '语音电话' | '视频电话';

interface GenerateOptions {
  anchorId: string;
  scene: AIScene;
  userMessage: string;
  history?: ChatMsg[];
  liveContext?: string;
  pkContext?: {
    opponentName: string;
    opponentSpecies?: string;
    myScore: number;
    opponentScore: number;
    squadMode?: boolean;
    discussionTopic?: string;
    peerNames?: string[];
    scoreBoard?: string;
  };
}

/** 统一的AI主播回复调用hook，管理各主播的loading状态 */
export function useAI() {
  const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({});
  const requestSeq = useRef(0);

  const generateAnchorReply = useCallback(async (opts: GenerateOptions): Promise<string> => {
    const { anchorId, scene, userMessage, history = [], liveContext, pkContext } = opts;
    const anchor = getAnchorById(anchorId);
    if (!anchor) return '';

    const runtime = useAnchorStore.getState().getRuntime(anchorId);
    const isTop1 = useAnchorStore.getState().isTop1(anchorId);
    const playerName = usePlayerStore.getState().playerName || '姐姐';

    const systemPrompt = buildAnchorSystemPrompt({
      anchor,
      favor: runtime.favor,
      playerName,
      playerPersona: getPlayerPersona(),
      isTop1,
      totalSpent: runtime.totalSpent,
      scene,
      activityLabel: runtime.activity?.label,
      liveContext,
      pkContext,
    });

    setLoadingMap((prev) => ({ ...prev, [anchorId]: true }));
    try {
      const reply = await chatWithAnchor(
        systemPrompt,
        [...history, { role: 'user', content: userMessage }],
        { temperature: scene === '私聊' || scene === '朋友圈' ? 0.75 : 0.85 }
      );
      const sanitized =
        scene === '私聊' || scene === '语音电话' || scene === '视频电话'
          ? sanitizePrivateChatReply(reply)
          : reply;
      return sanitized;
    } finally {
      setLoadingMap((prev) => ({ ...prev, [anchorId]: false }));
    }
  }, []);

  const isLoading = useCallback((anchorId: string) => !!loadingMap[anchorId], [loadingMap]);

  return { generateAnchorReply, isLoading, requestSeq };
}

/** 玩家发朋友圈后，高好感主播评论/点赞 */
export async function reactAnchorsToPlayerMoment(
  postId: string,
  postContent: string,
  generateAnchorReply: (opts: GenerateOptions) => Promise<string>
) {
  const runtime = useAnchorStore.getState().runtime;
  const playerName = usePlayerStore.getState().playerName || '姐姐';

  const candidates = Object.values(runtime)
    .filter((r) => r.favor >= 35)
    .sort((a, b) => b.favor - a.favor)
    .slice(0, 3);

  for (const r of candidates) {
    if (Math.random() > 0.7) {
      useMomentsStore.getState().toggleLike(postId, r.id);
    }

    const reply = await generateAnchorReply({
      anchorId: r.id,
      scene: '朋友圈',
      userMessage: `（系统：${playerName}在朋友圈发了动态：「${postContent}」。请以主播身份在评论区回复，可以撒娇、关心或暗自争宠，不超过40字。）`,
    });

    if (reply.trim()) {
      useMomentsStore.getState().addAnchorComment(postId, r.id, reply.trim());
    }
  }
}
