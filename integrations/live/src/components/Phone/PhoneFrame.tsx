import type { ReactNode } from 'react';

export const PHONE_WIDTH = 390;
export const PHONE_HEIGHT = 844;

/** 手机外壳容器：固定 390x844 尺寸，圆角边框 + 刘海屏装饰 */
export default function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div
      className="relative select-none rounded-[3.2rem] border-[10px] border-[#cfd9de] bg-white shadow-[0_0_0_1px_rgba(15,20,25,0.08),0_30px_70px_-20px_rgba(15,20,25,0.35)]"
      style={{ width: PHONE_WIDTH + 20, height: PHONE_HEIGHT + 20 }}
    >
      {/* 侧边按钮装饰 */}
      <div className="absolute -left-[3px] top-24 h-8 w-[3px] rounded-l bg-[#cfd9de]" />
      <div className="absolute -left-[3px] top-36 h-14 w-[3px] rounded-l bg-[#cfd9de]" />
      <div className="absolute -left-[3px] top-52 h-14 w-[3px] rounded-l bg-[#cfd9de]" />
      <div className="absolute -right-[3px] top-32 h-20 w-[3px] rounded-r bg-[#cfd9de]" />

      <div
        className="relative overflow-hidden rounded-[2.6rem] bg-white text-[#0f1419]"
        style={{ width: PHONE_WIDTH, height: PHONE_HEIGHT }}
      >
        {children}
        {/* 刘海 */}
        <div className="pointer-events-none absolute left-1/2 top-1.5 z-40 h-5 w-28 -translate-x-1/2 rounded-full bg-slate-900" />
        {/* Home Indicator */}
        <div className="pointer-events-none absolute bottom-1.5 left-1/2 z-40 h-1 w-32 -translate-x-1/2 rounded-full bg-slate-900/25" />
      </div>
    </div>
  );
}
