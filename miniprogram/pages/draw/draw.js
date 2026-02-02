const { getDrawDetail, joinDraw, closeDraw } = require('../../utils/db')
const { DRAW_STATUS, DRAW_STATUS_TEXT } = require('../../utils/constants')

Page({
  data: {
    drawId: '',
    drawDetail: null,
    loading: true,
    error: '',
    joined: false,
    userInfo: null,
    isCreator: false
  },

  onLoad(options) {
    if (options.drawId) {
      this.setData({ drawId: options.drawId })
      this.loadDrawDetail()
      this.getUserInfo()
    } else {
      this.setData({ error: '缺少抽签ID', loading: false })
    }
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
        }
      })
    }
  },

  async loadDrawDetail() {
    const { drawId, userInfo } = this.data
    
    if (!drawId) {
      this.setData({ error: '缺少抽签ID', loading: false })
      return
    }
    
    this.setData({ loading: true, error: '' })
    
    try {
      const result = await getDrawDetail(drawId)

      if (result.success) {
        // 使用本地缓存 openId 判断是否已参与（避免依赖 userInfo 顺序）
        const currentOpenId = wx.getStorageSync('openId')
        const joined = result.data.participants?.some(p => p.openId === currentOpenId)

        // 兼容旧数据：如果 status 是字符串，尝试转换为数字枚举
        let statusVal = result.data.status
        if (typeof statusVal === 'string') {
          // 常见旧值映射
          if (statusVal === 'ongoing' || statusVal === 'active') statusVal = DRAW_STATUS.ONGOING
          else if (statusVal === 'closed') statusVal = DRAW_STATUS.CLOSED
          else statusVal = DRAW_STATUS.ONGOING
        }

        result.data.status = typeof statusVal === 'number' ? statusVal : 0
        result.data.statusText = DRAW_STATUS_TEXT[result.data.status] || ''
        result.data.statusClass = result.data.status === DRAW_STATUS.ONGOING ? 'ongoing' : 'closed'
        // 附加每位参与者的文本结果（按选项映射）
        if (Array.isArray(result.data.participants)) {
          result.data.participants = result.data.participants.map(p => ({
            ...p,
            resultText: this.resolveResultText(result.data, p.result)
          }))
        }

        this.setData({
          drawDetail: result.data,
          joined: !!joined,
          isCreator: result.data._openid === currentOpenId,
          loading: false
        })
      } else {
        this.setData({ error: result.message, loading: false })
      }
    } catch (error) {
      console.error('加载抽签详情失败:', error)
      this.setData({ error: '加载失败，请重试', loading: false })
    }
  },

  async handleCloseDraw() {
    const { drawId, isCreator, drawDetail } = this.data
    if (!isCreator) {
      wx.showToast({ title: '仅创建者可终止', icon: 'none' })
      return
    }
    if (drawDetail?.status !== DRAW_STATUS.ONGOING) {
      wx.showToast({ title: '当前不可终止', icon: 'none' })
      return
    }
    wx.showModal({
      title: '终止抽签',
      content: '终止后将不可继续参与，是否确认？',
      success: async (res) => {
        if (!res.confirm) return
        wx.showLoading({ title: '终止中...' })
        try {
          const result = await closeDraw({ drawId })
          wx.hideLoading()
          if (result.success) {
            wx.showToast({ title: '已终止', icon: 'success' })
            this.loadDrawDetail()
          } else {
            wx.showToast({ title: result.message || '终止失败', icon: 'none' })
          }
        } catch (e) {
          wx.hideLoading()
          wx.showToast({ title: '终止失败，请重试', icon: 'none' })
        }
      }
    })
  },

  async handleJoinDraw() {
    const { drawId, userInfo, drawDetail, joined } = this.data
    if (joined) {
      wx.showToast({ title: '已参与', icon: 'none' })
      return
    }
    
    if (!userInfo) {
      wx.showToast({ title: '请先授权获取用户信息', icon: 'none' })
      return
    }
    
    if (drawDetail.status !== DRAW_STATUS.ONGOING) {
      wx.showToast({ title: '此抽签当前不可参与', icon: 'none' })
      return
    }
    
    wx.showLoading({ title: '参与中...' })
    
    try {
      const result = await joinDraw({
        drawId: drawId,
        nickname: userInfo.nickName,
        avatar: userInfo.avatarUrl
      })
      
      wx.hideLoading()
      
      if (result.success) {
        // 如果云函数返回已参与情况，直接跳转并标记已参与
        if (result.data?.hasJoined) {
          this.setData({ joined: true })
          wx.showToast({ title: result.message || '已参与', icon: 'success' })
          setTimeout(() => {
            wx.navigateTo({ url: `/pages/result/result?drawId=${drawId}` })
          }, 700)
          return
        }

        wx.showToast({ title: result.message, icon: 'success' })

        // 更新本地状态：把新参与者追加到 participants（即时反馈）
        const participant = {
          openId: wx.getStorageSync('openId'),
          nickname: userInfo.nickName,
          avatar: userInfo.avatarUrl,
          result: result.data?.result ?? null,
          resultText: this.resolveResultText(updatedDetail, result.data?.result ?? null),
          drawTime: Date.now()
        }

        const updatedDetail = Object.assign({}, drawDetail)
        updatedDetail.participants = updatedDetail.participants ? [...updatedDetail.participants, participant] : [participant]
        // 如果参与人数已满，更新状态为 FULL（优先使用 maxParticipants）
        const upperLimit = (typeof updatedDetail.maxParticipants === 'number' && updatedDetail.maxParticipants > 0)
          ? updatedDetail.maxParticipants
          : (typeof updatedDetail.totalCount === 'number' && updatedDetail.totalCount > 0)
            ? updatedDetail.totalCount
            : (updatedDetail.options?.length || 0)
        if (upperLimit > 0 && updatedDetail.participants.length >= upperLimit) {
          updatedDetail.status = DRAW_STATUS.FULL
          updatedDetail.statusText = DRAW_STATUS_TEXT[DRAW_STATUS.FULL]
          updatedDetail.statusClass = 'closed'
        }

        this.setData({
          drawDetail: updatedDetail,
          joined: true
        })

        // 跳转到结果页面
        setTimeout(() => {
          wx.navigateTo({ url: `/pages/result/result?drawId=${drawId}` })
        }, 800)
      } else {
        wx.showToast({ title: result.message, icon: 'none' })
      }
    } catch (error) {
      wx.hideLoading()
      wx.showToast({ title: '参与失败，请重试', icon: 'none' })
      console.error('参与抽签失败:', error)
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

  goToHistory() {
    wx.switchTab({ url: '/pages/history/history' })
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