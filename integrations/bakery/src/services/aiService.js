const SETTINGS_KEY = 'qianwei_bakery_ai';
const host = () => window.mellowBakeryHost;
export const hostedByMellow = new URLSearchParams(window.location.search).has('mellow');

/** 确保 baseURL 格式为 https://xxx/v1，无尾斜杠 */
function normalizeBaseURL(url) {
  if (!url || typeof url !== 'string') return '';
  let u = url.trim().replace(/\/+$/, '');
  if (u && !u.endsWith('/v1')) {
    u = u.replace(/\/v1\/?.*$/, '') + '/v1';
  }
  return u;
}

export function loadAISettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { baseURL: '', apiKey: '', model: '', source: hostedByMellow ? 'mellow' : 'custom' };
    const parsed = JSON.parse(raw);
    return {
      source: hostedByMellow && (parsed.source === 'mellow' || (!parsed.source && !(parsed.baseURL && parsed.apiKey))) ? 'mellow' : 'custom',
      baseURL: normalizeBaseURL(parsed.baseURL || ''),
      apiKey: String(parsed.apiKey || '').trim(),
      model: String(parsed.model || 'gpt-4o-mini').trim(),
    };
  } catch {
    return { baseURL: '', apiKey: '', model: '', source: hostedByMellow ? 'mellow' : 'custom' };
  }
}

export function saveAISettings(s) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify({
    source: s.source,
    baseURL: normalizeBaseURL(s.baseURL || ''),
    apiKey: s.apiKey || '',
    model: s.model || 'gpt-4o-mini',
  }));
}

export function getActiveOpenAPIConfig() {
  const s = loadAISettings();
  if (s.source === 'mellow') return { source: 'mellow' };
  if (!s.baseURL || !s.apiKey) return null;
  const baseURL = normalizeBaseURL(s.baseURL);
  return { baseURL, apiKey: s.apiKey, model: s.model || 'gpt-4o-mini' };
}

/** @param {RequestInit & { signal?: AbortSignal }} init */
async function fetchWithTimeout(url, init, timeoutMs) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  const userSignal = init?.signal;
  const onUserAbort = () => controller.abort();
  if (userSignal) {
    if (userSignal.aborted) controller.abort();
    else userSignal.addEventListener('abort', onUserAbort, { once: true });
  }
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (e) {
    if (e?.name === 'AbortError') {
      if (userSignal?.aborted) throw new Error('请求已取消');
      throw new Error('请求超时，请稍后重试');
    }
    throw e;
  } finally {
    clearTimeout(t);
    if (userSignal) userSignal.removeEventListener('abort', onUserAbort);
  }
}

export async function fetchModels() {
  const cfg = getActiveOpenAPIConfig();
  if (!cfg) throw new Error('请在面包房设置中填写 API 端点和密钥');
  const url = `${cfg.baseURL}/models`;
  const res = await fetchWithTimeout(url, {
    headers: {
      Authorization: `Bearer ${cfg.apiKey}`,
      'Content-Type': 'application/json',
    },
  }, 25000);
  if (!res.ok) throw new Error(`拉取模型失败 ${res.status}`);
  const data = await res.json();
  const list = data.data || data.models || [];
  return list.map((x) => x.id || x.name).filter(Boolean);
}

export async function testAIConnection() {
  if (getActiveOpenAPIConfig()?.source === 'mellow') {
    if (!host()) throw new Error('小手机尚未连接，请重新打开面包房');
    await host().test();
    return true;
  }
  await fetchModels();
  return true;
}

export async function chatComplete(messages, options = {}) {
  const cfg = getActiveOpenAPIConfig();
  if (!cfg) throw new Error('请在设置中配置 API');
  if (cfg.source === 'mellow') {
    if (!host()) throw new Error('小手机尚未连接，请重新打开面包房');
    if (options.signal?.aborted) throw new Error('请求已取消');
    const text = await host().complete(messages, { temperature: options.temperature, max_tokens: options.max_tokens, timeoutMs: options.timeoutMs });
    if (options.signal?.aborted) throw new Error('请求已取消');
    return text.trim();
  }
  const model = options.model || cfg.model || 'gpt-4o-mini';
  const url = `${cfg.baseURL}/chat/completions`;
  const timeoutMs = options.timeoutMs ?? 120000;
  const res = await fetchWithTimeout(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.max_tokens ?? 2048,
    }),
    signal: options.signal,
  }, timeoutMs);
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`请求失败 ${res.status}: ${t.slice(0, 200)}`);
  }
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error('API 返回空内容');
  return text.trim();
}
