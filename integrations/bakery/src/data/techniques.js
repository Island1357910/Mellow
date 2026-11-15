/** 手法与理想炉温（℃），影响品质系数 */
export const bakeTechniques = [
  { id: 'direct', name: '直接法', desc: '一次性揉面发酵，适合日常餐包', idealTempMin: 175, idealTempMax: 195 },
  { id: 'sponge', name: '中种法', desc: '先种后面，组织更绵密', idealTempMin: 165, idealTempMax: 185 },
  { id: 'tangzhong', name: '汤种法', desc: '糊化淀粉锁水，偏低温慢烤', idealTempMin: 155, idealTempMax: 175 },
  { id: 'poolish', name: '液种法', desc: '液态酵头，气孔细腻', idealTempMin: 190, idealTempMax: 210 },
  { id: 'overnight', name: '隔夜发酵', desc: '低温长时间发酵，风味醇厚', idealTempMin: 195, idealTempMax: 215 },
  { id: 'laminated', name: '开酥法', desc: '黄油裹入折叠，层次酥脆', idealTempMin: 185, idealTempMax: 205 },
  { id: 'autolyse', name: '自解法', desc: '先水合静置，再加盐酵母', idealTempMin: 200, idealTempMax: 220 },
  { id: 'fold', name: '折叠法', desc: '多次折叠增强筋性', idealTempMin: 185, idealTempMax: 205 },
  { id: 'sourdough', name: '酸种法', desc: '天然酵种长时间发酵', idealTempMin: 210, idealTempMax: 235 },
];

export function techniqueQualityFactor(techniqueId, bakeTempC) {
  const t = bakeTechniques.find((x) => x.id === techniqueId) || bakeTechniques[0];
  if (!t.idealTempMin || !t.idealTempMax) return 0.9;
  const mid = (t.idealTempMin + t.idealTempMax) / 2;
  const span = (t.idealTempMax - t.idealTempMin) / 2 + 1e-6;
  const dist = Math.abs(bakeTempC - mid);
  const raw = 1 - dist / (span * 2.5);
  return Math.max(0.55, Math.min(1.12, raw));
}
