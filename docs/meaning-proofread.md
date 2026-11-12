# 英文释义人工校对

为中国学习者校对内置英文词库的中文释义。只读文件、写文件，**不要调用千问或其它外部 AI 接口**，由你自己判断。

## 范围

| 文件（`apps/web/public/dicts/`） | 简称 |
| --- | --- |
| `2025KaoYanHongBaoShu.json` | 考研 |
| `CET4_T.json` | CET4 |
| `CET6_T.json` | CET6 |
| `IELTS_3_T.json` | 雅思 |
| `GaoKao_3500.json` | 高考 |
| `itVocabulary.json` | IT |

共 9071 个词，已校对 1134 个（`scripts/data/meaning-reviewed.txt`），剩 7937 个。

## 步骤

1. 导出待校对的词：

   ```bash
   node scripts/export-meanings.mjs /tmp/meanings   # 每份 400 词：p00.tsv … p19.tsv
   ```

   每行是 `word<TAB>[词库] 释义`。同一个词在不同词库里写法不同时，用 `  ||  ` 隔开，例如：

   ```
   embody	[考研] v. 体现，使具体化；包含，包括；使personified  ||  [CET6,雅思] v. 体现，使具体化；包含，包括
   ```

   释义里 ` / ` 分隔词性，`；` 分隔义项组，`，` 分隔近义说法。

2. 一份一份地校对，每份做完就写回词库并记录进度（见“写回”），避免中断后丢失。

## 改什么

大多数释义没有问题，不要动。只改明显的错误：

- **混入了别的词的意思**：cannon 混入 canon 的“教规”；rose 写成“上升”（rise）；dove 写成“潜水”（dive）；May 混入情态动词 may；eighty 写成“八十年代”（eighties）。
- **义项不存在或不准确**：enter 的名词“入口”；headteacher 写成“班主任”（应为校长）；possess 写成“占用”。
- **常用义没排第一**：click 先写“发出喀嗒声”（应先写“点击”）；presentation 先写“提供，显示”（应先写“报告，演示”）；treatment 先写“待遇”（应先写“治疗”）。
- **缺了非常常用的意思**。
- **乱码与残片**：中文里混入英文或拼音碎片（`使personified`、`(lao,ke)`、`,,'dɔk,jumənt]`），日文字形（`犠牲`），空释义，词性标错（副词标成 `adj.`）。

不改：措辞偏好、近义词取舍、长短，以及只是写法不同的词性（`interj.` 与 `int.`、`det.` 与 `adj.`）。拿不准就不改。

## 怎么改

- 保留原有正确的写法与近义说法，只调整顺序、替换错误义项、补上缺失的常用义。
- `trans` 数组每项一个词性：`"n. 义项，近义；义项"`。词性后加一个空格；常用词性在前。
- 词性写法：`n. v. vt. vi. adj. adv. prep. conj. pron. num. int. art. aux. abbr.`；多个词性共用一条释义写成 `n.&v.`。
- **IT 词库保留 IT 含义**：test 是“测试”、enter 是“键入”、lock 有“自动跟踪”。IT 词条有问题时，只在原词条上清理或改正，不要换成考试词库的通用释义。考试词库也不要换成 IT 含义。
- 同一个词在多个考试词库里有同样的错误时，每个词库都要改。

## 写回

- 只改词条的 `trans`，不动其它字段、词条顺序和键的顺序。
- 保持文件原有的缩进：考研是 2 个空格，其它是 4 个空格。文件末尾保留换行。
- 每份做完，把这份里所有的词（改了的和没改的）追加到 `scripts/data/meaning-reviewed.txt`，一行一个。之后再导出时，这些词会被跳过。

## 校验

```bash
node scripts/check-dicts.mjs
pnpm test
git diff --stat apps/web/public/dicts   # 改动应只在 trans 里
```

## 不要做

- 不要运行 `scripts/unify-meanings.mjs` 或 `scripts/proofread-meanings.mjs`。它们会按红宝书或千问的结果重写释义，覆盖人工修正。
- 不要改音标、例句、单词拼写。

## 提交

- 在 `dev` 分支提交，不要推送。
- 提交信息用中文，按“fix(dicts): …”的格式，写清改了哪些类别并举几个词作例子。每 2～5 份提交一次。
- 完成后给出改动汇总：每份改了多少个词，各类别的代表例子，以及拿不准、没改的词。
