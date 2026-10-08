# Wreadt 架构

> 2026-10 重启时整理，取代早期的 way.md 草稿。

## 仓库结构

```
wreadt/
├─ apps/
│  ├─ web/        React 19 + Vite + TDesign + Sass（主平台，离线优先）
│  └─ server/     Spring Boot + PostgreSQL（账号、同步、AI 代理）
├─ packages/
│  ├─ core/       共享 TypeScript：类型、词库解析、打字判定、FSRS 调度、同步协议类型
│  └─ design/     Logo、封面等设计资产
└─ docs/
   ├─ architecture.md
   ├─ api.md      服务端 HTTP 接口
   └─ compliance.md  国内上线合规备忘
```

未来：`apps/mobile`（React Native）、`apps/desktop`（Tauri，直接复用 web 构建）。

## 核心原则

1. **离线优先**：所有学习数据先写本地（Web 用 IndexedDB），未登录也能完整使用。
2. **输入即学习**：打字是唯一的进度触发方式。
3. **登录只为同步**：邮箱 + 密码登录，登录后与服务端双向同步；不做公开内容发布（避免触发实名要求，见 compliance.md）。
4. **逻辑下沉 core**：凡是与 UI 无关的逻辑（判定、调度、数据结构）都放在 `packages/core`，以便 RN / Tauri 复用。

## 数据模型（客户端与服务端一致）

所有可同步记录都带有：

| 字段 | 说明 |
| --- | --- |
| `id` | 客户端生成的 UUID |
| `updatedAt` | 客户端修改时间（毫秒） |
| `deleted` | 软删除标记 |

记录类型：

- **card**：一个单词的复习状态（FSRS 字段：due、stability、difficulty、reps、lapses、state、lastReview），以 `dictId + word` 唯一。
- **customWord**：用户自增词条。
- **reviewLog**：每次打字完成产生的复习日志（只追加）。
- **setting**：键值对设置（界面语言、主题、当前词库、批次大小、伪装皮肤……）。

## 同步协议

基于“服务端单调版本号 + 最后写入者胜出（按 `updatedAt`）”：

1. 服务端为每个用户维护递增的 `version`，每条记录保存写入时的 `version`。
2. `POST /api/sync`，请求体：`{ since: number, changes: SyncRecord[] }`
   - 服务端逐条合并：若库中不存在或 `incoming.updatedAt >= stored.updatedAt`，则写入并赋新 `version`。
   - 返回 `{ version: number, changes: SyncRecord[] }`：`version > since` 的所有记录（含本次刚写入的，客户端可幂等覆盖）。
3. 客户端保存返回的 `version` 作为下次的 `since`，并清空本地“待推送”队列。

`SyncRecord = { type: "card" | "customWord" | "reviewLog" | "setting", id, updatedAt, deleted, data: object }`

`data` 对服务端是不透明 JSON，服务端只关心元字段，这样客户端演进字段无需改服务端。

## 认证

- 邮箱 + 密码注册 / 登录，密码 BCrypt。
- Access Token（JWT，15 分钟）+ Refresh Token（30 天，随机串，库中只存哈希，轮换）。
- 邮箱验证、找回密码：服务端通过 SMTP 发送；开发环境把邮件内容打印到日志。

## 复习算法

使用 [FSRS](https://github.com/open-spaced-repetition/ts-fsrs)（比固定艾宾浩斯间隔更精确）。打字结果映射为评分：

| 打字表现 | FSRS 评分 |
| --- | --- |
| 跳过 / 放弃 | Again |
| 有错误或触发提示 | Hard |
| 一次正确 | Good |
| 一次正确且速度快 | Easy |

## 发音

有道 `dictvoice` 公开接口（英 / 日），浏览器端缓存。
