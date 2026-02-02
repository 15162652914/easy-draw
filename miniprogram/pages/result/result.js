const { getDrawDetail, closeDraw } = require('../../utils/db')
const { formatTime } = require('../../utils/util')
const { DRAW_STATUS, DRAW_STATUS_TEXT, DRAW_TYPE, DRAW_TYPE_TEXT } = require('../../utils/constants')

Page({
  data: {
    drawId: '',
    drawDetail: null,
    loading: true,
    error: '',
    isCreator: false,
    hasParticipated: false,
    myResult: null,
    myResultText: '',
    groupedParticipants: {},
    openId: '',
    closing: false
  },

  onLoad(options) {
    const openId = wx.getStorageSync('openId')
    this.setData({ openId })

    if (options.drawId) {
      this.setData({ drawId: options.drawId })
      this.loadDrawDetail()
    } else {
      this.setData({ error: '缺少抽签ID', loading: false })
    }
  },

  onPullDownRefresh() {
    this.loadDrawDetail().then(() => {
      wx.stopPullDownRefresh()
    })
  },

  async loadDrawDetail() {
    const { drawId, openId } = this.data
    
    if (!drawId) {
      this.setData({ error: '缺少抽签ID', loading: false })
      return
    }
    
    this.setData({ loading: true, error: '' })
    
    try {
      const result = await getDrawDetail(drawId)
      
      if (result.success) {
        const detail = result.data
        console.log('抽签详情:', detail)
        const myParticipation = detail.participants?.find(p => p.openId === openId)

        const processedDetail = this.processDrawData(detail, openId)
        const myResultVal = myParticipation?.result ?? null
        const myResultText = this.resolveResultText(processedDetail, myResultVal)

        this.setData({
          drawDetail: processedDetail,
          isCreator: detail._openid === openId,
          hasParticipated: !!myParticipation,
          myResult: myResultVal,
          myResultText: myResultText,
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

  processDrawData(draw, openId) {
    if (!draw) return null

    draw.createTimeFormatted = formatTime(draw.createTime)
    
    // 兼容旧字符串类型或新版数值枚举
    let typeVal = draw.type
    if (typeof typeVal === 'string') {
      // 将字符串映射为数值枚举（兼容历史数据）
      const map = {
        'normal': DRAW_TYPE.NORMAL,
        'sequence': DRAW_TYPE.SEQUENCE,
        'random': DRAW_TYPE.RANDOM,
        'group': DRAW_TYPE.GROUP
      }
      typeVal = map[typeVal] ?? DRAW_TYPE.SEQUENCE
    }
    // 统一保存在 draw.type 为数值枚举
    draw.type = typeof typeVal === 'number' ? typeVal : DRAW_TYPE.SEQUENCE
    draw.typeText = DRAW_TYPE_TEXT[draw.type] || '普通抽签'

    // 兼容旧字符串状态，转换为数字枚举
    let statusVal = draw.status
    if (typeof statusVal === 'string') {
      if (statusVal === 'closed') statusVal = DRAW_STATUS.CLOSED
      else statusVal = DRAW_STATUS.ONGOING
    }
    draw.status = typeof statusVal === 'number' ? statusVal : DRAW_STATUS.ONGOING
    draw.statusText = DRAW_STATUS_TEXT[draw.status] || ''
    draw.statusClass = draw.status === DRAW_STATUS.ONGOING ? 'ongoing' : 'closed'

    // 参与人数与上限展示：优先使用 maxParticipants，其次 totalCount，最后 options.length
    draw.participantCount = Array.isArray(draw.participants) ? draw.participants.length : 0
    draw.upperLimit = (typeof draw.maxParticipants === 'number' && draw.maxParticipants > 0)
      ? draw.maxParticipants
      : (typeof draw.totalCount === 'number' && draw.totalCount > 0)
        ? draw.totalCount
        : Array.isArray(draw.options)
          ? draw.options.length
          : 0

    if (draw.participants) {
      draw.participants.forEach(p => {
        p.drawTimeFormatted = formatTime(p.drawTime)
        p.resultText = this.resolveResultText(draw, p.result)
      })
    }

    if (draw.type === DRAW_TYPE.GROUP && draw.status === DRAW_STATUS.CLOSED) {
      const grouped = draw.participants.reduce((acc, p) => {
        const groupName = p.result || '未分配'
        if (!acc[groupName]) acc[groupName] = []
        acc[groupName].push(p)
        return acc
      }, {})
      draw.groupedParticipants = grouped
    }

    return draw
  },

  resolveResultText(draw, result) {
    if (result === null || result === undefined) return ''
    const opts = Array.isArray(draw.options) ? draw.options : []
    // 结果为数字（或数字字符串）时，尝试映射到选项文本（1-based）
    const n = typeof result === 'number' ? result : parseInt(result, 10)
    if (!isNaN(n)) {
      const idx = n - 1
      if (idx >= 0 && idx < opts.length) return String(opts[idx])
    }
    // 其他情况，直接作为字符串展示
    return String(result)
  },

  onShareAppMessage() {
    const { drawId, drawDetail } = this.data
    const title = drawDetail?.title ? `邀请你参与抽签：${drawDetail.title}` : '快来参与这个好玩的抽签'
    const path = `/pages/draw/draw?drawId=${drawId}`
    
    return {
      title: title,
      path: path,
      imageUrl: ''
    }
  },

  async handleCloseDraw() {
    const { drawId, isCreator, drawDetail, closing } = this.data
    if (closing) return
    if (!isCreator) {
      wx.showToast({ title: '仅创建者可终止', icon: 'none' })
      return
    }
    if (drawDetail?.status === DRAW_STATUS.CLOSED) {
      wx.showToast({ title: '抽签已结束', icon: 'none' })
      return
    }
    wx.showModal({
      title: '终止抽签',
      content: '终止后将不可继续参与，是否确认？',
      success: async (res) => {
        if (!res.confirm) return
        this.setData({ closing: true })
        wx.showLoading({ title: '终止中...' })
        try {
          const result = await closeDraw({ drawId })
          if (result.success) {
            wx.showToast({ title: '已终止', icon: 'success' })
            // 刷新详情
            this.loadDrawDetail()
          } else {
            wx.showToast({ title: result.message || '终止失败', icon: 'none' })
          }
        } catch (e) {
          wx.showToast({ title: '终止失败，请重试', icon: 'none' })
        } finally {
          wx.hideLoading()
          this.setData({ closing: false })
        }
      }
    })
  },

  onShareTimeline() {
    const { drawId, drawDetail } = this.data
    return {
      title: drawDetail?.title || '一个有趣的抽签',
      query: `drawId=${drawId}`,
      imageUrl: ''
    }
  },

  copyResult() {
    const { drawDetail } = this.data
    if (!drawDetail || drawDetail.status !== DRAW_STATUS.CLOSED) {
      wx.showToast({ title: '抽签未结束', icon: 'none' })
      return
    }

    let resultText = `抽签主题：${drawDetail.title}\n`
    const upper = drawDetail.upperLimit || drawDetail.totalCount || (drawDetail.options?.length || 0)
    resultText += `参与人数：${drawDetail.participants.length}${upper ? ' / ' + upper : ''}\n`
    resultText += '-------------------\n'

    if (drawDetail.type === 'group') {
      for (const groupName in drawDetail.groupedParticipants) {
        resultText += `【${groupName}】\n`
        const members = drawDetail.groupedParticipants[groupName].map(p => p.nickname).join('、')
        resultText += `${members}\n`
      }
    } else {
      drawDetail.participants.forEach(p => {
        const value = p.resultText || p.result
        resultText += `${p.nickname} -> ${value}\n`
      })
    }

    wx.setClipboardData({
      data: resultText,
      success: () => {
        wx.showToast({ title: '结果已复制' })
      }
    })
  },

  goToDraw() {
    wx.navigateTo({
      url: `/pages/draw/draw?drawId=${this.data.drawId}`,
    })
  },

  goToHome() {
    wx.switchTab({ url: '/pages/index/index' })
  }
})