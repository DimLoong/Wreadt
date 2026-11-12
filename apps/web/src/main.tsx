import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "tdesign-react/es/style/index.css";
// TDesign 的 MessagePlugin 等命令式组件在 React 19 下需要这个适配，否则调用时报 reactRender is not a function
import "tdesign-react/es/_util/react-19-adapter";
import "./styles/index.scss";
import "./styles/skins.scss";
import App from "./App.tsx";
import { SettingsProvider } from "./context/settings";
import { FocusProvider } from "./context/focus";
import { SyncProvider } from "./context/sync";
import { TypingProgressProvider } from "./context/typingProgress";
import Monitoring from "./components/Monitoring";
import { initErrorReporting } from "./lib/errorReporting";

initErrorReporting();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <SettingsProvider>
        <SyncProvider>
          <FocusProvider>
            <TypingProgressProvider>
              <App />
              <Monitoring />
            </TypingProgressProvider>
          </FocusProvider>
        </SyncProvider>
      </SettingsProvider>
    </BrowserRouter>
  </StrictMode>,
);
