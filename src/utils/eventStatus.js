// admin/src/utils/eventStatus.js
import { useRef } from "react";
import { useClockValue } from "../hooks/useClock";

const toMs = (value) => {
  if (!value) return null;
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value;
  // Firestore timestamps survive JSON as { _seconds, _nanoseconds }.
  if (typeof value === "object") {
    if (typeof value._seconds === "number") return value._seconds * 1000;
    if (typeof value.seconds === "number") return value.seconds * 1000;
    return null;
  }
  const ms = new Date(value).getTime();
  return Number.isNaN(ms) ? null : ms;
};

/**
 * Client-side twin of calculateStatus() in server/services/eventService.js.
 *
 * The stored status only wins for a manual cancellation and for legacy events
 * that have no UTC window; otherwise the status is a pure function of the
 * event window and the current instant, so the UI never has to wait for the
 * server cron to catch up.
 *
 * The window is compared in absolute UTC, so this stays correct whatever
 * timezone the admin's machine is in (the displayed `event.time` text stays
 * IST, exactly as the server wrote it).
 */
export function getEventStatus(event, nowMs = Date.now()) {
  if (!event) return "upcoming";

  if (event.isStatusManuallySet && event.status === "cancelled") {
    return "cancelled";
  }

  const start = toMs(event.startDateTimeUTC);
  const end = toMs(event.endDateTimeUTC);
  if (start === null || end === null) return event.status || "upcoming";

  if (nowMs < start) return "upcoming";
  if (nowMs <= end) return "ongoing";
  return "completed";
}

/** Live status for a single event. Re-renders only when the status flips. */
export function useEventStatus(event) {
  return useClockValue((nowMs) => getEventStatus(event, nowMs), [
    event?.startDateTimeUTC,
    event?.endDateTimeUTC,
    event?.status,
    event?.isStatusManuallySet,
  ]);
}

const EMPTY = {};

/**
 * Live `{ [eventId]: status }` map for a list, used for filtering and for the
 * status dropdown options.
 *
 * The map keeps its identity until some event actually changes status, so the
 * list re-renders on real transitions only — not once a second.
 */
export function useEventStatuses(events) {
  const lastRef = useRef({ key: "", map: EMPTY });

  return useClockValue(
    (nowMs) => {
      const map = {};
      let key = "";
      for (const event of events) {
        const status = getEventStatus(event, nowMs);
        map[event._id] = status;
        key += `${event._id}:${status}|`;
      }
      if (key === lastRef.current.key) return lastRef.current.map;
      lastRef.current = { key, map };
      return map;
    },
    [events]
  );
}

export function getStatusColor(status) {
  switch (status) {
    case "upcoming":
      return "bg-blue-500/20 text-blue-300 border-blue-500/30";
    case "ongoing":
      return "bg-green-500/20 text-green-300 border-green-500/30";
    case "completed":
      return "bg-slate-500/20 text-slate-300 border-slate-500/30";
    case "cancelled":
      return "bg-red-500/20 text-red-300 border-red-500/30";
    default:
      return "bg-slate-500/20 text-slate-300 border-slate-500/30";
  }
}

export function getStatusLabel(status) {
  if (!status) return "";
  return status.charAt(0).toUpperCase() + status.slice(1);
}
