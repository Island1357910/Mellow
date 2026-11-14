import { getAllAnchors } from '../data/anchors';
import { usePKStore } from '../stores/usePKStore';
import { useToastStore } from '../stores/useToastStore';
import { isAnchorLive } from './liveRoomEntry';

/** 当前正在直播的主播 id 列表 */
export function getLiveAnchorIds(): string[] {
  return getAllAnchors().filter((a) => isAnchorLive(a.id)).map((a) => a.id);
}

/** 两位主播是否都可以参加 PK（都必须在播且互不相同） */
export function canParticipatePK(anchorA: string, anchorB: string): boolean {
  if (!anchorA || !anchorB || anchorA === anchorB) return false;
  return isAnchorLive(anchorA) && isAnchorLive(anchorB);
}

/**
 * 尝试发起二人 PK。未开播主播禁止参加。
 */
export function tryStartPK(anchorA: string, anchorB: string, opts?: { silent?: boolean }): boolean {
  if (anchorA === anchorB) {
    if (!opts?.silent) useToastStore.getState().show('请选择两位不同的主播进行 PK');
    return false;
  }
  if (!isAnchorLive(anchorA) || !isAnchorLive(anchorB)) {
    if (!opts?.silent) useToastStore.getState().show('只有正在直播的主播才能参加 PK');
    return false;
  }
  return usePKStore.getState().startDuoPK(anchorA, anchorB);
}

/**
 * 尝试发起四人 PK（固定 4 人）。
 */
export function tryStartSquadPK(ids: string[], opts?: { silent?: boolean }): boolean {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length !== 4) {
    if (!opts?.silent) useToastStore.getState().show('四人 PK 需要恰好选择 4 位直播中主播');
    return false;
  }
  if (unique.some((id) => !isAnchorLive(id))) {
    if (!opts?.silent) useToastStore.getState().show('只有正在直播的主播才能参加 PK');
    return false;
  }
  return usePKStore.getState().startSquadPK(unique);
}

/** 从在播主播中随机挑一对；seed 若在播则固定为一方 */
export function pickRandomLivePair(seedId?: string): [string, string] | null {
  const live = getLiveAnchorIds();
  if (live.length < 2) return null;

  const a = seedId && live.includes(seedId) ? seedId : live[Math.floor(Math.random() * live.length)];
  const others = live.filter((id) => id !== a);
  if (others.length === 0) return null;
  const b = others[Math.floor(Math.random() * others.length)];
  return [a, b];
}

/** 从在播主播中随机挑四人；seed 若在播则固定入选 */
export function pickRandomLiveSquad(seedId?: string): string[] | null {
  const live = getLiveAnchorIds();
  if (live.length < 4) return null;

  const picked: string[] = [];
  if (seedId && live.includes(seedId)) picked.push(seedId);

  const pool = live.filter((id) => !picked.includes(id));
  while (picked.length < 4 && pool.length > 0) {
    const idx = Math.floor(Math.random() * pool.length);
    picked.push(pool.splice(idx, 1)[0]);
  }
  return picked.length === 4 ? picked : null;
}
