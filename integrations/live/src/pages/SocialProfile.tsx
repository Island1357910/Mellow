import { useEffect, useMemo } from 'react';
import StatusBar from '../components/Phone/StatusBar';
import ScreenHeader from '../components/Common/ScreenHeader';
import Avatar from '../components/Common/Avatar';
import AnchorImage, { anchorAvatarProps } from '../components/Common/AnchorImage';
import { getAnchorById } from '../data/anchors';
import { getTodayScheduleDetail, getLiveStatusText } from '../data/schedules';
import { useSocialStore } from '../stores/useSocialStore';
import { useAnchorStore } from '../stores/useAnchorStore';
import { useNavStore } from '../stores/useNavStore';
import { useGameTimeStore } from '../stores/useGameTimeStore';
import { isAnchorLive, tryEnterLiveRoom } from '../utils/liveRoomEntry';

export default function SocialProfile({ anchorId }: { anchorId: string }) {
  const back = useNavStore((s) => s.back);
  const push = useNavStore((s) => s.push);
  const anchor = getAnchorById(anchorId);
  const allPosts = useSocialStore((s) => s.posts);
  const ensureInit = useSocialStore((s) => s.ensureInit);
  const posts = useMemo(
    () =>
      allPosts
        .filter((p) => p.anchorId === anchorId)
        .sort((a, b) => b.timestamp - a.timestamp),
    [allPosts, anchorId]
  );
  const runtime = useAnchorStore((s) => s.runtime[anchorId]);
  const isFollowed = useAnchorStore((s) => s.isFollowed(anchorId));
  const toggleFollow = useAnchorStore((s) => s.toggleFollow);

  useEffect(() => {
    ensureInit();
  }, [ensureInit]);

  if (!anchor) {
    return <div className="flex h-full items-center justify-center text-slate-400">用户不存在</div>;
  }

  const clock = useGameTimeStore.getState().getClock();
  const statusText = getLiveStatusText(anchorId, runtime?.isOnline ?? false, clock);
  const isOnline = isAnchorLive(anchorId);

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#f5f5f5]">
      <StatusBar />
      <ScreenHeader title="主播主页" onBack={back} />

      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto">
        <div className="bg-white px-5 pb-5 pt-4">
          <div className="relative mb-4 h-32 overflow-hidden rounded-2xl">
            <AnchorImage anchor={anchor} className="h-full w-full" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
          </div>
          <div className="flex items-center gap-4">
            <Avatar {...anchorAvatarProps(anchor)} size={72} className="ring-2 ring-white -mt-12 relative z-10" />
            <div className="min-w-0 flex-1">
              <h1 className="text-lg font-bold text-slate-800">{anchor.stageName}</h1>
              <p className="text-[11px] text-slate-400">{anchor.tag}</p>
              <p className="mt-1 text-[11px] text-pink-500">{statusText}</p>
            </div>
          </div>
          <p className="mt-3 text-[12px] leading-relaxed text-slate-600">{anchor.background.slice(0, 80)}…</p>
          <p className="mt-2 text-[11px] text-slate-400">📅 {getTodayScheduleDetail(anchorId, clock)}</p>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => toggleFollow(anchorId)}
              className={`flex-1 rounded-full py-2 text-xs font-bold ${
                isFollowed ? 'bg-slate-100 text-slate-500' : 'bg-sky-500 text-white'
              }`}
            >
              {isFollowed ? '已关注' : '+ 关注'}
            </button>
            <button
              type="button"
              onClick={() => tryEnterLiveRoom(anchorId)}
              className={`flex-1 rounded-full py-2 text-xs font-bold ${
                isOnline ? 'bg-pink-500 text-white' : 'bg-slate-200 text-slate-400'
              }`}
            >
              {isOnline ? '去直播间' : '暂未开播'}
            </button>
          </div>
        </div>

        <div className="mt-2 space-y-2 px-0">
          {posts.length === 0 ? (
            <p className="py-12 text-center text-sm text-slate-400">暂无动态，稍后再来看看～</p>
          ) : (
            posts.map((post) => (
              <button
                key={post.id}
                type="button"
                onClick={() => push('socialPostDetail', { postId: post.id })}
                className="w-full border-b border-slate-100 bg-white px-4 py-4 text-left active:bg-slate-50"
              >
                <p className="text-[10px] text-slate-400">
                  {post.type === 'live_notice' ? '📺' : post.type === 'leave_notice' ? '📋' : '📝'}{' '}
                  {new Date(post.timestamp).toLocaleString('zh-CN', {
                    month: 'numeric',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
                <p className="mt-1 text-[13px] leading-relaxed text-slate-700">{post.content}</p>
                <p className="mt-2 text-[11px] text-slate-400">❤️ {post.likes}</p>
                {post.comments.slice(0, 3).map((c) => (
                  <p key={c.id} className="mt-1 text-[11px] text-slate-500">
                    <span className="text-sky-600">{c.author}</span>：{c.content}
                  </p>
                ))}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
