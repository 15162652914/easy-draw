const { getDrawDetail, closeDraw, joinDraw } = require('../../utils/db')
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
    closing: false,
    // 参与相关
    userInfo: null,
    joining: false,
    // 昵称弹窗
    showProfileSheet: false,
    pendingProfileAction: ''
  },

  onLoad(options) {
    const openId = wx.getStorageSync('openId')
    this.setData({ openId })
    this.getUserInfo()

    if (options.drawId) {
      this.setData({ drawId: options.drawId })
      this.loadDrawDetail()
    } else {
      this.setData({ error: '缺少抽签ID', loading: false })
    }
  },

  getUserInfo() {
    const userInfo = wx.getStorageSync('userInfo')
    if (userInfo) {
      this.setData({ userInfo })
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

    // 参与人数与上限展示：
    // - 首选 maxParticipants（显式“最大参与人数”配置）
    // - 其次在无 options 时使用 totalCount（如数字签池）
    // - 否则视为不限人数，仅展示当前参与人数
    draw.participantCount = Array.isArray(draw.participants) ? draw.participants.length : 0

    let upperLimit = 0
    if (typeof draw.maxParticipants === 'number' && draw.maxParticipants > 0) {
      upperLimit = draw.maxParticipants
    } else if (typeof draw.totalCount === 'number' && draw.totalCount > 0) {
      const hasOptions = Array.isArray(draw.options) && draw.options.length > 0
      // 当没有选项，或 totalCount 与选项数量不一致时，认为 totalCount 是真实上限
      // 注意：options可能是对象数组，所以直接用length比较即可
      if (!hasOptions || draw.totalCount !== draw.options.length) {
        upperLimit = draw.totalCount
      }
    }
    draw.upperLimit = upperLimit

    if (draw.participants) {
      draw.participants.forEach(p => {
        // 统一参与者昵称字段为 nickName
        p.nickName = p.nickName || ''
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
    
    // 规范化选项格式：兼容旧格式（字符串数组）和新格式（对象数组）
    const normalizedOpts = opts.map(opt => {
      if (typeof opt === 'string') {
        return opt
      } else if (opt && typeof opt === 'object' && opt.text) {
        return opt.text
      }
      return String(opt || '')
    })
    
    // 结果为数字（或数字字符串）时，尝试映射到选项文本（1-based）
    const n = typeof result === 'number' ? result : parseInt(result, 10)
    if (!isNaN(n)) {
      const idx = n - 1
      if (idx >= 0 && idx < normalizedOpts.length) return String(normalizedOpts[idx])
    }
    // 其他情况，直接作为字符串展示
    return String(result)
  },

  onShareAppMessage() {
    const { drawId, drawDetail } = this.data
    const title = drawDetail?.title ? `邀请你参与抽签：${drawDetail.title}` : '快来参与这个好玩的抽签'
    const path = `/pages/result/result?drawId=${drawId}`
    
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
    const upper = (typeof drawDetail.upperLimit === 'number' && drawDetail.upperLimit > 0)
      ? drawDetail.upperLimit
      : 0
    resultText += `参与人数：${drawDetail.participants.length}${upper ? ' / ' + upper : ''}\n`
    resultText += '-------------------\n'

    if (drawDetail.type === 'group') {
      for (const groupName in drawDetail.groupedParticipants) {
        resultText += `【${groupName}】\n`
        const members = drawDetail.groupedParticipants[groupName]
          .map(p => p.nickName || '')
          .join('、')
        resultText += `${members}\n`
      }
    } else {
      drawDetail.participants.forEach(p => {
        const value = p.resultText || p.result
        const name = p.nickName || ''
        resultText += `${name} -> ${value}\n`
      })
    }

    wx.setClipboardData({
      data: resultText,
      success: () => {
        wx.showToast({ title: '结果已复制' })
      }
    })
  },
  // 在结果页直接参与抽签（不再跳转到 draw 页）
  async handleJoinInline() {
    const { userInfo, hasParticipated, joining, drawDetail } = this.data

    if (hasParticipated) {
      wx.showToast({ title: '已参与', icon: 'none' })
      return
    }
    if (joining) return
    if (!drawDetail || drawDetail.status !== DRAW_STATUS.ONGOING) {
      wx.showToast({ title: '此抽签当前不可参与', icon: 'none' })
      return
    }

    // 校验昵称，没有就弹出 profileSheet 录入
    if (!userInfo || !userInfo.nickName) {
      this.openProfileSheet('join-inline')
      return
    }

    await this.doJoinInline()
  },

  // 真正执行参与逻辑（假定已具备合法 userInfo）
  async doJoinInline() {
    const { drawId, userInfo, drawDetail, hasParticipated, joining } = this.data
    if (hasParticipated || joining) return

    if (!drawDetail || drawDetail.status !== DRAW_STATUS.ONGOING) {
      wx.showToast({ title: '此抽签当前不可参与', icon: 'none' })
      return
    }

    this.setData({ joining: true })
    wx.showLoading({ title: '参与中...' })

    try {
      const result = await joinDraw({
        drawId: drawId,
        nickName: userInfo.nickName,
        avatar: userInfo.avatarUrl
      })

      wx.hideLoading()

      if (!result.success) {
        wx.showToast({ title: result.message || '参与失败，请重试', icon: 'none' })
        return
      }

      // 如果云函数返回已参与情况，直接刷新详情并提示
      if (result.data?.hasJoined) {
        wx.showToast({ title: result.message || '已参与', icon: 'success' })
        this.setData({ hasParticipated: true, joining: false })
        this.loadDrawDetail()
        return
      }

      wx.showToast({ title: result.message || '参与成功', icon: 'success' })

      // 更新本地状态：把新参与者追加到 participants，并刷新“我的结果”等
      const updatedDetail = Object.assign({}, drawDetail)
      const openId = wx.getStorageSync('openId')
      const rawResult = result.data?.result ?? null
      const participant = {
        openId,
        nickName: userInfo.nickName,
        avatar: userInfo.avatarUrl,
        result: rawResult,
        resultText: this.resolveResultText(updatedDetail, rawResult),
        drawTime: Date.now()
      }
      updatedDetail.participants = updatedDetail.participants ? [...updatedDetail.participants, participant] : [participant]

      // 根据上限更新状态（满员则置为 FULL）
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

      const myResultText = this.resolveResultText(updatedDetail, rawResult)

      this.setData({
        drawDetail: this.processDrawData(updatedDetail, openId),
        hasParticipated: true,
        myResult: rawResult,
        myResultText,
        joining: false
      })
    } catch (error) {
      wx.hideLoading()
      this.setData({ joining: false })
      wx.showToast({ title: '参与失败，请重试', icon: 'none' })
      console.error('结果页参与抽签失败:', error)
    }
  },

  // 打开昵称编辑弹窗
  openProfileSheet(action) {
    this.setData({
      showProfileSheet: true,
      pendingProfileAction: action || ''
    })
  },

  // 关闭昵称弹窗
  onProfileSheetClose() {
    this.setData({ showProfileSheet: false, pendingProfileAction: '' })
  },

  // 昵称弹窗确认
  onProfileSheetConfirm(e) {
    const { userInfo, openId } = e.detail || {}
    const { pendingProfileAction } = this.data

    this.setData({ showProfileSheet: false, pendingProfileAction: '' })

    if (userInfo) {
      this.setData({ userInfo })
      wx.setStorageSync('userInfo', userInfo)
    }

    if (openId) {
      wx.setStorageSync('openId', openId)
      this.setData({ openId })
    }

    if (pendingProfileAction === 'join-inline') {
      this.doJoinInline()
    }
  },

  goToHome() {
    wx.switchTab({ url: '/pages/index/index' })
  }
})