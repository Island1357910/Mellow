import 'fake-indexeddb/auto'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'
globalThis.window = globalThis
globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} }
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' })
try {
  const { ConnectionsApp } = await server.ssrLoadModule('/src/components/apps/ConnectionsApp.tsx')
  const { useMellow } = await server.ssrLoadModule('/src/store/useMellow.ts')
  const { useConnectionsTab, CONNECTIONS_TABS } = await server.ssrLoadModule('/src/lib/connectionsTabs.ts')
  Object.assign(useMellow.getInitialState(), { identities: [{ id: 'test-phone', namespace: 'tabs-test' }], activeIdentityId: 'test-phone' })
  for (const item of CONNECTIONS_TABS) {
    useConnectionsTab.getInitialState().tab = item.id
    const html = renderToStaticMarkup(React.createElement(ConnectionsApp, { onBack: () => {} }))
    const tabs = html.match(/<button[^>]*role="tab"[^>]*>/g) ?? []
    const panels = html.match(/<section[^>]*role="tabpanel"[^>]*>/g) ?? []
    assert.equal(tabs.length, 4)
    assert.equal(panels.length, 4)
    assert.equal(tabs.filter(t => t.includes('aria-selected="true"')).length, 1)
    assert.ok(tabs.some(t => t.includes('connections-tab-' + item.id) && t.includes('aria-selected="true"')))
    assert.equal(panels.filter(p => p.includes('hidden')).length, 3, '每次只展示一个分类，其他面板保留挂载')
    assert.ok(panels.some(p => p.includes('connections-panel-' + item.id) && !p.includes('hidden')))
  }
  console.log('connections tabs render ok: four accessible tabs, one visible panel, other panels retained')
} finally { await server.close() }
process.exit(0)
