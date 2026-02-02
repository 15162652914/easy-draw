const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

exports.main = async (event, context) => {
  try {
    // 通过云函数上下文获取用户的openId
    const wxContext = cloud.getWXContext()
    
    return {
      success: true,
      data: {
        openId: wxContext.OPENID,
        appId: wxContext.APPID,
        unionId: wxContext.UNIONID
      },
      message: '获取openId成功'
    }
  } catch (error) {
    console.error('获取openId失败:', error)
    return {
      success: false,
      message: '获取openId失败，请重试'
    }
  }
}