一、总体技术架构（结论先给）
1️⃣ 客户端（统一思想：能共用就共用）
平台 技术 说明
Web React + TypeScript Web 优先，MVP & 桌面端基础
iOS / Android React Native + TypeScript 最大化 UI & 业务复用
Windows / macOS Tauri + React（推荐） 比 Electron 轻，GPL 友好

Web 端（核心）
维度 选择 理由
框架 React 18 最稳
语言 TypeScript 共享模型
构建 Vite 快、简单
UI TDesign React 设计优势
样式 Sass (SCSS) 你可控，不被原子化绑架
路由 React Router v6 成熟、心智负担低
状态 本地状态 + hooks 不上 Redux
缓存 IndexedDB 离线核心

👉 Web = 真正的主平台

📱 React Native（iOS / Android）
维度 选择
框架 React Native
样式 StyleSheet + 少量 Sass-like 结构
路由 React Navigation
本地存储 SQLite（expo-sqlite 或 WatermelonDB）
离线 本地即主存
同步 手动触发
🖥 桌面端
选择 理由
Tauri 极轻，离线友好
UI 直接复用 Web
存储 SQLite / IndexedDB
复习算法 服务端计算 + 客户端执行

wreadt/
├─ apps/
│ ├─ web/ # React Web
│ ├─ mobile/ # React Native
│ ├─ desktop/ # Tauri
│ └─ server/ # Spring Boot
│
├─ packages/
│ ├─ ui/ # TDesign 二次封装组件
│ ├─ hooks/ # 学习逻辑 hooks
│ ├─ api-client/ # OpenAPI → TS
│ ├─ models/ # 共享数据模型
│ └─ algorithms/ # 复习算法
│
├─ design/
│ ├─ figma/
│ └─ tokens/
│
├─ docs/
│ ├─ product.md
│ ├─ ux.md
│ └─ api.md
│
└─ LICENSE (GPL-3.0)

二、产品 → UX → UI 的正确顺序（非常关键）
阶段 0：产品定义（不要写代码）

输出 3 个文档即可：

核心用户画像

已有语言基础

有明确目标（考试 / 专业 / 工作）

桌面 + 移动混合使用

核心使用路径（MVP）

注册 → 选语言 → 选专业领域 → 开始阅读 → 标记生词 → 复习 → 同步

非核心但差异化

办公伪装 UI

成就拼图可视化

阶段 1：UX 设计（低保真）

只做这些页面：

学习主界面（Read / Write）

生词标记

复习模式

进度可视化

设置（伪装模式）

❌ 不要一开始就设计社交
✅ 先把「学习流畅」做到极致

阶段 2：UI 设计（高保真）

Figma 使用 TDesign 组件

定义：

字体比例（语言学习极其重要）

高亮 / 标注 / 注释交互

成就 & 拼图风格（情绪反馈）

三、开发路线（推荐顺序）
🚩 Phase 1：Web MVP（最重要）

目标：能用、能同步、能复习

React + TS

TDesign React

登录 / 注册

学习 + 生词标记

艾宾浩斯复习（基础版）

后端 API 跑通

👉 90% 业务逻辑未来直接复用

🚩 Phase 2：移动端（RN）

React Native + TDesign RN

共用：

业务 hooks

API client

学习逻辑

增加：

离线学习

后台同步

🚩 Phase 3：桌面端（Tauri）

Web 代码直接复用

新增：

全局快捷键

真·办公伪装模式（窗口标题 / UI）

🚩 Phase 4：高级功能

专业领域词库

词频 + 难度自适应

成就系统

本地 AI 辅助（可选）
