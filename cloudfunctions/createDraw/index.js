const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const { title, type, options, totalCount, groupId, maxParticipants } = event;
  const wxContext = cloud.getWXContext();
  const openId = wxContext.OPENID;
  
  try {
    // 生成签池（如果是顺序抽签，预生成1-N的数组并打乱）
    let lotsPool = [];
    if (type === 'sequence') {
      lotsPool = Array.from({length: totalCount}, (_, i) => i + 1);
      // Fisher-Yates 洗牌算法
      for (let i = lotsPool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [lotsPool[i], lotsPool[j]] = [lotsPool[j], lotsPool[i]];
      }
    }
    
    const result = await db.collection('draws').add({
      data: {
        _openid: openId,
        title: title || '未命名抽签',
        type: type || 'sequence', // sequence, random, group
        options: options || [],
        totalCount: totalCount || 10,
        lotsPool: lotsPool, // 预生成的签池，已被抽的设为null
        // 新增：最大参与人数（可选）。未设置则按 totalCount 或 options 长度限制。
        maxParticipants: typeof maxParticipants === 'number' && maxParticipants > 0 ? maxParticipants : null,
        status: 0, // 0 = ongoing
        participants: [],
        groupId: groupId || '',
        createTime: db.serverDate(),
        updateTime: db.serverDate()
      }
    });
    
    return {
      success: true,
      data: {
        drawId: result._id,
      },
      message: '创建成功'
    };
  } catch (err) {
    return {
      success: false,
      data: {},
      message: err.message
    };
  }
};