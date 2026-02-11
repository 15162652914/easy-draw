// 管理模板（默认模板 + 用户自定义模板）
// 存储位置：本地 storage，key: customTemplates, templateCounter

const DEFAULT_TEMPLATES = require('./templates')

const STORAGE_CUSTOM_KEY = 'customTemplates'

// 自定义模板可用的随机图标池
const ICON_POOL = ['✨', '⭐', '🎯', '📌', '🧩', '🎲', '📋', '🎉', '📝', '🔖']

function pickRandomIcon() {
  const idx = Math.floor(Math.random() * ICON_POOL.length)
  return ICON_POOL[idx] || '✨'
}

// 是否启用模板的云端同步（列表 & 新增）。
// 目前按你的需求默认关闭，只使用本地存储；
// 如需恢复云端，同步将此值改为 true 即可。
const ENABLE_TEMPLATE_CLOUD_SYNC = false

// 尝试优先使用云端存储（需要在微信开发者工具中部署云函数）
function isCloudAvailable() {
  return ENABLE_TEMPLATE_CLOUD_SYNC && !!(wx.cloud && wx.cloud.callFunction)
}

function loadCustomTemplatesLocal() {
  try {
    const raw = wx.getStorageSync(STORAGE_CUSTOM_KEY)
    if (raw && Array.isArray(raw)) return raw
  } catch (e) {
    console.warn('读取自定义模板失败', e)
  }
  return []
}

function saveCustomTemplatesLocal(list) {
  try {
    wx.setStorageSync(STORAGE_CUSTOM_KEY, list)
    return true
  } catch (e) {
    console.error('保存自定义模板失败', e)
    return false
  }
}

module.exports = {
  // 返回 Promise，合并默认模板与自定义模板（云端或本地）
  async getAllTemplates() {
    let custom = []
    if (isCloudAvailable()) {
      try {
        const resp = await wx.cloud.callFunction({ name: 'listTemplates' })
        if (resp && resp.result && resp.result.success) {
          custom = resp.result.data.map(t => ({
            templateId: t.templateId,
            title: t.title,
            desc: t.desc,
            options: t.options,
            preferredType: t.preferredType,
            maxParticipants: t.maxParticipants,
            winnerQuota: t.winnerQuota,
            icon: t.icon || pickRandomIcon()
          }))
        } else {
          custom = loadCustomTemplatesLocal()
        }
      } catch (e) {
        console.warn('调用 listTemplates 失败，回退到本地', e)
        custom = loadCustomTemplatesLocal()
      }
    } else {
      custom = loadCustomTemplatesLocal()
    }

    // 归一化本地自定义模板结构（如果本地早期使用 id 字符串，转换为 templateId 数字）
    custom = custom.map(t => ({
      templateId: t.templateId || (t.id ? Number(t.id) : Date.now()),
      title: t.title,
      desc: t.desc,
      options: t.options,
      preferredType: t.preferredType,
      maxParticipants: t.maxParticipants,
      winnerQuota: t.winnerQuota,
      icon: t.icon || pickRandomIcon()
    }))

    return [...DEFAULT_TEMPLATES, ...custom]
  },

  // 添加自定义模板，优先写入云端（返回 Promise -> new template）
  async addCustomTemplate({ title, desc = '', options = [], preferredType = 'sequence', maxParticipants, winnerQuota }) {
    if (!title || !Array.isArray(options) || options.length < 1) return null

    // 规范化可选数值字段
    const payload = {
      title,
      desc,
      options,
      preferredType,
      maxParticipants: typeof maxParticipants === 'number' ? maxParticipants : undefined,
      winnerQuota: typeof winnerQuota === 'number' ? winnerQuota : undefined,
      icon: pickRandomIcon()
    }

    if (isCloudAvailable()) {
      try {
        const resp = await wx.cloud.callFunction({ name: 'createTemplate', data: payload })
        if (resp && resp.result && resp.result.success) {
          const templateId = resp.result.data.templateId
          const newT = { templateId: templateId, ...payload }
          return newT
        }
      } catch (e) {
        console.warn('云端保存模板失败，回退到本地保存', e)
      }
    }

    // 本地保存（id 使用本地时间戳）
    const templateId = Date.now()
    const newT = { templateId, ...payload }
    const list = loadCustomTemplatesLocal()
    list.push(newT)
    saveCustomTemplatesLocal(list)
    return newT
  },

  // 本地删除（云端删除需实现对应云函数）
  removeCustomTemplateLocal(templateId) {
    const list = loadCustomTemplatesLocal()
    const idx = list.findIndex(t => String(t.templateId || t.id) === String(templateId))
    if (idx === -1) return false
    list.splice(idx, 1)
    return saveCustomTemplatesLocal(list)
  }
}
