# profileSheet 组件规范（Spec）

## 组件职责
- 负责用户昵称、头像等信息的收集与展示。
- 通过弹窗方式引导用户补全资料。

## 属性
- visible: Boolean，是否显示弹窗。
- userInfo: Object，当前用户信息。

## 事件
- confirm：用户确认输入。
- close：关闭弹窗。

## 交互细节
- 表单校验昵称、头像等必填项。
- 支持取消与确认操作。
