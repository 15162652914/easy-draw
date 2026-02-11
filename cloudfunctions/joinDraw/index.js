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
      const winnerQuota = typeof draw.winnerQuota === 'number' && draw.winnerQuota > 0 ? draw.winnerQuota : 0;
      const winnersCount = typeof draw.winnersCount === 'number' ? draw.winnersCount : 0;
      const winnerOption = draw.winnerOption || (opts.find(o => String(o) === '获得名额') || opts[0]);

      if (winnerQuota > 0 && winnersCount < winnerQuota) {
        // 赢家名额未满，优先分配赢家选项
        result = winnerOption;
      } else {
        // 赢家名额已满，随机分配其他选项
        const others = opts.filter(o => String(o) !== String(winnerOption));
        const pickFrom = others.length > 0 ? others : opts;
        result = pickFrom[Math.floor(Math.random() * pickFrom.length)];
      }
    } else {
      // SEQUENCE / 其他：从签池随机弹出一个
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
      const winnerOption = draw.winnerOption || (Array.isArray(draw.options) && (draw.options.find(o => String(o) === '获得名额') || draw.options[0]));
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