const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

// createTemplate: { title, desc, options }
exports.main = async (event, context) => {
  const { title, desc = '', options = [] } = event
  if (!title || !Array.isArray(options) || options.length === 0) {
    return { success: false, message: '参数不完整' }
  }

  try {
    const counterRef = db.collection('counters').doc('templateCounter')
    // 确保计数器存在
    try {
      await counterRef.get()
    } catch (e) {
      // 初始化为1000
      await db.collection('counters').doc('templateCounter').set({ counter: 1000 })
    }

    // 原子增加
    await counterRef.update({ data: { counter: _.inc(1) } })
    const counterDoc = await counterRef.get()
    const templateId = counterDoc.data.counter

    const res = await db.collection('templates').add({
      data: {
        templateId,
        title,
        desc,
        options,
        isCustom: true,
        owner: cloud.getWXContext().OPENID,
        createTime: db.serverDate()
      }
    })

    return { success: true, data: { templateId, _id: res._id } }
  } catch (err) {
    return { success: false, message: err.message }
  }
}
