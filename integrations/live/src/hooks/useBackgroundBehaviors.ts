import { useEffect, useRef } from 'react';
import { useAnchorStore } from '../stores/useAnchorStore';
import { useChatStore, chatMessageToAiText, CHAT_AI_HISTORY_LIMIT } from '../stores/useChatStore';
import { usePKStore } from '../stores/usePKStore';
import { getAllAnchors, getAnchorById } from '../data/anchors';
import { useSocialStore } from '../stores/useSocialStore';
import { useMomentsStore } from '../stores/useMomentsStore';
import { useGameTimeStore } from '../stores/useGameTimeStore';
import {
  canSendProactiveDm,
  gameHoursToSeconds,
  UNANSWERED_FOLLOWUP_GAME_HOURS,
} from '../utils/proactiveDm';
import { useAI } from './useAI';
import { isActiveAiMode } from '../utils/aiMode';
import { pickRandomLivePair, pickRandomLiveSquad, tryStartPK, tryStartSquadPK } from '../utils/pkMatch';

const PK_HELP_COOLDOWN = 4 * 60 * 1000;
const SPONTANEOUS_PK_MIN_GAP = 90 * 1000;
/** PK 大劣势：分差达到该值才私信求助 */
const PK_DISADVANTAGE_GAP = 30;

const PROACTIVE_DM_PROMPTS = [
  '（系统：游戏日例行私信，表达想念，试探她最近忙什么，不要迎宾套话，不超过55字。）',
  '（系统：游戏日例行私信，分享一件今日小事并希望她来看你，语气符合人设，不超过55字。）',
  '（系统：游戏日例行私信，撒娇说最近互动少了有点失落，不要重复之前说过的话，不超过55字。）',
];

const UNANSWERED_PROMPTS = [
  '（系统：你上条私信她一直没回，请再发一条，语气明显失落委屈，可以问是不是讨厌你了，不要装作没事，不超过50字。）',
  '（系统：等了很久她仍没回私信，请表达被冷落的伤心和不安，卑微一点，不超过50字。）',
];

/**
 * 全局后台模拟行为
 */
