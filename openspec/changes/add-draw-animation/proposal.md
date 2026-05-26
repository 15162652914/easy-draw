# 变更提案（Proposal）

## 变更名称
add-draw-animation

## 目标/动机
为抽签流程增加更具沉浸感的动画体验，提升用户参与感和趣味性。

## 方案概述
- 新增 drawAnimation 组件，支持抽签动画、氛围粒子、签条飞出与结果展示。
- 页面通过组件事件驱动抽签逻辑，动画与业务解耦。
- 支持动画与结果联动，动画结束后再落盘结果。

## 影响面
- miniprogram/components/drawAnimation/*
- miniprogram/pages/result/result.*

## 非目标
- 不涉及抽签核心算法和云函数逻辑变更

## 风险
- 动画兼容性与性能需在低端机型测试
