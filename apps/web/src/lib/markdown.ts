/** 去掉模型偶尔输出的 Markdown 标记（**粗体**、`代码`、*斜体*），粗体部分视为强调词 */
export function stripMarkdown(text: string): { text: string; emphasized: string[] } {
  const emphasized: string[] = [];
  const plain = text
    .replace(/\*\*([^*]+)\*\*/g, (_, w: string) => {
      emphasized.push(w.trim());
      return w;
    })
    .replace(/__([^_]+)__/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/(^|\s)\*([^*\s][^*]*)\*/g, "$1$2");
  return { text: plain, emphasized };
}
