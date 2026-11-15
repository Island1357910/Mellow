/** 剧情立绘仅配置「人物小传」中的主要角色；其余配角对白不显示立绘 */
import { resolveStoryPortraitName } from './storyPortrait';

export const CHARACTER_PORTRAIT_URL_BY_NAME = {
  林千穗: 'https://drive.mujian.me/f/Xn8sm/%E6%9E%97%E5%8D%83%E7%A9%97.png',
  沈若棠: 'https://drive.mujian.me/f/2G2cR/%E5%B9%B4%E8%BD%BB%E7%9A%84%E6%B2%88%E8%8B%A5%E6%A3%A0.png',
  陈曼华: 'https://drive.mujian.me/f/wBwtK/%E9%99%88%E6%9B%BC%E5%8D%8E.png',
  方河: 'https://drive.mujian.me/f/m88fg/%E6%96%B9%E6%98%8E%E8%BF%9C.png',
  小晴: 'https://drive.mujian.me/f/KJqTv/%E5%B0%8F%E6%99%B4.png',
  林国栋: 'https://drive.mujian.me/f/0GWix/%E6%9E%97%E5%9B%BD%E6%A0%8B.png',
  外祖父: 'https://drive.mujian.me/f/GyztW/%E5%A4%96%E7%A5%96%E7%88%B6.png',
  外祖母: 'https://drive.mujian.me/f/xDESn/%E5%A4%96%E7%A5%96%E6%AF%8D.png',
};

/** 与 storyData.js「人物」列表一致，经 resolveStoryPortraitName 后的立绘 key */
export const MAIN_STORY_PORTRAIT_KEYS = new Set(Object.keys(CHARACTER_PORTRAIT_URL_BY_NAME));

/**
 * 仅主要角色返回立绘 URL；配角/路人返回 null（对白界面留空）。
 */
export function getMainCastPortraitUrlForSpeaker(speaker) {
  const key = resolveStoryPortraitName(speaker);
  if (!key || !MAIN_STORY_PORTRAIT_KEYS.has(key)) return null;
  return CHARACTER_PORTRAIT_URL_BY_NAME[key] ?? null;
}
