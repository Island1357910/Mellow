/** Also formats legacy diagnostic messages already saved in chat history. */
export function apiErrorText(detail: string): string {
  if (/\bmodel_not_found\b|requested model is (?:temporarily )?unavailable|model[^\n]*(?:does not exist|not found)/i.test(detail)) {
    return '所选模型暂时不可用，或当前接口已不再提供该模型。请稍后重试，或到「设置 → 连接 → 接口与模型」重新拉取并选择可用模型。'
  }
  return detail
}
