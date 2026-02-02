const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

// 返回自定义模板列表
exports.main = async (event, context) => {
  try {
    const res = await db.collection('templates').orderBy('createTime', 'desc').get()
    const list = (res && res.data) ? res.data.map(t => ({ templateId: t.templateId, title: t.title, desc: t.desc, options: t.options })) : []
    return { success: true, data: list }
  } catch (err) {
    return { success: false, message: err.message }
  }
}
