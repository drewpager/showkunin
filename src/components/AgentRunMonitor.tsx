import React, { useEffect, useRef, useState } from "react";
import { api } from "~/utils/api";

interface AgentRunMonitorProps {
  runId: string;
  onClose: () => void;
}

interface LiveViewModalProps {
  url: string;
  onClose: () => void;
}

function LiveViewModal({ url, onClose }: LiveViewModalProps) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
      <div className="flex h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b bg-gray-50 px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-100">
              <svg className="h-4 w-4 text-purple-600" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Live Browser View</h3>
              <p className="text-xs text-gray-500">Watch and interact with the browser session</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
              Open in New Tab
            </a>
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Iframe */}
        <div className="flex-1 bg-gray-900">
          <iframe
            src={url}
            className="h-full w-full border-0"
            allow="clipboard-read; clipboard-write"
            title="Browserbase Live View"
          />
        </div>
      </div>
    </div>
  );
}

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  running: "bg-blue-100 text-blue-800",
  paused: "bg-orange-100 text-orange-800",
  completed: "bg-green-100 text-green-800",
  failed: "bg-red-100 text-red-800",
  cancelled: "bg-gray-100 text-gray-800",
};

const statusLabels: Record<string, string> = {
  pending: "Pending",
  running: "Running",
  paused: "Paused",
  completed: "Completed",
  failed: "Failed",
  cancelled: "Cancelled",
};

// Tool icons as SVG components
const ToolIcons: Record<string, React.ReactNode> = {
  Bash: (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M4 4h16v16H4V4zm2 2v12h12V6H6zm2 2h8v2H8V8zm0 4h8v2H8v-2z" />
    </svg>
  ),
  Read: (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm4 18H6V4h7v5h5v11z" />
    </svg>
  ),
  Write: (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 9v4h-2v-4H8l4-4 4 4h-3z" />
    </svg>
  ),
  Edit: (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a.996.996 0 0 0 0-1.41l-2.34-2.34a.996.996 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
    </svg>
  ),
  Glob: (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M15.5 14h-.79l-.28-.27a6.5 6.5 0 0 0 1.48-5.34c-.47-2.78-2.79-5-5.59-5.34a6.505 6.505 0 0 0-7.27 7.27c.34 2.8 2.56 5.12 5.34 5.59a6.5 6.5 0 0 0 5.34-1.48l.27.28v.79l4.25 4.25c.41.41 1.08.41 1.49 0 .41-.41.41-1.08 0-1.49L15.5 14z" />
    </svg>
  ),
  Grep: (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M9.5 3A6.5 6.5 0 0 1 16 9.5c0 1.61-.59 3.09-1.56 4.23l.27.27h.79l5 5-1.5 1.5-5-5v-.79l-.27-.27A6.516 6.516 0 0 1 9.5 16 6.5 6.5 0 0 1 3 9.5 6.5 6.5 0 0 1 9.5 3m0 2C7 5 5 7 5 9.5S7 14 9.5 14 14 12 14 9.5 12 5 9.5 5z" />
    </svg>
  ),
};

