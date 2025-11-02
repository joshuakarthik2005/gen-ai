"use client";

import { useState, useEffect } from "react";
import {
  Calendar,
  Clock,
  AlertCircle,
  CheckCircle,
  AlertTriangle,
  Info,
  ChevronDown,
  ChevronUp,
  Filter,
  Download,
  X,
} from "lucide-react";

interface Obligation {
  id: string;
  action: string;
  responsible_party: string;
  deadline: string;
  deadline_type: string;
  deadline_value?: number;
  priority: "critical" | "high" | "medium" | "low";
  type: string;
  consequences: string;
  context: string;
  section: string;
  deadline_sort_key?: string;
}

interface TimelineEvent {
  id: string;
  title: string;
  date: string;
  type: string;
  priority: "critical" | "high" | "medium" | "low";
  responsible_party: string;
  description: string;
  consequences: string;
}

interface ObligationData {
  document_id?: string;
  document_name: string;
  obligations: Obligation[];
  timeline_events: TimelineEvent[];
  summary: {
    total: number;
    by_priority: Record<string, number>;
    by_type: Record<string, number>;
    upcoming_count: number;
  };
  extracted_at: string;
}

interface ObligationTimelineProps {
  documentText: string;
  documentId?: string;
  documentName?: string;
  onClose?: () => void;
}

