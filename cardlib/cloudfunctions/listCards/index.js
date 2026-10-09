const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

function publicQuestions(questions) {
  return (questions || []).map((item) => ({ id: item.id, prompt: item.prompt }))
}

async function withCover(card) {
  const out = {
    id: card._id || card.id,
    name: card.name,
    summary: card.summary || '',
    tags: card.tags || [],
    author: card.author || '半糖',
    version: card.version || '1.0.0',
    questions: publicQuestions(card.questions),
    coverUrl: '',
  }
  if (card.coverFileId) {
    try {
      const { fileList } = await cloud.getTempFileURL({ fileList: [card.coverFileId] })
      out.coverUrl = fileList[0]?.tempFileURL || ''
    } catch {
      out.coverUrl = ''
    }
  }
  return out
}

exports.main = async (event) => {
  try {
    if (event.id) {
      const doc = await db.collection('cards').doc(event.id).get()
      if (!doc.data) return { ok: false, message: '找不到这张卡' }
      return { ok: true, card: await withCover(doc.data) }
    }
    const { data } = await db.collection('cards').orderBy('name', 'asc').get()
    const cards = await Promise.all(data.map(withCover))
    return { ok: true, cards }
  } catch (error) {
    return { ok: false, message: error.message || '读取失败' }
  }
}
