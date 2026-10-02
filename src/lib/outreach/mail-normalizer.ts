type UnknownRecord = Record<string, unknown>;

export type NormalizedMail = {
  messageId: string;
  threadId: string;
  subject: string;
  from: string;
  to: string[];
  snippet: string;
  body: string;
  sentAt: string;
  unread: boolean;
  direction: "inbound" | "outbound";
};

function record(value: unknown): UnknownRecord {
  return value && typeof value === "object" ? (value as UnknownRecord) : {};
}

function text(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map(text).filter(Boolean).join(", ");
  if (value && typeof value === "object") {
    const item = value as UnknownRecord;
    return text(item.address || item.email || item.value || item.content || item.emailAddress || item.name);
  }
  return "";
}

function emails(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap((item) => emails(item));
  const raw = text(value);
  return raw.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];
}

function decodeBody(value: string) {
  if (!value || value.includes(" ")) return value;
  try {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    return Buffer.from(normalized, "base64").toString("utf8");
  } catch {
    return value;
  }
}

function findBody(message: UnknownRecord): string {
  const bodyObject = record(message.body);
  const direct = text(message.body_text || bodyObject.content || message.text || message.content);
  if (direct) return decodeBody(direct);
  const payload = record(message.payload);
  const payloadBody = text(record(payload.body).data);
  if (payloadBody) return decodeBody(payloadBody);
  const parts = Array.isArray(payload.parts) ? payload.parts : [];
  for (const partValue of parts) {
    const part = record(partValue);
    if (text(part.mimeType).startsWith("text/plain")) {
      const data = text(record(part.body).data);
      if (data) return decodeBody(data);
    }
  }
  return text(message.snippet || message.preview || message.bodyPreview);
}

function headers(message: UnknownRecord) {
  const payload = record(message.payload);
  const source = Array.isArray(payload.headers) ? payload.headers : [];
  return Object.fromEntries(
    source.map((value) => {
      const item = record(value);
      return [text(item.name).toLowerCase(), text(item.value)];
    }),
  );
}

export function normalizeMailResult(
  provider: "gmail" | "outlook",
  result: unknown,
  mailboxEmail?: string | null,
): NormalizedMail[] {
  const root = record(result);
  const data = record(root.data);
  const candidates =
    (Array.isArray(data.messages) && data.messages) ||
    (Array.isArray(data.value) && data.value) ||
    (Array.isArray(root.messages) && root.messages) ||
    (Array.isArray(root.value) && root.value) ||
    [];

  return candidates
    .map((value, index) => {
      const message = record(value);
      const headerMap = headers(message);
      const from = emails(message.from || message.sender)[0] || text(message.from || message.sender || headerMap.from);
      const to = emails(message.to || message.recipient || message.toRecipients || headerMap.to);
      const sentAt =
        text(message.internalDate || message.date || message.sent_at || message.receivedDateTime || message.sentDateTime) ||
        new Date().toISOString();
      const rawLabels = Array.isArray(message.labelIds) ? message.labelIds.map(text) : [];
      const senderEmails = emails(from);
      const outbound = Boolean(
        rawLabels.includes("SENT") ||
          (mailboxEmail && senderEmails.some((email) => email.toLowerCase() === mailboxEmail.toLowerCase())),
      );
      return {
        messageId: text(message.id || message.messageId) || `${provider}-${index}-${sentAt}`,
        threadId:
          text(message.threadId || message.thread_id || message.conversationId) ||
          text(message.id || message.messageId) ||
          `${provider}-${index}`,
        subject: text(message.subject || headerMap.subject) || "(no subject)",
        from,
        to,
        snippet: text(message.snippet || message.preview || message.bodyPreview).slice(0, 280),
        body: findBody(message),
        sentAt: /^\d+$/.test(sentAt) ? new Date(Number(sentAt)).toISOString() : sentAt,
        unread: rawLabels.includes("UNREAD") || message.isRead === false,
        direction: outbound ? "outbound" as const : "inbound" as const,
      } satisfies NormalizedMail;
    })
    .filter((message) => message.messageId && message.threadId);
}
