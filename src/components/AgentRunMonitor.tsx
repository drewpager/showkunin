import React, { useEffect, useRef } from "react";
import { api } from "~/utils/api";

interface AgentRunMonitorProps {
  runId: string;
  onClose: () => void;
}

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  running: "bg-blue-100 text-blue-800",
  completed: "bg-green-100 text-green-800",
  failed: "bg-red-100 text-red-800",
  cancelled: "bg-gray-100 text-gray-800",
};

const statusLabels: Record<string, string> = {
  pending: "Pending",
  running: "Running",
  completed: "Completed",
  failed: "Failed",
  cancelled: "Cancelled",
};

export default function AgentRunMonitor({
  runId,
  onClose,
}: AgentRunMonitorProps) {
  const logsEndRef = useRef<HTMLDivElement>(null);

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
        return 3000; // Poll every 3 seconds
      },
    }
  );

  const cancelMutation = api.video.cancelAgentRun.useMutation();

  const handleCancel = async () => {
    try {
      await cancelMutation.mutateAsync({ runId });
    } catch (error) {
      console.error("Failed to cancel run:", error);
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

  const isRunning = run.status === "pending" || run.status === "running";
  const sortedLogs = [...run.logs].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg bg-white shadow-xl">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b px-6 py-4">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold text-gray-900">
              Agent Execution
            </h3>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[run.status] ?? "bg-gray-100 text-gray-800"}`}
            >
              {statusLabels[run.status] ?? run.status}
            </span>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
          >
            <svg
              className="h-6 w-6"
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
        <div className="shrink-0 border-b bg-gray-50 px-6 py-2 text-xs text-gray-500">
          <span>
            Started:{" "}
            {run.startedAt
              ? new Date(run.startedAt).toLocaleString()
              : "Pending..."}
          </span>
          {run.completedAt && (
            <span className="ml-4">
              Completed: {new Date(run.completedAt).toLocaleString()}
            </span>
          )}
        </div>

        {/* Logs */}
        <div className="min-h-0 flex-1 overflow-y-auto bg-gray-900 p-4">
          <div className="font-mono text-sm">
            {sortedLogs.length === 0 ? (
              <div className="flex items-center gap-2 text-gray-500">
                {isRunning && (
                  <svg
                    className="h-4 w-4 animate-spin"
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
                )}
                <span>Waiting for logs...</span>
              </div>
            ) : (
              <div className="space-y-1">
                {sortedLogs.map((log) => (
                  <div
                    key={log.id}
                    className={`${
                      log.level === "error"
                        ? "text-red-400"
                        : log.level === "debug"
                          ? "text-gray-500"
                          : "text-green-400"
                    }`}
                  >
                    <span className="text-gray-500">
                      [{new Date(log.timestamp).toLocaleTimeString()}]
                    </span>{" "}
                    <span className="text-gray-400">
                      [{log.level.toUpperCase()}]
                    </span>{" "}
                    <span className="break-words">{log.message}</span>
                  </div>
                ))}
                <div ref={logsEndRef} />
              </div>
            )}
          </div>
        </div>

        {/* Error Message */}
        {run.errorMessage && (
          <div className="shrink-0 border-t bg-red-50 px-6 py-4">
            <h4 className="font-semibold text-red-800">Error</h4>
            <p className="mt-1 text-sm text-red-700">{run.errorMessage}</p>
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
        <div className="flex shrink-0 justify-end gap-3 border-t px-6 py-4">
          {isRunning && (
            <button
              onClick={() => void handleCancel()}
              disabled={cancelMutation.isLoading}
              className="rounded-lg border border-red-300 px-4 py-2 text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
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
  );
}
