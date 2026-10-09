function friendlyCloudError(error) {
  const msg = [
    error?.errMsg,
    error?.message,
    error?.toString?.(),
  ].filter(Boolean).join(' ')

  if (msg.includes('-601034') || msg.includes('没有权限') || msg.includes('开通云开发')) {
    return [
      '云开发还没开通或未绑定到这个 AppID。',
      '请按顺序：',
      '1. 开发者工具顶部点「云开发」→ 开通环境',
      '2. 复制环境 ID 填到 miniprogram/config/env.js',
      '3. 右键 cloudfunctions 下三个函数 → 上传并部署',
      '4. 重新编译',
    ].join('\n')
  }

  if (msg.includes('FunctionName') || msg.includes('-501000') || msg.includes('FUNCTION_NOT_FOUND')) {
    return '云函数还没部署。请右键 listCards / verifyAnswer / getCardDownload → 上传并部署。'
  }

  if (msg.includes('collection not exists') || msg.includes('DATABASE_COLLECTION_NOT_EXIST')) {
    return '云数据库还没有 cards 集合。请在云开发控制台新建 cards 和 tokens 集合。'
  }

  return msg || '云调用失败，请检查云开发与云函数部署'
}

module.exports = { friendlyCloudError }
