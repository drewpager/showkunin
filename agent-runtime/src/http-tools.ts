/**
 * HTTP Tools for Agent Runtime
 * Provides HTTP request capabilities (GET, POST, PUT, PATCH, DELETE)
 * and Google Sheets API direct access.
 *
 * These are implemented as helper functions that can be called from the agent executor
 * when the agent needs to make API calls. The agent can invoke these via the Bash tool
 * or we can expose them as custom tools.
 */

export interface HttpRequestOptions {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  url: string;
  headers?: Record<string, string>;
  body?: string;
  timeout?: number;
}

export interface HttpResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: unknown;
}

/**
 * Make an HTTP request
 */
export async function httpRequest(options: HttpRequestOptions): Promise<HttpResponse> {
  const { method, url, headers, body, timeout = 30000 } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      body: body ? body : undefined,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const responseText = await response.text();
    let responseBody: unknown;

    try {
      responseBody = JSON.parse(responseText);
    } catch {
      responseBody = responseText;
    }

    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    return {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
      body: responseBody,
    };
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Request timeout after ${timeout}ms`);
    }
    throw error;
  }
}

/**
 * Google Sheets API operations
 */
export type SheetsOperation = "get" | "update" | "append" | "clear";

export interface SheetsRequestOptions {
  operation: SheetsOperation;
  spreadsheetId: string;
  range: string;
  values?: string[][];
  valueInputOption?: "RAW" | "USER_ENTERED";
}

/**
 * Make a Google Sheets API request
 * Requires GOOGLE_SHEETS_API_KEY or GOOGLE_ACCESS_TOKEN environment variable
 */
export async function googleSheetsRequest(
  options: SheetsRequestOptions
): Promise<HttpResponse> {
  const { operation, spreadsheetId, range, values, valueInputOption = "USER_ENTERED" } = options;

  const apiKey = process.env.GOOGLE_SHEETS_API_KEY;
  const accessToken = process.env.GOOGLE_ACCESS_TOKEN;

  if (!apiKey && !accessToken) {
    throw new Error(
      "Google Sheets API requires GOOGLE_SHEETS_API_KEY or GOOGLE_ACCESS_TOKEN environment variable"
    );
  }

  const baseUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`;
  const authHeader: Record<string, string> = accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
  const authParam = apiKey ? `key=${apiKey}` : "";

  let url: string;
  let method: HttpRequestOptions["method"];
  let body: string | undefined;

  switch (operation) {
    case "get":
      url = `${baseUrl}/values/${encodeURIComponent(range)}?${authParam}`;
      method = "GET";
      break;
    case "update":
      url = `${baseUrl}/values/${encodeURIComponent(range)}?valueInputOption=${valueInputOption}${apiKey ? `&${authParam}` : ""}`;
      method = "PUT";
      body = JSON.stringify({ values });
      break;
    case "append":
      url = `${baseUrl}/values/${encodeURIComponent(range)}:append?valueInputOption=${valueInputOption}${apiKey ? `&${authParam}` : ""}`;
      method = "POST";
      body = JSON.stringify({ values });
      break;
    case "clear":
      url = `${baseUrl}/values/${encodeURIComponent(range)}:clear?${authParam}`;
      method = "POST";
      body = "{}";
      break;
  }

  return httpRequest({
    method,
    url,
    headers: {
      ...authHeader,
    },
    body,
  });
}

/**
 * Format HTTP response for agent output
 */
export function formatHttpResponse(response: HttpResponse): string {
  return JSON.stringify(
    {
      status: response.status,
      statusText: response.statusText,
      body: response.body,
    },
    null,
    2
  );
}

/**
 * System prompt guidance for HTTP API usage
 */
export const HTTP_API_GUIDANCE = `
## HTTP API Tools

When you need to make HTTP API requests, you can use the Bash tool with curl:

### Basic Requests
\`\`\`bash
# GET request
curl -s "https://api.example.com/data"

# POST request with JSON body
curl -s -X POST -H "Content-Type: application/json" \\
  -d '{"key": "value"}' "https://api.example.com/data"

# PUT request (update)
curl -s -X PUT -H "Content-Type: application/json" \\
  -d '{"key": "updated_value"}' "https://api.example.com/data/123"

# PATCH request (partial update)
curl -s -X PATCH -H "Content-Type: application/json" \\
  -d '{"key": "partial_update"}' "https://api.example.com/data/123"

# DELETE request
curl -s -X DELETE "https://api.example.com/data/123"
\`\`\`

### Authentication Headers
\`\`\`bash
# Bearer token
curl -s -H "Authorization: Bearer \$API_TOKEN" "https://api.example.com/data"

# API key header
curl -s -H "X-API-Key: \$API_KEY" "https://api.example.com/data"
\`\`\`

### Google Sheets API
If GOOGLE_SHEETS_API_KEY is available:
\`\`\`bash
# Read data from a range
curl -s "https://sheets.googleapis.com/v4/spreadsheets/\$SPREADSHEET_ID/values/Sheet1!A1:D10?key=\$GOOGLE_SHEETS_API_KEY"

# Write data to a range (requires OAuth token)
curl -s -X PUT \\
  -H "Authorization: Bearer \$GOOGLE_ACCESS_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"values": [["A1", "B1"], ["A2", "B2"]]}' \\
  "https://sheets.googleapis.com/v4/spreadsheets/\$SPREADSHEET_ID/values/Sheet1!A1:B2?valueInputOption=USER_ENTERED"
\`\`\`

Note: Use environment variables for API keys and tokens. They are injected from stored credentials.
`;
