const DRAW_STATUS = {
  ONGOING: 0, // 进行中
  CLOSED: 1,  // 已结束
  FULL: 2,    // 已满员
};

const DRAW_STATUS_TEXT = {
  [DRAW_STATUS.ONGOING]: '进行中',
  [DRAW_STATUS.CLOSED]: '已结束',
  [DRAW_STATUS.FULL]: '已满员',
};

// 抽签方式数值枚举
const DRAW_TYPE = {
  NORMAL: 0,   // 普通抽签
  SEQUENCE: 1, // 顺序抽签
  RANDOM: 2,   // 随机抽选
  GROUP: 3     // 分组抽签
};

const DRAW_TYPE_TEXT = {
  [DRAW_TYPE.NORMAL]: '普通抽签',
  [DRAW_TYPE.SEQUENCE]: '顺序抽签',
  [DRAW_TYPE.RANDOM]: '随机抽选',
  [DRAW_TYPE.GROUP]: '分组抽签'
};
module.exports = {
  DRAW_STATUS,
  DRAW_STATUS_TEXT,
  DRAW_TYPE,
  DRAW_TYPE_TEXT,
};
