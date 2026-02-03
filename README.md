## 集成 Vant Weapp 组件库

本项目已引入 `@vant/weapp`，用于底部弹窗（Popup/ActionSheet）等交互组件。

使用步骤（微信开发者工具）：

1. 在“详情 → 本地设置”中勾选“使用 npm 模块”。
2. 点击菜单“工具 → 构建 npm”，生成 `miniprogram_npm`。
3. 页面中通过 `usingComponents` 引用组件，例如：

	- `van-popup`: `@vant/weapp/popup/index`
	- `van-action-sheet`: `@vant/weapp/action-sheet/index`

若需要更新或安装依赖（命令行）：

```bash
npm install
npm install @vant/weapp --save
```

然后回到微信开发者工具再次“构建 npm”。

# 云开发 quickstart
# Easy Draw —— 微信小程序抽签/抽奖工具

一个基于微信云开发（CloudBase/TCB）的轻量抽签/抽奖小程序，支持模版管理、多人参与、结果展示与分享，适用于活动名额分配、任务安排、快速决策等场景。

---

**项目亮点**
- **模板驱动**：内置常用模板并支持用户自定义模板，云端/本地双存储回退。
- **公平抽签**：顺序抽签预生成签池并打乱，实时消耗，避免重复/偏差。
- **多人参与**：按 `openId` 去重参与，满员自动关闭或标记状态。
- **结果展示**：支持个人结果、分组结果汇总与复制分享。
- **历史记录**：浏览参与/创建过的抽签，支持分页加载与下拉刷新。

---

**功能列表**
- 模板管理
	- 查看内置模板与云端自定义模板（可回退到本地存储）
	- 新增自定义模板并保存到云端或本地
- 抽签创建
	- 选择模板或从零开始
	- 配置标题、选项、总名额（`totalCount`）等
	- 支持抽签类型：`sequence`（顺序预分配）、`random`（随机）、`group`（分组）
- 抽签参与
	- 按 `openId` 去重，已参与直接跳转结果
	- 满员自动标记为 `FULL`，不可再参与
- 结果与分享
	- 展示个人结果、全量参与者列表、分组汇总
	- 一键复制结果，支持会话/朋友圈分享
- 历史记录
	- 分页查看“我参与的”和“我创建的”，状态/时间/类型直观展示

---

**项目结构**
- 小程序代码：
	- [miniprogram/app.js](miniprogram/app.js)：云开发初始化、获取 `openId`
	- 页面：
		- [miniprogram/pages/index/index.js](miniprogram/pages/index/index.js)：模板展示与选择
		- [miniprogram/pages/create/create.js](miniprogram/pages/create/create.js)：创建抽签与保存模板
		- [miniprogram/pages/draw/draw.js](miniprogram/pages/draw/draw.js)：参与抽签、状态校验
		- [miniprogram/pages/result/result.js](miniprogram/pages/result/result.js)：结果展示、分组聚合、分享
		- [miniprogram/pages/history/history.js](miniprogram/pages/history/history.js)：历史记录分页浏览
	- 工具与常量：
		- [miniprogram/utils/db.js](miniprogram/utils/db.js)：云函数调用与集合查询封装
		- [miniprogram/utils/constants.js](miniprogram/utils/constants.js)：状态枚举与文案
		- [miniprogram/utils/templateManager.js](miniprogram/utils/templateManager.js)：模板云端/本地管理
		- [miniprogram/utils/templates.js](miniprogram/utils/templates.js)：内置模板列表
- 云函数：
	- [cloudfunctions/createDraw/index.js](cloudfunctions/createDraw/index.js)：创建抽签（预构建签池、初始化文档）
	- [cloudfunctions/joinDraw/index.js](cloudfunctions/joinDraw/index.js)：参与抽签（消耗签池、写入参与者）
	- [cloudfunctions/getOpenId/index.js](cloudfunctions/getOpenId/index.js)：获取 `openId`
	- [cloudfunctions/createTemplate/index.js](cloudfunctions/createTemplate/index.js)：新增自定义模板（计数器自增 `templateId`）
	- [cloudfunctions/listTemplates/index.js](cloudfunctions/listTemplates/index.js)：列出自定义模板
	- [cloudfunctions/entry/index.js](cloudfunctions/entry/index.js)：多功能入口（聚合路由）

---

**架构设计**
- 前端：微信小程序（WXML/WXSS/JS），页面间使用 `navigateTo`/`switchTab` 跳转；用户信息通过 `wx.getUserProfile` 获取，`openId` 缓存于本地。
- 云端：微信云开发（环境 ID 由 [miniprogram/app.js](miniprogram/app.js) 配置），使用云函数与数据库。
- 数据库（集合）：
	- `draws`：抽签主集合，记录抽签配置与参与者列表
	- `templates`：用户自定义模板集合
	- `counters`：模板自增计数器（文档 `templateCounter`）
	- `users`：用户信息（可选，用于补充昵称/头像）
