import { useState, type FormEvent } from "react";
import { Alert, Button, Input, Tabs, Tag } from "tdesign-react";
import { useSettings } from "../context/settings";
import { useSync } from "../context/sync";
import { ApiError, auth } from "../services/api";

function AuthForm() {
  const { t } = useSettings();
  const { login } = useSync();
  const [mode, setMode] = useState<"login" | "register" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ theme: "error" | "success"; text: string } | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      if (mode === "forgot") {
        await auth.forgotPassword(email);
        setMessage({ theme: "success", text: t("account.forgotSent") });
      } else {
        await login(email, password, mode === "register");
      }
    } catch (err) {
      setMessage({ theme: "error", text: err instanceof ApiError ? err.message : String(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="panel auth-form" onSubmit={submit}>
      {mode !== "forgot" && (
        <Tabs value={mode} onChange={(v) => setMode(v as "login" | "register")}>
          <Tabs.TabPanel value="login" label={t("account.login")} />
          <Tabs.TabPanel value="register" label={t("account.register")} />
        </Tabs>
      )}
      <Input value={email} onChange={(v) => setEmail(String(v))} placeholder={t("account.email")} aria-label={t("account.email")} autocomplete="email" />
      {mode !== "forgot" && (
        <Input
          type="password"
          value={password}
          onChange={(v) => setPassword(String(v))}
          placeholder={t("account.password")}
          aria-label={t("account.password")}
          autocomplete={mode === "register" ? "new-password" : "current-password"}
        />
      )}
      {message && <Alert theme={message.theme} message={message.text} />}
      <Button type="submit" theme="primary" block loading={busy} disabled={!email || (mode !== "forgot" && password.length < 8)}>
        {mode === "forgot" ? t("account.sendReset") : mode === "login" ? t("account.login") : t("account.register")}
      </Button>
      <Button variant="text" theme="default" onClick={() => setMode(mode === "forgot" ? "login" : "forgot")}>
        {mode === "forgot" ? t("account.back") : t("account.forgot")}
      </Button>
    </form>
  );
}

function SyncPanel() {
  const { t, settings } = useSettings();
  const { session, status, error, pending, lastSyncAt, sync, logout } = useSync();
  if (!session) return null;

  return (
    <section className="panel settings-list">
      <div className="setting-row">
        <span>
          {t("account.loggedInAs")}：<strong>{session.user.email}</strong>{" "}
          {session.user.emailVerified ? <Tag theme="success" variant="light">{t("account.verified")}</Tag> : null}
        </span>
        <Button variant="outline" onClick={() => void logout()}>
          {t("account.logout")}
        </Button>
      </div>
      {!session.user.emailVerified && <Alert theme="warning" message={t("account.unverified")} />}
      <div className="setting-row">
        <span className="muted">
          {status === "syncing"
            ? t("account.status.syncing")
            : status === "offline"
              ? t("account.status.offline")
              : status === "error"
                ? t("account.status.error", { message: error ?? "" })
                : lastSyncAt
                  ? t("account.lastSync", { time: new Date(lastSyncAt).toLocaleString(settings.locale) })
                  : t("account.neverSynced")}
          {pending > 0 && ` · ${t("account.pending", { count: pending })}`}
        </span>
        <Button theme="primary" loading={status === "syncing"} onClick={() => void sync()}>
          {t("account.syncNow")}
        </Button>
      </div>
    </section>
  );
}

export default function AccountPage() {
  const { t } = useSettings();
  const { session } = useSync();
  return (
    <main className="page narrow">
      <h1>{t("account.title")}</h1>
      <p className="muted">{t("account.desc")}</p>
      {session ? <SyncPanel /> : <AuthForm />}
    </main>
  );
}
