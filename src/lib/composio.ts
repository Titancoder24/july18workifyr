import { Composio } from "@composio/core";

export type MailProvider = "gmail" | "outlook";

let client: Composio | null = null;

export function getComposio() {
  const apiKey = process.env.COMPOSIO_API_KEY;
  if (!apiKey) {
    throw new Error("COMPOSIO_API_KEY is not configured");
  }
  if (!client) {
    client = new Composio({
      apiKey,
      allowTracking: false,
      disableVersionCheck: true,
    });
  }
  return client;
}

export async function createMailSession(userId: string, provider: MailProvider) {
  return getComposio().sessions.create(userId, {
    toolkits: [provider],
    manageConnections: true,
    sessionPreset: "direct_tools",
    workbench: { enable: false },
  });
}

export const mailTools = {
  gmail: {
    profile: "GMAIL_GET_PROFILE",
    fetch: "GMAIL_FETCH_EMAILS",
    send: "GMAIL_SEND_EMAIL",
  },
  outlook: {
    profile: "OUTLOOK_GET_PROFILE",
    fetch: "OUTLOOK_QUERY_EMAILS",
    send: "OUTLOOK_SEND_EMAIL",
  },
} as const;