- 数据流：
	1. `index` 加载模板 → 选择进入 `create`
	2. `create` 表单校验 → 云函数 `createDraw` 创建 → 跳转 `result`
	3. `draw` 加载详情 → 校验状态/去重 → 云函数 `joinDraw` 参与 → 跳转 `result`
	4. `result` 展示个人/全部/分组结果 → 支持分享与复制
	5. `history` 查询 `draws` 集合，分页展示参与/创建记录

---

**数据模型（`draws` 文档示例）**
```json
{
	"_openid": "creator openId",
	"title": "主题标题",
	"type": "sequence | random | group",
	"options": ["A", "B", "C"],
	"totalCount": 10,
	"lotsPool": [1,2,3,4,null,6,...],
	"status": 0, // 0:ONGOING, 1:CLOSED, 2:FULL
	"participants": [
		{ "openId":"xxx", "nickname":"张三", "avatar":"", "result":2, "drawTime":"serverDate" }
	],
	"groupId": "",
	"createTime": "serverDate",
	"updateTime": "serverDate"
}
```

状态枚举定义见 [miniprogram/utils/constants.js](miniprogram/utils/constants.js)。

---

**安装与运行（Windows）**
1. 安装并打开“微信开发者工具”，导入本项目根目录。
2. 在“云开发”面板创建环境，复制环境 ID，更新 [miniprogram/app.js](miniprogram/app.js) 中 `env`。
3. 初始化数据库集合：
	 - `draws`、`templates`、`counters`、`users`
	 - 在 `counters` 集合创建文档 `templateCounter`：`{ counter: 1000 }`
4. 部署云函数：右上角“云开发”→ 云函数 → 选择并上传以下函数：
	 - `createDraw`、`joinDraw`、`getOpenId`、`createTemplate`、`listTemplates`、`entry`
5. 开发者工具中运行小程序，按界面引导进行创建与参与。

可选：如果你使用命令行脚本（如 Linux/macOS），参考根目录的 `uploadCloudFunction.sh`；Windows 建议使用开发者工具图形界面部署。

---

**关键实现说明**
- 预生成签池与公平性：
	- 在 [cloudfunctions/createDraw/index.js](cloudfunctions/createDraw/index.js) 中对 `sequence` 类型生成 `1..N` 的签池并用 Fisher-Yates 算法打乱；参与时顺序消耗，保证一次性与不重复。
- 参与校验与满员处理：
	- 在 [cloudfunctions/joinDraw/index.js](cloudfunctions/joinDraw/index.js) 中以 `openId` 去重，人数达到 `totalCount` 后更新 `status=FULL` 并拒绝后续参与。
- 模板云端/本地回退：
	- 在 [miniprogram/utils/templateManager.js](miniprogram/utils/templateManager.js) 中优先调用云函数；失败时回退到本地 `storage`，保证离线可用性。

---

**常见问题（FAQ）**
- 为什么结果页显示“进行中/已结束”的样式不同？
	- 状态枚举与展示类由 [miniprogram/utils/constants.js](miniprogram/utils/constants.js) 控制，`ONGOING` 使用高亮，`CLOSED/FULL` 使用收拢样式。
- 没有配置 `users` 集合会怎样？
	- `joinDraw` 会优先使用前端传入的昵称/头像；无则回退到匿名值，不影响参与流程。
- 模板 ID 是如何生成的？
	- 云端使用 `counters/templateCounter` 原子自增，初始设为 `1000`，避免与内置模板冲突。

---

**后续规划**
- 支持 `random` 与 `group` 类型的云端严格分配逻辑
- 抽签结束条件/过期时间与自动关闭
- 管理员终止/重开抽签与通知
- 更丰富的模板（图标/封面/多语言）

---

**开源许可**
- 本项目文件未显式声明许可证；如需公开发布，请在根目录添加相应 LICENSE。

---

**致谢**
- 微信云开发（TCB）与微信开发者工具提供的便捷生态。

这是云开发的快速启动指引，其中演示了如何上手使用云开发的三大基础能力：

- 数据库：一个既可在小程序前端操作，也能在云函数中读写的 JSON 文档型数据库
- 文件存储：在小程序前端直接上传/下载云端文件，在云开发控制台可视化管理
- 云函数：在云端运行的代码，微信私有协议天然鉴权，开发者只需编写业务逻辑代码

## 参考文档

- [云开发文档](https://developers.weixin.qq.com/miniprogram/dev/wxcloud/basis/getting-started.html)

