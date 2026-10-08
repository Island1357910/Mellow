export interface SearchConcern {
  tier: 'high' | 'medium'
  hint: string
}

const RULES: Array<{ re: RegExp; hint: string; tier: 'high' | 'medium' }> = [
  {
    re: /自杀|自残|想死|活不下去|不想活|了结|割腕|跳楼/,
    hint: '这非常让人担心。请非常温柔地确认 TA 是否安全，不要指责或说教。',
    tier: 'high',
  },
  {
    re: /症状|发烧|发热|头疼|头痛|咳嗽|嗓子|喉咙|胃痛|腹[痛疼]|恶心|呕吐|过敏|药|医院|挂号|体检|无力|乏力|胸口|呼吸|晕|血|肿瘤|癌症|白血病|糖尿病|高血压/,
    hint: 'TA 可能在查身体问题。像在乎的人那样问是不是不舒服、要不要休息或去医院。',
    tier: 'high',
  },
  {
    re: /失眠|睡不着|噩梦|抑郁|焦虑|panic|panic attack/i,
    hint: 'TA 可能在为睡眠或情绪困扰。轻轻问一句怎么了、最近是不是没睡好。',
    tier: 'high',
  },
  {
    re: /分手|出轨|背叛|崩溃|哭了|孤独|没人要|被甩|绿|冷战/,
    hint: 'TA 可能在为感情或情绪难过。别审问，像朋友一样关心一句。',
    tier: 'medium',
  },
  {
    re: /怎么办|好烦|烦死了|撑不住|受不了|好难|想哭/,
    hint: 'TA 搜的内容听起来不太好受。可以主动问一句怎么了、要不要聊聊。',
    tier: 'medium',
  },
]

const SKIP = /^(天气|今日天气|附近|翻译|汇率|快递|外卖)/

/** 判断搜索是否值得让已授权的角色主动关心。 */
export function classifySearchConcern(query: string): SearchConcern | null {
  const text = query.trim()
  if (text.length < 2) return null
  if (SKIP.test(text)) return null

  for (const rule of RULES) {
    if (rule.re.test(text)) return { tier: rule.tier, hint: rule.hint }
  }
  return null
}
