import { useEffect, useState } from 'react'
import { listTableHistory, readTableHistory, type TableEntry, type TableRecord, type TableSummary } from '../../lib/tableHistory.ts'
import { ModalPortal } from '../ui/primitives.tsx'

export function TableBubbles({ entries }: { entries: TableEntry[] }) {
  return <div className="table-bubbles" aria-live="polite">{entries.filter(entry => entry.kind !== 'event').map(entry => <div key={entry.id} className={'table-message ' + (entry.kind === 'player' ? 'is-player' : '')}><small>{entry.speaker}</small><p>{entry.text}</p></div>)}</div>
}
export function TableHistory({ namespace, onClose }: { namespace: string; onClose: () => void }) {
  const [records, setRecords] = useState<TableSummary[]>([]), [record, setRecord] = useState<TableRecord | null>(null)
  const [loading, setLoading] = useState(true), [error, setError] = useState('')
  useEffect(() => { let live = true; void listTableHistory(namespace).then(rows => { if (live) setRecords(rows) }).catch(e => { if (live) setError(String(e)) }).finally(() => { if (live) setLoading(false) }); return () => { live = false } }, [namespace])
  return <ModalPortal onClose={onClose}><section onClick={event => event.stopPropagation()} className="table-history-modal" role="dialog" aria-modal="true" aria-label="过往游玩历史"><header><button className="chip" onClick={() => record ? setRecord(null) : onClose()}>返回</button><strong>{record ? record.game + ' · 对局回顾' : '过往游玩历史'}</strong><button className="chip" onClick={onClose}>关闭</button></header><div className="table-history-scroll">
    {loading && <p role="status">正在读取…</p>}{error && <p role="status">{error}</p>}
    {record ? <><p className="text-xs mb-4">{new Date(record.startedAt).toLocaleString()} · {record.names.join('、')}<br/>{record.result || '离桌 / 未结束'}</p>{record.entries.map(entry => entry.kind === 'event' ? <p className="table-event" key={entry.id}><time>{new Date(entry.at).toLocaleTimeString()}</time> {entry.text}</p> : <TableBubbles key={entry.id} entries={[entry]}/>)}</> : records.length ? records.map(item => <button className="menu-card mb-3 block w-full text-left" key={item.id} onClick={() => { setLoading(true); void readTableHistory(namespace, item.id).then(value => { if (!value) throw Error('这局记录未能读取'); setRecord(value) }).catch(e => setError(String(e))).finally(() => setLoading(false)) }}><strong>{item.game}</strong><p className="text-xs mt-2">{new Date(item.startedAt).toLocaleString()} · {item.names.join('、')}</p><p className="text-xs mt-1">{item.result || '离桌 / 未结束'}</p></button>) : !loading && <p className="text-sm">还没有游玩记录。从本次更新后的新对局开始保存。</p>}
  </div></section></ModalPortal>
}
