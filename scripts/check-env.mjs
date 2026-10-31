// 仅供 Node 检查脚本使用，生产构建由 Vite 注入。
globalThis.__MELLOW_BUILD_ID__ = 'local-regression'
globalThis.__MELLOW_BUILD_TIME__ = '2026-10-31T00:00:00.000Z'
globalThis.window = globalThis
globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} }
globalThis.__MELLOW_APP_VERSION__ = '0.2.0-test'
