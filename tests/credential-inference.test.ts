/**
 * Unit Tests for credential-inference.ts
 *
 * KEY CONCEPTS:
 *
 * - `describe` groups related tests together (like folders for tests)
 * - `it` (or `test`) defines a single test case
 * - `expect` makes assertions — if the assertion fails, the test fails
 *
 * These are UNIT TESTS because:
 * - They test pure functions in isolation (no database, no network, no DOM)
 * - Each test runs in milliseconds
 * - No setup/teardown needed — just call the function and check the result
 */
import { describe, it, expect } from "vitest";
import {
  inferCredentials,
  getGoogleSharingNotification,
  getCredentialPromptMessage,
  type SuggestedCredential,
} from "../src/utils/credential-inference";

describe("inferCredentials", () => {
  // ----- Edge cases first: what happens with bad/empty input? -----

  it("should return empty array for null input", () => {
    // This tests the "guard clause" — the early return for null
    const result = inferCredentials(null);
    expect(result).toEqual([]); // toEqual does deep comparison for arrays/objects
  });

  it("should return empty array for empty string", () => {
    const result = inferCredentials("");
    expect(result).toEqual([]);
  });

  it("should return empty array for unrelated text", () => {
    const result = inferCredentials("This is just a normal task about cooking dinner.");
    expect(result).toEqual([]);
  });

  // ----- Testing pattern matching for known services -----

  describe("Google Sheets detection", () => {
    it("should detect Google Sheets URL", () => {
      const analysis = "Navigate to https://docs.google.com/spreadsheets/d/abc123/edit";
      const result = inferCredentials(analysis);

      // `find` searches the array for a matching item
      const spreadsheetUrl = result.find((c) => c.key === "SPREADSHEET_URL");
      expect(spreadsheetUrl).toBeDefined();
      expect(spreadsheetUrl?.required).toBe(true);
    });

    it("should also suggest service account key for Sheets", () => {
      const analysis = "Open the Google Sheet and update column B";
      const result = inferCredentials(analysis);

      const serviceAccount = result.find((c) => c.key === "GOOGLE_SERVICE_ACCOUNT_KEY");
      expect(serviceAccount).toBeDefined();
      expect(serviceAccount?.required).toBe(false); // optional credential
    });

    it("should detect spreadsheet ID from full URL", () => {
      const analysis = "Go to https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit";
      const result = inferCredentials(analysis);

      const spreadsheetId = result.find((c) => c.key === "SPREADSHEET_ID");
      expect(spreadsheetId).toBeDefined();
      expect(spreadsheetId?.required).toBe(true);
    });
  });

  describe("GitHub detection", () => {
    it("should detect GitHub token need from github.com URL", () => {
      const analysis = "Clone the repo from github.com/owner/repo and push changes";
      const result = inferCredentials(analysis);

      const token = result.find((c) => c.key === "GITHUB_TOKEN");
      expect(token).toBeDefined();
      expect(token?.required).toBe(true);
    });

    it("should detect GitHub repo URL", () => {
      const analysis = "Navigate to https://github.com/acme-corp/my-project";
      const result = inferCredentials(analysis);

      const repoUrl = result.find((c) => c.key === "GITHUB_REPO_URL");
      expect(repoUrl).toBeDefined();
    });
  });

  describe("other service detection", () => {
    it("should detect Slack credentials", () => {
      const analysis = "Send a message to the slack.com workspace #general channel";
      const result = inferCredentials(analysis);

      const slack = result.find((c) => c.key === "SLACK_TOKEN");
      expect(slack).toBeDefined();
    });

    it("should detect Notion credentials", () => {
      const analysis = "Update the Notion page with the new data";
      const result = inferCredentials(analysis);

      const notion = result.find((c) => c.key === "NOTION_TOKEN");
      expect(notion).toBeDefined();
    });

    it("should detect OpenAI API key", () => {
      const analysis = "Call the OpenAI GPT-4 API to summarize the text";
      const result = inferCredentials(analysis);

      const openai = result.find((c) => c.key === "OPENAI_API_KEY");
      expect(openai).toBeDefined();
    });

    it("should detect Stripe credentials", () => {
      const analysis = "Process the payment through Stripe";
      const result = inferCredentials(analysis);

      const stripe = result.find((c) => c.key === "STRIPE_SECRET_KEY");
      expect(stripe).toBeDefined();
    });

    it("should detect database URLs", () => {
      const analysis = "Connect to the postgres database and run the migration";
      const result = inferCredentials(analysis);

      const db = result.find((c) => c.key === "DATABASE_URL");
      expect(db).toBeDefined();
    });
  });

  // ----- Testing environment variable extraction -----

  describe("environment variable extraction", () => {
    it("should extract $VAR_NAME syntax", () => {
      const analysis = "Set $MY_CUSTOM_TOKEN to authenticate";
      const result = inferCredentials(analysis);

      const custom = result.find((c) => c.key === "MY_CUSTOM_TOKEN");
      expect(custom).toBeDefined();
      expect(custom?.description).toContain("Environment variable");
    });

    it("should extract process.env.VAR syntax", () => {
      const analysis = "Read process.env.CUSTOM_API_SECRET for the request";
      const result = inferCredentials(analysis);

      const custom = result.find((c) => c.key === "CUSTOM_API_SECRET");
      expect(custom).toBeDefined();
    });

    it("should skip common non-credential env vars", () => {
      // NODE_ENV, PATH, HOME, etc. should NOT be suggested as credentials
      const analysis = "Check process.env.NODE_ENV and $HOME and $PATH";
      const result = inferCredentials(analysis);

      expect(result.find((c) => c.key === "NODE_ENV")).toBeUndefined();
      expect(result.find((c) => c.key === "HOME")).toBeUndefined();
      expect(result.find((c) => c.key === "PATH")).toBeUndefined();
    });
  });

  // ----- Testing that multiple services are detected together -----

  it("should detect multiple credentials from complex analysis", () => {
    const analysis = `
      Step 1: Open https://docs.google.com/spreadsheets/d/abc123/edit
      Step 2: Copy data from the spreadsheet
      Step 3: Go to github.com/acme/repo and create a PR
      Step 4: Send a notification to slack.com #updates
    `;
    const result = inferCredentials(analysis);

    // Should detect all three services
    const keys = result.map((c) => c.key);
    expect(keys).toContain("SPREADSHEET_URL");
    expect(keys).toContain("GITHUB_TOKEN");
    expect(keys).toContain("SLACK_TOKEN");
  });

  // ----- Deduplication: same key shouldn't appear twice -----

  it("should not duplicate credentials when multiple patterns match", () => {
    const analysis = "Open the Google Sheet at docs.google.com/spreadsheets/d/abc and update the spreadsheet";
    const result = inferCredentials(analysis);

    const spreadsheetUrls = result.filter((c) => c.key === "SPREADSHEET_URL");
    expect(spreadsheetUrls).toHaveLength(1); // should be deduplicated
  });
});

