import { useEffect, useMemo, useState } from 'react';
import StatusBar from '../components/Phone/StatusBar';
import ScreenHeader from '../components/Common/ScreenHeader';
import ScrollTabs from '../components/Common/ScrollTabs';
import Avatar from '../components/Common/Avatar';
import AnchorImage, { anchorAvatarProps } from '../components/Common/AnchorImage';
import PKBattleCard from '../components/LiveList/PKBattleCard';
import RecommendSwipeDeck from '../components/LiveList/RecommendSwipeDeck';
import { getLiveStatusText } from '../data/schedules';
import { useGameTimeStore } from '../stores/useGameTimeStore';
import { getAllAnchors } from '../data/anchors';
import { useAnchorStore } from '../stores/useAnchorStore';
import { useCustomAnchorStore } from '../stores/useCustomAnchorStore';
import { useNavStore } from '../stores/useNavStore';
import { usePKStore } from '../stores/usePKStore';
import { usePKCountdown } from '../hooks/usePK';
import { isAnchorLive, tryEnterLiveRoom } from '../utils/liveRoomEntry';
import { tryStartPK, tryStartSquadPK } from '../utils/pkMatch';
import { useToastStore } from '../stores/useToastStore';
import { LIVE } from '../theme/liveTheme';
import type { SpeciesCategory } from '../types';

type Filter =
  | '推荐'
  | '全部'
  | '在线'
  | '关注'
  | '自定义'
  | 'PK中'
  | '人类'
  | '非人类'
  | SpeciesCategory;

type PkPickKind = 'duo' | 'squad';

const FILTERS: Filter[] = [
  '推荐',
  '全部',
  '在线',
  '关注',
  '自定义',
  'PK中',
  '人类',
  '非人类',
  '神明',
  '恶魔',
  '天使',
  '魅魔',
];