export default function ObligationTimeline({
  documentText,
  documentId,
  documentName = "Document",
  onClose,
}: ObligationTimelineProps) {
  const [data, setData] = useState<ObligationData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedObligation, setSelectedObligation] = useState<Obligation | null>(null);
  const [viewMode, setViewMode] = useState<"timeline" | "list">("timeline");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");

  // Generate a cache key based on document content (first 100 chars as fingerprint)
  const getCacheKey = () => {
    const fingerprint = documentText.substring(0, 100).replace(/\s+/g, '');
    return `obligations_${documentName}_${fingerprint}`;
  };

  useEffect(() => {
    if (documentText) {
      // Check cache first
      const cacheKey = getCacheKey();
      const cached = localStorage.getItem(cacheKey);
      
      if (cached) {
        try {
          const cachedData = JSON.parse(cached);
          console.log('Using cached obligations data');
          setData(cachedData);
          setLoading(false);
        } catch (err) {
          console.error('Failed to parse cached data:', err);
          extractObligations();
        }
      } else {
        extractObligations();
      }
    }
  }, [documentText]);

  const extractObligations = async () => {
    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        throw new Error("Authentication required");
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/extract-obligations`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            document_text: documentText,
            document_id: documentId,
            document_name: documentName,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to extract obligations: ${response.statusText}`);
      }

      const result = await response.json();
      setData(result);
      
      // Cache the result
      const cacheKey = getCacheKey();
      try {
        localStorage.setItem(cacheKey, JSON.stringify(result));
        console.log('Cached obligations data for future use');
      } catch (err) {
        console.error('Failed to cache obligations:', err);
      }
    } catch (err: any) {
      console.error("Failed to extract obligations:", err);
      setError(err.message || "Failed to extract obligations");
    } finally {
      setLoading(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    const colors = {
      critical: "bg-red-100 text-red-800 border-red-300",
      high: "bg-orange-100 text-orange-800 border-orange-300",
      medium: "bg-yellow-100 text-yellow-800 border-yellow-300",
      low: "bg-blue-100 text-blue-800 border-blue-300",
    };
    return colors[priority as keyof typeof colors] || "bg-gray-100 text-gray-800";
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case "critical":
        return <AlertCircle className="w-4 h-4" />;
      case "high":
        return <AlertTriangle className="w-4 h-4" />;
      case "medium":
        return <Clock className="w-4 h-4" />;
      default:
        return <Info className="w-4 h-4" />;
    }
  };

  const getTypeIcon = (type: string) => {
    const icons: Record<string, string> = {
      payment: "💰",
      delivery: "📦",
      reporting: "📊",
      termination: "⚠️",
      renewal: "🔄",
      compliance: "✓",
      notification: "📧",
      general: "📄",
    };
    return icons[type] || "📄";
  };

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;
      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  const getFilteredObligations = () => {
    if (!data) return [];

    let filtered = data.obligations;

    if (filterPriority !== "all") {
      filtered = filtered.filter((o) => o.priority === filterPriority);
    }

    if (filterType !== "all") {
      filtered = filtered.filter((o) => o.type === filterType);
    }

    return filtered;
  };

  const exportToCalendar = () => {
    if (!data) return;

    // Create Google Calendar links for each event
    const googleCalendarUrls = data.timeline_events.map((event) => {
      // Format date for Google Calendar URL (YYYYMMDD)
      const dateStr = event.date.replace(/-/g, "");
      
      // Construct Google Calendar URL
      const params = new URLSearchParams({
        action: "TEMPLATE",
        text: event.title,
        dates: `${dateStr}/${dateStr}`,
        details: `${event.description}\n\nResponsible: ${event.responsible_party}\nPriority: ${event.priority}\nConsequences: ${event.consequences}`,
        location: "",
      });

      return `https://calendar.google.com/calendar/render?${params.toString()}`;
    });

    // Open Google Calendar for each event in new tabs
    if (confirm(`This will open ${googleCalendarUrls.length} tabs to add events to your Google Calendar. Continue?`)) {
      googleCalendarUrls.forEach((url, index) => {
        // Stagger the opening to avoid popup blocking
        setTimeout(() => {
          window.open(url, `_blank_${index}`);
        }, index * 300);
      });
    }
  };

  const exportToICS = () => {
    if (!data) return;

    // Generate ICS file format as fallback
    let icsContent = "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Legal Demystifier//EN\n";

    data.timeline_events.forEach((event) => {
      const dateStr = event.date.replace(/-/g, "");
      icsContent += `BEGIN:VEVENT\n`;
      icsContent += `UID:${event.id}@legaldemystifier.com\n`;
      icsContent += `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").split(".")[0]}Z\n`;
      icsContent += `DTSTART:${dateStr}\n`;
      icsContent += `SUMMARY:${event.title}\n`;
      icsContent += `DESCRIPTION:${event.description.replace(/\n/g, "\\n")}\n`;
      icsContent += `PRIORITY:${event.priority === "critical" ? "1" : event.priority === "high" ? "3" : "5"}\n`;
      icsContent += `END:VEVENT\n`;
    });

    icsContent += "END:VCALENDAR";

    // Download file
    const blob = new Blob([icsContent], { type: "text/calendar" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${documentName}-obligations.ics`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 bg-white rounded-lg shadow-md relative">
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1 hover:bg-gray-100 rounded-full transition-colors"
            title="Close"
          >
            <X className="w-5 h-5 text-gray-600 hover:text-gray-900" />
          </button>
        )}
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Extracting obligations and deadlines...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 relative">
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-2 right-2 p-1 hover:bg-red-100 rounded-full transition-colors"
            title="Close"
          >
            <X className="w-5 h-5 text-red-600 hover:text-red-900" />
          </button>
        )}
        <div className="flex items-center gap-2 text-red-800">
          <AlertCircle className="w-5 h-5" />
          <span className="font-semibold">Error</span>
        </div>
        <p className="mt-2 text-red-700">{error}</p>
        <button
          onClick={extractObligations}
          className="mt-3 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data) return null;

  const filteredObligations = getFilteredObligations();

  return (
    <div className="bg-white rounded-lg shadow-lg">
      {/* Header */}
      <div className="border-b border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Calendar className="w-6 h-6 text-blue-600" />
              Obligation Timeline
            </h2>
            <p className="text-gray-600 mt-1">{data.document_name}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={exportToCalendar}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
              title="Add events directly to Google Calendar"
            >
              <Calendar className="w-4 h-4" />
              Add to Google Calendar
            </button>
            <button
              onClick={exportToICS}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
              title="Download ICS file for any calendar app"
            >
              <Download className="w-4 h-4" />
              Download ICS File
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                title="Close"
              >
                <X className="w-5 h-5 text-gray-600 hover:text-gray-900" />
              </button>
            )}
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-4 gap-4 mt-6">
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="text-3xl font-bold text-gray-900">{data.summary.total}</div>
            <div className="text-sm text-gray-600">Total Obligations</div>
          </div>
          <div className="bg-red-50 rounded-lg p-4">
            <div className="text-3xl font-bold text-red-600">
              {data.summary.by_priority.critical || 0}
            </div>
            <div className="text-sm text-red-700">Critical</div>
          </div>
          <div className="bg-orange-50 rounded-lg p-4">
            <div className="text-3xl font-bold text-orange-600">
              {data.summary.by_priority.high || 0}
            </div>
            <div className="text-sm text-orange-700">High Priority</div>
          </div>
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="text-3xl font-bold text-blue-600">{data.summary.upcoming_count}</div>
            <div className="text-sm text-blue-700">Upcoming (30 days)</div>
          </div>
        </div>
      </div>

      {/* View Mode Selector & Filters */}
      <div className="border-b border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode("timeline")}
              className={`px-4 py-2 rounded-lg ${
                viewMode === "timeline"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              }`}
            >
              Timeline View
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`px-4 py-2 rounded-lg ${
                viewMode === "list"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              }`}
            >
              List View
            </button>
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-600" />
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="all">All Priorities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>

            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="all">All Types</option>
              <option value="payment">Payment</option>
              <option value="delivery">Delivery</option>
              <option value="reporting">Reporting</option>
              <option value="termination">Termination</option>
              <option value="compliance">Compliance</option>
              <option value="notification">Notification</option>
            </select>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="p-6">
        {viewMode === "timeline" ? (
          <TimelineView
            events={data.timeline_events.filter((e) => {
              if (filterPriority !== "all" && e.priority !== filterPriority) return false;
              if (filterType !== "all" && e.type !== filterType) return false;
              return true;
            })}
            onEventClick={(eventId) => {
              const obligation = data.obligations.find((o) => o.id === eventId);
              setSelectedObligation(obligation || null);
            }}
          />
        ) : (
          <ListView
            obligations={filteredObligations}
            onObligationClick={setSelectedObligation}
          />
        )}
      </div>

      {/* Detail Modal */}
      {selectedObligation && (
        <ObligationDetailModal
          obligation={selectedObligation}
          onClose={() => setSelectedObligation(null)}
        />
      )}
    </div>
  );
}

// Timeline View Component
function TimelineView({
  events,
  onEventClick,
}: {
  events: TimelineEvent[];
  onEventClick: (id: string) => void;
}) {
  if (events.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>No events match the current filters</p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Timeline line */}
      <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gray-200"></div>

      <div className="space-y-6">
        {events.map((event, index) => (
          <div key={event.id} className="relative pl-16">
            {/* Timeline dot */}
            <div
              className={`absolute left-6 w-5 h-5 rounded-full border-4 ${
                event.priority === "critical"
                  ? "bg-red-500 border-red-200"
                  : event.priority === "high"
                  ? "bg-orange-500 border-orange-200"
                  : event.priority === "medium"
                  ? "bg-yellow-500 border-yellow-200"
                  : "bg-blue-500 border-blue-200"
              }`}
            ></div>

            {/* Event card */}
            <div
              onClick={() => onEventClick(event.id)}
              className="bg-gray-50 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer border border-gray-200"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl">{getTypeIcon(event.type)}</span>
                    <h3 className="font-semibold text-gray-900">{event.title}</h3>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-600 mb-2">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {formatDate(event.date)}
                    </span>
                    <span>👤 {event.responsible_party}</span>
                  </div>
                  <p className="text-sm text-gray-700">{event.description}</p>
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    event.priority === "critical"
                      ? "bg-red-100 text-red-800"
                      : event.priority === "high"
                      ? "bg-orange-100 text-orange-800"
                      : event.priority === "medium"
                      ? "bg-yellow-100 text-yellow-800"
                      : "bg-blue-100 text-blue-800"
                  }`}
                >
                  {event.priority.toUpperCase()}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// List View Component
function ListView({
  obligations,
  onObligationClick,
}: {
  obligations: Obligation[];
  onObligationClick: (obligation: Obligation) => void;
}) {
  if (obligations.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>No obligations match the current filters</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {obligations.map((obligation) => (
        <div
          key={obligation.id}
          onClick={() => onObligationClick(obligation)}
          className={`border-2 rounded-lg p-4 cursor-pointer hover:shadow-lg transition-all ${getPriorityColor(
            obligation.priority
          )}`}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                {getPriorityIcon(obligation.priority)}
                <span className="text-xl">{getTypeIcon(obligation.type)}</span>
                <h3 className="font-semibold">{obligation.action}</h3>
              </div>
              <div className="flex items-center gap-4 text-sm mb-2">
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {obligation.deadline}
                </span>
                <span>👤 {obligation.responsible_party}</span>
              </div>
              <p className="text-xs">{obligation.section}</p>
            </div>
            <span className="text-xs px-2 py-1 bg-white rounded font-mono">
              {obligation.type}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

// Detail Modal Component
function ObligationDetailModal({
  obligation,
  onClose,
}: {
  obligation: Obligation;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-gray-900">Obligation Details</h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl"
            >
              ×
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="text-sm font-semibold text-gray-700">Action Required</label>
            <p className="mt-1 text-gray-900">{obligation.action}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-semibold text-gray-700">Responsible Party</label>
              <p className="mt-1 text-gray-900">{obligation.responsible_party}</p>
            </div>
            <div>
              <label className="text-sm font-semibold text-gray-700">Deadline</label>
              <p className="mt-1 text-gray-900">{obligation.deadline}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-semibold text-gray-700">Priority</label>
              <span
                className={`inline-block mt-1 px-3 py-1 rounded-full text-sm font-semibold ${getPriorityColor(
                  obligation.priority
                )}`}
              >
                {obligation.priority.toUpperCase()}
              </span>
            </div>
            <div>
              <label className="text-sm font-semibold text-gray-700">Type</label>
              <p className="mt-1 text-gray-900 flex items-center gap-2">
                <span>{getTypeIcon(obligation.type)}</span>
                {obligation.type}
              </p>
            </div>
          </div>

          <div>
            <label className="text-sm font-semibold text-gray-700">Consequences</label>
            <p className="mt-1 text-gray-900">{obligation.consequences}</p>
          </div>

          <div>
            <label className="text-sm font-semibold text-gray-700">Context</label>
            <div className="mt-1 bg-gray-50 rounded p-3 text-sm text-gray-700">
              {obligation.context}
            </div>
          </div>

          <div>
            <label className="text-sm font-semibold text-gray-700">Document Section</label>
            <p className="mt-1 text-gray-900">{obligation.section}</p>
          </div>
        </div>

        <div className="border-t border-gray-200 p-6">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function getTypeIcon(type: string): string {
  const icons: Record<string, string> = {
    payment: "💰",
    delivery: "📦",
    reporting: "📊",
    termination: "⚠️",
    renewal: "🔄",
    compliance: "✓",
    notification: "📧",
    general: "📄",
  };
  return icons[type] || "📄";
}

function getPriorityColor(priority: string): string {
  const colors = {
    critical: "bg-red-100 text-red-800 border-red-300",
    high: "bg-orange-100 text-orange-800 border-orange-300",
    medium: "bg-yellow-100 text-yellow-800 border-yellow-300",
    low: "bg-blue-100 text-blue-800 border-blue-300",
  };
  return colors[priority as keyof typeof colors] || "bg-gray-100 text-gray-800 border-gray-300";
}

function getPriorityIcon(priority: string) {
  switch (priority) {
    case "critical":
      return <AlertCircle className="w-4 h-4" />;
    case "high":
      return <AlertTriangle className="w-4 h-4" />;
    case "medium":
      return <Clock className="w-4 h-4" />;
    default:
      return <Info className="w-4 h-4" />;
  }
}

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
}
