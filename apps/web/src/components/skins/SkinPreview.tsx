import type { WordItem } from "@wreadt/core";
import { useSettings, type SkinDensity } from "../../context/settings";
import WordLetters from "../WordLetters";
import HotkeyBar from "../typing/HotkeyBar";
import WordSkin from "./WordSkin";
import ExcelSkin from "./ExcelSkin";
import CodeSkin from "./CodeSkin";

const SKINS = { word: WordSkin, excel: ExcelSkin, vscode: CodeSkin } as const;

const SAMPLE: WordItem = {
  id: "en:deadline",
  dictId: "preview",
  lang: "en",
  display: "deadline",
  answer: "deadline",
  phonetic: "ˈdedlaɪn",
  meanings: ["n. 截止日期；最后期限"],
};

const noop = () => undefined;

/** 设置页里的伪装皮肤缩略预览：按真实尺寸渲染后缩小显示，随皮肤与内容密度实时变化 */
export default function SkinPreview({ skin, density }: { skin: keyof typeof SKINS; density: SkinDensity }) {
  const { settings, t } = useSettings();
  const Skin = SKINS[skin];
  const typed = "dead";
  return (
    <div className="skin-preview" aria-hidden inert>
      <div className="skin-preview-frame">
        <Skin
          word={SAMPLE}
          typed={typed}
          state="typing"
          sub={`/${SAMPLE.phonetic}/`}
          meaning={SAMPLE.meanings.join("；")}
          feedback=""
          ok={false}
          index={3}
          stats={{ seconds: 95, wpm: 32, keystrokes: 41, correct: 3, done: 4, accuracy: 94, current: 4, total: settings.batchSize }}
          hotkeys={
            <HotkeyBar
              items={[
                { id: "peek", keys: "Tab", label: t("hotkey.peek"), onClick: noop },
                { id: "prev", keys: "←↑", label: t("typing.prev"), onClick: noop },
                { id: "next", keys: "→↓", label: t("typing.next"), onClick: noop },
                { id: "known", keys: "Ctrl/⌘+Enter", label: t("typing.known"), onClick: noop },
                { id: "exit", keys: "Esc Esc", label: t("hotkey.exitDisguise"), onClick: noop },
              ]}
            />
          }
          density={density}
          lettersEl={<WordLetters answer={SAMPLE.answer} typed={typed} wrongChar={null} hidden={settings.typingMode === "dictation"} revealed={0} plainSpace />}
          onMenu={() => undefined}
          onExit={() => undefined}
        />
      </div>
    </div>
  );
}
