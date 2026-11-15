import { useBgm } from '../../context/BgmContext';
import { getBgmTrackById } from '../../data/bgmTracks';

export default function BgmPlayerCard() {
  const {
    menuSelectedTrackId,
    unlockedMenuTrackIds,
    setMenuTrackId,
    playing,
    volume,
    playBgm,
    stopBgm,
    setVolume,
    effectiveTrackId,
  } = useBgm();
  const displayTrack = getBgmTrackById(menuSelectedTrackId);
  const contextual = effectiveTrackId !== menuSelectedTrackId;

  return (
    <div className="bgm-player-card">
      <div className="bgm-player-card__visual" aria-hidden>
        <span className="bgm-player-card__disc">♪</span>
        <div className="bgm-player-card__wave">
          <span className={playing ? 'bgm-player-card__bar bgm-player-card__bar--on' : 'bgm-player-card__bar'} />
          <span className={playing ? 'bgm-player-card__bar bgm-player-card__bar--on' : 'bgm-player-card__bar'} />
          <span className={playing ? 'bgm-player-card__bar bgm-player-card__bar--on' : 'bgm-player-card__bar'} />
          <span className={playing ? 'bgm-player-card__bar bgm-player-card__bar--on' : 'bgm-player-card__bar'} />
        </div>
      </div>
      <div className="bgm-player-card__body">
        <div className="bgm-player-card__now">
          <span className="bgm-player-card__label">店内配乐</span>
          <strong className="bgm-player-card__title">{displayTrack.title}</strong>
          <span className="bgm-player-card__hint">
            解锁主线或人物志剧情后，章节内使用的乐曲会收入下列列表，可随时切换。
            {contextual && playing ? (
              <>
                <br />
                <span className="bgm-player-card__context-hint">
                  当前实际播放：{getBgmTrackById(effectiveTrackId).title}（剧情/人物志中）
                </span>
              </>
            ) : null}
          </span>
        </div>
        <div className="bgm-player-card__select-wrap">
          <label htmlFor="bgm-track-select" className="sr-only">
            选择已解锁配乐
          </label>
          <select
            id="bgm-track-select"
            className="drawer-input bgm-player-card__select"
            value={menuSelectedTrackId}
            onChange={(e) => setMenuTrackId(e.target.value)}
          >
            {unlockedMenuTrackIds.map((tid) => (
              <option key={tid} value={tid}>
                {getBgmTrackById(tid).title}
              </option>
            ))}
          </select>
        </div>
        <div className="bgm-player-card__transport">
          <button
            type="button"
            className="btn btn-accent bgm-player-card__btn-play"
            onClick={playBgm}
            disabled={playing}
            aria-pressed={playing}
          >
            ▶ 播放
          </button>
          <button
            type="button"
            className="btn btn-secondary bgm-player-card__btn-stop"
            onClick={stopBgm}
            disabled={!playing}
            aria-pressed={!playing}
          >
            ■ 停止
          </button>
        </div>
        <div className="bgm-player-card__volume">
          <label htmlFor="bgm-volume">音量</label>
          <input
            id="bgm-volume"
            type="range"
            min={0}
            max={1}
            step={0.02}
            value={volume}
            onChange={(e) => setVolume(Number(e.target.value))}
          />
          <span className="bgm-player-card__vol-num">{Math.round(volume * 100)}%</span>
        </div>
      </div>
    </div>
  );
}
