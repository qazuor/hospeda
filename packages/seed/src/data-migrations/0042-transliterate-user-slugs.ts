/**
 * @fileoverview
 * Data migration: 0042-transliterate-user-slugs
 *
 * Rewrites every `users.slug` that does not match the public-route pattern
 * `^[a-z0-9]+(?:[_-][a-z0-9]+)*$` into a transliterated, conforming
 * equivalent (diacritics stripped, lowercased, anything else collapsed to a
 * hyphen).
 *
 * ## Why this exists
 *
 * Two example fixtures (`004-user-ana-rodríguez.json`,
 * `002-user-carlos-martínez.json`) shipped with accented slugs
 * (`ana-rodríguez`, `carlos-martínez`). `UserSchema.slug` never constrained
 * the character set, so writing them was never rejected — but
 * `GET /api/v1/public/users/by-slug/:slug` (HOS-375) validates the `:slug`
 * path param against the strict pattern above and 400s before the row is
 * even looked up, so both authors' pages 404 permanently.
 *
 * ## This migration is NOT the closing gate — new bad slugs are still possible
 *
 * An earlier draft of this docstring claimed HOS-375 added the same regex to
 * `UserCreateInputSchema` / `UserUpdateInputSchema` so no NEW non-conforming
 * slug could be created. That is false, twice over:
 *
 * 1. **Those regexes were never shipped.** They were removed as a narrowing of
 *    PUBLISHED write schemas, which the package's additive-only compat policy
 *    forbids. The pattern lives in the service normalizer instead
 *    (`PUBLIC_SLUG_PATTERN` in
 *    `packages/service-core/src/services/user/user.normalizers.ts`), and it
 *    REPAIRS rather than rejects: a non-conforming value is run through
 *    `toSlug` and the repaired result is written.
 * 2. **The signup path never reaches that normalizer.** Better Auth's
 *    `user.create.before` hook (`apps/api/src/lib/auth.ts`, ~L712-717) derives
 *    the slug itself and writes the row through the Drizzle adapter, bypassing
 *    `UserService` entirely. Its derivation is close to conforming but not
 *    guaranteed: it lowercases, collapses every non-`[a-z0-9]` run to a single
 *    hyphen, trims edge hyphens, then appends `-<8 hex chars>`. A display name
 *    made entirely of characters outside `[a-z0-9]` (a CJK or Cyrillic name,
 *    say) collapses to the empty string, and the slug becomes `-a1b2c3d4` — a
 *    leading hyphen, which the route regex rejects.
 *
 * So this is a one-time BACKFILL of the rows that exist today, not a gate that
 * closes the class of bug. It is still worth running (it fixes every currently
 * broken author page, and it is a no-op once clean), but do not read it as
 * proof that the invariant now holds going forward. Closing the class properly
 * means fixing the derivation in the signup hook; that is deliberately out of
 * this migration's scope.
 *
 * The predicate is generic (any row failing the pattern, not just these two
 * emails) precisely BECAUSE no write-side gate exists: the two known fixtures
 * are the currently-known instances of a class of bug, not the whole class.
 * Any other non-conforming row — an older fixture, a hand-edited row, a signup
 * that hit the empty-basename case above, or a future data-migration that
 * forgets the pattern — gets caught the same way, and re-running this migration
 * is the documented remedy.
 *
 * ## No redirect owed
 *
 * The author page has been `noindex` until HOS-375 ships indexability, so
 * nothing is indexed under the old accented slugs. There is no legacy URL to
 * preserve or 301 from.
 *
 * ## Selection: a real regex match, not a hardcoded list
 *
 * `up()` selects every row failing
 * `slug !~ '^[a-z0-9]+(?:[_-][a-z0-9]+)*$'` via a raw Postgres `!~` (negated
 * POSIX regex match) rather than hardcoding the two known emails — the same
 * generality argument as above. Selection is not pinned to those two emails,
 * so re-running after an operator manually introduces (or a bug reintroduces)
 * a non-conforming slug fixes it too, and an environment where both fixtures
 * already resolved cleanly finds nothing to do.
 *
 * ## Transliteration, not a byte-for-byte match to the fixture rename
 *
 * `transliterateSlug()` NFD-decomposes the string, strips combining
 * diacritical marks (`í` → `i`, `ñ` → `n`, ...), lowercases, and collapses
 * any remaining non `[a-z0-9]` run to a single hyphen, trimming leading /
 * trailing hyphens. Run against `ana-rodríguez` / `carlos-martínez` this
 * produces exactly `ana-rodriguez` / `carlos-martinez` — matching the
 * baseline rename in the same PR — but the function itself does not know
 * about those two specific strings; it is the general rule the dual-write
 * baseline edit also followed by hand.
 *
 * ## Dual-write
 *
 * The baseline half is the two fixture JSON files
 * (`src/data/user/example/004-user-ana-rodríguez.json` and
 * `002-user-carlos-martínez.json`), edited in the same PR to carry the ASCII
 * slug directly. Keep both in sync: if either fixture's `slug` value changes
 * again, mirror it here or add a follow-up migration.
 *
 * ## `contentOnly` flag decision
 *
 * `false` (the default — omitted below). Unlike `0025`/`0027`/`0028`/`0035`,
 * the two rows this migration acts on genuinely exist on a fresh build,
 * produced by real fixtures under `src/data/user/example/**` — and those
 * fixtures now carry the correct ASCII slug directly (see Dual-write above).
 * A fresh `db:fresh`/`db:fresh-dev` build is therefore already correct
 * without running `up()` for real, so `--baseline-stamp` records this
 * migration applied without invoking it — exactly `0034`'s reasoning
 * (`isSystemAccount` backfill), which is the closer precedent here than
 * `0035` (whose target row has no fixture baseline at all).
 *
 * ## Idempotency
 *
 * Re-running finds zero non-conforming rows once the first run (or a
 * baseline-stamped fresh build) has corrected them, and returns a no-op
 * result without writing anything.
 *
 * ## Failure mode: the transliterated slug is taken by someone else
 *
 * `users.slug` is `UNIQUE`. If two non-conforming rows transliterate to the
 * same target, or a conforming row already holds it, this migration throws
 * with an explicit message naming both the source row and the row already
 * holding the slug, instead of skipping or letting Postgres raise an opaque
 * constraint violation. Skipping would leave that row's author page 404ing
 * forever, which is the exact bug this migration exists to fix — an operator
 * has to resolve the collision by hand (rename one of the two rows) and
 * re-run.
 *
 * ## `destructive` flag decision
 *
 * `false` — rewrites one text column per affected row, deletes nothing, and
 * is reversible by setting the slug back.
 */
