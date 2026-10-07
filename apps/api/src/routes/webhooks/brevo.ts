/**
 * @file webhooks/brevo.ts
 *
 * Brevo webhook receiver for newsletter delivery events (SPEC-101 T-101-32,
 * auth mechanism revisited in SPEC-115).
 *
 *   POST /api/v1/public/webhooks/brevo/:token
 *
 * Public route — there is no user session involved — but the request is
 * gated by a static shared token embedded in the URL path. Brevo does NOT
 * send any authentication header on outgoing webhook deliveries by default
 * (the legacy `X-Sib-Webhook-Token` was a Sendinblue-era convention that
 * did not survive the rebrand). The dashboard UI does not expose
 * configuration for custom headers or bearer auth either, so the only
 * reliable authentication that is robust across UI edits is to encode the
 * secret in the webhook URL itself. The path param is matched against
 * `HOSPEDA_BREVO_WEBHOOK_SECRET` via `timingSafeEqual` to defeat
 * short-circuit comparison attacks.
 *
 * Body shape: Brevo posts either a single event object or an array of
 * events; we normalise to an array and pass each through
 * `NewsletterTrackingService.processBrevoWebhookEvent`. Events with an
 * `event` field outside the SPEC-101 §4.4 whitelist are silently skipped
 * — Brevo emits "request", "proxy_open", etc. that we don't care about.
 *
 * Hard bounces (HOS-1627, AC:U2:12): a `hard_bounce` event is ALSO written as
 * the idempotent `bounced` row of the address in `notification_log`, which
 * the email outbox suppression reads. That write happens before the
 * newsletter forwarding, and its failure answers 503 so Brevo redelivers.
 * A hard_bounce whose fields fail validation is logged and skipped.
 *
 * Logging policy: a signature mismatch is logged as a WARN (it's almost
 * certainly a misconfiguration or a probe — not an exception). Other
 * processing errors per-event are warns; we still return 200 to Brevo so
 * it does not retry the entire batch forever.
 *
 * Security trade-off: the secret appears in upstream proxy logs
 * (Cloudflare, Traefik) since it lives in the URL. Rotate the secret
 * periodically — and ALWAYS after any suspected leak — by generating a
 * new value (`openssl rand -hex 32`), updating
 * `HOSPEDA_BREVO_WEBHOOK_SECRET` in Coolify, and updating the webhook URL
 * in the Brevo dashboard for every environment.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';
import { notificationLogModel } from '@repo/db';
import { recordProviderHardBounce } from '@repo/notifications';
import { ServiceErrorCode } from '@repo/schemas';
import { NewsletterTrackingService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { createPerRouteRateLimitMiddleware } from '../../middlewares/rate-limit';
import { createRouter } from '../../utils/create-app';
import { env } from '../../utils/env';
import { apiLogger } from '../../utils/logger';

// ---------------------------------------------------------------------------
// Singleton — lazily constructed so the API can boot without a webhook secret
// ---------------------------------------------------------------------------

let cachedTrackingService: NewsletterTrackingService | null = null;

function getTrackingService(): NewsletterTrackingService {
    if (!cachedTrackingService) {
        cachedTrackingService = new NewsletterTrackingService({ logger: apiLogger });
    }
    return cachedTrackingService;
}

/** Test seam — drops the cached singleton between unit tests. */
export function _resetBrevoWebhookCache(): void {
    cachedTrackingService = null;
}

// ---------------------------------------------------------------------------
// Signature verification
// ---------------------------------------------------------------------------

/**
 * Constant-time comparison of the request-supplied token against the
 * configured webhook secret. Uses `timingSafeEqual` over a fixed-length
 * digest of each side so the function never short-circuits on length
 * mismatch either (also a side-channel).
 *
 * @returns true when the token matches.
 */
function verifyWebhookToken(input: { token: string; secret: string }): boolean {
    if (!input.secret) return false;
    if (!input.token) return false;
    const a = createHmac('sha256', '__brevo_token__').update(input.token).digest();
    const b = createHmac('sha256', '__brevo_token__').update(input.secret).digest();
    if (a.length !== b.length) return false;
    try {
        return timingSafeEqual(a, b);
    } catch {
        return false;
    }
}

// ---------------------------------------------------------------------------
// Brevo event normalisation
// ---------------------------------------------------------------------------

/**
 * The set of Brevo events we forward to the tracking service. Brevo's
 * full event vocabulary is wider (request, proxy_open, ...) — anything
 * outside this whitelist is a no-op.
 */
const FORWARDED_EVENTS = new Set([
    'delivered',
    'hard_bounce',
    'soft_bounce',
    'spam',
    'complained',
    'unsubscribed',
    'invalid_email',
    'opened',
    'click'
]);

