import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { spawn } from "node:child_process";

// Vite plugin: after the production build finishes, run the bundle reporter
// script so each build prints FCP/LCP-relevant payload sizes to the console.
const bundleReportPlugin = () => ({
  name: "bundle-report",
  apply: "build" as const,
  closeBundle() {
    try {
      const child = spawn(process.execPath, ["scripts/report-bundle.mjs"], {
        stdio: "inherit",
      });
      child.on("error", (e) => {
        // eslint-disable-next-line no-console
        console.warn("[bundle-report] failed to start:", e.message);
      });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn("[bundle-report] error:", (e as Error).message);
    }
  },
});

// Vite plugin: write a fresh public/version.json before the production build
// starts so the PWA shell can poll it and detect new deployments.
const generateVersionPlugin = () => ({
  name: "generate-version",
  apply: "build" as const,
  buildStart() {
    try {
      const child = spawn(process.execPath, ["scripts/generate-version.mjs"], {
        stdio: "inherit",
      });
      child.on("error", (e) => {
        // eslint-disable-next-line no-console
        console.warn("[generate-version] failed to start:", e.message);
      });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn("[generate-version] error:", (e as Error).message);
    }
  },
});

// Vite plugin: replace `__BUILD_VERSION__` placeholders in index.html with a
// per-build timestamp. Used to cache-bust the PWA manifest, splash images and
// icons so the installed app shell can never serve stale "WEBHEADS" assets
// after a new build is deployed.
const BUILD_VERSION = `${Date.now()}`;
const buildVersionHtmlPlugin = () => ({
  name: "build-version-html",
  transformIndexHtml(html: string) {
    return html.replaceAll("__BUILD_VERSION__", BUILD_VERSION);
  },
});

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    buildVersionHtmlPlugin(),
    mode !== "development" && generateVersionPlugin(),
    mode !== "development" && bundleReportPlugin(),
  ].filter(Boolean),
  define: {
    // Expose the build version to runtime code (e.g. PWAMetaApplier) so the
    // dynamically-generated manifest can append the same `?v=` query string
    // to icon URLs and stay in sync with the static index.html references.
    __BUILD_VERSION__: JSON.stringify(BUILD_VERSION),
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query"],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          "vendor-query": ["@tanstack/react-query"],
          "vendor-ui": ["@radix-ui/react-dialog", "@radix-ui/react-dropdown-menu", "@radix-ui/react-tabs", "@radix-ui/react-tooltip", "@radix-ui/react-select", "@radix-ui/react-popover"],
          "vendor-supabase": ["@supabase/supabase-js"],
          "vendor-i18n": ["i18next", "react-i18next"],
          "vendor-charts": ["recharts"],
          "vendor-carousel": ["embla-carousel-react"],
          // Heavy export-only deps used when generating certificates. These
          // are dynamically imported in code, but isolating them here keeps
          // them out of any shared vendor chunk.
          "vendor-pdf": ["jspdf"],
          "vendor-canvas": ["html2canvas"],
          // date-fns is used widely; keep it in its own chunk so it can be
          // shared/cached across all routes that format dates.
          "vendor-dates": ["date-fns"],
          // Icon library — separate so admin/teacher routes share one cached
          // copy rather than duplicating into every page chunk.
          "vendor-icons": ["lucide-react"],
        },
      },
    },
    target: "esnext",
    minify: "esbuild",
    cssCodeSplit: true,
    chunkSizeWarningLimit: 500,
    reportCompressedSize: false,
    sourcemap: false,
  },
  optimizeDeps: {
    // Pre-bundle heavy deps that are used on initial route
    include: [
      "react",
      "react-dom",
      "react-router-dom",
      "@tanstack/react-query",
      "@supabase/supabase-js",
      "i18next",
      "react-i18next",
      // recharts (and its lodash CJS deps) MUST be pre-bundled, otherwise the
      // browser-side ESM proxy can't synthesize a `default` export for
      // `lodash/get` and admin pages crash with a SyntaxError.
      "recharts",
      "lodash/get",
      "lodash/isEqual",
      "lodash/isNil",
      "lodash/isFunction",
      "lodash/isString",
      "lodash/isObject",
      "lodash/isNumber",
      "lodash/isBoolean",
      "lodash/isArray",
      "lodash/isPlainObject",
      "lodash/last",
      "lodash/first",
      "lodash/max",
      "lodash/min",
      "lodash/range",
      "lodash/sortBy",
      "lodash/throttle",
      "lodash/uniqBy",
      "lodash/upperFirst",
      "lodash/mapValues",
      "lodash/memoize",
    ],
  },
}));