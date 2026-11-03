import { NumericInput } from '../ui/NumericInput.tsx'
import { uid } from '../../lib/id.ts'
import { API_MODULES, MAX_API_PROFILES } from '../../lib/apiModules.ts'
import { useEffect, useMemo, useState } from 'react'
import { PHONE_APPS } from '../../data/apps.ts'
import { AIAdapter } from '../../engine/AIAdapter.ts'
import {
  BUILTIN_VOICES,
  isLikelyMinimaxKey,
  isTrustedVoiceCache,
  listMinimaxVoices,
  minimaxAccountTag,
  minimaxSpeak,
  MINIMAX_MODELS,
  normalizeMinimaxKey,
  TRUSTED_VOICE_MIN,
  voiceLabel,
} from '../../engine/minimax.ts'
import { downloadJson } from '../../lib/download.ts'
import { hashSecret } from '../../lib/secret.ts'
import { decryptSecret, encryptSecret } from '../../storage/crypto.ts'
import { storage } from '../../storage/StorageService.ts'
import { useMellow } from '../../store/useMellow.ts'
import { PasswordSetup } from '../os/SecretLock.tsx'
import type { MinimaxVoice } from '../../types/index.ts'
import { Field, PillNote, SectionTitle, SoftCard, Toggle } from '../ui/primitives.tsx'

export function VoiceSelect(props: {
  label: string
  voices: MinimaxVoice[]
  value: string
  query: string
  onQuery: (value: string) => void
  onChange: (value: string) => void
}) {
  const filtered = useMemo(() => {
    const q = props.query.trim().toLowerCase()
    if (!q) return props.voices
    return props.voices.filter((item) => item.name.toLowerCase().includes(q) || item.id.toLowerCase().includes(q))
  }, [props.query, props.voices])
  return (
    <label className="block min-w-0 text-xs" style={{ color: 'var(--m-text-secondary)' }}>
      {props.label}
      {props.voices.length > 20 ? (
        <input
          value={props.query}
          onChange={(event) => props.onQuery(event.target.value)}
          placeholder="搜索音色名称或 ID"
          className="soft-input mt-1 w-full min-w-0"
        />
      ) : null}
      <select
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        className="soft-select mt-1 w-full min-w-0 max-w-full text-sm"
      >
        {filtered.map((item) => (
          <option key={item.id} value={item.id} title={item.id}>
            {item.name.length > 28 ? `${item.name.slice(0, 28)}…` : item.name}
          </option>
        ))}
      </select>
      {props.voices.length > 20 ? (
        <span className="mt-1 block break-all text-[10px] leading-4 opacity-70">
          共 {props.voices.length} 个 · 显示 {filtered.length} 个
        </span>
      ) : null}
    </label>
  )
}

