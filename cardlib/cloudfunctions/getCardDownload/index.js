const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { token } = event
  if (!token) return { ok: false, message: '缺少凭证' }

  try {
    const wxContext = cloud.getWXContext()
    const openid = wxContext.OPENID
    const { data: rows } = await db.collection('tokens').where({ token, openid }).limit(1).get()
    const row = rows[0]
    if (!row) return { ok: false, message: '凭证无效' }
    if (row.expireAt < Date.now()) return { ok: false, message: '链接已过期，请重新答题' }

    const doc = await db.collection('cards').doc(row.cardId).get()
    const card = doc.data
    if (!card) return { ok: false, message: '卡片不存在' }

    const fileIds = [card.jsonFileId, card.pngFileId, card.txtFileId].filter(Boolean)
    if (!fileIds.length) return { ok: false, message: '还没有上传文件' }

    const { fileList } = await cloud.getTempFileURL({ fileList: fileIds })
    const byId = Object.fromEntries(fileList.map((item) => [item.fileID, item.tempFileURL]))

    await db.collection('tokens').doc(row._id).remove()

    return {
      ok: true,
      files: {
        jsonUrl: card.jsonFileId ? byId[card.jsonFileId] : '',
        pngUrl: card.pngFileId ? byId[card.pngFileId] : '',
        txtUrl: card.txtFileId ? byId[card.txtFileId] : '',
      },
    }
  } catch (error) {
    return { ok: false, message: error.message || '下载失败' }
  }
}
