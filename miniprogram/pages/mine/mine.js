const { queryUserInfo } = require('../../utils/userinfo')

Page({
  data: {
    userInfo: null,
    openId: '',
    showProfileSheet: false,
    showAboutSheet: false,
    showPrivacySheet: false
  },
  onLoad() {
    this.checkUserInfo()
  },
  onShow() {},
  // 查询云端user表是否有头像昵称，有则展示，否则提示登录（通过 openId 查询）
  async checkUserInfo() {
    try {
      const info = await queryUserInfo()

      // 如果有完整信息，直接展示
      if (info && info.nickName) {
        const userInfo = {
          nickName: info.nickName,
          avatarUrl: info.avatarUrl
        }
        this.setData({ userInfo })
        wx.setStorageSync('userInfo', userInfo)
        if (info.openId) {
          this.setData({ openId: info.openId })
          wx.setStorageSync('openId', info.openId)
        }
        return
      }

      // 如果需要手动补充昵称，则弹出弹窗
      if (info && info.needManual) {
        this.setData({
          showProfileSheet: true
        })
        return
      }

      // 其他情况（例如完全没有信息），提示登录
      wx.showModal({
        title: '请登录',
        content: '请先登录以完善头像和昵称',
        showCancel: false
      })
    } catch (e) {
      console.error('检查用户信息异常:', e)
    }
  },
  // 登录流程
  login() {
    this.setData({
      showProfileSheet: true
    })
  },
  // profileSheet 组件事件：保存
  onProfileConfirm(e) {
    const { userInfo, openId } = e.detail || {}
    this.setData({ showProfileSheet: false })

    if (userInfo) {
      this.setData({ userInfo })
      wx.setStorageSync('userInfo', userInfo)
    }

    if (openId) {
      this.setData({ openId })
      wx.setStorageSync('openId', openId)
    }
  },

  // profileSheet 组件事件：关闭
  onProfileClose() {
    this.setData({ showProfileSheet: false })
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

  onAboutSheetShow() {
    this.setData({
      showAboutSheet: true
    })
  },

  onPrivacySheetShow() {
    this.setData({
      showPrivacySheet: true
    })
  },

  onAboutSheetClose() {
    this.setData({ showAboutSheet: false })
  },

  onPrivacySheetClose() {
    this.setData({ showPrivacySheet: false })
  },

  clearCache() {
    wx.showModal({
      title: '清除缓存',
      content: '确定要清除缓存吗？',
      success: res => {
        if (res.confirm) {
          wx.clearStorageSync()
          wx.showToast({ title: '缓存已清除', icon: 'success' })
          // 重新获取用户信息
          setTimeout(() => {
            this.checkUserInfo()
          }, 1000)
        }
      }
    })
  }
})
