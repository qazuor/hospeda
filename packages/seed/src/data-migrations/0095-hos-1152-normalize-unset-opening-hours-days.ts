/**
 * @fileoverview
 * Data migration: 0095-hos-1152-normalize-unset-opening-hours-days
 *
 * Marks as CLOSED every gastronomy/experience opening-hours day that is
 * currently neither open nor closed — `{ closed: false, shifts: [] }` — so the
 * stored data satisfies the refine HOS-906 added to `DayScheduleSchema`.
 *
 * ## Why this migration exists
 *
 * HOS-906 (PR #3117) closed a real hole: a day could be saved without the host
 * ever deciding whether the venue opens on it. The refine it added rejects the
 * intermediate shape:
 *
 * ```ts
 * if (!schedule.closed && schedule.shifts.length === 0) { ctx.addIssue(...) }
 * ```
 *
 * What shipped with it was the write-side rule and nothing else. The rows that
 * already carried that shape — and HOS-906's own description says they are real,
 * because `dayOf()` used to default an untouched day to `{closed:false,
 * shifts:[]}` and `withDay()` rebuilt all seven days on every save — were never
 * migrated.
 *
 * The same schema strips the RESPONSE. `createPaginatedResponse` runs
 * `stripWithSchema` over every item, so ONE listing carrying one such day makes
 * the whole endpoint answer 500, rather than degrading or dropping that item.
 * Measured on staging 2026-09-04 19:51: `GET /api/v1/public/gastronomies` → 500,
 * six issues, all `openingHours.days.<day>.closed`. Both public listings
 * (`/es/gastronomia/`, `/es/experiencias/`) went dark; accommodations, which
 * carry no `opening_hours`, were untouched. That is HOS-1152.
 *
 * ## Why writing `closed: true` is the honest value, not a guess
 *
 * `computeOpenNowStatus` (`apps/web/src/lib/gastronomy-hours.ts`) has always
 * resolved a day with no shifts to closed, by a fixed documented rule:
 * `if (!entry.isOpen || entry.shifts.length === 0) return false`. The public
 * page has therefore been RENDERING these days as closed all along. This
 * migration writes down what the read side already decided; it does not invent
 * a schedule, and it changes nothing a visitor sees.
 *
 * That is also why `destructive` is `false`. The shape being replaced is the
 * ABSENCE of a decision — a Zod default nobody chose — not a host's answer. No
 * host preference is discarded, so this does not need the production
 * destructive gate standing between a dark listing and its fix.
 *
 * ## What it deliberately does NOT touch
 *
 * Only the exact pair `closed` falsy AND `shifts` empty. A day carrying even one
 * shift is a real schedule and is left alone whatever its `closed` flag says
 * (that combination is a different question, and not one an outage should
 * settle). A day already `closed: true` is already valid. A listing with no
 * `opening_hours`, or whose `days` object is absent or malformed, is skipped —
 * `openingHours` is `nullish()`, so absent is a legal state, and this migration
 * is not the place to invent one.
 *
 * ## Idempotency
 *
 * The rewrite is driven by the same predicate that selects it, so after the
 * first run no day matches and a second run updates zero rows. A row is written
 * only when at least one of its days actually changed.
 *
 * ## Why the read is raw SQL
 *
 * `opening_hours` is a `jsonb` column typed `Record<string, unknown>` in
 * Drizzle — the schema layer, not the DB layer, is what knows its shape. Reading
 * `(id, opening_hours)` directly keeps this file compiling regardless of how the
 * typed column is later described, the same reasoning `0034` documents.
 *
 * @see HOS-1152, HOS-906
 */
import { sql } from '@repo/db';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

export const meta = {
    name: '0095-hos-1152-normalize-unset-opening-hours-days',
    group: 'required',
    // Replaces a Zod default nobody chose with the value the read side already
    // resolved it to. No host decision is discarded — see the file header.
    destructive: false,
    // HOS-433: this migration reads `opening_hours` and rewrites it in place.
    // Declared so that, on a database where the column no longer exists, the
    // runner refuses to start rather than report zero rows moved and close
    // itself in the ledger forever.
    requiresColumns: [
        { table: 'gastronomies', column: 'opening_hours' },
        { table: 'experiences', column: 'opening_hours' }
    ]
} as const satisfies SeedMigrationModule['meta'];

/** The two listing tables carrying an `opening_hours` jsonb column. */
const LISTING_TABLES = ['gastronomies', 'experiences'] as const;

/** One of {@link LISTING_TABLES}. */
export type ListingTable = (typeof LISTING_TABLES)[number];

/** Outcome of normalizing one listing's `opening_hours` blob. */
export interface NormalizeResult {
    /** The blob to persist. Reference-identical to the input when unchanged. */
    readonly next: unknown;
    /** How many day entries were flipped to `closed: true`. Zero means skip. */
    readonly changedDays: number;
}

