const FORMAT_LABELS = {
  json: 'JSON（酒馆格式）',
  png: 'PNG 卡面',
  txt: 'TXT（纯文本设定）',
}

function pickQuestion(questions) {
  if (!questions || !questions.length) return null
  return questions[Math.floor(Math.random() * questions.length)]
}

function formatHint(formats) {
  if (!formats || !formats.length) return '暂无下载文件'
  return formats.map((item) => FORMAT_LABELS[item] || item.toUpperCase()).join(' · ')
}

function downloadButtons(formats) {
  return (formats || []).map((format) => ({
    format,
    label: FORMAT_LABELS[format] || format.toUpperCase(),
  }))
}

Page({
  data: {
    card: null,
    question: null,
    answer: '',
    busy: false,
    error: '',
    unlocked: false,
    token: '',
    downloads: null,
    formatHint: '',
    downloadButtons: [],
  },

  onLoad(options) {
    this.cardId = options.id
    this.loadCard()
  },

  async loadCard() {
    this.setData({ busy: true, error: '' })
    try {
      const { result } = await wx.cloud.callFunction({
        name: 'listCards',
        data: { id: this.cardId },
      })
      if (!result?.ok || !result.card) throw new Error(result?.message || '找不到这张卡')
      const question = pickQuestion(result.card.questions)
      this.setData({
        card: result.card,
        question,
        formatHint: formatHint(result.card.formats),
        downloadButtons: downloadButtons(result.card.formats),
        busy: false,
      })
    } catch (error) {
      this.setData({ busy: false, error: error.message || '加载失败' })
    }
  },

  rerollQuestion() {
    const { card, question } = this.data
    if (!card || !card.questions || card.questions.length <= 1) return
    let next = pickQuestion(card.questions)
    while (next.id === question.id && card.questions.length > 1) {
      next = pickQuestion(card.questions)
    }
    this.setData({ question: next, answer: '', error: '' })
  },

  onAnswerInput(event) {
    this.setData({ answer: event.detail.value })
  },

  async submitAnswer() {
    const { card, question, answer } = this.data
    if (!card || !question || !answer.trim()) return
    this.setData({ busy: true, error: '' })
    try {
      const { result } = await wx.cloud.callFunction({
        name: 'verifyAnswer',
        data: {
          cardId: card.id,
          questionId: question.id,
          answer: answer.trim(),
        },
      })
      if (!result?.ok) throw new Error(result?.message || '答案不对')
      this.setData({ unlocked: true, token: result.token, busy: false })
      this.prefetchDownloads()
    } catch (error) {
      this.setData({ busy: false, error: error.message || '验证失败' })
    }
  },

  async prefetchDownloads() {
    try {
      await this.fetchDownloads()
    } catch {
      // 预取失败不阻塞，点下载时再试
    }
  },

  async fetchDownloads() {
    const { token } = this.data
    if (!token) return null
    this.setData({ busy: true, error: '' })
    try {
      const { result } = await wx.cloud.callFunction({
        name: 'getCardDownload',
        data: { token },
      })
      if (!result?.ok) throw new Error(result?.message || '获取下载链接失败')
      this.setData({ downloads: result.files, busy: false })
      return result.files
    } catch (error) {
      this.setData({ busy: false, error: error.message || '下载失败' })
      return null
    }
  },

  async ensureDownloads() {
    if (this.data.downloads) return this.data.downloads
    return this.fetchDownloads()
  },

  saveDownloadedFile(tempFilePath, label) {
    wx.saveFile({
      tempFilePath,
      success(res) {
        wx.showModal({
          title: '已保存',
          content: `${label} 已保存到本地。可在微信「我 → 设置 → 通用 → 存储空间 → 缓存」或文件管理中查看。`,
          showCancel: false,
        })
      },
      fail() {
        wx.showToast({ title: '保存失败', icon: 'none' })
      },
    })
  },

  async downloadFormat(event) {
    const format = event.currentTarget.dataset.format
    const files = await this.ensureDownloads()
    const urlKey = `${format}Url`
    const url = files?.[urlKey]
    if (!url) {
      wx.showToast({ title: `没有 ${format.toUpperCase()}`, icon: 'none' })
      return
    }

    wx.showLoading({ title: '下载中' })
    wx.downloadFile({
      url,
      success: (res) => {
        if (format === 'png') {
          wx.saveImageToPhotosAlbum({
            filePath: res.tempFilePath,
            success() { wx.showToast({ title: '已存相册' }) },
            fail() { wx.showToast({ title: '请授权相册', icon: 'none' }) },
          })
          return
        }

        wx.openDocument({
          filePath: res.tempFilePath,
          fileType: format === 'json' ? 'json' : 'txt',
          showMenu: true,
          fail: () => {
            this.saveDownloadedFile(res.tempFilePath, FORMAT_LABELS[format] || format.toUpperCase())
          },
        })
      },
      complete() { wx.hideLoading() },
    })
  },
})
