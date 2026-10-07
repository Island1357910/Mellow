import { AIAdapter } from '../engine/AIAdapter.ts'
import { storage } from '../storage/StorageService.ts'

export interface SearchHit {
  title: string
  site: string
  snippet: string
}

export interface SearchArticle {
  query: string
  hit: SearchHit
  body: string
  at: number
}

function bagKey(query: string): string {
  return `browser_${query.trim().slice(0, 40)}`
}

async function ask(system: string, user: string, maxTokens: number): Promise<string> {
  const adapter = await AIAdapter.fromStored(await storage.readApi(), await storage.readApiKey())
  const response = await adapter.complete({
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    temperature: 0.8,
    maxTokens,
  })
  return response.content
}

function parseHits(text: string): SearchHit[] {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  const raw = (fenced?.[1] ?? text).trim()
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start < 0 || end <= start) throw new Error('这次没有写成目录，可以再试一次。')
  let data: unknown
  try {
    data = JSON.parse(raw.slice(start, end + 1))
  } catch {
    throw new Error('这次没有写成目录，可以再试一次。')
  }
  if (!data || typeof data !== 'object' || !Array.isArray((data as { results?: unknown }).results)) {
    throw new Error('这次没有写成目录，可以再试一次。')
  }
  const rows = (data as { results: unknown[] }).results.slice(0, 4)
  if (rows.length === 0) throw new Error('没有写成可以打开的条目。')
  return rows.map((row) => {
    if (!row || typeof row !== 'object') throw new Error('结果缺了标题。')
    const item = row as { title?: unknown; site?: unknown; snippet?: unknown }
    const title = typeof item.title === 'string' ? item.title.trim() : ''
    const site = typeof item.site === 'string' ? item.site.trim() : ''
    const snippet = typeof item.snippet === 'string' ? item.snippet.trim() : ''
    if (!title || !snippet) throw new Error('结果缺了标题或摘要。')
    return { title, site: site || '半糖', snippet }
  })
}

export async function loadSearchHits(namespace: string, query: string): Promise<SearchHit[] | null> {
  const cached = await storage.getBag<{ query: string; hits: SearchHit[]; at: number }>(namespace, bagKey(query))
  if (cached?.query === query && cached.hits.length) return cached.hits
  return null
}

export async function runSearchHits(namespace: string, query: string): Promise<SearchHit[]> {
  const text = await ask(
    '你在虚构手机「半糖」里写搜索结果。不要访问真实网站，不要声称引用了真实网页。只返回 JSON，不要 Markdown。格式：{"results":[{"title":"","site":"","snippet":""}]}。写 3 条。site 是虚构站点名。snippet 是一两句中文摘要。',
    `用户在地址栏输入：${query}`,
    500,
  )
  const hits = parseHits(text)
  await storage.setBag(namespace, bagKey(query), { query, hits, at: Date.now() })
  return hits
}

export async function loadSearchArticle(namespace: string, query: string, hit: SearchHit): Promise<SearchArticle | null> {
  const key = `${bagKey(query)}_${hit.title.slice(0, 24)}`
  const cached = await storage.getBag<SearchArticle>(namespace, key)
  if (cached?.body) return cached
  return null
}

export async function runSearchArticle(namespace: string, query: string, hit: SearchHit): Promise<SearchArticle> {
  const body = await ask(
    '为这条搜索结果写正文。中文，四段以内，每段单独一行。不要标题，不要 Markdown，不要说自己是模型。内容是虚构的，不要假装摘自真实网站。',
    `搜索词：${query}\n标题：${hit.title}\n站点：${hit.site}\n摘要：${hit.snippet}`,
    700,
  )
  const article: SearchArticle = { query, hit, body, at: Date.now() }
  const key = `${bagKey(query)}_${hit.title.slice(0, 24)}`
  await storage.setBag(namespace, key, article)
  return article
}
