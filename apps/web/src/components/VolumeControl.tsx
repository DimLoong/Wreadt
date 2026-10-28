import { Button, Popup, Slider } from "tdesign-react";
import { SoundHighIcon, SoundIcon, SoundLowIcon, SoundMute1Icon } from "tdesign-icons-react";

/** 音量图标随音量变化：静音 / 小 / 中 / 大 */
function VolumeIcon({ volume }: { volume: number }) {
  if (volume === 0) return <SoundMute1Icon />;
  if (volume <= 33) return <SoundLowIcon />;
  if (volume <= 66) return <SoundIcon />;
  return <SoundHighIcon />;
}
import { useSettings } from "../context/settings";

/** 发音音量的快捷调节：点开是一个小滑块，与设置页的“发音音量”是同一个值，作用于所有朗读 */
export default function VolumeControl({
  size = "small",
  segment = false,
  onClose,
}: {
  size?: "small" | "medium";
  /** 作为发音胶囊里的一段显示（打字页） */
  segment?: boolean;
  /** 关闭后（如打字页把焦点还给输入） */
  onClose?: () => void;
}) {
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
      {segment ? (
        <button type="button" className="accent-volume" aria-label={t("settings.voiceVolume")} title={`${t("settings.voiceVolume")} ${v}`} onClick={(e) => e.stopPropagation()}>
          <VolumeIcon volume={v} />
        </button>
      ) : (
      <Button
        size={size}
        variant="text"
        shape="square"
        icon={<VolumeIcon volume={v} />}
        aria-label={t("settings.voiceVolume")}
        title={`${t("settings.voiceVolume")} ${v}`}
        onClick={(e) => e.stopPropagation()}
      />
      )}
    </Popup>
  );
}
