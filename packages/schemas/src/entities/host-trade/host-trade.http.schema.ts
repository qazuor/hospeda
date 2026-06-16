/**
 * HostTrade HTTP Schemas
 *
 * Defines the public and admin read shapes for host-trade API responses,
 * plus HTTP-compatible create/update request schemas with coercion.
 *
 * - `HostTradePublicSchema`: host-facing read shape (no audit / internal fields).
 * - `HostTradeAdminSchema`: full admin read shape (all fields).
 * - HTTP create/update schemas: coerce query-string booleans for API compatibility.
 */
import { z } from 'zod';
import { stripShapeDefaults } from '../../utils/utils.js';
import { HostTradeSchema } from './host-trade.schema.js';

// ============================================================================
// READ SHAPES
// ============================================================================

/**
 * HostTradePublicSchema — host-facing read shape.
 *
 * Returned by `GET /api/v1/protected/host-trades` and similar host-facing
 * endpoints. Strips all audit fields (createdAt, updatedAt, createdById,
 * updatedById, deletedAt, deletedById) and the `isActive` management flag.
 * Only operational data that hosts need is exposed.
 *
 * Fields included: id, slug, name, category, contact, benefit, destinationId,
 * is24h, scheduleText.
 */
export const HostTradePublicSchema = HostTradeSchema.pick({
    id: true,
    slug: true,
    name: true,
    category: true,
    contact: true,
    benefit: true,
    destinationId: true,
    is24h: true,
    scheduleText: true
});

/**
 * Inferred TypeScript type for the host-facing HostTrade read shape.
 */
export type HostTradePublic = z.infer<typeof HostTradePublicSchema>;

/**
 * HostTradeAdminSchema — full admin read shape.
 *
 * Returned by admin endpoints. Includes all fields: operational data,
 * `isActive`, and all audit + soft-delete fields.
 */
export const HostTradeAdminSchema = HostTradeSchema;

/**
 * Inferred TypeScript type for the full admin HostTrade read shape.
 */
export type HostTradeAdmin = z.infer<typeof HostTradeAdminSchema>;

// ============================================================================
// REQUEST SCHEMAS (HTTP create / update with coercion)
// ============================================================================

/**
 * HTTP-compatible create schema for admin POST requests.
 *
 * Uses `z.coerce.boolean()` for `is24h` and `isActive` so they survive
 * serialisation as strings through multipart or form-urlencoded bodies.
 */
export const HostTradeCreateHttpSchema = z.object({
    slug: z.string().min(1).optional(),
    name: z.string().min(1),
    category: HostTradeSchema.shape.category,
    contact: z.string().min(1),
    benefit: z.string().min(1),
    destinationId: z.string().uuid(),
    is24h: z.coerce.boolean().default(false),
    scheduleText: z.string().nullish(),
    isActive: z.coerce.boolean().default(true)
});

/**
 * Inferred TypeScript type for the HostTrade HTTP create request body.
 */
export type HostTradeCreateHttp = z.infer<typeof HostTradeCreateHttpSchema>;

/**
 * HTTP-compatible update schema for admin PATCH requests.
 *
 * All fields are optional. Defaults are stripped so absent keys are
 * treated as "no change" (Zod 4 SPEC-217 fix via `stripShapeDefaults`).
 */
export const HostTradeUpdateHttpSchema = z
    .object(stripShapeDefaults(HostTradeCreateHttpSchema.shape))
    .partial();

/**
 * Inferred TypeScript type for the HostTrade HTTP update request body.
 */
export type HostTradeUpdateHttp = z.infer<typeof HostTradeUpdateHttpSchema>;

// ============================================================================
// RESPONSE WRAPPER SCHEMAS
// ============================================================================

/**
 * Admin single-item response shape (wraps HostTradeAdminSchema).
 * Mirrors the `{ hostTrade: ... }` envelope used by other CRUD endpoints.
 */
export const HostTradeAdminResponseSchema = z.object({
    hostTrade: HostTradeAdminSchema
});

/**
 * Inferred TypeScript type for the admin single-item response.
 */
export type HostTradeAdminResponse = z.infer<typeof HostTradeAdminResponseSchema>;

/**
 * Public single-item response shape (wraps HostTradePublicSchema).
 */
export const HostTradePublicResponseSchema = z.object({
    hostTrade: HostTradePublicSchema
});

/**
 * Inferred TypeScript type for the public single-item response.
 */
export type HostTradePublicResponse = z.infer<typeof HostTradePublicResponseSchema>;
