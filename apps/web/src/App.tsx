import { lazy, Suspense } from "react";
import { Navigate, NavLink, Route, Routes, useLocation } from "react-router-dom";
import Home from "./pages/Home";
import { useSettings } from "./context/settings";
import { useFocusMode } from "./context/focus";
import { useSync } from "./context/sync";
import type { MessageKey } from "./i18n/messages";

const PhoneticPage = lazy(() => import("./pages/PhoneticPage"));
const CustomVocabPage = lazy(() => import("./pages/CustomVocabPage"));
const SentencePracticePage = lazy(() => import("./pages/SentencePracticePage"));
const ProgressPage = lazy(() => import("./pages/ProgressPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const AccountPage = lazy(() => import("./pages/AccountPage"));
const AddWordsPage = lazy(() => import("./pages/AddWordsPage"));
const VerifyEmailPage = lazy(() => import("./pages/EmailLinkPage").then((m) => ({ default: m.VerifyEmailPage })));
const ResetPasswordPage = lazy(() => import("./pages/EmailLinkPage").then((m) => ({ default: m.ResetPasswordPage })));

const NAV: [to: string, key: MessageKey][] = [
  ["/progress", "nav.progress"],
  ["/vocabulary", "nav.custom"],
  ["/phonetic", "nav.phonetic"],
  ["/sentence", "nav.sentence"],
  ["/settings", "nav.settings"],
];

export default function App() {
  const { ready, t, settings } = useSettings();
  const { pathname } = useLocation();
  const { focused } = useFocusMode();
  const { session, status, pending } = useSync();
  if (!ready) return null;

  return (
    <div className="app">
      <header className={`app-nav ${focused ? "faded" : ""}`} hidden={settings.skin !== "none" && pathname === "/"}>
        <NavLink to="/" className="brand" end>
          <img src="/favicon.png" alt="" width={28} height={28} />
          <span>Wreadt</span>
        </NavLink>
        <nav>
          <NavLink to="/add" className="nav-add">
            + {t("nav.add")}
          </NavLink>
          {NAV.map(([to, key]) => (
            <NavLink key={to} to={to}>
              {t(key)}
            </NavLink>
          ))}
          <NavLink to="/account" className={`account-link sync-${status}`} title={pending ? t("account.pending", { count: pending }) : undefined}>
            {session ? session.user.email.split("@")[0] : t("nav.login")}
          </NavLink>
        </nav>
      </header>
      <Suspense>
          <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/phonetic" element={<PhoneticPage />} />
          <Route path="/vocabulary" element={<CustomVocabPage />} />
          <Route path="/sentence" element={<SentencePracticePage />} />
          <Route path="/progress" element={<ProgressPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/account" element={<AccountPage />} />
          <Route path="/add" element={<AddWordsPage />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </div>
  );
}
