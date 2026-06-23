import { setTimeout as sleep } from 'node:timers/promises';

/**
 * Mailpit HTTP client for E2E tests (SPEC-092).
 *
 * Mailpit captures all SMTP traffic and exposes a REST API for inspection.
 * In `docker-compose.e2e.yml` it runs on port 8025 (HTTP) and 1025 (SMTP).
 *
 * @see https://mailpit.axllent.org/docs/api-v1/
 */

// Port matches apps/e2e/.env.e2e (SSOT). Override via HOSPEDA_E2E_MAILPIT_URL.
const DEFAULT_MAILPIT_URL = process.env.HOSPEDA_E2E_MAILPIT_URL ?? 'http://localhost:18025';
const DEFAULT_TIMEOUT_MS = 15_000;
const POLL_INTERVAL_MS = 500;

/**
 * Summary of an email message returned by `GET /api/v1/messages`.
 */
export interface MailpitMessageSummary {
    readonly ID: string;
    readonly From: { readonly Name?: string; readonly Address: string };
    readonly To: ReadonlyArray<{ readonly Name?: string; readonly Address: string }>;
    readonly Subject: string;
    readonly Created: string;
}

interface MailpitMessagesResponse {
    readonly messages: ReadonlyArray<MailpitMessageSummary>;
    readonly total: number;
}

/**
 * Detailed view of a message returned by `GET /api/v1/message/{ID}`.
 * Only the fields we use are typed; the full payload has more.
 */
export interface MailpitMessageDetail {
    readonly ID: string;
    readonly Subject: string;
    readonly Text?: string;
    readonly HTML?: string;
    readonly To: ReadonlyArray<{ readonly Address: string }>;
    readonly From: { readonly Address: string };
}

export interface WaitForEmailOptions {
    readonly to: string;
    readonly subject?: string | RegExp;
    readonly timeoutMs?: number;
    readonly mailpitUrl?: string;
}

/**
 * Polls Mailpit until a message arrives that matches the provided filters,
 * then returns the matching message detail. Throws on timeout.
 *
 * @example
 * ```ts
 * const email = await waitForEmail({ to: 'host@test.com', subject: /verifica/i });
 * const link = extractFirstLink(email.HTML ?? email.Text ?? '');
 * ```
 */
export async function waitForEmail(options: WaitForEmailOptions): Promise<MailpitMessageDetail> {
    const baseUrl = options.mailpitUrl ?? DEFAULT_MAILPIT_URL;
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const start = Date.now();

    while (Date.now() - start < timeoutMs) {
        const summary = await findMatchingMessage(baseUrl, options);
        if (summary !== null) {
            return getMessageDetail(baseUrl, summary.ID);
        }
        await sleep(POLL_INTERVAL_MS);
    }
    throw new Error(
        `Timed out after ${timeoutMs}ms waiting for email to ${options.to}${options.subject ? ` with subject matching ${String(options.subject)}` : ''}`
    );
}

async function findMatchingMessage(
    baseUrl: string,
    options: WaitForEmailOptions
): Promise<MailpitMessageSummary | null> {
    const response = await fetch(`${baseUrl}/api/v1/messages`);
    if (!response.ok) {
        throw new Error(`Mailpit list failed: ${response.status} ${response.statusText}`);
    }
    const data = (await response.json()) as MailpitMessagesResponse;
    return (
        data.messages.find((message) => {
            const recipientMatches = message.To.some(
                (recipient) => recipient.Address.toLowerCase() === options.to.toLowerCase()
            );
            if (!recipientMatches) return false;
            if (options.subject === undefined) return true;
            if (options.subject instanceof RegExp) return options.subject.test(message.Subject);
            return message.Subject.includes(options.subject);
        }) ?? null
    );
}

/**
 * Retrieves the full message body (HTML + text + headers) by ID.
 */
export async function getMessageDetail(
    baseUrl: string,
    messageId: string
): Promise<MailpitMessageDetail> {
    const response = await fetch(`${baseUrl}/api/v1/message/${messageId}`);
    if (!response.ok) {
        throw new Error(
            `Mailpit get message ${messageId} failed: ${response.status} ${response.statusText}`
        );
    }
    return (await response.json()) as MailpitMessageDetail;
}

/**
 * Deletes ALL messages in the Mailpit inbox.
 * Call from beforeEach when a clean slate is required.
 */
export async function clearInbox(mailpitUrl: string = DEFAULT_MAILPIT_URL): Promise<void> {
    const response = await fetch(`${mailpitUrl}/api/v1/messages`, { method: 'DELETE' });
    if (!response.ok) {
        throw new Error(`Mailpit clear inbox failed: ${response.status} ${response.statusText}`);
    }
}

/**
 * Extracts the first URL from a body string (HTML or plain text).
 * Used by tests to follow verification, password-reset, or magic links.
 *
 * Returns null when no URL is found.
 */
export function extractFirstLink(body: string): string | null {
    const match = body.match(/https?:\/\/[^\s"<>]+/);
    return match?.[0] ?? null;
}

/**
 * Extracts ALL URLs from a body string, deduplicated, in order of first
 * occurrence.
 */
export function extractAllLinks(body: string): string[] {
    const matches = body.match(/https?:\/\/[^\s"<>]+/g) ?? [];
    return Array.from(new Set(matches));
}
