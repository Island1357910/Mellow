import { Resolver } from 'node:dns/promises'
import https from 'node:https'
import ipaddr from 'ipaddr.js'

const blocked = new Set((process.env.BLOCKED_UPSTREAM_IPS ?? '').split(',').map(address => address.trim()))

export function endpoint(value) {
  const url = new URL(value)
  if (url.protocol !== 'https:' || url.username || url.password || url.port ||
      url.search || url.hash || !/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z](?:[a-z0-9-]*[a-z0-9])?$/i.test(url.hostname)) {
    throw new Error('需要公网 HTTPS 模型接口的完整地址，且不能带查询参数')
  }
  if (url.pathname === '/' || /\/v1\/?$/.test(url.pathname)) {
    url.pathname = url.pathname.replace(/\/$/, '') + (url.pathname === '/' ? '/v1' : '') + '/chat/completions'
  }
  return url.href
}

export function isPublic(address) {
  const ip = ipaddr.parse(address)
  // Use IPv4 only to keep outbound routing and address classification explicit.
  return ip.kind() === 'ipv4' && !blocked.has(address) && ip.range() === 'unicast' &&
    !['192.0.0.0/24', '192.88.99.0/24', '198.18.0.0/15'].some(cidr => ip.match(ipaddr.parseCIDR(cidr)))
}

export async function complete(target, key, model, messages, signal) {
  const url = new URL(target)
  const resolver = new Resolver({ timeout: 2000, tries: 2 })
  const resolved = await resolver.resolve4(url.hostname)
  if (!resolved.length || resolved.some(address => !isPublic(address))) throw new Error('Blocked address')
  const pinned = { address: resolved[0], family: 4 }
  // Some OpenAI-compatible models reject max_tokens; retry only a rejected request.
  for (const tokenField of ['max_tokens', 'max_completion_tokens', null]) {
    const body = JSON.stringify({ model, messages, stream: false, ...(tokenField ? { [tokenField]: tokenField === 'max_tokens' ? 2048 : 8192 } : {}) })
    try {
      return await new Promise((resolve, reject) => {
        const request = https.request(url, {
          method: 'POST', agent: false, signal, family: 4,
          lookup: (_host, options, callback) => options.all
            ? callback(null, [pinned])
            : callback(null, pinned.address, pinned.family),
          headers: { authorization: 'Bearer ' + key, 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) },
        }, response => {
          const chunks = []
          let length = 0
          response.on('data', chunk => {
            length += chunk.length
            if (length > 256_000) response.destroy(new Error('Response too large'))
            else chunks.push(chunk)
          })
          response.on('error', reject)
          response.on('end', () => {
            try {
              if (response.statusCode !== 200) {
                const error = new Error('Upstream error')
                error.status = response.statusCode
                // Inspect only for compatibility; never expose upstream bodies or keys.
                error.tokenParameter = /max_tokens|max_completion_tokens/.test(Buffer.concat(chunks).toString())
                throw error
              }
              const data = JSON.parse(Buffer.concat(chunks))
              const content = data.choices?.[0]?.message?.content
              const reply = typeof content === 'string' ? content : Array.isArray(content)
                ? content.filter(part => part.type === 'text' && typeof part.text === 'string').map(part => part.text).join('\n') : ''
              if (!reply.trim()) throw new Error('Missing reply')
              resolve(reply)
            } catch (error) { reject(error) }
          })
        })
        request.on('error', reject)
        request.end(body)
      })
    } catch (error) {
      if (tokenField && [400, 422].includes(error.status) && error.tokenParameter) continue
      throw error
    }
  }
}
