import { Button, CheckTag, Tooltip } from "tdesign-react";
import { BookmarkAddIcon, BookmarkCheckedFilledIcon } from "tdesign-icons-react";
import { MARK_REASONS, type Mark, type MarkReason, type WordItem } from "@wreadt/core";
import { useSettings } from "../../context/settings";
import { setMarkReason, toggleMark } from "../../store/repo";
import type { MessageKey } from "../../i18n/messages";

interface Props {
  word: WordItem;
  mark?: Mark;
  /** 显示原因选择（打字页在 mark 后显示） */
  showReasons?: boolean;
  onDone?: () => void;
}

/** mark 按钮（Ctrl+M）+ 可选原因；原因可以不选 */
export default function MarkControl({ word, mark, showReasons = true, onDone }: Props) {
  const { t } = useSettings();
  const pick = (reason: MarkReason) => {
    void setMarkReason(word.id, mark?.reason === reason ? undefined : reason);
    onDone?.();
  };

  return (
    <div className="mark-control" onClick={(e) => e.stopPropagation()}>
      <Tooltip content={`${mark ? t("marks.unmark") : t("marks.mark")} (Ctrl+M)`}>
        <Button
          variant="text"
          shape="circle"
          theme={mark ? "warning" : "default"}
          icon={mark ? <BookmarkCheckedFilledIcon /> : <BookmarkAddIcon />}
          aria-label={mark ? t("marks.unmark") : t("marks.mark")}
          aria-pressed={Boolean(mark)}
          onClick={() => {
            void toggleMark(word);
            onDone?.();
          }}
        />
      </Tooltip>
      {mark && showReasons && (
        <div className="mark-reasons">
          {MARK_REASONS.map((r) => (
            <CheckTag key={r} size="small" checked={mark.reason === r} onChange={() => pick(r)}>
              {t(`marks.reason.${r}` as MessageKey)}
            </CheckTag>
          ))}
        </div>
      )}
    </div>
  );
}
