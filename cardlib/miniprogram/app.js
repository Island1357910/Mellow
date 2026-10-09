const { cloudEnvId } = require('./config/env.js')

function resolveCloudEnv() {
  const trimmed = String(cloudEnvId || '').trim()
  if (trimmed && !trimmed.includes('请替换')) return trimmed
  return wx.cloud.DYNAMIC_CURRENT_ENV
}

App({
  onLaunch() {
    if (!wx.cloud) {
      console.error('[半糖卡库] 基础库版本过低，无法使用云开发')
      return
    }
    const env = resolveCloudEnv()
    wx.cloud.init({
      env,
      traceUser: true,
    })
    console.info('[半糖卡库] 云环境:', env === wx.cloud.DYNAMIC_CURRENT_ENV ? '（开发者工具当前选中环境）' : env)
  },
})
