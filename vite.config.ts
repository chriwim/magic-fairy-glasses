import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "/magic-fairy-glasses/",
  build: {
    outDir: "docs"
  },
  plugins: [
    VitePWA({
      registerType: "prompt",
      includeAssets: ["icon-192.png", "icon-512.png"],
      manifest: {
        name: "Magic Fairy Glasses",
        short_name: "Fairy Glasses",
        description: "A gentle fairy viewfinder for little explorers and their grown-ups.",
        theme_color: "#201738",
        background_color: "#201738",
        display: "standalone",
        start_url: "./",
        scope: "./",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" }
        ]
      },
      workbox: {
        navigateFallback: "index.html",
        cleanupOutdatedCaches: true,
        globPatterns: ["**/*.{html,js,css,png,svg,webmanifest}"]
      }
    })
  ]
});
