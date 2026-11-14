import { useState } from 'react';
import { HOME_DEFAULT_WALLPAPER_URL } from '../data/appearance';
import { usePlayerStore } from '../stores/usePlayerStore';
import { useSettingsStore } from '../stores/useSettingsStore';
import type { AiInteractionMode } from '../types';

const SPARKLES = ['✦', '✧', '❖', '◈', '✦', '✧'];

const MODE_OPTIONS: {
  value: AiInteractionMode;
  title: string;
  badge: string;
  summary: string;
  tokenNote: string;
  details: string[];
}[] = [
  {
    value: 'active',
    title: '主动式',
    badge: '沉浸推荐',
    summary: 'AI 会在后台持续推演世界：主播主动私信、直播间口播、观众弹幕等都会自动生成。',
    tokenNote: 'Token 消耗较高',
    details: [
      '后台定时触发主播私信、吃醋、PK 求助等',
      '进入直播间即有欢迎语，主播会周期性主动发言',
      '观众弹幕由 AI 实时生成，氛围更热闹',
    ],
  },
  {
    value: 'passive',
    title: '被动式',
    badge: '省 Token',
    summary: '只有你进行聊天、送礼、下单、发朋友圈等操作时，AI 才会生成对应回复。',
    tokenNote: 'Token 消耗显著更低',
    details: [
      '不会收到主播 unsolicited 私信或自动口播',
      '直播间以本地模拟弹幕为主，互动时再调用 AI',
      '适合想自己掌控节奏、减少 AI 调用次数的玩家',
    ],
  },
];

