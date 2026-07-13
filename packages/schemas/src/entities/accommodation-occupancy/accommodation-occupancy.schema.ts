import { z } from 'zod';
import {
    AccommodationIdSchema,
    AccommodationOccupancyIdSchema,
    UserIdSchema
} from '../../common/id.schema.js';
import { OccupancySourceEnumSchema } from '../../enums/occupancy-source.schema.js';
import { OccupancyDateSchema } from './accommodation-occupancy-date.schema.js';

/**
 * Core AccommodationOccupancy entity schema — one row per occupied day for an
 * accommodation (HOS-43 Phase 1).
 *
 * Maps 1-to-1 to the `accommodation_occupancy` table columns. Deliberately
 * lean, mirroring the `PriceAlertSchema` precedent (SPEC-286):
 *
 * - `date` is a plain `YYYY-MM-DD` string, NOT `z.coerce.date()`. The DB
 *   column is Postgres native `date` (the first one in this codebase — HOS-43
 *   R8), and Drizzle's `date()` column type returns a string, not a `Date`.
 *   Keeping the schema a string avoids a timezone round-trip through `Date`
 *   for a value that is intentionally hour-less.
 * - No `deletedAt`/`deletedById` — occupancy rows are hard-deleted (a
 *   `MANUAL` row is removed outright when the host un-toggles a day; sync
 *   sources remove their own rows on next reconciliation). There is no
 *   soft-delete lifecycle for this entity.
 * - `createdById` is NOT nullable (unlike `BaseAuditFields`): every row is
 *   attributed to an actor — the host for `MANUAL` rows, or a system actor id
 *   for sync-created rows (Phase 2/3).
 */
export const AccommodationOccupancySchema = z.object({
    id: AccommodationOccupancyIdSchema,

    accommodationId: AccommodationIdSchema,

    /**
     * The occupied day, `YYYY-MM-DD`. One row per day per accommodation
     * (enforced by the `(accommodation_id, date)` unique index).
     */
    date: OccupancyDateSchema,

    /**
     * Whether this day is blocked (occupied). Always `true` in Phase 1;
     * reserved for a future free/blocked semantic distinction.
     */
    isBlocked: z.boolean({ message: 'zodError.accommodationOccupancy.isBlocked.required' }),

    /** Origin of this row — manual host toggle, or an external sync source. */
    source: OccupancySourceEnumSchema,

    /**
     * The id of the event/booking in the external source (Google Calendar
     * event id, iCal `UID`, ...). `null` for `MANUAL` rows. Used by Phase 2/3
     * sync jobs to reconcile without touching `MANUAL` rows.
     */
    externalEventId: z
        .string({ message: 'zodError.accommodationOccupancy.externalEventId.required' })
        .max(255, { message: 'zodError.accommodationOccupancy.externalEventId.max' })
        .nullable(),

    /** Optional internal note the host can attach to a blocked day. */
    note: z
        .string({ message: 'zodError.accommodationOccupancy.note.required' })
        .max(500, { message: 'zodError.accommodationOccupancy.note.max' })
        .nullable(),

    /** The actor (host or system) that created this row. */
    createdById: UserIdSchema,

    createdAt: z.coerce.date({ message: 'zodError.accommodationOccupancy.createdAt.required' }),
    updatedAt: z.coerce.date({ message: 'zodError.accommodationOccupancy.updatedAt.required' })
});

/**
 * TypeScript type for a stored accommodation occupancy row, inferred from
 * {@link AccommodationOccupancySchema}.
 */
export type AccommodationOccupancy = z.infer<typeof AccommodationOccupancySchema>;
