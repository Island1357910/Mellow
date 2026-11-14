import { create } from 'zustand';

interface ToastState {
  message: string;
  show: (message: string, durationMs?: number) => void;
  clear: () => void;
}

let hideTimer: ReturnType<typeof setTimeout> | null = null;

export const useToastStore = create<ToastState>()((set) => ({
  message: '',

  show: (message, durationMs = 2500) => {
    if (hideTimer) clearTimeout(hideTimer);
    set({ message });
    hideTimer = setTimeout(() => {
      set({ message: '' });
      hideTimer = null;
    }, durationMs);
  },

  clear: () => {
    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = null;
    set({ message: '' });
  },
}));
