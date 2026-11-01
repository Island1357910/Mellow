import { storage } from '../storage/StorageService.ts'
export interface MapMemory {place:string;at:number;lines:Array<{speaker:string;text:string;at:number}>}
export async function mapMemoryNote(namespace:string,charId:string){
 const memory=await storage.getBag<MapMemory>(namespace,'map_memory_'+charId)
 if(!memory)return ''
 return `你和玩家共同经历过的地图场景记忆（是线下发生的事，不是短信；不代表双方现在仍同处一地）：${memory.place}，${new Date(memory.at).toLocaleString('zh-CN')}。\n${memory.lines.slice(-10).map(l=>l.speaker+'：'+l.text).join('\n')}\n自然接续这些共同经历。不能知道其他角色或不在场时发生的事情。`
}
