/**
 * Public commerce lead intake endpoint (SPEC-239 T-047 US-1)
 *
 * Receives a prospective commerce owner's "Sumar mi negocio" form submission
 * and persists it as a CommerceLead record for admin review.  No authentication
 * is required — this is a public acquisition funnel endpoint.
 *
 * ## Spam mitigation
 * 1. **Honeypot field** (`_hp`): a hidden form field that real users leave empty.
 *    Any request that includes a non-empty `_hp` is silently rejected with 200 OK
 *    so bots do not discover the guard.
 * 2. **Custom rate-limit**: 5 submissions per IP per minute (aggressive because
 *    legitimate users rarely need to resubmit within the same minute).
 *
 * @module routes/commerce/public/create-lead
 */

import type { CommerceLeadCreateInput } from '@repo/schemas';
import { CommerceLeadCreateInputSchema, CommerceLeadSchema } from '@repo/schemas';
import { CommerceLeadService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createPublicRoute } from '../../../utils/route-factory';

const commerceLeadService = new CommerceLeadService({ logger: apiLogger });

/**
 * Extended request body: the canonical create-input schema augmented with an
 * optional honeypot field `_hp`.  The field is stripped before the payload
 * is forwarded to the service.
 */
const CreateLeadRequestSchema = CommerceLeadCreateInputSchema.extend({
    /**
     * Honeypot field — must be absent or empty.
     * Hidden from real users via CSS (`display:none` / `visibility:hidden`);
     * bots that auto-fill forms will populate it.
     */
    _hp: z.string().max(256).optional()
});

/** Typed input including the optional honeypot field. */
type CreateLeadRequest = z.infer<typeof CreateLeadRequestSchema>;

/**
 * POST /api/v1/public/commerce/leads
 *
 * Accepts a commerce lead submission from the public acquisition form.
 * Returns 200 on success so bots cannot distinguish a honeypot rejection
 * from a real submission (silent reject pattern).
 */
export const publicCreateLeadRoute = createPublicRoute({
    method: 'post',
    path: '/',
    summary: 'Submit a commerce listing lead',
    description:
        'Accepts a "Sumar mi negocio" form submission.  No authentication ' +
        'required.  Includes honeypot spam guard.  Returns 200 on both success ' +
        'and honeypot rejection to prevent bot discovery.',
    tags: ['Commerce'],
    requestBody: CreateLeadRequestSchema,
    responseSchema: CommerceLeadSchema.partial(),
    handler: async (
        ctx: Context,
        _params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const typedBody = body as CreateLeadRequest;

        // ── Honeypot check ──────────────────────────────────────────────────
        // If _hp is present and non-empty the submission is treated as spam.
        // We return a minimal 200-shaped success response to confuse scrapers.
        if (typedBody._hp && typedBody._hp.length > 0) {
            apiLogger.debug(
                { path: ctx.req.path },
                '[commerce-lead] Honeypot triggered — discarding submission'
            );
            // TYPE-WORKAROUND: returning an empty object satisfies the partial
            // CommerceLeadSchema shape used for the silent rejection path.
            return {} as z.infer<typeof CommerceLeadSchema>;
        }

        // Strip the honeypot field before forwarding to service
        const { _hp: _honeypot, ...leadPayload } = typedBody;

        const result = await commerceLeadService.createLead(
            actor,
            leadPayload as CommerceLeadCreateInput
        );

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        // biome-ignore lint/style/noNonNullAssertion: result.data is defined when result.error is absent
        return result.data!;
    },
    options: {
        // 5 submissions per IP per minute — legitimate users rarely resubmit
        // within the same minute; bots hit this quickly.
        customRateLimit: { requests: 5, windowMs: 60_000 }
    }
});
