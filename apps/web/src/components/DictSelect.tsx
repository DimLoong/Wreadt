import { Select } from "tdesign-react";
import { useLiveQuery } from "dexie-react-hooks";
import { DICTIONARIES, customDictMeta, type DictCategory } from "@wreadt/core";
import { db } from "../store/db";
import { useSettings } from "../context/settings";
import type { MessageKey } from "../i18n/messages";

const GROUPS: DictCategory[] = ["role", "exam", "industry", "jlpt", "custom"];

/** 词库多选：选中的词库合并学习，重复的词只出现一次 */
export default function DictSelect() {
  const { settings, update, t } = useSettings();
  const customCounts = useLiveQuery(async () => {
    const live = (await db.customWords.toArray()).filter((w) => !w.deleted);
    return { en: live.filter((w) => w.lang === "en").length, ja: live.filter((w) => w.lang === "ja").length };
  }, []);

  const dicts = [...DICTIONARIES, customDictMeta("en", customCounts?.en ?? 0), customDictMeta("ja", customCounts?.ja ?? 0)];

  return (
    <Select
      className="dict-select"
      multiple
      minCollapsedNum={3}
      value={settings.dictIds}
      onChange={(v) => {
        const ids = (v as string[]).filter(Boolean);
        if (ids.length) void update("dictIds", ids);
      }}
      borderless
      autoWidth
      popupProps={{ overlayInnerStyle: { maxHeight: 460 } }}
    >
      {GROUPS.map((group) => (
        <Select.OptionGroup key={group} label={t(`dict.${group}` as MessageKey)}>
          {dicts
            .filter((d) => d.category === group)
            .map((d) => (
              <Select.Option key={d.id} value={d.id} label={d.name} disabled={d.category === "custom" && d.size === 0}>
                <span className="dict-option">
                  <span>{d.name}</span>
                  <span className="muted">{d.size ? t("dict.words", { count: d.size }) : ""}</span>
                </span>
              </Select.Option>
            ))}
        </Select.OptionGroup>
      ))}
    </Select>
  );
}
