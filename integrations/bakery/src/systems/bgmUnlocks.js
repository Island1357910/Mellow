import { characterArchiveStories } from '../data/characterArchiveStories';
import {
  getMainStoryChapterBgmTrackId,
  isMainStoryChapterUnlocked,
  mainStoryChapters,
} from '../data/mainStoryChapters';
import { BGM_TRACKS, DEFAULT_BGM_ID } from '../data/bgmTracks';

/** 根据当前存档：主线/人物志已解锁章节对应的配乐 id（含店内默认曲，去重） */
export function collectUnlockedBgmTrackIds(state) {
  const ids = new Set([DEFAULT_BGM_ID]);
  mainStoryChapters.forEach((_, i) => {
    if (isMainStoryChapterUnlocked(i, state)) {
      ids.add(getMainStoryChapterBgmTrackId(i));
    }
  });
  characterArchiveStories.forEach((a) => {
    if (a.quest.done(state) && a.bgmTrackId) {
      ids.add(a.bgmTrackId);
    }
  });
  return Array.from(ids);
}

const ORDER = new Map(BGM_TRACKS.map((t, i) => [t.id, i]));

/** 按 bgmTracks 定义顺序排序，便于设置页下拉稳定展示 */
export function sortBgmTrackIdsForMenu(ids) {
  return [...ids].sort((a, b) => (ORDER.get(a) ?? 999) - (ORDER.get(b) ?? 999));
}