export function ApiPanel() {
  const profiles = useMellow((state) => state.apiProfiles)
  const settings = useMellow((state) => state.settings)
  const patchSettings = useMellow((state) => state.patchSettings)
  const reloadApis = useMellow((state) => state.reloadApis)
  const [id, setId] = useState('')
  const [name, setName] = useState('接口')
  const [endpoint, setEndpoint] = useState('https://api.openai.com/v1')
  const [model, setModel] = useState('')
  const [key, setKey] = useState('')
  const [models, setModels] = useState<string[]>([])
  const [status, setStatus] = useState('')

  const activeCard = profiles.find((item) => item.id === id)
  const apiMeta = useMellow((state) => state.apiMeta)

  const loadCard = (cardId: string) => {
    const card = profiles.find((item) => item.id === cardId)
    if (!card) return
    setId(card.id)
    setName(card.name)
    setEndpoint(card.endpoint)
    setModel(card.model)
    setKey('')
    setModels([])
  }

  const persistDraft = async () => {
    if (!id.trim()) return
    await storage.saveApiProfile({
      id,
      name,
      endpoint,
      model,
      key: key.trim() || undefined,
      ready: Boolean(model.trim()),
    })
    await reloadApis()
  }

  const selectProfile = (cardId: string) => {
    void (async () => {
      if (id && id !== cardId) await persistDraft()
      const card = profiles.find((item) => item.id === cardId)
      if (!card) return
      await patchSettings({ activeApiId: cardId })
      await reloadApis()
      loadCard(cardId)
      setStatus(`已切到 ${card.name}${card.hasKey ? '（密钥已保存）' : ''}`)
    })().catch((error: unknown) => setStatus(error instanceof Error ? error.message : '切换失败'))
  }

  useEffect(() => {
    const active = settings.activeApiId
    if (!active || id) return
    const card = profiles.find((item) => item.id === active)
    if (card) loadCard(card.id)
    // 打开面板时对齐当前在用的接口
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.activeApiId, profiles.length])

  return (
    <SoftCard>
      <SectionTitle tone="sky">API 设置（{profiles.length}/{MAX_API_PROFILES}）</SectionTitle>
      <p className="mb-3 text-xs leading-5" style={{ color: 'var(--m-text-secondary)' }}>最多七组 API。每个应用模块只能选择一组，同一组可供多个模块使用。未单独分配的模块使用默认接口。</p>
      {apiMeta.ready && apiMeta.hasKey ? (
        <div className="mb-3"><PillNote tone="mint" compact>已连接 · {apiMeta.name || '当前接口'} · {apiMeta.model}（重新登录后仍有效，无需重复配置）</PillNote></div>
      ) : (
        <div className="mb-3"><PillNote tone="sky" compact>先拉取模型，选一个保存，这张卡片才能用</PillNote></div>
      )}
      <div className="mb-3 grid grid-cols-2 gap-2">
        {profiles.map((card) => (
          <button key={card.id} type="button" aria-pressed={id === card.id} className={`chip min-w-0 w-full py-2 text-left text-xs ${id === card.id ? 'chip-pink' : ''}`} onClick={() => loadCard(card.id)}>
            <span className="block truncate font-medium">{card.name}{settings.activeApiId === card.id ? ' · 默认' : ''}</span>
            <span className="block truncate" style={{ color: 'var(--m-text-secondary)' }}>{card.ready ? card.model : '还没选模型'}</span>
          </button>
        ))}
        <button type="button" disabled={profiles.length >= MAX_API_PROFILES} className="chip border border-dashed border-black/10 bg-white/60 py-2 text-xs disabled:opacity-50" onClick={() => { setId(''); setName('新接口'); setEndpoint('https://api.openai.com/v1'); setModel(''); setKey(''); setModels([]) }}>{profiles.length >= MAX_API_PROFILES ? '已达七组上限' : '新建 API'}</button>
      </div>
      <div className="space-y-3">
        <Field label="名字" value={name} onChange={setName} />
        <Field label="地址" value={endpoint} onChange={setEndpoint} placeholder="https://api.openai.com/v1" />
        <Field
          label={id ? (activeCard?.hasKey ? '密钥（留空沿用已保存）' : '密钥（留空不改）') : '密钥'}
          value={key}
          onChange={setKey}
          type="password"
          placeholder={activeCard?.hasKey ? '已保存密钥，留空则继续用原来的' : undefined}
        />
        <button type="button" className="chip chip-sky" onClick={() => {
          setStatus('在拉取模型')
          void (async () => {
            const secret = key.trim() || (id ? await storage.readApiKey(id) : '')
            const list = await AIAdapter.listModels(endpoint, secret)
            setModels(list)
            setStatus(`拉到 ${list.length} 个`)
          })().catch((error: unknown) => setStatus(error instanceof Error ? error.message : '没拉到'))
        }}>拉取模型</button>
        {models.length > 0 ? (
          <label className="block text-xs" style={{ color: 'var(--m-text-secondary)' }}>
            选择模型
            <select value={model} onChange={(event) => setModel(event.target.value)} className="soft-select mt-1 w-full text-sm">
              <option value="">还没选</option>
              {models.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <button type="button" className="chip chip-solid" onClick={() => {
            if (!model.trim()) {
              setStatus('先拉取并选择模型')
              return
            }
            void (async () => {
              const saved = await storage.saveApiProfile({ id: id || undefined, name, endpoint, model, key: key.trim() ? key : undefined, ready: true })
              if (!settings.activeApiId) await patchSettings({ activeApiId: saved.id })
              await reloadApis()
              setId(saved.id)
              setKey('')
              setStatus('已保存，可在下方分配应用模块')
            })().catch((error: unknown) => setStatus(error instanceof Error ? error.message : '没保存成'))
          }}>保存 API 设置</button>
          {profiles.filter((card) => card.ready && card.id !== settings.activeApiId).map((card) => (
            <button key={card.id} type="button" className="chip chip-sky text-xs" onClick={() => selectProfile(card.id)}>
              设为默认：{card.name}
            </button>
          ))}
          {id ? (
            <button type="button" className="chip chip-danger text-xs" onClick={() => void storage.deleteApiProfile(id).then(() => reloadApis()).then(() => { setId(''); setStatus('已删除，相关模块已恢复使用默认接口') }).catch(error => setStatus(error instanceof Error ? error.message : '删除失败'))}>删除这张</button>
          ) : null}
        </div>
        {status ? <PillNote tone="mint" inline>{status}</PillNote> : null}
        <SectionTitle tone="sky">应用模块分配</SectionTitle>
        <div className="space-y-3">
          {API_MODULES.map(module => (
            <label key={module.id} className="block text-xs" style={{ color: 'var(--m-text-secondary)' }}>
              {module.name}
              <select className="soft-select mt-1 w-full text-sm" value={settings.apiModuleBindings[module.id] ?? ''} onChange={event => {
                const apiId = event.target.value
                void storage.bindApiModule(module.id, apiId).then(() => reloadApis()).catch(error => setStatus(error instanceof Error ? error.message : '分配失败'))
              }}>
                <option value="">使用默认接口{apiMeta.name ? `（${apiMeta.name}）` : ''}</option>
                {settings.apiModuleBindings[module.id] && !profiles.some(card => card.id === settings.apiModuleBindings[module.id] && card.ready) ? <option value={settings.apiModuleBindings[module.id]}>原绑定不可用，请重新选择</option> : null}
                {profiles.filter(card => card.ready).map(card => <option key={card.id} value={card.id}>{card.name} · {card.model}</option>)}
              </select>
            </label>
          ))}
        </div>
      </div>
    </SoftCard>
  )
}

export function MinimaxPanel() {
  const settings = useMellow((state) => state.settings)
  const patchSettings = useMellow((state) => state.patchSettings)
  const mini = settings.minimax
  const [endpoint, setEndpoint] = useState(mini.endpoint || 'https://api.minimax.cn')
  const [groupId, setGroupId] = useState(mini.groupId)
  const [key, setKey] = useState('')
  const [model, setModel] = useState(mini.model || 'speech-02-hd')
  const [voiceId, setVoiceId] = useState(mini.voiceId || 'female-shaonv')
  const [userVoiceId, setUserVoiceId] = useState(mini.userVoiceId || 'male-qn-qingse')
  const models = mini.model && !MINIMAX_MODELS.includes(mini.model) ? [mini.model, ...MINIMAX_MODELS] : MINIMAX_MODELS
  const [voices, setVoices] = useState<typeof BUILTIN_VOICES>(BUILTIN_VOICES)
  const [localFetched, setLocalFetched] = useState(false)
  const [status, setStatus] = useState(mini.ready ? '语音已可用' : '')
  const [voiceQuery, setVoiceQuery] = useState('')
  const [userVoiceQuery, setUserVoiceQuery] = useState('')
  const voiceList = localFetched && isTrustedVoiceCache(voices) ? voices : BUILTIN_VOICES
  const trustedCount = localFetched ? voices.length : 0
  const staleCache = mini.fetchedVoices.length > 0 && !mini.voiceAccountTag

  const secret = async () => {
    let raw = key.trim()
    if (!raw && mini.encryptedKey) {
      try {
        raw = await decryptSecret(mini.encryptedKey)
      } catch {
        throw new Error('本地密钥读不出来，请重新粘贴 API Key 并保存')
      }
    }
    const token = normalizeMinimaxKey(raw)
    if (!token) return ''
    if (!isLikelyMinimaxKey(token)) throw new Error('密钥格式不对')
    return token
  }

  useEffect(() => {
    let stop = false
    void (async () => {
      if (!mini.encryptedKey) {
        if (!stop) {
          setVoices(BUILTIN_VOICES)
          setLocalFetched(false)
        }
        return
      }
      try {
        const raw = await decryptSecret(mini.encryptedKey)
        const tag = minimaxAccountTag({ endpoint: mini.endpoint, groupId: mini.groupId, key: raw })
        if (!stop && tag && tag === mini.voiceAccountTag && isTrustedVoiceCache(mini.fetchedVoices)) {
          setVoices(mini.fetchedVoices)
          setLocalFetched(true)
          return
        }
      } catch {
        /* 密钥读不出则不用旧列表 */
      }
      if (!stop) {
        setVoices(BUILTIN_VOICES)
        setLocalFetched(false)
      }
    })()
    return () => {
      stop = true
    }
  }, [mini.encryptedKey, mini.endpoint, mini.groupId, mini.voiceAccountTag, mini.fetchedVoices])

  useEffect(() => {
    const credsDirty = Boolean(key.trim()) || groupId.trim() !== mini.groupId || endpoint.trim() !== mini.endpoint
    if (!credsDirty) return
    setLocalFetched(false)
    setVoices(BUILTIN_VOICES)
  }, [endpoint, groupId, key, mini.groupId, mini.endpoint])

  return (
    <SoftCard className="min-w-0 overflow-hidden">
      <SectionTitle tone="mint">MiniMax 语音</SectionTitle>
      <div className="min-w-0 space-y-3">
        <Field label="语音接口" value={endpoint} onChange={setEndpoint} placeholder="https://api.minimax.cn" />
        <Field label="GroupId（合成语音时需要）" value={groupId} onChange={setGroupId} placeholder="开放平台账户里的数字 GroupId" />
        <Field label={mini.encryptedKey ? '语音密钥（留空不改）' : '语音密钥'} value={key} onChange={setKey} type="password" placeholder="sk-api-..." />
        <label className="block min-w-0 text-xs" style={{ color: 'var(--m-text-secondary)' }}>
          语音模型
          <select value={model} onChange={(event) => setModel(event.target.value)} className="soft-select mt-1 w-full min-w-0 max-w-full text-sm">
            {(models.length ? models : MINIMAX_MODELS).map((item) => (
              <option key={item} value={item}>{item === 'speech-02-hd' ? `${item}（推荐）` : item}</option>
            ))}
          </select>
        </label>
        <VoiceSelect label="默认角色音色" voices={voiceList} value={voiceId} query={voiceQuery} onQuery={setVoiceQuery} onChange={setVoiceId} />
        <VoiceSelect label="我的音色（点自己的语音条）" voices={voiceList} value={userVoiceId} query={userVoiceQuery} onQuery={setUserVoiceQuery} onChange={setUserVoiceId} />
        <p className="break-words text-[11px] leading-5" style={{ color: 'var(--m-text-secondary)' }}>
          {localFetched && trustedCount >= TRUSTED_VOICE_MIN
            ? `已拉取 ${trustedCount} 个平台音色。`
            : staleCache
              ? `检测到 ${mini.fetchedVoices.length} 条旧缓存（不是平台全量），请重新粘贴密钥后点「拉取音色」。`
              : `还没拉取过平台音色，下拉框里是 ${BUILTIN_VOICES.length} 个内置兜底。`}
        </p>
        <div className="grid min-w-0 grid-cols-3 gap-2">
          <button type="button" className="chip chip-sky min-w-0 w-full" onClick={() => {
            void (async () => {
              const apiKey = await secret()
              if (!apiKey) {
                setStatus('先写密钥')
                return
              }
              setStatus('正在拉取音色…')
              const list = await listMinimaxVoices(endpoint, apiKey, groupId)
              setVoices(list)
              setLocalFetched(true)
              if (!list.some((item) => item.id === voiceId)) setVoiceId(list[0]?.id ?? voiceId)
              if (!list.some((item) => item.id === userVoiceId)) setUserVoiceId(list[0]?.id ?? userVoiceId)
              setStatus(`拉到 ${list.length} 个音色`)
              const encryptedKey = key.trim() ? await encryptSecret(apiKey) : mini.encryptedKey
              const voiceAccountTag = minimaxAccountTag({ endpoint, groupId, key: apiKey })
              if (encryptedKey) {
                await patchSettings({ minimax: { endpoint, groupId, encryptedKey, model, voiceId, userVoiceId, fetchedVoices: list, voiceAccountTag, ready: true } })
                setKey('')
              }
            })().catch((error: unknown) => setStatus(error instanceof Error ? error.message : '没拉到音色'))
          }}>拉取音色</button>
          <button type="button" className="chip min-w-0 w-full" onClick={() => {
            void (async () => {
              const apiKey = await secret()
              if (!apiKey) {
                setStatus('先写密钥')
                return
              }
              if (!groupId.trim()) {
                setStatus('合成语音需要 GroupId')
                return
              }
              const draft = { ...mini, endpoint, groupId, model, voiceId, userVoiceId, fetchedVoices: localFetched ? voices : mini.fetchedVoices, ready: true }
              const url = await minimaxSpeak(draft, apiKey, '你好，这是默认音色的试听。', voiceId)
              const audio = new Audio(url)
              await audio.play()
              setStatus(`正在试听「${voiceLabel(voiceList, voiceId)}」`)
            })().catch((error: unknown) => setStatus(error instanceof Error ? error.message : '试听失败'))
          }}>试听默认音色</button>
          <button type="button" className="chip chip-solid min-w-0 w-full" onClick={() => {
            if (!model) {
              setStatus('先选择模型')
              return
            }
            void (async () => {
              const apiKey = key.trim() ? normalizeMinimaxKey(key) : ''
              if (apiKey && !isLikelyMinimaxKey(apiKey)) {
                setStatus('密钥格式不对')
                return
              }
              const encryptedKey = apiKey ? await encryptSecret(apiKey) : mini.encryptedKey
              if (!encryptedKey) {
                setStatus('先写密钥')
                return
              }
              const storedKey = apiKey || (mini.encryptedKey ? await decryptSecret(mini.encryptedKey) : '')
              const voiceAccountTag = minimaxAccountTag({ endpoint, groupId, key: storedKey })
              let fetchedVoices = localFetched && isTrustedVoiceCache(voices) ? voices : []
              if (!fetchedVoices.length && voiceAccountTag === mini.voiceAccountTag && isTrustedVoiceCache(mini.fetchedVoices)) {
                fetchedVoices = mini.fetchedVoices
              }
              await patchSettings({ minimax: { endpoint, groupId, encryptedKey, model, voiceId, userVoiceId, fetchedVoices, voiceAccountTag, ready: true } })
              if (!fetchedVoices.length) {
                setLocalFetched(false)
                setVoices(BUILTIN_VOICES)
              }
              setKey('')
              setStatus(fetchedVoices.length ? '语音已保存' : '已保存，请点「拉取音色」')
            })()
          }}>保存</button>
        </div>
        {status ? <PillNote tone="lilac" inline><span className="break-words">{status}</span></PillNote> : null}
      </div>
    </SoftCard>
  )
}

export function PrivacyPanel() {
  const settings = useMellow((state) => state.settings)
  const patchSettings = useMellow((state) => state.patchSettings)
  const privacy = settings.privacy
  const [setupScreen, setSetupScreen] = useState(false)
  const [setupApp, setSetupApp] = useState<string | null>(null)
  const save = (patch: Partial<typeof privacy>) => void patchSettings({ privacy: { ...privacy, ...patch, appLocks: patch.appLocks ?? privacy.appLocks, appHashes: patch.appHashes ?? privacy.appHashes } })
  return (
    <SoftCard>
      <SectionTitle tone="lilac">隐私</SectionTitle>
      <Toggle label="给小手机上锁" hint={privacy.hash ? '已设六位锁屏密码' : '还没有密码'} on={privacy.enabled} onChange={(enabled) => {
        if (enabled && !privacy.hash) setSetupScreen(true)
        else save({ enabled })
      }} />
      {privacy.hash ? (
        <button type="button" className="chip mt-2" onClick={() => setSetupScreen(true)}>改锁屏密码</button>
      ) : null}
      {setupScreen ? (
        <div className="mt-3">
          <PasswordSetup label="输入六位锁屏密码" onSave={(secret) => {
            void hashSecret(secret).then((hash) => {
              save({ enabled: true, hash })
              setSetupScreen(false)
            })
          }} />
        </div>
      ) : null}
      <PillNote tone="lilac" compact>每个应用可设不同六位密码。角色问起时，不会把密码说出来</PillNote>
      <div className="mt-2 space-y-1">
        {PHONE_APPS.map((app) => (
          <div key={app.id} className="rounded-[18px] bg-[#FBF7F4] px-2 py-1">
            <Toggle label={app.name} hint={privacy.appHashes[app.id] ? '已设独立密码' : privacy.appLocks[app.id] ? '还没设密码' : undefined} on={Boolean(privacy.appLocks[app.id])} onChange={(value) => {
              if (value && !privacy.appHashes[app.id]) {
                setSetupApp(app.id)
                save({ appLocks: { ...privacy.appLocks, [app.id]: true } })
                return
              }
              save({ appLocks: { ...privacy.appLocks, [app.id]: value } })
            }} />
            {privacy.appLocks[app.id] ? (
              <button type="button" className="chip mb-1 ml-2 text-[11px]" onClick={() => setSetupApp(app.id)}>
                {privacy.appHashes[app.id] ? '改密码' : '设密码'}
              </button>
            ) : null}
          </div>
        ))}
      </div>
      {setupApp ? (
        <div className="menu-card mt-3 !p-3">
          <p className="mb-2 text-sm font-medium">{APP_NAME(setupApp)} 的密码</p>
          <PasswordSetup label={`为「${APP_NAME(setupApp)}」设六位密码`} onSave={(secret) => {
            void hashSecret(secret).then((hash) => {
              save({ appHashes: { ...privacy.appHashes, [setupApp]: hash }, appLocks: { ...privacy.appLocks, [setupApp]: true } })
              setSetupApp(null)
            })
          }} />
          <button type="button" className="chip mt-2" onClick={() => setSetupApp(null)}>取消</button>
        </div>
      ) : null}
    </SoftCard>
  )
}

function APP_NAME(id: string) {
  return PHONE_APPS.find((app) => app.id === id)?.name ?? id
}

export function BackupPanel() {
  const settings = useMellow((state) => state.settings)
  const patchSettings = useMellow((state) => state.patchSettings)
  const backup = settings.backup
  const [status, setStatus] = useState('')
  const saveBackup = async () => {
    const bundle = await storage.exportBundle()
    downloadJson(`mellow-backup-${new Date().toISOString().slice(0, 10)}.json`, bundle)
    await patchSettings({ backup: { ...backup, lastSavedAt: Date.now(), lastRemindedAt: Date.now() } })
    setStatus('备份已下载')
  }
  return (
    <SoftCard>
      <SectionTitle tone="butter">备份</SectionTitle>
      <Toggle label="到时间提醒保存" hint="只是提醒，不会悄悄上传" on={backup.enabled} onChange={(enabled) => void patchSettings({ backup: { ...backup, enabled } })} />
      <label className="mt-2 block text-xs" style={{ color: 'var(--m-text-secondary)' }}>
        每隔多少小时提醒
        <NumericInput min={1} max={8760} value={backup.intervalHours} onValueChange={intervalHours => void patchSettings({ backup: { ...backup, intervalHours } })} className="soft-input mt-1 w-full" />
      </label>
      <p className="preset-hint mt-1">默认 168 小时（约 7 天）。只在本机提醒，不会自动上传。</p>
      <div className="mt-3 flex gap-2">
        <button type="button" className="chip chip-solid" onClick={() => void saveBackup()}>现在备份</button>
        <label className="chip chip-mint">
          恢复
          <input type="file" accept="application/json,.json" className="hidden" onChange={(event) => {
            const file = event.target.files?.[0]
            event.target.value = ''
            if (!file) return
            void file.text().then((text) => storage.importBundle(JSON.parse(text) as unknown)).then(() => {
              setStatus('已恢复，正在重新打开')
              window.location.reload()
            }).catch((error: unknown) => setStatus(error instanceof Error ? error.message : '没恢复成'))
          }} />
        </label>
      </div>
      {status ? <PillNote tone="butter" inline>{status}</PillNote> : null}
    </SoftCard>
  )
}

export function IconPanel() {
  const [setName, setSetName] = useState(''), [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const settings = useMellow((state) => state.settings)
  const patchSettings = useMellow((state) => state.patchSettings)
  const setIcon = (id: string, value: string) => {
    const appIcons = { ...useMellow.getState().settings.appIcons }
    if (!value) delete appIcons[id]
    else appIcons[id] = value
    void patchSettings({ appIcons })
  }
  return (
    <SoftCard>
      <SectionTitle tone="pink">应用图标</SectionTitle>
      <div className="menu-card mb-4 space-y-3">
        <p className="text-xs">将当前所有图标保存成一套，之后可以整套切换。删除套装不会改变正在使用的图标。</p>
        <form className="flex gap-2" onSubmit={event => {
          event.preventDefault(); if (!setName.trim() || saving) return
          setSaving(true)
          void patchSettings({ iconSets: [...useMellow.getState().settings.iconSets, { id: uid('icons'), name: setName.trim(), icons: { ...useMellow.getState().settings.appIcons } }] })
            .then(() => { setSetName(''); setNote('图标套装已保存') }).catch(error => setNote(String(error))).finally(() => setSaving(false))
        }}><input aria-label="图标套装名称" className="soft-input min-w-0 flex-1" placeholder="为这套图标取名" value={setName} maxLength={40} onChange={event => setSetName(event.target.value)}/><button className="chip shrink-0" disabled={!setName.trim() || saving}>保存整套</button></form>
        {settings.iconSets.map(set => <div key={set.id} className="flex items-center gap-2"><span className="min-w-0 flex-1 break-all text-xs">{set.name}</span><button className="chip" disabled={saving} onClick={() => void patchSettings({ appIcons: { ...set.icons } }).then(() => setNote('已应用「'+set.name+'」')).catch(error => setNote(String(error)))}>应用</button><button className="chip" disabled={saving} onClick={() => setDeleteId(set.id)}>删除</button></div>)}
        {deleteId && <div role="alertdialog" aria-label="确认删除图标套装" className="space-y-2 text-xs"><p>删除「{settings.iconSets.find(set => set.id === deleteId)?.name}」？当前使用的图标会保留。</p><div className="flex gap-2"><button className="chip" disabled={saving} onClick={() => {
          setSaving(true)
          void patchSettings({ iconSets: useMellow.getState().settings.iconSets.filter(item => item.id !== deleteId) }).then(() => { setDeleteId(null); setNote('图标套装已删除') }).catch(error => setNote(String(error))).finally(() => setSaving(false))
        }}>确认删除</button><button className="chip" disabled={saving} onClick={() => setDeleteId(null)}>取消</button></div></div>}
        <button className="chip" onClick={() => void patchSettings({ appIcons: {} }).then(() => setNote('已恢复默认应用图标')).catch(error => setNote(String(error)))}>恢复默认图标</button>
        {note && <p role="status" className="text-xs">{note}</p>}
      </div>
      <div className="space-y-2">
        {PHONE_APPS.map((app) => (
          <div key={app.id} className="flex items-center gap-2">
            <span className="w-14 truncate text-xs">{app.name}</span>
            <input aria-label={app.name+'图标'} value={settings.appIcons[app.id]?.startsWith('data:') ? '' : settings.appIcons[app.id] ?? ''} onChange={(event) => setIcon(app.id, event.target.value)} placeholder="表情" className="soft-input w-16 px-2 py-1 text-center" />
            <label className="chip chip-lilac px-2.5 py-1 text-[11px]">
              图片
              <input type="file" accept="image/*" className="hidden" onChange={(event) => {
                const file = event.target.files?.[0]
                event.target.value = ''
                if (!file) return
                const reader = new FileReader()
                reader.onload = () => setIcon(app.id, String(reader.result ?? ''))
                reader.readAsDataURL(file)
              }} />
            </label>
            {settings.appIcons[app.id] ? <button type="button" className="chip px-2.5 py-1 text-[11px]" onClick={() => setIcon(app.id, '')}>还原</button> : null}
          </div>
        ))}
      </div>
    </SoftCard>
  )
}
