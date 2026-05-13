/**
 * @module brevo-batch
 *
 * Brevo multi-recipient batch send helper (SPEC-101 T-101-16).
 *
 * Wraps `POST https://api.brevo.com/v3/smtp/email` with the `messageVersions`
 * array variant that lets a single HTTP call deliver to up to 1,000 recipients,
 * each with their own subject, htmlContent, and headers.
 *
 * This is distinct from `BrevoEmailTransport` (single-recipient transactional
 * emails). Use this helper ONLY for bulk campaign batches dispatched by the
 * BullMQ worker.
 *
 * Error contract:
 * - 4xx / 5xx → throws an `Error` with the Brevo error body included.
 *   The BullMQ worker treats any throw as a retryable failure.
 * - Network failure → throws propagated from `fetch`.
 * - 2xx with `messageId` string → normalised to a single-element `messageIds` array.
 * - 2xx with `messageIds` array → each entry mapped by index to its recipient email.
 *
 * @see packages/notifications/src/transports/email/resend-transport.ts
 *   for the single-recipient transport that uses the same API key header idiom.
 */

const BREVO_SMTP_URL = 'https://api.brevo.com/v3/smtp/email';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * A single recipient entry in the Brevo `messageVersions` array.
 *
 * Each `BrevoBatchRecipient` overrides the default `subject` and `htmlContent`
 * on the parent payload object, enabling per-recipient personalisation (e.g.
 * individual unsubscribe URLs embedded in the HTML).
 */
export interface BrevoBatchRecipient {
    /** Recipient address and optional display name. */
    readonly to: { readonly email: string; readonly name?: string };
    /** Per-recipient subject line (overrides the top-level default). */
    readonly subject: string;
    /** Per-recipient HTML body (overrides the top-level default). */
    readonly htmlContent: string;
    /** Optional plain-text fallback body. */
    readonly textContent?: string;
    /**
     * Optional per-recipient headers.
     *
     * Recommended: include `X-Newsletter-Delivery-Id` so the Brevo webhook
     * handler can resolve the delivery row without a DB roundtrip.
     */
    readonly headers?: Readonly<Record<string, string>>;
    /** Brevo tags forwarded to analytics. */
    readonly tags?: readonly string[];
}

/**
 * Top-level Brevo batch payload.
 *
 * `messageVersions` contains one entry per recipient. Each entry overrides
 * `subject` and `htmlContent`; the `sender` and any `trackOpens` / `trackClicks`
 * params apply to all recipients.
 */
export interface BrevoBatchPayload {
    /** Campaign sender identity. */
    readonly sender: { readonly email: string; readonly name: string };
    /**
     * Default subject — required by Brevo even when `messageVersions` overrides
     * it per recipient. Must be non-empty.
     */
    readonly subject: string;
    /**
     * Default HTML body — required by Brevo even when `messageVersions` overrides
     * it per recipient. Must be non-empty.
     */
    readonly htmlContent: string;
    /** One entry per recipient. Max 1,000 per Brevo batch call. */
    readonly messageVersions: readonly BrevoBatchRecipient[];
    /**
     * Brevo campaign tags (applied to all recipients).
     * Useful for filtering events in the Brevo dashboard.
     */
    readonly tags?: readonly string[];
    /**
     * When true, Brevo injects an open-tracking pixel automatically.
     * Recommended for campaign sends.
     */
    readonly trackOpens?: boolean;
    /**
     * When true, Brevo rewrites every `<a>` href for click tracking.
     * Recommended for campaign sends.
     */
    readonly trackClicks?: boolean;
}

/**
 * Per-recipient outcome from a batch send.
 *
 * `messageId` is present when Brevo accepted the message.
 * `error` is present when Brevo rejected a specific recipient entry.
 */
export interface BatchRecipientOutcome {
    /** Recipient email address (mirrors the input for correlation). */
    readonly email: string;
    /** Brevo message ID returned for this recipient. */
    readonly messageId?: string;
    /** Error description from Brevo for this recipient, if rejected. */
    readonly error?: string;
}

/**
 * Result returned by `sendBatch`.
 *
 * `messageIds` has one entry per recipient in the same order as
 * `payload.messageVersions`.
 */
export interface SendBatchResult {
    /** Per-recipient outcomes in input order. */
    readonly messageIds: readonly BatchRecipientOutcome[];
    /** Raw HTTP status code from Brevo (2xx on success). */
    readonly statusCode: number;
}

// ---------------------------------------------------------------------------
// Internal shape of the Brevo response body
// ---------------------------------------------------------------------------

/**
 * Shape of a 2xx Brevo response to `POST /v3/smtp/email` when called with
 * `messageVersions`. Brevo returns either a single `messageId` string (when
 * there is only one recipient in the batch) or a `messageIds` array (multiple
 * recipients). Both cases are handled in `normaliseBatchResponse`.
 */
interface BrevoSuccessResponse {
    messageId?: string;
    messageIds?: string[];
}

/**
 * Shape of a Brevo error response body. The `message` field is human-readable;
 * `code` is a machine-readable identifier.
 */
