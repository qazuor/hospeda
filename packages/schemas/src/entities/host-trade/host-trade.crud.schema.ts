import { z } from 'zod';
import { stripShapeDefaults } from '../../utils/utils.js';
import { HostTradeSchema } from './host-trade.schema.js';

/**
 * Schema for creating a new host-trade entry.
 *
 * Omits auto-generated fields (id, timestamps, audit, soft-delete).
 * `slug` is optional — the server will auto-generate it from `name` if absent.
 * `scheduleText` is optional (applies when `is24h` is false).
 * `isActive` defaults to `true` and can be overridden on creation.
 */
export const CreateHostTradeSchema = HostTradeSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    createdById: true,
    updatedById: true,
    deletedAt: true,
    deletedById: true,

    // HOS-376 §7.2 — server-managed, and this schema is built by OMITTING
    // rather than allowlisting, so leaving them out here is what keeps them
    // out of the admin create body. The counters are recomputed from the rows
    // that exist (an admin typing one would be overwritten by the next
    // recalculation anyway), and a suspension is applied by the
    // rejection-threshold cron or by its own admin endpoint, never by a
    // generic create. `HOST_TRADE_DOMAIN_MANAGED_FIELDS` guards this.
    confirmedUsesCount: true,
    distinctHostsCount: true,
    reviewsCount: true,
    averageRating: true,
    benefitRespectedCount: true,
    declarationSuspendedAt: true,
    declarationSuspendedById: true,
    declarationSuspendReason: true
}).extend({
    /**
     * URL-safe slug. Optional on creation — the API generates one from `name`
     * if this field is absent or empty.
     */
    slug: z.string().min(1, { message: 'zodError.hostTrade.slug.min' }).optional()
});

/**
 * Schema for partially updating an existing host-trade entry.
 *
 * All mutable fields are optional. Absent keys are treated as "no change".
 * Defaults from `CreateHostTradeSchema` are stripped so a PATCH with an empty
 * body does not accidentally overwrite server state (SPEC-217 / Zod 4 behaviour).
 */
export const UpdateHostTradeSchema = z
    .object(stripShapeDefaults(CreateHostTradeSchema.shape))
    .partial();

/**
 * Inferred TypeScript type for the host-trade create input.
 */
export type CreateHostTrade = z.infer<typeof CreateHostTradeSchema>;

/**
 * Inferred TypeScript type for the host-trade partial update input.
 */
export type UpdateHostTrade = z.infer<typeof UpdateHostTradeSchema>;