import { and, eq, ne, sql, users } from '@repo/db';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

export const meta = {
    name: '0042-transliterate-user-slugs',
    group: 'required',
    destructive: false
} as const satisfies SeedMigrationModule['meta'];

/**
 * The public-route constraint enforced by `getBySlug.ts`'s `:slug` path param,
 * and mirrored (as a repair, not a rejection) by `PUBLIC_SLUG_PATTERN` in the
 * user service normalizer. NOT enforced by the write schemas — see the file
 * docstring for why, and for the signup path that bypasses the normalizer.
 */
const CONFORMING_SLUG_PATTERN = '^[a-z0-9]+(?:[_-][a-z0-9]+)*$';

/**
 * Strips diacritics, lowercases, and collapses anything outside
 * `[a-z0-9]` into a single hyphen (leading/trailing hyphens trimmed).
 *
 * `í` → `i`, `ñ` → `n`, `ü` → `u`, etc. via NFD decomposition + stripping
 * Unicode combining diacritical marks (range `U+0300`-`U+036F`).
 */
function transliterateSlug(input: string): string {
    return input
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    const nonConforming = await ctx.db
        .select({ id: users.id, slug: users.slug })
        .from(users)
        .where(sql`${users.slug} !~ ${CONFORMING_SLUG_PATTERN}`);

    if (nonConforming.length === 0) {
        return {
            summary: 'No non-conforming user slugs found; nothing to transliterate.',
            counts: { slugsRewritten: 0 }
        };
    }

    const renamed: string[] = [];

    for (const row of nonConforming) {
        const target = transliterateSlug(row.slug);

        if (target.length === 0) {
            throw new Error(
                `Cannot transliterate user ${row.id}'s slug "${row.slug}": the transliterated ` +
                    'result is empty. Resolve the slug manually, then re-run this migration.'
            );
        }

        const [collision] = await ctx.db
            .select({ id: users.id })
            .from(users)
            .where(and(eq(users.slug, target), ne(users.id, row.id)))
            .limit(1);

        if (collision) {
            throw new Error(
                `Cannot transliterate user ${row.id}'s slug "${row.slug}" to "${target}": user ` +
                    `${collision.id} already holds that slug. Resolve the collision manually, then ` +
                    're-run this migration.'
            );
        }

        await ctx.db
            .update(users)
            .set({ slug: target, updatedAt: new Date() })
            .where(eq(users.id, row.id));

        renamed.push(`${row.slug} -> ${target}`);
    }

    return {
        summary: `Transliterated ${renamed.length} non-conforming user slug(s): ${renamed.join(', ')}.`,
        counts: { slugsRewritten: renamed.length }
    };
}
