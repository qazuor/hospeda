/**
 * @fileoverview
 * Data migration: 0109-hos1418-whats-new-seen-ids-rename
 *
 * HOS-1418 (U1.3 of HOS-1352) renamed three What's New catalog entry ids in
 * `apps/api/src/data/whats-new/whats-new.ts` so the retired grouping word
 * leaves the codebase. Those three entries were already published in
 * production, and a user's "seen" state is keyed by entry id
 * (`users.settings.onboarding.whatsNew.seenIds`, read by `computeSeen`). Without
 * this migration every user who had already marked one of them seen — and
 * whose `baselineAt` predates its `publishedAt` — would see it again as
 * unseen, highlighted for two of the three.
 *
 * This migration rewrites each user's `seenIds` from the old id to the new one.
 * It lives in the exempt `data-migrations/` folder, so it may spell the old ids
 * literally.
 *
 * ## What it touches
 *
 * Only `users.settings -> onboarding -> whatsNew -> seenIds`, and only on rows
 * whose array contains at least one old id. The rewrite uses `jsonb_set` on that
 * single path, so every other key of `settings` is preserved.
 *
 * ## Idempotency
 *
 * - An old id is replaced by its new id, keeping the array order.
 * - When the user already holds the new id too, the old one is dropped instead
 *   of producing a duplicate.
 * - A second run finds no row holding an old id and writes nothing.
 *
 * ## Baseline / dual-write
 *
 * No baseline fixture seeds `seenIds` (only the `PATCH /me/whats-new-seen`
 * endpoint writes it), so there is no fixture to update: a fresh database has
 * nothing to rename.
 *
 * ## `destructive` flag decision
 *
 * `false` — rewrites array elements inside one JSONB path and deletes nothing.
 */
import { eq, sql, users } from '@repo/db';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

export const meta = {
    name: '0109-hos1418-whats-new-seen-ids-rename',
    group: 'required',
    destructive: false
} as const satisfies SeedMigrationModule['meta'];

/** Old What's New entry id → the id it was renamed to in HOS-1418. */
export const WHATS_NEW_ID_RENAMES: Readonly<Record<string, string>> = {
    '2026-09-05-commerce-publish-free-trial': '2026-09-05-gastronomy-experience-publish-free-trial',
    '2026-09-08-features-on-commerce-pages': '2026-09-08-features-on-listing-pages',
    '2026-09-08-commerce-editor-by-sections': '2026-09-08-listing-editor-by-sections'
};

/** JSONB path of the seen-ids array inside `users.settings`. */
const SEEN_IDS_PATH = '{onboarding,whatsNew,seenIds}';

/**
 * Maps old ids to new ones, preserving order and dropping duplicates.
 *
 * @param input - `{ seenIds }`, the user's current array.
 * @returns `{ seenIds, changed }` — the rewritten array and whether it differs.
 */
export function renameSeenIds({ seenIds }: { readonly seenIds: readonly string[] }): {
    readonly seenIds: readonly string[];
    readonly changed: boolean;
} {
    const result: string[] = [];
    for (const id of seenIds) {
        const next = WHATS_NEW_ID_RENAMES[id] ?? id;
        if (!result.includes(next)) {
            result.push(next);
        }
    }
    const changed =
        result.length !== seenIds.length || result.some((id, index) => id !== seenIds[index]);
    return { seenIds: result, changed };
}

export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    const holdsAnOldId = sql.join(
        Object.keys(WHATS_NEW_ID_RENAMES).map(
            (oldId) => sql`(${users.settings} #> ${SEEN_IDS_PATH}::text[]) ? ${oldId}`
        ),
        sql` OR `
    );

    const rows = await ctx.db
        .select({
            id: users.id,
            seenIds: sql<unknown>`${users.settings} #> ${SEEN_IDS_PATH}::text[]`
        })
        .from(users)
        .where(sql`(${holdsAnOldId})`);

    let usersRewritten = 0;

    for (const row of rows) {
        const current = row.seenIds;
        if (!Array.isArray(current) || current.some((id) => typeof id !== 'string')) {
            throw new Error(
                `User ${row.id} matched an old What's New id but its seenIds is not an array of ` +
                    'strings; inspect users.settings by hand, then re-run this migration.'
            );
        }
        const { seenIds, changed } = renameSeenIds({ seenIds: current });
        if (!changed) {
            continue;
        }

        await ctx.db
            .update(users)
            .set({
                settings: sql`jsonb_set(${users.settings}, ${SEEN_IDS_PATH}::text[], ${JSON.stringify(seenIds)}::jsonb)`
            })
            .where(eq(users.id, row.id));

        usersRewritten += 1;
    }

    return {
        summary:
            usersRewritten === 0
                ? "No user holds a renamed What's New id; nothing to rewrite."
                : `Rewrote renamed What's New ids in seenIds for ${usersRewritten} user(s).`,
        counts: { usersRewritten }
    };
}
