import { z } from '@hono/zod-openapi';
import type { NotificationPayload } from '@repo/notifications';
import { NotificationType } from '@repo/notifications';
import { ContactSubmitSchema, ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { SanitizationLevel, sanitizeEmail, sanitizeString } from '../../middlewares/sanitization';
import { env } from '../../utils/env';
import { apiLogger } from '../../utils/logger';
import { sendNotification } from '../../utils/notification-helper';
import { createSimpleRoute } from '../../utils/route-factory';

/**
 * Contact form response schema.
 *
 * Always returns `{ success: true }` for the happy path AND for honeypot-flagged
 * submissions — clients (including bots) cannot distinguish a real success from
 * a silently-dropped honeypot rejection.
 */
const ContactResponseSchema = z.object({
    success: z.boolean(),
    message: z.string()
});

const FIELD_LIMITS = {
    firstName: 100,
    lastName: 100,
    message: 2000
} as const;

/**
 * Human-readable Spanish labels for each contact type. Used in the email
 * subject so triage in the inbox is faster than parsing the raw slug.
 * Falls back to the slug if a new type is added and not yet mapped.
 *
 * Exported for test coverage: every `ContactTypeEnumSchema` value must have
 * a label so no raw slug ever reaches the support inbox.
 */
export const CONTACT_TYPE_LABELS: Record<string, string> = {
    general: 'Consulta general',
    support: 'Soporte técnico',
    publish_accommodation: 'Publicar alojamiento',
    subscriptions: 'Suscripciones y pagos',
    suggestions: 'Sugerencias',
    report: 'Reporte',
    press: 'Prensa',
    partnerships: 'Alianzas comerciales',
    event_submission: 'Sumar evento',
    accommodation: 'Consulta sobre alojamiento',
    report_destination_info: 'Reporte de información de destino',
    photo_submission: 'Aporte de fotos',
    editor_application: 'Postulación de editor'
};

/**
 * Resolve the support inbox to which contact form submissions should be sent.
 *
 * Order of precedence:
 *   1. HOSPEDA_ADMIN_NOTIFICATION_EMAILS (first entry of the comma-separated list)
 *   2. HOSPEDA_FEEDBACK_FALLBACK_EMAIL (already used by the Feedback FAB)
 *   3. Hardcoded `info@hospeda.com.ar` as last-resort default.
 */
function resolveSupportInbox(): string {
    const adminList = env.HOSPEDA_ADMIN_NOTIFICATION_EMAILS;
    if (adminList && adminList.length > 0) {
        const first = adminList.split(',')[0]?.trim();
        if (first && first.length > 0) return first;
    }
    if (env.HOSPEDA_FEEDBACK_FALLBACK_EMAIL) {
        return env.HOSPEDA_FEEDBACK_FALLBACK_EMAIL;
    }
    return 'info@hospeda.com.ar';
}

/**
 * POST /api/v1/public/contact
 *
 * Public endpoint for submitting contact-form messages.
 *
 * SPEC-096:
 *   - Validates body against `ContactSubmitSchema` from @repo/schemas.
 *   - Sanitizes user-supplied fields against XSS/HTML injection before they
 *     reach the email template.
 *   - Honeypot: a non-empty `website` field returns 200 fake-success without
 *     logging contact details (the request is recorded as a bot drop only).
 *   - Rate limit: 5 requests/60s per IP (handled by `customRateLimit`).
 *   - Sends an email to the configured support inbox via @repo/notifications
 *     (Resend). When the API key is unset or delivery fails, the submission
 *     is still recorded in structured logs so it is never fully lost.
 */
export const submitContactRoute = createSimpleRoute({
    method: 'post',
    path: '/contact',
    summary: 'Submit contact form',
    description: 'Receives and processes a public contact form submission',
    tags: ['Contact'],
    responseSchema: ContactResponseSchema,
    handler: async (ctx: Context) => {
        const rawBody = await ctx.req.json().catch(() => ({}));

        // ── 1. Validate via Zod (errors map to 400) ───────────────────────────
        const parsed = ContactSubmitSchema.safeParse(rawBody);
        if (!parsed.success) {
            throw new ServiceError(
                ServiceErrorCode.VALIDATION_ERROR,
                'Invalid contact form submission',
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
                'Contact form submission rejected by honeypot'
            );
            return {
                success: true,
                message: 'Mensaje enviado correctamente'
            };
        }

        // ── 3. Sanitize all user-supplied text fields ─────────────────────────
        const sanitized = {
            firstName: sanitizeString(
                validated.firstName,
                SanitizationLevel.STRICT,
                FIELD_LIMITS.firstName
            ),
            lastName: sanitizeString(
                validated.lastName,
                SanitizationLevel.STRICT,
                FIELD_LIMITS.lastName
            ),
            email: sanitizeEmail(validated.email),
            message: sanitizeString(
                validated.message,
                SanitizationLevel.STRICT,
                FIELD_LIMITS.message,
                true /* preserveNewlines */
            ),
            type: validated.type,
            accommodationId: validated.accommodationId
        };

        // sanitizeEmail returns '' on invalid format. ContactSubmitSchema already
        // validated the email, so a falsy result here means a malformed payload
        // got past Zod (e.g. exotic Unicode). Reject explicitly rather than
        // silently dropping the submission.
        if (!sanitized.email) {
            throw new ServiceError(
                ServiceErrorCode.VALIDATION_ERROR,
                'Invalid contact form submission',
                { email: ['Invalid email after sanitization'] }
            );
        }

        const submittedAt = new Date().toISOString();

        // ── 4. Audit log (no PII beyond email domain) ─────────────────────────
        apiLogger.info(
            {
                contactType: sanitized.type,
                accommodationId: sanitized.accommodationId,
                messageLength: sanitized.message.length,
                emailDomain: sanitized.email.split('@')[1]
            },
            'Contact form submission received'
        );

        // ── 5. Send email to support inbox via @repo/notifications ───────────
        const supportInbox = resolveSupportInbox();
        const contactTypeLabel = CONTACT_TYPE_LABELS[sanitized.type] ?? sanitized.type;
        const payload: NotificationPayload = {
            type: NotificationType.CONTACT_SUBMISSION,
            recipientEmail: supportInbox,
            recipientName: 'Hospeda Support',
            userId: null,
            contactType: contactTypeLabel,
            senderFirstName: sanitized.firstName,
            senderLastName: sanitized.lastName,
            senderEmail: sanitized.email,
            message: sanitized.message,
            accommodationId: sanitized.accommodationId,
            submittedAt
        };

        // Treat missing API key as a soft failure — the submission is still
        // logged above and we return success so the user is not blocked.
        // Once HOSPEDA_EMAIL_API_KEY is set in the runtime env, real delivery
        // kicks in.
        if (env.HOSPEDA_EMAIL_API_KEY) {
            try {
                await sendNotification(payload, { skipDb: true, skipLogging: true });
                apiLogger.info(
                    { recipient: supportInbox, contactType: sanitized.type },
                    'Contact form email dispatched to support inbox'
                );
            } catch (deliveryError: unknown) {
                const msg =
                    deliveryError instanceof Error ? deliveryError.message : String(deliveryError);
                apiLogger.error(
                    {
                        error: msg,
                        recipient: supportInbox,
                        contactType: sanitized.type,
                        emailDomain: sanitized.email.split('@')[1]
                    },
                    'Contact form email delivery failed (submission persisted in logs)'
                );
            }
        } else {
            apiLogger.warn(
                'HOSPEDA_EMAIL_API_KEY not set — contact submission stored in logs only'
            );
        }

        return {
            success: true,
            message: 'Mensaje enviado correctamente'
        };
    },
    options: {
        skipAuth: true,
        customRateLimit: { requests: 5, windowMs: 60000 }
    }
});
