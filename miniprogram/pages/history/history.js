const { getUserDraws, getCreatorDraws, closeDraw } = require('../../utils/db')
const { DRAW_STATUS, DRAW_STATUS_TEXT, DRAW_TYPE, DRAW_TYPE_TEXT } = require('../../utils/constants')

const PAGE_SIZE = 10

Page({
  data: {
    openId: '',
    activeTab: 'participated',
    draws: [],
    loading: false,
    hasMore: true,
    page: 0,
    error: '',
    userInfo: null,
    closingId: ''
  },

  onLoad() {
    this.setData({
      openId: wx.getStorageSync('openId') || ''
    })
    this.getUserInfo()
    this.loadHistory(true)
  },

  onShow() {
    // 页面显示时可以考虑是否需要刷新
    // this.loadHistory(true)
  },

  // 触底加载更多
  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.loadHistory()
    }
  },

  // 下拉刷新
  onPullDownRefresh() {
    this.loadHistory(true).then(() => {
      wx.stopPullDownRefresh()
    })
  },

  getUserInfo() {
    const userInfo = wx.getStorageSync('userInfo')
    if (userInfo) {
      this.setData({ userInfo })
    } else {
      wx.getUserProfile({
        desc: '用于完善用户信息',
        success: (res) => {
          this.setData({ userInfo: res.userInfo })
          wx.setStorageSync('userInfo', res.userInfo)
          this.loadHistory(true)
        }
      })
    }
  },

  switchTab(e) {
    const { tab } = e.currentTarget.dataset
    if (this.data.activeTab === tab) return

    this.setData({ 
      activeTab: tab, 
      draws: [],
      page: 0,
      hasMore: true,
      loading: false
    })
    this.loadHistory(true)
  },

  async loadHistory(isRefresh = false) {
    if (this.data.loading) return
    
    const page = isRefresh ? 0 : this.data.page
    if (!isRefresh && !this.data.hasMore) return

    this.setData({ loading: true, error: '' })

    const { activeTab, openId } = this.data
    
    try {
      let result
      if (activeTab === 'participated') {
        result = await getUserDraws(openId, page, PAGE_SIZE)
      } else {
        result = await getCreatorDraws(openId, page, PAGE_SIZE)
      }
      
      if (result.success) {
        const processedDraws = result.data.map(draw => {
          const myParticipation = draw.participants?.find(
            p => p.openId === openId
          )
          
          // 兼容 string 状态，优先使用数值枚举
          let statusVal = draw.status
          if (typeof statusVal === 'string') {
            if (statusVal === 'ongoing' || statusVal === 'active') statusVal = DRAW_STATUS.ONGOING
            else if (statusVal === 'closed') statusVal = DRAW_STATUS.CLOSED
            else statusVal = DRAW_STATUS.ONGOING
          }

            // map to display classes used in history.wxss: active / completed
          const displayClass = statusVal === DRAW_STATUS.ONGOING ? 'active' : 'completed'

          const myResultVal = myParticipation?.result
          const myResultText = this.resolveResultText(draw, myResultVal)
          const upperLimit = (typeof draw.maxParticipants === 'number' && draw.maxParticipants > 0)
            ? draw.maxParticipants
            : (typeof draw.totalCount === 'number' && draw.totalCount > 0)
              ? draw.totalCount
              : Array.isArray(draw.options)
                ? draw.options.length
                : 0

          return {
            ...draw,
            participantCount: draw.participants?.length || 0,
            totalCount: draw.totalCount || draw.options?.length || 0,
            upperLimit: upperLimit,
            myResult: myResultVal ?? '未参与',
            myResultText: myResultText || '',
            hasParticipated: !!myParticipation,
            statusText: DRAW_STATUS_TEXT[statusVal] || '',
            statusClass: displayClass,
            typeText: this.getTypeText(draw.type),
            createTimeFormatted: this.formatTime(draw.createTime)
          }
        })
        
        const newDraws = isRefresh ? processedDraws : [...this.data.draws, ...processedDraws]

        // 按创建时间倒序排序
        const sortedDraws = newDraws.sort((a, b) => {
          return new Date(b.createTime) - new Date(a.createTime)
        })
        
        this.setData({
          draws: sortedDraws,
          loading: false,
          hasMore: result.data.length === PAGE_SIZE,
          page: page + 1
        })
      } else {
        this.setData({ error: result.message, loading: false })
      }
    } catch (error) {
      console.error('加载历史记录失败:', error)
      this.setData({ error: '加载失败，请重试', loading: false })
    }
  },

  // 将结果值映射为选项文本（数字视为 1-based 索引）
  resolveResultText(draw, result) {
    if (result === null || result === undefined) return ''
    const opts = Array.isArray(draw.options) ? draw.options : []
    const n = typeof result === 'number' ? result : parseInt(result, 10)
    if (!isNaN(n)) {
      const idx = n - 1
      if (idx >= 0 && idx < opts.length) return String(opts[idx])
    }
    return String(result)
  },

  // 获取抽签类型文本
  getTypeText(type) {
    // 支持字符串与数值枚举
    if (typeof type === 'number') return DRAW_TYPE_TEXT[type] || '普通抽签'
    const map = {
      'normal': DRAW_TYPE.NORMAL,
      'sequence': DRAW_TYPE.SEQUENCE,
      'random': DRAW_TYPE.RANDOM,
      'group': DRAW_TYPE.GROUP
    }
    const val = map[type]
    return DRAW_TYPE_TEXT[val] || '普通抽签'
  },

  viewDrawDetail(e) {
    const { drawid } = e.currentTarget.dataset
    wx.navigateTo({
      url: `/pages/result/result?drawId=${drawid}`
    })
  },

  async closeFromHistory(e) {
    const { drawid } = e.currentTarget.dataset
    // 防重复点击：正在终止该抽签时直接返回
    if (this.data.closingId === drawid) return
    wx.showModal({
      title: '终止抽签',
      content: '终止后将不可继续参与，是否确认？',
      success: async (res) => {
        if (!res.confirm) return
        this.setData({ closingId: drawid })
        wx.showLoading({ title: '终止中...' })
        try {
          const result = await closeDraw({ drawId: drawid })
          if (result.success) {
            wx.showToast({ title: '已终止', icon: 'success' })
            this.loadHistory(true)
          } else {
            wx.showToast({ title: result.message || '终止失败', icon: 'none' })
          }
        } catch (e) {
          wx.showToast({ title: '终止失败，请重试', icon: 'none' })
        } finally {
          wx.hideLoading()
          this.setData({ closingId: '' })
        }
      }
    })
  },

  goToCreate() {
    wx.navigateTo({
      url: '/pages/create/create'
    })
  },

  formatTime(timestamp) {
    if (!timestamp) return ''
    
    const date = new Date(timestamp)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    
    return `${year}-${month}-${day} ${hours}:${minutes}`
  }
})