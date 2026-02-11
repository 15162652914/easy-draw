const { createDraw } = require('../../utils/db')
const templateManager = require('../../utils/templateManager')
const { DRAW_TYPE, DRAW_TYPE_TEXT } = require('../../utils/constants')

Page({
  data: {
    title: '',
    // 模板描述，仅用于展示在首页模板列表，可选
    templateDesc: '',
    options: [],
    expireDate: '',
    today: '',
    userInfo: null,
    maxParticipants: '',
    winnerQuota: '',
    showTypeSheet: false,
    // 抽签方式，使用数值枚举
    type: DRAW_TYPE.SEQUENCE,
    drawTypeTextMap: DRAW_TYPE_TEXT,
    // 用于渲染的抽签方式数组（用于 wx:for）
    typeOptions: [
      // { value: DRAW_TYPE.NORMAL, label: '普通抽签' },
      { value: DRAW_TYPE.SEQUENCE, label: '顺序抽签' },
      { value: DRAW_TYPE.RANDOM, label: '随机抽选' },
      { value: DRAW_TYPE.GROUP, label: '分组抽签' }
    ],
    // 昵称弹窗
    showProfileSheet: false,
    pendingProfileAction: ''
  },


  onLoad(options) {
    this.initData(options)
    this.getUserInfo()
  },

  async saveTemplate() {
    const { title, options, type, maxParticipants, winnerQuota, templateDesc } = this.data
    if (!title) {
      wx.showToast({ title: '请输入模板标题', icon: 'none' })
      return
    }
    if (!options || options.length < 1) {
      wx.showToast({ title: '请添加至少1个选项', icon: 'none' })
      return
    }
    
    // 直接使用当前选择的抽签方式
    const typeMapRev = {
      [DRAW_TYPE.NORMAL]: 'normal',
      [DRAW_TYPE.SEQUENCE]: 'sequence',
      [DRAW_TYPE.RANDOM]: 'random',
      [DRAW_TYPE.GROUP]: 'group'
    }
    const preferredType = typeMapRev[type] || 'sequence'

    // 规范化参与人数和赢家名额（可选）
    let maxPartNum
    if (maxParticipants) {
      const n = parseInt(maxParticipants, 10)
      if (!isNaN(n) && n > 0) maxPartNum = n
    }

    let winnerNum
    if (winnerQuota) {
      const n = parseInt(winnerQuota, 10)
      if (!isNaN(n) && n > 0) winnerNum = n
    }
    
    try {
      const newT = await templateManager.addCustomTemplate({
        title,
        desc: templateDesc || '',
        options,
        preferredType,
        maxParticipants: maxPartNum,
        winnerQuota: winnerNum
      })
      if (newT) {
        wx.showToast({ title: '已保存为自定义模板', icon: 'success' })
      } else {
        wx.showToast({ title: '保存模板失败', icon: 'none' })
      }
    } catch (err) {
      console.error('保存模板失败', err)
      wx.showToast({ title: '保存模板失败', icon: 'none' })
    }
  },

  initData(options) {
    if (options.templateId) {
      // 根据 templateId 查找模板（尝试云端/本地合并列表）
      const tid = decodeURIComponent(options.templateId)
      templateManager.getAllTemplates().then(list => {
        const found = list.find(t => String(t.templateId) === String(tid))
        if (found) {
          // 根据模板建议的抽签方式设置 type
          let nextType = this.data.type
          if (found.preferredType) {
            const map = {
              normal: DRAW_TYPE.NORMAL,
              sequence: DRAW_TYPE.SEQUENCE,
              random: DRAW_TYPE.RANDOM,
              group: DRAW_TYPE.GROUP
            }
            const key = String(found.preferredType).toLowerCase()
            nextType = map[key] ?? nextType
          }
          this.setData({
            title: found.title,
            options: found.options,
            type: nextType,
            templateDesc: found.desc || '',
            // 模板里如有保存最大参与人数/赢家名额，则带入表单，便于二次使用
            maxParticipants: found.maxParticipants ? String(found.maxParticipants) : '',
            winnerQuota: found.winnerQuota ? String(found.winnerQuota) : ''
          })
        }
      }).catch(err => {
        console.error('查找模板失败', err)
      })
    }
  },

  getUserInfo() {
    const userInfo = wx.getStorageSync('userInfo')
    if (userInfo) {
      this.setData({ userInfo })
    }
  },

  onTemplateDescChange(e) {
    this.setData({ templateDesc: e.detail.value })
  },

  onTitleChange(e) {
    this.setData({ title: e.detail.value })
  },

  onMaxParticipantsChange(e) {
    // 仅允许正整数，空值表示不限制
    const raw = String(e.detail.value || '').trim()
    if (!raw) {
      this.setData({ maxParticipants: '' })
      return
    }
    const val = parseInt(raw, 10)
    if (isNaN(val) || val <= 0) {
      wx.showToast({ title: '请输入大于0的数字', icon: 'none' })
      return
    }
    // 简单上限保护，避免异常过大值
    const capped = Math.min(val, 100000)
    this.setData({ maxParticipants: String(capped) })
  },

  onWinnerQuotaChange(e) {
    // 仅允许正整数，空值表示不设置赢家名额
    const raw = String(e.detail.value || '').trim()
    if (!raw) {
      this.setData({ winnerQuota: '' })
      return
    }
    const val = parseInt(raw, 10)
    if (isNaN(val) || val <= 0) {
      wx.showToast({ title: '请输入大于0的数字', icon: 'none' })
      return
    }
    const capped = Math.min(val, 100000)
    this.setData({ winnerQuota: String(capped) })
  },

  onTypeChange(e) {
    // radio 的 value 传回为字符串，转换为数字枚举
    const val = e.detail.value
    const n = parseInt(val, 10)
    if (!isNaN(n)) this.setData({ type: n })
  },

  onTypeSelect(e) {
    const v = e.currentTarget.dataset.value
    const n = typeof v === 'string' ? parseInt(v, 10) : v
    if (!isNaN(n)) this.setData({ type: n })
  },

  showTypeHelp() {
    this.setData({ showTypeSheet: true })
  },
  closeTypeSheet() {
    this.setData({ showTypeSheet: false })
  },

  onOptionChange(e) {
    const { index } = e.currentTarget.dataset
    const value = e.detail.value
    const options = [...this.data.options]
    options[index] = value
    this.setData({ options })
  },

  addOption() {
    const options = [...this.data.options, '']
    this.setData({ options })
  },

  deleteOption(e) {
    const { index } = e.currentTarget.dataset
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这个选项吗？',
      success: (res) => {
        if (res.confirm) {
          const options = [...this.data.options]
          options.splice(index, 1)
          this.setData({ options })
        }
      }
    })
  },

  onExpireDateChange(e) {
    this.setData({ expireDate: e.detail.value })
  },

  async createDraw() {
    const { userInfo } = this.data

    // 先校验是否有昵称，没有则弹出 profileSheet 让用户输入
    if (!userInfo || !userInfo.nickName) {
      this.openProfileSheet('create')
      return
    }

    await this.doCreateDraw()
  },

  // 真正执行创建逻辑（假定已具备合法 userInfo）
  async doCreateDraw() {
    const { title, options, expireDate, userInfo, maxParticipants, winnerQuota } = this.data
    
    // 验证表单
    if (!title) {
      wx.showToast({ title: '请输入抽签标题', icon: 'none' })
      return
    }
    
    if (options.length < 2) {
      wx.showToast({ title: '至少需要2个选项', icon: 'none' })
      return
    }
    
    // 过滤空选项
    const validOptions = options.filter(option => option.trim())
    if (validOptions.length < 2) {
      wx.showToast({ title: '至少需要2个非空选项', icon: 'none' })
      return
    }
    
    wx.showLoading({ title: '创建中...' })
    
    try {
      const result = await createDraw({
        title,
        type: this.data.type,
        options: validOptions,
        creatorInfo: {
          // openId: wx.getStorageSync('openId'),
          nickName: userInfo.nickName,
          avatarUrl: userInfo.avatarUrl
        },
        expireTime: expireDate ? new Date(expireDate).getTime() : null,
        // 传递最大参与人数（可选）
        maxParticipants: maxParticipants ? parseInt(maxParticipants, 10) : undefined,
        // 赢家名额（仅在 RANDOM 类型有意义）
        winnerQuota: winnerQuota ? parseInt(winnerQuota, 10) : undefined
      })
      
      wx.hideLoading()
      
      if (result.success) {
        wx.showToast({ title: '创建成功', icon: 'success' })

        // 创建成功后先进入参与页，由参与页抽签完再进入结果页
        setTimeout(() => {
          wx.navigateTo({
            url: `/pages/result/result?drawId=${result.data.drawId}`
          })
        }, 1500)
      } else {
        wx.showToast({ title: result.message, icon: 'none' })
      }
    } catch (error) {
      wx.hideLoading()
      wx.showToast({ title: '创建失败，请重试', icon: 'none' })
      console.error('创建抽签失败:', error)
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
    }

    if (pendingProfileAction === 'create') {
      this.doCreateDraw()
    }
  }
})