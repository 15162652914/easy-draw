const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

// 本地内置头像列表（与 miniprogram/images/avatars 下的文件保持一致）
const AVATAR_LIST = [
  '/images/avatars/boy-01.png',
  '/images/avatars/boy-02.png',
  '/images/avatars/girl-01.png',
  '/images/avatars/girl-02.png'
]

function pickRandomAvatar() {
  if (!AVATAR_LIST.length) return ''
  const idx = Math.floor(Math.random() * AVATAR_LIST.length)
  return AVATAR_LIST[idx]
}

/**
 * 保存/更新用户基础信息
 * 说明：
 * - 以 OPENID 作为文档 ID（users 集合的主键）
 * - 仅保存最小必要字段：nickName, avatarUrl, lastSeen
 * - 客户端可以选择在用户登录成功后调用；当前仅提供能力，默认不强制调用
 */
exports.main = async (event, context) => {
  try {
    const wxContext = cloud.getWXContext()
    const openId = wxContext.OPENID
    const { userInfo = {} } = event || {}

    if (!openId) {
      return { success: false, message: '缺少 openId' }
    }

    const users = db.collection('users')
    const docId = openId

    // 1. 先查：看看是否已经有用户信息
    let existing = null
    try {
      const doc = await users.doc(docId).get()
      existing = doc && doc.data ? doc.data : null
    } catch (e) {
      // 文档不存在会抛错，忽略即可，视为首次保存
      existing = null
    }

    // 如果没有传 userInfo，并且已有记录，直接返回已有信息
    if ((!userInfo || (!userInfo.nickName && !userInfo.avatarUrl)) && existing) {
      return {
        success: true,
        message: '已存在用户信息，直接返回',
        data: { openId, ...existing, fromCache: true }
      }
    }

    // 2. 需要写入/更新的场景：
    // - 首次没有记录
    // - 或者前端传来了新的 userInfo
    if (!userInfo || (!userInfo.nickName && !userInfo.avatarUrl)) {
      // 既没有本地记录、也没有新信息可写
      return { success: true, message: '无用户信息需要更新', data: { skipped: true } }
    }

    const payloadNickName = userInfo.nickName || (existing && (existing.nickName || existing.nickname)) || ''

    // 优先使用传入的头像或历史头像；都没有时为用户随机分配一个内置头像
    let payloadAvatarUrl = userInfo.avatarUrl || (existing && (existing.avatarUrl || existing.avatar)) || ''
    if (!payloadAvatarUrl) {
      payloadAvatarUrl = pickRandomAvatar()
    }

    const payload = {
      nickName: payloadNickName,
      avatarUrl: payloadAvatarUrl,
      lastSeen: db.serverDate()
    }

    await users.doc(docId).set({ data: payload })

    return {
      success: true,
      message: existing ? '用户信息已更新' : '用户信息已创建',
      data: { openId, ...payload, fromCache: false }
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
