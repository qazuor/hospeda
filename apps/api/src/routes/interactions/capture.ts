/**
 * Public capture endpoint for listing interactions (HOS-2256).
 *
 * ```
 * POST /api/v1/public/interactions
 * ```
 *
 * The sibling of `POST /api/v1/public/views` and
 * `POST /api/v1/public/partner-logo-clicks`: same `skipAuth`, same bot filter
 * (`isBotUserAgent` from `@repo/utils`, never a second regex), same rate limit,
 * same always-202 contract.
 *
 * Differences from the view beacon, all deliberate:
 * - **The visitor hash never uses the user id.** `user:<uuid>` would store the
 *   identity of a person who showed a contact intention towards a venue. A
 *   logged-in visitor is hashed by truncated IP + UA with the daily salt, like
 *   an anonymous one. The actor is read ONLY to drop the owner's own taps.
 * - **The service verifies the listing exists, is published, and that an
 *   `eventId` belongs to it.** Every outcome is a 202, so nothing here is an
 *   existence oracle.
 *
 * Asserting the HTTP status proves nothing about whether a tap was recorded.
 * Assert the row.
 *
 * @module routes/interactions/capture
 */

import { EntityInteractionCaptureBodySchema, ServiceErrorCode } from '@repo/schemas';
import { EntityInteractionService } from '@repo/service-core';
import { isBotUserAgent } from '@repo/utils';
import type { Context } from 'hono';
import { getClientIp } from '../../middlewares/rate-limit';
import { isGuestActor } from '../../utils/actor';
import { env } from '../../utils/env';
import { apiLogger } from '../../utils/logger';
import { createSimpleRoute } from '../../utils/route-factory';
import { computeVisitorHash } from '../../utils/visitor-hash';
import { z } from '../../utils/zod';

const interactionService = new EntityInteractionService({ logger: apiLogger });

/** Always `{ accepted: true }`: a bot, a drop, a record and a DB outage look identical. */
const CaptureInteractionResponseSchema = z.object({
    accepted: z.boolean()
});

/**
 * POST /api/v1/public/interactions
 *
 * Records one tap on a venue page element. Rate limit 30 requests / 60 s per IP.
 */
export const captureInteractionRoute = createSimpleRoute({
    method: 'post',
    path: '/interactions',
    summary: 'Capture listing interaction',
    description:
        'Records a tap on a listing page element (phone, map, website, ticket, WhatsApp). Fire-and-forget: always 202 unless the body is invalid.',
    tags: ['Analytics'],
    responseSchema: CaptureInteractionResponseSchema,
    handler: async (ctx: Context) => {
        // 1. Bot filter FIRST, before any DB or hashing work.
        const ua = ctx.req.header('user-agent');
        if (isBotUserAgent(ua)) {
            return ctx.json({ success: true, accepted: true }, 202);
        }

        // 2. Validate body. Generic messages: no echo of details.
        let rawBody: unknown;
        try {
            rawBody = await ctx.req.json();
        } catch {
            return ctx.json(
                {
                    success: false,
                    error: {
                        code: ServiceErrorCode.VALIDATION_ERROR,
                        message: 'Invalid JSON in request body'
                    }
                },
                400
            );
        }

        const parsed = EntityInteractionCaptureBodySchema.safeParse(rawBody);
        if (!parsed.success) {
            return ctx.json(
                {
                    success: false,
                    error: {
                        code: ServiceErrorCode.VALIDATION_ERROR,
                        message: 'Invalid request body'
                    }
                },
                400
            );
        }

        const { entityType, entityId, kind, eventId } = parsed.data;

        // 3. Visitor hash, server-side. NO userId: see the file header.
        const visitorHash = computeVisitorHash({
            ip: getClientIp({ c: ctx }),
            userAgent: ua ?? '',
            secret: env.HOSPEDA_VIEWS_HASH_SECRET
        });

        // 4. The actor is used only to drop the owner's own taps.
        const actor = ctx.get('actor');
        const actorUserId = actor && !isGuestActor(actor) ? actor.id : null;

        const result = await interactionService.capture({
            entityType,
            entityId,
            kind,
            eventId,
            visitorHash,
            actorUserId
        });

        if (!result.recorded) {
            // Logged, never surfaced. `visitorHash` is not logged (privacy contract).
            apiLogger.debug(
                { entityType, entityId, kind, reason: result.reason },
                'Interaction not recorded (silenced to public)'
            );
        }

        return ctx.json({ success: true, accepted: true }, 202);
    },
    options: {
        skipAuth: true,
        customRateLimit: { requests: 30, windowMs: 60000 }
    }
});