export function useBackgroundBehaviors(enabled: boolean) {
  const { generateAnchorReply } = useAI();
  const proactiveBusyRef = useRef(false);
  const followUpBusyRef = useRef(false);
  const pkHelpBusyRef = useRef(false);
  const lastPkEndRef = useRef(0);

  useEffect(() => {
    if (!enabled) return;
    useAnchorStore.getState().ensureInit();
    useSocialStore.getState().ensureInit();
    useMomentsStore.getState().ensureInit();
    useGameTimeStore.getState().ensureInit();

    const gameTimeTimer = setInterval(() => {
      useGameTimeStore.getState().tick();
    }, 1000);

    const simTimer = setInterval(() => {
      useAnchorStore.getState().tickSimulation();
    }, 4000);

    const socialTimer = setInterval(() => {
      useSocialStore.getState().tickSocial();
    }, 45000);

    const momentsTimer = setInterval(() => {
      useMomentsStore.getState().tickMoments();
    }, 60000);

    // 主动私信：按游戏日配额，约每天 2~3 次，间隔 6 游戏小时
    const proactiveTimer = setInterval(async () => {
      if (!isActiveAiMode() || proactiveBusyRef.current || Math.random() > 0.35) return;
      const clock = useGameTimeStore.getState().getClock();
      const nowSec = clock.totalSeconds;
      const runtime = useAnchorStore.getState().runtime;

      const candidates = Object.values(runtime).filter((r) => {
        if (r.favor < 15) return false;
        return canSendProactiveDm(r, clock.day, nowSec);
      });
      if (candidates.length === 0) return;

      const target = candidates[Math.floor(Math.random() * candidates.length)];
      if (!getAnchorById(target.id)) return;

      proactiveBusyRef.current = true;
      try {
        const prompt = PROACTIVE_DM_PROMPTS[Math.floor(Math.random() * PROACTIVE_DM_PROMPTS.length)];
        const history = (useChatStore.getState().messages[target.id] ?? [])
          .slice(-CHAT_AI_HISTORY_LIMIT)
          .map((m) => ({
            role: (m.role === 'anchor' ? 'assistant' : 'user') as 'assistant' | 'user',
            content: chatMessageToAiText(m),
          }));
        const reply = await generateAnchorReply({
          anchorId: target.id,
          scene: '私聊',
          userMessage: prompt,
          history,
        });
        useChatStore.getState().addMessage(target.id, 'anchor', reply);
        useAnchorStore.getState().recordProactiveDm(target.id);
      } finally {
        proactiveBusyRef.current = false;
      }
    }, 90 * 1000);

    // 玩家未回复主播私信 → 失落 follow-up（按游戏时间）
    const followUpTimer = setInterval(async () => {
      if (!isActiveAiMode() || followUpBusyRef.current) return;
      const gap = gameHoursToSeconds(UNANSWERED_FOLLOWUP_GAME_HOURS);
      const messages = useChatStore.getState().messages;
      const runtime = useAnchorStore.getState().runtime;

      for (const anchor of getAllAnchors()) {
        const list = messages[anchor.id];
        if (!list || list.length === 0) continue;
        const last = list[list.length - 1];
        if (last.role !== 'anchor') continue;

        const r = runtime[anchor.id];
        if (!r || r.favor < 10) continue;
        if (r.unansweredFollowUpMsgId === last.id) continue;

        const elapsedGameSec = ((Date.now() - last.timestamp) / 1000) * 6;
        if (elapsedGameSec < gap) continue;

        followUpBusyRef.current = true;
        try {
          const history = list.slice(-CHAT_AI_HISTORY_LIMIT).map((m) => ({
            role: (m.role === 'anchor' ? 'assistant' : 'user') as 'assistant' | 'user',
            content: chatMessageToAiText(m),
          }));
          const prompt = UNANSWERED_PROMPTS[Math.floor(Math.random() * UNANSWERED_PROMPTS.length)];
          const reply = await generateAnchorReply({
            anchorId: anchor.id,
            scene: '私聊',
            userMessage: prompt,
            history,
          });
          useChatStore.getState().addMessage(anchor.id, 'anchor', reply);
          useAnchorStore.getState().markUnansweredFollowUp(anchor.id, last.id);
        } finally {
          followUpBusyRef.current = false;
        }
        break;
      }
    }, 120 * 1000);

    const pkTimer = setInterval(async () => {
      const state = usePKStore.getState();
      const now = Date.now();

      if (state.active) {
        if (Math.random() < 0.18) {
          if (state.mode === 'squad' && state.participants.length === 4) {
            const id = state.participants[Math.floor(Math.random() * state.participants.length)];
            usePKStore.getState().addGiftToAnchor(id, Math.floor(Math.random() * 40) + 10);
          } else {
            const side: 'A' | 'B' = Math.random() < 0.5 ? 'A' : 'B';
            usePKStore.getState().addGiftToSide(side, Math.floor(Math.random() * 40) + 10);
          }
        }

        // PK 大劣势时才私信求助（仅双人局）
        if (
          state.mode !== 'squad' &&
          isActiveAiMode() &&
          !pkHelpBusyRef.current &&
          Math.random() < 0.4
        ) {
          const sides = [
            { id: state.anchorA, my: state.scoreA, opp: state.scoreB, oppId: state.anchorB },
            { id: state.anchorB, my: state.scoreB, opp: state.scoreA, oppId: state.anchorA },
          ];
          for (const side of sides) {
            if (!side.id || !side.oppId) continue;
            if (side.my + PK_DISADVANTAGE_GAP >= side.opp) continue;

            const anchorRuntime = useAnchorStore.getState().getRuntime(side.id);
            const followedIds = useAnchorStore.getState().followedIds;
            const hasRelation =
              followedIds.includes(side.id) ||
              anchorRuntime.totalSpent > 0 ||
              anchorRuntime.favor >= 30;
            if (!hasRelation) continue;
            if (now - anchorRuntime.pkHelpNotifiedAt < PK_HELP_COOLDOWN) continue;

            const clock = useGameTimeStore.getState().getClock();
            if (!canSendProactiveDm(anchorRuntime, clock.day, clock.totalSeconds)) continue;

            const opponent = getAnchorById(side.oppId);
            if (!opponent) continue;

            const losingId = side.id;
            pkHelpBusyRef.current = true;
            useAnchorStore.getState().markPkHelpNotified(losingId);
            void (async () => {
              try {
                const reply = await generateAnchorReply({
                  anchorId: losingId,
                  scene: '私聊',
                  userMessage: `（系统：你在和"${opponent.stageName}"的PK中处于大劣势，比分${side.my}:${side.opp}，私信向观众紧急求助拉票，不要迎宾套话，不超过50字。）`,
                  pkContext: {
                    opponentName: opponent.stageName,
                    opponentSpecies: opponent.species,
                    myScore: side.my,
                    opponentScore: side.opp,
                  },
                });
                useChatStore.getState().addMessage(losingId, 'anchor', reply);
                useAnchorStore.getState().recordProactiveDm(losingId);
              } finally {
                pkHelpBusyRef.current = false;
              }
            })();
            break;
          }
        }

        if (now >= state.endTime) {
          usePKStore.getState().finishPK();
          lastPkEndRef.current = now;

          const finished = usePKStore.getState();
          if (!finished.playerParticipated) return;

          if (finished.mode === 'squad') {
            const squadWinner = finished.winnerId;
            if (squadWinner && isActiveAiMode()) {
              try {
                const winReply = await generateAnchorReply({
                  anchorId: squadWinner,
                  scene: 'PK',
                  userMessage:
                    '（系统：四人友好PK结束你总分最高赢了，发私信感谢观众，语气友善，不要迎宾套话，不超过55字。）',
                  pkContext: {
                    opponentName: '同伴们',
                    myScore: finished.scores[squadWinner] ?? 0,
                    opponentScore: 0,
                    squadMode: true,
                    discussionTopic: finished.discussionTopic,
                  },
                });
                useChatStore.getState().addMessage(squadWinner, 'anchor', winReply);
              } catch {
                // 忽略
              }
            }
            return;
          }

          const winnerId = finished.result === 'A' ? finished.anchorA : finished.anchorB;
          const loserId = finished.result === 'A' ? finished.anchorB : finished.anchorA;
          const winScore = finished.result === 'A' ? finished.scoreA : finished.scoreB;
          const loseScore = finished.result === 'A' ? finished.scoreB : finished.scoreA;
          if (winnerId && loserId && isActiveAiMode()) {
            const winner = getAnchorById(winnerId);
            const loser = getAnchorById(loserId);
            if (winner && loser) {
              try {
                const winReply = await generateAnchorReply({
                  anchorId: winnerId,
                  scene: 'PK',
                  userMessage:
                    '（系统：PK结束你赢了，发私信感谢观众，不要迎宾套话，不超过55字。）',
                  pkContext: {
                    opponentName: loser.stageName,
                    opponentSpecies: loser.species,
                    myScore: winScore,
                    opponentScore: loseScore,
                  },
                });
                useChatStore.getState().addMessage(winnerId, 'anchor', winReply);
              } catch {
                // 忽略
              }
              try {
                const loseReply = await generateAnchorReply({
                  anchorId: loserId,
                  scene: 'PK',
                  userMessage:
                    '（系统：PK结束你输了，发私信撒娇求安慰，不要迎宾套话，不超过55字。）',
                  pkContext: {
                    opponentName: winner.stageName,
                    opponentSpecies: winner.species,
                    myScore: loseScore,
                    opponentScore: winScore,
                  },
                });
                useChatStore.getState().addMessage(loserId, 'anchor', loseReply);
              } catch {
                // 忽略
              }
            }
          }
        }
        return;
      }

      if (!isActiveAiMode()) return;
      if (now - lastPkEndRef.current < SPONTANEOUS_PK_MIN_GAP) return;
      if (Math.random() > 0.05) return;

      // 随机发起双人或四人 PK（在播人数够时优先有机会开四人）
      const squad = pickRandomLiveSquad();
      if (squad && Math.random() < 0.45) {
        tryStartSquadPK(squad, { silent: true });
        return;
      }
      const pair = pickRandomLivePair();
      if (!pair) return;
      tryStartPK(pair[0], pair[1], { silent: true });
    }, 2000);

    return () => {
      clearInterval(gameTimeTimer);
      clearInterval(simTimer);
      clearInterval(socialTimer);
      clearInterval(momentsTimer);
      clearInterval(proactiveTimer);
      clearInterval(followUpTimer);
      clearInterval(pkTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);
}

/** 玩家进入某个主播直播间时，通知其他好感度较高的主播产生"吃醋"私信（计入日配额） */
export async function triggerJealousy(
  currentAnchorId: string,
  generateAnchorReply: ReturnType<typeof useAI>['generateAnchorReply']
) {
  if (!isActiveAiMode()) return;
  const currentAnchor = getAnchorById(currentAnchorId);
  if (!currentAnchor) return;
  const jealousIds = useAnchorStore.getState().markVisitedOther(currentAnchorId);
  const picked = jealousIds.sort(() => Math.random() - 0.5).slice(0, 1);
  const clock = useGameTimeStore.getState().getClock();

  for (const id of picked) {
    const anchor = getAnchorById(id);
    const runtime = useAnchorStore.getState().getRuntime(id);
    if (!anchor || !canSendProactiveDm(runtime, clock.day, clock.totalSeconds)) continue;
    try {
      const reply = await generateAnchorReply({
        anchorId: id,
        scene: '私聊',
        userMessage: `（系统：看到观众去了"${currentAnchor.stageName}"直播间，私信吃醋委屈，不要迎宾套话，不超过55字。）`,
      });
      useChatStore.getState().addMessage(id, 'anchor', reply);
      useAnchorStore.getState().recordProactiveDm(id);
    } catch {
      // 忽略
    }
  }
}
