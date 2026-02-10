// 数据库操作封装
const db = wx.cloud.database()
const drawsCollection = db.collection('draws')

// 创建抽签
export const createDraw = async (data) => {
  try {
    const result = await wx.cloud.callFunction({
      name: 'createDraw',
      data: data
    })
    return result.result
  } catch (error) {
    console.error('创建抽签失败:', error)
    return {
      success: false,
      message: '网络错误，请重试'
    }
  }
}

// 参与抽签
export const joinDraw = async (data) => {
  try {
    const result = await wx.cloud.callFunction({
      name: 'joinDraw',
      data: data
    })
    return result.result
  } catch (error) {
    console.error('参与抽签失败:', error)
    return {
      success: false,
      message: '网络错误，请重试'
    }
  }
}

// 获取抽签详情
export const getDrawDetail = async (drawId) => {
  try {
    const result = await drawsCollection.doc(drawId).get()
    return {
      success: true,
      data: result.data
    }
  } catch (error) {
    console.error('获取抽签详情失败:', error)
    return {
      success: false,
      message: '网络错误，请重试'
    }
  }
}

// 获取用户参与的抽签历史
export const getUserDraws = async (openId, page = 0, pageSize = 10) => {
  try {
    const result = await drawsCollection.where({
      'participants.openId': openId
    })
    .orderBy('createTime', 'desc')
    .skip(page * pageSize)
    .limit(pageSize)
    .get()
    return {
      success: true,
      data: result.data
    }
  } catch (error) {
    console.error('获取抽签历史失败:', error)
    return {
      success: false,
      message: '网络错误，请重试'
    }
  }
}

// 获取用户创建的抽签历史
export const getCreatorDraws = async (openId, page = 0, pageSize = 10) => {
  try {
    const result = await drawsCollection.where({
      _openid: openId
    })
    .orderBy('createTime', 'desc')
    .skip(page * pageSize)
    .limit(pageSize)
    .get()
    return {
      success: true,
      data: result.data
    }
  } catch (error) {
    console.error('获取创建的抽签历史失败:', error)
    return {
      success: false,
      message: '网络错误，请重试'
    }
  }
}

// 获取用户openId
export const getOpenId = async () => {
  try {
    const result = await wx.cloud.callFunction({
      name: 'getOpenId',
      data: {}
    })
    return result.result
  } catch (error) {
    console.error('获取openId失败:', error)
    return {
      success: false,
      message: '网络错误，请重试'
    }
  }
}

// 手动终止抽签（仅创建者）
export const closeDraw = async (data) => {
  try {
    const result = await wx.cloud.callFunction({
      name: 'closeDraw',
      data: data
    })
    return result.result
  } catch (error) {
    console.error('终止抽签失败:', error)
    return {
      success: false,
      message: '网络错误，请重试'
    }
  }
}

// （可选）保存用户基础信息：头像、昵称等
// 说明：
// - 仅提供能力，当前默认不在登录流程中自动调用
// - 调用方可在获取用户授权后按需调用
export const getOrSaveUserInfo = async (userInfo) => {
  try {
    const result = await wx.cloud.callFunction({
      name: 'getOrSaveUserInfo',
      data: { userInfo }
    })
    return result.result
  } catch (error) {
    console.error('保存用户信息失败:', error)
    return {
      success: false,
      message: '网络错误，请重试'
    }
  }
}