import React from "react";

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
}

export default function CredentialModal({
  onClose,
  onSubmit,
  credentials,
  setCredentials,
  isSubmitting = false,
}: CredentialModalProps) {
  const addCredential = () => {
    setCredentials([...credentials, { key: "", value: "" }]);
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-lg rounded-lg bg-white shadow-xl">
        <div className="border-b px-6 py-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Configure Credentials
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            Add environment variables the automation may need (e.g., API keys,
            tokens). These are encrypted and stored securely.
          </p>
        </div>

        <div className="max-h-80 overflow-y-auto p-6">
          <div className="space-y-4">
            {credentials.map((cred, index) => (
              <div key={index} className="flex gap-2">
                <input
                  type="text"
                  placeholder="KEY_NAME"
                  value={cred.key}
                  onChange={(e) =>
                    updateCredential(index, "key", e.target.value)
                  }
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
                />
                <input
                  type="password"
                  placeholder="value"
                  value={cred.value}
                  onChange={(e) =>
                    updateCredential(index, "value", e.target.value)
                  }
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
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
            ))}

            {credentials.length === 0 && (
              <p className="text-center text-sm text-gray-500">
                No credentials added. Click below to add one, or proceed without
                credentials.
              </p>
            )}

            <button
              onClick={addCredential}
              className="w-full rounded-lg border-2 border-dashed border-gray-300 py-2 text-gray-500 hover:border-gray-400 hover:text-gray-600"
              type="button"
            >
              + Add Credential
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
