import { Select } from "tdesign-react";
import { useLiveQuery } from "dexie-react-hooks";
import { DICTIONARIES, customDictMeta, type DictCategory } from "@wreadt/core";
import { db } from "../store/db";
import { useSettings } from "../context/settings";
import type { MessageKey } from "../i18n/messages";

const GROUPS: DictCategory[] = ["exam", "industry", "jlpt", "custom"];

export default function DictSelect() {
  const { settings, update, t } = useSettings();
  const customCounts = useLiveQuery(async () => {
    const rows = await db.customWords.toArray();
    const live = rows.filter((w) => !w.deleted);
    return { en: live.filter((w) => w.lang === "en").length, ja: live.filter((w) => w.lang === "ja").length };
  }, []);

  const dicts = [...DICTIONARIES, customDictMeta("en", customCounts?.en ?? 0), customDictMeta("ja", customCounts?.ja ?? 0)];

  return (
    <Select
      className="dict-select"
      value={settings.dictId}
      onChange={(v) => void update("dictId", String(v))}
      borderless
      autoWidth
      popupProps={{ overlayInnerStyle: { maxHeight: 420 } }}
    >
      {GROUPS.map((group) => (
        <Select.OptionGroup key={group} label={t(`dict.${group}` as MessageKey)}>
          {dicts
            .filter((d) => d.category === group)
            .map((d) => (
              <Select.Option
                key={d.id}
                value={d.id}
                label={d.name}
                disabled={d.category === "custom" && d.size === 0 && d.id !== settings.dictId}
              >
                <span className="dict-option">
                  <span>{d.name}</span>
                  <span className="muted">{t("dict.words", { count: d.size })}</span>
                </span>
              </Select.Option>
            ))}
        </Select.OptionGroup>
      ))}
    </Select>
  );
}
