import { useState, useEffect } from 'react';
import { getMainCastPortraitUrlForSpeaker } from '../../data/characterPortraits';
import { STORY_CHOICE_KEYS } from '../../data/storyData';
import './BakeryRPGDialogueView.css';

const HERO = '林千穗';

function mapBeatToVisual(beat) {
  if (!beat) return null;
  if (beat.kind === 'scene') {
    return {
      speaker: '【场景】',
      text: beat.text,
      showLeft: false,
      showRight: false,
    };
  }
  if (beat.kind === 'narration') {
    return {
      speaker: '旁白',
      text: beat.text,
      showLeft: false,
      showRight: false,
    };
  }
  if (beat.kind !== 'say') return null;

  const url = getMainCastPortraitUrlForSpeaker(beat.speaker);
  const isHero = beat.speaker === HERO;

  if (!url) {
    return {
      speaker: beat.speaker,
      text: beat.text,
      showLeft: false,
      leftUrl: null,
      showRight: false,
      rightUrl: null,
      highlightLeft: false,
      highlightRight: false,
    };
  }

  if (isHero) {
    return {
      speaker: beat.speaker,
      text: beat.text,
      showLeft: true,
      leftUrl: url,
      showRight: false,
      rightUrl: null,
      highlightLeft: true,
      highlightRight: false,
    };
  }

  return {
    speaker: beat.speaker,
    text: beat.text,
    showLeft: false,
    leftUrl: null,
    showRight: true,
    rightUrl: url,
    highlightLeft: false,
    highlightRight: true,
  };
}

/**
 * 全屏 RPG 对话：底图 + 仅主要角色发言时显示单侧立绘 + 下方对话框
 */
export default function BakeryRPGDialogueView({
  open,
  onClose,
  title,
  bgUrl,
  chapter,
  /** 主线章节索引；人物志模式传 -1 */
  chapterIndex = -1,
  completedUpTo,
  storyChoices,
  dispatch,
  /** 'chapter' = 主线（含第九章分支与已读标记）；'archive' = 人物志 */
  variant = 'chapter',
}) {
  const beats = chapter?.beats || [];
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (open) setIdx(0);
  }, [open, chapter?.id]);

  if (!open || !chapter) return null;

  const atEnd = idx >= beats.length;
  const beat = beats[idx];
  const node = !atEnd ? mapBeatToVisual(beat) : null;

  const isMain = variant === 'chapter';
  const isNextTarget = isMain && chapterIndex === (completedUpTo ?? -1) + 1;
  const ch9ChoiceDone = !isMain || chapterIndex !== 8 || storyChoices?.[STORY_CHOICE_KEYS.ch5] != null;

  const handleAdvance = () => {
    if (atEnd) return;
    if (idx >= beats.length - 1) setIdx(beats.length);
    else setIdx((i) => i + 1);
  };

  return (
    <div className="bakery-story-overlay" onClick={handleAdvance}>
      <div className="bakery-story-scene">
        {bgUrl ? (
          <div
            className="bakery-story-bg-image"
            style={{ backgroundImage: `url(${bgUrl})` }}
            aria-hidden
          />
        ) : null}
        <div className="bakery-story-vignette" aria-hidden />

        {!atEnd && node?.showLeft && node.leftUrl && (
          <div
            className={`bakery-story-portrait bakery-story-portrait-left ${
              node.highlightLeft ? 'highlight' : 'dimmed'
            }`}
          >
            <img src={node.leftUrl} alt="" className="bakery-story-portrait-img" />
          </div>
        )}
        {!atEnd && node?.showRight && node.rightUrl && (
          <div
            className={`bakery-story-portrait bakery-story-portrait-right ${
              node.highlightRight ? 'highlight' : 'dimmed'
            }`}
          >
            <img src={node.rightUrl} alt="" className="bakery-story-portrait-img" />
          </div>
        )}

        <div className="bakery-story-dialogue-area">
          <h3 className="bakery-story-title">{title}</h3>
          <div className="bakery-story-box">
            {!atEnd && node ? (
              <>
                <span className="bakery-story-speaker">{node.speaker}</span>
                <p className="bakery-story-text">{node.text}</p>
                <span className="bakery-story-hint">
                  {idx >= beats.length - 1 ? '点击屏幕继续…' : '点击屏幕继续…'}
                </span>
              </>
            ) : (
              <div className="bakery-story-end" onClick={(e) => e.stopPropagation()}>
                <span className="bakery-story-speaker">本章结束</span>
                <p className="bakery-story-text">
                  {variant === 'archive' && chapter.synopsis
                    ? chapter.synopsis
                    : '关闭后可在列表中重读；主线请在下方标记「本章已读」以解锁下一章。'}
                </p>
                {isMain && chapterIndex === 8 && chapter.choices && !ch9ChoiceDone ? (
                  <div className="bakery-story-choices">
                    <p className="bakery-story-choice-hint">第九章 · 你的选择会影响结局倾向：</p>
                    {chapter.choices.map((c) => (
                      <button
                        key={c.key}
                        type="button"
                        className="btn btn-secondary bakery-story-choice-btn"
                        onClick={() => dispatch({ type: 'SET_STORY_CHOICE', patch: c.flag })}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                ) : null}
                {isMain && isNextTarget && (chapterIndex !== 8 || ch9ChoiceDone) ? (
                  <button
                    type="button"
                    className="btn btn-primary bakery-story-end-btn"
                    onClick={() => {
                      dispatch({ type: 'COMPLETE_MAIN_STORY_CHAPTER', chapterIndex: chapterIndex });
                      onClose();
                    }}
                  >
                    标记「本章已读」
                  </button>
                ) : null}
                {variant === 'archive' ? (
                  <button
                    type="button"
                    className="btn btn-secondary bakery-story-end-btn"
                    onClick={() => setIdx(0)}
                  >
                    从头重读
                  </button>
                ) : null}
                <button type="button" className="btn btn-tiny bakery-story-end-btn" onClick={onClose}>
                  关闭
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
