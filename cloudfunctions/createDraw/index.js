const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const { title, type, options, totalCount, groupId, maxParticipants, winnerQuota, creatorInfo, description } = event;
  const wxContext = cloud.getWXContext();
  const openId = wxContext.OPENID;
  
  try {
    // 解析类型：支持数值枚举或历史字符串
    const TYPE_MAP = {
      'normal': 0,
      'sequence': 1,
      'random': 2,
      'group': 3
    }
    let typeVal = type
    if (typeof typeVal === 'string') typeVal = TYPE_MAP[typeVal] ?? TYPE_MAP['sequence']

    // 生成签池：sequence 类型
    // - 若提供 options（如任务分配），则以打乱后的 options 为签池，保证一人一个且不重复
    // - 否则回退为 1..N 序列并打乱
    let lotsPool = [];
    if (typeVal === 1) {
      if (Array.isArray(options) && options.length > 0) {
        lotsPool = [...options];
      } else {
        lotsPool = Array.from({length: totalCount}, (_, i) => i + 1);
      }
      // Fisher-Yates 洗牌算法
      for (let i = lotsPool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [lotsPool[i], lotsPool[j]] = [lotsPool[j], lotsPool[i]];
      }
    }
    
    // 计算赢家选项（用于 RANDOM + winnerQuota）
    let winnerOption = null;
    if (typeVal === 2 && Array.isArray(options) && options.length > 0) {
      // 优先匹配“获得名额”，否则默认第一个选项
      const idx = options.findIndex(o => String(o) === '获得名额');
      winnerOption = idx >= 0 ? options[idx] : options[0];
    }

    // 组装创建人信息（用于结果页展示创建者头像和昵称）
    let creatorInfoPayload = null;
    if (creatorInfo && typeof creatorInfo === 'object') {
      creatorInfoPayload = {
        openId: creatorInfo.openId || openId,
        nickName: creatorInfo.nickName || '',
        avatarUrl: creatorInfo.avatarUrl || ''
      };
    } else {
      creatorInfoPayload = {
        openId,
        nickName: '',
        avatarUrl: ''
      };
    }

    const result = await db.collection('draws').add({
      data: {
        _openid: openId,
        title: title || '未命名抽签',
        // 抽签描述信息
        description: description || '',
        // 保存数值枚举类型（兼容旧字符串类型）
        type: typeof typeVal === 'number' ? typeVal : TYPE_MAP['sequence'],
        options: options || [],
        // 当存在 options（任务分配）时，以 options.length 作为总数，避免参与人数超过任务数量
        totalCount: (Array.isArray(options) && options.length > 0)
          ? options.length
          : (totalCount || 10),
        lotsPool: lotsPool, // 预生成的签池，已被抽的设为null
        // 新增：最大参与人数（可选）。未设置则按 totalCount 或 options 长度限制。
        maxParticipants: typeof maxParticipants === 'number' && maxParticipants > 0 ? maxParticipants : null,
        // 赢家名额（仅在 RANDOM 类型有意义）
        winnerQuota: typeof winnerQuota === 'number' && winnerQuota > 0 ? winnerQuota : null,
        winnersCount: 0,
        winnerOption: winnerOption,
        // 新增：创建人信息
        creatorInfo: creatorInfoPayload,
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