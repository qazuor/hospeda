/**
 * @fileoverview
 * Data migration: 0097-hos-1027-normalize-stored-whatsapp-numbers
 *
 * Dual-write counterpart (HOS-25) for HOS-1027: `normalizeContactInfo`
 * (`packages/service-core/src/utils/normalizer.ts`) normalizes `mobilePhone`,
 * `homePhone`, `workPhone` and, since PR #3197 (`eee5b1adc`), `whatsapp` too,
 * via `normalizePhoneNumber`. Before that fix `whatsapp` was the one field in
 * `contact_info` written verbatim, so a row saved through the old code path
 * can carry a non-canonical value (stray/extra spaces, an extra digit) that a
 * fresh write will never produce again — but an existing row does not
 * self-heal, since `normalizeContactInfo` only runs on write.
 *
 * ## Measured scope (production, 2026-09-04, `deleted_at IS NULL`)
 *
 * | Table              | Rows with `whatsapp` | Divergent |
 * |--------------------|-----------------------|-----------|
 * | `accommodations`   | 7                     | 7         |
 * | `event_organizers` | 0                     | 0         |
 * | `post_sponsors`    | 0                     | 0         |
 * | `users`            | 0                     | 0         |
 *
 * All 7 divergent rows live in `accommodations`: five `+NN NNNNNNNNNN`, one
 * `+NN NNNNNNNNNNN`, one `+NN NNNN NNNNNN` (digits masked as `N`). Two of the
 * 7 duplicate the same accommodation's own `mobilePhone`, written with
 * different formatting — the concrete damage this migration closes. The
 * other three tables hold zero `whatsapp` values today, but are still
 * covered here: this migration also runs against staging and local, where
 * the counts can differ, and the added cost is a few more idempotent
 * statements, not a new query shape.
 *
 * ## The transformation
 *
 * Delegates to the REAL `normalizePhoneNumber` — the exact function
 * `normalizeContactInfo` now calls on every write — rather than re-deriving
 * its regex in migration-local code or in SQL. A future change to that
 * function's rules is a change this migration follows automatically, and a
 * test asserting against the same import (not a hand-copied regex) is the
 * one that would catch a mutation to it.
 *
 * ## JSONB merge safety — the risk this migration was flagged to check
 *
 * `contact_info` is a JSONB column holding several sibling keys
 * (`mobilePhone`, `homePhone`, `workPhone`, `whatsapp`, emails, `website`,
 * `preferredEmail`, ...). Two of the four target models
 * (`AccommodationModel`, `UserModel`) declare `contactInfo` in their
 * `mergeableJsonbColumns`, so a model-level `.update({ contactInfo: {...} })`
 * on those two tables shallow-merges. `EventOrganizerModel` and
 * `PostSponsorModel` do NOT declare it, so the identical call on those two
 * tables would replace `contact_info` wholesale and silently drop every
 * other stored contact field — the same hazard `0020-backfill-
 * accommodation-seo-titles` and `0057-staff-email-domain-to-com-ar` were
 * written to avoid for `seo` and `contact_info` respectively.
 *
 * This migration sidesteps the model layer (and its per-table merge
 * inconsistency) entirely: it reads the FULL `contact_info` blob per
 * candidate row, builds a new object via `{ ...contactInfo, whatsapp:
 * normalized }` (same technique `0020` uses for `seo`), and writes that whole
 * object back with a plain `UPDATE ... SET contact_info = $1::jsonb`. Every
 * sibling key is carried through by the spread, so the result is correct on
 * all four tables regardless of what each model's `mergeableJsonbColumns`
 * declares — there is no per-table model behavior to reason about at all.
 *
 * ## Narrowness / idempotency
 *
 * The candidate SELECT is scoped to `deleted_at IS NULL AND contact_info IS
 * NOT NULL AND contact_info ? 'whatsapp'` per table. Of those candidates,
 * {@link normalizeStoredWhatsapp} (pure, unit-tested) decides per row:
 * - a `whatsapp` that is not a string (JSON `null`, or absent — the ` ?
 *   'whatsapp'` filter mostly excludes "absent" already, but a stored JSON
 *   `null` still passes it) is left alone;
 * - a `whatsapp` already equal to its own `normalizePhoneNumber(...)` output
 *   is left alone — this is what makes a second run of this migration a
 *   no-op;
 * - only then is an `UPDATE` issued, and only for that one row.
 *
 * Only the `whatsapp` key inside `contact_info` is ever changed; nothing
 * else in the JSONB object, and no other column besides `updated_at`, is
 * touched.
 *
 * ## `requiresColumns`
 *
 * No schema migration is currently dropping `contact_info` on any of these
 * four tables, so the specific HOS-433 race (a structural migration removing
 * the source column before this data-migration reads it) cannot happen
 * today. Declared anyway, following `0095-hos-1152`'s precedent: on a
 * database where `contact_info` no longer exists, the runner refuses to
 * start instead of reading nothing, reporting zero rows normalized, and
 * closing itself in the ledger forever. Cheap insurance for a flag that
 * costs nothing while the column is present, which is every environment
 * today.
 *
 * ## `destructive` flag decision
 *
 * `false` — a targeted, idempotent string rewrite of a single JSONB key.
 * Nothing is deleted, and the prior value is trivially recoverable (it is
 * exactly the same digits/`+`, just with formatting characters removed).
 */
import { sql } from '@repo/db';
import { normalizePhoneNumber } from '@repo/service-core';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

