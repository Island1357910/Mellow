import { useEffect, useRef } from 'react';
import { getAnchorById } from '../data/anchors';
import { nextIdleSpeechDelayMs, pickIdleLivePrompt, pickLocalIdleBanter } from '../data/liveBanter';
import type { ChatMsg } from '../utils/ai';

interface Options {
  anchorId: string;
  active: boolean;
  paused: boolean;
  getLiveContext: () => string;
  getHistory: () => ChatMsg[];
  onSpeech: (text: string) => void;
  onHistory: (text: string) => void;
  generateAnchorReply: (opts: {
    anchorId: string;
    scene: '直播间互动';
    userMessage: string;
    history?: ChatMsg[];
    liveContext?: string;
  }) => Promise<string>;
}

/** 直播间主播周期性主动发言（40~60 秒不规则间隔） */
export function useAnchorPeriodicSpeech({
  anchorId,
  active,
  paused,
  getLiveContext,
  getHistory,
  onSpeech,
  onHistory,
  generateAnchorReply,
}: Options) {
  const busyRef = useRef(false);
  const lastPlayerActionAtRef = useRef(0);
  const onSpeechRef = useRef(onSpeech);
  const onHistoryRef = useRef(onHistory);
  const getLiveContextRef = useRef(getLiveContext);
  const getHistoryRef = useRef(getHistory);
  const generateRef = useRef(generateAnchorReply);
  const pausedRef = useRef(paused);

  onSpeechRef.current = onSpeech;
  onHistoryRef.current = onHistory;
  getLiveContextRef.current = getLiveContext;
  getHistoryRef.current = getHistory;
  generateRef.current = generateAnchorReply;
  pausedRef.current = paused;

  const bumpPlayerAction = () => {
    lastPlayerActionAtRef.current = Date.now();
  };

  useEffect(() => {
    if (!active) return;

    let cancelled = false;
    let timerId: ReturnType<typeof setTimeout> | undefined;

    const schedule = () => {
      if (cancelled) return;
      timerId = setTimeout(() => {
        void tick();
      }, nextIdleSpeechDelayMs());
    };

    const tick = async () => {
      if (cancelled) {
        return;
      }
      if (pausedRef.current || busyRef.current) {
        schedule();
        return;
      }
      if (Date.now() - lastPlayerActionAtRef.current < 9000) {
        schedule();
        return;
      }

      const anchor = getAnchorById(anchorId);
      if (!anchor) {
        schedule();
        return;
      }

      busyRef.current = true;
      try {
        const userMessage = pickIdleLivePrompt();
        let reply = await generateRef.current({
          anchorId,
          scene: '直播间互动',
          userMessage,
          history: getHistoryRef.current(),
          liveContext: getLiveContextRef.current(),
        });
        if (!reply?.trim()) {
          reply = pickLocalIdleBanter(anchor);
        }
        if (reply?.trim()) {
          onSpeechRef.current(reply);
          onHistoryRef.current(reply);
        }
      } finally {
        busyRef.current = false;
        schedule();
      }
    };

    const startTimer = setTimeout(() => {
      if (!cancelled) schedule();
    }, 35000 + Math.random() * 15000);

    return () => {
      cancelled = true;
      clearTimeout(startTimer);
      if (timerId) clearTimeout(timerId);
    };
  }, [active, anchorId]);

  return { bumpPlayerAction };
}
