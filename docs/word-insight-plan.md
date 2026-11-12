# 词义详解：实现清单

拼完一个词后，可以看到一段像有道“详解”那样的说明：这个词的核心意思、几个义项的共同点、常见搭配与语气、和近义词的区别。

参考（有道对 affinity 的说明，节选）：

> affinity 常译为“亲和力、亲近感、契合感”……它通常不是强烈的爱，而是一种“不由得觉得合得来”的感觉。
> **这个词的共同核心**：两类含义都包含“自然靠近、相互适合”的感觉……
> **常见搭配和语气**：affinity for 表示……affinity with 表示……比 liking 更正式，也比 love 弱。

## 设计原则（渐进式披露）

- **默认看不到**：打字时不出现，拼写过程中也不提示有详解。不加设置项。
- **只在拼完后出现**：入口放在拼完后已有的“更多：构词、短语、例句 ▾”里，作为展开后的第一张卡片“详解”。不新增按钮、不占主界面。
- **只给值得讲的词**：多义词、抽象词、容易混淆的词才有详解。简单具体的词（table、run 的基本义）由 AI 返回空，界面上就不显示这张卡，也不显示“暂无”。
- **先短后长**：卡片默认只显示一句话的核心（`core`），下面一行小字“展开详解”。点开才显示“共同核心 / 搭配与语气 / 辨析”。
- **按需生成**：展开“更多”时才请求，不在一组开始时批量预取。结果缓存在本机，同一个词只请求一次。
- 伪装模式、专项练习的听写模式不显示。

## 数据

```ts
interface WordInsight {
  /** 一句话核心：常译为什么、主要指什么、语气强弱（≤ 60 字）。空字符串 = 这个词不需要详解 */
  core: string;
  /** 共同核心：几个义项共有的感觉（≤ 80 字）；只有一个义项时为空 */
  essence: string;
  /** 常见搭配：2～4 条，每条 { phrase: "affinity for", note: "对某事物天然的喜爱" } */
  collocations: { phrase: string; note: string }[];
  /** 语气与语域：正式程度、强弱、常用场合（≤ 60 字），可为空 */
  tone: string;
  /** 近义词辨析：0～2 条，每条 { word: "liking", note: "更口语，程度相近但不强调契合" } */
  contrasts: { word: string; note: string }[];
}
```

## 工作清单

按顺序做，每步做完跑一次测试。

1. **核心库**：`packages/core/src/ai.ts`
   - 新增 `WORD_INSIGHT_PROMPT`，写进 `AI_PROMPTS`，任务名 `"word-insight"`。
   - 输入：`{ locale, word, meanings }`。meanings 是词库里的释义，让 AI 与之一致，不另起炉灶。
   - 提示词要点：
     - 面向中国学习者，用 locale 语言。
     - 不值得讲的词（简单具体、只有一个直白义项）返回 `core` 为空字符串，其余字段为空。
     - 不复述释义列表，讲释义列表讲不出来的东西：共同核心、语气、搭配、辨析。
     - 每段有字数上限（见上面的数据定义）。
     - 搭配必须是真实常用的，`phrase` 里包含目标词。
     - 只输出 JSON。
   - 新增 `parseWordInsight(content, word)`：
     - 解析并截断超长字段，丢掉 `phrase` 不含目标词的搭配。
     - `core` 为空时返回 `null`。
     - 加单测（`ai.test.ts`）：正常、返回空、超长、搭配没用到目标词这几种情况。
2. **服务端**：
   - 新增 `apps/server/src/main/resources/prompts/word-insight.txt`，内容与 `WORD_INSIGHT_PROMPT` 完全一致。现有测试会校验两边相同。
   - 在 `apps/server/src/main/java/com/wreadt/server/ai/AiService.java` 的 `TASKS` 白名单里加上 `"word-insight"`。
