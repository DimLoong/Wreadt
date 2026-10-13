import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, DatePicker, Radio, Steps } from "tdesign-react";
import { DICTIONARIES, type Persona } from "@wreadt/core";
import { useSettings } from "../context/settings";
import type { MessageKey } from "../i18n/messages";

const EXAMS = ["gaokao", "cet4", "cet6", "kaoyan", "ielts", "jlpt-n5", "jlpt-n4", "jlpt-n3", "jlpt-n2", "jlpt-n1"];
const ROLES = DICTIONARIES.filter((d) => d.category === "role").map((d) => d.id);
const dictName = (id: string) => DICTIONARIES.find((d) => d.id === id)?.name ?? id;

/** 新手引导：身份 → 目标 → 摸底。按身份自动选词库与每日目标，之后可在设置中修改 */
export default function WelcomePage() {
  const { t, update } = useSettings();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [persona, setPersona] = useState<Persona>("student");
  const [exam, setExam] = useState("cet4");
  const [examDate, setExamDate] = useState<string>("");
  const [role, setRole] = useState(ROLES[0]!);
  const [minutes, setMinutes] = useState(10);
  const [selfLang, setSelfLang] = useState<"en" | "ja">("en");
  const [dailyNew, setDailyNew] = useState(15);

  const save = async () => {
    await update("persona", persona);
    if (persona === "student") {
      await update("dictIds", [exam]);
      await update("goalType", "words");
      await update("examDate", examDate || null);
      await update("examName", examDate ? dictName(exam) : null);
    } else if (persona === "worker") {
      await update("dictIds", [role]);
      await update("goalType", "minutes");
      await update("dailyMinutes", minutes);
      await update("examDate", null);
    } else {
      await update("dictIds", [selfLang === "en" ? "cet4" : "jlpt-n5"]);
      await update("goalType", "words");
      await update("dailyNew", dailyNew);
      await update("examDate", null);
    }
    await update("onboarded", true);
    setStep(2);
  };

  return (
    <main className="page narrow welcome-page">
      <h1>{t("welcome.title")}</h1>
      <Steps current={step} className="welcome-steps" readonly>
        <Steps.StepItem title={t("welcome.step.who")} />
        <Steps.StepItem title={t("welcome.step.goal")} />
        <Steps.StepItem title={t("welcome.step.placement")} />
      </Steps>

      {step === 0 && (
        <section className="panel welcome-panel">
          <p>{t("welcome.who")}</p>
          <div className="persona-options">
            {(["student", "worker", "self"] as Persona[]).map((p) => (
              <button key={p} type="button" className={`persona ${persona === p ? "active" : ""}`} onClick={() => setPersona(p)}>
                <strong>{t(`welcome.persona.${p}` as MessageKey)}</strong>
                <span className="muted">{t(`welcome.persona.${p}.desc` as MessageKey)}</span>
              </button>
            ))}
          </div>
          <Button theme="primary" onClick={() => setStep(1)}>
            {t("welcome.next")}
          </Button>
        </section>
      )}

      {step === 1 && (
        <section className="panel welcome-panel">
          {persona === "student" && (
            <>
              <p>{t("welcome.student.exam")}</p>
              <Radio.Group variant="default-filled" value={exam} onChange={(v) => setExam(String(v))} className="wrap-radio">
                {EXAMS.map((id) => (
                  <Radio.Button key={id} value={id}>
                    {dictName(id)}
                  </Radio.Button>
                ))}
              </Radio.Group>
              <p>{t("welcome.student.date")}</p>
              <DatePicker allowInput value={examDate} onChange={(v) => setExamDate(String(v ?? ""))} clearable placeholder={t("welcome.student.datePlaceholder")} disableDate={{ before: new Date().toISOString().slice(0, 10) }} />
              <p className="muted setting-tip">{t("welcome.student.tip")}</p>
            </>
          )}
          {persona === "worker" && (
            <>
              <p>{t("welcome.worker.role")}</p>
              <Radio.Group variant="default-filled" value={role} onChange={(v) => setRole(String(v))} className="wrap-radio">
                {ROLES.map((id) => (
                  <Radio.Button key={id} value={id}>
                    {dictName(id)}
                  </Radio.Button>
                ))}
                <Radio.Button value="cet4">{t("welcome.worker.general")}</Radio.Button>
              </Radio.Group>
              <p>{t("welcome.worker.minutes")}</p>
              <Radio.Group variant="default-filled" value={minutes} onChange={(v) => setMinutes(Number(v))}>
                {[5, 10, 15, 20, 30].map((m) => (
                  <Radio.Button key={m} value={m}>
                    {t("welcome.minutes", { count: m })}
                  </Radio.Button>
                ))}
              </Radio.Group>
            </>
          )}
          {persona === "self" && (
            <>
              <p>{t("welcome.self.lang")}</p>
              <Radio.Group variant="default-filled" value={selfLang} onChange={(v) => setSelfLang(v as "en" | "ja")}>
                <Radio.Button value="en">English</Radio.Button>
                <Radio.Button value="ja">日本語</Radio.Button>
              </Radio.Group>
              <p>{t("welcome.self.daily")}</p>
              <Radio.Group variant="default-filled" value={dailyNew} onChange={(v) => setDailyNew(Number(v))}>
                {[10, 15, 20, 30].map((n) => (
                  <Radio.Button key={n} value={n}>
                    {t("welcome.words", { count: n })}
                  </Radio.Button>
                ))}
              </Radio.Group>
            </>
          )}
          <div className="add-actions">
            <Button variant="outline" onClick={() => setStep(0)}>
              {t("welcome.back")}
            </Button>
            <Button theme="primary" onClick={() => void save()}>
              {t("welcome.next")}
            </Button>
          </div>
        </section>
      )}

      {step === 2 && (
        <section className="panel welcome-panel">
          <p>{t("welcome.placement")}</p>
          <div className="add-actions">
            <Button theme="primary" onClick={() => navigate("/placement")}>
              {t("placement.start")}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                void update("placementStatus", "skipped");
                navigate("/typing");
              }}
            >
              {t("placement.skip")}
            </Button>
          </div>
          <p className="muted setting-tip">{t("welcome.later")}</p>
        </section>
      )}
    </main>
  );
}
