import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

// Dev-only equivalent of public/_redirects' SPA fallback (Cloudflare Pages handles this in
// production) — rewrites any non-file /app/* request to app/index.html so client-side routes
// like /app/login and /app/account work on direct navigation/refresh during `vite dev`.
function appSpaFallback(): Plugin {
  return {
    name: "chasa-app-spa-fallback",
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        if (req.url && req.url.startsWith("/app") && !req.url.split("?")[0].includes(".")) {
          req.url = "/app/index.html";
        }
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), appSpaFallback()],
  build: {
    rollupOptions: {
      // Only the React app is a Vite entry — the static landing page in public/ is copied
      // through untouched, no build step needed for it.
      input: { app: resolve(__dirname, "app/index.html") },
    },
  },
  server: {
    proxy: {
      "/api": "http://127.0.0.1:8787",
    },
  },
});
