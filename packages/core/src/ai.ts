// AI 提示词与结果校验。服务端 apps/server/src/main/resources/prompts/*.txt 是同一份文本，修改时两边同步。

export type ExerciseKind = "cloze" | "usage" | "mistake";

export interface Exercise {
  word: string;
  kind: ExerciseKind;
  prompt: string;
  answer: string;
  explanation: string;
  /** cloze：整句的翻译（不含目标词），作为提示 */
  hint?: string;
  /** mistake：句中用错的片段（与 prompt 中原文一致） */
  wrong?: string;
  /** mistake：改正后的片段 */
  fix?: string;
}

import type { Example, Lang, QwertyEntry } from "./types.ts";

export const EXERCISES_PROMPT = `你是一名语言老师，为学习者生成用于“打字练习”的例句题目。

输入是一个 JSON 对象：
- lang：目标语言代码（如 en、ja），题目中的句子必须使用该语言；
- locale：学习者的母语界面语言（如 zh-CN），explanation 必须使用该语言；
- words：需要练习的单词列表。

为每个单词生成 1 道题，kind 从以下三种中选择（尽量混合使用）：
- cloze：给出一个自然、地道的例句，把目标词替换为 ___（只挖这一处），answer 为被挖掉的词（使用句中实际出现的形式）；句子其他地方不得再出现目标词；hint 为整句的 locale 语言翻译，作为提示，翻译里不要出现英文目标词；
- usage：prompt 用 locale 语言描述一个情境，要求学习者用目标词写一句话，answer 为一个参考句子；
- mistake：先写一个使用目标词的正确句子作为 answer；再只改动目标词本身或紧挨着它的 1～3 个词，故意制造一处明确的语法错误，得到 prompt（完整句子，不含 ___）。错误类型从这些中选：主谓不一致（she approve）、词形 / 时态用错（has approve）、不可数名词加复数（feedbacks）、冠词错误（an useful）、多余的介词（discuss about）、缺少必需的介词（depend the team）。wrong 为 prompt 中被改坏的片段，fix 为 answer 中对应的原片段（把 prompt 里的 wrong 换成 fix 必须正好得到 answer）。不要把一种正确说法换成另一种正确说法。

要求：
- 句子长度适中（8～20 个词），贴近日常或职场场景，避免生僻内容；
- explanation 简短（不超过 40 字），说明词义或用法要点；cloze 的 explanation 不要直接写出答案以外的提示；
- 只输出 JSON，不要输出任何其他文字。

输出格式：
{"exercises":[{"word":"...","kind":"cloze|usage|mistake","prompt":"...","answer":"...","explanation":"...","hint":"（仅 cloze）","wrong":"（仅 mistake）","fix":"（仅 mistake）"}]}`;

export const EXAMPLES_PROMPT = `你是一名语言老师，为刚背完一个单词的学习者提供例句。

输入是一个 JSON 对象：
- lang：目标语言代码（如 en、ja），例句必须使用该语言；
- locale：学习者的母语界面语言（如 zh-CN），translation 必须使用该语言；
- word：目标单词（日语可能是罗马音，请换成自然的日文写法）。

生成 3 个例句：
- 覆盖该词最常见的 2～3 种含义或搭配；
- 句子自然地道，8～20 个词，贴近日常、学习或职场场景；
- translation 为对应的母语翻译。

另外给出 3～5 个包含该词的常用短语或固定搭配：phrase 为短语原文，meaning 为母语释义（可用 ; 分隔多个译法）。

只输出 JSON，不要输出任何其他文字。

输出格式：
{"phrases":[{"phrase":"...","meaning":"..."}],"examples":[{"sentence":"...","translation":"..."}]}`;

export const ANALYZE_PROMPT = `你是一名词典编辑，帮语言学习者把他们遇到的单词整理进个人词库。

输入是一个 JSON 对象：
- lang：单词所属语言（en 或 ja）；
- locale：学习者的母语界面语言（如 zh-CN），meanings 与 exampleTrans 必须使用该语言；
- words：学习者选中的单词或短语（可能是变形，如 running、went、食べた）；
- context：可选，单词所在的原句。

对每个输入返回一条：
- input：原样返回输入；
- word：词典原形。英文为小写原形（专有名词、缩写保留大小写）；日语为常用写法（有汉字用汉字）；
- reading：仅日语，word 的平假名读音；英文为空字符串；
- romaji：仅日语，reading 的平文式（Hepburn）罗马音，长音写成 ou / uu 等，小写无空格；英文为空字符串；
- phonetic：仅英文，美式国际音标，不带斜杠；日语为空字符串；
- meanings：1～3 条释义，每条以词性开头（n. / v. / adj. / adv. / phr.）；如果提供了 context，第一条必须是该语境下的意思；
- example：一个自然的例句。如果提供了 context，直接使用 context 原句；
- exampleTrans：example 的翻译。

只输出 JSON，不要输出任何其他文字。

输出格式：
{"words":[{"input":"...","word":"...","reading":"","romaji":"","phonetic":"...","meanings":["..."],"example":"...","exampleTrans":"..."}]}`;

export const EXPAND_PROMPT = `你是一名职业英语教练，为某个职业的从业者扩充专业词汇表。

输入是一个 JSON 对象：
- role：职业名称与说明；
- locale：学习者的母语界面语言（如 zh-CN），trans 与 exampleTrans 必须使用该语言；
- count：需要生成的词条数量；
- exclude：词表中已有的词条，生成结果不能与其重复（忽略大小写）。

要求：
- 选择该职业日常工作中真正高频、实用的英文术语或固定短语（最多 3 个词），避免人人都会的基础词和品牌名；
- name 只能包含字母、空格、连字符和撇号；
- trans 为 1～2 条释义，每条以词性开头（n. / v. / adj. / adv. / phr.）；
- usphone 为美式国际音标，不带斜杠；
- example 为一个 8～18 个词的职场例句，exampleTrans 为其翻译。

只输出 JSON，不要输出任何其他文字。

输出格式：
{"words":[{"name":"...","trans":["..."],"usphone":"...","example":"...","exampleTrans":"..."}]}`;

export const DICT_OUTLINE_PROMPT = `你是一名职业英语课程设计师。学习者用母语描述了自己的工作或生活场景（可能还粘贴了聊天记录、商品页等资料），请把它拆成一份“场景词库”的主题大纲。

输入是一个 JSON 对象：
- description：学习者的描述与资料；
- lang：目标语言代码（如 en）；
- locale：学习者的母语界面语言（如 zh-CN），name、description、title 使用该语言。

要求：
- name：给这个词库起一个简短的名字（不超过 12 个字，如“跨境直播带货”）；description：一句话说明适用场景；
- topics：按该场景从开始到结束的工作流程，拆成 5～8 个主题；学习者明确提到的概念（如邮费、税费、发货周期）必须覆盖到，可以单独成为主题，也可以归入相近的主题；
- 每个主题的 title 简短具体（不超过 8 个字，如“开场与问候”“邮费与税费”），examples 给 3～4 个该主题下的目标语言例词或短语，每个只有 1～3 个词（如 "shipping fee"、"customs duty"），不要写成句子，让学习者一看就明白这个主题学什么；
- 只围绕学习者的场景，不要加入无关的通用主题。

只输出 JSON，不要输出任何其他文字。

输出格式：
{"name":"<locale 语言>","description":"<locale 语言>","topics":[{"title":"<locale 语言>","examples":["<目标语言>"]}]}`;

export const DICT_WORDS_PROMPT = `你是一名职业英语教练，为某个场景词库中的一个主题生成词条。

输入是一个 JSON 对象：
- dict：词库名称与说明（学习者的场景）；
- topic：本次要生成的主题，以及参考例子；
- level：basic（入门：最常用、最基础的说法）或 advanced（进阶：更专业、更地道的说法）；
- locale：学习者的母语界面语言（如 zh-CN），trans 与 exampleTrans 必须使用该语言；
- count：需要生成的词条数量；
- exclude：已有的词条，不能重复（忽略大小写）。

要求：
- 选择在这个场景、这个主题下真正会说到、会用到的英文单词或固定短语（最多 3 个词），单词与常用搭配混合；
- name 只能包含字母、空格、连字符和撇号，除专有名词外用小写；
- trans 为 1～2 条释义，每条以词性开头（n. / v. / adj. / adv. / phr.），释义贴合本场景；
- usphone 为美式国际音标，不带斜杠（短语可以省略）；
- example 为一个 8～18 个词、发生在这个场景里的自然例句，exampleTrans 为其翻译。

只输出 JSON，不要输出任何其他文字。

输出格式：
{"words":[{"name":"...","trans":["..."],"usphone":"...","example":"...","exampleTrans":"..."}]}`;

