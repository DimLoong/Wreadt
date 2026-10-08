import { useSettings } from "../context/settings";

/** AI 造句练习，阶段 4 接入服务端 */
export default function SentencePracticePage() {
  const { t } = useSettings();
  return (
    <main className="page">
      <h1>{t("nav.sentence")}</h1>
    </main>
  );
}
