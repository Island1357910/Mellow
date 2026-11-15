/**
 * 烘焙进度 0–100，与 Context 状态解耦，避免每帧 setState 导致整棵 GameShell 重绘、百分比卡住。
 */
let pct = 0;
const listeners = new Set();

export function subscribeBakingPct(onChange) {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

export function getBakingPctSnapshot() {
  return pct;
}

export function setBakingPct(next) {
  pct = next;
  listeners.forEach((l) => l());
}
