import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Alert, Button, Input } from "tdesign-react";
import { useSettings } from "../context/settings";
import { useSync } from "../context/sync";
import { ApiError, auth } from "../services/api";

/** 邮件中的验证链接：/verify-email?token=… */
export function VerifyEmailPage() {
  const { t } = useSettings();
  const { session } = useSync();
  const [params] = useSearchParams();
  const [result, setResult] = useState<"pending" | "ok" | "fail">("pending");
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    auth
      .verifyEmail(params.get("token") ?? "")
      .then(() => setResult("ok"))
      .catch(() => setResult("fail"));
  }, [params]);

  useEffect(() => {
    if (result === "ok" && session) void auth.refreshUser().catch(() => undefined);
  }, [result, session]);

  return (
    <main className="page narrow">
      <h1>{t("account.title")}</h1>
      {result === "pending" && <p>{t("account.verifying")}</p>}
      {result === "ok" && <Alert theme="success" message={t("account.verifyOk")} />}
      {result === "fail" && <Alert theme="error" message={t("account.verifyFail")} />}
      <p>
        <Link to="/">Wreadt →</Link>
      </p>
    </main>
  );
}

/** 邮件中的重置密码链接：/reset-password?token=… */
export function ResetPasswordPage() {
  const { t } = useSettings();
  const [params] = useSearchParams();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ theme: "error" | "success"; text: string } | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await auth.resetPassword(params.get("token") ?? "", password);
      setMessage({ theme: "success", text: t("account.resetOk") });
    } catch (err) {
      setMessage({ theme: "error", text: err instanceof ApiError ? err.message : String(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="page narrow">
      <h1>{t("account.resetTitle")}</h1>
      <form className="panel auth-form" onSubmit={submit}>
        <Input type="password" value={password} onChange={(v) => setPassword(String(v))} placeholder={t("account.newPassword")} aria-label={t("account.newPassword")} autocomplete="new-password" />
        {message && <Alert theme={message.theme} message={message.text} />}
        {message?.theme === "success" ? (
          <Link to="/account">{t("account.back")} →</Link>
        ) : (
          <Button type="submit" theme="primary" block loading={busy} disabled={password.length < 8}>
            {t("account.submit")}
          </Button>
        )}
      </form>
    </main>
  );
}
