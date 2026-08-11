/**
 * @fileoverview
 * Data migration: 0041-editorial-author-slug
 *
 * Gives the shared editorial author ("Equipo Hospeda") the stable, curated
 * slug `equipo-hospeda` in environments seeded before HOS-375.
 *
 * ## Why this exists
 *
 * `0025-seed-real-blog-posts` creates the editorial account without setting a
 * slug, so `users.slug.$defaultFn` generates one from a fresh random id:
 * `user-95c2cd4b` in production, `user-76eb2960` locally. HOS-375 turns that
 * slug into a public, indexable URL (`/es/autores/<slug>/`) for the site's main
 * editorial voice — 22 posts and 44 events. Indexing a per-environment random
 * string as that URL is not acceptable, and it cannot be fixed for free once
 * Google has it. See HOS-375 §6.10.2 (G-9).
 *
 * No redirect is owed from the old auto-slug: the author page is `noindex`
 * today, so there is nothing indexed to preserve.
 *
 * ## Resolved by email, never by slug or id
 *
 * This is the single most important constraint in the migration. The current
 * slug and the row id both differ per environment, so a hardcoded value
 * silently targets the wrong row — or no row — outside the machine it was
 * written on. `email` is the account's stable identity and is `UNIQUE`, exactly
 * as `0025`'s own `ensureEditorialAuthor` resolves it (`findOne({ email })`).
 *
 * The email is re-declared here rather than imported from `0025`: data
 * migrations are frozen historical artifacts and do not import from one
 * another (`0030-clear-placeholder-blog-media` re-declares it the same way).
 * Sharing a mutable constant would let a future edit retroactively change what
 * an already-applied migration targeted.
 *
 * ## Dual-write
 *
 * The baseline half is `0025`'s `ensureEditorialAuthor`, which now sets
 * `slug: EDITORIAL_SLUG` at creation, so an environment that has never run this
 * migration still gets the curated slug — keep both sides in sync.
 *
 * ## `contentOnly` flag decision
 *
 * `true`. The row this migration edits has NO fixture baseline: it exists only
 * because `0025` created it, and `0025` is itself `contentOnly`. On a fresh
 * build `--baseline-stamp` therefore leaves both pending and runs them for
 * real, in order. The flag keeps the ledger honest — it is not what produces
 * the end state on a fresh build, since `0025` already writes the right slug
 * there.
 *
 * ## Idempotency
 *
 * Re-running is a no-op: the account already carries the target slug and the
 * migration returns without writing.
 *
 * ## Failure mode: the slug is taken by someone else
 *
 * `users.slug` is `UNIQUE`. If a different account already holds
 * `equipo-hospeda`, the migration throws with an explicit message instead of
 * letting Postgres raise an opaque constraint violation, and instead of
 * skipping: skipping would leave the editorial page on its random auto-slug and
 * publish THAT to Google, which is the exact harm this migration exists to
 * prevent. An operator has to resolve the collision.
 *
 * ## `destructive` flag decision
 *
 * `false` — rewrites one text column on a single identified row, deletes
 * nothing, and is reversible by setting the slug back.
 */
import { and, eq, ne, users } from '@repo/db';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

export const meta = {
    name: '0041-editorial-author-slug',
    group: 'required',
    destructive: false,
    contentOnly: true
} as const satisfies SeedMigrationModule['meta'];

/** Unique identity of the editorial author created by `0025`. */
const EDITORIAL_EMAIL = 'editorial@hospeda.com.ar';

/**
 * The curated public slug for the editorial account. Mirrors `EDITORIAL_SLUG`
 * in `0025-seed-real-blog-posts.ts` (dual-write rule) — keep both in sync.
 */
const EDITORIAL_SLUG = 'equipo-hospeda';

export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    const [editorial] = await ctx.db
        .select({ id: users.id, slug: users.slug })
        .from(users)
        .where(eq(users.email, EDITORIAL_EMAIL))
        .limit(1);

    if (!editorial) {
        return {
            summary: `Editorial author "${EDITORIAL_EMAIL}" is absent from this environment; nothing to rename.`,
            counts: { accountsRenamed: 0 }
        };
    }

    if (editorial.slug === EDITORIAL_SLUG) {
        return {
            summary: `Editorial author already carries the slug "${EDITORIAL_SLUG}".`,
            counts: { accountsRenamed: 0 }
        };
    }

    const [collision] = await ctx.db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.slug, EDITORIAL_SLUG), ne(users.id, editorial.id)))
        .limit(1);

    if (collision) {
        throw new Error(
            `Cannot rename the editorial author to "${EDITORIAL_SLUG}": user ${collision.id} already holds that slug. ` +
                'Resolve the collision manually, then re-run this migration.'
        );
    }

    const previousSlug = editorial.slug;

    await ctx.db
        .update(users)
        .set({ slug: EDITORIAL_SLUG, updatedAt: new Date() })
        .where(eq(users.id, editorial.id));

    return {
        summary: `Renamed the editorial author slug "${previousSlug}" -> "${EDITORIAL_SLUG}".`,
        counts: { accountsRenamed: 1 }
    };
}
