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

/**
 * Max inclusive day-span allowed for the edited event's NEW and OLD ranges.
 * Matches {@link AccommodationOccupancyBatchInputSchema}'s `dates` array
 * `.max(366)` cap on the batch-toggle endpoint.
 */
const MAX_EVENT_UPDATE_RANGE_DAYS = 366;

/**
 * Counts the days in the inclusive range `[startDate, endDate]`.
 *
 * UTC-midnight epoch-ms diffing, same approach as
 * `expandDateRangeInclusive` in `accommodation.occupancy.ts` (service layer)
 * — avoids DST-related day-count drift. Duplicated here rather than
 * imported: this schema module has no dependency on `@repo/service-core`.
 *
 * @param startDate - Inclusive lower bound, `YYYY-MM-DD`.
 * @param endDate - Inclusive upper bound, `YYYY-MM-DD`.
 * @returns The number of days spanned, inclusive of both bounds.
 */
function daysBetweenInclusive(startDate: string, endDate: string): number {
    const startMs = new Date(`${startDate}T00:00:00Z`).getTime();
    const endMs = new Date(`${endDate}T00:00:00Z`).getTime();
    return Math.round((endMs - startMs) / (24 * 60 * 60 * 1000)) + 1;
}

/**
 * Input for the edit-manual-event route (`PATCH .../occupancy/event`, HOS-175
 * Phase 3 web wiring).
 *
 * Unlike {@link AccommodationOccupancyBatchInputSchema}, `accommodationId` is
 * deliberately ABSENT here — the route derives it from the URL path only (see
 * `addOccupancy.ts` / `batchOccupancy.ts` module docs for the "never trust the
 * body" rationale), and this input shape has no other caller that would need
 * it duplicated in the body.
 *
 * Both ranges are INCLUSIVE of their end date (unlike the half-open
 * `from`/`to` of {@link AccommodationOccupancyRangeQuerySchema}, which
 * excludes the checkout day) — this mirrors a calendar UI's "drag to select
 * the first and last day of the event" interaction, not a stay's checkout
 * semantics. `oldStartDate`/`oldEndDate` identify the EXISTING manual event
 * being replaced; `newStartDate`/`newEndDate` are the edited range. Each pair
 * independently requires `start <= end` (a single-day event is valid: start
 * === end).
 *
 * BOTH the NEW range (`newStartDate..newEndDate`) AND the OLD range
 * (`oldStartDate..oldEndDate`) are additionally capped at 366 inclusive days
 * — mirroring {@link AccommodationOccupancyBatchInputSchema}'s `dates` array
 * `.max(366)` cap — so a single edit request cannot expand into an unbounded
 * number of rows in one transaction (e.g. a typo'd end-date year decades in
 * the future, or an out-of-range OLD bound sent alongside a valid NEW range).
 * These caps are enforced HERE for direct `.safeParse()` callers and OpenAPI
 * documentation, AND separately inside `updateOccupancyEvent` (in
 * `@repo/service-core`) — see that function's JSDoc for why the
 * service-level guard is not redundant with this one.
 *
 * @example
 * ```ts
 * const input: AccommodationOccupancyEventUpdateInput = {
 *   oldStartDate: '2026-07-10',
 *   oldEndDate: '2026-07-12',
 *   newStartDate: '2026-07-11',
 *   newEndDate: '2026-07-14',
 *   note: 'Moved by two days',
 * };
 * ```
 */
export const AccommodationOccupancyEventUpdateSchema = z
    .object({
        oldStartDate: OccupancyDateSchema,
        oldEndDate: OccupancyDateSchema,
        newStartDate: OccupancyDateSchema,
        newEndDate: OccupancyDateSchema,
        note: z
            .string({ message: 'zodError.accommodationOccupancy.note.required' })
            .max(500, { message: 'zodError.accommodationOccupancy.note.max' })
            .nullish()
    })
    .refine((data) => data.oldStartDate <= data.oldEndDate, {
        message: 'zodError.accommodationOccupancy.eventUpdate.oldRange.invalid',
        path: ['oldEndDate']
    })
    .refine((data) => data.newStartDate <= data.newEndDate, {
        message: 'zodError.accommodationOccupancy.eventUpdate.newRange.invalid',
        path: ['newEndDate']
    })
    .refine(
        (data) =>
            daysBetweenInclusive(data.newStartDate, data.newEndDate) <= MAX_EVENT_UPDATE_RANGE_DAYS,
        {
            message: 'zodError.accommodationOccupancy.eventUpdate.newRange.tooLong',
            path: ['newEndDate']
        }
    )
    .refine(
        (data) =>
            daysBetweenInclusive(data.oldStartDate, data.oldEndDate) <= MAX_EVENT_UPDATE_RANGE_DAYS,
        {
            message: 'zodError.accommodationOccupancy.eventUpdate.oldRange.tooLong',
            path: ['oldEndDate']
        }
    );

/**
 * TypeScript type for the edit-manual-event input, inferred from
 * {@link AccommodationOccupancyEventUpdateSchema}.
 */
export type AccommodationOccupancyEventUpdateInput = z.infer<
    typeof AccommodationOccupancyEventUpdateSchema
>;
