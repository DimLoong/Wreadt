import { lazy, Suspense, useState } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { Button, Menu } from "tdesign-react";
import { BookmarkIcon, BookOpenIcon, ChartBarIcon, ChatIcon, LogoGithubFilledIcon, SettingIcon, TranslateIcon, UserIcon } from "tdesign-icons-react";
import TypingPage from "./pages/TypingPage";
import HomePage from "./pages/HomePage";
import WreadtButton from "./components/WreadtButton";
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
const ScenarioPage = lazy(() => import("./pages/ScenarioPage"));
const MarksPage = lazy(() => import("./pages/MarksPage"));
const PlacementPage = lazy(() => import("./pages/PlacementPage"));
const WelcomePage = lazy(() => import("./pages/WelcomePage"));
const VerifyEmailPage = lazy(() => import("./pages/EmailLinkPage").then((m) => ({ default: m.VerifyEmailPage })));
const ResetPasswordPage = lazy(() => import("./pages/EmailLinkPage").then((m) => ({ default: m.ResetPasswordPage })));

const { HeadMenu, MenuItem } = Menu;
const REPO_URL = "https://github.com/DimLoong/Wreadt";

const NAV: [to: string, key: MessageKey, icon: React.ReactElement][] = [
  ["/scenario", "nav.practice", <ChatIcon key="i" />],
  ["/progress", "nav.progress", <ChartBarIcon key="i" />],
  ["/marks", "nav.marks", <BookmarkIcon key="i" />],
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
  const [typingVisited, setTypingVisited] = useState(pathname === "/typing");
  if (pathname === "/typing" && !typingVisited) setTypingVisited(true);
  if (!ready) return null;
  const onTyping = pathname === "/typing";
  const disguisedHome = settings.skin !== "none" && onTyping;

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
              <WreadtButton onTypingPage={onTyping} />
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
      {/* 懒加载页面时占住主体区域，避免页脚跳到顶部 */}
      <Suspense fallback={<main className="page" style={{ flex: 1 }} />}>
          <Routes>
          <Route path="/" element={<HomePage />} />
          {/* 打字页在下方常驻渲染，切换页面不丢进度 */}
          <Route path="/typing" element={null} />
          <Route path="/phonetic" element={<PhoneticPage />} />
          <Route path="/vocabulary" element={<CustomVocabPage />} />
          <Route path="/sentence" element={<SentencePracticePage />} />
          <Route path="/progress" element={<ProgressPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/account" element={<AccountPage />} />
          <Route path="/add" element={<Navigate to="/vocabulary" replace />} />
          <Route path="/scenario" element={<ScenarioPage />} />
          <Route path="/marks" element={<MarksPage />} />
          <Route path="/placement" element={<PlacementPage />} />
          <Route path="/welcome" element={<WelcomePage />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      {typingVisited && (
        <div className="typing-keepalive" hidden={!onTyping}>
          <TypingPage active={onTyping} />
        </div>
      )}
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