const ActionTypeColors: Record<string, { bg: string; text: string; border: string }> = {
  tool_call: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
  tool_result: { bg: "bg-green-50", text: "text-green-700", border: "border-green-200" },
  text: { bg: "bg-gray-50", text: "text-gray-700", border: "border-gray-200" },
  system: { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200" },
  step: { bg: "bg-yellow-50", text: "text-yellow-700", border: "border-yellow-200" },
};

interface ActionCardProps {
  log: {
    id: string;
    level: string;
    message: string;
    timestamp: string | Date;
    actionType?: string | null;
    toolName?: string | null;
    toolInput?: string | null;
    toolOutput?: string | null;
  };
}

function ActionCard({ log }: ActionCardProps) {
  const [expanded, setExpanded] = useState(false);
  const actionType = log.actionType ?? "text";
  const defaultColors = { bg: "bg-gray-50", text: "text-gray-700", border: "border-gray-200" };
  const colors = ActionTypeColors[actionType] ?? defaultColors;
  const icon = log.toolName ? ToolIcons[log.toolName] : null;

  // Parse tool input/output if present
  let toolInput: Record<string, unknown> | null = null;
  let toolOutput: Record<string, unknown> | string | null = null;
  try {
    if (log.toolInput) toolInput = JSON.parse(log.toolInput) as Record<string, unknown>;
    if (log.toolOutput) {
      const parsed: unknown = JSON.parse(log.toolOutput);
      toolOutput = typeof parsed === "object" && parsed !== null
        ? (parsed as Record<string, unknown>)
        : String(parsed);
    }
  } catch {
    // Ignore parse errors
  }

  const hasDetails = Boolean(toolInput ?? toolOutput);

  return (
    <div
      className={`rounded-lg border p-3 ${colors.bg} ${colors.border} transition-all`}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        {log.toolName && (
          <div className={`rounded-md p-1.5 ${colors.text} bg-white shadow-sm`}>
            {icon ?? (
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22 6.75V8.5h-9v-.75a2.25 2.25 0 0 0-4.5 0V8.5H0V6.75h8.5V6a3 3 0 0 1 6 0v.75H22z" />
              </svg>
            )}
          </div>
        )}

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {log.toolName && (
                <span className={`text-xs font-semibold ${colors.text}`}>
                  {log.toolName}
                </span>
              )}
              {actionType === "tool_call" && (
                <span className="rounded bg-blue-100 px-1.5 py-0.5 text-xs text-blue-600">
                  calling
                </span>
              )}
              {actionType === "tool_result" && (
                <span className="rounded bg-green-100 px-1.5 py-0.5 text-xs text-green-600">
                  result
                </span>
              )}
            </div>
            <span className="shrink-0 text-xs text-gray-400">
              {new Date(log.timestamp).toLocaleTimeString()}
            </span>
          </div>

          <p className={`mt-1 text-sm ${colors.text} break-words`}>{log.message}</p>

          {/* Expandable details */}
          {hasDetails && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="mt-2 flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
            >
              <svg
                className={`h-3 w-3 transition-transform ${expanded ? "rotate-90" : ""}`}
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                  clipRule="evenodd"
                />
              </svg>
              {expanded ? "Hide details" : "Show details"}
            </button>
          )}

          {expanded && hasDetails && (
            <div className="mt-2 space-y-2 rounded bg-white/50 p-2 font-mono text-xs">
              {toolInput && (
                <div>
                  <span className="font-semibold text-gray-600">Input:</span>
                  <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap text-gray-700">
                    {JSON.stringify(toolInput, null, 2)}
                  </pre>
                </div>
              )}
              {toolOutput && (
                <div>
                  <span className="font-semibold text-gray-600">Output:</span>
                  <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap text-gray-700">
                    {typeof toolOutput === "string"
                      ? toolOutput.slice(0, 500)
                      : JSON.stringify(toolOutput, null, 2).slice(0, 500)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AgentRunMonitor({
  runId,
  onClose,
}: AgentRunMonitorProps) {
  const logsEndRef = useRef<HTMLDivElement>(null);
  const [showLiveView, setShowLiveView] = useState(false);

  const { data: run, isLoading } = api.video.getAgentRun.useQuery(
    { runId },
    {
      refetchInterval: (data) => {
        // Stop polling when run is complete
        if (
          data?.status === "completed" ||
          data?.status === "failed" ||
          data?.status === "cancelled"
        ) {
          return false;
        }
        return 2000; // Poll every 2 seconds for more responsive updates
      },
    }
  );

  const cancelMutation = api.video.cancelAgentRun.useMutation();
  const pauseMutation = api.video.pauseAgentRun.useMutation();
  const resumeMutation = api.video.resumeAgentRun.useMutation();

  const handleCancel = async () => {
    try {
      await cancelMutation.mutateAsync({ runId });
    } catch (error) {
      console.error("Failed to cancel run:", error);
    }
  };

  const handlePause = async () => {
    try {
      await pauseMutation.mutateAsync({ runId });
    } catch (error) {
      console.error("Failed to pause run:", error);
    }
  };

  const handleResume = async () => {
    try {
      await resumeMutation.mutateAsync({ runId });
    } catch (error) {
      console.error("Failed to resume run:", error);
    }
  };

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [run?.logs.length]);

  if (isLoading || !run) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="rounded-lg bg-white p-8">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-black border-t-transparent" />
        </div>
      </div>
    );
  }

  const isRunning = run.status === "running";
  const isPaused = run.status === "paused";
  const isPending = run.status === "pending";
  const isActive = isRunning || isPaused || isPending;

  // Live view is available when we have a URL and the run is active
  const liveViewUrl = (run as { liveViewUrl?: string | null }).liveViewUrl;
  const hasLiveView = Boolean(liveViewUrl && isActive);

  const sortedLogs = [...run.logs].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  // Count action types for summary
  const toolCallCount = sortedLogs.filter((l) => l.actionType === "tool_call").length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b bg-gray-50 px-6 py-4">
          <div className="flex items-center gap-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                Agent Execution
              </h3>
              <p className="text-sm text-gray-500">
                {toolCallCount} actions performed
              </p>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-sm font-medium ${statusColors[run.status] ?? "bg-gray-100 text-gray-800"}`}
            >
              {isPaused && (
                <span className="mr-1 inline-block h-2 w-2 animate-pulse rounded-full bg-orange-500" />
              )}
              {isRunning && (
                <span className="mr-1 inline-block h-2 w-2 animate-pulse rounded-full bg-blue-500" />
              )}
              {statusLabels[run.status] ?? run.status}
            </span>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Timing Info */}
        <div className="shrink-0 border-b bg-white px-6 py-2 text-xs text-gray-500">
          <div className="flex items-center justify-between">
            <span>
              Started:{" "}
              {run.startedAt
                ? new Date(run.startedAt).toLocaleString()
                : "Pending..."}
            </span>
            {run.completedAt && (
              <span>
                Duration:{" "}
                {Math.round(
                  (new Date(run.completedAt).getTime() -
                    new Date(run.startedAt ?? run.createdAt).getTime()) /
                    1000
                )}
                s
              </span>
            )}
          </div>
        </div>

        {/* Live View Banner */}
        {hasLiveView && (
          <div className="shrink-0 border-b bg-gradient-to-r from-purple-50 to-blue-50 px-6 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-100">
                  <svg className="h-5 w-5 text-purple-600" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
                  </svg>
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900">Live Browser View Available</h4>
                  <p className="text-sm text-gray-600">
                    Need to log in? Watch or control the browser directly to complete authentication.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowLiveView(true)}
                  className="flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
                  </svg>
                  Open Live View
                </button>
                <a
                  href={liveViewUrl ?? "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 rounded-lg border border-purple-300 bg-white px-3 py-2 text-sm text-purple-700 hover:bg-purple-50"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                    <polyline points="15 3 21 3 21 9" />
                    <line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                  New Tab
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Actions Stream */}
        <div className="min-h-0 flex-1 overflow-y-auto bg-gray-100 p-4">
          <div className="space-y-2">
            {sortedLogs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                {isActive && (
                  <>
                    <svg
                      className="mb-4 h-8 w-8 animate-spin"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    <span className="text-sm">Waiting for agent to start...</span>
                  </>
                )}
                {!isActive && <span className="text-sm">No actions recorded</span>}
              </div>
            ) : (
              <>
                {sortedLogs.map((log) => (
                  <ActionCard key={log.id} log={log} />
                ))}
                <div ref={logsEndRef} />
              </>
            )}
          </div>
        </div>

        {/* Error Message */}
        {run.errorMessage && (
          <div className="shrink-0 border-t bg-red-50 px-6 py-4">
            <div className="flex items-start gap-3">
              <svg
                className="h-5 w-5 shrink-0 text-red-500"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
              <div>
                <h4 className="font-semibold text-red-800">Error</h4>
                <p className="mt-1 text-sm text-red-700">{run.errorMessage}</p>
              </div>
            </div>
          </div>
        )}

        {/* Checkpoints (if any) */}
        {run.checkpoints.length > 0 && (
          <div className="shrink-0 border-t bg-gray-50 px-6 py-3">
            <h4 className="text-xs font-medium uppercase text-gray-500">
              Checkpoints ({run.checkpoints.length})
            </h4>
            <div className="mt-2 flex flex-wrap gap-2">
              {run.checkpoints.map((cp) => (
                <span
                  key={cp.id}
                  className="rounded bg-gray-200 px-2 py-1 text-xs text-gray-700"
                >
                  {cp.description ?? "Checkpoint"} -{" "}
                  {new Date(cp.createdAt).toLocaleTimeString()}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex shrink-0 items-center justify-between border-t bg-gray-50 px-6 py-4">
          <div className="text-xs text-gray-500">
            {isRunning && "Agent is executing..."}
            {isPaused && "Execution is paused"}
            {isPending && "Waiting in queue..."}
          </div>
          <div className="flex gap-3">
            {/* Pause/Resume button */}
            {isRunning && (
              <button
                onClick={() => void handlePause()}
                disabled={pauseMutation.isLoading}
                className="flex items-center gap-2 rounded-lg border border-orange-300 bg-orange-50 px-4 py-2 text-orange-600 hover:bg-orange-100 disabled:opacity-50"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                </svg>
                {pauseMutation.isLoading ? "Pausing..." : "Pause"}
              </button>
            )}
            {isPaused && (
              <button
                onClick={() => void handleResume()}
                disabled={resumeMutation.isLoading}
                className="flex items-center gap-2 rounded-lg border border-green-300 bg-green-50 px-4 py-2 text-green-600 hover:bg-green-100 disabled:opacity-50"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7L8 5z" />
                </svg>
                {resumeMutation.isLoading ? "Resuming..." : "Resume"}
              </button>
            )}

            {/* Cancel button */}
            {isActive && (
              <button
                onClick={() => void handleCancel()}
                disabled={cancelMutation.isLoading}
                className="flex items-center gap-2 rounded-lg border border-red-300 px-4 py-2 text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z" />
                </svg>
                {cancelMutation.isLoading ? "Cancelling..." : "Cancel"}
              </button>
            )}

            <button
              onClick={onClose}
              className="rounded-lg bg-black px-4 py-2 text-white hover:bg-gray-800"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {/* Live View Modal */}
      {showLiveView && liveViewUrl && (
        <LiveViewModal url={liveViewUrl} onClose={() => setShowLiveView(false)} />
      )}
    </div>
  );
}
