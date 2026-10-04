/// <reference types="vite-plugin-pwa/client" />
import React from "react";
import ReactDOM from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import "@fontsource-variable/inter";
import App from "./App";
import { seed } from "./database/logic";
import "./style.css";

registerSW({ immediate: true }); // cache aplikasi untuk offline + update otomatis
navigator.storage?.persist?.(); // minta penyimpanan permanen supaya data tidak dibersihkan browser

seed().finally(() => {
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
});
