# drawAnimation 组件规范（Spec）

## 组件职责
- 独立负责抽签动画渲染、交互反馈与结果展示。
- 通过事件与父页面通信，解耦动画与业务逻辑。

## 属性
- template: Object，抽签模板配置。
- autoStart: Boolean，是否自动开始动画。

## 事件
- onDrawStart：动画请求抽签时触发，父页面应执行抽签逻辑。
- onDrawComplete：动画结束时触发，父页面落盘结果。

## 方法
- startDraw()：手动触发动画。
- showResult(resultData)：父页面传递抽签结果，播放后续动画。
- reset()：重置动画状态。

## 动画流程
1. 用户点击或自动开始，进入摇晃动画。
2. 动画中途触发 onDrawStart，父页面抽签。
3. showResult 播放签条飞出与结果展示。
4. 动画结束 onDrawComplete，父页面更新数据。

## 交互细节
- 粒子特效、震动、音效增强体验。
- 动画阶段分明，提示文案友好。

## 兼容性
- 兼容无动画模式，保证抽签流程完整。