export const meta = {
    name: '0097-hos-1027-normalize-stored-whatsapp-numbers',
    group: 'required',
    destructive: false,
    // HOS-433: this migration reads `contact_info` and rewrites it in place
    // on all four tables. Declared so that, on a database where the column no
    // longer exists, the runner refuses to start rather than report zero rows
    // normalized and close itself in the ledger forever (see 0095's identical
    // reasoning).
    requiresColumns: [
        { table: 'accommodations', column: 'contact_info' },
        { table: 'event_organizers', column: 'contact_info' },
        { table: 'post_sponsors', column: 'contact_info' },
        { table: 'users', column: 'contact_info' }
    ]
} as const satisfies SeedMigrationModule['meta'];

/**
 * The four physical tables carrying a `contact_info.whatsapp` value, in the
 * same order as the "Measured scope" table above. Physical (snake_case)
 * table names — this runs raw SQL, never the Drizzle query builder — so it
 * works identically across all four independently-shaped tables without
 * fighting per-table generic typing (see the file-level "JSONB merge safety"
 * note).
 */
const TARGET_TABLES = ['accommodations', 'event_organizers', 'post_sponsors', 'users'] as const;

/** One of {@link TARGET_TABLES}. */
export type TargetTable = (typeof TARGET_TABLES)[number];

/** Type guard for a plain JSON object (excludes arrays and `null`). */
function isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Outcome of normalizing one row's `contact_info` blob. */
export interface NormalizeWhatsappResult {
    /** The blob to persist. Reference-identical to the input when unchanged. */
    readonly next: unknown;
    /** Whether `whatsapp` was rewritten. `false` means the caller must skip the write. */
    readonly changed: boolean;
}

/**
 * Decides whether one `contact_info` blob's `whatsapp` value needs
 * normalizing, and returns the blob to persist.
 *
 * Pure and total: a blob that is absent/malformed, carries no `whatsapp`
 * string, or is already canonical comes back unchanged (`changed: false`,
 * `next` reference-identical to the input) — the caller reads that as "skip
 * this row". Every sibling key is preserved via the object spread; only
 * `whatsapp` itself is ever replaced.
 *
 * Exported so the regression test can exercise the decision directly,
 * against the real `normalizePhoneNumber`, rather than only the DB
 * orchestration around it.
 *
 * @param contactInfo - The raw `contact_info` jsonb value.
 * @returns See {@link NormalizeWhatsappResult}.
 *
 * @example
 * ```ts
 * normalizeStoredWhatsapp({ whatsapp: '+54 9 344 4123456' });
 * // → { next: { whatsapp: '+5493444123456' }, changed: true }
 * ```
 */
export function normalizeStoredWhatsapp(contactInfo: unknown): NormalizeWhatsappResult {
    if (!isPlainObject(contactInfo)) return { next: contactInfo, changed: false };

    const whatsapp = contactInfo.whatsapp;
    if (typeof whatsapp !== 'string') return { next: contactInfo, changed: false };

    const normalized = normalizePhoneNumber(whatsapp);
    if (normalized === whatsapp) return { next: contactInfo, changed: false };

    return { next: { ...contactInfo, whatsapp: normalized }, changed: true };
}

/** A row read for inspection: its id plus its raw `contact_info` blob. */
interface ContactInfoRow {
    readonly id: string;
    readonly contact_info: unknown;
}

/**
 * Normalizes one table's stored `whatsapp` values in place.
 *
 * Reads every non-deleted row carrying a `whatsapp` key, and issues one
 * targeted `UPDATE ... WHERE id = ...` per row that actually changed. Rows
 * already canonical are never written.
 *
 * `sql.raw` for the table name is safe here: `tableName` always comes from
 * {@link TARGET_TABLES}, a fixed literal array in this file's own source —
 * never caller- or row-supplied text — the same justification
 * `columnDependencyGuard.ts`'s `countRows` uses for the identical idiom.
 *
 * @param db - Transaction-scoped Drizzle client.
 * @param tableName - Which of {@link TARGET_TABLES} to walk.
 * @returns How many rows were rewritten.
 */
async function normalizeTable(db: SeedMigrationCtx['db'], tableName: TargetTable): Promise<number> {
    const table = sql.raw(`"${tableName}"`);

    const result = await db.execute(
        sql`SELECT id, contact_info FROM ${table}
            WHERE deleted_at IS NULL
              AND contact_info IS NOT NULL
              AND contact_info ? 'whatsapp'`
    );

    let updated = 0;

    for (const row of (result.rows ?? []) as readonly unknown[] as readonly ContactInfoRow[]) {
        const { next, changed } = normalizeStoredWhatsapp(row.contact_info);
        if (!changed) continue;

        await db.execute(
            sql`UPDATE ${table}
                SET contact_info = ${JSON.stringify(next)}::jsonb,
                    updated_at = now()
                WHERE id = ${row.id}`
        );
        updated += 1;
    }

    return updated;
}

export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    const counts: Record<string, number> = {};
    let totalUpdated = 0;

    for (const tableName of TARGET_TABLES) {
        const updated = await normalizeTable(ctx.db, tableName);
        counts[tableName] = updated;
        totalUpdated += updated;
    }

    const perTable = Object.entries(counts)
        .filter(([, n]) => n > 0)
        .map(([table, n]) => `${table}=${n}`)
        .join(', ');

    return {
        summary:
            totalUpdated === 0
                ? 'No stored whatsapp value was non-canonical — nothing to normalize.'
                : `Normalized ${totalUpdated} stored whatsapp value(s): ${perTable}.`,
        counts
    };
}
