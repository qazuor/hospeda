/**
 * Public alliance lead intake endpoint (HOS-277 §6.3)
 *
 * Receives a prospective partner/sponsor/editor/service_provider's "aliados"
 * form submission and persists it as an AllianceLead record for admin
 * review. No authentication is required — this is a public acquisition
 * funnel endpoint.
 *
 * ## Spam mitigation
 * 1. **Honeypot field** (`_hp`): a hidden form field that real users leave empty.
 *    Any request that includes a non-empty `_hp` is silently rejected with 200 OK
 *    so bots do not discover the guard.
 * 2. **Custom rate-limit**: 5 submissions per IP per minute, mirroring the
 *    commerce lead intake endpoint (SPEC-239 T-047 US-1).
 *
 * @module routes/alliance/public/create-lead
 */

import type { AllianceLeadCreateInput } from '@repo/schemas';
import { AllianceLeadCreateInputSchema, AllianceLeadCreateResponseSchema } from '@repo/schemas';
import { AllianceLeadService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createPublicRoute } from '../../../utils/route-factory';

const allianceLeadService = new AllianceLeadService({ logger: apiLogger });

/**
 * Extended request body: the canonical create-input schema augmented with an
 * optional honeypot field `_hp`. The field is stripped before the payload
 * is forwarded to the service.
 */
const CreateLeadRequestSchema = AllianceLeadCreateInputSchema.extend({
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
 * POST /api/v1/public/alliance/leads
 *
 * Accepts an alliance lead submission from one of the four "aliados" public
 * landing forms (`partner`, `sponsor`, `editor`, `service_provider`).
 * Returns 200 with `{ id }` on success — only the new lead's UUID is
 * disclosed. On honeypot trigger, returns the same shape with a nil-UUID
 * sentinel id (all-zeros) so bots cannot distinguish a rejection from a real
 * submission (silent reject pattern). A nil UUID is used because the
 * response schema validates `id` as a UUID — an empty string would fail
 * validation.
 */
export const publicCreateAllianceLeadRoute = createPublicRoute({
    method: 'post',
    path: '/',
    summary: 'Submit an alliance lead',
    description:
        'Accepts one of the four "aliados" form submissions (partner, sponsor, ' +
        'editor, service_provider). No authentication required. Includes honeypot ' +
        'spam guard. Returns 200 on both success and honeypot rejection to prevent ' +
        'bot discovery. Response is limited to { id } — no PII, status, or audit ' +
        'fields are disclosed.',
    tags: ['Alliance'],
    requestBody: CreateLeadRequestSchema,
    responseSchema: AllianceLeadCreateResponseSchema,
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
                '[alliance-lead] Honeypot triggered — discarding submission'
            );
            // Silent reject: return a fake id so the response shape matches the
            // real success path and bots receive no distinguishing signal.
            return { id: '00000000-0000-0000-0000-000000000000' };
        }

        // Strip the honeypot field before forwarding to service
        const { _hp: _honeypot, ...leadPayload } = typedBody;

        const result = await allianceLeadService.createLead({
            actor,
            input: leadPayload as AllianceLeadCreateInput
        });

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        // biome-ignore lint/style/noNonNullAssertion: result.data is defined when result.error is absent
        const lead = result.data!;

        // Return only the id — no PII, status, adminNote, or audit fields.
        return { id: lead.id };
    },
    options: {
        // 5 submissions per IP per minute — legitimate users rarely resubmit
        // within the same minute; bots hit this quickly.
        customRateLimit: { requests: 5, windowMs: 60_000 }
    }
});
