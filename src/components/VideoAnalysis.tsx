import { useState } from "react";
import { api } from "~/utils/api";
import ReactMarkdown from "react-markdown";

interface VideoAnalysisProps {
  videoId: string;
}

export default function VideoAnalysis({ videoId }: VideoAnalysisProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const analyzeVideoMutation = api.video.analyzeVideo.useMutation();

  const handleAnalyze = async () => {
    setIsExpanded(true);
    await analyzeVideoMutation.mutateAsync({ videoId });
  };

  return (
    <div className="mt-6 rounded-lg border border-gray-200 bg-white">
      <button
        onClick={handleAnalyze}
        disabled={analyzeVideoMutation.isLoading}
        className="flex w-full items-center justify-between rounded-t-lg bg-gradient-to-r from-purple-600 to-blue-600 px-6 py-4 text-left text-white transition-all hover:from-purple-700 hover:to-blue-700 disabled:opacity-50"
      >
        <div className="flex items-center gap-3">
          <svg
            className="h-6 w-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
            />
          </svg>
          <div>
            <h3 className="text-lg font-semibold">
              {analyzeVideoMutation.isLoading
                ? "Analyzing with AI..."
                : "Get AI Automation Suggestions"}
            </h3>
            <p className="text-sm text-purple-100">
              Powered by Gemini - Analyze this video to get automation ideas
            </p>
          </div>
        </div>
        {analyzeVideoMutation.isLoading && (
          <svg
            className="h-5 w-5 animate-spin"
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
      </button>

      {isExpanded && (
        <div className="border-t border-gray-200 p-6">
          {analyzeVideoMutation.isLoading && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-purple-200 border-t-purple-600" />
              <p className="text-gray-600">
                Analyzing your video with Gemini AI...
              </p>
              <p className="mt-2 text-sm text-gray-500">
                This may take a minute
              </p>
            </div>
          )}

          {analyzeVideoMutation.error && (
            <div className="rounded-lg bg-red-50 p-4 text-red-800">
              <h4 className="font-semibold">Error analyzing video</h4>
              <p className="mt-1 text-sm">
                {analyzeVideoMutation.error.message}
              </p>
            </div>
          )}

          {analyzeVideoMutation.data && (
            <div className="prose prose-sm max-w-none">
              <ReactMarkdown
                components={{
                  h1: ({ node, ...props }) => (
                    <h1 className="text-2xl font-bold text-gray-900" {...props} />
                  ),
                  h2: ({ node, ...props }) => (
                    <h2 className="text-xl font-semibold text-gray-800" {...props} />
                  ),
                  h3: ({ node, ...props }) => (
                    <h3 className="text-lg font-semibold text-gray-800" {...props} />
                  ),
                  p: ({ node, ...props }) => (
                    <p className="text-gray-700" {...props} />
                  ),
                  code: ({ node, inline, ...props }) =>
                    inline ? (
                      <code
                        className="rounded bg-gray-100 px-1.5 py-0.5 text-sm text-purple-700"
                        {...props}
                      />
                    ) : (
                      <code
                        className="block rounded-lg bg-gray-900 p-4 text-sm text-gray-100"
                        {...props}
                      />
                    ),
                  ul: ({ node, ...props }) => (
                    <ul className="list-disc space-y-1 pl-5" {...props} />
                  ),
                  ol: ({ node, ...props }) => (
                    <ol className="list-decimal space-y-1 pl-5" {...props} />
                  ),
                  li: ({ node, ...props }) => (
                    <li className="text-gray-700" {...props} />
                  ),
                  strong: ({ node, ...props }) => (
                    <strong className="font-semibold text-gray-900" {...props} />
                  ),
                }}
              >
                {analyzeVideoMutation.data.analysis}
              </ReactMarkdown>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
