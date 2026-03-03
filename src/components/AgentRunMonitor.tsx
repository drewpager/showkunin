import React, { useEffect, useRef, useState, useCallback } from "react";
import { api } from "~/utils/api";
import ReactMarkdown from "react-markdown";

interface AgentRunMonitorProps {
  runId: string;
  onClose: () => void;
}

// Provider display names - defined early so hooks can use it
const providerDisplayNames: Record<string, string> = {
  google: "Google",
  github: "GitHub",
  microsoft: "Microsoft",
  facebook: "Facebook",
  twitter: "X (Twitter)",
  linkedin: "LinkedIn",
  slack: "Slack",
  notion: "Notion",
  atlassian: "Atlassian",
  generic: "the website",
};

// Custom hook for flashing tab title when auth is required
function useTabTitleFlash(isAuthRequired: boolean, provider: string | null) {
  const originalTitleRef = useRef<string>("");
  const flashIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (typeof document === "undefined") return;

    if (isAuthRequired && provider) {
      // Store original title
      if (!originalTitleRef.current) {
        originalTitleRef.current = document.title;
      }

      let isAlternate = false;
      const flashTitle = `⚠️ AUTH REQUIRED: ${provider.toUpperCase()}`;

      flashIntervalRef.current = setInterval(() => {
        document.title = isAlternate ? originalTitleRef.current : flashTitle;
        isAlternate = !isAlternate;
      }, 1000);

      return () => {
        if (flashIntervalRef.current) {
          clearInterval(flashIntervalRef.current);
          flashIntervalRef.current = null;
        }
        document.title = originalTitleRef.current;
      };
    } else {
      // Restore original title
      if (flashIntervalRef.current) {
        clearInterval(flashIntervalRef.current);
        flashIntervalRef.current = null;
      }
      if (originalTitleRef.current) {
        document.title = originalTitleRef.current;
      }
    }
  }, [isAuthRequired, provider]);
}

// Custom hook for playing notification sound and showing browser notification
function useAuthNotificationSound(isAuthRequired: boolean, provider: string | null) {
  const hasPlayedRef = useRef(false);
  const hasNotifiedRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (isAuthRequired && !hasPlayedRef.current) {
      hasPlayedRef.current = true;

      // Play a notification sound using Web Audio API
      try {
        const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        // Create a pleasant two-tone notification
        oscillator.frequency.setValueAtTime(587.33, audioContext.currentTime); // D5
        oscillator.frequency.setValueAtTime(880, audioContext.currentTime + 0.15); // A5

        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.5);
      } catch {
        // Silently fail if audio context is not available
        console.log("Could not play notification sound");
      }

      // Show browser notification if page is not visible
      if (!hasNotifiedRef.current && document.hidden) {
        hasNotifiedRef.current = true;
        const providerName = provider ? (providerDisplayNames[provider] ?? provider) : "the website";

        // Request permission and show notification
        if ("Notification" in window) {
          if (Notification.permission === "granted") {
            new Notification("🔐 Authentication Required", {
              body: `Please sign in to ${providerName} to continue the automation.`,
              icon: "/favicon.ico",
              tag: "auth-required",
              requireInteraction: true,
            });
          } else if (Notification.permission !== "denied") {
            void Notification.requestPermission().then((permission) => {
              if (permission === "granted") {
                new Notification("🔐 Authentication Required", {
                  body: `Please sign in to ${providerName} to continue the automation.`,
                  icon: "/favicon.ico",
                  tag: "auth-required",
                  requireInteraction: true,
                });
              }
            });
          }
        }
      }
    } else if (!isAuthRequired) {
      // Reset so we can play again next time auth is required
      hasPlayedRef.current = false;
      hasNotifiedRef.current = false;
    }
  }, [isAuthRequired, provider]);
}

