const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const { drawId } = event;
  const wxContext = cloud.getWXContext();
  const openId = wxContext.OPENID;
  
  try {
    // 1. 检查是否已参与
    const draw = await db.collection('draws').doc(drawId).get();
    if (!draw.data) {
      return { success: false, message: '抽签不存在' };
    }
    
    const participants = draw.data.participants || [];
    const hasJoined = participants.find(p => p.openId === openId);
    
    if (hasJoined) {
      return { 
        success: true, 
        data: {
          hasJoined: true,
          result: hasJoined.result,
        },
        message: '已参与过' 
      };
    }
    
    // 2. 检查是否已满 -> 使用数字状态判断
    // draw.data.status: 0=ongoing,1=closed,2=full
    if (draw.data.status === 1) {
      return { success: false, data: {}, message: '抽签已结束' };
    }
    // 参与人数上限优先：maxParticipants > totalCount > options.length
    const upperLimit = (typeof draw.data.maxParticipants === 'number' && draw.data.maxParticipants > 0)
      ? draw.data.maxParticipants
      : (typeof draw.data.totalCount === 'number' && draw.data.totalCount > 0)
        ? draw.data.totalCount
        : Array.isArray(draw.data.options)
          ? draw.data.options.length
          : 0;
    if (upperLimit > 0 && participants.length >= upperLimit) {
      // 可选：将状态更新为已满
      await db.collection('draws').doc(drawId).update({ data: { status: 2, updateTime: db.serverDate() } });
      return { success: false, data: {}, message: '名额已满' };
    }
    
    // 3. 分配结果（从预生成的池中取）
    let result;
    const lotsPool = draw.data.lotsPool || [];
    const availableIndex = lotsPool.findIndex(item => item !== null);
    
    if (availableIndex !== -1) {
      result = lotsPool[availableIndex];
      // 标记为已使用
      await db.collection('draws').doc(drawId).update({
        data: {
          [`lotsPool.${availableIndex}`]: null
        }
      });
    } else {
      // 备用：随机生成（理论上不会走到这里）
      result = participants.length + 1;
    }
    
    // 4. 获取用户信息（实际应从客户端传，这里简化）
    const userResult = await db.collection('users').where({ _openid: openId }).get();
    const userInfo = userResult.data[0] || {};
    
    // 5. 更新参与者列表
    const newParticipant = {
      openId: openId,
      nickname: event.nickname || userInfo.nickname || '匿名用户',
      avatar: event.avatar || userInfo.avatar || '',
      result: result,
      drawTime: db.serverDate()
    };
    
    await db.collection('draws').doc(drawId).update({
      data: {
        participants: _.push([newParticipant]),
        updateTime: db.serverDate()
      }
    });
    
    return {
      success: true,
      data: {
        hasJoined: false,
        result: result,
      },
      message: '抽签成功'
    };
    
  } catch (err) {
    return {
      success: false,
      data: {},
      message: err.message
    };
  }
};