describe("getGoogleSharingNotification", () => {
  it("should return null for null input", () => {
    expect(getGoogleSharingNotification(null)).toBeNull();
  });

  it("should return null for non-Google content", () => {
    expect(getGoogleSharingNotification("Just a normal task")).toBeNull();
  });

  it("should return notification for Google Sheets URL", () => {
    const result = getGoogleSharingNotification(
      "Open https://docs.google.com/spreadsheets/d/abc123"
    );
    expect(result).not.toBeNull();
    expect(result?.serviceAccountEmail).toContain("@");
    expect(result?.message).toContain("share");
  });

  it("should return notification for Google Docs URL", () => {
    const result = getGoogleSharingNotification(
      "Edit https://docs.google.com/document/d/abc123"
    );
    expect(result).not.toBeNull();
  });

  it("should return notification for Google Drive URL", () => {
    const result = getGoogleSharingNotification(
      "Download from https://drive.google.com/file/d/abc123"
    );
    expect(result).not.toBeNull();
  });
});

describe("getCredentialPromptMessage", () => {
  // Helper to create a minimal credential for testing
  const mockCredential: SuggestedCredential = {
    key: "TEST_KEY",
    description: "Test credential",
    required: true,
  };

  it("should show shared-task message when user is not owner", () => {
    const msg = getCredentialPromptMessage(false, [mockCredential]);
    expect(msg).toContain("shared with you");
    expect(msg).toContain("security");
  });

  it("should show suggestion message when credentials are detected", () => {
    const msg = getCredentialPromptMessage(true, [mockCredential]);
    expect(msg).toContain("analysis");
  });

  it("should show generic message when no credentials detected", () => {
    const msg = getCredentialPromptMessage(true, []);
    expect(msg).toContain("environment variables");
  });
});
