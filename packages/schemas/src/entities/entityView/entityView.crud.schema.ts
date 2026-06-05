import { z } from 'zod';
import { TrackableEntityTypeSchema } from './entityView.schema.js';

/**
 * EntityView CRUD input schemas (SPEC-159).
 *
 * The capture endpoint is a fire-and-forget write; there are no update or
 * delete inputs exposed via the API (rows are hard-purged by the TTL cron).
 */

// ============================================================================
// CAPTURE (CREATE)
// ============================================================================

/**
 * Service-level capture input — the body sent to the view-capture endpoint.
 *
 * Only `entityType` and `entityId` are supplied by the client. `visitorHash`,
 * `isAuthenticated`, and `viewedAt` are derived server-side (fingerprinting +
 * clock). SPEC-159 §4.1.
 *
 * @example
 * ```ts
 * const body: EntityViewCaptureInput = {
 *   entityType: 'ACCOMMODATION',
 *   entityId: '550e8400-e29b-41d4-a716-446655440000',
 * };
 * ```
 */
export const EntityViewCaptureInputSchema = z
    .object({
        /**
         * Type of the viewed entity. Restricted to the three trackable types
         * (ACCOMMODATION, POST, EVENT) — any other EntityTypeEnum value is
         * rejected at this layer.
         */
        entityType: TrackableEntityTypeSchema,
        /**
         * UUID of the viewed entity. Must be a valid UUID v4; a non-UUID string
         * is rejected even if it looks like a legitimate ID.
         */
        entityId: z
            .string({ message: 'zodError.entityView.entityId.required' })
            .uuid({ message: 'zodError.entityView.entityId.invalidUuid' })
    })
    .strict();

/**
 * TypeScript type for the capture endpoint body, inferred from
 * {@link EntityViewCaptureInputSchema}.
 */
export type EntityViewCaptureInput = z.infer<typeof EntityViewCaptureInputSchema>;
