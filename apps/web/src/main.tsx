import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "tdesign-react/es/style/index.css";
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
