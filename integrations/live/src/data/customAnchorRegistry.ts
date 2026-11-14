import type { AnchorProfile } from '../types';

/** 自定义主播运行时注册表，避免 anchors ↔ store 循环依赖 */
let customAnchors: AnchorProfile[] = [];

export function setCustomAnchorsRegistry(list: AnchorProfile[]) {
  customAnchors = list;
}

export function getCustomAnchorsRegistry(): AnchorProfile[] {
  return customAnchors;
}
