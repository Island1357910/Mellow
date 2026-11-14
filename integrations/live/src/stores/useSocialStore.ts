import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { idbJSONStorage } from '../utils/storage';
import { ANCHORS } from '../data/anchors';
import { FAKE_NICKNAMES } from '../data/fakeDanmu';
import { getTodayScheduleDetail, isCancelledToday } from '../data/schedules';
import { getGameClockNow } from '../stores/useGameTimeStore';
import type { SocialComment, SocialPost, SocialPostType } from '../types';

const DAILY_TEMPLATES = [
  '今天练歌练到嗓子哑了，但想到晚上能见到你们就又有动力了～',
  '刚拍完一组写真，累但开心！先发一张预告给你们看 👀',
  '午饭吃了超难吃的沙拉…有没有姐姐投喂我一下 🥺',
  '下雨天最适合窝在被窝里直播了，今晚见～',
  '健身打卡！腹肌还在路上，但心态已经赢了 💪',
  '收到粉丝寄的小礼物，感动到想哭，谢谢一直陪着我的人。',
  '今天心情超好！随机抽一位评论区的宝贝说晚安～',
  '刚打完游戏，手感火热，晚点直播间见分晓 🎮',
  '新发型怎么样？我自己觉得还行哈哈',
  '熬夜剪视频，只为给你们更好的内容，爱你们！',
];

const COMMENT_TEMPLATES = [
  '啊啊啊太帅了！',
  '今天也要加油呀',
  '已截图当壁纸',
  '姐姐来了！',
  '蹲一个直播',
  '这颜值我能看一天',
  '摸摸头',
  '注意休息别太累了',
  '已关注，求翻牌',
  '笑死我了哈哈哈',
  '什么时候连麦呀',
  '礼物已备好等你开播',
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function makeComments(count: number): SocialComment[] {
  const used = new Set<string>();
  const list: SocialComment[] = [];
  for (let i = 0; i < count; i += 1) {
    let author = pick(FAKE_NICKNAMES);
    let guard = 0;
    while (used.has(author) && guard < 8) {
      author = pick(FAKE_NICKNAMES);
      guard += 1;
    }
    used.add(author);
    list.push({
      id: `cmt_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 6)}`,
      author,
      content: pick(COMMENT_TEMPLATES),
      timestamp: Date.now() - Math.floor(Math.random() * 3600000),
    });
  }
  return list.sort((a, b) => b.timestamp - a.timestamp);
}

function makePost(
  anchorId: string,
  type: SocialPostType,
  content: string,
  liveHighlights?: string[]
): SocialPost {
  return {
    id: `post_${anchorId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    anchorId,
    type,
    content,
    timestamp: Date.now() - Math.floor(Math.random() * 7200000),
    likes: 50 + Math.floor(Math.random() * 800),
    comments: makeComments(2 + Math.floor(Math.random() * 5)),
    liveHighlights,
  };
}

function buildInitialPosts(): SocialPost[] {
  const posts: SocialPost[] = [];
  const clock = getGameClockNow();
  for (const anchor of ANCHORS) {
    posts.push(makePost(anchor.id, 'daily', pick(DAILY_TEMPLATES)));
    if (isCancelledToday(anchor.id, clock)) {
      posts.push(
        makePost(
          anchor.id,
          'leave_notice',
          `各位姐姐不好意思，今天身体/工作原因请假一天，我们改天再见～${getTodayScheduleDetail(anchor.id, clock)}`
        )
      );
    } else {
      posts.push(
        makePost(
          anchor.id,
          'live_notice',
          `今晚直播预告！${getTodayScheduleDetail(anchor.id, clock)}，记得来陪我～`
        )
      );
    }
  }
  return posts.sort((a, b) => b.timestamp - a.timestamp);
}

interface SocialState {
  posts: SocialPost[];
  initialized: boolean;
  ensureInit: () => void;
  getPostsByAnchor: (anchorId: string) => SocialPost[];
  addPost: (post: Omit<SocialPost, 'id' | 'timestamp' | 'likes' | 'comments'> & { comments?: SocialComment[] }) => void;
  addLiveRecap: (anchorId: string, highlights: string[], playerName: string) => void;
  addLiveMoment: (anchorId: string, moment: string, playerName: string) => void;
  tickSocial: () => void;
}

export const useSocialStore = create<SocialState>()(
  persist(
    (set, get) => ({
      posts: [],
      initialized: false,

      ensureInit: () => {
        const { initialized, posts } = get();
        if (initialized && posts.length > 0) return;
        set({ posts: buildInitialPosts(), initialized: true });
      },

      getPostsByAnchor: (anchorId) =>
        get()
          .posts.filter((p) => p.anchorId === anchorId)
          .sort((a, b) => b.timestamp - a.timestamp),

      addPost: (partial) =>
        set((state) => ({
          posts: [
            {
              ...makePost(partial.anchorId, partial.type, partial.content, partial.liveHighlights),
              timestamp: Date.now(),
            },
            ...state.posts,
          ].slice(0, 300),
        })),

      addLiveRecap: (anchorId, highlights, playerName) => {
        if (highlights.length === 0) return;
        const summary = highlights.slice(0, 4).join('；');
        const content = `刚下播！今晚直播超开心～${summary}。特别谢谢${playerName}姐姐的陪伴，我们星圈见！`;
        get().addPost({
          anchorId,
          type: 'live_recap',
          content,
          liveHighlights: highlights,
        });
      },

      addLiveMoment: (anchorId, moment, playerName) => {
        const content = `直播小记：${moment}——${playerName}姐姐你太宠我了！`;
        get().addPost({
          anchorId,
          type: 'live_recap',
          content,
          liveHighlights: [moment],
        });
      },

      tickSocial: () => {
        if (Math.random() > 0.15) return;
        const anchor = pick(ANCHORS);
        const type: SocialPostType =
          Math.random() < 0.7 ? 'daily' : Math.random() < 0.5 ? 'live_notice' : 'leave_notice';
        let content = pick(DAILY_TEMPLATES);
        if (type === 'live_notice') {
          content = `临时通知：${getTodayScheduleDetail(anchor.id, getGameClockNow())}，不见不散！`;
        } else if (type === 'leave_notice') {
          content = '突发状况，今天可能播不了或会迟到，抱歉让大家久等了…';
        }
        get().addPost({ anchorId: anchor.id, type, content });
      },
    }),
    {
      name: 'shenhao_social',
      storage: idbJSONStorage,
    }
  )
);
