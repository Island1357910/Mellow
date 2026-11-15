/** 对话 speaker 名 → 立绘 key（仅主要角色在 characterPortraits 中有图，配角映射后亦无立绘） */
export function resolveStoryPortraitName(speaker) {
  if (!speaker) return null;
  if (speaker === '沈国良') return '外祖父';
  if (speaker === '赵秀英') return '外祖母';
  if (speaker === '老太太') return '孙老太';
  if (speaker === '酱料铺老板') return '王奶奶';
  return speaker;
}
