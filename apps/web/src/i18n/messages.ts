export type Locale = "zh-CN" | "en-US";

export const messages: Record<Locale, Record<string, string>> = {
  "zh-CN": {
    title: "Wreadt",
    subtitle: "输入即学习，启动即进入打字态",
    placeholder: "输入当前单词后按 Space 继续",
    phoneticPage: "音标页",
    customVocab: "自定义词库",
    sentencePractice: "造句练习",
    progressView: "学习进度",
    settings: "设置",
    replayAudio: "播放发音",
    wordCorrect: "正确",
    wordWrong: "有误",
    expandable: "扩展学习区",
    nextWord: "下一个单词",
    sentenceEntry: "直接开始造句练习",
    skipAnimation: "跳过动画",
    mastered: "你掌握了 {{count}} 个单词",
    darkMode: "深色模式",
    language: "语言",
    hintTitle: "轻提示",
  },
  "en-US": {
    title: "Wreadt",
    subtitle: "Launch-ready typing learning",
    placeholder: "Type current word, then press Space to continue",
    phoneticPage: "Phonetic Page",
    customVocab: "Custom Vocabulary",
    sentencePractice: "Sentence Practice",
    progressView: "Progress View",
    settings: "Settings",
    replayAudio: "Replay Audio",
    wordCorrect: "Correct",
    wordWrong: "Incorrect",
    expandable: "Expanded Learning",
    nextWord: "Next Word",
    sentenceEntry: "Start sentence practice now",
    skipAnimation: "Skip animation",
    mastered: "You have mastered {{count}} words",
    darkMode: "Dark mode",
    language: "Language",
    hintTitle: "Light Hint",
  },
};

export function t(locale: Locale, key: string, vars?: Record<string, string | number>): string {
  const template = messages[locale][key] ?? key;
  if (!vars) return template;
  return Object.entries(vars).reduce(
    (acc, [k, v]) => acc.replace(`{{${k}}}`, String(v)),
    template,
  );
}
