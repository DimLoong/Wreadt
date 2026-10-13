# AI 测试集

修改提示词（`src/ai.ts` 与 `apps/server/src/main/resources/prompts/*.txt`）后，用固定输入跑一遍真实模型，自动检查输出质量。

## 内容

- `fixtures.ts`：23 个固定输入，覆盖场景问答出题、学习兴趣流（回复练习、微阅读、词汇小知识）、场景点评、易混词、例句、整句听写；包括曾经出过问题的情形（如报告 bug 的题里出现“禁止使用旧密码”这种题外要求）。
- `checks.ts`：规则检查，不依赖模型：
  - 能否解析；
  - 方向、要点、翻译等是否为界面语言；
  - 有没有 Markdown；
  - 推荐词 / usedWords 是否来自输入并真的出现；
  - 长度与数量是否符合难度；
  - 是否出现针对具体用例禁止的内容。
- `judge.ts`：模型评审，判断场景题是否自洽、有没有题外要求、有没有硬塞目标词、推荐词是否与题目相关。
- `run.ts`：运行入口，结果打印在终端，完整输出写入 `reports/`（不入库）。

## 运行

Key 只从环境变量读取，不要写进代码或提交。可以写在 `packages/core/eval/.env`（已被 git 忽略）：

```
WREADT_AI_KEY=你的 Key
# 以下可选
WREADT_AI_BASE_URL=https://maas.qianwenaiapi.com/compatible-mode/v1
WREADT_AI_MODEL=qwen-flash
WREADT_AI_JUDGE_MODEL=qwen-plus
```

在仓库根目录执行：

```
pnpm eval:ai                  # 全部用例
pnpm eval:ai --only scenario  # 只跑 id 或任务名含 scenario 的用例
pnpm eval:ai --repeat 3       # 每个用例跑 3 次，看稳定性
pnpm eval:ai --no-judge       # 只做规则检查
```

有错误时退出码为 1。“提醒”只是偏离建议长度等小问题，不算失败。
