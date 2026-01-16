import React from "react";
import { type SuggestedCredential } from "~/utils/credential-inference";

interface Credential {
  key: string;
  value: string;
}

interface CredentialModalProps {
  onClose: () => void;
  onSubmit: () => void;
  credentials: Credential[];
  setCredentials: React.Dispatch<React.SetStateAction<Credential[]>>;
  isSubmitting?: boolean;
  suggestedCredentials?: SuggestedCredential[];
  promptMessage?: string;
  isSharedTask?: boolean;
}

export default function CredentialModal({
  onClose,
  onSubmit,
  credentials,
  setCredentials,
  isSubmitting = false,
  suggestedCredentials = [],
  promptMessage,
  isSharedTask = false,
}: CredentialModalProps) {
  const addCredential = () => {
    setCredentials([...credentials, { key: "", value: "" }]);
  };

  const addSuggestedCredential = (suggestion: SuggestedCredential) => {
    // Don't add if already exists
    if (credentials.some((c) => c.key === suggestion.key)) return;
    setCredentials([...credentials, { key: suggestion.key, value: "" }]);
  };

  const addAllSuggested = () => {
    const newCreds = suggestedCredentials
      .filter((s) => !credentials.some((c) => c.key === s.key))
      .map((s) => ({ key: s.key, value: "" }));
    setCredentials([...credentials, ...newCreds]);
  };

  const updateCredential = (
    index: number,
    field: "key" | "value",
    value: string
  ) => {
    const updated = [...credentials];
    const current = updated[index];
    if (current) {
      updated[index] = { ...current, [field]: value };
      setCredentials(updated);
    }
  };

  const removeCredential = (index: number) => {
    setCredentials(credentials.filter((_, i) => i !== index));
  };

  // Find suggestion for a given credential key
  const getSuggestion = (key: string) =>
    suggestedCredentials.find((s) => s.key === key);

  // Suggested credentials not yet added
  const unusedSuggestions = suggestedCredentials.filter(
    (s) => !credentials.some((c) => c.key === s.key)
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white shadow-2xl">
        <div className="border-b px-6 py-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Configure Credentials
          </h3>
          {isSharedTask && (
            <div className="mt-2 flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
              <svg
                className="mt-0.5 h-4 w-4 shrink-0"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              <span>
                <strong>Shared Task:</strong> You must provide your own
                credentials. The original creator&apos;s credentials are not shared.
              </span>
            </div>
          )}
          <p className="mt-2 text-sm text-gray-500">
            {promptMessage ??
              "Add environment variables the automation may need (e.g., API keys, tokens). These are encrypted and stored securely."}
          </p>
        </div>

        {/* Suggested Credentials Section */}
        {unusedSuggestions.length > 0 && (
          <div className="border-b bg-blue-50 px-6 py-4">
            <div className="mb-2 flex items-center justify-between">
              <h4 className="text-sm font-medium text-blue-900">
                Detected Credentials
              </h4>
              <button
                onClick={addAllSuggested}
                className="text-xs text-blue-600 hover:text-blue-800 hover:underline"
                type="button"
              >
                Add all
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {unusedSuggestions.map((suggestion) => (
                <button
                  key={suggestion.key}
                  onClick={() => addSuggestedCredential(suggestion)}
                  className="group flex items-center gap-1.5 rounded-full border border-blue-200 bg-white px-3 py-1.5 text-xs text-blue-700 hover:border-blue-400 hover:bg-blue-50"
                  type="button"
                  title={suggestion.description}
                >
                  <svg
                    className="h-3 w-3 text-blue-400 group-hover:text-blue-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                  <span className="font-mono">{suggestion.key}</span>
                  {suggestion.required && (
                    <span className="text-red-500">*</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="max-h-80 overflow-y-auto p-6">
          <div className="space-y-4">
            {credentials.map((cred, index) => {
              const suggestion = getSuggestion(cred.key);
              return (
                <div key={index} className="space-y-1">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="KEY_NAME"
                      value={cred.key}
                      onChange={(e) =>
                        updateCredential(index, "key", e.target.value)
                      }
                      className="w-40 shrink-0 rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
                    />
                    <input
                      type="password"
                      placeholder={suggestion?.placeholder ?? "value"}
                      value={cred.value}
                      onChange={(e) =>
                        updateCredential(index, "value", e.target.value)
                      }
                      className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
                    />
                    <button
                      onClick={() => removeCredential(index)}
                      className="rounded-lg px-2 text-red-500 hover:bg-red-50 hover:text-red-700"
                      type="button"
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
                  {suggestion && (
                    <p className="ml-1 text-xs text-gray-500">
                      {suggestion.description}
                    </p>
                  )}
                </div>
              );
            })}

            {credentials.length === 0 && unusedSuggestions.length === 0 && (
              <p className="text-center text-sm text-gray-500">
                No credentials needed. Click below to add one, or proceed
                without credentials.
              </p>
            )}

            {credentials.length === 0 && unusedSuggestions.length > 0 && (
              <p className="text-center text-sm text-gray-500">
                Click the suggested credentials above to add them, or add custom
                ones below.
              </p>
            )}

            <button
              onClick={addCredential}
              className="w-full rounded-lg border-2 border-dashed border-gray-300 py-2 text-gray-500 hover:border-gray-400 hover:text-gray-600"
              type="button"
            >
              + Add Custom Credential
            </button>
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t px-6 py-4">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            type="button"
          >
            Cancel
          </button>
          <button
            onClick={onSubmit}
            disabled={isSubmitting}
            className="flex items-center gap-2 rounded-lg bg-black px-4 py-2 text-white hover:bg-gray-800 disabled:opacity-50"
            type="button"
          >
            {isSubmitting ? (
              <>
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
                <span>Starting...</span>
              </>
            ) : (
              <span>Start Execution</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
