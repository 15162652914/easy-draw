const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

// 手动终止抽签：仅创建者可执行，将 status 置为 CLOSED(1)
exports.main = async (event, context) => {
  const { drawId } = event;
  const wxContext = cloud.getWXContext();
  const openId = wxContext.OPENID;

  if (!drawId) {
    return { success: false, message: '缺少抽签ID' };
  }

  try {
    const doc = await db.collection('draws').doc(drawId).get();
    const draw = doc.data;
    if (!draw) {
      return { success: false, message: '抽签不存在' };
    }

    // 权限校验：仅创建者可终止
    if (draw._openid !== openId) {
      return { success: false, message: '无权限终止该抽签' };
    }

    // 已结束则直接返回
    if (draw.status === 1) {
      return { success: true, data: { status: 1 }, message: '抽签已结束' };
    }

    await db.collection('draws').doc(drawId).update({
      data: {
        status: 1, // CLOSED
        updateTime: db.serverDate()
      }
    });

    return { success: true, data: { status: 1 }, message: '已终止抽签' };
  } catch (err) {
    return { success: false, message: err.message };
  }
};
