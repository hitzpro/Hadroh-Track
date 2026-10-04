import { defineConfig } from "vite";
import react from "@vitejs/plugin-react"; // kalau project kamu pakai plugin-react-swc, samakan importnya
import { VitePWA } from "vite-plugin-pwa";

// Lokal: "/". GitHub Pages: workflow mengisi VITE_BASE=/<nama-repo>/
const base = process.env.VITE_BASE || "/";

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icons/apple-touch-icon.png"],
      manifest: {
        name: "HadrohTrack",
        short_name: "HadrohTrack",
        description: "Absensi dan pembagian alat hadroh",
        lang: "id",
        start_url: base,
        scope: base,
        display: "standalone",
        orientation: "portrait",
        background_color: "#ffffff",
        theme_color: "#15803d",
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,svg,woff2,woff,webmanifest}"],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
});
