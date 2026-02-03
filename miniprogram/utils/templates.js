// 统一模板定义，便于复用与扩展
module.exports = [
  {
    templateId: 1,
    title: '礼物抽奖',
    desc: '适合节日礼物、活动奖品等抽奖场景',
    icon: '🎁',
    options: ['中奖', '谢谢参与', '再接再厉', '好运下次'],
    preferredType: 'random' // 允许重复，随机从 options 选取
  },
  {
    templateId: 2,
    title: '活动名额',
    desc: '适合限定名额的活动报名、预约等场景',
    icon: '🎉',
    options: ['获得名额', '等待候补', '遗憾错过'],
    preferredType: 'random', // 建议配合在创建时设置 maxParticipants 为名额数
    supportsWinnerQuota: true
  },
  {
    templateId: 3,
    title: '任务分配',
    desc: '适合团队任务分配、值班安排等场景',
    icon: '🎯',
    options: ['任务A', '任务B', '任务C', '任务D'],
    preferredType: 'sequence' // 一人一个且不重复，使用签池分配
  },
  {
    templateId: 4,
    title: '快速决策',
    desc: '适合快速做出选择、决定等场景',
    icon: '⚡️',
    options: ['是', '否', '再考虑', '听大家的'],
    preferredType: 'random' // 快速随机决定，可重复
  }
]
