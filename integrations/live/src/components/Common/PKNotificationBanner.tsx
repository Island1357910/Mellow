import { useEffect, useRef, useState } from 'react';
import { getAnchorById } from '../../data/anchors';
import { useAnchorStore } from '../../stores/useAnchorStore';
import { useNavStore } from '../../stores/useNavStore';
import { usePKStore } from '../../stores/usePKStore';

/** 关注的主播进入 PK 时，在页面顶部弹出提示 */
export default function PKNotificationBanner() {
  const push = useNavStore((s) => s.push);
  const pkActive = usePKStore((s) => s.active);
  const mode = usePKStore((s) => s.mode);
  const participants = usePKStore((s) => s.participants);
  const anchorAId = usePKStore((s) => s.anchorA);
  const anchorBId = usePKStore((s) => s.anchorB);
  const endTime = usePKStore((s) => s.endTime);
  const followedIds = useAnchorStore((s) => s.followedIds);

  const [visible, setVisible] = useState(false);
  const [text, setText] = useState('');
  const shownKeyRef = useRef('');

  useEffect(() => {
    if (!pkActive || !endTime) {
      setVisible(false);
      return;
    }

    const ids =
      mode === 'squad' && participants.length === 4
        ? participants
        : [anchorAId, anchorBId].filter(Boolean) as string[];
    if (ids.length < 2) {
      setVisible(false);
      return;
    }

    const pkKey = `${ids.join('_')}_${endTime}`;
    if (shownKeyRef.current === pkKey) return;

    const followedInPk = ids.filter((id) => followedIds.includes(id));
    if (followedInPk.length === 0) return;

    shownKeyRef.current = pkKey;
    const names = followedInPk
      .map((id) => getAnchorById(id)?.stageName)
      .filter(Boolean) as string[];

    if (mode === 'squad') {
      setText(
        names.length >= 2
          ? `你关注的 ${names.slice(0, 2).join('、')} 等正在四人 PK！`
          : `你关注的 ${names[0]} 正在四人 PK！`
      );
    } else if (followedInPk.length >= 2 && anchorAId && anchorBId) {
      const a = getAnchorById(anchorAId);
      const b = getAnchorById(anchorBId);
      setText(`你关注的 ${a?.stageName} 和 ${b?.stageName} 正在 PK！`);
    } else {
      const mine = getAnchorById(followedInPk[0]);
      const oppId = ids.find((id) => id !== followedInPk[0]);
      const opp = oppId ? getAnchorById(oppId) : null;
      setText(`你关注的 ${mine?.stageName} 正在和 ${opp?.stageName ?? '对手'} PK！`);
    }
    setVisible(true);

    const timer = setTimeout(() => setVisible(false), 8000);
    return () => clearTimeout(timer);
  }, [pkActive, mode, participants, anchorAId, anchorBId, endTime, followedIds]);

  if (!visible) return null;

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-[80] flex justify-center px-3 pt-2">
      <div className="pointer-events-auto flex w-full max-w-md items-center gap-2 rounded-2xl border border-[#3d2a55] bg-[#1a0f2a] px-3 py-2.5 shadow-lg">
        <span className="text-[13px] font-black text-[#9b5cff]">PK</span>
        <p className="min-w-0 flex-1 truncate text-[13px] font-medium text-white">{text}</p>
        <button
          type="button"
          onClick={() => {
            setVisible(false);
            push('pkRoom');
          }}
          className="shrink-0 rounded-full bg-[#9b5cff] px-2.5 py-1 text-[11px] font-bold text-white active:scale-95"
        >
          去围观
        </button>
        <button
          type="button"
          onClick={() => setVisible(false)}
          className="shrink-0 px-1 text-[#9b8fb0] hover:text-white"
          aria-label="关闭"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
