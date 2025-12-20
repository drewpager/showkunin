import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/router";
import { api } from "~/utils/api";
import ReactMarkdown from "react-markdown";


interface VideoAnalysisProps {
  videoId: string;
  initialAnalysis?: string | null;
  initialGeneratedAt?: Date | null;
  initialSolved?: boolean | null;
}

interface ComputerUseStep {
  action?: string;
  coordinate?: { x: number; y: number };
  [key: string]: unknown;
}

interface ComputerUsePlan {
  steps?: ComputerUseStep[];
  [key: string]: unknown;
}

const CodeBlock = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => {
  const [isCopied, setIsCopied] = useState(false);

  const copyToClipboard = async () => {
    if (!children) return;
    const text = String(children).replace(/\n$/, "");
    try {
      await navigator.clipboard.writeText(text);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <div className="group relative my-4 rounded-lg bg-gray-900">
      <div className="absolute right-2 top-2 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
        <button
          onClick={() => void copyToClipboard()}
          className="flex items-center gap-1 rounded-md bg-white/10 px-2 py-1 text-xs font-medium text-white backdrop-blur hover:bg-white/20"
        >
          {isCopied ? (
            <>
              <svg
                className="h-3 w-3 text-green-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              <span>Copied!</span>
            </>
          ) : (
            <>
              <svg
                className="h-3 w-3"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"
                />
              </svg>
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="custom-scrollbar overflow-x-auto p-4">
        <code className={`text-sm text-gray-100 ${className ?? ""}`}>
          {children}
        </code>
      </pre>
    </div>
  );
};

import { updateTaskInCache } from "~/utils/cacheUtils";

export default function VideoAnalysis({
  videoId,
  initialAnalysis,
  initialGeneratedAt,
  initialSolved,
}: VideoAnalysisProps) {
  const [isExpanded, setIsExpanded] = useState(!!initialAnalysis);
  const [refinementInput, setRefinementInput] = useState("");
  const [solved, setSolvedState] = useState<boolean | null>(initialSolved ?? null);
  const analyzeVideoMutation = api.video.analyzeVideo.useMutation();
  const setSolvedMutation = api.video.setSolved.useMutation();
  const utils = api.useContext();

  // Use saved analysis or mutation data
  const analysis = analyzeVideoMutation.data?.analysis ?? initialAnalysis;
  const generatedAt =
    analyzeVideoMutation.data?.generatedAt ?? initialGeneratedAt;

  const handleAnalyze = async () => {
    setIsExpanded(true);
    await analyzeVideoMutation.mutateAsync({ videoId });
    // Invalidate the video query to refresh the data
    await utils.video.get.invalidate({ videoId });
  };

  const handleRefine = async () => {
    if (!refinementInput.trim()) return;
    await analyzeVideoMutation.mutateAsync({
      videoId,
      refinementPrompt: refinementInput
    });
    setRefinementInput("");
    await utils.video.get.invalidate({ videoId });
  };

  const handleSolved = async (value: boolean) => {
    // Toggle off if clicking the same button
    const newValue = solved === value ? null : value;
    setSolvedState(newValue);
    updateTaskInCache(videoId, { solved: newValue });
    await setSolvedMutation.mutateAsync({
      videoId,
      solved: newValue,
    });
  };

  const router = useRouter();

  useEffect(() => {
    if (
      router.query.analyze === "true" &&
      !analysis &&
      !analyzeVideoMutation.isLoading &&
      !analyzeVideoMutation.data
    ) {
      void handleAnalyze();
      // Remove the query param to prevent re-triggering
      const { ...rest } = router.query;
      delete rest.analyze;
      void router.replace(
        {
          pathname: router.pathname,
          query: rest,
        },
        undefined,
        { shallow: true }
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.query.analyze, analysis, analyzeVideoMutation.isLoading, analyzeVideoMutation.data]);

  const { displayAnalysis, computerUsePlan } = useMemo(() => {
    if (!analysis) return { displayAnalysis: "", computerUsePlan: null as ComputerUsePlan | null };

    // Handle split with various separator formats
    let mainBody = analysis;
    let planString = "";

    const separators = ["---COMPUTER_USE_PLAN---", "---COMPUTER_USE_PLAN", "Section 2: Computer Use Instructions (JSON)"];
    for (const sep of separators) {
      if (analysis.includes(sep)) {
        const parts = analysis.split(sep);
        mainBody = parts[0] ?? "";
        planString = parts[1] ?? "";
        break;
      }
    }

    // Clean up markers from the main body
    const markersToStrip = [
      /^---ANALYSIS_START---/i,
      /^---/i,
      /^[[:punct:]]/i,
      /^---ANALYSIS_START/i,
      /^---ANALYSIS_END---/i,
      /---ANALYSIS_END/i,
      /^TITLE:.*\n?/i,
      /Section 1: User Analysis \(Markdown\)/i,
      /Section 2: Computer Use Instructions \(JSON\)/i,
    ];

    let cleanedBody = mainBody;
    for (const marker of markersToStrip) {
      cleanedBody = cleanedBody.replace(marker, "").trim();
    }

    let plan: ComputerUsePlan | null = null;
    if (planString) {
      try {
        let cleaned = planString.trim();
        // Remove markdown code fences if present
        if (cleaned.startsWith("```")) {
          cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
        }

        // Extremely robust: find the first { and last }
        const firstBrace = cleaned.indexOf("{");
        const lastBrace = cleaned.lastIndexOf("}");
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
          cleaned = cleaned.substring(firstBrace, lastBrace + 1);
        }

        plan = JSON.parse(cleaned.trim()) as ComputerUsePlan;
      } catch (e) {
        console.error("Failed to parse computer use plan", e);
      }
    }
    return { displayAnalysis: cleanedBody, computerUsePlan: plan };
  }, [analysis]);

  const [isAutomating, setIsAutomating] = useState(false);

  const handleImplementAutomation = async () => {
    if (!computerUsePlan) return;
    setIsAutomating(true);
    try {
      // Simulation of passing to Computer Use Agent
      console.log("Executing Computer Use Plan:", computerUsePlan);
      await new Promise((resolve) => setTimeout(resolve, 1500)); // Simulate delay
      alert("Automation instructions have been generated and passed to the Computer Use Agent runtime.");
    } catch (error) {
      console.error("Automation error:", error);
      alert("Failed to start automation.");
    } finally {
      setIsAutomating(false);
    }
  };

  const formatDate = (date: Date | null | undefined) => {
    if (!date) return "";
    return new Date(date).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  return (
    <div className="mt-6 mr-5 rounded-lg border border-gray-200 bg-white">
      {!analysis ? (
        <button
          onClick={() => void handleAnalyze()}
          disabled={analyzeVideoMutation.isLoading}
          className="flex w-full items-center justify-between rounded-lg bg-gradient-to-r from-black to-gray-600 px-6 py-4 text-left text-white transition-all hover:from-gray-600 hover:to-black disabled:opacity-50"
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
      ) : (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex w-full items-center justify-between rounded-t-lg bg-black px-6 py-4 text-left text-white transition-all hover:bg-gray-900"
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
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div>
              <h3 className="text-lg font-semibold">AI Automation Analysis</h3>
              <p className="text-sm text-white" suppressHydrationWarning>
                Generated {formatDate(generatedAt)} • Click to{" "}
                {isExpanded ? "collapse" : "expand"}
              </p>
            </div>
          </div>
          <svg
            className={`h-5 w-5 transition-transform ${isExpanded ? "rotate-180" : ""
              }`}
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
        </button>
      )}

      {/* Thumbs Up/Down Buttons - Always visible when analysis exists */}
      {analysis && (
        <div className="border-t border-gray-200 px-6 py-4 bg-gray-50">
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-gray-700">
              Did this analysis solve your problem?
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => void handleSolved(true)}
                className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${solved === true
                  ? "bg-green-600 text-white shadow-md"
                  : "bg-white text-gray-700 border border-gray-300 hover:bg-green-50 hover:border-green-300"
                  }`}
                title="Thumbs up - This solved my problem"
              >
                <svg
                  className="h-5 w-5"
                  fill={solved === true ? "currentColor" : "none"}
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5"
                  />
                </svg>
                <span>Yes</span>
              </button>
              <button
                onClick={() => void handleSolved(false)}
                className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${solved === false
                  ? "bg-red-600 text-white shadow-md"
                  : "bg-white text-gray-700 border border-gray-300 hover:bg-red-50 hover:border-red-300"
                  }`}
                title="Thumbs down - This didn't solve my problem"
              >
                <svg
                  className="h-5 w-5"
                  fill={solved === false ? "currentColor" : "none"}
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018a2 2 0 01.485.06l3.76.94m-7 10v5a2 2 0 002 2h.096c.5 0 .905-.405.905-.904 0-.715.211-1.413.608-2.008L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5"
                  />
                </svg>
                <span>No</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {isExpanded && (
        <div className="border-t border-gray-200 p-6">
          {analyzeVideoMutation.isLoading && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-gray-300 border-t-gray-600" />
              <p className="text-gray-600">
                {analyzeVideoMutation.variables?.refinementPrompt
                  ? "Refining analysis based on your request..."
                  : "Analyzing your video with Gemini AI..."}
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

          {analysis && !analyzeVideoMutation.isLoading && (
            <>
              {computerUsePlan && (
                <div className="mb-6 rounded-lg bg-gray-50 p-4 border border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-md font-bold text-gray-900">Implementation Coming Soon to Pro Plans!</h3>
                      <p className="text-sm text-gray-700">Detailed instructions generated for Computer Use Model ({computerUsePlan.steps?.length || 0} steps).</p>
                    </div>
                    <button
                      onClick={() => void handleImplementAutomation()}
                      // disabled={isAutomating}
                      disabled={true}
                      className="flex items-center gap-2 rounded-md bg-black px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50"
                    >
                      {isAutomating ? (
                        <>
                          <svg className="h-4 w-4 animate-spin text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          <span>Running...</span>
                        </>
                      ) : (
                        <>
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span>Implement Automation</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
              <div className="prose prose-sm max-w-none">
                <ReactMarkdown
                  components={{
                    pre: ({ children }) => <>{children}</>,
                    h1: ({ node: _node, ...props }) => (
                      <h1
                        className="text-2xl font-bold text-gray-900"
                        {...props}
                      />
                    ),
                    h2: ({ node: _node, ...props }) => (
                      <h2
                        className="text-xl font-semibold text-gray-800"
                        {...props}
                      />
                    ),
                    h3: ({ node: _node, ...props }) => (
                      <h3
                        className="text-lg font-semibold text-gray-800"
                        {...props}
                      />
                    ),
                    p: ({ node: _node, ...props }) => (
                      <p className="text-gray-700" {...props} />
                    ),
                    code: ({ node: _node, inline, className, children, ...props }: { node?: unknown; inline?: boolean; className?: string; children?: React.ReactNode } & Record<string, unknown>) =>
                      inline ? (
                        <code
                          className="rounded bg-gray-100 px-1.5 py-0.5 text-sm text-purple-700"
                          {...props}
                        >
                          {children}
                        </code>
                      ) : (
                        <CodeBlock className={className}>
                          {children}
                        </CodeBlock>
                      ),
                    ul: ({ node: _node, ...props }) => (
                      <ul className="list-disc space-y-1 pl-5" {...props} />
                    ),
                    ol: ({ node: _node, ...props }) => (
                      <ol className="list-decimal space-y-1 pl-5" {...props} />
                    ),
                    li: ({ node: _node, ...props }) => (
                      <li className="text-gray-700" {...props} />
                    ),
                    strong: ({ node: _node, ...props }) => (
                      <strong
                        className="font-semibold text-gray-900"
                        {...props}
                      />
                    ),
                  }}
                >
                  {displayAnalysis}
                </ReactMarkdown>
              </div>

              {/* Refinement Input */}
              <div className="mt-8 border-t border-gray-200 pt-6">
                <h2 className="mb-3 text-lg font-medium text-gray-900">Refine Analysis</h2>
                <div className="flex gap-3">
                  <textarea
                    value={refinementInput}
                    onChange={(e) => setRefinementInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void handleRefine();
                      }
                    }}
                    placeholder="Ask a follow-up question or request changes (e.g., 'Focus on the API calls', 'Convert code to Python')"
                    className="flex-1 min-h-600 rounded-lg p-4 border-2 border-black shadow-sm focus:border-black focus:ring-black focus:ring-offset-2 sm:text-sm"
                    disabled={analyzeVideoMutation.isLoading}
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => void handleRefine()}
                    disabled={analyzeVideoMutation.isLoading || !refinementInput.trim()}
                    className="inline-flex items-center rounded-lg mt-3 bg-black px-4 py-2 text-md font-medium text-white hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 disabled:opacity-50"
                  >
                    {analyzeVideoMutation.isLoading ? (
                      <svg className="h-5 w-5 animate-spin text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    ) : (
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    )}
                    <span className="ml-2">Refine</span>
                  </button>
                  {/* Regenerate Button (Secondary) */}
                  <div className="mt-4 flex justify-center">
                    <button
                      onClick={() => void handleAnalyze()}
                      disabled={analyzeVideoMutation.isLoading}
                      className="text-sm text-gray-500 hover:text-black hover:underline"
                    >
                      Regenerate completely
                    </button>
                  </div>
                </div>
              </div>

            </>
          )}
        </div>
      )}
    </div>
  );
}
