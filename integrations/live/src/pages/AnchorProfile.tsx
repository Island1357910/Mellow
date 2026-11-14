import StatusBar from '../components/Phone/StatusBar';
import ScreenHeader from '../components/Common/ScreenHeader';
import AnchorImage from '../components/Common/AnchorImage';
import { getAnchorById } from '../data/anchors';
import { useAnchorStore } from '../stores/useAnchorStore';
import { getTodayScheduleDetail, getLiveStatusText } from '../data/schedules';
import { usePlayerStore } from '../stores/usePlayerStore';
import { useNavStore } from '../stores/useNavStore';
import { useGameTimeStore } from '../stores/useGameTimeStore';
import { isAnchorLive, tryEnterLiveRoom } from '../utils/liveRoomEntry';
import { host } from '../utils/mellowHost';
import { useToastStore } from '../stores/useToastStore';

export default function AnchorProfile({ anchorId }: { anchorId: string }) {
  const back = useNavStore((s) => s.back);
  const push = useNavStore((s) => s.push);
  const anchor = getAnchorById(anchorId);
  const runtime = useAnchorStore((s) => s.runtime[anchorId]);
  const isFollowed = useAnchorStore((s) => s.isFollowed(anchorId));
  const toggleFollow = useAnchorStore((s) => s.toggleFollow);
  const scheduleReminders = usePlayerStore((s) => s.scheduleReminders);
  const toggleScheduleReminder = usePlayerStore((s) => s.toggleScheduleReminder);
  const hasReminder = scheduleReminders.includes(anchorId);
  const clock = useGameTimeStore.getState().getClock();
  const isOnline = isAnchorLive(anchorId);

  if (!anchor) {
    return <div className="flex h-full items-center justify-center bg-white text-[#536471]">主播不存在</div>;
  }

  const handle = `@${anchor.realName.replace(/\s+/g, '').toLowerCase()}`;

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <StatusBar />
      <ScreenHeader
        title="主页"
        onBack={back}
        right={
          anchor.isCustom ? (
            <button
              type="button"
              onClick={() => push('customAnchorEditor', { anchorId })}
              className="text-[13px] font-bold text-[#1d9bf0]"
            >
              编辑
            </button>
          ) : undefined
        }
      />
      <div className="flex shrink-0 gap-2 border-b border-slate-100 px-4 py-2">
        {(['sms', 'offline'] as const).map(mode => (
          <button key={mode} type="button" className="rounded-full border border-slate-200 px-3 py-1 text-xs font-bold text-[#1d9bf0]" onClick={() => {
            void host()?.connect(anchor, mode).catch(error => useToastStore.getState().show(error instanceof Error ? error.message : '打开失败'));
          }}>{mode === 'sms' ? '加入半糖短信' : '约线下见面'}</button>
        ))}
      </div>

      <div className="no-scrollbar flex-1 overflow-y-auto pb-8">
        <div className="h-28 bg-[#cfd9de]">
          {anchor.portraitUrl && (
            <AnchorImage anchor={anchor} className="h-full w-full opacity-60 blur-[1px]" />
          )}
        </div>

        <div className="relative px-4">
          <div className="-mt-10 h-[84px] w-[84px] overflow-hidden rounded-full border-4 border-white bg-white">
            <AnchorImage anchor={anchor} className="h-full w-full" />
          </div>

          <div className="mt-3 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="truncate text-[20px] font-extrabold leading-6 text-[#0f1419]">
                {anchor.stageName}
                {anchor.isCustom ? (
                  <span className="ml-2 align-middle text-[12px] font-bold text-[#1d9bf0]">自定义</span>
                ) : null}
              </h1>
              <p className="mt-0.5 text-[15px] text-[#536471]">{handle}</p>
            </div>
            <button
              type="button"
              onClick={() => toggleFollow(anchorId)}
              className={`shrink-0 rounded-full px-4 py-1.5 text-[14px] font-bold transition active:scale-95 ${
                isFollowed
                  ? 'border border-[#cfd9de] text-[#0f1419] hover:border-[#f4212e] hover:text-[#f4212e]'
                  : 'bg-[#0f1419] text-white hover:bg-[#272c30]'
              }`}
            >
              {isFollowed ? '正在关注' : '关注'}
            </button>
          </div>

          <p className="mt-3 text-[15px] leading-5 text-[#0f1419]">
            {anchor.tag}
            {anchor.isHuman === false ? ` · ${anchor.species}` : ''}
            {' · '}
            {anchor.ageLabel ?? `${anchor.age}岁`}
          </p>
          <p className="mt-2 text-[14px] leading-5 text-[#536471]">{anchor.background}</p>

          {runtime && (
            <p className="mt-3 text-[14px] text-[#536471]">
              <span className={isOnline ? 'font-bold text-[#00ba7c]' : ''}>
                {getLiveStatusText(anchorId, runtime.isOnline, clock)}
              </span>
              {' · '}好感 {Math.floor(runtime.favor)}
              {runtime.activity ? ` · ${runtime.activity.icon} ${runtime.activity.label}` : ''}
            </p>
          )}
        </div>

        <div className="mt-4 border-t border-[#eff3f4]">
          <InfoBlock title="直播时间" content={getTodayScheduleDetail(anchorId, clock)} />
          {anchor.isHuman === false && (
            <>
              <InfoBlock title="物种" content={`${anchor.speciesCategory ?? ''}·${anchor.species ?? ''}`} />
              {anchor.appearance && <InfoBlock title="外貌" content={anchor.appearance} />}
            </>
          )}
          {anchor.appearance && anchor.isHuman !== false && (
            <InfoBlock title="外貌" content={anchor.appearance} />
          )}
          <InfoBlock title="性格" content={anchor.personality} />
          <InfoBlock title="说话风格" content={anchor.speakingStyle} />
          <InfoBlock title="绿茶属性" content={anchor.greenTeaStyle} />
          {anchor.tipStyle && <InfoBlock title="求赏方式" content={anchor.tipStyle} />}
          {anchor.chatStyle && <InfoBlock title="私信风格" content={anchor.chatStyle} />}
          {anchor.presets?.catchphrases && anchor.presets.catchphrases.length > 0 && (
            <InfoBlock title="口头禅" content={anchor.presets.catchphrases.join(' / ')} />
          )}
        </div>

        <div className="mt-4 flex flex-col gap-2 px-4">
          <button
            type="button"
            onClick={() => toggleScheduleReminder(anchorId)}
            className={`w-full rounded-full border py-2.5 text-[14px] font-bold transition active:scale-95 ${
              hasReminder
                ? 'border-[#1d9bf0] bg-[#e8f5fd] text-[#1d9bf0]'
                : 'border-[#cfd9de] text-[#0f1419]'
            }`}
          >
            {hasReminder ? '已开启开播提醒' : '开启开播提醒'}
          </button>
          <button
            type="button"
            onClick={() => tryEnterLiveRoom(anchorId)}
            disabled={!isOnline}
            className={`w-full rounded-full py-2.5 text-[15px] font-bold transition active:scale-95 ${
              isOnline
                ? 'bg-[#1d9bf0] text-white hover:bg-[#1a8cd8]'
                : 'bg-[#eff3f4] text-[#536471]'
            }`}
          >
            {isOnline ? '进入直播间' : '暂未开播'}
          </button>
        </div>
      </div>
    </div>
  );
}

function InfoBlock({ title, content }: { title: string; content: string }) {
  return (
    <div className="border-b border-[#eff3f4] px-4 py-3">
      <p className="mb-1 text-[13px] font-bold text-[#536471]">{title}</p>
      <p className="text-[15px] leading-5 text-[#0f1419]">{content}</p>
    </div>
  );
}
