import { Button, Popup, Slider } from "tdesign-react";
import { AdjustmentIcon, SoundMute1Icon } from "tdesign-icons-react";
import { useSettings } from "../context/settings";

/** 发音音量的快捷调节：点开是一个小滑块，与设置页的“发音音量”是同一个值，作用于所有朗读 */
export default function VolumeControl({ size = "small", onClose }: { size?: "small" | "medium"; /** 关闭后（如打字页把焦点还给输入） */ onClose?: () => void }) {
  const { t, settings, update } = useSettings();
  const v = settings.voiceVolume;
  return (
    <Popup
      trigger="click"
      placement="top"
      showArrow
      onVisibleChange={(visible) => !visible && onClose?.()}
      content={
        <div className="volume-popup" onClick={(e) => e.stopPropagation()}>
          <span className="muted">{t("settings.voiceVolume")}</span>
          <Slider value={v} min={0} max={100} onChange={(x) => void update("voiceVolume", Number(x))} style={{ width: 140 }} />
          <span className="volume-value">{v}</span>
        </div>
      }
    >
      <Button
        size={size}
        variant="text"
        shape="square"
        icon={v === 0 ? <SoundMute1Icon /> : <AdjustmentIcon />}
        aria-label={t("settings.voiceVolume")}
        title={`${t("settings.voiceVolume")} ${v}`}
        onClick={(e) => e.stopPropagation()}
      />
    </Popup>
  );
}
