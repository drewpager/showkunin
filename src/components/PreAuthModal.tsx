import React from "react";

interface PreAuthModalProps {
  provider: string;
  liveViewUrl: string | null;
  isLoading: boolean;
  onComplete: () => void;
  onSkip: () => void;
  onClose: () => void;
}

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
  generic: "the target website",
};

const defaultColors = { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200" };

const providerColors: Record<string, { bg: string; text: string; border: string }> = {
  google: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
  github: { bg: "bg-gray-50", text: "text-gray-700", border: "border-gray-200" },
  microsoft: { bg: "bg-sky-50", text: "text-sky-700", border: "border-sky-200" },
  generic: defaultColors,
};

export default function PreAuthModal({
  provider,
  liveViewUrl,
  isLoading,
  onComplete,
  onSkip,
  onClose,
}: PreAuthModalProps) {
  const displayName = providerDisplayNames[provider] ?? provider;
  const colors = providerColors[provider] ?? defaultColors;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
        {/* Header */}
        <div className={`flex shrink-0 items-center justify-between border-b ${colors.bg} px-6 py-4`}>
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-full ${colors.bg} border ${colors.border}`}>
              <svg
                className={`h-5 w-5 ${colors.text}`}
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                Sign in to {displayName}
              </h3>
              <p className="text-sm text-gray-600">
                Complete authentication to enable automation
              </p>
            </div>
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

        {/* Instructions */}
        <div className="shrink-0 border-b bg-white px-6 py-4">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-yellow-100 text-yellow-600">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
              </svg>
            </div>
            <div>
              <h4 className="font-medium text-gray-900">
                Pre-authentication Required
              </h4>
              <p className="mt-1 text-sm text-gray-600">
                The automation needs access to {displayName}. Please sign in using
                the browser window below. Your login session will be saved securely
                for future automations.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <div className="flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1 text-xs text-green-700">
                  <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z" />
                  </svg>
                  Secure session storage
                </div>
                <div className="flex items-center gap-1.5 rounded-full bg-blue-100 px-3 py-1 text-xs text-blue-700">
                  <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z" />
                  </svg>
                  Reused across automations
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Browser iframe */}
        <div className="flex-1 bg-gray-900">
          {isLoading ? (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <svg
                  className="mx-auto h-8 w-8 animate-spin text-white"
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
                <p className="mt-3 text-sm text-gray-400">
                  Starting browser session...
                </p>
              </div>
            </div>
          ) : liveViewUrl ? (
            <iframe
              src={liveViewUrl}
              className="h-full w-full border-0"
              style={{ minHeight: "400px" }}
              allow="clipboard-read; clipboard-write"
              title={`Sign in to ${displayName}`}
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <div className="text-center text-gray-400">
                <svg
                  className="mx-auto h-12 w-12"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
                <p className="mt-2 text-sm">
                  Failed to load browser session
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex shrink-0 items-center justify-between border-t bg-gray-50 px-6 py-4">
          <p className="text-sm text-gray-500">
            Complete sign-in, then click &quot;I&apos;ve Signed In&quot;
          </p>
          <div className="flex gap-3">
            <button
              onClick={onSkip}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Skip (Try Without Auth)
            </button>
            <button
              onClick={onComplete}
              disabled={isLoading || !liveViewUrl}
              className="flex items-center gap-2 rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
              </svg>
              I&apos;ve Signed In
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