export const SCENARIO_QUESTION_PROMPT = `你是一名职场英语教练，为某个职业的学习者出一道“场景问答”题，让他们用英语解释、论证和阐述，练习灵活运用学过的单词、短语与语法。

输入是一个 JSON 对象：
- role：学习者的职业与说明；
- locale：学习者的母语界面语言（如 zh-CN），所有 *Trans、directions、keyPoints、meaning 字段使用该语言；locale 为 en 时所有字段都用英文，*Trans 留空字符串；
- level：难度，simple / medium / professional；
- targetWords：学习者最近学过或容易出错的单词，每项含 word、meaning、tag（marked 学习者主动标记、要重点掌握 / today 今日学习 / weak 易错 / review 已学待巩固）；
- avoidTitles：最近做过的题目标题，新题不要重复这些场景；
- news：可选，今天的一条真实新闻（headline 与 summary）。提供时，以这条新闻为背景出题：把新闻放进学习者职业的工作情境（例如这件事对你的工作或团队有什么影响、你会如何应对或向同事解释），scenario 先用一两句交代新闻要点；不要编造新闻里没有的事实。

按难度出题（严格遵守长度与数量）：
- simple：一个简单、具体、常见的问题，例如“解释间距在 UI 设计中的重要性”“说明代码评审的作用”。scenario 用 1～2 句、不超过 35 个英文单词交代背景；question 是一句简短直白的英文问题；directions 给 2～3 条回答方向（如“使信息密度合理分布”“增加呼吸感”“减少认知负担”）；expectedWords 为 30～50；recommendedWords 3～5 个，优先选常用词；phrases 2 个；grammar 最多 1 个简单句式；
- medium：一个具体的工作情境，需要解释原因或做简单比较。scenario 40～70 个英文单词；directions 给 3～4 条回答方向；expectedWords 为 60～100；recommendedWords 5～8 个；phrases 3～4 个；grammar 1～2 个；
- professional：真实、深入的专业场景，例如解释某个设计 / 接口 / 模块的作用、为什么这样设计、权衡了什么、技术架构各部分的职责与关系，在评审会上为方案辩护，复盘线上事故等。scenario 60～120 个英文单词并给出足够细节；question 为开放式问题，要求解释 what / why / how 与各部分关系；directions 可以为空数组；expectedWords 为 120～200；recommendedWords 8～12 个；phrases 4～6 个；grammar 2～3 个高级结构（倒装、分词状语、虚拟语气、强调句、非限制性定语从句等）。

通用要求：
- 语言：title、scenario、question、usage、phrase、pattern、example 一律使用英文；scenarioTrans、questionTrans、directions、keyPoints、各处 meaning 使用 locale 语言；
- 场景贴近该职业的日常工作，难度要与 level 匹配，simple 不要出得太专业；
- 题目自洽是第一位的：directions 与 keyPoints 只能是回答 question 本身时会涉及的内容，绝不能为了用上某个 targetWord 而添加 question 没有问到的要求或话题；
- targetWords 只是候选：只挑选能自然用在本题回答里的词（可以只用其中 1～2 个，甚至不用），用不上的词直接舍弃，不要硬塞进 scenario、question、directions、keyPoints 或 recommendedWords；与该职业工作场景无关的词（如自然科学、地理、生活类词汇）一律舍弃，不要用比喻硬套；
- directions、keyPoints、*Trans 必须使用 locale 语言（如中文），不要写英文；
- keyPoints 给出回答可以覆盖的要点（simple 2 条、medium 3 条、professional 3～5 条），不要写成范文；
- recommendedWords：优先从 targetWords 中挑选能自然用进本题的（原样保留其 tag，marked 的词最优先），再补充本场景下地道的表达（tag 为 new），数量按 level 要求补足（targetWords 为空或都用不上时，全部用 new 补足）；每个推荐词都必须能在回答本题时自然用上，usage 给一个贴合本题、包含该词的搭配示例；
- phrases 为有用的短语或句式；grammar 每个附一个贴合本题的例句。

输出前自检：scenario 与 question 是英文；逐条确认 directions 都在回答 question 本身，如有与 question 无关的条目，删除它。

只输出 JSON，不要输出任何其他文字。

输出格式：
{"title":"<English title>","scenario":"<English>","scenarioTrans":"<locale 语言>","question":"<English>","questionTrans":"<locale 语言>","directions":["<locale 语言>"],"expectedWords":40,"keyPoints":["<locale 语言>"],"recommendedWords":[{"word":"<English>","meaning":"<locale 语言>","usage":"<English>","tag":"marked|today|weak|review|new"}],"phrases":[{"phrase":"<English>","meaning":"<locale 语言>"}],"grammar":[{"pattern":"<English>","example":"<English>","meaning":"<locale 语言>"}]}`;

export const SCENARIO_REVIEW_PROMPT = `你是一名温和、鼓励人的职场英语教练，点评学习者对一道“场景问答”题的英文回答。

输入是一个 JSON 对象：
- role：学习者的职业；
- locale：学习者的母语界面语言（如 zh-CN）；
- level：题目难度，simple / medium / professional；
- expectedWords：题目期望的回答长度（英文单词数）；
- scenario、question：题目；
- recommendedWords：题目推荐使用的词；
- answer：学习者的回答。

语言：summary、strengths、notes、missedPoints、misusedWords.note、newWords.meaning 必须使用 locale 语言（zh-CN 即简体中文，只在引用原词时夹带英文）；original、improved、modelAnswer 使用英文。

语气：
- 温和、具体、以建议为主：用“可以改为……”“更自然的说法是……”“注意……”这类说法，先肯定意思表达到位的地方；
- 不要使用“严重”“错误很大”“混乱”“糟糕”“不及格”等让人受挫的字眼，也不要用感叹号批评；指出问题时说清怎么改即可。

评判原则：
- 只根据 question 本身判断内容是否完整、切题，不要自行补充 question 没有问到的要求；
- 没用上推荐词不扣分，用对了推荐词在 vocabulary 上加分；

点评要求：
- 按原文顺序把 answer 拆成句子，逐句给出 improved（更地道、更精确的改写，保留原意；原句已经很好时可以只做微调或保持不变）和 notes（用 locale 语言指出问题与改写理由，具体到用词、搭配、语法结构；写成连贯的一两句话，不要编号或分条）；tags 从 grammar、word-choice、collocation、clarity、style、good 中选择；
- 改写的难度与 level 匹配：simple 只修正错误、换用更自然的常用表达，不要改成复杂长句；medium 可适当升级用词与句式；professional 可使用高级语法与专业表达；
- original 必须逐字取自 answer，不要改动；improved 只改进原句本身，不要往里添加新内容；
- usedWords 列出 recommendedWords 中被正确使用的词；misusedWords 列出用错的词及原因；
- missedPoints 只列出 question 本身要求、但回答中缺失或论证不足的要点（simple 最多 2 条）；没有就返回空数组；
- scores 四项各 0～10：content（内容与论证）、vocabulary（词汇丰富与准确）、grammar（语法正确与多样）、coherence（逻辑与衔接），评分标准按 level 调整，不要用专业级标准要求 simple 题；score 为 0～100 的总分；答非所问、与题目完全无关或内容混乱无法理解时 offTopic 为 true（否则为 false）；
- modelAnswer 写一篇参考回答，长度在 expectedWords 的 ±30% 以内，难度与 level 匹配，只回答 question 本身，自然地用上多数推荐词；
- newWords 从 improved 与 modelAnswer 中挑 2～6 个值得学习、学习者没用到的词或短语（simple 2～3 个）。

只输出 JSON，不要输出任何其他文字。

输出格式：
{"score":0,"offTopic":false,"scores":{"content":0,"vocabulary":0,"grammar":0,"coherence":0},"summary":"<locale 语言>","strengths":["<locale 语言>"],"sentences":[{"original":"<answer 原句>","improved":"<English>","notes":"<locale 语言>","tags":["grammar"]}],"usedWords":["<English>"],"misusedWords":[{"word":"<English>","note":"<locale 语言>"}],"missedPoints":["<locale 语言>"],"modelAnswer":"<English>","newWords":[{"word":"<English>","meaning":"<locale 语言>"}]}`;

