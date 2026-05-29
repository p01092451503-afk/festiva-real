import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { reportRouteChange } from "@/lib/perfReporter";

/**
 * Bridges React Router's location to the perf reporter so each SPA route
 * change opens a new console group with route-scoped Web Vitals.
 */
export default function RouteReporter() {
  const location = useLocation();
  useEffect(() => {
    reportRouteChange(location.pathname);
  }, [location.pathname]);
  return null;
}
