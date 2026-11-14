import { useEffect, useMemo, useState } from 'react';
import StatusBar from '../components/Phone/StatusBar';
import ScreenHeader from '../components/Common/ScreenHeader';
import Avatar from '../components/Common/Avatar';
import { anchorAvatarProps } from '../components/Common/AnchorImage';
import Loading from '../components/Common/Loading';
import { getAnchorById } from '../data/anchors';
import { useMomentsStore } from '../stores/useMomentsStore';
import { useNavStore } from '../stores/useNavStore';
import { usePlayerStore } from '../stores/usePlayerStore';
import { useAI, reactAnchorsToPlayerMoment } from '../hooks/useAI';
import type { MomentPost } from '../types';

export default function MomentsFeed() {
  const back = useNavStore((s) => s.back);
  const posts = useMomentsStore((s) => s.posts);
  const ensureInit = useMomentsStore((s) => s.ensureInit);
  const addPlayerPost = useMomentsStore((s) => s.addPlayerPost);
  const toggleLike = useMomentsStore((s) => s.toggleLike);
  const addComment = useMomentsStore((s) => s.addComment);
  const { generateAnchorReply } = useAI();
  const playerName = usePlayerStore((s) => s.playerName) || '我';

  const [composeOpen, setComposeOpen] = useState(false);
  const [composeText, setComposeText] = useState('');
  const [commentPostId, setCommentPostId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');
  const [reacting, setReacting] = useState(false);

  useEffect(() => {
    ensureInit();
  }, [ensureInit]);

  const feed = useMemo(() => [...posts].sort((a, b) => b.timestamp - a.timestamp), [posts]);

  const publish = async () => {
    const text = composeText.trim();
    if (!text) return;
    setComposeText('');
    setComposeOpen(false);
    const postId = addPlayerPost(text);
    setReacting(true);
    try {
      await reactAnchorsToPlayerMoment(postId, text, generateAnchorReply);
    } finally {
      setReacting(false);
    }
  };

  const submitComment = (postId: string) => {
    const text = commentText.trim();
    if (!text) return;
    addComment(postId, {
      authorType: 'player',
      authorId: 'player',
      authorName: playerName,
      content: text,
    });
    setCommentText('');
    setCommentPostId(null);
  };

  return (
    <div className="relative flex h-full min-h-0 flex-col bg-[#ededed]">
      <StatusBar />
      <ScreenHeader
        title="朋友圈"
        onBack={back}
        right={
          <button
            type="button"
            onClick={() => setComposeOpen(true)}
            className="text-xs font-semibold text-emerald-600"
          >
            发布
          </button>
        }
      />

      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto pb-6">
        {feed.map((post) => (
          <MomentCard
            key={post.id}
            post={post}
            playerName={playerName}
            onLike={() => toggleLike(post.id, 'player')}
            onComment={() => setCommentPostId(post.id)}
            commentOpen={commentPostId === post.id}
            commentText={commentText}
            onCommentTextChange={setCommentText}
            onSubmitComment={() => submitComment(post.id)}
            onCancelComment={() => {
              setCommentPostId(null);
              setCommentText('');
            }}
          />
        ))}
      </div>

      {reacting && (
        <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center">
          <div className="rounded-full bg-black/60 px-4 py-2 text-xs text-white">
            <Loading small text="主播正在互动" />
          </div>
        </div>
      )}

      {composeOpen && (
        <div className="absolute inset-0 z-50 flex items-end bg-black/40" onClick={() => setComposeOpen(false)}>
          <div
            className="w-full rounded-t-3xl bg-white px-4 pb-8 pt-4"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="mb-3 text-center text-sm font-bold text-slate-700">发朋友圈</p>
            <textarea
              value={composeText}
              onChange={(e) => setComposeText(e.target.value)}
              placeholder="分享你的日常…关系好的主播可能会来互动"
              maxLength={200}
              rows={4}
              className="mb-4 w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setComposeOpen(false)}
                className="flex-1 rounded-xl bg-slate-100 py-3 text-sm text-slate-500"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => void publish()}
                className="flex-1 rounded-xl bg-emerald-500 py-3 text-sm font-bold text-white"
              >
                发布
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MomentCard({
  post,
  playerName,
  onLike,
  onComment,
  commentOpen,
  commentText,
  onCommentTextChange,
  onSubmitComment,
  onCancelComment,
}: {
  post: MomentPost;
  playerName: string;
  onLike: () => void;
  onComment: () => void;
  commentOpen: boolean;
  commentText: string;
  onCommentTextChange: (v: string) => void;
  onSubmitComment: () => void;
  onCancelComment: () => void;
}) {
  const anchor = post.authorType === 'anchor' ? getAnchorById(post.authorId) : null;
  const authorName = post.authorType === 'player' ? playerName : anchor?.stageName ?? '主播';
  const playerLiked = post.likedBy.includes('player');

  const likeSummary = useMemo(() => {
    const names: string[] = [];
    if (post.likedBy.includes('player')) names.push(playerName);
    for (const id of post.likedBy) {
      if (id === 'player') continue;
      const a = getAnchorById(id);
      if (a) names.push(a.stageName);
    }
    return names;
  }, [post.likedBy, playerName]);

  return (
    <article className="mb-2 bg-white px-4 py-4">
      <div className="flex items-start gap-3">
        {post.authorType === 'anchor' && anchor ? (
          <Avatar {...anchorAvatarProps(anchor)} size={42} />
        ) : (
          <div className="flex h-[42px] w-[42px] items-center justify-center rounded-full bg-gradient-to-br from-pink-300 to-rose-400 text-sm font-bold text-white">
            {playerName.slice(0, 1)}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-slate-800">{authorName}</p>
          <p className="text-[10px] text-slate-400">{formatTime(post.timestamp)}</p>
          <p className="mt-2 text-[13px] leading-relaxed text-slate-700">{post.content}</p>

          <div className="mt-3 flex gap-4">
            <button
              type="button"
              onClick={onLike}
              className={`text-xs ${playerLiked ? 'text-red-500' : 'text-slate-400'}`}
            >
              {playerLiked ? '♥ 已赞' : '♡ 赞'}
            </button>
            <button type="button" onClick={onComment} className="text-xs text-slate-400">
              评论
            </button>
          </div>

          {(likeSummary.length > 0 || post.comments.length > 0) && (
            <div className="mt-2 rounded-lg bg-slate-50 px-3 py-2">
              {likeSummary.length > 0 && (
                <p className="text-xs text-slate-600">
                  <span className="text-red-400">♥</span> {likeSummary.join('、')}
                </p>
              )}
              {post.comments.map((c) => (
                <p key={c.id} className="mt-1 text-xs text-slate-600">
                  <span className="font-semibold text-slate-700">{c.authorName}</span>：{c.content}
                </p>
              ))}
            </div>
          )}

          {commentOpen && (
            <div className="mt-2 flex gap-2">
              <input
                value={commentText}
                onChange={(e) => onCommentTextChange(e.target.value)}
                placeholder="写评论…"
                className="flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-xs outline-none"
                onKeyDown={(e) => e.key === 'Enter' && onSubmitComment()}
              />
              <button type="button" onClick={onSubmitComment} className="text-xs text-emerald-600">
                发送
              </button>
              <button type="button" onClick={onCancelComment} className="text-xs text-slate-400">
                取消
              </button>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

function formatTime(ts: number) {
  const d = new Date(ts);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  }
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}
