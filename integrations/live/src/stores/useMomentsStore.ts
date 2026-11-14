import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { idbJSONStorage } from '../utils/storage';
import { ANCHORS, getAnchorById } from '../data/anchors';
import { useAnchorStore } from './useAnchorStore';
import type { MomentComment, MomentPost } from '../types';

const PLAYER_AUTHOR_ID = 'player';

const PRIVATE_MOMENT_TEMPLATES = [
  '刚卸完妆躺床上，突然想起你今天没来…有点失落，只敢发在这里说 🥺',
  '今天其实心情不太好，但不想让直播间里那么多人担心，就悄悄发一条吧',
  '午饭一个人吃的，突然好想有人陪我说说话…你会来看我吗',
  '练舞练到腿软，但想到你可能会刷到这条就又打起精神了 ✨',
  '凌晨三点还在剪视频，眼睛酸酸的，要是你在就好了',
  '新买的香水到了，喷了一下觉得好适合见你的时候…啊我在说什么',
  '今天被路人夸好看，第一反应是想截图发给你看，又忍住了',
  '下雨天窝在被窝里，听着雨声莫名想你，这条只给少数人看',
  '刚收到一份小礼物，开心到转圈，但最想感谢的人好像还没点赞…',
  '健身完照镜子，腹肌还在路上，心态倒是先赢了，你来监督我吗',
  '今天直播下播后一个人发呆了好久，习惯了热闹突然安静会不习惯',
  '偷偷告诉你们，我其实很怕被人冷落，所以对愿意陪我的人格外珍惜',
];

const RIVAL_COMMENT_TEMPLATES: Record<string, string[]> = {
  jealous: [
    '姐姐别被他骗了，我才是真心对你好的那个 🥺',
    '哼，这种话我也能对你说一百遍，而且我更乖',
    '他发这种就是故意的吧…姐姐你看看我呗',
    '我只敢在这里说，其实我吃醋了',
  ],
  subtle: [
    '姐姐今天也辛苦了，记得早点休息～',
    '这条好真实，不像某些人只会营业',
    '要是姐姐愿意，我可以给你唱首晚安曲',
    '看到姐姐在线我就安心了，虽然你可能在看别人',
  ],
  competitive: [
    '姐姐给我也留一句嘛，我不比他差',
    '他这文案一看就是复制粘贴的，姐姐别上当',
    '姐姐要是点赞我，我今晚直播给你专属福利',
    '争什么争，姐姐心里明明最疼我',
  ],
};

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function makeId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function buildInitialPosts(): MomentPost[] {
  const posts: MomentPost[] = [];
  const sample = ANCHORS.slice(0, 6);
  for (const anchor of sample) {
    posts.push({
      id: makeId('moment'),
      authorType: 'anchor',
      authorId: anchor.id,
      content: pick(PRIVATE_MOMENT_TEMPLATES),
      timestamp: Date.now() - Math.floor(Math.random() * 86400000 * 2),
      likedBy: [],
      comments: [],
    });
  }
  return posts.sort((a, b) => b.timestamp - a.timestamp);
}

function makeRivalComment(anchorId: string): MomentComment | null {
  const anchor = getAnchorById(anchorId);
  if (!anchor) return null;
  const pool = pick(Object.values(RIVAL_COMMENT_TEMPLATES));
  return {
    id: makeId('mcmt'),
    authorType: 'anchor',
    authorId: anchorId,
    authorName: anchor.stageName,
    content: pick(pool),
    timestamp: Date.now(),
  };
}

interface MomentsState {
  posts: MomentPost[];
  initialized: boolean;
  ensureInit: () => void;
  addAnchorPost: (anchorId: string, content: string) => void;
  addPlayerPost: (content: string) => string;
  toggleLike: (postId: string, likerId: string) => void;
  addComment: (postId: string, comment: Omit<MomentComment, 'id' | 'timestamp'>) => void;
  addAnchorComment: (postId: string, anchorId: string, content: string) => void;
  getPost: (postId: string) => MomentPost | undefined;
  tickMoments: () => void;
  maybeRivalComments: (postId: string, authorAnchorId: string) => void;
}

