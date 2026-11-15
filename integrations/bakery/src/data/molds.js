/** volumeG 为单个模具可容纳面团克数，用于计算每批能做几个；breadType 为制作出的面包类型名 */
export const breadMolds = [
  { id: 'round', name: '圆模', shape: 'round', icon: '⭕', bonus: {}, volumeG: 350, breadType: '圆面包' },
  { id: 'loaf', name: '吐司盒', shape: 'loaf', icon: '📦', bonus: { 柔软度: 1 }, volumeG: 450, breadType: '吐司面包' },
  { id: 'braided', name: '编花盘', shape: 'braided', icon: '〰️', bonus: { 复杂度: 1 }, volumeG: 400, breadType: '花圈面包' },
  { id: 'baguette', name: '法棍槽', shape: 'baguette', icon: '🥖', bonus: { 香气: 1 }, volumeG: 250, breadType: '法棍' },
  { id: 'bun', name: '餐包盘', shape: 'bun', icon: '🍞', bonus: { 甜度: 1 }, volumeG: 60, breadType: '圆面包' },
  { id: 'triangle', name: '三角盘', shape: 'round', icon: '🔺', bonus: { 甜度: 1 }, volumeG: 90, breadType: '三角面包' },
  { id: 'ring', name: '环形模', shape: 'round', icon: '🍩', bonus: { 甜度: 1 }, volumeG: 300, breadType: '花圈面包' },
  { id: 'bagel', name: '贝果模', shape: 'round', icon: '🥯', bonus: { 柔软度: 1 }, volumeG: 120, breadType: '贝果' },
  { id: 'muffin', name: '玛芬杯', shape: 'round', icon: '🧁', bonus: { 甜度: 1 }, volumeG: 70, breadType: '玛芬面包' },
  { id: 'ciabatta', name: '恰巴塔盘', shape: 'loaf', icon: '🍞', bonus: { 香气: 1 }, volumeG: 280, breadType: '乡村面包' },
  { id: 'croissant', name: '可颂卷模', shape: 'round', icon: '🥐', bonus: { 复杂度: 1 }, volumeG: 100, breadType: '可颂' },
  { id: 'focaccia', name: '佛卡夏盘', shape: 'loaf', icon: '🫓', bonus: { 香气: 1 }, volumeG: 320, breadType: '佛卡夏面包' },
  { id: 'cinnamon', name: '肉桂卷模', shape: 'round', icon: '🌀', bonus: { 甜度: 1 }, volumeG: 85, breadType: '肉桂卷' },
  { id: 'pretzel', name: '德国结盘', shape: 'round', icon: '🥨', bonus: { 香气: 1 }, volumeG: 150, breadType: '德国结' },
  { id: 'longloaf', name: '长面包槽', shape: 'baguette', icon: '🥖', bonus: { 香气: 1 }, volumeG: 220, breadType: '长面包' },
  { id: 'wafu', name: '和风面包盘', shape: 'loaf', icon: '🍙', bonus: { 柔软度: 1 }, volumeG: 200, breadType: '和风面包' },
  { id: 'salt', name: '盐面包模', shape: 'round', icon: '🧂', bonus: { 香气: 1 }, volumeG: 85, breadType: '盐面包' },
  { id: 'drum', name: '大鼓模', shape: 'round', icon: '🥁', bonus: { 柔软度: 1 }, volumeG: 200, breadType: '大鼓面包' },
  { id: 'euro', name: '欧包盘', shape: 'round', icon: '🌾', bonus: { 香气: 1 }, volumeG: 380, breadType: '欧包' },
  { id: 'alkaline', name: '碱水模', shape: 'round', icon: '🥨', bonus: { 香气: 1 }, volumeG: 140, breadType: '碱水包' },
];

export function getMoldById(id) {
  return breadMolds.find((m) => m.id === id) || breadMolds[0];
}
