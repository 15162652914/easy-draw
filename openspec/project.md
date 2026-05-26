# 项目简介

Easy Draw 是一个基于微信云开发（CloudBase/TCB）的轻量抽签/抽奖小程序，支持模板管理、多人参与、结果展示与分享，适用于活动名额分配、任务安排、快速决策等场景。

## 技术栈
- 微信小程序（WXML/WXSS/JS）
- 微信云开发（CloudBase/TCB）
- Node.js 云函数
- Vant Weapp 组件库（UI 交互）
- @vant/weapp 依赖

## 项目结构
- miniprogram/：小程序前端页面与组件
- cloudfunctions/：云函数（如 createDraw、joinDraw、getOpenId 等）
- utils/：常量、模板管理、数据库封装等工具
- miniprogram_npm/：npm 构建依赖

## 主要功能
- 模板驱动抽签/抽奖，支持自定义与内置模板
- 公平抽签（顺序/随机/分组），签池预生成与打乱
- 多人参与，openId 去重，满员自动关闭
- 结果展示（个人/分组/全量）、一键复制与分享
- 历史记录分页浏览

## 云端集合
- draws：抽签主集合，记录抽签配置与参与者
- templates：用户自定义模板集合
- counters：模板自增计数器
- users：用户信息（可选）

## 云函数
- createDraw：创建抽签，预生成签池
- joinDraw：参与抽签，消耗签池
- getOpenId：获取 openId
- createTemplate：新增自定义模板
- listTemplates：列出自定义模板
- entry：多功能入口

## 代码规范与约定
- 统一使用 async/await 处理异步
- 状态、类型常量集中于 utils/constants.js
- 重要逻辑和数据流有详细注释
- 云函数与前端解耦，接口清晰
- 依赖 npm 包管理，组件引用规范
- 参考文档：README.md、miniprogram/utils/constants.js

## 贡献与开发建议
- 新功能建议先补充 openspec proposal/task/spec
- 代码需通过 lint/构建/基本功能测试
- 任务拆分建议不超过 2 小时/子任务
- 重要变更建议补充数据模型/流程图

---
如需详细数据模型、接口说明或开发流程，请参考 README.md 及 openspec 相关文档。