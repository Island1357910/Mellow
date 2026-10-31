import type { Theme } from '../types/index.ts'
import { BUNDLED_THEMES } from './themes.ts'
const base=BUNDLED_THEMES.find(t=>t.id==='theme_macaron')!
export const APPLE_THEME:Theme={...base,id:'theme_red_apple_love',name:'红苹果爱恋',customPalette:true,logo:{primary:'#B82E43',secondary:'#688849',accent:'#DFB957'},colors:{primary:'#B82E43',secondary:'#DCA38C',background:'#FFF4E4',surface:'#FFF8EC',text:'#482A2C',textSecondary:'#77594F',accent:'#688849',success:'#688849',warning:'#C08635',error:'#B32D42'},shadow:{sm:'0 5px 16px #8e353115',md:'0 12px 32px #8e353120',lg:'0 22px 48px #8e353128'}}
