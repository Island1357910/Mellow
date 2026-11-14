import { useEffect, useState } from 'react';
import { useToastStore } from '../stores/useToastStore';

type Host = {
  playerName: string;
  close(): void;
  open(app: MellowApp): void;
  balance(): Promise<number>;
  spend(amount: number): Promise<number>;
  ai(payload: { messages: { role: 'system' | 'user' | 'assistant'; content: string }[]; temperature?: number; max_tokens?: number }): Promise<string>;
  connect(anchor: { id: string; realName: string; stageName: string; background: string; personality: string; chatStyle: string; portraitUrl?: string }, mode: 'sms' | 'offline'): Promise<void>;
};
export type MellowApp = 'messages' | 'star' | 'duotao' | 'flash' | 'chengfeng' | 'settings' | 'music';
export const embedded = new URLSearchParams(window.location.search).has('identity');
export const host = () => (window as Window & { mellowLiveHost?: Host }).mellowLiveHost;
export async function pay(amount: number) {
  try {
    const bridge = host();
    if (!bridge) throw new Error('请从半糖 Mellow 打开直播间');
    const balance = await bridge.spend(amount);
    window.dispatchEvent(new CustomEvent('live-wallet', { detail: balance }));
    return true;
  } catch (error) {
    useToastStore.getState().show(error instanceof Error ? error.message : '扣款失败');
    return false;
  }
}

export function useBalance() {
  const [balance, setBalance] = useState<number | null>(null);
  useEffect(() => {
    let live = true;
    const refresh = () => { void host()?.balance().then(value => { if (live) setBalance(value); }).catch(() => {}); };
    refresh();
    const update = (event: Event) => setBalance((event as CustomEvent<number>).detail);
    window.addEventListener('live-wallet', update);
    window.addEventListener('focus', refresh);
    return () => { live = false; window.removeEventListener('live-wallet', update); window.removeEventListener('focus', refresh); };
  }, []);
  return balance;
}

export const MujianSdk = {
  getInstance: () => ({
    get isReady() { return Boolean(host()); },
    init: async () => {},
    ai: { openai: { chat: { completions: {
      create: async (payload: Parameters<Host['ai']>[0], _a?: unknown, _b?: unknown, signal?: AbortSignal) => {
        const bridge = host();
        if (!bridge || signal?.aborted) throw new Error('直播间暂时无法连接模型');
        const content = await bridge.ai(payload);
        if (signal?.aborted) throw new Error('请求已取消');
        return { choices: [{ message: { content } }] };
      },
    } } } },
  }),
};
