/** Also formats legacy diagnostic messages already saved in chat history. */
export function apiErrorText(detail: string): string {
  if (/\bPROHIBITED_CONTENT\b|\bcontent_filter\b|\bSAFETY\b|blocked by Gemini API|content (?:policy|safety|filter)/i.test(detail)) {
    return '接口的内容审核拦截了这次请求，未生成回复。请求包含本次输入及已启用的预设、人设、世界书和上下文，无法仅凭此错误确定触发位置。已保留原记录；可核对启用的内容，或联系接口服务商查看拦截详情。'
  }
  if (/\bmodel_not_found\b|requested model is (?:temporarily )?unavailable|model[^\n]*(?:does not exist|not found)/i.test(detail)) {
    return '所选模型暂时不可用，或当前接口已不再提供该模型。请稍后重试，或到「设置 → 连接 → 接口与模型」重新拉取并选择可用模型。'
  }
  return detail
}
