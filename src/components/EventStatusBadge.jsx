// admin/src/components/EventStatusBadge.jsx
import { memo } from "react";
import {
  useEventStatus,
  getStatusColor,
  getStatusLabel,
} from "../utils/eventStatus";

// The only component in the tree that reacts to the clock. When an event goes
// live nothing else re-renders — not the card, not the list, not the image.
function EventStatusBadge({ event }) {
  const status = useEventStatus(event);

  return (
    <div
      className={`px-3 py-1 rounded-lg border text-xs font-semibold transition-colors duration-300 ${getStatusColor(
        status
      )}`}
    >
      {getStatusLabel(status)}
    </div>
  );
}

export default memo(EventStatusBadge);
