import { mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs'
import { join, basename } from 'node:path'

export const cardsRoot = join(import.meta.dirname, '..', 'cards')

export const ID_MAP = {
  殷枕崖: 'yinzhenya',
  欢迎来到星露谷: 'stardewvalley',
  星露谷: 'stardewvalley',
  沈予安: 'shenyuan',
  宋淮: 'songhuai',
  墨非: 'mofei',
  温屿: 'wenyu',
  程默: 'chengmo',
  方唐: 'fangtang',
  殷折安: 'yinzhean',
  严长知: 'yanchangzhi',
  徐兰青: 'xulanqing',
  路怀远: 'luhuaiyuan',
  蓝与舟: 'lanyuzhou',
}

const STRUCTURED_TAGS = new Set([
  'world_entry',
  'setting_note',
  'chain_of_thought_guide',
  'writing_style_guide',
  'life_timeline',
  'appearance_notes',
  'traits_sheet',
  'persona_sheet',
  'interaction_and_relationships',
])

export const CUSTOM_META = {
  yinzhenya: {
    summary: '大燕权臣，内阁首辅。银白衣袍、凤眼冷厉，对认定之人却嘴毒心软。',
    tags: ['古风', '权臣', '年上'],
  },
  stardewvalley: {
    summary: '星露谷农场开局。鹈鹕镇、四季耕种、技能成长与状态栏玩法。',
    tags: ['模拟', '星露谷', '农场'],
  },
  shenyuan: {
    summary: '顶层名流，限时高奢恋爱。云端大平层、体面契约与沉没成本止损。',
    tags: ['现代', '豪门', '拉扯'],
  },
  songhuai: {
    summary: 'A大法学副教授，三十三岁年上。智性恋、师生边界与克制偏爱。',
    tags: ['现代', '师生', '年上'],
  },
  mofei: {
    summary: '十九岁网黄博主，银发高敏感。镜头前放浪，只对一人黏人。',
    tags: ['现代', '网黄', '高敏感'],
  },
  wenyu: {
    summary: '建筑学院温柔学长，二十二岁。细腻体贴，对新生格外偏爱。',
    tags: ['现代', '学长', '温柔'],
  },
  chengmo: {
    summary: '二十三岁数据分析师，低精力社畜。能躺绝不站，待机式生存。',
    tags: ['现代', '社畜', '日常'],
  },
}

export const CUSTOM_QUESTIONS = {
  yinzhenya: [
    { id: 'q1', prompt: '殷枕崖的职务是？（三个字）', answers: ['内阁首辅', '首辅'] },
    { id: 'q2', prompt: '殷枕崖多少岁？（三个字）', answers: ['二十七', '二十七岁'] },
    { id: 'q3', prompt: '殷枕崖出身于哪个姓氏的世家？（一个字）', answers: ['殷'] },
    { id: 'q4', prompt: '殷枕崖平日偏爱什么颜色的朝堂长袍？（两个字）', answers: ['银白', '白色'] },
    { id: 'q5', prompt: '这张卡的角色叫什么？', answers: ['殷枕崖'] },
  ],
  stardewvalley: [
    { id: 'q1', prompt: '故事发生在哪个小镇？（三个字）', answers: ['鹈鹕镇'] },
    { id: 'q2', prompt: '开局是哪一个季节？（两个字）', answers: ['春季', '春天'] },
    { id: 'q3', prompt: '开局身上有多少金币？（三个数字）', answers: ['500'] },
    { id: 'q4', prompt: '镇长叫什么名字？（三个字）', answers: ['刘易斯'] },
    { id: 'q5', prompt: '这张卡/play 的名字里包含哪个游戏？（三个字）', answers: ['星露谷'] },
  ],
  shenyuan: [
    { id: 'q1', prompt: '沈予安住在什么类型的住所？（三个字）', answers: ['大平层', '平层'] },
    { id: 'q2', prompt: '沈予安姓氏是？（一个字）', answers: ['沈'] },
    { id: 'q3', prompt: '设定里分手时他常用什么方式买断纠缠？（两个字）', answers: ['珠宝', '高定'] },
    { id: 'q4', prompt: '整栋平层里唯一带指纹锁的禁区是？（两个字）', answers: ['书房'] },
    { id: 'q5', prompt: '这张卡的角色叫什么？', answers: ['沈予安'] },
  ],
  songhuai: [
    { id: 'q1', prompt: '宋淮在 A 大教什么方向的课？（两个字）', answers: ['法学', '民法'] },
    { id: 'q2', prompt: '宋淮多少岁？（两个数字）', answers: ['33', '三十三', '33岁'] },
    { id: 'q3', prompt: '他熬夜后常去后街吃什么？（三个字）', answers: ['土豆粉'] },
    { id: 'q4', prompt: '他的英文名是？（姓和名之间可有空格）', answers: ['Song Huai', 'SongHuai'] },
    { id: 'q5', prompt: '这张卡的角色叫什么？', answers: ['宋淮'] },
  ],
  mofei: [
    { id: 'q1', prompt: '墨非多少岁？（两个数字）', answers: ['19', '十九', '19岁'] },
    { id: 'q2', prompt: '墨非把头发染成什么颜色？（两个字）', answers: ['银白', '白色', '纯白'] },
    { id: 'q3', prompt: '墨非的公开身份关键词？（两个字）', answers: ['网黄', '博主'] },
    { id: 'q4', prompt: '墨非的身高是多少 cm？（三个数字）', answers: ['183'] },
    { id: 'q5', prompt: '这张卡的角色叫什么？', answers: ['墨非'] },
  ],
  wenyu: [
    { id: 'q1', prompt: '温屿在哪个学院就读？（三个字）', answers: ['建筑学院', '建筑'] },
    { id: 'q2', prompt: '温屿多少岁？（两个数字）', answers: ['22', '二十二', '22岁'] },
    { id: 'q3', prompt: '温屿的生日是几月？（两个数字+月）', answers: ['10月', '十月'] },
    { id: 'q4', prompt: '大家对温屿最常见的称呼后缀是？（两个字）', answers: ['学长'] },
    { id: 'q5', prompt: '这张卡的角色叫什么？', answers: ['温屿'] },
  ],
  chengmo: [
    { id: 'q1', prompt: '程默的职业是？（五个字）', answers: ['数据分析师', '数据分析'] },
    { id: 'q2', prompt: '程默多少岁？（两个数字）', answers: ['23', '二十三', '23岁'] },
    { id: 'q3', prompt: '程默的生日是哪一天？（月/日，四个数字）', answers: ['11月11日', '1111', '11/11'] },
    { id: 'q4', prompt: '程默的身高是多少 cm？（三个数字）', answers: ['182'] },
    { id: 'q5', prompt: '这张卡的角色叫什么？', answers: ['程默'] },
  ],
}

export function displayNameFromPath(filePath) {
  return basename(filePath).replace(/\.[^.]+$/, '').replace(/（[^）]+）/g, '').replace(/\([^)]+\)/g, '').trim()
}

