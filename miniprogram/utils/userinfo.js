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

// 查询一份可用的用户昵称+头像（只读，不再主动拉起授权）
// 优先顺序：本地缓存 -> 云端 users 表已有记录 -> 都没有时返回 needManual: true
export const queryUserInfo = async () => {
  // 1. 本地缓存（快速返回）
  const cached = wx.getStorageSync('userInfoSnapshot') || wx.getStorageSync('userInfo')
  const cachedOpenId = wx.getStorageSync('openId')
  if (cached && cached.nickName) {
    return { openId: cachedOpenId || '', nickName: cached.nickName, avatarUrl: cached.avatarUrl }
  }

  // 2. 尝试从云端 users 表读取（不弹授权）
  try {
    const res = await wx.cloud.callFunction({ name: 'getOrSaveUserInfo', data: {} })
    const result = res && res.result
    if (result && result.success && result.data && !result.data.skipped) {
      const { openId, nickName, avatarUrl } = result.data
      const snapshot = { nickName, avatarUrl }
      wx.setStorageSync('userInfoSnapshot', snapshot)
      if (openId) wx.setStorageSync('openId', openId)
      return { openId: openId || '', ...snapshot }
    }
  } catch (e) {
    console.warn('从云端读取用户信息失败:', e)
  }

  // 3. 本地和云端都没有，交给前端弹窗手动输入
  return {
    openId: wx.getStorageSync('openId') || '',
    nickName: '',
    avatarUrl: '',
    needManual: true
  }
}

// 供外部调用的更新接口，直接传 userInfo 对象，云函数会自动处理更新逻辑
export const updateUserInfo = async (userInfo) => {
  try {
    const res = await wx.cloud.callFunction({ name: 'getOrSaveUserInfo', data: { userInfo } })
    const result = res && res.result

    if (result && result.success && result.data) {
      const { openId, nickName, avatarUrl } = result.data
      const snapshot = { nickName, avatarUrl }

      // 同步更新本地缓存
      wx.setStorageSync('userInfoSnapshot', snapshot)
      wx.setStorageSync('userInfo', snapshot)
      if (openId) wx.setStorageSync('openId', openId)

      return {
        success: true,
        data: { openId: openId || '', ...snapshot }
      }
    }

    return {
      success: false,
      message: (result && result.message) || '更新用户信息失败'
    }
  } catch (e) {
    console.error('更新用户信息失败:', e)
    return {
      success: false,
      message: '网络错误，请重试',
      error: e
    }
  }
}