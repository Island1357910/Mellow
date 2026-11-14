import { useCallback, useEffect, useRef, useState } from 'react';
import type { DanmuItem } from '../types';
import { FAKE_NICKNAMES, randomFrom } from '../data/fakeDanmu';
import { generateFakeDanmu, genDanmuId } from '../utils/simulator';
import { generateAudienceDanmu } from '../utils/ai';
import { isActiveAiMode } from '../utils/aiMode';

const MAX_DANMU = 60;

export interface DanmuContext {
  anchorStageName: string;
  playerName: string;
  isPlayerTop1: boolean;
  activityLabel?: string;
}

type InteractionEventType = 'player_chat' | 'anchor_speech' | 'gift' | 'activity_change';

interface PendingInteraction {
  eventType: InteractionEventType;
  summary: string;
  playerMessage?: string;
  anchorSpeech?: string;
  giftName?: string;
  activityLabel?: string;
}

const WELCOME_DANMU: DanmuItem = {
  id: 'system_welcome',
  type: 'system',
  content: '欢迎来到直播间，文明观看，理性消费~',
};

/** 管理直播间弹幕列表，并实时 AI 生成 + 本地兜底注入模拟观众弹幕 */
export function useDanmu(active: boolean, context: DanmuContext) {
  const [list, setList] = useState<DanmuItem[]>([WELCOME_DANMU]);
  const ctxRef = useRef(context);
  ctxRef.current = context;
  const pendingInteractionRef = useRef<PendingInteraction | null>(null);
  const aiBusyRef = useRef(false);

  const push = useCallback((item: Omit<DanmuItem, 'id'> & { id?: string }) => {
    setList((prev) => [...prev.slice(-(MAX_DANMU - 1)), { ...item, id: item.id ?? genDanmuId() }]);
  }, []);

  const pushAudience = useCallback(
    (content: string) => {
      push({
        type: 'audience',
        content,
        sender: randomFrom(FAKE_NICKNAMES),
      });
    },
    [push]
  );

  const buildAudienceCtx = useCallback(
    (interaction?: PendingInteraction) => {
      const ctx = ctxRef.current;
      return {
        anchorStageName: ctx.anchorStageName,
        activityLabel: interaction?.activityLabel ?? ctx.activityLabel,
        playerName: ctx.playerName,
        isPlayerTop1: ctx.isPlayerTop1,
        recentEvent: interaction?.summary,
        eventType: interaction?.eventType ?? 'idle',
        playerMessage: interaction?.playerMessage,
        anchorSpeech: interaction?.anchorSpeech,
        giftName: interaction?.giftName,
      } as const;
    },
    []
  );

  const emitInteractionReaction = useCallback(
    async (interaction: PendingInteraction) => {
      const ctx = buildAudienceCtx(interaction);
      if (isActiveAiMode() && !aiBusyRef.current) {
        aiBusyRef.current = true;
        try {
          const aiText = await generateAudienceDanmu(ctx);
          if (aiText) {
            pushAudience(aiText);
            pendingInteractionRef.current = null;
            return;
          }
        } finally {
          aiBusyRef.current = false;
        }
      }
      push(
        generateFakeDanmu(ctx.isPlayerTop1, ctx.activityLabel, {
          eventType: interaction.eventType,
          playerMessage: interaction.playerMessage,
          anchorSpeech: interaction.anchorSpeech,
          giftName: interaction.giftName,
          playerName: ctx.playerName,
          activityLabel: interaction.activityLabel,
        })
      );
      pendingInteractionRef.current = null;
    },
    [buildAudienceCtx, push, pushAudience]
  );

  const scheduleInteractionReactions = useCallback(
    (interaction: PendingInteraction, count = 1) => {
      pendingInteractionRef.current = interaction;
      for (let i = 0; i < count; i += 1) {
        setTimeout(() => {
          void emitInteractionReaction(interaction);
        }, 450 + i * 650 + Math.random() * 500);
      }
    },
    [emitInteractionReaction]
  );

  const emitOneDanmu = useCallback(async () => {
    const pending = pendingInteractionRef.current;
    if (pending) {
      await emitInteractionReaction(pending);
      return;
    }

    const ctx = buildAudienceCtx();
    if (isActiveAiMode() && !aiBusyRef.current) {
      aiBusyRef.current = true;
      try {
        const aiText = await generateAudienceDanmu(ctx);
        if (aiText) {
          pushAudience(aiText);
          return;
        }
      } finally {
        aiBusyRef.current = false;
      }
    }
    push(generateFakeDanmu(ctx.isPlayerTop1, ctx.activityLabel));
  }, [buildAudienceCtx, emitInteractionReaction, push, pushAudience]);

  useEffect(() => {
    if (!active) return;

    let cancelled = false;
    let timerId: ReturnType<typeof setTimeout>;
    const scheduleNext = () => {
      const delay = 2200 + Math.random() * 2200;
      timerId = setTimeout(async () => {
        if (cancelled) return;
        await emitOneDanmu();
        scheduleNext();
      }, delay);
    };
    scheduleNext();
    return () => {
      cancelled = true;
      clearTimeout(timerId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  /** 记录最近事件，供下一条 AI 弹幕参考（如送礼、玩家发言） */
  const noteRecentEvent = useCallback((event: string) => {
    pendingInteractionRef.current = {
      eventType: 'player_chat',
      summary: event,
    };
  }, []);

  /** 玩家公屏发言后，网友即时反应 */
  const pushPlayerChatReaction = useCallback(
    (message: string) => {
      const ctx = ctxRef.current;
      scheduleInteractionReactions(
        {
          eventType: 'player_chat',
          summary: `${ctx.playerName}刚在公屏说：「${message}」`,
          playerMessage: message,
        },
        1 + Math.floor(Math.random() * 2)
      );
    },
    [scheduleInteractionReactions]
  );

  /** 主播口播/回复后，网友即时反应 */
  const pushAnchorSpeechReaction = useCallback(
    (speech: string) => {
      const ctx = ctxRef.current;
      scheduleInteractionReactions(
        {
          eventType: 'anchor_speech',
          summary: `主播${ctx.anchorStageName}刚说：「${speech}」`,
          anchorSpeech: speech,
        },
        1 + Math.floor(Math.random() * 2)
      );
    },
    [scheduleInteractionReactions]
  );

  /** 主播切换活动后，网友评论 */
  const pushActivityChangeReaction = useCallback(
    (activityLabel: string) => {
      scheduleInteractionReactions(
        {
          eventType: 'activity_change',
          summary: `主播开始${activityLabel}了`,
          activityLabel,
        },
        1
      );
    },
    [scheduleInteractionReactions]
  );

  /** 送礼后延迟插入 AI/本地围观反应弹幕 */
  const pushGiftReaction = useCallback(
    (giftName: string, senderName: string) => {
      const interaction: PendingInteraction = {
        eventType: 'gift',
        summary: `${senderName}刚刚送出了虚拟礼物${giftName}，网友们正在围观`,
        giftName,
      };
      scheduleInteractionReactions(interaction, 1 + Math.floor(Math.random() * 2));
    },
    [scheduleInteractionReactions]
  );

  const clear = useCallback(() => setList([]), []);

  return {
    danmuList: list,
    pushDanmu: push,
    pushGiftReaction,
    pushPlayerChatReaction,
    pushAnchorSpeechReaction,
    pushActivityChangeReaction,
    noteRecentEvent,
    clearDanmu: clear,
  };
}
