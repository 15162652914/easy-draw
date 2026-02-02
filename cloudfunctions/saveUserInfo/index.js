const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

/**
 * 保存/更新用户基础信息
 * 说明：
 * - 以 OPENID 作为文档 ID（users 集合的主键）
 * - 仅保存最小必要字段：nickName, avatarUrl, lastSeen
 * - 客户端可以选择在用户登录成功后调用；当前仅提供能力，默认不强制调用
 */
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openId = wxContext.OPENID
  const { userInfo = {} } = event || {}

  if (!openId) {
    return { success: false, message: '缺少 openId' }
  }

  // 仅在提供 userInfo 时才写入，避免空数据覆盖
  if (!userInfo || (!userInfo.nickName && !userInfo.avatarUrl)) {
    return { success: true, message: '无用户信息需要更新', data: { skipped: true } }
  }

  const docId = openId
  const payload = {
    nickName: userInfo.nickName || '',
    avatarUrl: userInfo.avatarUrl || '',
    lastSeen: db.serverDate()
  }

  try {
    // 使用 set 覆盖该用户文档，保证 id = openId
    await db.collection('users').doc(docId).set({
      data: payload
    })

    return {
      success: true,
      message: '用户信息已更新',
      data: { openId, ...payload }
    }
  } catch (e) {
    console.error('保存用户信息失败', e)
    return {
      success: false,
      message: '保存用户信息失败',
      error: e.message
    }
  }
}