export const FEED_PROMPT = `你是一个语言学习社区的内容编辑，为学习者挑选有意思、可以参与讨论的话题，帮助他们在真实语境中复习最近学过的词。

输入是一个 JSON 对象：
- role：学习者的职业或方向（可能是“通用职场”）；
- locale：学习者的母语界面语言（如 zh-CN），所有 *Trans 与 stance 字段使用该语言；
- words：学习者最近学过或标记的词，每项含 word 与 meaning；
- levels：每个话题的难度，按顺序一一对应，有几项就出几个话题（simple 或 medium）；
- avoidTopics：最近推送过的话题，不要重复；
- news：可选，今天的几条真实新闻，每项含 id、headline、summary。

难度（严格遵守，宁可更短更简单）：
- simple：日常、轻松的话题；topic 不超过 10 个词；context 一句话、不超过 15 个词；每个回复 15～30 个词、2 句话，只用最常见的词和简单句，不用习语和长从句；每个回复用上 words 中的 1～2 个词；
- medium：贴近工作或生活、稍有观点碰撞的话题；topic 不超过 15 个词；context 1～2 句；每个回复 30～50 个词、2～3 句，可以有简单的从句；每个回复用上 words 中的 2～3 个词。

要求：
- 话题有意思、能引发不同看法（例如“发布时带着已知小 bug 可以接受吗？”“远程办公让沟通更高效还是更低效？”），不要太专业、不要考试腔；
- topic 用英文提出问题；context 用英文交代背景；
- 每个话题给 2 个示范回复，代表不同立场或角度（stance 用简短的母语标签，如“赞成”“反对”“补充一个角度”）；author 为简短的英文身份描述（如 "A PM at a fintech startup"）；回复口语自然，像真实社区回复；
- level 原样写回该话题的难度；
- 提供了 news 时，尽量让每个话题都围绕一条不同的新闻展开（从职场或日常角度讨论，例如“这件事会改变你的工作方式吗？”），不要编造新闻里没有的细节，并在该话题写上对应的 newsId；没有对应新闻的话题 newsId 为空字符串；
- usedWords 只能列出 words 中的原词，并且该词必须真的出现在这个话题的回复里（可以是变形）；没用到的词不要列；
- 不同话题尽量覆盖不同的词；
- 所有文本都是纯文本，不要使用 Markdown（不要用 ** 加粗、不要用列表符号），需要强调的词会由程序自动高亮。

只输出 JSON，不要输出任何其他文字。

输出格式：
{"items":[{"level":"simple","topic":"<English>","topicTrans":"<locale 语言>","context":"<English>","contextTrans":"<locale 语言>","replies":[{"author":"<English>","stance":"<locale 语言>","text":"<English>","textTrans":"<locale 语言>"}],"usedWords":["..."],"newsId":""}]}`;

export const READING_PROMPT = `你是一名英语阅读老师，为学习者写一篇小短文，让他们在语境里再见一次最近学过的词。

输入是一个 JSON 对象：
- role：学习者的职业或方向（可能是“通用职场”）；
- locale：学习者的母语界面语言（如 zh-CN），textTrans、explanation 使用该语言；
- level：难度，simple 或 medium；
- words：学习者最近学过的词，每项含 word 与 meaning；
- avoidTitles：最近读过的短文标题，不要重复；
- news：可选，今天的一条真实新闻（headline 与 summary）。提供时，短文写成这条新闻的英文短讯（可以加一句和读者工作、生活的联系），忠于新闻事实，不编造数字、人名和细节。

难度（严格遵守）：
- simple：50～70 个词，短句为主，只用最常见的词；1 道理解题；
- medium：80～120 个词，可以有从句；2 道理解题。

要求：
- 体裁可以是小故事、工作中的一封短邮件、一段经验分享、一个有趣的小知识等，轻松有趣，贴近该职业或日常生活；
- 自然地用上 words 中的 3～5 个词（可以是变形），用不上的词不要硬塞；
- title 为英文短标题；text 为纯文本，可用换行分段，不要使用 Markdown；
- 理解题考查对全文意思的理解，不考生僻细节；question 与 options 用英文，3 个选项，answer 必须与其中一个选项完全相同；explanation 用 locale 语言说明为什么；
- usedWords 只列出确实出现在 text 中的 words 原词。

只输出 JSON，不要输出任何其他文字。

输出格式：
{"title":"<English>","text":"<English>","textTrans":"<locale 语言>","questions":[{"question":"<English>","options":["...","...","..."],"answer":"...","explanation":"<locale 语言>"}],"usedWords":["..."]}`;

export const WORD_TIPS_PROMPT = `你是一名有趣的英语老师，为学习者讲几个关于他们最近学过的词的小知识，帮助他们记得更牢、用得更地道。

输入是一个 JSON 对象：
- locale：学习者的母语界面语言（如 zh-CN），title、tip、exampleTrans 使用该语言；
- level：难度，simple 或 medium；
- words：学习者最近学过的词，每项含 word 与 meaning；
- count：需要的条数。

要求：
- 从 words 中挑 count 个最值得讲的词，每个词一条；
- kind 从 collocation（常用搭配）、confusable（易混词辨析）、origin（词源或构词，帮助记忆）、usage（地道用法或常见错误）中选最有意思的一种，尽量让几条的 kind 不同；
- title 直接概括这条知识的具体内容（不超过 16 字，如“meet / miss a deadline”“affect 还是 effect？”“wrap up：收尾”），不要写“常用搭配小贴士”“词源小揭秘”这类空泛标题；tip 用 1～2 句话讲清楚（不超过 60 字），具体、有用，不要空泛；
- 只讲确定的、主流词典与语法书认可的知识，不要编造“规则”（例如不要声称某个常见说法是错的）；拿不准的就换一个角度讲；
- example 为一个自然的英文例句（simple 不超过 12 个词，medium 不超过 20 个词），exampleTrans 为翻译；
- 纯文本，不要使用 Markdown。

只输出 JSON，不要输出任何其他文字。

输出格式：
{"tips":[{"word":"...","kind":"collocation|confusable|origin|usage","title":"<locale 语言>","tip":"<locale 语言>","example":"<English>","exampleTrans":"<locale 语言>"}]}`;

export const DICTATION_PROMPT = `你是一名英语听力老师，为学习者准备“整句听写”用的句子：学习者听一句、打一句。

输入是一个 JSON 对象：
- role：学习者的职业或方向（可能是“通用职场”）；
- locale：学习者的母语界面语言（如 zh-CN），translation 使用该语言；
- level：难度，simple 或 medium；
- words：学习者最近学过的词，每项含 word 与 meaning；
- count：需要的句子数。

难度（严格遵守）：
- simple：每句 6～10 个词，常见词、简单句，语速正常时容易听清；
- medium：每句 10～16 个词，可以有一个从句或常见短语。

要求：
- 句子自然地道，贴近日常或该职业的工作场景，适合朗读；每句是完整的一句话，以句号、问号或感叹号结尾；
- 尽量每句用上 words 中的一个词（可以是变形），word 写该词原形；用不上时 word 为空字符串，不要硬塞；
- 不要使用人名缩写、数字、网址、专有名词缩写等难以听写的内容；
- translation 为自然的翻译；纯文本，不要使用 Markdown。

只输出 JSON，不要输出任何其他文字。

输出格式：
{"sentences":[{"text":"<English>","translation":"<locale 语言>","word":"..."}]}`;