export const useMomentsStore = create<MomentsState>()(
  persist(
    (set, get) => ({
      posts: [],
      initialized: false,

      ensureInit: () => {
        const { initialized, posts } = get();
        if (initialized && posts.length > 0) return;
        set({ posts: buildInitialPosts(), initialized: true });
      },

      addAnchorPost: (anchorId, content) =>
        set((state) => {
          const post: MomentPost = {
            id: makeId('moment'),
            authorType: 'anchor',
            authorId: anchorId,
            content,
            timestamp: Date.now(),
            likedBy: [],
            comments: [],
          };
          return { posts: [post, ...state.posts].slice(0, 200) };
        }),

      addPlayerPost: (content) => {
        const id = makeId('moment');
        const post: MomentPost = {
          id,
          authorType: 'player',
          authorId: PLAYER_AUTHOR_ID,
          content,
          timestamp: Date.now(),
          likedBy: [],
          comments: [],
        };
        set((state) => ({
          posts: [post, ...state.posts].slice(0, 200),
        }));
        return id;
      },

      toggleLike: (postId, likerId) =>
        set((state) => ({
          posts: state.posts.map((p) => {
            if (p.id !== postId) return p;
            const liked = p.likedBy.includes(likerId);
            return {
              ...p,
              likedBy: liked ? p.likedBy.filter((id) => id !== likerId) : [...p.likedBy, likerId],
            };
          }),
        })),

      addComment: (postId, partial) =>
        set((state) => ({
          posts: state.posts.map((p) => {
            if (p.id !== postId) return p;
            const comment: MomentComment = {
              ...partial,
              id: makeId('mcmt'),
              timestamp: Date.now(),
            };
            return { ...p, comments: [...p.comments, comment] };
          }),
        })),

      addAnchorComment: (postId, anchorId, content) => {
        const anchor = getAnchorById(anchorId);
        if (!anchor) return;
        get().addComment(postId, {
          authorType: 'anchor',
          authorId: anchorId,
          authorName: anchor.stageName,
          content,
        });
      },

      getPost: (postId) => get().posts.find((p) => p.id === postId),

      maybeRivalComments: (postId, authorAnchorId) => {
        const runtime = useAnchorStore.getState().runtime;
        const rivals = ANCHORS.filter((a) => {
          if (a.id === authorAnchorId) return false;
          const favor = runtime[a.id]?.favor ?? 0;
          return favor >= 20 && Math.random() < 0.45;
        }).slice(0, 2);

        for (const rival of rivals) {
          const cmt = makeRivalComment(rival.id);
          if (cmt) {
            set((state) => ({
              posts: state.posts.map((p) => {
                if (p.id !== postId) return p;
                return { ...p, comments: [...p.comments, cmt] };
              }),
            }));
          }
        }
      },

      tickMoments: () => {
        if (Math.random() > 0.4) return;
        const runtime = useAnchorStore.getState().runtime;
        const candidates = ANCHORS.filter((a) => (runtime[a.id]?.favor ?? 0) >= 10);
        if (candidates.length === 0) return;

        const anchor = pick(candidates);
        const content = pick(PRIVATE_MOMENT_TEMPLATES);
        get().addAnchorPost(anchor.id, content);

        const newPost = get().posts[0];
        if (newPost) {
          setTimeout(() => get().maybeRivalComments(newPost.id, anchor.id), 800);
        }
      },
    }),
    {
      name: 'shenhao_moments',
      storage: idbJSONStorage,
      partialize: (state) => ({
        posts: state.posts,
        initialized: state.initialized,
      }),
    }
  )
);

export function getMomentsPlayerAuthorId() {
  return PLAYER_AUTHOR_ID;
}
