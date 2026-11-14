import { useEffect } from 'react';
import StatusBar from '../components/Phone/StatusBar';
import ScreenHeader from '../components/Common/ScreenHeader';
import Avatar from '../components/Common/Avatar';
import { anchorAvatarProps } from '../components/Common/AnchorImage';
import { getAnchorById } from '../data/anchors';
import { useSocialStore } from '../stores/useSocialStore';
import { useNavStore } from '../stores/useNavStore';

export default function SocialPostDetail({ postId }: { postId: string }) {
  const back = useNavStore((s) => s.back);
  const push = useNavStore((s) => s.push);
  const posts = useSocialStore((s) => s.posts);
  const ensureInit = useSocialStore((s) => s.ensureInit);

  useEffect(() => {
    ensureInit();
  }, [ensureInit]);

  const post = posts.find((p) => p.id === postId);

  if (!post) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-[#f5f5f5] text-slate-400">
        <p>帖子不存在或已删除</p>
        <button type="button" onClick={back} className="rounded-full bg-white px-4 py-2 text-sm text-slate-600">
          返回
        </button>
      </div>
    );
  }

  const anchor = getAnchorById(post.anchorId);
  if (!anchor) return null;

  const typeLabel =
    post.type === 'live_notice'
      ? '📺 直播预告'
      : post.type === 'leave_notice'
        ? '📋 请假通知'
        : post.type === 'live_recap'
          ? '🎬 直播回顾'
          : '📝 日常动态';

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#f5f5f5]">
      <StatusBar />
      <ScreenHeader title="帖子详情" onBack={back} />

      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto pb-6">
        <article className="bg-white px-4 py-5">
          <div className="flex items-start gap-3">
            <button type="button" onClick={() => push('socialProfile', { anchorId: post.anchorId })}>
              <Avatar {...anchorAvatarProps(anchor)} size={48} />
            </button>
            <div className="min-w-0 flex-1">
              <button
                type="button"
                onClick={() => push('socialProfile', { anchorId: post.anchorId })}
                className="text-left text-base font-bold text-slate-800"
              >
                {anchor.stageName}
              </button>
              <p className="text-[11px] text-slate-400">
                {typeLabel} · {formatTime(post.timestamp)}
              </p>
            </div>
          </div>

          <p className="mt-4 text-[15px] leading-relaxed text-slate-700">{post.content}</p>
          {post.liveHighlights && post.liveHighlights.length > 0 && (
            <div className="mt-4 rounded-xl border border-pink-100 bg-pink-50/50 px-3 py-3">
              <p className="mb-2 text-xs font-bold text-pink-400">直播亮点回顾</p>
              {post.liveHighlights.map((h, i) => (
                <p key={i} className="text-[12px] text-slate-600">· {h}</p>
              ))}
            </div>
          )}
          <p className="mt-4 text-sm text-slate-400">❤️ {post.likes} 赞</p>
        </article>

        <div className="mt-2 bg-white px-4 py-4">
          <p className="mb-3 text-sm font-semibold text-slate-700">评论 ({post.comments.length})</p>
          {post.comments.length === 0 ? (
            <p className="text-sm text-slate-400">暂无评论</p>
          ) : (
            post.comments.map((c) => (
              <div key={c.id} className="border-b border-slate-50 py-2.5 last:border-0">
                <p className="text-[13px] leading-relaxed text-slate-600">
                  <span className="font-semibold text-sky-600">{c.author}</span>
                  <span className="ml-1 text-[10px] text-slate-300">{formatTime(c.timestamp)}</span>
                </p>
                <p className="mt-0.5 text-[13px] text-slate-700">{c.content}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function formatTime(ts: number) {
  const d = new Date(ts);
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}
