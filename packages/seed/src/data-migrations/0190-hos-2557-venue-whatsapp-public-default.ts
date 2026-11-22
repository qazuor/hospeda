/**
 * @fileoverview
 * Data migration: 0190-hos-2557-venue-whatsapp-public-default
 *
 * Owner decision (2026-11-22, HOS-2557): the visibility of a venue's WhatsApp
 * button is `PUBLIC` by default, and the existing listings that never made a
 * choice follow the same default. Before this change `venues.whatsapp_visibility
 * = NULL` meant "the owner has not decided" and read as HIDDEN, so many owners
 * loaded a number and never saw the button appear.
 *
 * ## What it changes
 *
 * Every venue that carries a non-blank `contact_info.whatsapp` (blank as `trim()`
 * sees it: any whitespace, not only spaces) and whose
 * `whatsapp_visibility` is `NULL` is set to `PUBLIC`. The owner took this
 * decision knowing that those numbers become visible in the page HTML.
 *
 * ## What it deliberately does NOT touch
 *
 * - Rows that already hold a choice (`LOGGED_IN_ONLY` or `PUBLIC`): the owner's
 *   explicit pick always wins, so a listing set to "only logged in" stays so.
 * - Rows with no number: with nothing to show there is nothing to default, and
 *   a later first-time entry gets `PUBLIC` from the editor.
 *
 * ## Why a data migration and not a column default
 *
 * The column stays NULLABLE with no default: `NULL` remains the honest "no
 * choice stored" state for any write path that never sets it, and a
 * `SET DEFAULT` would not backfill the existing rows anyway. This is user data,
 * not seed baseline: no seed fixture holds a venue with a WhatsApp number (checked),
 * so the dual-write rule does not apply.
 *
 * ## Idempotency
 *
 * The WHERE clause pins `whatsapp_visibility IS NULL`, so a second run matches
 * zero rows. `destructive: false`: one guarded UPDATE, nothing is deleted, and
 * reverting is setting the affected rows back to NULL.
 */
import { sql, venues } from '@repo/db';
import { VenueWhatsappVisibilityEnum } from '@repo/schemas';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

/**
 * A value that is blank for JavaScript's `String.prototype.trim()`, the check every
 * write path uses (`venue.whatsapp.ts`): the ASCII whitespace class plus the Unicode
 * spaces `trim()` also strips. SQL `btrim` strips spaces only, so a tab-only number
 * would have read as present. Sent as a bind parameter, so no SQL escaping applies.
 */
const BLANK_PATTERN =
    '^[\\s\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]*$';

export const meta = {
    name: '0190-hos-2557-venue-whatsapp-public-default',
    group: 'required',
    destructive: false,
    requiresColumns: [
        { table: 'venues', column: 'whatsapp_visibility' },
        { table: 'venues', column: 'contact_info' }
    ]
} as const satisfies SeedMigrationModule['meta'];

/**
 * Sets `whatsapp_visibility` to `PUBLIC` on every venue with a WhatsApp number and
 * no stored choice.
 *
 * @param ctx - Transaction-scoped migration context.
 * @returns How many venues were defaulted.
 */
export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    const updated = await ctx.db
        .update(venues)
        .set({ whatsappVisibility: VenueWhatsappVisibilityEnum.PUBLIC, updatedAt: new Date() })
        .where(
            sql`${venues.whatsappVisibility} IS NULL
                AND coalesce(${venues.contactInfo}->>'whatsapp', '') !~ ${BLANK_PATTERN}`
        )
        .returning({ id: venues.id });

    return {
        summary: `Defaulted whatsapp_visibility to PUBLIC on ${updated.length} venue(s) with a number and no choice`,
        counts: { defaulted: updated.length }
    };
}
