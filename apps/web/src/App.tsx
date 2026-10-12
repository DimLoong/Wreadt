import { lazy, Suspense } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { Button, Menu } from "tdesign-react";
import { AddIcon, BookOpenIcon, ChartBarIcon, ChatIcon, KeyboardIcon, LogoGithubFilledIcon, SettingIcon, TranslateIcon, UserIcon } from "tdesign-icons-react";
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
const ScenarioPage = lazy(() => import("./pages/ScenarioPage"));
const VerifyEmailPage = lazy(() => import("./pages/EmailLinkPage").then((m) => ({ default: m.VerifyEmailPage })));
const ResetPasswordPage = lazy(() => import("./pages/EmailLinkPage").then((m) => ({ default: m.ResetPasswordPage })));

const { HeadMenu, MenuItem } = Menu;
const REPO_URL = "https://github.com/DimLoong/Wreadt";

const NAV: [to: string, key: MessageKey, icon: React.ReactElement][] = [
  ["/", "nav.typing", <KeyboardIcon key="i" />],
  ["/scenario", "nav.practice", <ChatIcon key="i" />],
  ["/progress", "nav.progress", <ChartBarIcon key="i" />],
  ["/vocabulary", "nav.custom", <BookOpenIcon key="i" />],
  ["/phonetic", "nav.phonetic", <TranslateIcon key="i" />],
  ["/settings", "nav.settings", <SettingIcon key="i" />],
];

/** 子页面归属的导航项 */
function navValue(pathname: string): string {
  if (pathname === "/sentence") return "/scenario";
  if (pathname === "/account") return "";
  return NAV.find(([to]) => to === pathname)?.[0] ?? "";
}

export default function App() {
  const { ready, t, settings } = useSettings();
  const { pathname } = useLocation();
  const { focused } = useFocusMode();
  const { session, status, pending } = useSync();
  const navigate = useNavigate();
  if (!ready) return null;
  const disguisedHome = settings.skin !== "none" && pathname === "/";

  return (
    <div className="app">
      <header className={`app-nav ${focused ? "faded" : ""}`} hidden={disguisedHome}>
        <HeadMenu
          className="app-head-menu"
          value={navValue(pathname)}
          onChange={(v) => navigate(String(v))}
          logo={
            <button type="button" className="brand" onClick={() => navigate("/")}>
              <img src="/favicon.png" alt="" width={28} height={28} />
              <span>Wreadt</span>
            </button>
          }
          operations={
            <div className="nav-operations">
              <Button theme="primary" shape="round" icon={<AddIcon />} onClick={() => navigate("/add")}>
                {t("nav.add")}
              </Button>
              <Button
                variant="text"
                icon={<UserIcon />}
                className={`account-link sync-${status}`}
                title={pending ? t("account.pending", { count: pending }) : undefined}
                onClick={() => navigate("/account")}
              >
                {session ? session.user.email.split("@")[0] : t("nav.login")}
              </Button>
            </div>
          }
        >
          {NAV.map(([to, key, icon]) => (
            <MenuItem key={to} value={to} icon={icon}>
              {t(key)}
            </MenuItem>
          ))}
        </HeadMenu>
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
          <Route path="/scenario" element={<ScenarioPage />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      {!disguisedHome && (
        <footer className="app-footer">
          <a href={REPO_URL} target="_blank" rel="noreferrer">
            <LogoGithubFilledIcon /> Github · Wreadt
          </a>
        </footer>
      )}
    </div>
  );
}
