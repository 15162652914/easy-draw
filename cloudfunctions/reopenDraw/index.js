const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

// 重新开启抽签：仅创建者可执行，将 status 从 CLOSED(1) 或 FULL(2) 置为 ONGOING(0)
// 可选传入新的 expireTime（时间戳，毫秒）；不传则保留原值
exports.main = async (event, context) => {
  const { drawId, expireTime } = event;
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

    // 仅创建者可重新开启
    if (draw._openid !== openId) {
      return { success: false, message: '无权限重新开启该抽签' };
    }

    // 仅 CLOSED(1) 或 FULL(2) 可重新开启
    if (draw.status !== 1 && draw.status !== 2) {
      return { success: false, message: '仅已结束或已满员的抽签可以重新开启' };
    }

    const updateData = {
      status: 0, // ONGOING
      updateTime: db.serverDate()
    };

    if (typeof expireTime === 'number' && expireTime > 0) {
      updateData.expireTime = expireTime;
    }

    await db.collection('draws').doc(drawId).update({ data: updateData });

    return {
      success: true,
      data: { status: 0 },
      message: '已重新开启抽签'
    };
  } catch (err) {
    return { success: false, message: err.message };
  }
};
