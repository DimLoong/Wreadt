import { NavLink } from "react-router-dom";
import { useSettings } from "../context/settings";

/** AI 练习页的子导航：场景问答 / 造句练习 */
export default function PracticeTabs() {
  const { t } = useSettings();
  return (
    <div className="practice-tabs">
      <h1>{t("nav.practice")}</h1>
      <nav>
        <NavLink to="/scenario">{t("scenario.title")}</NavLink>
        <NavLink to="/sentence">{t("sentence.title")}</NavLink>
      </nav>
    </div>
  );
}
