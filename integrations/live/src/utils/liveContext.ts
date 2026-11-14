import type { DanmuItem } from '../types';

/** 将最近弹幕、礼物、主播口播整理为 AI 可读上下文 */
export function formatLiveRoomContext(
  danmuList: DanmuItem[],
  options?: { maxItems?: number; playerName?: string }
): string {
  const max = options?.maxItems ?? 24;
  const recent = danmuList.slice(-max);
  if (recent.length === 0) return '（直播间刚开始，暂无公屏记录）';

  const lines = recent.map((item) => {
    switch (item.type) {
      case 'player':
        return `[观众·${item.sender ?? '你'}] ${item.content}`;
      case 'anchor':
        return `[主播·${item.sender ?? '主播'}口播] ${item.content}`;
      case 'gift':
        return item.giftKind === 'physical'
          ? `[实体礼物] ${item.sender} 购买了 ${item.giftName}`
          : `[虚拟礼物] ${item.sender} 送出了 ${item.giftName ?? item.content}`;
      case 'audience':
        return `[网友·${item.sender}] ${item.content}`;
      case 'system':
        return `[系统] ${item.content}`;
      default:
        return item.content;
    }
  });

  return `以下是直播间最近公屏与口播记录（请承接上下文，不要重复已说过的话）：\n${lines.join('\n')}`;
}

/** 从弹幕列表提取本场直播亮点，供星圈帖子使用 */
export function extractLiveHighlights(danmuList: DanmuItem[], playerName: string): string[] {
  const highlights: string[] = [];
  const name = playerName || '姐姐';

  for (const item of danmuList.slice(-40)) {
    if (item.type === 'gift' && item.giftKind !== 'physical') {
      highlights.push(`${name} 送了虚拟礼物「${item.giftName ?? '礼物'}」`);
    } else if (item.type === 'player') {
      highlights.push(`${name} 说：${item.content.slice(0, 30)}`);
    } else if (item.type === 'anchor') {
      highlights.push(`我回复：${item.content.slice(0, 36)}`);
    }
  }

  return [...new Set(highlights)].slice(-6);
}
