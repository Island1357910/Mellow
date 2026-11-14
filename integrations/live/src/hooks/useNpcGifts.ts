import { useEffect, useRef } from 'react';
import { GIFTS } from '../data/gifts';
import { FAKE_NICKNAMES } from '../data/fakeDanmu';
import type { GiftFeedItem } from '../types';

/** NPC 网友随机送礼 */
export function useNpcGifts(enabled: boolean, onGift: (item: GiftFeedItem) => void) {
  const onGiftRef = useRef(onGift);
  onGiftRef.current = onGift;

  useEffect(() => {
    if (!enabled) return;
    const timer = setInterval(() => {
      if (Math.random() > 0.22) return;
      const affordable = GIFTS.filter((g) => g.price <= 520);
      const gift = affordable[Math.floor(Math.random() * affordable.length)];
      const sender = FAKE_NICKNAMES[Math.floor(Math.random() * FAKE_NICKNAMES.length)];
      onGiftRef.current({
        id: `npc_gift_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        sender,
        giftIcon: gift.icon,
        giftName: gift.name,
        count: 1,
        isPlayer: false,
      });
    }, 4500 + Math.random() * 3500);
    return () => clearInterval(timer);
  }, [enabled]);
}