interface LiveViewModalProps {
  url: string;
  onClose: () => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

function LiveViewModal({ url, onClose, onRefresh, isRefreshing }: LiveViewModalProps) {
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
            {onRefresh && (
              <button
                onClick={onRefresh}
                disabled={isRefreshing}
                className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                title="Refresh live view URL"
              >
                <svg
                  className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M21 12a9 9 0 11-3.219-6.885M21 3v6h-6" />
                </svg>
                {isRefreshing ? "Refreshing..." : "Refresh"}
              </button>
            )}
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

// Timeout progress component
function TimeoutProgressBar({
  startedAt,
  maxDurationMs,
  lastProgressAt
}: {
  startedAt: Date | null;
  maxDurationMs: number | null;
  lastProgressAt: Date | null;
}) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  if (!startedAt) return null;

  const maxDuration = maxDurationMs ?? 300000; // 5 min default
  const elapsed = now - new Date(startedAt).getTime();
  const progressPercent = Math.min((elapsed / maxDuration) * 100, 100);
  const remainingSeconds = Math.max(0, Math.floor((maxDuration - elapsed) / 1000));

  // Check for stall warning (no progress for 2+ minutes)
  const timeSinceProgress = lastProgressAt
    ? now - new Date(lastProgressAt).getTime()
    : elapsed;
  const isStalling = timeSinceProgress > 120000; // 2 minutes

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="shrink-0 border-b bg-white px-6 py-2">
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>Time remaining: {formatTime(remainingSeconds)}</span>
        {isStalling && (
          <span className="flex items-center gap-1 text-orange-600">
            <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
            </svg>
            No progress for {Math.floor(timeSinceProgress / 1000)}s
          </span>
        )}
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
        <div
          className={`h-full transition-all duration-500 ${
            progressPercent > 80
              ? 'bg-red-500'
              : progressPercent > 50
                ? 'bg-yellow-500'
                : 'bg-blue-500'
          }`}
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    </div>
  );
}

// Success validation status component
function ValidationStatus({
  successValidated,
  status
}: {
  successValidated: boolean | null;
  status: string;
}) {
  if (status !== 'completed' && status !== 'failed') return null;

  return (
    <div className={`shrink-0 border-t px-6 py-3 ${
      successValidated
        ? 'bg-green-50'
        : successValidated === false
          ? 'bg-yellow-50'
          : 'bg-gray-50'
    }`}>
      <div className="flex items-center gap-2">
        {successValidated ? (
          <>
            <svg className="h-4 w-4 text-green-600" viewBox="0 0 24 24" fill="currentColor">
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
            </svg>
            <span className="text-sm font-medium text-green-700">
              Success validated - automation completed correctly
            </span>
          </>
        ) : successValidated === false ? (
          <>
            <svg className="h-4 w-4 text-yellow-600" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
            </svg>
            <span className="text-sm font-medium text-yellow-700">
              Validation warning - review results manually
            </span>
          </>
        ) : null}
      </div>
    </div>
  );
}

