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

interface DocBlock {
  tag: string
  attrs: string
  content: string
  subject: string
  title: string
}

function parseAttr(attrs: string, name: string): string {
  const match = attrs.match(new RegExp(`${name}\\s*=\\s*["']([^"']+)["']`, 'i'))
  return match?.[1]?.trim() ?? ''
}

function stripCodeFences(text: string): string {
  return text.replace(/```(?:xml)?/gi, '').replace(/```/g, '')
}

function collectBlocks(text: string): DocBlock[] {
  const cleaned = stripCodeFences(text)
  const blocks: DocBlock[] = []
  const re = /<([a-zA-Z_\u4e00-\u9fff][\w\u4e00-\u9fff]*)\b([^>]*)>([\s\S]*?)<\/\1>/g
  for (const match of cleaned.matchAll(re)) {
    const tag = match[1].toLowerCase()
    const attrs = match[2]
    const content = match[3].trim()
    if (!content) continue
    blocks.push({
      tag,
      attrs,
      content,
      subject: parseAttr(attrs, 'subject'),
      title: parseAttr(attrs, 'entry_title') || parseAttr(attrs, 'card_name') || tag,
    })
  }
  return blocks
}

function blockByTag(blocks: DocBlock[], tag: string): DocBlock | undefined {
  return blocks.find((item) => item.tag === tag)
}

function extractFirstMes(traits: string, interaction: string): string {
  for (const source of [traits, interaction]) {
    const hot = source.match(/热恋期[^"\n]*[""「『'"]([^""」』'"]+)[""」』'"]/)
    if (hot?.[1]) return hot[1].trim()
  }
  return ''
}

function extractPersonality(persona: string, traits: string): string {
  const personaPart = persona.match(/性格底色[：:]\s*([\s\S]*?)(?:\n[^\n]+[：:]|$)/)?.[1]?.trim()
  if (personaPart) return personaPart
  return traits.slice(0, 1200).trim()
}

/** 识别 XML 标签式角色设定文档，本地转成 SillyTavern JSON，无需 AI。 */
export function tryParseStructuredDoc(text: string): unknown | null {
  const blocks = collectBlocks(text)
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
    constant: item.tag === 'world_entry' || item.tag === 'chain_of_thought_guide' || item.tag === 'writing_style_guide',
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
