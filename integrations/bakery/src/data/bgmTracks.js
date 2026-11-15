/**
 * 与 public/music 下的文件名一一对应。
 * 店内曲可在设置页从「已解锁」列表中选择；解锁后收录自对应主线/人物志章节。
 */
export const BGM_TRACKS = [
  { id: 'default-warm', title: '万花筒香气', file: '默认游戏背景音乐（轻快温暖）.mp3' },
  { id: 'story-depress', title: '主线 · 压抑难过', file: '主线剧情音乐（压抑难过）.mp3' },
  { id: 'story-relief', title: '主线 · 和解欣慰', file: '主线剧情音乐（和解欣慰）.mp3' },
  { id: 'story-harmony', title: '主线 · 圆满和谐', file: '主线剧情音乐（圆满和谐）.mp3' },
  { id: 'story-anxiety', title: '主线 · 紧张焦虑', file: '主线剧情音乐（紧张焦虑）.mp3' },
  { id: 'char-xiaoqing', title: '角色 · 小晴', file: '小晴.mp3' },
  { id: 'char-fanghe', title: '方河', file: '方河.mp3' },
  { id: 'char-linqiansui', title: '角色 · 林千穗', file: '林千穗.mp3' },
  { id: 'char-linguodong', title: '角色 · 林国栋', file: '林国栋.mp3' },
  { id: 'char-shenguoliang', title: '角色 · 沈国良', file: '沈国良.mp3' },
  { id: 'char-shenruotang', title: '角色 · 沈若棠', file: '沈若棠.mp3' },
  { id: 'char-zhaoxiuying', title: '角色 · 赵秀英', file: '赵秀英.mp3' },
  { id: 'char-chenmanhua', title: '角色 · 陈曼华', file: '陈曼华.mp3' },
];

/** 首次进入游戏时的默认背景音乐 */
export const DEFAULT_BGM_ID = 'default-warm';

export function getBgmTrackById(id) {
  return BGM_TRACKS.find((t) => t.id === id) || BGM_TRACKS[0];
}

export function getBgmFileUrl(file) {
  const base = import.meta.env.BASE_URL || '/';
  const prefix = base.endsWith('/') ? base : `${base}/`;
  return `${prefix}music/${encodeURIComponent(file)}`;
}

export function getBgmUrlForTrackId(trackId) {
  const t = getBgmTrackById(trackId);
  return getBgmFileUrl(t.file);
}
