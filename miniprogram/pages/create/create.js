const { createDraw } = require('../../utils/db')
const templateManager = require('../../utils/templateManager')
const { DRAW_TYPE, DRAW_TYPE_TEXT } = require('../../utils/constants')

Page({
  data: {
    title: '',
    options: [],
    expireDate: '',
    today: '',
    userInfo: null,
    maxParticipants: '',
    // 抽签方式，使用数值枚举
    type: DRAW_TYPE.SEQUENCE,
    drawTypeTextMap: DRAW_TYPE_TEXT
  },

  onLoad(options) {
    this.initData(options)
    this.getUserInfo()
  },

  async saveTemplate() {
    const { title, options } = this.data
    if (!title) {
      wx.showToast({ title: '请输入模板标题', icon: 'none' })
      return
    }
    if (!options || options.length < 1) {
      wx.showToast({ title: '请添加至少1个选项', icon: 'none' })
      return
    }

    try {
      const newT = await templateManager.addCustomTemplate({ title, desc: '', options })
      if (newT) {
        wx.showToast({ title: '已保存为自定义模板', icon: 'success' })
      } else {
        wx.showToast({ title: '保存模板失败', icon: 'none' })
      }
    } catch (e) {
      console.error('保存模板失败', e)
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
          this.setData({ title: found.title, options: found.options })
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

  onTypeChange(e) {
    // radio 的 value 传回为字符串，转换为数字枚举
    const val = e.detail.value
    const n = parseInt(val, 10)
    if (!isNaN(n)) this.setData({ type: n })
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
    const { title, options, expireDate, userInfo, maxParticipants } = this.data
    
    // 验证表单
    if (!title) {
      wx.showToast({ title: '请输入抽签标题', icon: 'none' })
      return
    }
    
    if (options.length < 2) {
      wx.showToast({ title: '至少需要2个选项', icon: 'none' })
      return
    }
    
    if (!userInfo) {
      wx.showToast({ title: '请先授权获取用户信息', icon: 'none' })
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
          openId: wx.getStorageSync('openId'),
          nickName: userInfo.nickName,
          avatarUrl: userInfo.avatarUrl
        },
        expireTime: expireDate ? new Date(expireDate).getTime() : null,
        // 传递最大参与人数（可选）
        maxParticipants: maxParticipants ? parseInt(maxParticipants, 10) : undefined
      })
      
      wx.hideLoading()
      
      if (result.success) {
        wx.showToast({ title: '创建成功', icon: 'success' })
        
        // 跳转到结果页面，传递抽签ID
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
  }
})