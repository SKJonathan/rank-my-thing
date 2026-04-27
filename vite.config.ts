import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
// On GitHub Pages the site lives under /<repo>/. Locally and on Lovable hosting it lives at /.
const isGhPages = process.env.GITHUB_PAGES === "true";
const ghPagesBase = process.env.GH_PAGES_BASE ?? "/rank-my-thing/";

export default defineConfig(({ mode }) => ({
  base: isGhPages ? ghPagesBase : "/",
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
}));
