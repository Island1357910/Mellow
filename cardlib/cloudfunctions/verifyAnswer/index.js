const cloud = require('wx-server-sdk')
const crypto = require('crypto')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

function normalizeCardAnswer(input) {
  let text = String(input || '').trim().toLowerCase()
  text = text.replace(/\s+/g, '')
  text = text.replace(/[\uff01-\uff5e]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xfee0))
  text = text.replace(/\u3000/g, '')
  return text
}

function makeToken() {
  return crypto.randomBytes(24).toString('hex')
}

exports.main = async (event, context) => {
  const { cardId, questionId, answer } = event
  if (!cardId || !questionId || !answer) {
    return { ok: false, message: '请填写答案' }
  }

  try {
    const doc = await db.collection('cards').doc(cardId).get()
    const card = doc.data
    if (!card) return { ok: false, message: '找不到这张卡' }

    const question = (card.questions || []).find((item) => item.id === questionId)
    if (!question) return { ok: false, message: '题目无效' }

    const normalized = normalizeCardAnswer(answer)
    const accepted = (question.answers || []).map(normalizeCardAnswer)
    if (!accepted.includes(normalized)) {
      return { ok: false, message: '答案不对，再想想' }
    }

    const wxContext = cloud.getWXContext()
    const openid = wxContext.OPENID
    const token = makeToken()
    const expireAt = Date.now() + 5 * 60 * 1000

    await db.collection('tokens').add({
      data: {
        token,
        cardId,
        openid,
        expireAt,
        createdAt: Date.now(),
      },
    })

    return { ok: true, token, expireAt }
  } catch (error) {
    return { ok: false, message: error.message || '验证失败' }
  }
}