interface BrevoErrorResponse {
    message?: string;
    code?: string;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Extracts a human-readable error string from a Brevo error response.
 * Falls back to HTTP status + status text when the body is unparseable.
 *
 * @param response - Fetch `Response` object (non-2xx).
 * @returns Promise resolving to an error detail string.
 */
async function extractBrevoError(response: Response): Promise<string> {
    try {
        const body = (await response.json()) as BrevoErrorResponse;
        if (body.message) {
            return body.message;
        }
    } catch {
        // Body is not JSON — fall through to status-based detail.
    }
    return `${response.status} ${response.statusText || 'error'}`;
}

/**
 * Maps a Brevo success response to the `SendBatchResult.messageIds` array.
 *
 * Brevo returns either:
 *   - `{ messageId: "abc123" }` — single string (even for batch requests with
 *     a single recipient in `messageVersions`).
 *   - `{ messageIds: ["abc123", "def456"] }` — one string per recipient.
 *
 * We normalise both shapes to an array indexed by recipient order.
 *
 * @param body - Parsed Brevo success response.
 * @param recipients - Original recipient list (for email correlation).
 * @returns Normalised per-recipient outcomes.
 */
function normaliseBatchResponse(
    body: BrevoSuccessResponse,
    recipients: readonly BrevoBatchRecipient[]
): readonly BatchRecipientOutcome[] {
    if (body.messageIds && Array.isArray(body.messageIds)) {
        // Multi-recipient response: index matches position in messageVersions.
        return recipients.map((r, i) => ({
            email: r.to.email,
            messageId: body.messageIds?.[i] ?? undefined
        }));
    }

    if (body.messageId) {
        // Single-string response: applies to all recipients (or just the first).
        return recipients.map((r, i) => ({
            email: r.to.email,
            messageId: i === 0 ? body.messageId : undefined
        }));
    }

    // Brevo returned 2xx but no message ID — treat all as accepted without ID.
    return recipients.map((r) => ({ email: r.to.email }));
}

// ---------------------------------------------------------------------------
// Public function
// ---------------------------------------------------------------------------

/**
 * Sends a batch of newsletter emails via Brevo's multi-recipient SMTP API.
 *
 * Uses native `fetch` with the `api-key` header idiom (NOT Bearer). The
 * `messageVersions` array allows per-recipient subject + HTML overrides so
 * each recipient receives a personalised email (with their own unsubscribe
 * URL in the footer) in a single HTTP round-trip.
 *
 * Error behaviour:
 * - 4xx / 5xx → throws `Error` including the Brevo error body. The BullMQ
 *   worker should retry the entire batch on throw.
 * - Network failure → throws propagated from `fetch`.
 *
 * @param input - Payload and API key.
 * @param input.payload - Batch payload with sender, defaults, and per-recipient
 *   `messageVersions`.
 * @param input.apiKey - Brevo API key (format `xkeysib-*`). Sent as the
 *   `api-key` header (NOT `Authorization: Bearer …`).
 * @returns `SendBatchResult` with per-recipient outcomes and HTTP status code.
 *
 * @throws {Error} When Brevo returns a non-2xx status or `fetch` itself rejects.
 *
 * @example
 * ```ts
 * const result = await sendBatch({
 *   apiKey: env.HOSPEDA_EMAIL_API_KEY,
 *   payload: {
 *     sender: { email: 'noreply@hospeda.com.ar', name: 'Hospeda' },
 *     subject: 'Novedades de mayo',
 *     htmlContent: '<p>Hola</p>',
 *     trackOpens: true,
 *     trackClicks: true,
 *     messageVersions: [
 *       {
 *         to: { email: 'user@example.com', name: 'Usuario' },
 *         subject: 'Novedades de mayo',
 *         htmlContent: '<p>Hola Usuario, <a href="...unsub...">Darme de baja</a></p>',
 *         headers: { 'X-Newsletter-Delivery-Id': 'delivery-uuid' },
 *       },
 *     ],
 *   },
 * });
 *
 * for (const outcome of result.messageIds) {
 *   console.log(outcome.email, outcome.messageId);
 * }
 * ```
 */
export async function sendBatch({
    payload,
    apiKey
}: {
    readonly payload: BrevoBatchPayload;
    readonly apiKey: string;
}): Promise<SendBatchResult> {
    const requestBody: Record<string, unknown> = {
        sender: payload.sender,
        subject: payload.subject,
        htmlContent: payload.htmlContent,
        messageVersions: payload.messageVersions.map((recipient) => {
            const entry: Record<string, unknown> = {
                to: [{ email: recipient.to.email, name: recipient.to.name }],
                subject: recipient.subject,
                htmlContent: recipient.htmlContent
            };
            if (recipient.textContent) {
                entry.textContent = recipient.textContent;
            }
            if (recipient.headers) {
                entry.headers = recipient.headers;
            }
            if (recipient.tags && recipient.tags.length > 0) {
                entry.tags = recipient.tags;
            }
            return entry;
        })
    };

    if (payload.tags && payload.tags.length > 0) {
        requestBody.tags = payload.tags;
    }

    // Brevo supports trackOpens and trackClicks at the top-level payload.
    // When omitted they default to the account-level setting.
    if (payload.trackOpens !== undefined) {
        requestBody.params = {
            ...(requestBody.params as Record<string, unknown> | undefined),
            trackOpens: payload.trackOpens
        };
    }
    if (payload.trackClicks !== undefined) {
        requestBody.params = {
            ...(requestBody.params as Record<string, unknown> | undefined),
            trackClicks: payload.trackClicks
        };
    }

    const response = await fetch(BREVO_SMTP_URL, {
        method: 'POST',
        headers: {
            'api-key': apiKey,
            'content-type': 'application/json',
            accept: 'application/json'
        },
        body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
        const detail = await extractBrevoError(response);
        throw new Error(`Brevo batch send failed (${response.status}): ${detail}`);
    }

    const body = (await response.json()) as BrevoSuccessResponse;
    const messageIds = normaliseBatchResponse(body, payload.messageVersions);

    return { messageIds, statusCode: response.status };
}