export const PRACTICE_CARDS_PROMPT = `你是一名英语老师，为刚打完一组单词的学习者出几道“造句小练习”，穿插在打字练习中，每道题 20 秒左右能完成。

输入是一个 JSON 对象：
- locale：学习者的母语界面语言（如 zh-CN），translation、zh 使用该语言；
- cards：要出的题，按顺序一一对应，每项含 kind（cloze 填空 / translate 中译英）和 words（目标词，含 word 与 meaning）。

要求：
- 按 cards 的顺序逐项出题，数量与顺序必须一致；
- cloze：写一个自然地道的英文句子（8～16 个词），把目标词（可以是变形，如 delayed）替换成 ___，只挖这一个空；answer 为被挖掉的原文；translation 为整句的翻译，作为提示，翻译里不要出现英文目标词；
- translate：写一句自然的中文 zh（10～25 个字，不要夹带英文），学习者需要用上全部目标词把它译成英文；reference 为地道的参考译文（8～18 个词，必须用上全部目标词，可以是变形）；
- 句子贴近日常或职场，难度适中，语境要能让人推断出目标词；不同题目的场景不要重复；
- 纯文本，不要使用 Markdown。

只输出 JSON，不要输出任何其他文字。

输出格式：
{"cards":[{"kind":"cloze","sentence":"<English with ___>","answer":"<English>","translation":"<locale 语言>"},{"kind":"translate","zh":"<locale 语言>","reference":"<English>"}]}`;

export const PRACTICE_REVIEW_PROMPT = `你是一名耐心的英语老师，点评学习者在打字练习中穿插完成的几道造句小题。

输入是一个 JSON 对象：
- locale：学习者的母语界面语言（如 zh-CN），comment 使用该语言；
- items：学习者的作答，按顺序一一对应，每项含 kind（cloze 填空 / translate 中译英）、words（目标词）、question（题目：填空句或中文句子）、reference（参考答案）、answer（学习者的答案）。

要求：
- 按 items 的顺序逐项点评，数量与顺序必须一致；
- verdict：great（地道正确）、good（意思对，有小问题）、fix（有明显错误或没用对目标词）；
- comment：一两句话，具体指出问题或亮点（不超过 50 字）；不要只说“很好”；
- better：在保留学习者原意的前提下更地道的写法；verdict 为 great 时可以为空字符串；填空题给出完整的正确句子；
- misused：学习者用错的目标词（拼写、词形、搭配或语义错误），没用错就返回空数组；没用到目标词也算用错；
- 与参考答案说法不同但同样正确时，不算错；
- score：0～100 的分数，按意思是否正确、目标词是否用对、语法是否通顺综合给分；
- offTopic：答案与题目无关、内容混乱无法理解时为 true（否则为 false）。

只输出 JSON，不要输出任何其他文字。

输出格式：
{"reviews":[{"verdict":"great|good|fix","score":0,"offTopic":false,"comment":"...","better":"...","misused":["..."]}]}`;

export const CONFUSABLE_PROMPT = `你是一名语言老师，帮学习者分清容易混淆的词。

输入是一个 JSON 对象：
- lang：目标语言代码（如 en、ja）；
- locale：学习者的母语界面语言（如 zh-CN），explanation 使用该语言；
- words：学习者标记为“易混”的词，每项含 word 与 meaning。

要求：
- 为每个输入词找出最常与它混淆的 1～2 个词（拼写相近、意思相近或用法易错，如 affect / effect、complement / compliment、economic / economical）；如果输入里已有互相易混的词，把它们放在同一组；
- 每组给出 explanation：简明对比各词的含义、词性与用法区别（不超过 80 字）；
- 每组出 2～3 道选择填空题：sentence 为挖空（用 ___ 表示）的自然例句，options 为该组的词，answer 为正确选项（必须是 options 之一），explanation 一句话说明为什么；
- 句子 8～20 个词，贴近日常或职场。

只输出 JSON，不要输出任何其他文字。

输出格式：
{"groups":[{"words":["...","..."],"explanation":"...","items":[{"sentence":"...","options":["...","..."],"answer":"...","explanation":"..."}]}]}`;

/** 服务端 /api/ai/complete 支持的任务（与 prompts/*.txt 文件名一致） */
export type AiTask =
  | "sentence-exercises"
  | "word-parts"
  | "extract-words"
  | "news-brief"
  | "spelling-tip"
  | "word-examples"
  | "analyze-words"
  | "expand-dict"
  | "scenario-question"
  | "scenario-review"
  | "confusable-quiz"
  | "interest-feed"
  | "micro-reading"
  | "word-tips"
  | "dictation-sentences"
  | "dict-outline"
  | "dict-words"
  | "practice-cards"
  | "practice-review";

export const WORD_PARTS_PROMPT = `你是一名英语词汇老师，帮学习者通过构词（前缀 / 词根 / 后缀）理解并记住单词的拼写。

输入是一个 JSON 对象：
- locale：学习者的界面语言（如 zh-CN），meaning 必须使用该语言；
- words：英文单词列表。

为每个单词给出构词拆分 parts，每部分含：
- text：单词中的原文片段，所有片段按顺序拼起来必须正好等于原词（不增不减、不改字母）；
- type：prefix（前缀）/ root（词根）/ suffix（后缀）；
- meaning：这部分的含义，locale 语言，不超过 8 个字。

要求：
- 只拆真正有构词意义的单词，如 un + believ + able、inter + act + ive、pre + dict；拆不出有意义部分的（简单词、外来词、硬拆没有帮助的）输出 parts: []，不要硬拆；
- 词根写成它在这个单词里出现的样子（believ，而不是 believe），meaning 写本义（如 spect：看）；
- 复合词按组成的词拆（dead + line），type 都是 root；
- 短语（含空格）输出 parts: []；
- 只输出 JSON，不要输出任何其他文字。

输出格式：
{"words":[{"word":"...","parts":[{"text":"...","type":"prefix|root|suffix","meaning":"..."}]}]}`;

export const EXTRACT_PROMPT = `你是一名职场英语老师。学习者粘贴了一段工作中遇到的英文（邮件、文档、会议纪要、代码评审等），请从中挑出最值得学的词和短语。

输入是一个 JSON 对象：
- locale：学习者的界面语言（如 zh-CN），meanings 与 exampleTrans 必须使用该语言；
- text：粘贴的原文。

挑选 5～15 个，按在原文中出现的顺序：
- 职场常用、对读懂这段文字关键、学习者可能不熟的词或固定短语（如 align on、follow up、deliverable）；
- 跳过非常基础的词（the、make、good、team 这类）、人名、公司名、产品名、代码标识符、URL 和数字；
- word：词典原形，小写（专有缩写保留大小写）；短语不超过 4 个词；
- phonetic：美式国际音标，不带斜杠（短语可为空字符串）；
- meanings：1～2 条，每条以词性开头（n. / v. / adj. / adv. / phr.），第一条必须是在这段文字中的意思；
- example：原文中包含该词的那一句，原样摘录；超过 30 个词时只截取包含该词的分句；
- exampleTrans：example 的翻译。

只输出 JSON，不要输出任何其他文字。

输出格式：
{"words":[{"word":"...","phonetic":"...","meanings":["..."],"example":"...","exampleTrans":"..."}]}`;

export const NEWS_BRIEF_PROMPT = `你是一名为英语学习者写新闻短讯的编辑。把一条真实新闻改写成适合学习者阅读的英文短讯，并自然地用上学习者刚学的词。

输入是一个 JSON 对象：
- locale：学习者的界面语言（如 zh-CN），title 与 translation 使用该语言；
- role：学习者的职业；
- words：学习者刚学的词，每项含 word 与 meaning；
- news：一条真实新闻，含 headline（维基百科“新闻”栏目的原文）与 summary（相关词条的摘要）。

要求：
- title：locale 语言的简短标题，不超过 20 字；
- text：英文 80～110 词，难度 B1～B2，句子简短清楚；忠于 news 的事实，不编造数字、人名和细节；最后可以用一两句结合 role 说说这件事对职场人意味着什么，但要和事实分开；
- 尽量自然地用上 words 中的词（可用变形），用不上的不要硬凑；
- translation：text 的翻译；
- usedWords：text 中实际用到的 words 原词；
- 纯文本，不要 Markdown；只输出 JSON，不要输出任何其他文字。

输出格式：
{"title":"...","text":"...","translation":"...","usedWords":["..."]}`;