3. **评测**：`packages/core/eval/`
   - `fixtures.ts` 加 3 个用例：
     - affinity：多义、抽象，应有共同核心和搭配；
     - table：简单词，应返回空；
     - affect：易混，应有与 effect 的辨析。
   - `checks.ts` 加规则：字段长度、简单词应为空、搭配包含目标词。
   - `checks.test.ts` 里用例总数有两处断言，记得一起改。
   - 用 `pnpm eval:ai --only word-insight --repeat 3 --no-judge` 跑一遍，确认通过。Key 在 `packages/core/eval/.env`，不要打印、不要提交。
4. **网页端服务**：`apps/web/src/services/ai.ts`
   - 新增 `generateWordInsight(word, meanings, locale)`，照 `generateWordParts` 的写法，走 `runTask` 与 `parseOrWarn`。
5. **缓存**：新增 `apps/web/src/lib/wordInsight.ts`，照 `lib/wordParts.ts` 的写法：
   - 用 `getMeta` / `setMeta` 存在本机，键名 `wordInsight`，按 `locale:word` 缓存。
   - 结果为 `null`（不需要详解）也要缓存，免得重复请求。
   - 最多缓存 2000 个词，超出时删最早的。
   - 同一个词同时只发一次请求。
   - 没有 AI 时（`aiSource()` 为假）直接返回 `null`，不显示入口。
6. **界面**：
   - 新增 `apps/web/src/components/typing/WordInsightCard.tsx`。
   - 放进 `DetailCards.tsx` 展开后的最上面，在构词 `parts` 之后、短语之前。只在 `expanded && visible` 时请求。
   - **加载中**：用现有 `AiProgress` 组件，`task="word-insight"`。如果 `AiProgress` 有任务名列表，要一并补上。
   - **返回空或出错**：整张卡不渲染，不显示“暂无”。
   - **显示**：
     - 第一行是 `core`。
     - 下面一个文字按钮“展开详解”，点开后依次显示：共同核心、搭配（`phrase` 加粗 + `note`）、语气、辨析（`word` 加粗 + `note`）。
     - 各段的小标题用现有的 muted 小字样式。字号、间距、卡片样式与旁边的短语 / 例句卡片一致，沿用 `detail-*` 类名的写法，不新造视觉风格。
     - 展开带一点轻微的弹出动效，沿用 `pop-in` 或 `pron-judge-in` 的关键帧，并支持 `prefers-reduced-motion`。
   - **键盘**：卡片里的按钮不要抢走打字输入框的焦点（`onMouseDown` 里 `preventDefault`，参考 `DetailCards` 的写法）。
   - **文案**：加在 `apps/web/src/i18n/messages.ts` 的中英两处。建议键名：`insight.title`“详解”、`insight.more`“展开详解”、`insight.less`“收起”、`insight.essence`“共同核心”、`insight.collocations`“常见搭配”、`insight.tone`“语气”、`insight.contrasts`“辨析”。
7. **验证**：
   - 运行 `pnpm test`、`apps/web` 下的 `npx tsc --noEmit -p .` 和 `npx eslint src --quiet`。
   - 在浏览器里看一遍（`pnpm dev`，端口 25173）。可以用 Playwright 拦截 AI 请求、返回假数据来测，参考仓库外的测试脚本思路：`page.route` 拦截 AI 接口。至少看三种情况：
     - 有详解：先只显示一句话，点开后显示全部；
     - 简单词：不出现卡片；
     - 没有 AI：不出现卡片。
   - 浅色、深色主题都看一下。测完关掉 dev server。

## 不要做

- 不要在一组开始时批量预取，也不要在拼写过程中请求，免得浪费 token。
- 不要改现有的释义、短语、例句逻辑。
- 不要加设置开关。

## 提交

- 在 `dev` 分支提交，不要推送。提交信息用中文，例如：

  ```
  feat: 词义详解——拼完后在“更多”里显示…
  ```

- 完成后给出汇总：改了哪些文件、评测结果，以及界面截图的说明。