interface RawBrevoEvent {
    readonly event?: string;
    readonly email?: string;
    /** Brevo serialises message-id with the dash (NOT camelCase). */
    readonly 'message-id'?: string;
    readonly messageId?: string;
    readonly date?: string;
    readonly ts?: number;
    readonly ts_event?: number;
    /** Bounce reason (transactional `hard_bounce` / `soft_bounce` events). */
    readonly reason?: string;
}

/** `notification_log.recipient` is `varchar(255)`. */
const RECIPIENT_MAX_LENGTH = 255;
/** Upper bound for a Brevo `message-id`; real ones are well under 100 chars. */
const MESSAGE_ID_MAX_LENGTH = 512;
/** The bounce reason is free text from the provider; it is kept, truncated. */
const REASON_MAX_LENGTH = 1000;

/**
 * The fields of a `hard_bounce` event that the suppression write uses. The
 * body arrives as an unchecked cast, so these are validated before they reach
 * the database: an event that fails here is a poison event, logged and
 * skipped, never a 503 that would make Brevo redeliver it forever.
 */
const HardBounceFieldsSchema = z.object({
    email: z.email().max(RECIPIENT_MAX_LENGTH),
    messageId: z.string().trim().min(1).max(MESSAGE_ID_MAX_LENGTH).optional(),
    reason: z
        .unknown()
        .transform((value) =>
            typeof value === 'string' ? value.slice(0, REASON_MAX_LENGTH) : null
        )
});

/** Outcome of {@link recordHardBounce}. */
type HardBounceOutcome = 'recorded' | 'invalid' | 'write_failed';

/**
 * Turns a `hard_bounce` event into the idempotent `bounced` row of the address
 * in `notification_log` (HOS-1627, AC:U2:12), so the email outbox suppresses
 * every later mail to it. Brevo's transactional webhook sends
 * `{ event: 'hard_bounce', email, 'message-id', reason, ... }`; the marketing
 * one carries no `message-id`, and the key then falls back to the address.
 *
 * @returns `recorded` when the bounce is in the log (now or by an earlier
 *   delivery of the same event); `invalid` when its fields fail validation
 *   (the caller skips the event); `write_failed` when the write threw (the
 *   caller answers 503 so Brevo redelivers).
 */
async function recordHardBounce(input: {
    readonly email: string;
    readonly messageId: unknown;
    readonly raw: RawBrevoEvent;
}): Promise<HardBounceOutcome> {
    const fields = HardBounceFieldsSchema.safeParse({
        email: input.email,
        messageId: input.messageId ?? undefined,
        reason: input.raw.reason
    });
    if (!fields.success) {
        apiLogger.warn(
            { issues: fields.error.issues.map((issue) => issue.path.join('.')) },
            'Brevo webhook: invalid hard_bounce event, skipped'
        );
        return 'invalid';
    }
    try {
        const { inserted } = await recordProviderHardBounce({
            log: notificationLogModel,
            provider: 'brevo',
            recipient: fields.data.email,
            messageId: fields.data.messageId ?? null,
            reason: fields.data.reason,
            at: parseEventDate(input.raw)
        });
        apiLogger.info(
            { inserted, hasMessageId: Boolean(fields.data.messageId) },
            'Brevo webhook: hard bounce recorded in notification_log'
        );
        return 'recorded';
    } catch (err) {
        apiLogger.error(
            { error: err instanceof Error ? err.message : String(err) },
            'Brevo webhook: failed to record hard bounce, asking Brevo to redeliver'
        );
        return 'write_failed';
    }
}

/**
 * Best-effort timestamp parse. Brevo sends either `date` (ISO string),
 * `ts_event` (unix seconds) or `ts` (unix seconds, older payload shape).
 */
