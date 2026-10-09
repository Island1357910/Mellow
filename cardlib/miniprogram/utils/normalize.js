function normalizeCardAnswer(input) {
  let text = String(input || '').trim().toLowerCase()
  text = text.replace(/\s+/g, '')
  text = text.replace(/[\uff01-\uff5e]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xfee0))
  text = text.replace(/\u3000/g, '')
  return text
}

module.exports = { normalizeCardAnswer }
