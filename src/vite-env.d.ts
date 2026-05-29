/// <reference types="vite/client" />

// Build-time constant injected by Vite (see `define` in vite.config.ts).
// Used as a `?v=` cache-busting query string on PWA assets so installed
// shells re-fetch the manifest and icons after every deploy.
declare const __BUILD_VERSION__: string;
