import { useEffect, useState, type KeyboardEvent } from "react";
import { Link } from "react-router-dom";
import { Card, Loading } from "tdesign-react";
import { usesWord, type Example, type Phrase, type WordItem } from "@wreadt/core";
import { useSettings } from "../../context/settings";
import { aiSource, generateWordExtras } from "../../services/ai";

/** 停留这么久才开始请求，快速跳词时不为每个词发请求 */
const FETCH_DELAY_MS = 300;

type Extras = { status: "idle" | "loading" | "noAi" | "error"; message?: string } | { status: "ready"; examples: Example[]; phrases: Phrase[] };

interface Props {
  word: WordItem;
  /** 拼写正确后才显示；内容在打开单词时就开始后台获取 */
  visible: boolean;
  /** 填完例句填空后回到打字 */
  onBackToTyping?: () => void;
}

/** 短语 / 例句卡片：词库自带例句 + AI 自动生成的短语与例句 */
export default function DetailCards({ word, visible, onBackToTyping }: Props) {
  const { settings, t } = useSettings();
  const [extras, setExtras] = useState<Extras>({ status: "idle" });

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      if (!(await aiSource())) {
        if (!cancelled) setExtras({ status: "noAi" });
        return;
      }
      if (!cancelled) setExtras({ status: "loading" });
      try {
        const result = await generateWordExtras(word.lang, word.lang === "ja" ? word.display : word.answer, settings.locale);
        if (!cancelled) setExtras({ status: "ready", ...result });
      } catch (err) {
        if (!cancelled) setExtras({ status: "error", message: (err as Error).message });
      }
    }, FETCH_DELAY_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [word.id, word.lang, word.display, word.answer, settings.locale]);

  const examples = [...(word.examples ?? []), ...(extras.status === "ready" ? extras.examples : [])];
  // 用最后一条带翻译的例句出中译英（英文单词才出）
  const translateSource = word.lang === "en" ? [...examples].reverse().find((ex) => ex.translation && usesWord(ex.sentence, word.answer.split(" ")[0]!)) : undefined;
  const phrases = extras.status === "ready" ? extras.phrases : [];

  const placeholder =
    extras.status === "loading" || extras.status === "idle" ? (
      <Loading size="small" />
    ) : extras.status === "noAi" ? (
      <p className="muted detail-empty">
        {t("typing.extrasNoAi")} <Link to="/settings?tab=ai">{t("ai.configure")} →</Link>
      </p>
    ) : (
      <p className="muted detail-empty">{extras.status === "error" ? extras.message : t("typing.noneYet")}</p>
    );

  return (
    // 始终占位、拼写正确后淡入：布局不跳动；内容在打开单词时就在后台准备好
    <div className={`detail-cards ${visible ? "shown" : ""}`} aria-hidden={!visible} inert={!visible} onClick={(e) => e.stopPropagation()}>
      <Card title={t("typing.phrases")} bordered={false} size="small" className="detail-card">
        <div className="detail-scroll">
          {phrases.length ? (
            <ul className="detail-list">
              {phrases.map((p) => (
                <li key={p.phrase}>
                  <span className="primary">{p.phrase}</span>
                  <span className="secondary">{p.meaning}</span>
                </li>
              ))}
            </ul>
          ) : (
            placeholder
          )}
        </div>
      </Card>
      <Card title={t("typing.examplesTitle")} bordered={false} size="small" className="detail-card">
        <div className="detail-scroll">
          {examples.length ? (
            <ul className="detail-list">
              {/* 第一条是中译英：格式和例句一样，英文那一行是下划线，直接在这里写 */}
              {translateSource && <TranslateExample key={translateSource.sentence} word={word.answer} example={translateSource} onDone={onBackToTyping} />}
              {examples.filter((ex) => ex !== translateSource).map((ex) => (
                <li key={ex.sentence}>
                  <span className="primary" lang={word.lang}>
                    {ex.sentence}
                  </span>
                  {ex.translation && <span className="secondary">{ex.translation}</span>}
                </li>
              ))}
            </ul>
          ) : (
            placeholder
          )}
        </div>
      </Card>
    </div>
  );
}

/** 例句中译英：给出中文，在下划线上写出整句英文（用上这个词），Enter 检查并显示参考句，再按 Enter 回到打字 */
function TranslateExample({ word, example, onDone }: { word: string; example: Example; onDone?: () => void }) {
  const { t } = useSettings();
  const [value, setValue] = useState("");
  const [checked, setChecked] = useState(false);
  const used = usesWord(value, word.split(" ")[0]!);

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    // 不让按键冒泡到打字区（那里按任意键会进入下一个词）
    e.stopPropagation();
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (checked) return onDone?.();
    if (value.trim()) setChecked(true);
  };

  return (
    <li className={`detail-translate ${checked ? (used ? "ok" : "bad") : ""}`}>
      <input
        className="detail-translate-input primary"
        lang="en"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKeyDown}
        readOnly={checked}
        placeholder={t("typing.translateExample", { word })}
        autoComplete="off"
        spellCheck={false}
      />
      <span className="secondary">{example.translation}</span>
      {checked && (
        <span className="detail-translate-ref">
          {used ? t("typing.translateUsed") : t("typing.translateMissing", { word })} {t("cards.reference")}
          <span lang="en">{example.sentence}</span>
        </span>
      )}
    </li>
  );
}