/** 首次使用引导：华丽封面 + 设置玩家昵称 + AI 互动模式 */
export default function Onboarding() {
  const [name, setName] = useState('');
  const savedMode = useSettingsStore((s) => s.aiInteractionMode);
  const [selectedMode, setSelectedMode] = useState<AiInteractionMode | null>(null);
  const completeOnboarding = usePlayerStore((s) => s.completeOnboarding);
  const setAiInteractionMode = useSettingsStore((s) => s.setAiInteractionMode);

  const canSubmit = selectedMode !== null;

  const handleSubmit = () => {
    if (!selectedMode) return;
    setAiInteractionMode(selectedMode);
    completeOnboarding(name || '神秘女王');
  };

  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden bg-black">
      <div
        className="absolute inset-0 scale-105 bg-cover bg-center"
        style={{ backgroundImage: `url("${HOME_DEFAULT_WALLPAPER_URL}")` }}
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/55 via-violet-950/35 to-black/75" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,rgba(251,191,36,0.22),transparent_42%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_82%,rgba(236,72,153,0.18),transparent_38%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_88%_70%,rgba(56,189,248,0.14),transparent_36%)]" />

      {SPARKLES.map((mark, i) => (
        <span
          key={`${mark}-${i}`}
          className="animate-onboarding-sparkle pointer-events-none absolute text-sm text-amber-200/70"
          style={{
            left: `${8 + i * 14}%`,
            top: `${12 + (i % 3) * 22}%`,
            animationDelay: `${i * 0.35}s`,
          }}
        >
          {mark}
        </span>
      ))}

      <div className="relative z-10 flex min-h-0 flex-1 flex-col overflow-y-auto px-6 py-6">
        <div className="mx-auto flex w-full max-w-[22rem] flex-col items-center">
          <div className="animate-onboarding-float mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-amber-200/40 bg-gradient-to-br from-amber-200/25 via-white/10 to-fuchsia-300/20 shadow-[0_0_40px_rgba(251,191,36,0.35)] backdrop-blur-sm">
            <span className="text-3xl drop-shadow-[0_2px_8px_rgba(0,0,0,0.45)]">👑</span>
          </div>

          <div className="mb-2 flex items-center gap-3">
            <span className="h-px w-10 bg-gradient-to-r from-transparent to-amber-200/70" />
            <span className="text-[10px] font-semibold tracking-[0.35em] text-amber-100/80">SHENHAO SIMULATOR</span>
            <span className="h-px w-10 bg-gradient-to-l from-transparent to-amber-200/70" />
          </div>

          <h1 className="animate-onboarding-shimmer bg-gradient-to-r from-amber-100 via-white to-fuchsia-200 bg-clip-text text-center text-[1.5rem] font-black leading-tight tracking-wide text-transparent">
            欢迎来到神豪模拟器
          </h1>
          <p className="mt-2 max-w-[18rem] text-center text-sm leading-relaxed text-white/78">
            在这里，你就是被三十六位男主播争相讨好的
            <span className="font-semibold text-amber-100">女王大人</span>
          </p>

          <div className="relative mt-5 w-full">
            <div className="animate-onboarding-glow pointer-events-none absolute -inset-1 rounded-[1.35rem] bg-gradient-to-r from-amber-300/35 via-fuchsia-300/30 to-sky-300/35 blur-md" />
            <div className="relative overflow-hidden rounded-[1.25rem] border border-white/20 bg-white/10 p-4 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl">
              <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-amber-200/15 blur-2xl" />
              <div className="pointer-events-none absolute -bottom-8 -left-4 h-20 w-20 rounded-full bg-fuchsia-300/15 blur-2xl" />

              <p className="mb-1 text-center text-[10px] font-semibold tracking-[0.2em] text-amber-100/70">
                AI 互动模式
              </p>
              <p className="mb-3 text-center text-[11px] leading-relaxed text-white/55">
                请选择 AI 如何参与游戏。每次 AI 生成都会消耗 Token（由平台计费），两种模式消耗差异很大，请按需选择。
              </p>

              <div className="space-y-2.5">
                {MODE_OPTIONS.map((opt) => {
                  const selected = selectedMode === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setSelectedMode(opt.value)}
                      className={`w-full rounded-xl border px-3.5 py-3 text-left transition ${
                        selected
                          ? 'border-amber-200/70 bg-amber-200/15 shadow-[0_0_20px_rgba(251,191,36,0.15)]'
                          : 'border-white/15 bg-black/20 hover:border-white/25 hover:bg-black/30'
                      }`}
                    >
                      <div className="mb-1.5 flex items-center justify-between gap-2">
                        <span className="text-sm font-bold text-white">{opt.title}</span>
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            opt.value === 'active'
                              ? 'bg-fuchsia-400/25 text-fuchsia-100'
                              : 'bg-emerald-400/20 text-emerald-100'
                          }`}
                        >
                          {opt.badge}
                        </span>
                      </div>
                      <p className="text-[11px] leading-relaxed text-white/72">{opt.summary}</p>
                      <p
                        className={`mt-1.5 text-[10px] font-semibold ${
                          opt.value === 'active' ? 'text-amber-200/90' : 'text-emerald-200/90'
                        }`}
                      >
                        {opt.tokenNote}
                      </p>
                      <ul className="mt-2 space-y-0.5">
                        {opt.details.map((line) => (
                          <li key={line} className="text-[10px] leading-relaxed text-white/45">
                            · {line}
                          </li>
                        ))}
                      </ul>
                    </button>
                  );
                })}
              </div>

              {savedMode && selectedMode === null && (
                <p className="mt-2 text-center text-[10px] text-white/40">
                  上次选择：{savedMode === 'active' ? '主动式' : '被动式'}（请重新点选以确认）
                </p>
              )}

              <p className="mb-1 mt-4 text-center text-[10px] font-semibold tracking-[0.2em] text-amber-100/70">
                ENTER YOUR TITLE
              </p>
              <p className="mb-3 text-center text-xs text-white/55">给自己起一个霸气的昵称吧</p>

              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={12}
                placeholder="例如：氪金女王"
                className="w-full rounded-xl border border-white/15 bg-black/25 px-4 py-3 text-center text-base font-medium text-white placeholder:text-white/30 outline-none ring-0 transition focus:border-amber-200/50 focus:bg-black/35"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && canSubmit) handleSubmit();
                }}
              />

              <button
                type="button"
                onClick={handleSubmit}
                disabled={!canSubmit}
                className="mt-4 w-full rounded-xl bg-gradient-to-r from-amber-300 via-fuchsia-400 to-pink-400 py-3.5 text-base font-bold text-white shadow-[0_10px_30px_rgba(236,72,153,0.35)] transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none"
              >
                {canSubmit ? '进入我的直播帝国 →' : '请先选择 AI 互动模式'}
              </button>

              <p className="mt-3 text-center text-[10px] leading-relaxed text-white/40">
                进入游戏后，可在「设置 → 角色」中随时修改此选项
              </p>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2 pb-2 text-[11px] text-white/45">
            <span>直播消费使用当前半糖身份的余额</span>
          </div>
        </div>
      </div>
    </div>
  );
}