export default function LiveList() {
  const back = useNavStore((s) => s.back);
  const push = useNavStore((s) => s.push);
  const runtimeMap = useAnchorStore((s) => s.runtime);
  const followedIds = useAnchorStore((s) => s.followedIds);
  const ensureInit = useAnchorStore((s) => s.ensureInit);
  const customAnchors = useCustomAnchorStore((s) => s.anchors);
  const pkActive = usePKStore((s) => s.active);
  const pkMode = usePKStore((s) => s.mode);
  const pkParticipants = usePKStore((s) => s.participants);
  const pkScores = usePKStore((s) => s.scores);
  const pkAnchorA = usePKStore((s) => s.anchorA);
  const pkAnchorB = usePKStore((s) => s.anchorB);
  const scoreA = usePKStore((s) => s.scoreA);
  const scoreB = usePKStore((s) => s.scoreB);
  const { label, isUrgent } = usePKCountdown();
  const clock = useGameTimeStore.getState().getClock();
  const [filter, setFilter] = useState<Filter>('推荐');
  const [pkPickMode, setPkPickMode] = useState(false);
  const [pkPickKind, setPkPickKind] = useState<PkPickKind>('duo');
  const [pkPicked, setPkPicked] = useState<string[]>([]);

  useEffect(() => {
    ensureInit();
  }, [ensureInit, customAnchors.length]);

  const allAnchors = useMemo(() => getAllAnchors(), [customAnchors]);
  const pkNeed = pkPickKind === 'squad' ? 4 : 2;

  const pkAnchorSet = useMemo(() => {
    if (!pkActive) return new Set<string>();
    if (pkParticipants.length > 0) return new Set(pkParticipants);
    if (!pkAnchorA || !pkAnchorB) return new Set<string>();
    return new Set([pkAnchorA, pkAnchorB]);
  }, [pkActive, pkParticipants, pkAnchorA, pkAnchorB]);

  const list = useMemo(() => {
    if (filter === '推荐') return [];
    return allAnchors
      .map((a) => {
        const r = runtimeMap[a.id];
        return { anchor: a, runtime: r };
      })
      .filter(({ anchor, runtime }) => {
        if (pkAnchorSet.has(anchor.id)) return false;
        if (filter === '全部') return true;
        if (filter === '在线') return runtime?.isOnline !== false;
        if (filter === '关注') return followedIds.includes(anchor.id);
        if (filter === '自定义') return anchor.isCustom === true;
        if (filter === 'PK中') return false;
        if (filter === '人类') return anchor.isHuman !== false;
        if (filter === '非人类') return anchor.isHuman === false;
        if (filter === '神明' || filter === '恶魔' || filter === '天使' || filter === '魅魔') {
          return anchor.speciesCategory === filter;
        }
        return true;
      })
      .sort((a, b) => (b.runtime?.currentViewers ?? 0) - (a.runtime?.currentViewers ?? 0));
  }, [allAnchors, runtimeMap, filter, followedIds, pkAnchorSet]);

  const openProfile = (anchorId: string) => {
    if (pkPickMode) {
      if (!isAnchorLive(anchorId)) {
        useToastStore.getState().show('未开播主播不能参加 PK，请选择直播中的主播');
        return;
      }
      setPkPicked((prev) => {
        if (prev.includes(anchorId)) return prev.filter((id) => id !== anchorId);
        if (prev.length >= pkNeed) return prev;
        return [...prev, anchorId];
      });
      return;
    }
    const runtime = runtimeMap[anchorId];
    const isOnline = runtime?.isOnline !== false;
    if (isOnline) {
      tryEnterLiveRoom(anchorId);
      return;
    }
    push('anchorProfile', { anchorId });
  };

  const startManualPK = () => {
    if (pkPicked.length !== pkNeed) return;
    const ok =
      pkPickKind === 'squad' ? tryStartSquadPK(pkPicked) : tryStartPK(pkPicked[0], pkPicked[1]);
    if (!ok) return;
    setPkPickMode(false);
    setPkPicked([]);
    push('pkRoom');
  };

  const showPkCard =
    filter !== '推荐' &&
    pkActive &&
    (pkMode === 'squad' ? pkParticipants.length === 4 : !!(pkAnchorA && pkAnchorB));

  return (
    <div className="flex h-full min-h-0 flex-col" style={{ background: LIVE.bg }}>
      <StatusBar />
      <ScreenHeader
        title="直播"
        onBack={back}
        tone="dark"
        right={
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => push('customAnchorEditor')}
              className="rounded-full px-2 py-1 text-[12px] font-bold text-[#9b5cff]"
            >
              创建
            </button>
            <button
              type="button"
              onClick={() => {
                setPkPickMode((v) => !v);
                setPkPicked([]);
                if (filter === '推荐' || filter === '全部') setFilter('在线');
              }}
              className={`rounded-full px-2.5 py-1 text-[12px] font-bold ${
                pkPickMode ? 'bg-[#9b5cff] text-white' : 'text-[#9b5cff]'
              }`}
            >
              PK
            </button>
          </div>
        }
      />

      {pkPickMode && (
        <div
          className="flex shrink-0 flex-col gap-2 border-b px-4 py-2.5 text-[12px]"
          style={{ borderColor: LIVE.border, background: LIVE.surface, color: LIVE.muted }}
        >
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setPkPickKind('duo');
                setPkPicked([]);
              }}
              className={`rounded-full px-2.5 py-1 font-bold ${
                pkPickKind === 'duo' ? 'bg-[#9b5cff] text-white' : 'border border-[#3d2a55] text-[#c4b5fd]'
              }`}
            >
              私人双人
            </button>
            <button
              type="button"
              onClick={() => {
                setPkPickKind('squad');
                setPkPicked([]);
              }}
              className={`rounded-full px-2.5 py-1 font-bold ${
                pkPickKind === 'squad' ? 'bg-[#9b5cff] text-white' : 'border border-[#3d2a55] text-[#c4b5fd]'
              }`}
            >
              多人四人
            </button>
            <button
              type="button"
              disabled={pkPicked.length !== pkNeed}
              onClick={startManualPK}
              className="ml-auto rounded-full bg-[#9b5cff] px-3 py-1 font-bold text-white disabled:opacity-40"
            >
              开始
            </button>
          </div>
          <span>
            {pkPickKind === 'squad'
              ? `选择 4 位直播中主播发起多人 PK（已选 ${pkPicked.length}/4）`
              : `选择 2 位直播中主播发起私人 PK（已选 ${pkPicked.length}/2）`}
          </span>
        </div>
      )}

      <ScrollTabs items={FILTERS} active={filter} onChange={setFilter} variant="underline" tone="dark" />

      {filter === '推荐' ? (
        <div className="min-h-0 flex-1">
          <RecommendSwipeDeck />
        </div>
      ) : (
        <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto">
          {showPkCard && (
            <div className="border-b px-4 py-3" style={{ borderColor: LIVE.border }}>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[13px] font-bold text-[#f3eef9]">正在进行的 PK</p>
                <span className={`text-[11px] font-bold ${isUrgent ? 'text-[#f4212e]' : 'text-[#9b8fb0]'}`}>
                  {label}
                </span>
              </div>
              {pkMode === 'squad' ? (
                <PKBattleCard
                  mode="squad"
                  participantIds={pkParticipants}
                  scores={pkScores}
                  countdown={label}
                  urgent={isUrgent}
                  onClick={() => push('pkRoom')}
                />
              ) : (
                <PKBattleCard
                  mode="duo"
                  anchorAId={pkAnchorA!}
                  anchorBId={pkAnchorB!}
                  scoreA={scoreA}
                  scoreB={scoreB}
                  countdown={label}
                  urgent={isUrgent}
                  variant="full"
                  onClick={() => push('pkRoom')}
                />
              )}
            </div>
          )}

          {filter === 'PK中' && !showPkCard && (
            <p className="py-16 text-center text-[14px] text-[#9b8fb0]">当前没有进行中的 PK</p>
          )}

          {filter === '自定义' && list.length === 0 && (
            <div className="flex flex-col items-center px-8 py-16 text-center">
              <p className="text-[15px] font-bold text-[#f3eef9]">还没有自定义主播</p>
              <p className="mt-2 text-[13px] text-[#9b8fb0]">上传立绘、细写人设与预设口播，打造专属主播</p>
              <button
                type="button"
                onClick={() => push('customAnchorEditor')}
                className="mt-4 rounded-full bg-[#9b5cff] px-5 py-2 text-[14px] font-bold text-white"
              >
                立即创建
              </button>
            </div>
          )}

          {list.map(({ anchor, runtime }) => {
            const selected = pkPicked.includes(anchor.id);
            const isFollowed = followedIds.includes(anchor.id);
            const isOnline = runtime?.isOnline === true;
            const pkDisabled = pkPickMode && !isOnline;
            const handle = `@${anchor.realName.replace(/\s+/g, '').toLowerCase()}`;
            const subtitle = isOnline
              ? anchor.isHuman === false
                ? `${anchor.species} · ${anchor.tag}`
                : anchor.tag
              : getLiveStatusText(anchor.id, false, clock);

            return (
              <button
                key={anchor.id}
                type="button"
                onClick={() => openProfile(anchor.id)}
                className={`flex w-full gap-3 border-b px-4 py-3 text-left transition active:bg-white/5 ${
                  selected ? 'bg-[#9b5cff]/15' : ''
                } ${!isOnline || pkDisabled ? 'opacity-45' : ''}`}
                style={{ borderColor: LIVE.borderSoft }}
              >
                <div className="relative shrink-0">
                  <div className="h-[52px] w-[52px] overflow-hidden rounded-full ring-1 ring-[#3d2a55]">
                    {anchor.portraitUrl ? (
                      <AnchorImage anchor={anchor} className="h-full w-full" />
                    ) : (
                      <Avatar {...anchorAvatarProps(anchor)} size={52} />
                    )}
                  </div>
                  {isOnline && (
                    <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-[#0c0614] bg-[#a78bfa]" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-[15px] font-bold leading-5 text-[#f3eef9]">
                        {anchor.stageName}
                        {anchor.isCustom ? (
                          <span className="ml-1 text-[11px] font-bold text-[#9b5cff]">自定义</span>
                        ) : null}
                      </p>
                      <p className="truncate text-[13px] leading-4 text-[#9b8fb0]">
                        {handle}
                        {anchor.isHuman === false ? ` · ${anchor.speciesCategory}` : ''}
                      </p>
                    </div>
                    {pkPickMode ? (
                      <span
                        className={`shrink-0 rounded-full px-3 py-1 text-[12px] font-bold ${
                          selected
                            ? 'bg-[#9b5cff] text-white'
                            : pkDisabled
                              ? 'border border-[#3d2a55] text-[#9b8fb0]'
                              : 'border border-[#3d2a55] text-[#f3eef9]'
                        }`}
                      >
                        {selected ? '已选' : pkDisabled ? '未开播' : '选择'}
                      </span>
                    ) : isFollowed ? (
                      <span className="shrink-0 rounded-full border border-[#3d2a55] px-3 py-1 text-[12px] font-bold text-[#f3eef9]">
                        正在关注
                      </span>
                    ) : isOnline ? (
                      <span className="shrink-0 rounded-full bg-[#9b5cff] px-3 py-1 text-[12px] font-bold text-white">
                        直播中
                      </span>
                    ) : (
                      <span className="shrink-0 rounded-full border border-[#3d2a55] px-3 py-1 text-[12px] font-bold text-[#9b8fb0]">
                        休息中
                      </span>
                    )}
                  </div>
                  <p className="mt-1 line-clamp-2 text-[14px] leading-5 text-[#f3eef9]">{subtitle}</p>
                  <p className="mt-1.5 text-[13px] text-[#9b8fb0]">
                    {isOnline ? `${formatViewers(runtime?.currentViewers ?? 0)} 正在观看` : '暂时不在线'}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function formatViewers(n: number) {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}万`;
  return `${n}`;
}
