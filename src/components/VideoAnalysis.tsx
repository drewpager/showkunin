import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import { api } from "~/utils/api";
import ReactMarkdown from "react-markdown";
import dynamic from "next/dynamic";
import { TrashIcon } from "@radix-ui/react-icons";

// Import ScreencastRecorder dynamically with SSR disabled to prevent navigator errors
const ScreencastRecorder = dynamic(
  () => import("~/components/ScreencastRecorder"),
  { ssr: false }
);


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

const Skeleton = ({ className }: { className?: string }) => (
  <div className={`animate-pulse rounded bg-gray-200 ${className ?? ""}`} />
);

const AnalysisSkeleton = () => (
  <div className="space-y-8 py-4">
    {/* Header Skeleton */}
    <div className="space-y-3">
      <Skeleton className="h-9 w-3/4" />
      <Skeleton className="h-5 w-1/2" />
    </div>

    {/* Section 1: Content Skeleton */}
    <div className="space-y-4">
      <div className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
      </div>

      <div className="space-y-3 pl-5">
        <div className="flex items-center gap-3">
          <Skeleton className="h-2 w-2 rounded-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-2 w-2 rounded-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </div>
    </div>

    {/* Code/Automation Block Skeleton */}
    <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-10 w-32 rounded-lg" />
      </div>
      <Skeleton className="h-32 w-full rounded-lg" />
    </div>

    {/* Section 2: Further Analysis Skeleton */}
    <div className="space-y-4">
      <Skeleton className="h-7 w-1/3" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
      </div>
    </div>
  </div>
);

export default function VideoAnalysis({
  videoId,
  initialAnalysis,
  initialGeneratedAt,
  initialSolved,
}: VideoAnalysisProps) {
  const [isExpanded, setIsExpanded] = useState(!!initialAnalysis);
  const [refinementInput, setRefinementInput] = useState("");
  const [solved, setSolvedState] = useState<boolean | null>(initialSolved ?? null);
  const [isScreencastRecorderOpen, setIsScreencastRecorderOpen] = useState(false);
  const [screencastBlob, setScreencastBlob] = useState<Blob | null>(null);
  const analyzeVideoMutation = api.video.analyzeVideo.useMutation();
  const analyzeScreencastMutation = api.video.analyzeScreencastUpdate.useMutation();
  const setSolvedMutation = api.video.setSolved.useMutation();
  const utils = api.useContext();
  const { data: session } = useSession();

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

  const handleScreencastUpdate = async () => {
    if (!screencastBlob) return;

    // Convert blob to base64
    const reader = new FileReader();
    reader.readAsDataURL(screencastBlob);
    reader.onloadend = async () => {
      const base64data = reader.result as string;
      // Remove the data:video/webm;base64, prefix
      const base64Video = base64data.split(',')[1] ?? '';

      await analyzeScreencastMutation.mutateAsync({
        videoId,
        videoBlob: base64Video,
        refinementPrompt: refinementInput.length > 0 ? refinementInput : undefined,
      });

      setRefinementInput("");
      setScreencastBlob(null);
      await utils.video.get.invalidate({ videoId });
    };
  };

  const handleScreencastRecorded = (blob: Blob) => {
    setScreencastBlob(blob);
    setIsScreencastRecorderOpen(false);
  };

  const handleScreencastCancel = () => {
    setIsScreencastRecorderOpen(false);
  };

  const handleSolved = async (value: boolean) => {
    // Toggle off if clicking the same button
    const newValue = solved === value ? null : value;
    setSolvedState(newValue);
    updateTaskInCache(videoId, { solved: newValue }, session?.user?.id);
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
    <div className="mt-6 md:mr-5 rounded-lg border border-gray-200 bg-white">
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
              <h3 className="text-lg font-semibold">{analyzeVideoMutation.isLoading ? "Analyzing with AI..." : "AI Automation Analysis"}</h3>
              <p className="text-sm text-white" suppressHydrationWarning>
                {analyzeVideoMutation.isLoading ? "This may take a minute..." : "Generated " + formatDate(generatedAt)} • Click to{" "}
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
          {analyzeVideoMutation.isLoading && !analyzeVideoMutation.variables?.refinementPrompt && (
            <AnalysisSkeleton />
          )}

          {analyzeVideoMutation.error && (
            <div className="rounded-lg bg-red-50 p-4 text-red-800">
              <h4 className="font-semibold">Error analyzing video</h4>
              <p className="mt-1 text-sm">
                {analyzeVideoMutation.error.message}
              </p>
            </div>
          )}

          {analysis && (!analyzeVideoMutation.isLoading || analyzeVideoMutation.variables?.refinementPrompt) && (
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
                    className="flex-1 min-h-[120px] rounded-lg p-4 border-2 border-black shadow-sm focus:border-black focus:ring-black focus:ring-offset-2 sm:text-sm"
                    disabled={analyzeVideoMutation.isLoading}
                  />
                </div>
                <div className="flex gap-3">
                  {screencastBlob ? (
                    <button
                      onClick={() => void handleScreencastUpdate()}
                      disabled={analyzeScreencastMutation.isLoading}
                      className="inline-flex items-center rounded-lg mt-3 bg-black px-4 py-2 text-md font-medium text-white hover:bg-black/80 focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 disabled:opacity-50"
                    >
                      {analyzeScreencastMutation.isLoading ? (
                        <svg className="h-5 w-5 animate-spin text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      ) : (
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      )}
                      <span className="ml-2">
                        {analyzeScreencastMutation.isLoading
                          ? "Analyzing Screencast..."
                          : "Refine with Screencast"}
                      </span>
                    </button>
                  ) : (
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
                      <span className="ml-2">
                        {analyzeVideoMutation.isLoading && analyzeVideoMutation.variables?.refinementPrompt
                          ? "Refining..."
                          : "Refine"}
                      </span>
                    </button>
                  )}
                  <button
                    onClick={() => setIsScreencastRecorderOpen(true)}
                    disabled={analyzeVideoMutation.isLoading || analyzeScreencastMutation.isLoading}
                    className="inline-flex items-center rounded-lg mt-3 bg-white border-2 border-black px-4 py-2 text-md font-medium text-black hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 disabled:opacity-50"
                    title="Record a new screencast for additional context"
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    <span className="ml-2">Screencast Update</span>
                  </button>
                  {screencastBlob && (
                    <button
                      onClick={() => setScreencastBlob(null)}
                      className="inline-flex items-center rounded-lg mt-3 px-3 py-2 text-sm font-medium text-black hover:text-custom-dark-orange"
                      title="Remove screencast"
                    >
                      <TrashIcon className="h-5 w-5" />
                    </button>
                  )}
                  {/* Regenerate Button (Secondary) */}
                  {/* <div className="mt-4 flex justify-center">
                    <button
                      onClick={() => void handleAnalyze()}
                      disabled={analyzeVideoMutation.isLoading}
                      className="text-sm text-gray-500 hover:text-black hover:underline"
                    >
                      Regenerate completely
                    </button>
                  </div> */}
                </div>
                {screencastBlob && (
                  <div className="mt-3 text-sm text-black bg-black/10 border border-black/10 rounded-lg p-3 w-fit">
                    <div className="flex items-center gap-3">
                      <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                      </svg>
                      <span>Screencast ready! Click "Refine with Screencast" to analyze.</span>
                    </div>
                  </div>
                )}
              </div>

            </>
          )}
        </div>
      )}

      <ScreencastRecorder
        isOpen={isScreencastRecorderOpen}
        onRecordingComplete={handleScreencastRecorded}
        onCancel={handleScreencastCancel}
      />
    </div>
  );
}
