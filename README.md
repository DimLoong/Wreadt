<img width="200" height="200" alt="Wreadt-Logo-20260203-o" src="https://github.com/user-attachments/assets/6b480dc1-4ec1-4337-9be1-65d534d5096b" />

# Wreadt

Multi-platform language learning software.

### Intro

This is not Weird, this is Wreadt, Write + Read. Support Web, iOS, Android, Windows, and MacOS.

Of cause we have the [qwerty](https://github.com/RealKai42/qwerty-learner) to learn multiple languages on desktop, but how can we sync our progress on mobile?
Wreadt will solve the problem.

### Background

Wreadt将着重解决这些用户痛点

1. **多端不同步**
   总有人在桌面端学习后，想随时随地在移动端继续进度，但市面大多软件不支持多端，因为开源的项目不提供服务器，商业项目多只支持移动端
   
2. **支持选取特定行业词，而不是缓慢的全面进步**
   对于某些需求学习语言的人，并不希望以缓慢的方式全面学习词汇，当学习者已经了解了语言基础，他们可能希望快速学习某专业领域常用词+术语，
   再并行学习全面的词汇，Wreadt将支持用户选择某专业领域的词汇术语进行学习
   
3. **办公友好**
   Wreadt将支持给出多个伪装的页面，包含word/excel/vscode/idea等软件的伪装学习页面，这样你可以大大方方学习了，不用担心谁在窥视你

4. **曲线复习**
   Wreadt将支持艾宾浩斯遗忘曲线渐进式学习

5. **成绩和社交**
   没有人拒绝一个可爱的、成就感可视化的反馈，Wreadt将支持一些拼图可视化地让用户了解他们到底处于什么进度

6. **支持便捷快速的自增词库**
   总有些我们单独记录的短语、词汇逐渐遗忘，现在你可以加入它们到Wreadt以随时复习
   也许可以开放用户授权，去根据用户所记录的词/所选的职业行业，推送用户可能感兴趣的词

7. **支持造句练习**
   通过Ai生成一些近期学习的词汇的题目，例如完形填空，特殊/高频用法示例，错误用法示例，以快速掌握和应用所学词汇

8. **语法训练**
   词汇很重要，但语法也非常重要，在单词例句中加入语法内容、语法提示

### Main technology stack
Web: React, TypeScript

iOS / Android: React Native, TypeScript

Windows / macOS: Tauri, React

UI Design System: TDesign (RIP to ArcoDesign)

### Just Noted
1. 在错误拼写多次的时候，应该给出一些字母的提示
2. 对于动画，应考虑Rive
3. 对于日语的片假名，尤其是外来词，应当给出对应的英文单词和翻译 

### Handover (2026-02-11)
- 当前权威任务文件：`tasklist-20260211-1.json`
- 本轮扩展拆解：`tasklist-20260211-2.json`（用于把 E1~E4 拆分为可并行执行项）
- 文档状态同步：`AGENTS.json` 已更新 authority 与 implemented/pending
- 环境说明：当前终端缺少 `pnpm`，测试建议在 CI 或统一开发环境执行
