# result 页面集成动画规范（Spec）

## 职责
- 集成 drawAnimation 组件，驱动抽签动画与结果展示。
- 负责抽签业务逻辑、用户参与校验、结果落盘。

## 主要流程
1. 用户点击参与，优先触发动画组件 startDraw。
2. 动画组件 onDrawStart 事件时，页面执行抽签逻辑。
3. 抽签结果通过 showResult 传递给动画组件。
4. 动画组件 onDrawComplete 后，页面落盘数据并提示。

## 关键接口
- selectComponent('#drawAnim') 获取动画组件实例。
- 事件绑定：bind:onDrawStart、bind:onDrawComplete。
- 兼容无动画模式，直接执行抽签与结果展示。

## 交互要求
- 动画与业务解耦，保证流程健壮。
- 动画结束后再落盘，避免提前暴露结果。
- 兼容原有参与/结果展示逻辑。
