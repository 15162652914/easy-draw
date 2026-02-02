export const getOpenId = async () => {
  return new Promise((resolve, reject) => {
    // 检查是否已缓存openid
    const cachedOpenId = wx.getStorageSync('openId')
    if (cachedOpenId) {
      resolve(cachedOpenId)
    }
    wx.cloud.callFunction({
      name: 'getOpenId',
      data: {},
      success: (res) => {
        console.log('获取openid成功:', res)
        resolve(res.result)
      },
      fail: (err) => {
        console.error('获取openid失败:', err)
        reject({
          success: false,
          message: '获取openid失败'
        })
      }
    })
  })
}

export const getUserProfile = async () => {
  return new Promise((resolve, reject) => {
    const userInfo = wx.getStorageSync('userInfo')
    if (userInfo) {
      resolve(userInfo)
    } else {
      wx.getUserProfile({
        desc: '用于完善用户信息',
        success: (res) => {
          this.setData({ userInfo: res.userInfo })
          wx.setStorageSync('userInfo', res.userInfo)
          resolve(res.userInfo)
        },
        fail: (err) => {
          console.error('获取用户信息失败:', err)
          reject({
            success: false,
            message: '获取用户信息失败'
          })
        }
      })
    }
  })
}