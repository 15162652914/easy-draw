const { getOpenId, getUserProfile } = require('../../utils/userinfo')

Page({
  data: {
    userInfo: null,
    openId: ''
  },

  onLoad() {
    this.getUserProfile()
    this.getOpenid()
  },

  onShow() {
  },

  async getUserProfile() {
    try {
      const userInfo = await getUserProfile()
      this.setData({ userInfo })
    } catch (error) {
      console.error('获取用户信息失败:', error)
    }
  },

  async getOpenid() {
    // 尝试获取openid
    const openId = wx.getStorageSync('openId')
    if (openId) {
      this.setData({ openId })
    } else {
      // 使用云函数获取真实的openid
      try {
        const result = await getOpenId()
        if (result.success) {
          wx.setStorageSync('openId', result.data.openId)
          this.setData({ openId: result.data.openId })
        } else {
          // 如果获取失败，使用模拟openid
          // const mockOpenid = 'test_openid_' + Date.now()
          // wx.setStorageSync('openId', mockOpenid)
          // this.setData({ openId: mockOpenid })
        }
      } catch (error) {
        console.error('获取openid失败:', error)
      }
    }
  },

  login() {
    wx.getUserProfile({
      desc: '用于完善用户信息',
      success: (res) => {
        this.setData({ userInfo: res.userInfo })
        wx.setStorageSync('userInfo', res.userInfo)
        // 登录成功后获取openid
        this.getOpenid()
        wx.showToast({ title: '登录成功', icon: 'success' })
      },
      fail: (error) => {
        console.error('登录失败:', error)
        wx.showToast({ title: '登录失败，请重试', icon: 'none' })
      }
    })
  },

  createNewDraw() {
    wx.navigateTo({
      url: '/pages/create/create'
    })
  },

  viewHistory() {
    wx.switchTab({
      url: '/pages/history/history'
    })
  },

  about() {
    wx.showModal({
      title: '关于我们',
      content: '微信群抽签小程序\n版本 1.0.0\n\n一个简单易用的微信群抽签工具，支持创建、参与抽签和查看历史记录。',
      showCancel: false
    })
  },

  privacyPolicy() {
    wx.showModal({
      title: '隐私协议',
      content: '我们重视您的隐私保护\n\n1. 我们收集的信息：\n   - 用户头像、昵称等基本信息\n   - 抽签相关的操作记录\n\n2. 信息使用方式：\n   - 用于展示用户信息\n   - 用于抽签功能的正常运行\n\n3. 信息保护：\n   - 我们会保护您的个人信息安全\n   - 不会将信息用于其他用途\n\n感谢您的信任与支持！',
      showCancel: false
    })
  },

  userAgreement() {
    wx.showModal({
      title: '用户协议',
      content: '欢迎使用微信群抽签小程序\n\n1. 服务内容：\n   - 提供抽签创建、参与功能\n   - 提供抽签历史记录查询\n\n2. 用户义务：\n   - 遵守法律法规\n   - 不得使用本服务进行违法活动\n   - 不得干扰其他用户的正常使用\n\n3. 免责声明：\n   - 本服务仅作为工具使用\n   - 对于因使用本服务产生的任何争议，我们不承担责任\n\n4. 协议更新：\n   - 我们可能会不时更新本协议\n   - 继续使用本服务即表示您接受更新后的协议\n\n如有任何疑问，请联系我们。',
      showCancel: false
    })
  },

  clearCache() {
    wx.showModal({
      title: '清除缓存',
      content: '确定要清除缓存吗？',
      success: (res) => {
        if (res.confirm) {
          wx.clearStorageSync()
          wx.showToast({ title: '缓存已清除', icon: 'success' })
          // 重新获取用户信息
          setTimeout(() => {
            this.getUserInfo()
            this.getOpenid()
          }, 1000)
        }
      }
    })
  }
})