export const SPELLING_TIP_PROMPT = `你是一名英语拼写老师。学习者把一个单词拼错了，错误来自发音相近（弱读元音、双写辅音、-ance/-ence 这类），请用一句话讲清楚为什么容易错、怎么记住正确拼法。

输入是一个 JSON 对象：
- locale：学习者的界面语言（如 zh-CN），tip 必须使用该语言；
- word：正确拼写；
- wrong：学习者拼成的样子；
- at：出错的位置，形如 "ali → ale"（左边是正确写法的片段，右边是学习者写的）；
- pattern：错误类型（vowel 元音混淆 / double 双写辅音 / ie-ei / tion-sion / ance-ence / able-ible / c-s-k / silent 不发音字母）。

要求：
- 只讲 at 所指的这个位置：这里的字母读什么音、为什么容易写错，不要讲单词里别的部分；
- tip 不超过 50 字，结构为：“<at 中正确的字母> 在这里读 /<音标>/，<为什么容易写成学习者那样>；记：<针对这个词的记法，如词根、相关词或联想>”；
- 只针对这一个词，不要泛泛而谈；不要重复写出两种拼法；
- 纯文本，不要 Markdown；只输出 JSON，不要输出任何其他文字。

输出格式：
{"tip":"..."}`;

export const AI_PROMPTS: Record<AiTask, string> = {
  "sentence-exercises": EXERCISES_PROMPT,
  "word-parts": WORD_PARTS_PROMPT,
  "extract-words": EXTRACT_PROMPT,
  "news-brief": NEWS_BRIEF_PROMPT,
  "spelling-tip": SPELLING_TIP_PROMPT,
  "word-examples": EXAMPLES_PROMPT,
  "analyze-words": ANALYZE_PROMPT,
  "expand-dict": EXPAND_PROMPT,
  "scenario-question": SCENARIO_QUESTION_PROMPT,
  "scenario-review": SCENARIO_REVIEW_PROMPT,
  "confusable-quiz": CONFUSABLE_PROMPT,
  "interest-feed": FEED_PROMPT,
  "micro-reading": READING_PROMPT,
  "word-tips": WORD_TIPS_PROMPT,
  "dictation-sentences": DICTATION_PROMPT,
  "dict-outline": DICT_OUTLINE_PROMPT,
  "dict-words": DICT_WORDS_PROMPT,
  "practice-cards": PRACTICE_CARDS_PROMPT,
  "practice-review": PRACTICE_REVIEW_PROMPT,
};

const KINDS = new Set<string>(["cloze", "usage", "mistake"]);

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function items(content: string, key: string): Record<string, unknown>[] {
  let root: unknown;
  try {
    // 有些模型会包一层 ```json 代码块
    root = JSON.parse(content.replace(/^\s*```(?:json)?\s*|\s*```\s*$/g, ""));
  } catch {
    throw new Error("AI 返回内容无法解析");
  }
  const list = (root as Record<string, unknown>)?.[key];
  return Array.isArray(list) ? (list as Record<string, unknown>[]) : [];
}

/** 比较句子时忽略大小写、多余空格与句末标点 */
const sameSentence = (a: string, b: string) => {
  const n = (x: string) => x.toLowerCase().replace(/\s+/g, " ").replace(/[.!?。！？\s]+$/, "").trim();
  return n(a) === n(b);
};

/** 校验并整理一道题；不合格（填空露出答案、改错句子没有明确错误等）返回 null */
function toExercise(n: Record<string, unknown>): Exercise | null {
  const e: Exercise = { word: str(n.word), kind: str(n.kind) as ExerciseKind, prompt: str(n.prompt), answer: str(n.answer), explanation: str(n.explanation) };
  if (!e.word || !KINDS.has(e.kind) || !e.prompt) return null;
  if (e.kind === "cloze") {
    // 只能有一个空，且句子里不能再出现目标词（否则题目自带答案）
    if (!e.answer || e.prompt.split("___").length !== 2 || usesWord(e.prompt.replace("___", " "), e.word) || usesWord(e.prompt.replace("___", " "), e.answer)) return null;
    const hint = str(n.hint);
    if (hint && !usesWord(hint, e.word)) e.hint = hint;
    return e;
  }
  if (e.kind === "mistake") {
    const wrong = str(n.wrong);
    const fix = str(n.fix);
    // 必须能在原句中找到错误片段、改正后确实不同，且把错误片段换回去正好得到正确句子（对不上说明题目自相矛盾）
    if (!wrong || !fix || !e.prompt.includes(wrong) || wrong.toLowerCase() === fix.toLowerCase()) return null;
    const restored = e.prompt.replace(wrong, fix);
    if (e.answer && !sameSentence(restored, e.answer)) return null;
    return { ...e, wrong, fix, answer: restored };
  }
  return e.answer ? e : null;
}

export function parseExercises(content: string): Exercise[] {
  const out = items(content, "exercises").map(toExercise).filter((e): e is Exercise => e !== null);
  if (!out.length) throw new Error("AI 未返回有效题目");
  return out;
}

export interface Phrase {
  phrase: string;
  meaning: string;
}

/** 例句接口同时返回的常用短语（旧版输出没有时为空） */
export function parsePhrases(content: string): Phrase[] {
  return items(content, "phrases")
    .map((n) => ({ phrase: str(n.phrase), meaning: str(n.meaning) }))
    .filter((p) => p.phrase);
}

export function parseExamples(content: string): Example[] {
  const out = items(content, "examples")
    .map((n) => ({ sentence: str(n.sentence), translation: str(n.translation) }))
    .filter((e) => e.sentence);
  if (!out.length) throw new Error("AI 未返回有效例句");
  return out;
}

export interface AnalyzedWord {
  input: string;
  word: string;
  reading: string;
  romaji: string;
  phonetic: string;
  meanings: string[];
  example: string;
  exampleTrans: string;
}

function strList(v: unknown): string[] {
  return Array.isArray(v) ? v.map(str).filter(Boolean) : str(v) ? [str(v)] : [];
}

