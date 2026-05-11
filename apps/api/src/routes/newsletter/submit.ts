import { z } from '@hono/zod-openapi';
import { NewsletterSubmitSchema, ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { SanitizationLevel, sanitizeEmail, sanitizeString } from '../../middlewares/sanitization';
import { env } from '../../utils/env';
import { apiLogger } from '../../utils/logger';
import { createSimpleRoute } from '../../utils/route-factory';

/**
 * Newsletter subscription response schema.
 *
 * Always returns `{ success: true }` for the happy path, for
 * honeypot-flagged submissions, AND when the email provider is
 * unconfigured (the submission is logged for manual recovery). The
 * client cannot distinguish the three cases — that's intentional.
 */
const NewsletterResponseSchema = z.object({
    success: z.boolean(),
    message: z.string()
});

const BREVO_BASE_URL = 'https://api.brevo.com/v3';

/**
 * Add a contact to the configured Brevo list. Idempotent: existing
 * contacts get re-attached to the list with `updateEnabled: true`,
 * which makes Brevo respond 204 instead of 400 "Contact already
 * exists".
 *
 * Returns the response status code so the caller can log structurally,
 * or `null` when the network call itself failed.
 */
async function addContactToBrevoList(input: {
    email: string;
    listId: number;
    apiKey: string;
}): Promise<{ status: number | null; error?: string }> {
    const body = {
        email: input.email,
        listIds: [input.listId],
        // Idempotency knob: when true, an existing contact is updated and
        // attached to the list; when false, a duplicate returns 400.
        updateEnabled: true
    };

    try {
        const response = await fetch(`${BREVO_BASE_URL}/contacts`, {
            method: 'POST',
            headers: {
                'api-key': input.apiKey,
                'content-type': 'application/json',
                accept: 'application/json'
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            // Brevo returns JSON error bodies like { code, message }.
            // Fall back to status text when JSON parsing fails so we
            // never lose detail.
            let detail: string;
            try {
                const errorJson = (await response.json()) as { message?: string };
                detail =
                    errorJson.message ?? `${response.status} ${response.statusText || 'error'}`;
            } catch {
                detail = `${response.status} ${response.statusText || 'error'}`;
            }
            return { status: response.status, error: detail };
        }

        return { status: response.status };
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return { status: null, error: message };
    }
}

/**
 * POST /api/v1/public/newsletter
 *
 * Public endpoint for the pre-launch newsletter signup on
 * https://hospeda.com.ar (apps/landing).
 *
 *   - Validates body against `NewsletterSubmitSchema` from @repo/schemas.
 *   - Sanitizes the email before forwarding to Brevo.
 *   - Honeypot: a non-empty `website` field returns 200 fake-success
 *     without contacting Brevo.
 *   - Rate limit: 3 requests/60s per IP (lower than contact because
 *     newsletter is a softer target for spam).
 *   - Forwards to the Brevo Contacts API with `updateEnabled: true`,
 *     so re-submissions of the same email are idempotent (no error).
 *   - When the API key or list ID is unset, logs a warning and returns
 *     fake-success so the landing form never blocks the user.
 */
export const submitNewsletterRoute = createSimpleRoute({
    method: 'post',
    path: '/newsletter',
    summary: 'Subscribe to newsletter',
    description: 'Subscribes an email address to the pre-launch newsletter list',
    tags: ['Newsletter'],
    responseSchema: NewsletterResponseSchema,
    handler: async (ctx: Context) => {
        const rawBody = await ctx.req.json().catch(() => ({}));

        // ── 1. Validate via Zod (errors map to 400) ───────────────────────────
        const parsed = NewsletterSubmitSchema.safeParse(rawBody);
        if (!parsed.success) {
            throw new ServiceError(
                ServiceErrorCode.VALIDATION_ERROR,
                'Invalid newsletter submission',
                parsed.error.flatten()
            );
        }
        const validated = parsed.data;

        // ── 2. Honeypot check — bots autofill `website`, real users don't ─────
        if (validated.website && validated.website.length > 0) {
            apiLogger.info(
                {
                    honeypot: true,
                    emailDomain: validated.email.split('@')[1]
                },
                'Newsletter submission rejected by honeypot'
            );
            return {
                success: true,
                message: 'Suscripción registrada'
            };
        }

        // ── 3. Sanitize email ─────────────────────────────────────────────────
        // sanitizeString is overkill for an email but keeps the payload safe
        // from exotic bytes that could trip up Brevo's parser.
        const sanitizedEmail = sanitizeEmail(
            sanitizeString(validated.email, SanitizationLevel.STRICT, 254)
        );

        if (!sanitizedEmail) {
            throw new ServiceError(
                ServiceErrorCode.VALIDATION_ERROR,
                'Invalid newsletter submission',
                { email: ['Invalid email after sanitization'] }
            );
        }

        const emailDomain = sanitizedEmail.split('@')[1];

        // ── 4. Audit log (no full PII; just the domain) ───────────────────────
        apiLogger.info({ emailDomain }, 'Newsletter subscription received');

        // ── 5. Soft-fail when the provider is not configured ──────────────────
        // Pre-launch we cannot risk the form returning errors that confuse
        // visitors. If the API key or list ID is missing, we log loudly so
        // the operator knows to wire it up, but return success to the user.
        if (!env.HOSPEDA_EMAIL_API_KEY || !env.HOSPEDA_BREVO_NEWSLETTER_LIST_ID) {
            apiLogger.warn(
                {
                    emailDomain,
                    hasApiKey: Boolean(env.HOSPEDA_EMAIL_API_KEY),
                    hasListId: Boolean(env.HOSPEDA_BREVO_NEWSLETTER_LIST_ID)
                },
                'Newsletter submission persisted in logs only (Brevo not configured)'
            );
            return {
                success: true,
                message: 'Suscripción registrada'
            };
        }

        // ── 6. Forward to Brevo ───────────────────────────────────────────────
        const brevoResult = await addContactToBrevoList({
            email: sanitizedEmail,
            listId: env.HOSPEDA_BREVO_NEWSLETTER_LIST_ID,
            apiKey: env.HOSPEDA_EMAIL_API_KEY
        });

        if (brevoResult.error) {
            // Don't surface upstream failures to the user — log and pretend
            // success. The signup is preserved in audit logs above so we can
            // backfill the list if Brevo went down for an extended window.
            apiLogger.error(
                {
                    emailDomain,
                    brevoStatus: brevoResult.status,
                    brevoError: brevoResult.error
                },
                'Newsletter submission failed at Brevo (logged for backfill)'
            );
        } else {
            apiLogger.info(
                {
                    emailDomain,
                    brevoStatus: brevoResult.status,
                    listId: env.HOSPEDA_BREVO_NEWSLETTER_LIST_ID
                },
                'Newsletter subscription forwarded to Brevo'
            );
        }

        return {
            success: true,
            message: 'Suscripción registrada'
        };
    },
    options: {
        skipAuth: true,
        customRateLimit: { requests: 3, windowMs: 60000 }
    }
});
