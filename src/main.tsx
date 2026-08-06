import React from "react";
import ReactDOM from "react-dom/client";
import "@fontsource-variable/fraunces";
import "@fontsource-variable/manrope";
import App, { ErrorBoundary } from "./App";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
