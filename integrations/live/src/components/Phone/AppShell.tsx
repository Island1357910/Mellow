import type { ReactNode } from 'react';

/** 全屏应用容器（无手机边框/刘海装饰） */
export default function AppShell({ children }: { children: ReactNode }) {
  return (
    <div
      className="relative flex h-dvh w-full flex-col overflow-hidden text-slate-800"
      style={{ background: 'var(--shell-bg, linear-gradient(180deg, #eaf5ff 0%, #fdeef7 100%))' }}
    >
      {children}
    </div>
  );
}
