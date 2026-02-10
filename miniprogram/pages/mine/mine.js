const { queryUserInfo, updateUserInfo } = require('../../utils/userinfo')

Page({
  data: {
    userInfo: null,
    openId: '',
    showProfileSheet: false,
    pendingAvatarUrl: ''
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
      if (info && info.nickName && info.avatarUrl) {
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
          showProfileSheet: true,
          pendingAvatarUrl: info.avatarUrl || ''
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
      showProfileSheet: true,
      pendingAvatarUrl: this.data.userInfo ? this.data.userInfo.avatarUrl : ''
    })
  },
  // 保存用户信息到云端
  async saveUserInfoToCloud(nickName, userInfo = {}) {
    try {
      const payload = {
        nickName,
        avatarUrl: userInfo.avatarUrl || ''
      }

      const res = await updateUserInfo(payload)

      if (res && res.success && res.data) {
        const { openId, nickName: finalNickName, avatarUrl: finalAvatarUrl } = res.data
        const mergedUserInfo = {
          nickName: finalNickName || payload.nickName,
          avatarUrl: finalAvatarUrl || payload.avatarUrl
        }

        this.setData({ userInfo: mergedUserInfo })
        if (openId) {
          this.setData({ openId })
        }

        wx.showToast({ title: '登录成功', icon: 'success' })
      } else {
        wx.showToast({ title: '保存失败', icon: 'none' })
        console.error('保存用户信息失败:', res)
      }
    } catch (e) {
      wx.showToast({ title: '登录失败', icon: 'none' })
      console.error('登录流程异常:', e)
    }
  },

  // profileSheet 组件事件：保存
  onProfileConfirm(e) {
    const { nickName, avatarUrl } = e.detail || {}
    this.setData({ showProfileSheet: false, pendingAvatarUrl: '' })
    this.saveUserInfoToCloud(nickName, { avatarUrl })
  },

  // profileSheet 组件事件：关闭
  onProfileClose() {
    this.setData({ showProfileSheet: false, pendingAvatarUrl: '' })
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
      content:
        '我们重视您的隐私保护\n\n1. 我们收集的信息：\n   - 用户头像、昵称等基本信息\n   - 抽签相关的操作记录\n\n2. 信息使用方式：\n   - 用于展示用户信息\n   - 用于抽签功能的正常运行\n\n3. 信息保护：\n   - 我们会保护您的个人信息安全\n   - 不会将信息用于其他用途\n\n感谢您的信任与支持！',
      showCancel: false
    })
  },

  userAgreement() {
    wx.showModal({
      title: '用户协议',
      content:
        '欢迎使用微信群抽签小程序\n\n1. 服务内容：\n   - 提供抽签创建、参与功能\n   - 提供抽签历史记录查询\n\n2. 用户义务：\n   - 遵守法律法规\n   - 不得使用本服务进行违法活动\n   - 不得干扰其他用户的正常使用\n\n3. 免责声明：\n   - 本服务仅作为工具使用\n   - 对于因使用本服务产生的任何争议，我们不承担责任\n\n4. 协议更新：\n   - 我们可能会不时更新本协议\n   - 继续使用本服务即表示您接受更新后的协议\n\n如有任何疑问，请联系我们。',
      showCancel: false
    })
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