// Auth Required Banner component
function AuthRequiredBanner({
  provider,
  liveViewUrl,
  onOpenLiveView,
  onResume,
  isResuming,
}: {
  provider: string;
  liveViewUrl: string | null;
  onOpenLiveView: () => void;
  onResume: () => void;
  isResuming: boolean;
}) {
  const displayName = providerDisplayNames[provider] ?? provider;

  return (
    <div className="shrink-0 border-b bg-gradient-to-r from-orange-100 via-red-100 to-orange-100 px-6 py-4 animate-pulse">
      <div className="flex flex-col gap-4">
        {/* Alert Header */}
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500 animate-bounce">
            <svg className="h-6 w-6 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-red-800">
              🔐 Authentication Required - Action Needed!
            </h3>
            <p className="text-sm text-red-700">
              {displayName} login has been detected. The automation is <strong>PAUSED</strong> and waiting for you to sign in.
            </p>
          </div>
        </div>

        {/* Instructions */}
        <div className="rounded-lg bg-white/80 p-4 border border-red-200">
          <h4 className="font-semibold text-gray-900 mb-2">What to do:</h4>
          <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
            <li><strong>Click &quot;Open Live View&quot;</strong> below to access the browser session</li>
            <li>Complete the {displayName} sign-in process (including any 2FA/CAPTCHA)</li>
            <li>Once signed in successfully, click <strong>&quot;I&apos;ve Signed In - Resume&quot;</strong></li>
          </ol>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-3">
          {liveViewUrl ? (
            <>
              <button
                onClick={onOpenLiveView}
                className="flex items-center gap-2 rounded-lg bg-red-600 px-6 py-3 text-base font-bold text-white shadow-lg hover:bg-red-700 animate-pulse ring-4 ring-red-300 ring-opacity-50"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
                </svg>
                Open Live View to Sign In
              </button>
              <a
                href={liveViewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-lg border-2 border-red-400 bg-white px-4 py-3 text-sm font-medium text-red-700 hover:bg-red-50"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
                Open in New Tab
              </a>
            </>
          ) : (
            <span className="text-sm text-gray-500 italic">
              Live View not available - browser session may have closed
            </span>
          )}

          <div className="flex-1" />

          <button
            onClick={onResume}
            disabled={isResuming}
            className="flex items-center gap-2 rounded-lg bg-green-600 px-6 py-3 text-base font-semibold text-white shadow hover:bg-green-700 disabled:opacity-50"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
            </svg>
            {isResuming ? "Resuming..." : "I've Signed In - Resume"}
          </button>
        </div>
      </div>
    </div>
  );
}

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

          <div className={`mt-1 text-sm ${colors.text} break-words prose prose-sm max-w-none [&_p]:my-0.5 [&_strong]:font-semibold [&_code]:bg-gray-100 [&_code]:px-1 [&_code]:rounded [&_ul]:my-1 [&_li]:my-0`}>
            <ReactMarkdown>{log.message}</ReactMarkdown>
          </div>

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
  const [refreshedLiveViewUrl, setRefreshedLiveViewUrl] = useState<string | null>(null);
  const [isRefreshingUrl, setIsRefreshingUrl] = useState(false);

  const { data: run, isLoading, refetch } = api.video.getAgentRun.useQuery(
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
  const refreshUrlMutation = api.video.refreshLiveViewUrl.useMutation();

  // Extract auth required state from run data
  const authRequired = (run as { authRequired?: string | null } | undefined)?.authRequired ?? null;
  const isAuthRequired = Boolean(authRequired && run?.status === "paused");

  // Use notification hooks for auth required state
  useTabTitleFlash(isAuthRequired, authRequired);
  useAuthNotificationSound(isAuthRequired, authRequired);

  // Handle resume after auth completion
  const handleAuthResume = useCallback(async () => {
    try {
      await resumeMutation.mutateAsync({ runId });
      // Refetch to get updated state
      void refetch();
    } catch (error) {
      console.error("Failed to resume after auth:", error);
    }
  }, [resumeMutation, runId, refetch]);

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

  // Handler to open live view with fresh URL
  const handleOpenLiveView = useCallback(async () => {
    setIsRefreshingUrl(true);
    try {
      // Refresh the URL before opening the modal
      const result = await refreshUrlMutation.mutateAsync({ runId });
      setRefreshedLiveViewUrl(result.liveViewUrl);
      setShowLiveView(true);
    } catch (error) {
      console.error("Failed to refresh live view URL:", error);
      // Fall back to the stored URL if refresh fails
      const storedUrl = (run as { liveViewUrl?: string | null } | undefined)?.liveViewUrl;
      if (storedUrl) {
        setRefreshedLiveViewUrl(storedUrl);
        setShowLiveView(true);
      }
    } finally {
      setIsRefreshingUrl(false);
    }
  }, [runId, refreshUrlMutation, run]);

  // Handler to refresh URL while modal is open
  const handleRefreshUrl = useCallback(async () => {
    setIsRefreshingUrl(true);
    try {
      const result = await refreshUrlMutation.mutateAsync({ runId });
      setRefreshedLiveViewUrl(result.liveViewUrl);
    } catch (error) {
      console.error("Failed to refresh live view URL:", error);
    } finally {
      setIsRefreshingUrl(false);
    }
  }, [runId, refreshUrlMutation]);

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

  // Sort logs for display
  const sortedLogs = [...run.logs].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  // Live view is available when we have a URL OR a session ID and the run is active
  const liveViewUrl = (run as { liveViewUrl?: string | null }).liveViewUrl;
  const browserbaseSessionId = (run as { browserbaseSessionId?: string | null }).browserbaseSessionId;

  // Check logs for session creation as a fallback indicator
  // This handles the case where the database hasn't been polled yet but logs show session is ready
  const sessionReadyFromLogs = sortedLogs.some(log =>
    log.message.includes("Live View available") ||
    log.message.includes("Stagehand session created") ||
    log.message.includes("Browser session created")
  );

  // Show Live View banner if we have a session ID OR liveViewUrl, and run is active
  // This ensures buttons show even if we couldn't get the live view URL initially
  const hasLiveView = Boolean((liveViewUrl || browserbaseSessionId) && isActive);

  // Show "waiting for browser" when active but no session yet
  // Also check logs as a fallback - if logs show session is ready, don't show waiting banner
  const isWaitingForBrowser = isActive && !browserbaseSessionId && !sessionReadyFromLogs;

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
              className={`rounded-full px-3 py-1 text-sm font-medium ${
                isAuthRequired
                  ? "bg-red-100 text-red-800"
                  : statusColors[run.status] ?? "bg-gray-100 text-gray-800"
              }`}
            >
              {isAuthRequired && (
                <span className="mr-1 inline-block h-2 w-2 animate-ping rounded-full bg-red-500" />
              )}
              {isPaused && !isAuthRequired && (
                <span className="mr-1 inline-block h-2 w-2 animate-pulse rounded-full bg-orange-500" />
              )}
              {isRunning && (
                <span className="mr-1 inline-block h-2 w-2 animate-pulse rounded-full bg-blue-500" />
              )}
              {isAuthRequired ? "🔐 Auth Required" : statusLabels[run.status] ?? run.status}
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

        {/* Timeout Progress Bar - show when running */}
        {isRunning && (
          <TimeoutProgressBar
            startedAt={run.startedAt}
            maxDurationMs={(run as { maxDurationMs?: number | null }).maxDurationMs ?? null}
            lastProgressAt={(run as { lastProgressAt?: Date | null }).lastProgressAt ?? null}
          />
        )}

        {/* Auth Required Banner - highest priority, shows when auth is needed */}
        {isAuthRequired && authRequired && (
          <AuthRequiredBanner
            provider={authRequired}
            liveViewUrl={liveViewUrl ?? null}
            onOpenLiveView={() => void handleOpenLiveView()}
            onResume={() => void handleAuthResume()}
            isResuming={resumeMutation.isLoading}
          />
        )}

        {/* Waiting for Browser Banner - shows when session is being created */}
        {isWaitingForBrowser && !isAuthRequired && (
          <div className="shrink-0 border-b bg-gradient-to-r from-gray-50 to-blue-50 px-6 py-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                <svg className="h-5 w-5 animate-spin text-blue-600" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              </div>
              <div>
                <h4 className="font-semibold text-gray-900">Starting Browser Session...</h4>
                <p className="text-sm text-gray-600">
                  Live View will be available once the browser starts. This usually takes a few seconds.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Live View Banner - shows when browser session is available */}
        {hasLiveView && !isAuthRequired && (
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
                  onClick={() => void handleOpenLiveView()}
                  disabled={isRefreshingUrl}
                  className="flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
                >
                  {isRefreshingUrl ? (
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  ) : (
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
                    </svg>
                  )}
                  {isRefreshingUrl ? "Loading..." : "Open Live View"}
                </button>
                {liveViewUrl && (
                  <a
                    href={liveViewUrl}
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
                )}
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

        {/* Success Validation Status */}
        <ValidationStatus
          successValidated={(run as { successValidated?: boolean | null }).successValidated ?? null}
          status={run.status}
        />

        {/* Actions */}
        <div className="flex shrink-0 items-center justify-between border-t bg-gray-50 px-6 py-4">
          <div className="text-xs text-gray-500">
            {isRunning && "Agent is executing..."}
            {isPaused && isAuthRequired && (
              <span className="font-medium text-red-600">
                ⚠️ Waiting for authentication - please sign in via Live View
              </span>
            )}
            {isPaused && !isAuthRequired && "Execution is paused"}
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
            {isPaused && !isAuthRequired && (
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
            {/* Special resume button for auth-required state - more prominent */}
            {isPaused && isAuthRequired && (
              <button
                onClick={() => void handleAuthResume()}
                disabled={resumeMutation.isLoading}
                className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-white hover:bg-green-700 disabled:opacity-50"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                </svg>
                {resumeMutation.isLoading ? "Resuming..." : "Auth Done - Resume"}
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
      {showLiveView && refreshedLiveViewUrl && (
        <LiveViewModal
          url={refreshedLiveViewUrl}
          onClose={() => setShowLiveView(false)}
          onRefresh={() => void handleRefreshUrl()}
          isRefreshing={isRefreshingUrl}
        />
      )}
    </div>
  );
}