function parseEventDate(raw: RawBrevoEvent): Date {
    if (typeof raw.date === 'string') {
        const parsed = new Date(raw.date);
        if (!Number.isNaN(parsed.getTime())) return parsed;
    }
    const seconds = raw.ts_event ?? raw.ts;
    if (typeof seconds === 'number' && Number.isFinite(seconds)) {
        return new Date(seconds * 1000);
    }
    return new Date();
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

async function brevoWebhookHandler(c: Context): Promise<Response> {
    const expectedSecret = env.HOSPEDA_BREVO_WEBHOOK_SECRET;
    if (!expectedSecret) {
        // The endpoint is mounted but ops hasn't set the secret — refuse
        // everything as a precaution.
        apiLogger.warn(
            { reason: 'WEBHOOK_SECRET_NOT_CONFIGURED' },
            'Brevo webhook: HOSPEDA_BREVO_WEBHOOK_SECRET unset, rejecting'
        );
        return c.json({ error: 'invalid_signature' }, 401);
    }

    const pathToken = c.req.param('token');
    if (!verifyWebhookToken({ token: pathToken ?? '', secret: expectedSecret })) {
        apiLogger.warn(
            {
                hasToken: Boolean(pathToken),
                ip: c.req.header('cf-connecting-ip') ?? c.req.header('x-forwarded-for') ?? null
            },
            'Brevo webhook: signature mismatch'
        );
        return c.json({ error: 'invalid_signature' }, 401);
    }

    // Body parsing — Brevo posts either a single event OR an array.
    let payload: RawBrevoEvent | RawBrevoEvent[];
    try {
        payload = (await c.req.json()) as RawBrevoEvent | RawBrevoEvent[];
    } catch (err) {
        apiLogger.warn(
            { error: err instanceof Error ? err.message : String(err) },
            'Brevo webhook: malformed JSON body'
        );
        return c.json({ error: 'invalid_payload' }, 400);
    }

    const events: RawBrevoEvent[] = Array.isArray(payload) ? payload : [payload];
    const tracking = getTrackingService();

    let processed = 0;
    let skipped = 0;

    for (const raw of events) {
        if (!raw || typeof raw !== 'object') {
            skipped += 1;
            continue;
        }
        const eventType = typeof raw.event === 'string' ? raw.event.trim() : '';
        if (!FORWARDED_EVENTS.has(eventType)) {
            skipped += 1;
            continue;
        }
        const email = typeof raw.email === 'string' ? raw.email.trim() : '';
        if (!email) {
            skipped += 1;
            continue;
        }

        const messageId = raw.messageId ?? raw['message-id'];

        // AC:U2:12 — the suppression record goes first and on its own: the
        // newsletter tracking below only knows newsletter mail, and a bounce
        // of any mail must suppress the address.
        // - An invalid hard_bounce (bad email, oversized message-id) is a
        //   poison event: logged and skipped, newsletter forwarding included,
        //   so Brevo never redelivers it forever.
        // - A failed write answers 503 at once, without forwarding THIS event
        //   to the newsletter tracker; Brevo then redelivers the whole batch.
        //   Events earlier in the batch were already processed and are
        //   processed again on redelivery — the bounce write is idempotent
        //   and the tracker's writes land on the same terminal state.
        if (eventType === 'hard_bounce') {
            const outcome = await recordHardBounce({ email, messageId, raw });
            if (outcome === 'invalid') {
                skipped += 1;
                continue;
            }
            if (outcome === 'write_failed') {
                return c.json({ error: 'service_unavailable' }, 503);
            }
        }

        try {
            const result = await tracking.processBrevoWebhookEvent({
                event: eventType as
                    | 'delivered'
                    | 'hard_bounce'
                    | 'soft_bounce'
                    | 'spam'
                    | 'complained'
                    | 'unsubscribed'
                    | 'invalid_email'
                    | 'opened'
                    | 'click',
                email,
                messageId: messageId ?? undefined,
                date: parseEventDate(raw)
            });
            if (result.error) {
                apiLogger.warn(
                    { code: result.error.code, message: result.error.message, eventType },
                    'Brevo webhook: per-event processing returned an error'
                );
                skipped += 1;
            } else {
                processed += 1;
            }
        } catch (err) {
            if (err instanceof ServiceError && err.code === ServiceErrorCode.SERVICE_UNAVAILABLE) {
                apiLogger.error(
                    { code: err.code, message: err.message },
                    'Brevo webhook: tracking service unavailable, aborting batch'
                );
                return c.json({ error: 'service_unavailable' }, 503);
            }
            apiLogger.warn(
                {
                    error: err instanceof Error ? err.message : String(err),
                    eventType
                },
                'Brevo webhook: unexpected error processing event'
            );
            skipped += 1;
        }
    }

    return c.json({ ok: true, processed, skipped });
}

// ---------------------------------------------------------------------------
// Router export
// ---------------------------------------------------------------------------

const brevoRateLimiter = createPerRouteRateLimitMiddleware({
    requests: 1000,
    windowMs: 60_000
});

/** Hono router mounted at `/api/v1/public/webhooks/brevo/:token`. */
export const brevoWebhookRoutes = createRouter().post(
    '/brevo/:token',
    brevoRateLimiter,
    brevoWebhookHandler
);

// Export internals for testing
export { brevoWebhookHandler as _brevoWebhookHandler, verifyWebhookToken as _verifyWebhookToken };
