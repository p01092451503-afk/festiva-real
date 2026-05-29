import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./i18n";
import "./index.css";
import { initPerfReporter } from "./lib/perfReporter";
import { enforceCanonicalDomain } from "./lib/canonicalDomain";

// Redirect known alternate hosts to the canonical production domain so that
// links shared from any environment always resolve to https://demo.webheads.co.kr.
enforceCanonicalDomain();

createRoot(document.getElementById("root")!).render(<App />);

// Remove the inline boot skeleton once React has had a chance to paint.
// Using requestAnimationFrame ensures we wait for the first render frame.
requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    const el = document.getElementById("boot-skeleton");
    if (el) el.remove();
  });
});

// Report Web Vitals + transfer summary to the console after load.
initPerfReporter();
