function pickQuestion(questions) {
  if (!questions || !questions.length) return null
  return questions[Math.floor(Math.random() * questions.length)]
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
    } catch (error) {
      this.setData({ busy: false, error: error.message || '验证失败' })
    }
  },

  async fetchDownloads() {
    const { token } = this.data
    if (!token) return
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

  async downloadJson() {
    let files = this.data.downloads
    if (!files) files = await this.fetchDownloads()
    if (!files?.jsonUrl) {
      wx.showToast({ title: '没有 JSON', icon: 'none' })
      return
    }
    wx.showLoading({ title: '下载中' })
    wx.downloadFile({
      url: files.jsonUrl,
      success(res) {
        wx.openDocument({
          filePath: res.tempFilePath,
          fileType: 'json',
          showMenu: true,
          fail() {
            wx.saveFile({
              tempFilePath: res.tempFilePath,
              success() { wx.showToast({ title: '已保存' }) },
            })
          },
        })
      },
      complete() { wx.hideLoading() },
    })
  },

  async downloadPng() {
    let files = this.data.downloads
    if (!files) files = await this.fetchDownloads()
    if (!files?.pngUrl) {
      wx.showToast({ title: '没有 PNG', icon: 'none' })
      return
    }
    wx.showLoading({ title: '下载中' })
    wx.downloadFile({
      url: files.pngUrl,
      success(res) {
        wx.saveImageToPhotosAlbum({
          filePath: res.tempFilePath,
          success() { wx.showToast({ title: '已存相册' }) },
          fail() { wx.showToast({ title: '请授权相册', icon: 'none' }) },
        })
      },
      complete() { wx.hideLoading() },
    })
  },
})
