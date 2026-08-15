/**
 * @file event-edit-data.ts
 * @description The event editor's form-state shape and its PATCH-diff builder
 * (HOS-374 Phase 2 2C-3).
 *
 * ## What the PATCH can actually persist
 *
 * `EventUpdateHttpSchema` accepts exactly what `httpToDomainEventUpdate`
 * (packages/schemas) maps: `name`, `slug`, `summary` (DERIVED from
 * `description`), `description`, `category`, `date`, `locationId`,
 * `organizerId`, `isFeatured`. The schema is `.strict()`, so anything else is a
 * `400` rather than a field that reports "saved" and stores nothing.
 *
 * That was not always true. The schema used to also accept `price`, `currency`,
 * `capacity`, `isVirtual`, `isPrivate`, `requiresRegistration` and
 * `registrationUrl`, all of which were silently dropped with a `200` (H-134).
 * This editor was written to expose none of them for that reason; the reason is
 * gone, but the field list is still right — five of those seven have no domain
 * column at all, and `price`/`currency` are create-only until a partial pricing
 * merge exists (follow-up on HOS-444).
 */

import type { EventEditDetail } from '@/lib/api/types';

/**
 * Editable event fields held in the editor's React state.
 *
 * Dates are `datetime-local` strings (`YYYY-MM-DDTHH:mm`), not `Date`s — that
 * is what the input reads and writes, and converting on every keystroke would
 * make a half-typed date unrepresentable.
 *
 * Deliberately absent:
 *  - `slug` — server-derived at create time; changing it breaks the public URL.
 *  - `isFeatured` — editorial curation, not authorship.
 *  - `summary` — not an independent field: the mapper derives it from the first
 *    300 characters of `description`.
 *  - `organizerId` / `locationId` — mapped by the server, but there is no public
 *    catalog endpoint to populate a picker (`eventLocationsApi` exposes only
 *    `getBySlug`, organizers expose nothing). The hosting page shows both
 *    read-only rather than shipping a field that cannot list its options.
 *  - the publication state columns — those move through
 *    `POST /protected/events/:id/publish-state`.
 */
export interface EventEditFormData {
    readonly name: string;
    readonly description: string;
    readonly category: string;
    /** `datetime-local` value, or `''` when unset. */
    readonly startDate: string;
    /** `datetime-local` value, or `''` when the event has no end. */
    readonly endDate: string;
}

/**
 * Formats an ISO timestamp for a `datetime-local` input.
 *
 * Uses the LOCAL calendar fields rather than `toISOString().slice(0, 16)`:
 * `toISOString` converts to UTC first, so in Argentina (UTC-3) an event at
 * 21:00 would render as 00:00 the next day.
 *
 * @param value - ISO timestamp, or null/empty when unset.
 * @returns `YYYY-MM-DDTHH:mm`, or `''` when the input is absent or unparseable.
 */
export function toDateTimeLocal(value: string | null | undefined): string {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return (
        `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
        `T${pad(date.getHours())}:${pad(date.getMinutes())}`
    );
}

/**
 * Builds the editor's initial form state from the fetched event.
 *
 * @param detail - The transformed protected `getById` payload.
 * @returns Form state seeded with the persisted values.
 */
export function buildEventEditFormData({
    detail
}: {
    readonly detail: EventEditDetail;
}): EventEditFormData {
    return {
        name: detail.name,
        description: detail.description,
        category: detail.category,
        startDate: toDateTimeLocal(detail.startDate),
        endDate: toDateTimeLocal(detail.endDate)
    };
}

/**
 * Builds the PATCH body as the diff between the edited form and the last
 * persisted snapshot.
 *
 * The dates are the one asymmetry: `httpToDomainEventUpdate` only emits a
 * `date` object when `startDate` is present, and it stamps
 * `precision: EXACT` every time it does. So `startDate` travels whenever
 * EITHER bound changed — sending `endDate` alone would be silently discarded,
 * exactly the trap the accommodation editor's latitude/longitude pair hit
 * (HOS-190 slice 3).
 *
 * @param params - Current form state and the persisted baseline to diff against.
 * @returns Only the changed keys, in HTTP-payload naming.
 */
export function buildEventPatchPayload({
    current,
    baseline
}: {
    readonly current: EventEditFormData;
    readonly baseline: EventEditFormData;
}): Record<string, unknown> {
    const payload: Record<string, unknown> = {};

    if (current.name !== baseline.name) {
        payload.name = current.name;
    }
    if (current.description !== baseline.description) {
        payload.description = current.description;
    }
    if (current.category !== baseline.category) {
        payload.category = current.category;
    }

    const datesChanged =
        current.startDate !== baseline.startDate || current.endDate !== baseline.endDate;
    if (datesChanged && current.startDate) {
        payload.startDate = new Date(current.startDate).toISOString();
        if (current.endDate) {
            payload.endDate = new Date(current.endDate).toISOString();
        }
    }

    return payload;
}
