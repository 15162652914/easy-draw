const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const { drawId } = event;
  const wxContext = cloud.getWXContext();
  const openId = wxContext.OPENID;
  
  try {
    // 事务式分配，防止并发拿到同一任务
    const transaction = await db.startTransaction();

    // 1. 读取抽签信息（事务内）
    const docRes = await transaction.collection('draws').doc(drawId).get();
    const draw = docRes.data;
    if (!draw) {
      await transaction.rollback();
      return { success: false, message: '抽签不存在' };
    }

    const participants = draw.participants || [];
    const hasJoined = participants.find(p => p.openId === openId);
    if (hasJoined) {
      await transaction.rollback();
      return {
        success: true,
        data: { hasJoined: true, result: hasJoined.result },
        message: '已参与过'
      };
    }

    // 2. 状态与上限校验（事务内）
    if (draw.status === 1) {
      await transaction.rollback();
      return { success: false, data: {}, message: '抽签已结束' };
    }
    const upperLimit = (typeof draw.maxParticipants === 'number' && draw.maxParticipants > 0)
      ? draw.maxParticipants
      : (typeof draw.totalCount === 'number' && draw.totalCount > 0)
        ? draw.totalCount
        : Array.isArray(draw.options)
          ? draw.options.length
          : 0;
    if (upperLimit > 0 && participants.length >= upperLimit) {
      await transaction.collection('draws').doc(drawId).update({ data: { status: 1, updateTime: db.serverDate() } });
      await transaction.commit();
      return { success: false, data: {}, message: '抽签已结束' };
    }

    // 3. 分配结果（事务内从签池弹出一个）
    let result;
    const lotsPool = draw.lotsPool || [];
    const hasOptions = Array.isArray(draw.options) && draw.options.length > 0;
    
    // 按类型决定分配策略
    const drawType = typeof draw.type === 'number' ? draw.type : 1; // 默认 sequence
    let pick = null;
    if (drawType === 2 /* RANDOM */) {
      // 随机抽选，支持赢家名额
      const opts = Array.isArray(draw.options) ? draw.options : [];
      if (opts.length === 0) {
        await transaction.rollback();
        return { success: false, data: {}, message: '无有效选项' };
      }
      
      // 规范化选项格式：兼容旧格式（字符串数组）和新格式（对象数组）
      const normalizedOpts = opts.map(opt => {
        if (typeof opt === 'string') {
          return { text: opt, isWinner: false }
        } else if (opt && typeof opt === 'object' && opt.text) {
          return { text: opt.text, isWinner: !!opt.isWinner }
        }
        return { text: String(opt || ''), isWinner: false }
      })
      
      // 确定赢家选项
      let winnerOption = draw.winnerOption
      if (!winnerOption) {
        // 如果数据库未保存winnerOption，尝试从选项中查找
        const markedWinner = normalizedOpts.find(opt => opt.isWinner)
        if (markedWinner) {
          winnerOption = markedWinner.text
        } else {
          const legacyWinner = normalizedOpts.find(opt => String(opt.text) === '获得名额')
          winnerOption = legacyWinner ? legacyWinner.text : (normalizedOpts[0]?.text || null)
        }
      }
      
      const winnerQuota = typeof draw.winnerQuota === 'number' && draw.winnerQuota > 0 ? draw.winnerQuota : 0;
      const winnersCount = typeof draw.winnersCount === 'number' ? draw.winnersCount : 0;

      if (winnerQuota > 0 && winnersCount < winnerQuota) {
        // 动态概率：根据剩余赢家名额和剩余参与名额计算获胜概率
        const remainingWinners = winnerQuota - winnersCount; // 剩余赢家名额
        const remainingSlots = upperLimit - participants.length; // 剩余参与名额
        
        // 如果剩余赢家名额 >= 剩余参与名额，所有人都是赢家
        const winProbability = remainingSlots > 0 
          ? Math.min(remainingWinners / remainingSlots, 1) 
          : 0;
        
        // 按概率随机决定是否获得赢家选项
        if (Math.random() < winProbability) {
          result = winnerOption;
        } else {
          // 未命中赢家，从其他选项中随机选择
          const others = normalizedOpts.filter(opt => String(opt.text) !== String(winnerOption))
          const pickFrom = others.length > 0 ? others : normalizedOpts
          result = pickFrom[Math.floor(Math.random() * pickFrom.length)].text
        }
      } else {
        // 赢家名额已满，随机分配其他选项
        const others = normalizedOpts.filter(opt => String(opt.text) !== String(winnerOption))
        const pickFrom = others.length > 0 ? others : normalizedOpts
        result = pickFrom[Math.floor(Math.random() * pickFrom.length)].text
      }
    } else {
      // SEQUENCE / 其他：从签池随机弹出一个
      const nonNullIndexes = lotsPool
        .map((v, idx) => (v !== null ? idx : -1))
        .filter(idx => idx !== -1);
      
      if (nonNullIndexes.length === 0) {
        // 签池为空：自动置为 CLOSED(1)
        await transaction.collection('draws').doc(drawId).update({ data: { status: 1, updateTime: db.serverDate() } });
        await transaction.commit();
        const msg = hasOptions ? '任务已分配完毕' : '抽签已结束';
        return { success: false, data: {}, message: msg };
      }
      
      pick = nonNullIndexes[Math.floor(Math.random() * nonNullIndexes.length)];
      result = lotsPool[pick];
    }

    // 4. 获取用户信息（事务外读取 users，不影响并发安全）
    let userInfo = { nickName: '', avatar: '' };
    try {
      const userResult = await db.collection('users').doc(openId).get();
      if (userResult.data) {
        userInfo.nickName = userResult.data.nickName || '';
        userInfo.avatar = userResult.data.avatarUrl || userResult.data.avatar || '';
      }
    } catch (e) {}

    // 5. 写入参与者并标记签池项为空（事务内一次性更新）
    const newParticipant = {
      openId: openId,
      nickName: event.nickName || userInfo.nickName || '匿名用户',
      avatar: event.avatar || userInfo.avatar || '',
      result: result,
      drawTime: db.serverDate()
    };

    const updatedParticipants = participants.concat([newParticipant]);
    const updateData = {
      updateTime: db.serverDate(),
      participants: updatedParticipants
    };
    if (pick !== null && pick !== undefined) {
      updateData[`lotsPool.${pick}`] = null;
    }
    // 若为 RANDOM 且命中赢家选项，则递增 winnersCount
    if (drawType === 2) {
      // 先获取winnerOption
      let winnerOption = draw.winnerOption
      if (!winnerOption) {
        // 如果数据库未保存，尝试从选项中查找
        const opts = Array.isArray(draw.options) ? draw.options : []
        const normalizedOpts = opts.map(opt => {
          if (typeof opt === 'string') {
            return { text: opt, isWinner: false }
          } else if (opt && typeof opt === 'object' && opt.text) {
            return { text: opt.text, isWinner: !!opt.isWinner }
          }
          return { text: String(opt || ''), isWinner: false }
        })
        const markedWinner = normalizedOpts.find(opt => opt.isWinner)
        if (markedWinner) {
          winnerOption = markedWinner.text
        } else {
          const legacyWinner = normalizedOpts.find(opt => String(opt.text) === '获得名额')
          winnerOption = legacyWinner ? legacyWinner.text : (normalizedOpts[0]?.text || null)
        }
      }
      
      if (winnerOption && String(newParticipant.result) === String(winnerOption)) {
        updateData['winnersCount'] = (typeof draw.winnersCount === 'number' ? draw.winnersCount : 0) + 1;
      }
    }

    await transaction.collection('draws').doc(drawId).update({ data: updateData });
    await transaction.commit();

    return {
      success: true,
      data: { hasJoined: false, result: result },
      message: '抽签成功'
    };
    
  } catch (err) {
    try { await db.rollbackTransaction(); } catch (e) {}
    return {
      success: false,
      data: {},
      message: err.message
    };
  }
};