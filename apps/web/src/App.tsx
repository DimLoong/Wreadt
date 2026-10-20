import { lazy, Suspense, useEffect, useState } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { Button, Menu } from "tdesign-react";
import { AddIcon, BookmarkIcon, BookOpenIcon, ChartBarIcon, ChatIcon, LogoGithubFilledIcon, SettingIcon, TranslateIcon, UserIcon } from "tdesign-icons-react";
import TypingPage from "./pages/TypingPage";
import WreadtButton from "./components/WreadtButton";
import { useSettings } from "./context/settings";
import { useFocusMode } from "./context/focus";
import { useSync } from "./context/sync";
import type { MessageKey } from "./i18n/messages";
import { setPronounceVolume } from "./services/volume";

// 首页（学习兴趣流、场景练习）与快速添加弹窗都不在打字页首屏，按需加载
const HomePage = lazy(() => import("./pages/HomePage"));
const QuickAddDialog = lazy(() => import("./components/QuickAddDialog"));
const PhoneticPage = lazy(() => import("./pages/PhoneticPage"));
const VocabularyPage = lazy(() => import("./pages/VocabularyPage"));
const DictWizardPage = lazy(() => import("./pages/DictWizardPage"));
const DictDetailPage = lazy(() => import("./pages/DictDetailPage"));
const SentencePracticePage = lazy(() => import("./pages/SentencePracticePage"));
const ProgressPage = lazy(() => import("./pages/ProgressPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const AccountPage = lazy(() => import("./pages/AccountPage"));
const ScenarioPage = lazy(() => import("./pages/ScenarioPage"));
const MarksPage = lazy(() => import("./pages/MarksPage"));
const PlacementPage = lazy(() => import("./pages/PlacementPage"));
const DictationPage = lazy(() => import("./pages/DictationPage"));
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
  if (pathname === "/sentence" || pathname === "/dictation") return "/scenario";
  if (pathname.startsWith("/vocabulary")) return "/vocabulary";
  // 不属于任何菜单项的页面传一个不存在的值：传空字符串时 TDesign 会保留上一次的选中项
  return NAV.find(([to]) => to === pathname)?.[0] ?? "none";
}

export default function App() {
  const { ready, t, settings } = useSettings();
  // 发音音量交给朗读服务（非 React 代码）使用
  useEffect(() => setPronounceVolume(settings.voiceVolume / 100), [settings.voiceVolume]);
  const { pathname } = useLocation();
  const { focused } = useFocusMode();
  const { session, status, pending } = useSync();
  const navigate = useNavigate();
  const [typingVisited, setTypingVisited] = useState(pathname === "/typing");
  const [quickAdd, setQuickAdd] = useState(false);
  // 第一次打开后保持挂载，关闭时有动画
  const [quickAddLoaded, setQuickAddLoaded] = useState(false);
  if (quickAdd && !quickAddLoaded) setQuickAddLoaded(true);
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
            <MenuItem key={to} value={to} icon={icon} className={to === "/vocabulary" ? "nav-split" : undefined}>
              {to === "/vocabulary" ? (
                <>
                  {t(key)}
                  {/* 分隔的加号：快速添加词汇，不跳转页面 */}
                  <span className="nav-split-sep" aria-hidden="true" />
                  <span
                    role="button"
                    tabIndex={0}
                    className="nav-split-add"
                    title={t("vocab.quickAdd")}
                    aria-label={t("vocab.quickAdd")}
                    onClick={(e) => {
                      e.stopPropagation();
                      setQuickAdd(true);
                    }}
                    onKeyDown={(e) => {
                      if (e.key !== "Enter" && e.key !== " ") return;
                      e.preventDefault();
                      e.stopPropagation();
                      setQuickAdd(true);
                    }}
                  >
                    <AddIcon />
                  </span>
                </>
              ) : (
                t(key)
              )}
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
          <Route path="/vocabulary" element={<VocabularyPage />} />
          <Route path="/vocabulary/new" element={<DictWizardPage />} />
          <Route path="/vocabulary/dict/:id" element={<DictDetailPage />} />
          <Route path="/sentence" element={<SentencePracticePage />} />
          <Route path="/dictation" element={<DictationPage />} />
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
      {quickAddLoaded && (
        <Suspense fallback={null}>
          <QuickAddDialog visible={quickAdd} onClose={() => setQuickAdd(false)} />
        </Suspense>
      )}
    </div>
  );
}
