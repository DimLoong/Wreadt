export interface HotkeyItem {
  id: string;
  keys: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  /** 已生效（如当前词已标为已会） */
  active?: boolean;
  title?: string;
}

/**
 * 快捷键说明本身就是按钮：看得到的提示都能直接点。
 * 按下时不抢焦点（preventDefault），点完键盘输入仍落在打字区。
 */
export default function HotkeyBar({ items, className = "" }: { items: HotkeyItem[]; className?: string }) {
  return (
    <span className={`hotkey-bar ${className}`}>
      {items.map((h) => (
        <button
          key={h.id}
          type="button"
          className={`hotkey-btn ${h.active ? "active" : ""}`}
          disabled={h.disabled}
          title={h.title}
          aria-pressed={h.active}
          onMouseDown={(e) => e.preventDefault()}
          onClick={(e) => {
            e.stopPropagation();
            h.onClick();
          }}
        >
          <kbd>{h.keys}</kbd>
          {h.label}
        </button>
      ))}
    </span>
  );
}