/**
 * Type guard for a plain JSON object (excludes arrays and `null`).
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Decides whether one day entry is the "neither open nor closed" shape.
 *
 * Mirrors `DayScheduleSchema`'s refine exactly: `closed` falsy AND no shifts.
 * `shifts` absent counts as no shifts — the refine reads `.length === 0` on a
 * value Zod has already defaulted, and a blob missing the key describes the same
 * undecided day.
 *
 * @param day - A candidate day entry, of unknown shape.
 * @returns `true` when the entry must be flipped to closed.
 */
function isUndecidedDay(day: unknown): day is Record<string, unknown> {
    if (!isPlainObject(day)) return false;
    if (day.closed === true) return false;
    const shifts = day.shifts;
    if (shifts === undefined || shifts === null) return true;
    return Array.isArray(shifts) && shifts.length === 0;
}

/**
 * Rewrites every undecided day of one `opening_hours` blob as explicitly closed.
 *
 * Pure and total: any blob that is absent, malformed, or already valid comes
 * back unchanged with `changedDays: 0`, which the caller reads as "skip this
 * row". The `days` container's other keys (`timezone`, `notes`, ...) and every
 * untouched day are carried through by reference.
 *
 * Exported so the regression test can exercise the decision itself against the
 * real schema, rather than only the DB orchestration around it.
 *
 * @param openingHours - The raw `opening_hours` jsonb value.
 * @returns The blob to persist plus the number of days flipped.
 *
 * @example
 * ```ts
 * normalizeOpeningHoursDays({ days: { mon: { closed: false, shifts: [] } } });
 * // → { next: { days: { mon: { closed: true, shifts: [] } } }, changedDays: 1 }
 * ```
 */
export function normalizeOpeningHoursDays(openingHours: unknown): NormalizeResult {
    if (!isPlainObject(openingHours)) return { next: openingHours, changedDays: 0 };

    const days = openingHours.days;
    if (!isPlainObject(days)) return { next: openingHours, changedDays: 0 };

    const nextDays: Record<string, unknown> = {};
    let changedDays = 0;

    for (const [key, day] of Object.entries(days)) {
        if (isUndecidedDay(day)) {
            // `shifts: []` is written explicitly rather than spread through:
            // a blob that omitted the key entirely must come out valid, and
            // `closed: true` with a missing `shifts` is not.
            nextDays[key] = { ...day, closed: true, shifts: [] };
            changedDays += 1;
            continue;
        }
        nextDays[key] = day;
    }

    if (changedDays === 0) return { next: openingHours, changedDays: 0 };

    return { next: { ...openingHours, days: nextDays }, changedDays };
}

/** A listing row whose blob was read for inspection. */
interface ListingRow {
    readonly id: string;
    readonly opening_hours: unknown;
}

/**
 * Normalizes one listing table in place.
 *
 * Reads every row carrying a non-null `opening_hours`, and issues one targeted
 * UPDATE per row that actually changed. Rows already valid are never written.
 *
 * @param db - Transaction-scoped Drizzle client.
 * @param table - Which listing table to walk.
 * @returns Rows rewritten and day entries flipped, for the run summary.
 */
async function normalizeTable(
    db: SeedMigrationCtx['db'],
    table: ListingTable
): Promise<{ rows: number; days: number }> {
    // `sql.raw` is safe here: `table` is a closed union of two literals, never
    // caller-supplied text.
    const result = await db.execute(
        sql`SELECT id, opening_hours FROM ${sql.raw(table)} WHERE opening_hours IS NOT NULL`
    );

    let rows = 0;
    let days = 0;

    for (const row of (result.rows ?? []) as readonly unknown[] as readonly ListingRow[]) {
        const { next, changedDays } = normalizeOpeningHoursDays(row.opening_hours);
        if (changedDays === 0) continue;

        await db.execute(
            sql`UPDATE ${sql.raw(table)} SET opening_hours = ${JSON.stringify(next)}::jsonb WHERE id = ${row.id}`
        );
        rows += 1;
        days += changedDays;
    }

    return { rows, days };
}

export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    const { db } = ctx;

    const gastronomy = await normalizeTable(db, 'gastronomies');
    const experience = await normalizeTable(db, 'experiences');

    const totalRows = gastronomy.rows + experience.rows;
    const totalDays = gastronomy.days + experience.days;

    return {
        summary:
            totalRows === 0
                ? 'No opening-hours day was left undecided — nothing to normalize'
                : `Marked ${totalDays} undecided opening-hours day(s) as closed across ${totalRows} listing(s)`,
        counts: {
            gastronomiesUpdated: gastronomy.rows,
            gastronomyDaysClosed: gastronomy.days,
            experiencesUpdated: experience.rows,
            experienceDaysClosed: experience.days
        }
    };
}
