import { getAnchorById } from '../data/anchors';
import { getLiveStatusText } from '../data/schedules';
import { useAnchorStore } from '../stores/useAnchorStore';
import { useGameTimeStore } from '../stores/useGameTimeStore';
import { useNavStore } from '../stores/useNavStore';
import { useToastStore } from '../stores/useToastStore';

export function isAnchorLive(anchorId: string): boolean {
  return useAnchorStore.getState().runtime[anchorId]?.isOnline === true;
}

export function getOfflineLiveToast(anchorId: string): string {
  const anchor = getAnchorById(anchorId);
  const clock = useGameTimeStore.getState().getClock();
  const status = getLiveStatusText(anchorId, false, clock);
  return `${anchor?.stageName ?? '主播'}暂未开播 · ${status.replace(/^未开播 · /, '')}`;
}

/** 尝试进入直播间；未开播时弹出提示并返回 false */
export function tryEnterLiveRoom(anchorId: string): boolean {
  if (isAnchorLive(anchorId)) {
    useNavStore.getState().push('liveRoom', { anchorId });
    return true;
  }
  useToastStore.getState().show(getOfflineLiveToast(anchorId));
  return false;
}
