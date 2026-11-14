// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  vite: {
    plugins: [VitePWA({
      strategies: "generateSW", filename: "sw.js", registerType: "autoUpdate", injectRegister: null,
      devOptions: { enabled: false }, manifest: false,
      workbox: {
        importScripts: ["/push-handler.js"],
        globPatterns: ["**/*.{js,css,png,ico,ttf,webmanifest}"],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        navigateFallback: null,
        runtimeCaching: [
          { urlPattern: ({ request, url }) => request.mode === "navigate" && !url.pathname.startsWith("/~oauth"), handler: "NetworkFirst", options: { cacheName: "saha-navigation", networkTimeoutSeconds: 5, cacheableResponse: { statuses: [200] } } },
          { urlPattern: ({ url }) => url.origin === self.location.origin && /\/assets\/.*-[\w-]+\.(js|css|png)$/.test(url.pathname), handler: "CacheFirst", options: { cacheName: "saha-assets", expiration: { maxEntries: 120, maxAgeSeconds: 2592000 } } },
        ],
      },
    })],
  },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
