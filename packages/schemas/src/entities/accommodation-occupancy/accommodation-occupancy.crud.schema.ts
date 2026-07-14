import { z } from 'zod';
import { AccommodationIdSchema } from '../../common/id.schema.js';
import { OccupancyDateSchema } from './accommodation-occupancy-date.schema.js';

/**
 * AccommodationOccupancy CRUD input schemas (HOS-43 Phase 1).
 *
 * `accommodationId` is intentionally included on every input schema (not
 * injected from the route param alone) so a service layer receiving a
 * pre-validated input object always has it available for ownership checks,
 * mirroring the route contract in the spec
 * (`.specs/HOS-43-occupancy-calendar/spec.md` section 6).
 *
 * `date` / `dates[]` use the shared {@link OccupancyDateSchema} (shape +
 * calendar-validity round-trip check) — see that module for why.
 */

/**
 * Input for creating a single-day `MANUAL` occupancy row.
 *
 * `source` is deliberately absent — the create route always writes
 * `source=MANUAL`; sync sources (Phase 2/3) write through their own service
 * methods, not this input.
 *
 * @example
 * ```ts
 * const input: AccommodationOccupancyCreateInput = {
 *   accommodationId: '550e8400-e29b-41d4-a716-446655440000',
 *   date: '2026-07-10',
 *   note: 'Reserved off-platform',
 * };
 * ```
 */
export const AccommodationOccupancyCreateInputSchema = z.object({
    accommodationId: AccommodationIdSchema,
    date: OccupancyDateSchema,
    note: z
        .string({ message: 'zodError.accommodationOccupancy.note.required' })
        .max(500, { message: 'zodError.accommodationOccupancy.note.max' })
        .nullish()
});

/**
 * TypeScript type for the single-day create input, inferred from
 * {@link AccommodationOccupancyCreateInputSchema}.
 */
export type AccommodationOccupancyCreateInput = z.infer<
    typeof AccommodationOccupancyCreateInputSchema
>;

/**
 * Input for the batch toggle route (`PATCH .../occupancy/batch`).
 *
 * Chosen shape: an explicit list of `dates` plus a single `isBlocked` flag
 * applied to all of them, rather than a `from`/`to` range. This keeps the
 * contract simple for a UI that lets the host multi-select individual days
 * (which need not be contiguous) and mirrors the idempotency requirement in
 * the spec (US-1: re-toggling the same date must not duplicate rows).
 *
 * - `isBlocked: true` → upsert one `source=MANUAL` row per date
 *   (idempotent on the `(accommodation_id, date)` unique index).
 * - `isBlocked: false` → delete the `MANUAL` row for each date, if any
 *   (sync-sourced rows for the same date are left untouched — see
 *   `AccommodationOccupancyModel.deleteManualByDates`).
 *
 * @example
 * ```ts
 * const input: AccommodationOccupancyBatchInput = {
 *   accommodationId: '550e8400-e29b-41d4-a716-446655440000',
 *   dates: ['2026-07-10', '2026-07-11', '2026-07-12'],
 *   isBlocked: true,
 * };
 * ```
 */
export const AccommodationOccupancyBatchInputSchema = z.object({
    accommodationId: AccommodationIdSchema,
    dates: z
        .array(OccupancyDateSchema, {
            message: 'zodError.accommodationOccupancy.dates.required'
        })
        .min(1, { message: 'zodError.accommodationOccupancy.dates.min' })
        .max(366, { message: 'zodError.accommodationOccupancy.dates.max' }),
    isBlocked: z.boolean({ message: 'zodError.accommodationOccupancy.isBlocked.required' }),
    note: z
        .string({ message: 'zodError.accommodationOccupancy.note.required' })
        .max(500, { message: 'zodError.accommodationOccupancy.note.max' })
        .nullish()
});

/**
 * TypeScript type for the batch toggle input, inferred from
 * {@link AccommodationOccupancyBatchInputSchema}.
 */
export type AccommodationOccupancyBatchInput = z.infer<
    typeof AccommodationOccupancyBatchInputSchema
>;
