import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./styles.css";

if (globalThis.location?.protocol === "chrome-extension:") {
  document.documentElement.dataset.shell = "extension";
}

createRoot(document.getElementById("root")).render(<App />);
