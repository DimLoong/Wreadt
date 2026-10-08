# Roadmap

取代旧的 tasklist-*.json / AGENTS.json。完成一项就勾掉。

## 阶段 1：整理（2026-10 重启）

- [x] 清理多轮 AI 协作遗留的流程文件与 create-turbo 模板代码
- [x] 重写 README / 架构文档，补 LICENSE（GPL-3.0）

## 阶段 2：本地 MVP（Web）

- [ ] `packages/core`：类型、词库解析、打字判定、FSRS 调度
- [ ] 真实词库：CET4/6、考研、IELTS、IT 行业词、JLPT N5~N1（来自 qwerty-learner）
- [ ] IndexedDB 存储（Dexie），替换 localStorage
- [ ] 打字页接入词库选择 + 复习队列（到期优先，再学新词）
- [ ] 进度页：词库掌握度、今日复习数、热力图
- [ ] 自定义词库页可增删词
- [ ] 修复：批次大小、日语罗马音准确率、路由跳转整页刷新

## 阶段 3：账号与同步

- [ ] `apps/server`：Spring Boot + Flyway + PostgreSQL（开发用 H2）
- [ ] 邮箱密码注册 / 登录 / 刷新令牌 / 邮箱验证 / 找回密码
- [ ] `/api/sync` 增量同步
- [ ] Web：登录页、同步状态、离线队列

## 阶段 4：差异化功能

- [ ] 办公伪装模式（Word / Excel / VS Code 皮肤）
- [ ] 键盘拼图式成就可视化
- [ ] AI 造句练习（服务端代理 OpenAI 兼容接口，如 DeepSeek / 通义千问）
- [ ] 错误多次时的字母提示、片假名外来词对照英文

## 之后

- [ ] React Native 移动端
- [ ] Tauri 桌面端（全局快捷键、真·窗口伪装）
- [ ] 行业词库扩充、词频 / 难度自适应
- [ ] 上线合规：ICP 备案、App 备案（见 docs/compliance.md）
