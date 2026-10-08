import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "tdesign-react/es/style/index.css";
import "./styles/index.scss";
import App from "./App.tsx";
import { SettingsProvider } from "./context/settings";
import { FocusProvider } from "./context/focus";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <SettingsProvider>
        <FocusProvider>
          <App />
        </FocusProvider>
      </SettingsProvider>
    </BrowserRouter>
  </StrictMode>,
);
