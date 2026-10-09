const { friendlyCloudError } = require('../../utils/cloudError.js')

Page({
  data: {
    cards: [],
    filtered: [],
    query: '',
    loading: true,
    error: '',
  },

  onLoad() {
    this.loadCards()
  },

  onQueryInput(event) {
    this.setData({ query: event.detail.value }, () => {
      this.setData({ filtered: this.filteredCards() })
    })
  },

  onPullDownRefresh() {
    this.loadCards().finally(() => wx.stopPullDownRefresh())
  },

  async loadCards() {
    this.setData({ loading: true, error: '' })
    try {
      const { result } = await wx.cloud.callFunction({ name: 'listCards', data: {} })
      if (!result || !result.ok) throw new Error(result?.message || '加载失败')
      const cards = result.cards || []
      this.setData({ cards, loading: false }, () => {
        this.setData({ filtered: this.filteredCards() })
      })
    } catch (error) {
      this.setData({
        loading: false,
        error: friendlyCloudError(error),
      })
    }
  },

  filteredCards() {
    const q = this.data.query.trim().toLowerCase()
    if (!q) return this.data.cards
    return this.data.cards.filter((item) => (
      item.name.toLowerCase().includes(q)
      || item.summary.toLowerCase().includes(q)
      || (item.tags || []).some((tag) => tag.toLowerCase().includes(q))
    ))
  },

  onShow() {
    this.setData({ filtered: this.filteredCards() })
  },

  openCard(event) {
    const id = event.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/detail/detail?id=${id}` })
  },
})
