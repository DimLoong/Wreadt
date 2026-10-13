import { useNavigate } from "react-router-dom";
import { Button } from "tdesign-react";
import { CheckRectangleIcon } from "tdesign-icons-react";
import { useSettings } from "../../context/settings";

/**
 * 新用户的摸底建议：首页顶部醒目展示，打字页在开始前提示。
 * 点“跳过”后不再出现（设置里仍可进入摸底）。
 */
export default function PlacementPrompt({ where }: { where: "home" | "typing" }) {
  const { t, update } = useSettings();
  const navigate = useNavigate();
  const skip = async () => {
    await update("placementStatus", "skipped");
    if (where === "home") navigate("/typing");
  };
  return (
    <section className={`placement-prompt ${where}`}>
      <span className="placement-prompt-icon">
        <CheckRectangleIcon />
      </span>
      <div className="placement-prompt-text">
        <strong>{t("placement.promptTitle")}</strong>
        <p>{t("placement.promptDesc")}</p>
      </div>
      <div className="placement-prompt-actions">
        <Button theme="primary" size={where === "home" ? "large" : "medium"} onClick={() => navigate("/placement")}>
          {t("placement.promptStart")}
        </Button>
        <Button variant="text" onClick={() => void skip()}>
          {where === "home" ? t("placement.promptSkipHome") : t("placement.promptSkip")}
        </Button>
      </div>
    </section>
  );
}
