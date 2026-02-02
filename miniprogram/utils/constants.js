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

module.exports = {
  DRAW_STATUS,
  DRAW_STATUS_TEXT,
};
