import { askLine, readJson } from './ask.ts'
import { uid } from './id.ts'
import { normalizeFeedPosts, type FeedPost } from './feed.ts'
import { normalizeForumThreads, type ForumThread } from './forumAi.ts'
import { realTimeContext } from './realTime.ts'
export async function searchSocial(kind:'star',query:string):Promise<FeedPost[]>
export async function searchSocial(kind:'forum',query:string):Promise<ForumThread[]>
export async function searchSocial(kind:'star'|'forum',query:string):Promise<FeedPost[]|ForumThread[]>{
 const raw=await askLine(`${realTimeContext()}你在模拟${kind==='star'?'星博':'论坛'}的站内搜索。根据玩家输入现场创作一批相关话题与帖子，可以涵盖不同角度，不要求字面完全匹配。这是虚构社区，不访问真实搜索引擎。只输出JSON数组，4至6项，每项{"author":"独立昵称","title":"话题标题","text":"自然的正文，长短不同","board":"日常","replies":[]}。`,query.trim().slice(0,200),1700)
 const data=readJson(raw);if(!Array.isArray(data))throw Error('话题未生成完整，请重新搜索')
 const rows=data.filter(r=>r&&typeof r.text==='string'&&r.text.trim()).map(r=>({...r,id:uid('search'),handle:r.author,at:Date.now(),likes:0,liked:false,comments:[],replies:[],mine:false}))
 if(!rows.length)throw Error('没有生成相关话题，请重试')
 return kind==='star'?normalizeFeedPosts(rows):normalizeForumThreads(rows)
}
