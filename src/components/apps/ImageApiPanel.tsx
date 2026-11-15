import { useEffect, useRef, useState } from 'react'
import { APP_IMAGE_LABELS, appImagesEnabled, setAppImagesEnabled, type AppImageChannel } from '../../lib/appImages.ts'
import { imageApiSettings, listImageModels, saveImageApi } from '../../lib/imageApi.ts'
import { SectionTitle, SoftCard } from '../ui/primitives.tsx'

const channels = Object.entries(APP_IMAGE_LABELS) as [AppImageChannel, string][]

export function ImageApiPanel() {
  const [config, setConfig] = useState({ endpoint: '', model: '', hasKey: false })
  const [key, setKey] = useState('')
  const [note, setNote] = useState('')
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState<'list' | 'save'>()
  const [models, setModels] = useState<string[]>([])
  const [enabled, setEnabled] = useState(() => Object.fromEntries(channels.map(([app]) => [app, appImagesEnabled(app)])))
  const lock = useRef(false)
  const listing = useRef<AbortController | null>(null)

  useEffect(() => {
    let alive = true
    void imageApiSettings().then(value => {
      if (alive) { setConfig(value); setReady(true) }
    }).catch(() => { if (alive) setNote('图片 API 设置读取失败') })
    return () => { alive = false; listing.current?.abort() }
  }, [])

  async function save() {
    if (lock.current) return
    lock.current = true
    setBusy('save')
    setNote('')
    try {
      await saveImageApi(config.endpoint, config.model, key)
      setConfig(await imageApiSettings())
      setKey('')
      setNote('图片 API 已保存')
    } catch (error) {
      setNote(error instanceof Error ? error.message : '设置未保存')
    } finally {
      lock.current = false
      setBusy(undefined)
    }
  }

  async function pullModels() {
    if (lock.current) return
    lock.current = true
    setBusy('list')
    setModels([])
    setNote('')
    const request = new AbortController()
    listing.current = request
    const timeout = window.setTimeout(() => request.abort(), 30_000)
    try {
      const entries = await listImageModels(config.endpoint, key, request.signal)
      setModels(entries)
      if (!config.model && entries.length === 1) setConfig(current => ({ ...current, model: entries[0]! }))
      setNote(`已拉取 ${entries.length} 个模型，选好后保存。`)
    } catch (error) {
      setNote(error instanceof Error ? error.message : '没有拉到模型')
    } finally {
      window.clearTimeout(timeout)
      listing.current = null
      lock.current = false
      setBusy(undefined)
    }
  }

  return <div className="space-y-3">
    <SoftCard>
      <SectionTitle tone="sky">图片 API</SectionTitle>
      <fieldset disabled={!ready || Boolean(busy)} className="grid gap-2">
        <label>接口地址<input className="soft-input w-full" value={config.endpoint} placeholder="https://api.example.com/v1" onChange={e => { setModels([]); setConfig({ ...config, endpoint: e.target.value }) }} /></label>
        <label>生图模型<input className="soft-input w-full" value={config.model} onChange={e => setConfig({ ...config, model: e.target.value })} /></label>
        {models.length > 0 && <label>已拉取模型<select className="soft-select w-full" value={models.includes(config.model) ? config.model : ''} onChange={e => {
          if (e.target.value) setConfig({ ...config, model: e.target.value })
        }}>
          <option value="">选择一个支持生图的模型</option>
          {models.map(id => <option key={id} value={id}>{id}</option>)}
        </select></label>}
        <label>图片 API 密钥<input className="soft-input w-full" type="password" autoComplete="off" value={key} placeholder={config.hasKey ? '已保存密钥' : '输入密钥'} onChange={e => { setModels([]); setKey(e.target.value) }} /></label>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="chip" disabled={!config.endpoint.trim()} onClick={() => void pullModels()}>拉取模型</button>
          <button type="button" className="chip chip-solid" onClick={() => void save()}>保存图片 API</button>
        </div>
      </fieldset>
      {(note || busy) && <p role="status" className="mt-2 text-sm">{note || (busy === 'list' ? '正在拉取模型…' : '正在保存…')}</p>}
    </SoftCard>
    <SoftCard>
      <SectionTitle tone="sky">应用内生图</SectionTitle>
      <p className="mb-3 text-xs leading-5">开启后，应用可按内容决定是否配图。生图会把画面描述发送给图片服务商，可能消耗额度。</p>
      <div className="grid gap-2">
        {channels.map(([app, label]) => <label key={app} className="flex items-center justify-between gap-2 text-sm">
          {label}
          <input type="checkbox" checked={enabled[app]} onChange={event => {
            const checked = event.target.checked
            try {
              setAppImagesEnabled(app, checked)
              setEnabled(current => ({ ...current, [app]: checked }))
            } catch { setNote('应用生图开关未能保存') }
          }} />
        </label>)}
      </div>
    </SoftCard>
  </div>
}
