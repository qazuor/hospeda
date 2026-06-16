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
    deletedById: true
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