export function resolveId(name, filePath) {
  const base = displayNameFromPath(filePath)
  return ID_MAP[name] || ID_MAP[base] || base.replace(/\s+/g, '').toLowerCase()
}

export function stripTags(text) {
  return String(text || '').replace(/<[^>]+>/g, '').trim()
}

export function pickEnglishName(desc) {
  const match = String(desc).match(/english_name:\s*["']?([^"'\n]+)/i)
    || String(desc).match(/English name:\s*["']?([^"'\n]+)/i)
  return match?.[1]?.trim() || ''
}

export function pickSnippet(desc, max = 40) {
  const plain = String(desc).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  const lines = plain.split(/[。.\n]/).map((item) => item.trim()).filter(Boolean)
  const line = lines.find((item) => (
    item.length >= 8
    && !item.startsWith('#')
    && !/character profile|basic_information|english_name|核心身份/i.test(item)
  ))
  return (line || '').slice(0, max).trim()
}

export function summaryText(data, name, id) {
  if (CUSTOM_META[id]?.summary) return CUSTOM_META[id].summary
  const personality = stripTags(data.personality || '').slice(0, 80)
  if (personality) return personality
  const scenario = stripTags(data.scenario || '').slice(0, 72)
  if (scenario) return scenario
  const snippet = pickSnippet(String(data.description || ''), 72)
  if (snippet && !snippet.startsWith('#')) return snippet
  return `${name} · 半糖角色卡`
}

export function buildQuestions(name, data, id) {
  if (CUSTOM_QUESTIONS[id]) return CUSTOM_QUESTIONS[id]
  const desc = String(data.description || '')
  const english = pickEnglishName(desc)
  const first = stripTags(data.first_mes || '')
  const scenario = stripTags(data.scenario || '').slice(0, 30)
  const snippet = pickSnippet(desc, 24)

  const questions = [
    { id: 'q1', prompt: `${name}的全名是？`, answers: [name] },
  ]
  if (english) {
    questions.push({
      id: 'q2',
      prompt: `${name}的英文名是？（姓和名之间可有空格）`,
      answers: [english, english.replace(/\s+/g, '')],
    })
  }
  if (first && first.length <= 40) {
    questions.push({
      id: 'q3',
      prompt: `与${name}相关的开场白/标题是？（照抄，不含尖括号）`,
      answers: [first, first.replace(/[「」"'""]/g, '')],
    })
  }
  if (scenario) {
    questions.push({
      id: 'q4',
      prompt: `和${name}相关的场景关键词？（4～12字）`,
      answers: [scenario, scenario.slice(0, 12)],
    })
  }
  if (snippet && !snippet.startsWith('#')) {
    questions.push({
      id: 'q5',
      prompt: `设定里与${name}有关的一句描述？（答连续4～10个字）`,
      answers: [snippet, snippet.slice(0, 10), snippet.slice(0, 8)].filter(Boolean),
    })
  }
  questions.push({ id: 'q6', prompt: '这张卡的角色叫什么？', answers: [name] })
  return questions.slice(0, 8)
}

export function normalizeCard(raw) {
  if (raw?.data && typeof raw.data === 'object') {
    const data = { ...raw.data }
    if (!data.name && raw.name) data.name = raw.name
    if (!data.description && raw.description) data.description = raw.description
    if (!data.personality && raw.personality) data.personality = raw.personality
    if (!data.scenario && raw.scenario) data.scenario = raw.scenario
    if (!data.first_mes && raw.first_mes) data.first_mes = raw.first_mes
    if (!data.mes_example && raw.mes_example) data.mes_example = raw.mes_example
    return {
      spec: raw.spec || 'chara_card_v3',
      spec_version: raw.spec_version || '3.0',
      data,
    }
  }
  return { spec: 'chara_card_v3', spec_version: '3.0', data: raw }
}

function parseAttr(attrs, name) {
  const match = attrs.match(new RegExp(`${name}\\s*=\\s*["']([^"']+)["']`, 'i'))
  return match?.[1]?.trim() ?? ''
}

function collectDocBlocks(text) {
  const cleaned = text.replace(/```(?:xml|yaml)?/gi, '').replace(/```/g, '')
  const blocks = []
  const re = /<([a-zA-Z_\u4e00-\u9fff][\w\u4e00-\u9fff]*)(\s[^>]*)?>([\s\S]*?)<\/\1>/g
  for (const match of cleaned.matchAll(re)) {
    const tag = match[1].toLowerCase()
    const content = match[3].trim()
    if (!content) continue
    blocks.push({
      tag,
      attrs: match[2] || '',
      content,
      subject: parseAttr(match[2] || '', 'subject'),
      title: parseAttr(match[2] || '', 'entry_title') || parseAttr(match[2] || '', 'card_name') || tag,
    })
  }
  return blocks
}

function blockByTag(blocks, tag) {
  return blocks.find((item) => item.tag === tag)
}

function extractFirstMes(traits, interaction) {
  for (const source of [traits, interaction]) {
    const line = source.split('\n').find((row) => /热恋期/.test(row))
    if (!line) continue
    const hot = line.match(/热恋期[：:]\s*(.+)/)
    if (!hot?.[1]) continue
    const quote = hot[1].replace(/^[\s"'「『]+|[\s"'」』。]+$/g, '').trim()
    if (quote) return quote
  }
  return ''
}

function extractPersonality(persona, traits) {
  const personaPart = persona.match(/性格底色[：:]\s*([\s\S]*?)(?:\n[^\n]+[：:]|$)/)?.[1]?.trim()
  if (personaPart) return personaPart
  return traits.slice(0, 1200).trim()
}

export function tryParseStructuredDoc(text) {
  const blocks = collectDocBlocks(text)
  if (blocks.length < 2) return null
  const named = blocks.filter((item) => item.subject)
  const charName = named[0]?.subject ?? ''
  if (!charName) return null
  const hasStructuredTag = blocks.some((item) => STRUCTURED_TAGS.has(item.tag))
  if (!hasStructuredTag) return null

  const appearance = blockByTag(blocks, 'appearance_notes')?.content ?? ''
  const traits = blockByTag(blocks, 'traits_sheet')?.content ?? ''
  const persona = blockByTag(blocks, 'persona_sheet')?.content ?? ''
  const world = blockByTag(blocks, 'world_entry')?.content ?? ''
  const interaction = blockByTag(blocks, 'interaction_and_relationships')?.content ?? ''
  const description = [appearance, traits].filter(Boolean).join('\n\n').trim()
  const personality = extractPersonality(persona, traits)
  const scenario = world.slice(0, 2000).trim() || blockByTag(blocks, 'setting_note')?.content.slice(0, 2000).trim() || ''
  const firstMes = extractFirstMes(traits, interaction)
  const entries = blocks.map((item, index) => ({
    id: index + 1,
    keys: Array.from(new Set([charName, item.title].filter(Boolean))),
    content: item.content,
    comment: item.title,
    name: item.title,
    constant: ['world_entry', 'chain_of_thought_guide', 'writing_style_guide'].includes(item.tag),
    selective: true,
    order: index,
    enabled: true,
  }))

  return {
    spec: 'chara_card_v3',
    spec_version: '3.0',
    data: {
      name: charName,
      description,
      personality,
      scenario,
      first_mes: firstMes,
      mes_example: '',
      creator_notes: '',
      system_prompt: blockByTag(blocks, 'writing_style_guide')?.content.slice(0, 4000) ?? '',
      post_history_instructions: blockByTag(blocks, 'chain_of_thought_guide')?.content.slice(0, 4000) ?? '',
      tags: ['结构化文档'],
      character_book: { name: charName, entries },
      extensions: { structuredDocImport: true },
    },
  }
}

export function plainTextCardJson(text, name) {
  const body = text.trim()
  return {
    spec: 'chara_card_v3',
    spec_version: '3.0',
    data: {
      name,
      description: body.slice(0, 4000),
      personality: '',
      scenario: '',
      first_mes: '',
      mes_example: '',
      creator_notes: '',
      tags: ['文档导入'],
      character_book: {
        name,
        entries: [{
          id: 1,
          keys: [name],
          content: body,
          comment: '原文',
          constant: true,
          enabled: true,
          order: 100,
        }],
      },
      extensions: { plainTextImport: true },
    },
  }
}

export function writeCardBundle({ id, name, card, questions, txtPath, pngPath, coverPath }) {
  const dir = join(cardsRoot, id)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'card.json'), `${JSON.stringify(card, null, 2)}\n`)
  if (txtPath) copyFileSync(txtPath, join(dir, 'card.txt'))
  if (pngPath) {
    copyFileSync(pngPath, join(dir, 'card.png'))
    copyFileSync(pngPath, join(dir, 'cover.png'))
  } else if (coverPath) {
    copyFileSync(coverPath, join(dir, 'cover.png'))
  }

  const meta = {
    id,
    name,
    summary: summaryText(card.data, name, id),
    tags: CUSTOM_META[id]?.tags || ['半糖', ...(Array.isArray(card.data.tags) ? card.data.tags.slice(0, 3) : [])],
    author: card.data.creator || '半糖',
    version: card.data.character_version || '1.0.0',
  }
  writeFileSync(join(dir, 'meta.json'), `${JSON.stringify(meta, null, 2)}\n`)
  writeFileSync(join(dir, 'questions.json'), `${JSON.stringify(questions, null, 2)}\n`)
  return dir
}
