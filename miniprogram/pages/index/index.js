Page({
  data: {
    userInfo: null,
    templates: []
  },

  onLoad() {
    this.getUserInfo()
    const templateManager = require('../../utils/templateManager')
    // getAllTemplates 返回 Promise
    templateManager.getAllTemplates().then(templates => {
      this.setData({ templates })
    }).catch(err => {
      console.error('加载模板失败', err)
      this.setData({ templates: [] })
    })
  },

  getUserInfo() {
    wx.getUserProfile({
      desc: '用于完善用户信息',
      success: (res) => {
        this.setData({
          userInfo: res.userInfo
        })
        wx.setStorageSync('userInfo', res.userInfo)
      }
    })
  },

  selectTemplate(e) {
    const templateId = e.currentTarget.dataset.templateId
    wx.navigateTo({ url: `/pages/create/create?templateId=${templateId}` })
  },

  // 从首页进入空白模板，用户自行输入标题和选项
  createCustomDraw() {
    wx.navigateTo({ url: '/pages/create/create' })
  }
})