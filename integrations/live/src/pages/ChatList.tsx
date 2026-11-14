import StatusBar from '../components/Phone/StatusBar';
import ScreenHeader from '../components/Common/ScreenHeader';
import Avatar from '../components/Common/Avatar';
import { anchorAvatarProps } from '../components/Common/AnchorImage';
import { getAllAnchors } from '../data/anchors';
import { useAnchorStore } from '../stores/useAnchorStore';
import { useChatStore } from '../stores/useChatStore';
import { useNavStore } from '../stores/useNavStore';

export default function ChatList() {
  const back = useNavStore((s) => s.back);
  const push = useNavStore((s) => s.push);
  const runtimeMap = useAnchorStore((s) => s.runtime);
  const sessions = useChatStore((s) => s.sessions);

  const contacts = getAllAnchors().map((anchor) => ({
    anchor,
    favor: runtimeMap[anchor.id]?.favor ?? 0,
    session: sessions[anchor.id],
  }))
    .filter((c) => c.favor > 0 || c.session)
    .sort((a, b) => (b.session?.lastTimestamp ?? 0) - (a.session?.lastTimestamp ?? 0) || b.favor - a.favor);

  return (
    <div className="flex h-full flex-col bg-white">
      <StatusBar />
      <ScreenHeader
        title="私信"
        onBack={back}
        right={
          <button
            type="button"
            onClick={() => push('moments')}
            className="text-[13px] font-bold text-[#1d9bf0]"
          >
            朋友圈
          </button>
        }
      />

      {contacts.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-8 text-center text-[#536471]">
          <p className="text-[15px] font-bold text-[#0f1419]">还没有私信</p>
          <p className="text-[13px]">去直播间互动后，主播会主动找你聊天</p>
        </div>
      ) : (
        <div className="no-scrollbar flex-1 overflow-y-auto">
          {contacts.map(({ anchor, session, favor }) => (
            <button
              key={anchor.id}
              onClick={() => push('chatDetail', { anchorId: anchor.id })}
              className="flex w-full items-center gap-3 border-b border-[#eff3f4] px-4 py-3 text-left hover:bg-black/[0.03] active:bg-black/[0.05]"
            >
              <div className="relative">
                <Avatar {...anchorAvatarProps(anchor)} size={46} />
                {session?.unread && (
                  <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-white bg-red-500" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <p className="truncate text-[14px] font-semibold text-slate-800">{anchor.stageName}</p>
                  {session && <span className="shrink-0 text-[10px] text-slate-300">{formatTime(session.lastTimestamp)}</span>}
                </div>
                <p className="truncate text-[12px] text-slate-400">
                  {session ? session.lastMessage : `好感度 ${Math.floor(favor)} · 点击开始聊天`}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function formatTime(ts: number) {
  const d = new Date(ts);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  }
  return `${d.getMonth() + 1}/${d.getDate()}`;
}
