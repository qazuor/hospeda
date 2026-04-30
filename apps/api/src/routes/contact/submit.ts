import { z } from '@hono/zod-openapi';
import { ContactSubmitSchema, ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { apiLogger } from '../../utils/logger';
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

/**
 * POST /api/v1/public/contact
 *
 * Public endpoint for submitting contact-form messages.
 *
 * SPEC-096 / REQ-096-30 (T-033):
 *   - Validates body against `ContactSubmitSchema` from @repo/schemas.
 *   - Honeypot: a non-empty `website` field returns 200 fake-success without
 *     logging contact details (the request is recorded as a bot drop only).
 *   - Rate limit: 5 requests/60s per IP (handled by `customRateLimit`).
 *
 * TODO(SPEC-096): wire up `@repo/notifications` to actually deliver the
 *   contact email. For now the submission is structured-logged for later
 *   batch processing, matching the previous behavior of this route.
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

        // Validate the body via safeParse so Zod errors map to 400 (not 500).
        const parsed = ContactSubmitSchema.safeParse(rawBody);
        if (!parsed.success) {
            throw new ServiceError(
                ServiceErrorCode.VALIDATION_ERROR,
                'Invalid contact form submission',
                parsed.error.flatten()
            );
        }
        const validated = parsed.data;

        // Honeypot check — bots autofill `website`, real users don't.
        // Return fake success without logging contact PII or notifying anyone.
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

        apiLogger.info(
            {
                contactType: validated.type,
                accommodationId: validated.accommodationId,
                messageLength: validated.message.length,
                emailDomain: validated.email.split('@')[1]
            },
            'Contact form submission received'
        );

        // TODO(SPEC-096): integrate with @repo/notifications to send a
        //   transactional email to the support inbox. Until that's wired,
        //   the submission lives in structured logs only.

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
