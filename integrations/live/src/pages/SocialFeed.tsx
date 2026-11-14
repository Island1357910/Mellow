import { useEffect, useMemo } from 'react';
import StatusBar from '../components/Phone/StatusBar';
import ScreenHeader from '../components/Common/ScreenHeader';
import Avatar from '../components/Common/Avatar';
import { anchorAvatarProps } from '../components/Common/AnchorImage';
import { getAnchorById } from '../data/anchors';
import { useSocialStore } from '../stores/useSocialStore';
import { useNavStore } from '../stores/useNavStore';
import type { SocialPost } from '../types';

export default function SocialFeed() {
  const back = useNavStore((s) => s.back);
  const push = useNavStore((s) => s.push);
  const posts = useSocialStore((s) => s.posts);
  const ensureInit = useSocialStore((s) => s.ensureInit);

  useEffect(() => {
    ensureInit();
  }, [ensureInit]);

  const feed = useMemo(() => [...posts].sort((a, b) => b.timestamp - a.timestamp), [posts]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <StatusBar />
      <ScreenHeader title="星圈" onBack={back} />

      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto">
        {feed.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            onAvatarClick={(id) => push('socialProfile', { anchorId: id })}
            onPostClick={(id) => push('socialPostDetail', { postId: id })}
          />
        ))}
      </div>
    </div>
  );
}

function PostCard({
  post,
  onAvatarClick,
  onPostClick,
}: {
  post: SocialPost;
  onAvatarClick: (anchorId: string) => void;
  onPostClick: (postId: string) => void;
}) {
  const anchor = getAnchorById(post.anchorId);
  if (!anchor) return null;

  const typeLabel =
    post.type === 'live_notice'
      ? '📺 直播预告'
      : post.type === 'leave_notice'
        ? '📋 请假通知'
        : post.type === 'live_recap'
          ? '🎬 直播回顾'
          : '📝 日常';

  return (
    <article
      className="border-b border-[#eff3f4] bg-white px-4 py-3 hover:bg-black/[0.03] active:bg-black/[0.05]"
      onClick={() => onPostClick(post.id)}
      onKeyDown={(e) => e.key === 'Enter' && onPostClick(post.id)}
      role="button"
      tabIndex={0}
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onAvatarClick(post.anchorId);
          }}
          className="shrink-0"
        >
          <Avatar {...anchorAvatarProps(anchor)} size={40} />
        </button>
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onAvatarClick(post.anchorId);
            }}
            className="text-left text-[15px] font-bold text-[#0f1419]"
          >
            {anchor.stageName}
            <span className="ml-1 font-normal text-[#536471]">
              @{anchor.realName.replace(/\s+/g, '').toLowerCase()} · {formatTime(post.timestamp)}
            </span>
          </button>
          <p className="mt-0.5 text-[12px] text-[#536471]">{typeLabel}</p>
          <p className="mt-1 text-[15px] leading-5 text-[#0f1419]">{post.content}</p>
          {post.liveHighlights && post.liveHighlights.length > 0 && (
            <div className="mt-2 rounded-2xl border border-[#cfd9de] px-3 py-2">
              <p className="text-[12px] font-bold text-[#1d9bf0]">直播亮点</p>
              {post.liveHighlights.map((h, i) => (
                <p key={i} className="text-[13px] text-[#536471]">· {h}</p>
              ))}
            </div>
          )}
          <p className="mt-2 text-[11px] text-slate-400">❤️ {post.likes}</p>

          {post.comments.length > 0 && (
            <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2">
              {post.comments.slice(0, 4).map((c) => (
                <p key={c.id} className="text-[11px] leading-relaxed text-slate-600">
                  <span className="font-semibold text-sky-600">{c.author}</span>：{c.content}
                </p>
              ))}
              {post.comments.length > 4 && (
                <p className="mt-1 text-[10px] text-slate-400">还有 {post.comments.length - 4} 条评论…</p>
              )}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

function formatTime(ts: number) {
  const d = new Date(ts);
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}
