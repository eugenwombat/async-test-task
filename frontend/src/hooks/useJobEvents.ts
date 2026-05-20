import { useEffect } from "react";
import type { JobUpdate } from "../types";

const EVENTS_BASE = import.meta.env.VITE_EVENTS_BASE ?? "/events";
const API_KEY = import.meta.env.VITE_API_KEY ?? "";

export function useJobEvents(onUpdate: (update: JobUpdate) => void) {
  useEffect(() => {
    // EventSource does not allow custom headers in the browser.
    // We pass the API key as a query param; the backend accepts both.
    // (For production, prefer cookie-based session or signed token in URL.)
    const url = `${EVENTS_BASE}/jobs?api_key=${encodeURIComponent(API_KEY)}`;
    const es = new EventSource(url);

    const handler = (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data) as JobUpdate;
        if (data?.job_id) onUpdate(data);
      } catch {
        // ignore malformed payloads (keepalive pings included)
      }
    };

    es.addEventListener("job_update", handler as EventListener);

    es.onerror = () => {
      // Browser auto-reconnects with backoff; nothing to do here besides leaving it open.
    };

    return () => {
      es.removeEventListener("job_update", handler as EventListener);
      es.close();
    };
  }, [onUpdate]);
}
