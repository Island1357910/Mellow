import type { ReactNode } from 'react'
import { Dices } from 'lucide-react'
import { initialOf } from '../../lib/format.ts'
export function RoundTable(props:{names:string[];turn?:number|null;center?:ReactNode;badges?:Array<string|undefined>;out?:boolean[];host?:number;caption?:string;compact?:boolean;variant?:string}){
 if(!props.names.length)return null
 return <section className={props.compact?'game-table is-compact':'game-table'} data-game={props.variant??'classic'} data-holiday-preserve aria-label="圆桌座位">
 <div className="game-table-heading"><span>围桌 · {props.names.length} 人</span><span>{props.turn!=null?`${props.names[props.turn]} 的回合`:'等待下一步'}</span></div>
 <div className="game-seats">{props.names.map((name,i)=><div key={`${i}-${name}`} className={'game-seat'+(props.turn===i?' is-turn':'')+(props.out?.[i]?' is-out':'')} aria-current={props.turn===i?'step':undefined}><span className="game-seat-avatar">{initialOf(name)}</span><div className="min-w-0"><strong>{name}{i===0?'（我）':''}</strong><span>{props.out?.[i]?'已出局':props.host===i?'主持人':props.badges?.[i]||'在座'}</span></div>{props.turn===i&&<i aria-label="当前回合"/>}</div>)}</div>
 {!props.compact&&<div className="game-table-center">{props.center??<><Dices size={36} strokeWidth={1.2}/><span>一席，一局，一段故事</span></>}</div>}
 {props.caption&&<p className="game-table-caption" role="status">{props.caption}</p>}
 </section>
}
