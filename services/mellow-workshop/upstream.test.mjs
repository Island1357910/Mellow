import assert from 'node:assert/strict'
import test from 'node:test'
import { Resolver } from 'node:dns/promises'
import https from 'node:https'
import { PassThrough } from 'node:stream'
import { complete, endpoint } from './upstream.mjs'

test('phone model accepts base addresses, token parameter fallback and text parts', async t => {
  assert.equal(endpoint('https://model.example/v1/'), 'https://model.example/v1/chat/completions')
  assert.equal(endpoint('https://model.example'), 'https://model.example/v1/chat/completions')
  t.mock.method(Resolver.prototype, 'resolve4', async () => ['1.1.1.1'])
  const calls = []
  let unauthorized = false
  t.mock.method(https, 'request', (_url, options, callback) => {
    assert.equal(options.headers.authorization, 'Bearer private-key')
    const request = new PassThrough()
    request.on('data', bytes => {
      const body = JSON.parse(bytes)
      calls.push(body)
      const response = new PassThrough()
      response.statusCode = unauthorized ? 401 : body.max_tokens ? 400 : 200
      callback(response)
      response.end(JSON.stringify(unauthorized ? { error: 'private-key' } : body.max_tokens
        ? { error: 'Unsupported parameter max_tokens; use max_completion_tokens' }
        : { choices: [{ message: { content: [{ type: 'text', text: '收到你的短信。' }] } }] }))
    })
    return request
  })
  const turns = [{ role: 'user', content: '你好' }]
  assert.equal(await complete(endpoint('https://model.example/v1'), 'private-key', 'model', turns), '收到你的短信。')
  assert.equal(calls.length, 2)
  assert.equal(calls[1].max_completion_tokens, 8192)
  assert.deepEqual(calls[1].messages, turns)
  unauthorized = true
  await assert.rejects(complete(endpoint('https://model.example/v1'), 'private-key', 'model', turns), error => error.status === 401 && !error.message.includes('private-key'))
  assert.equal(calls.length, 3, 'auth failures must not retry')
})
