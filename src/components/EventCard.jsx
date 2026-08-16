// admin/src/components/EventCard.jsx
import { memo, useState } from "react";
import { Calendar, Edit3, Trash2, MapPin, User, Clock } from "lucide-react";
import EventStatusBadge from "./EventStatusBadge";

const formatDate = (dateString) =>
  new Date(dateString).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

function EventCard({ event, canModify, onEdit, onDelete }) {
  // Per-card, so expanding one description no longer expands every card.
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-slate-800/30 backdrop-blur-xl border border-slate-700/50 rounded-2xl overflow-hidden shadow-xl hover:shadow-2xl transition-all duration-300 hover:transform hover:scale-[1.02] group">
      {/* Event Image */}
      <div className="relative">
        <img
          src={event.image}
          alt={event.name}
          className="w-full h-70 object-cover"
        />
        <div className="absolute inset-0 bg-linear-to-t from-slate-900/60 to-transparent"></div>

        {/* Event Name Only */}
        <div className="absolute bottom-3 left-4 right-4">
          <h3 className="text-lg font-bold text-white text-left line-clamp-1">
            {event.name}
          </h3>
        </div>
      </div>

      {/* Event Details */}
      <div className="p-4 space-y-4">
        {/* Status & Batch Badges - Below Image */}
        <div className="flex items-center justify-between">
          <EventStatusBadge event={event} />

          {/* Batch Badge */}
          <div className="px-3 py-1 bg-slate-700/50 rounded-lg text-xs font-semibold text-slate-300">
            {event.batch}
          </div>
        </div>

        {/* Date & Time - Equal Alignment */}
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2 text-slate-300">
            <Calendar className="w-4 h-4 text-slate-400" />
            <span>{formatDate(event.date)}</span>
          </div>
          <div className="flex items-center gap-2 text-slate-300">
            <Clock className="w-4 h-4 text-slate-400" />
            <span>{event.time}</span>
          </div>
        </div>

        {/* Venue - Full Width */}
        <div className="flex items-center gap-2 text-sm text-slate-300">
          <MapPin className="w-4 h-4 text-slate-400" />
          <span className="line-clamp-1">{event.venue}</span>
        </div>

        {/* Speaker - Full Width */}
        {event.speaker && (
          <div className="flex items-center gap-2 text-sm text-slate-300">
            <User className="w-4 h-4 text-slate-400" />
            <span className="line-clamp-1">{event.speaker}</span>
          </div>
        )}

        <div className="relative">
          <div
            className={`text-sm text-slate-400 leading-relaxed whitespace-pre-wrap transition-all duration-300 ${
              expanded ? "max-h-none" : "max-h-20 overflow-hidden"
            }`}
          >
            {event.description}
          </div>

          {/* Gradient fade when collapsed */}
          {!expanded && event.description?.length > 150 && (
            <div className="absolute bottom-0 left-0 right-0 h-4 bg-linear-to-t from-slate-900 via-slate-900/80 to-transparent pointer-events-none"></div>
          )}

          {/* Show more/less button */}
          {event.description?.length > 150 && (
            <div className="flex justify-start mt-2">
              <button
                onClick={() => setExpanded((prev) => !prev)}
                className="flex items-center gap-1 text-yellow-500 hover:text-yellow-400 text-xs font-medium px-3 py-1.5 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-600 rounded-lg transition-all duration-200 hover:scale-105"
              >
                {expanded ? (
                  <>
                    <svg
                      className="w-3 h-3"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 15l7-7 7 7"
                      />
                    </svg>
                    Show less
                  </>
                ) : (
                  <>
                    <svg
                      className="w-3 h-3"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                    Show more
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Created/Updated Info - Equal Alignment */}
        <div className="flex items-start justify-between text-[11px] text-slate-500 leading-tight space-y-1">
          {/* Left - Created By */}
          <div className="flex-1">
            {event.createdBy && (
              <div>
                <div>
                  <span className="text-slate-400">Created: </span>
                  <span className="text-slate-300">
                    {event.createdBy.name || "Unknown"}
                  </span>
                </div>
                {event.createdBy.email && (
                  <div className="text-slate-400 line-clamp-1">
                    {event.createdBy.email}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right - Updated By */}
          <div className="flex-1 text-right">
            {event.updatedBy && (
              <div>
                <div>
                  <span className="text-slate-400">Updated: </span>
                  <span className="text-slate-300">
                    {event.updatedBy.name || "Unknown"}
                  </span>
                </div>
                {event.updatedBy.email && (
                  <div className="text-slate-400 line-clamp-1">
                    {event.updatedBy.email}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-3 border-t border-slate-700/50">
          {canModify ? (
            <>
              <button
                onClick={() => onEdit(event)}
                className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl transition-all duration-200 text-sm font-medium bg-slate-700/50 hover:bg-slate-600/50 text-slate-300 hover:text-white"
              >
                <Edit3 className="w-3 h-3" />
                Edit
              </button>
              <button
                onClick={() => onDelete(event)}
                className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl transition-all duration-200 text-sm font-medium border bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 border-red-500/20 hover:border-red-500/30"
              >
                <Trash2 className="w-3 h-3" />
                Delete
              </button>
            </>
          ) : (
            <button
              onClick={() => onEdit(event)}
              className="flex-1 flex items-center justify-center gap-2 py-1 px-2 rounded-lg transition-all duration-200 text-xs font-medium bg-slate-800/30 text-slate-500 cursor-not-allowed"
              disabled
            >
              View Only
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// The list re-renders whenever a filter changes or a status flips; memo keeps
// that from touching cards whose data did not change.
export default memo(EventCard);