export function parseAnalysis(content: string, lang: Lang): AnalyzedWord[] {
  const out = items(content, "words")
    .map((n) => ({
      input: str(n.input),
      word: str(n.word),
      reading: str(n.reading),
      romaji: str(n.romaji).toLowerCase().replace(/[^a-z' -]/g, ""),
      phonetic: str(n.phonetic).replace(/^[/[]|[/\]]$/g, ""),
      meanings: strList(n.meanings),
      example: str(n.example),
      exampleTrans: str(n.exampleTrans),
    }))
    .filter((w) => w.word && w.meanings.length && (lang === "en" || w.romaji));
  if (!out.length) throw new Error("AI 未返回有效的单词信息");
  return out;
}

const TERM_RE = /^[A-Za-z][A-Za-z '-]*$/;

/** 解析 AI 扩充的职业词条，过滤格式不对或与已有词重复的 */
export function parseExpansion(content: string, exclude: Iterable<string>): QwertyEntry[] {
  const seen = new Set([...exclude].map((n) => n.toLowerCase()));
  const out: QwertyEntry[] = [];
  for (const n of items(content, "words")) {
    const name = str(n.name).replace(/\s+/g, " ");
    if (!TERM_RE.test(name) || name.split(" ").length > 3 || seen.has(name.toLowerCase())) continue;
    const trans = strList(n.trans);
    if (!trans.length) continue;
    seen.add(name.toLowerCase());
    out.push({ name, trans, usphone: str(n.usphone).replace(/^[/[]|[/\]]$/g, ""), example: str(n.example), exampleTrans: str(n.exampleTrans) });
  }
  if (!out.length) throw new Error("AI 未返回新的词条");
  return out;
}

/** 自定义词库的主题大纲 */
export interface DictOutline {
  name: string;
  description: string;
  topics: { title: string; examples: string[] }[];
}

export function parseDictOutline(content: string): DictOutline {
  const r = parseRoot(content);
  const topics = objList(r.topics)
    .map((n) => ({ title: str(n.title), examples: strList(n.examples).slice(0, 4) }))
    .filter((t) => t.title);
  if (!topics.length) throw new Error("AI 未返回有效的主题");
  return { name: str(r.name), description: str(r.description), topics: topics.slice(0, 10) };
}

export type WordTag = "marked" | "today" | "weak" | "review" | "new";

export type ScenarioLevel = "simple" | "medium" | "professional";

/** 各难度默认的期望回答长度（AI 未给出时使用）与最少提交词数 */
export const SCENARIO_LEVELS: Record<ScenarioLevel, { expectedWords: number; minWords: number }> = {
  simple: { expectedWords: 40, minWords: 10 },
  medium: { expectedWords: 80, minWords: 25 },
  professional: { expectedWords: 150, minWords: 50 },
};

/** 题目 / 话题 / 短读所依据的真实新闻（显示新闻配图与来源） */
export interface NewsRef {
  id: string;
  headline: string;
  /** 维基百科词条的配图（真实图片，不是生成的） */
  image?: string;
  /** 来源链接 */
  url?: string;
}

export interface Scenario {
  level: ScenarioLevel;
  /** 以新闻为背景出的题 */
  news?: NewsRef;
  title: string;
  scenario: string;
  scenarioTrans: string;
  question: string;
  questionTrans: string;
  /** 回答方向提示（简单 / 中等难度） */
  directions: string[];
  expectedWords: number;
  keyPoints: string[];
  recommendedWords: { word: string; meaning: string; usage: string; tag: WordTag }[];
  phrases: { phrase: string; meaning: string }[];
  grammar: { pattern: string; example: string; meaning: string }[];
}

export type SentenceTag = "grammar" | "word-choice" | "collocation" | "clarity" | "style" | "good";

export interface ScenarioReview {
  score: number;
  /** 答非所问或内容无法识别：界面显示“无评分” */
  offTopic?: boolean;
  scores: { content: number; vocabulary: number; grammar: number; coherence: number };
  summary: string;
  strengths: string[];
  sentences: { original: string; improved: string; notes: string; tags: SentenceTag[] }[];
  usedWords: string[];
  misusedWords: { word: string; note: string }[];
  missedPoints: string[];
  modelAnswer: string;
  newWords: { word: string; meaning: string }[];
}

function obj(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function objList(v: unknown): Record<string, unknown>[] {
  return Array.isArray(v) ? v.map(obj) : [];
}

function num(v: unknown, max: number): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.min(max, Math.round(n))) : 0;
}

function parseRoot(content: string): Record<string, unknown> {
  try {
    return obj(JSON.parse(content.replace(/^\s*```(?:json)?\s*|\s*```\s*$/g, "")));
  } catch {
    throw new Error("AI 返回内容无法解析");
  }
}

const WORD_TAGS = new Set(["marked", "today", "weak", "review", "new"]);
const SENTENCE_TAGS = new Set(["grammar", "word-choice", "collocation", "clarity", "style", "good"]);

export function parseScenario(content: string, level: ScenarioLevel = "professional"): Scenario {
  const r = parseRoot(content);
  const expected = num(r.expectedWords, 400);
  const s: Scenario = {
    level,
    title: str(r.title),
    scenario: str(r.scenario),
    scenarioTrans: str(r.scenarioTrans),
    question: str(r.question),
    questionTrans: str(r.questionTrans),
    directions: strList(r.directions),
    expectedWords: expected >= 10 ? expected : SCENARIO_LEVELS[level].expectedWords,
    keyPoints: strList(r.keyPoints),
    recommendedWords: objList(r.recommendedWords)
      .map((n) => ({ word: str(n.word), meaning: str(n.meaning), usage: str(n.usage), tag: (WORD_TAGS.has(str(n.tag)) ? str(n.tag) : "new") as WordTag }))
      .filter((w) => w.word),
    phrases: objList(r.phrases).map((n) => ({ phrase: str(n.phrase), meaning: str(n.meaning) })).filter((p) => p.phrase),
    grammar: objList(r.grammar).map((n) => ({ pattern: str(n.pattern), example: str(n.example), meaning: str(n.meaning) })).filter((g) => g.pattern),
  };
  // 简单题可能只有问题、没有背景描述
  if (!s.question) throw new Error("AI 未返回有效的场景题");
  return s;
}

/** 题目本身（标题、背景、问题）应为英文；模型偶尔会写成中文 */
export function scenarioHasCjk(s: Pick<Scenario, "title" | "scenario" | "question">): boolean {
  return /[\u3400-\u9fff]/.test(`${s.title} ${s.scenario} ${s.question}`);
}

export function parseScenarioReview(content: string): ScenarioReview {
  const r = parseRoot(content);
  const scores = obj(r.scores);
  const review: ScenarioReview = {
    score: num(r.score, 100),
    offTopic: r.offTopic === true,
    scores: { content: num(scores.content, 10), vocabulary: num(scores.vocabulary, 10), grammar: num(scores.grammar, 10), coherence: num(scores.coherence, 10) },
    summary: str(r.summary),
    strengths: strList(r.strengths),
    sentences: objList(r.sentences)
      .map((n) => ({
        original: str(n.original),
        improved: str(n.improved),
        notes: str(n.notes),
        tags: strList(n.tags).filter((t) => SENTENCE_TAGS.has(t)) as SentenceTag[],
      }))
      .filter((x) => x.original),
    usedWords: strList(r.usedWords),
    misusedWords: objList(r.misusedWords).map((n) => ({ word: str(n.word), note: str(n.note) })).filter((m) => m.word),
    missedPoints: strList(r.missedPoints),
    modelAnswer: str(r.modelAnswer),
    newWords: objList(r.newWords).map((n) => ({ word: str(n.word), meaning: str(n.meaning) })).filter((w) => w.word),
  };
  if (!review.sentences.length && !review.summary) throw new Error("AI 未返回有效的点评");
  return review;
}

export interface ConfusableGroup {
  words: string[];
  explanation: string;
  items: { sentence: string; options: string[]; answer: string; explanation: string }[];
}

/** 易混词辨析题：答案必须是选项之一 */
export function parseConfusable(content: string): ConfusableGroup[] {
  const groups = objList(parseRoot(content).groups)
    .map((g) => ({
      words: strList(g.words),
      explanation: str(g.explanation),
      items: objList(g.items)
        .map((it) => ({ sentence: str(it.sentence), options: strList(it.options), answer: str(it.answer), explanation: str(it.explanation) }))
        .filter((it) => it.sentence && it.options.length >= 2 && it.options.includes(it.answer)),
    }))
    .filter((g) => g.words.length >= 2 && g.items.length);
  if (!groups.length) throw new Error("AI 未返回有效的辨析题");
  return groups;
}

export interface FeedReply {
  author: string;
  stance: string;
  text: string;
  textTrans: string;
}

/** 学习兴趣流的一条：讨论话题 + 两个示范回复 */
/** 兴趣流内容的难度 */
export type FeedLevel = "simple" | "medium";

export interface FeedItem {
  level?: FeedLevel;
  topic: string;
  topicTrans: string;
  context: string;
  contextTrans: string;
  replies: FeedReply[];
  usedWords: string[];
  /** 围绕某条新闻展开的话题：新闻 id（界面据此显示新闻配图） */
  newsId?: string;
  news?: NewsRef;
}

/** words 为输入的词表：usedWords 只保留表中、且确实出现在回复里的词（模型偶尔会虚报） */
export function parseFeed(content: string, words?: string[]): FeedItem[] {
  const allowed = words ? new Set(words.map((w) => w.toLowerCase())) : null;
  // 模型偶尔会换字段名（topics / data、question、replies 里用 content），或直接返回数组
  let root: unknown;
  try {
    root = JSON.parse(content.replace(/^\s*```(?:json)?\s*|\s*```\s*$/g, ""));
  } catch {
    throw new Error("AI 返回内容无法解析");
  }
  const r0 = obj(root);
  const list = Array.isArray(root) ? root : (r0.items ?? r0.topics ?? r0.data ?? r0.feed);
  const items = objList(list)
    .map((n) => ({
      ...(n.level === "simple" || n.level === "medium" ? { level: n.level as FeedLevel } : {}),
      topic: str(n.topic) || str(n.question) || str(n.title),
      topicTrans: str(n.topicTrans),
      context: str(n.context),
      contextTrans: str(n.contextTrans),
      replies: objList(n.replies ?? n.answers)
        .map((r) => ({ author: str(r.author), stance: str(r.stance), text: str(r.text) || str(r.content) || str(r.reply), textTrans: str(r.textTrans) || str(r.translation) }))
        .filter((r) => r.text),
      usedWords: strList(n.usedWords),
      ...(str(n.newsId) ? { newsId: str(n.newsId) } : {}),
    }))
    .map((it) => {
      const text = it.replies.map((r) => r.text).join(" ");
      return { ...it, usedWords: it.usedWords.filter((w) => (!allowed || allowed.has(w.toLowerCase())) && usesWord(text, w)) };
    })
    .filter((it) => it.topic && it.replies.length);
  if (!items.length) throw new Error("AI 未返回有效的话题");
  return items;
}

/** 整句听写的一句 */
export interface DictationSentence {
  text: string;
  translation: string;
  /** 句中用到的学过的词（可能为空） */
  word: string;
}

export function parseDictation(content: string): DictationSentence[] {
  const list = objList(parseRoot(content).sentences)
    .map((n) => ({ text: str(n.text), translation: str(n.translation), word: str(n.word) }))
    // 太短或太长的句子不适合听写
    .filter((x) => {
      const n = x.text.split(/\s+/).length;
      return n >= 3 && n <= 24 && !/[\u3400-\u9fff]/.test(x.text);
    });
  if (!list.length) throw new Error("AI 未返回有效的句子");
  return list;
}

export type FeedLevelSetting = "auto" | FeedLevel;

/** 自动难度：最近至少 3 次点评平均 ≥ 75 分、且已学 300 词以上才升到中等，否则从简单开始 */
export function feedBaseLevel(setting: FeedLevelSetting, perf: { recentScores: number[]; learned: number }): FeedLevel {
  if (setting !== "auto") return setting;
  const scores = perf.recentScores.slice(-5);
  const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  return scores.length >= 3 && avg >= 75 && perf.learned >= 300 ? "medium" : "simple";
}

/** 回复练习两个话题的难度：简单在前；手动选“简单”时两个都简单 */
export function feedTopicLevels(setting: FeedLevelSetting, base: FeedLevel): FeedLevel[] {
  if (setting === "simple") return ["simple", "simple"];
  return base === "simple" ? ["simple", "medium"] : ["medium", "medium"];
}

export interface ReadingQuestion {
  question: string;
  options: string[];
  answer: string;
  explanation: string;
}

/** 微阅读：一篇小短文 + 理解题 */
export interface Reading {
  /** 以新闻为素材的短文 */
  news?: NewsRef;
  title: string;
  text: string;
  textTrans: string;
  questions: ReadingQuestion[];
  usedWords: string[];
}

export function parseReading(content: string, words?: string[]): Reading {
  const r = parseRoot(content);
  const text = str(r.text);
  const allowed = words ? new Set(words.map((w) => w.toLowerCase())) : null;
  const reading: Reading = {
    title: str(r.title),
    text,
    textTrans: str(r.textTrans),
    questions: objList(r.questions)
      .map((q) => ({ question: str(q.question), options: strList(q.options), answer: str(q.answer), explanation: str(q.explanation) }))
      .filter((q) => q.question && q.options.length >= 2 && q.options.includes(q.answer)),
    usedWords: strList(r.usedWords).filter((w) => (!allowed || allowed.has(w.toLowerCase())) && usesWord(text, w)),
  };
  if (!reading.text) throw new Error("AI 未返回有效的短文");
  return reading;
}

export type WordTipKind = "collocation" | "confusable" | "origin" | "usage";

/** 词汇小知识 */
export interface WordTip {
  word: string;
  kind: WordTipKind;
  title: string;
  tip: string;
  example: string;
  exampleTrans: string;
}

const TIP_KINDS = new Set(["collocation", "confusable", "origin", "usage"]);

export function parseWordTips(content: string): WordTip[] {
  const tips = objList(parseRoot(content).tips)
    .map((n) => ({
      word: str(n.word),
      kind: (TIP_KINDS.has(str(n.kind)) ? str(n.kind) : "usage") as WordTipKind,
      title: str(n.title),
      tip: str(n.tip),
      example: str(n.example),
      exampleTrans: str(n.exampleTrans),
    }))
    .filter((t) => t.word && t.tip);
  if (!tips.length) throw new Error("AI 未返回有效的小知识");
  return tips;
}

/** 推荐词是否已出现在回答中（忽略大小写，允许常见词形变化：-s / -ed / -ing / -ly 等） */
export function usesWord(answer: string, word: string): boolean {
  const text = answer.toLowerCase();
  const w = word.toLowerCase().trim();
  if (!w) return false;
  const stem = w.length > 4 ? w.replace(/(ing|ed|es|ly|e|y|s)$/, "") : w;
  const re = new RegExp(`(^|[^a-z])${stem.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/ /g, "\\s+")}[a-z]{0,4}($|[^a-z])`);
  return re.test(text);
}

export interface AiPreset {
  id: string;
  name: string;
  /** 分组显示：国内 / 国际 */
  region: "cn" | "global";
  baseUrl: string;
  /** 默认模型：各家便宜且快的型号；可在设置里“获取模型列表”换成别的 */
  model: string;
  /** 调用方式：OpenAI 兼容的 /chat/completions（默认），或 Anthropic 官方 SDK（Claude） */
  protocol?: "openai" | "anthropic";
  /** 该服务 / 默认模型不接受 temperature（如 OpenAI 的推理模型） */
  noTemperature?: boolean;
  /** 额外的请求参数（如关闭思考以提速） */
  extraBody?: Record<string, unknown>;
}

/**
 * 常见的模型服务（均已确认允许浏览器跨域调用：国内外各家的 /chat/completions 预检均通过；
 * 腾讯混元的预检返回 404，浏览器无法直连，未列入）。
 */
export const AI_PRESETS: AiPreset[] = [
  { id: "qwen-maas", region: "cn", name: "千问（maas.qianwenaiapi.com）", baseUrl: "https://maas.qianwenaiapi.com/compatible-mode/v1", model: "qwen-flash" },
  { id: "qwen", region: "cn", name: "通义千问（阿里云百炼）", baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1", model: "qwen-flash" },
  { id: "deepseek", region: "cn", name: "DeepSeek", baseUrl: "https://api.deepseek.com", model: "deepseek-chat" },
  { id: "doubao", region: "cn", name: "豆包（火山方舟）", baseUrl: "https://ark.cn-beijing.volces.com/api/v3", model: "doubao-seed-1-6-flash-250615", extraBody: { thinking: { type: "disabled" } } },
  { id: "zhipu", region: "cn", name: "智谱 GLM", baseUrl: "https://open.bigmodel.cn/api/paas/v4", model: "glm-4-flash" },
  { id: "moonshot", region: "cn", name: "Kimi（Moonshot）", baseUrl: "https://api.moonshot.cn/v1", model: "moonshot-v1-8k" },
  { id: "qianfan", region: "cn", name: "文心（百度千帆）", baseUrl: "https://qianfan.baidubce.com/v2", model: "ernie-4.5-turbo-128k" },
  { id: "minimax", region: "cn", name: "MiniMax", baseUrl: "https://api.minimaxi.com/v1", model: "MiniMax-Text-01" },
  { id: "stepfun", region: "cn", name: "阶跃星辰", baseUrl: "https://api.stepfun.com/v1", model: "step-2-mini" },
  { id: "siliconflow", region: "cn", name: "硅基流动（多家开源模型）", baseUrl: "https://api.siliconflow.cn/v1", model: "deepseek-ai/DeepSeek-V3" },
  { id: "openai", region: "global", name: "ChatGPT（OpenAI）", baseUrl: "https://api.openai.com/v1", model: "gpt-5-mini", noTemperature: true, extraBody: { reasoning_effort: "minimal" } },
  { id: "anthropic", region: "global", name: "Claude（Anthropic）", baseUrl: "https://api.anthropic.com", model: "claude-opus-5-5", protocol: "anthropic", noTemperature: true },
  { id: "gemini", region: "global", name: "Gemini（Google）", baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai", model: "gemini-2.5-flash", extraBody: { reasoning_effort: "none" } },
  { id: "xai", region: "global", name: "Grok（xAI）", baseUrl: "https://api.x.ai/v1", model: "grok-4-fast-non-reasoning" },
  { id: "mistral", region: "global", name: "Mistral", baseUrl: "https://api.mistral.ai/v1", model: "mistral-small-latest" },
  { id: "groq", region: "global", name: "Groq（开源模型，极快）", baseUrl: "https://api.groq.com/openai/v1", model: "llama-3.3-70b-versatile" },
  { id: "openrouter", region: "global", name: "OpenRouter（一个 Key 用各家模型）", baseUrl: "https://openrouter.ai/api/v1", model: "google/gemini-2.5-flash" },
];

export function findPreset(id: string): AiPreset | undefined {
  return AI_PRESETS.find((p) => p.id === id);
}

/** 部分模型会把推理过程放在 <think> 标签里，取 JSON 前去掉 */
export function stripThinking(content: string): string {
  return content.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
}

/** 千问 3 系列混合推理模型默认可能开启思考，出题 / 点评不需要，关闭可大幅提速 */
export function isQwenEndpoint(baseUrl: string): boolean {
  return /qianwen|dashscope|aliyuncs/i.test(baseUrl);
}

/** 从模型列表里挑一个又快又便宜的：flash > turbo > mini / lite > plus，排除视觉、语音、向量等专用模型 */
export function pickFastModel(models: string[]): string | undefined {
  const text = models.filter((m) => !/(vl|omni|audio|tts|asr|embed|image|coder|math|ocr|rerank|realtime|thinking|mt-|translate|character|speech|s2s)/i.test(m));
  const rank = (m: string) => {
    const base = /flash/i.test(m) ? 0 : /turbo/i.test(m) ? 1 : /(mini|lite|nano|air)/i.test(m) ? 2 : /plus/i.test(m) ? 3 : 4;
    // 同档优先不带日期快照的别名（如 qwen-flash 而不是 qwen-flash-2025-07-28）
    return base * 10 + (/\d{4}-\d{2}-\d{2}|\d{8}/.test(m) ? 1 : 0);
  };
  return [...text].sort((a, b) => rank(a) - rank(b) || a.length - b.length)[0];
}

export type WordPartType = "prefix" | "root" | "suffix";

export interface WordPart {
  text: string;
  type: WordPartType;
  meaning: string;
}

const PART_TYPES = new Set<string>(["prefix", "root", "suffix"]);

/**
 * 把模型给的片段对齐到原词上：模型常把词根写成原形（believe 而不是 believ），
 * 逐段取“与原词剩余部分的最长公共前缀”（至少 2 个字母，单字母片段只要求相同），最后一段必须用完剩余字母。
 */
function alignParts(word: string, parts: WordPart[]): WordPart[] | null {
  const lower = word.toLowerCase();
  let pos = 0;
  const out: WordPart[] = [];
  for (const [i, p] of parts.entries()) {
    const rest = lower.slice(pos);
    const t = p.text.toLowerCase();
    let n = 0;
    while (n < t.length && n < rest.length && t[n] === rest[n]) n += 1;
    if (i === parts.length - 1) n = rest.length === t.length || n >= Math.min(2, t.length) ? rest.length : 0;
    if (n < Math.min(2, t.length) || n === 0) return null;
    out.push({ ...p, text: word.slice(pos, pos + n) });
    pos += n;
  }
  return pos === word.length ? out : null;
}

/**
 * 解析构词拆分：按输入单词逐个返回 parts；拼不回原词、少于两部分或缺少含义的视为不可拆（空数组）。
 */
export function parseWordParts(content: string, words: string[]): Record<string, WordPart[]> {
  const list = items(content, "words");
  const out: Record<string, WordPart[]> = {};
  for (const word of words) {
    const n = list.find((x) => str(x.word).toLowerCase() === word.toLowerCase());
    const parts = (Array.isArray(n?.parts) ? (n.parts as Record<string, unknown>[]) : []).map((p) => ({ text: str(p.text), type: str(p.type) as WordPartType, meaning: str(p.meaning) }));
    const valid = parts.length >= 2 && parts.every((p) => p.text && p.meaning && PART_TYPES.has(p.type));
    out[word] = (valid && alignParts(word, parts)) || [];
  }
  return out;
}

export interface ExtractedWord {
  word: string;
  phonetic: string;
  meanings: string[];
  /** 原文中含有该词的句子（没对上原文时为空） */
  example: string;
  exampleTrans: string;
}

/** 解析“粘贴即学”挑出的词：去重；例句必须真的用到这个词，否则不要例句 */
export function parseExtracted(content: string): ExtractedWord[] {
  const seen = new Set<string>();
  const out: ExtractedWord[] = [];
  for (const n of items(content, "words")) {
    const word = str(n.word);
    const meanings = (Array.isArray(n.meanings) ? n.meanings : []).map(str).filter(Boolean).slice(0, 2);
    if (!word || !meanings.length || seen.has(word.toLowerCase()) || word.split(/\s+/).length > 4) continue;
    seen.add(word.toLowerCase());
    const example = str(n.example);
    const ok = example && usesWord(example, word.split(" ")[0]!);
    out.push({ word, phonetic: str(n.phonetic).replace(/^\/|\/$/g, ""), meanings, example: ok ? example : "", exampleTrans: ok ? str(n.exampleTrans) : "" });
  }
  if (!out.length) throw new Error("AI 未返回可学的词");
  return out.slice(0, 15);
}

export interface NewsBrief {
  title: string;
  text: string;
  translation: string;
  /** 正文中实际用到的本组单词（按输入原词） */
  usedWords: string[];
}

/** 解析热点短读；usedWords 按正文重新核对（模型常虚报） */
export function parseNewsBrief(content: string, words: string[]): NewsBrief {
  let root: Record<string, unknown>;
  try {
    root = JSON.parse(content.replace(/^\s*```(?:json)?\s*|\s*```\s*$/g, "")) as Record<string, unknown>;
  } catch {
    throw new Error("AI 返回内容无法解析");
  }
  const text = str(root.text);
  if (text.split(/\s+/).length < 40) throw new Error("AI 未返回有效的短讯");
  return { title: str(root.title), text, translation: str(root.translation), usedWords: words.filter((w) => usesWord(text, w)) };
}

/** 解析拼写讲解：一句话，过长视为无效 */
export function parseSpellingTip(content: string): string {
  let root: Record<string, unknown>;
  try {
    root = JSON.parse(content.replace(/^\s*```(?:json)?\s*|\s*```\s*$/g, "")) as Record<string, unknown>;
  } catch {
    throw new Error("AI 返回内容无法解析");
  }
  const tip = str(root.tip);
  if (!tip || tip.length > 120) throw new Error("AI 未返回有效的讲解");
  return tip;
}

/**
 * 对用户显示的分数：AI 内部按 0～100 打分，显示为 5～10 分（保留一位小数），避免低分带来挫败感；
 * 跑题或内容无法识别时返回 null（显示“无评分”）。
 */
export function displayScore(score: number | null | undefined, offTopic = false): number | null {
  if (offTopic || score === null || score === undefined || !Number.isFinite(score)) return null;
  const s = Math.min(100, Math.max(0, score));
  return Math.round((5 + s / 20) * 10) / 10;
}

/** 0～10 的分项分数同样显示为 5～10 */
export function displaySubScore(score: number): number {
  return Math.round((5 + Math.min(10, Math.max(0, score)) / 2) * 10) / 10;
}
