import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <div className="ambience" aria-hidden="true" />
    <div className="vignette" aria-hidden="true" />
    <App />
  </StrictMode>,
);
