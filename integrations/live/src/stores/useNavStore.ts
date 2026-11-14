import { create } from 'zustand';
import { embedded, host, type MellowApp } from '../utils/mellowHost';

export type ScreenName =
  | 'home'
  | 'liveList'
  | 'anchorProfile'
  | 'liveRoom'
  | 'pkRoom'
  | 'chatList'
  | 'chatDetail'
  | 'moments'
  | 'wallet'
  | 'socialFeed'
  | 'socialProfile'
  | 'socialPostDetail'
  | 'shop'
  | 'delivery'
  | 'settings'
  | 'music'
  | 'customAnchorEditor';

export interface ScreenEntry {
  name: ScreenName;
  params?: Record<string, string>;
}

interface NavState {
  stack: ScreenEntry[];
  push: (name: ScreenName, params?: Record<string, string>) => void;
  replace: (name: ScreenName, params?: Record<string, string>) => void;
  back: () => void;
  goHome: () => void;
  current: () => ScreenEntry;
}

const home: ScreenName = embedded ? 'liveList' : 'home';
const mellowApps: Partial<Record<ScreenName, MellowApp>> = {
  chatList: 'messages', chatDetail: 'messages', moments: 'star', socialFeed: 'star',
  socialProfile: 'star', socialPostDetail: 'star', shop: 'duotao', delivery: 'flash',
  wallet: 'chengfeng', settings: 'settings', music: 'music',
};

function openInMellow(name: ScreenName): boolean {
  const app = embedded ? mellowApps[name] : undefined;
  const bridge = host();
  if (!app || !bridge) return false;
  bridge.open(app);
  return true;
}

export const useNavStore = create<NavState>()((set, get) => ({
  stack: [{ name: home }],

  push: (name, params) => {
    if (!openInMellow(name)) set(state => ({ stack: [...state.stack, { name: name === 'home' ? home : name, params }] }));
  },

  replace: (name, params) => {
    if (!openInMellow(name)) set(state => ({ stack: [...state.stack.slice(0, -1), { name: name === 'home' ? home : name, params }] }));
  },

  back: () => {
    const { stack } = get();
    if (stack.length > 1) set({ stack: stack.slice(0, -1) });
    else if (embedded) host()?.close();
  },

  goHome: () => set({ stack: [{ name: home }] }),

  current: () => get().stack[get().stack.length - 1],
}));
