import { Select } from "tdesign-react";
import type { DictCategory } from "@wreadt/core";
import { useSettings } from "../context/settings";
import { useDictMetas } from "../hooks/useDictMetas";
import type { MessageKey } from "../i18n/messages";

const GROUPS: DictCategory[] = ["user", "custom", "topic", "role", "exam", "industry", "jlpt"];

/** 词库多选：选中的词库合并学习，重复的词只出现一次 */
/** open / onOpenChange 由外层保存：选择后打字区会按新词库重建，受控的展开状态保证多选时下拉不被收起 */
export default function DictSelect({ open, onOpenChange }: { open?: boolean; onOpenChange?: (open: boolean) => void }) {
  const { settings, update, t } = useSettings();
  const { metas: dicts } = useDictMetas();

  return (
    <Select
      className="dict-select"
      multiple
      minCollapsedNum={3}
      popupVisible={open}
      onPopupVisibleChange={(visible) => onOpenChange?.(visible)}
      value={settings.dictIds}
      onChange={(v) => {
        const ids = (v as string[]).filter(Boolean);
        if (ids.length) void update("dictIds", ids);
      }}
      borderless
      autoWidth
      popupProps={{ overlayInnerStyle: { maxHeight: 460 } }}
    >
      {GROUPS.filter((g) => dicts.some((d) => d.category === g)).map((group) => (
        <Select.OptionGroup key={group} label={t(`dict.${group}` as MessageKey)}>
          {dicts
            .filter((d) => d.category === group)
            .map((d) => (
              <Select.Option key={d.id} value={d.id} label={d.name} disabled={(d.category === "custom" || d.category === "user") && d.size === 0}>
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
