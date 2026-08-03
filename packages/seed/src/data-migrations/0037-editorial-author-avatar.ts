/**
 * @fileoverview
 * Data migration: 0037-editorial-author-avatar
 *
 * Gives the shared editorial author ("Equipo Hospeda") the Hospeda isotype as
 * its avatar, in environments seeded before HOS-375 set one.
 *
 * ## Why this exists
 *
 * A non-empty avatar is one of the five conditions of HOS-375 §6.5. `0025`
 * created this account with a bio but no avatar, so the site's main editorial
 * voice — 22 posts and 52 events, by far the richest author page there is —
 * was the ONLY author excluded from the index, while accounts with a single
 * post qualified. The condition is not the problem and is unchanged; the
 * account was simply missing the data.
 *
 * ## Resolved by email, never by slug or id
 *
 * The row id differs per environment and the slug only became stable in
 * `0035`. `email` is the account's stable identity and is `UNIQUE`, exactly as
 * `0025`'s own `ensureEditorialAuthor` and `0035` resolve it.
 *
 * The email is re-declared here rather than imported: data migrations are
 * frozen historical artifacts and do not import from one another (`0030` and
 * `0035` re-declare it the same way). Sharing a mutable constant would let a
 * future edit retroactively change what an already-applied migration targeted.
 *
 * ## Never clobbers an operator's own avatar
 *
 * Unlike `0035`, which overwrote a slug because the value it replaced was a
 * machine-generated `user-<8 hex>` string nobody chose, this migration writes
 * ONLY when the avatar is absent or blank. An avatar already on the row is a
 * deliberate choice by whoever set it, and a seed migration has no business
 * overruling it — the goal is "the editorial account has an avatar", which is
 * already true in that case.
 *
 * ## `profile` is JSONB: merge, never replace
 *
 * The bio lives in the same column. Writing `{ avatar }` wholesale would drop
 * it and break §6.5 condition 3 — trading a missing-avatar exclusion for a
 * missing-bio one, with the author page still `noindex` and the bio gone from
 * production. The update spreads the existing profile and overrides one key.
 *
 * ## `contentOnly` flag decision
 *
 * `true`, for the same reason as `0035`: the row this migration edits has NO
 * fixture baseline. It exists only because `0025` created it, and `0025` is
 * itself `contentOnly`. On a fresh build `--baseline-stamp` therefore leaves
 * both pending and runs them in order, and `0025` already writes the avatar
 * there, so this one finds nothing to do and no-ops.
 *
 * ## Dual-write
 *
 * The baseline half is `0025`'s `ensureEditorialAuthor`, which now sets
 * `avatar: EDITORIAL_AVATAR` at creation — keep both sides in sync, including
 * the Cloudinary transformation segment.
 *
 * ## `destructive` flag decision
 *
 * `false` — adds one key to a JSONB column on a single identified row, deletes
 * nothing, and is reversible by removing the key.
 */
import { eq, users } from '@repo/db';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

export const meta = {
    name: '0037-editorial-author-avatar',
    group: 'required',
    destructive: false,
    contentOnly: true
} as const satisfies SeedMigrationModule['meta'];

/** Unique identity of the editorial author created by `0025`. */
const EDITORIAL_EMAIL = 'editorial@hospeda.com.ar';

/**
 * The Hospeda isotype. Mirrors `EDITORIAL_AVATAR` in
 * `0025-seed-real-blog-posts.ts` (dual-write rule) — keep both in sync.
 *
 * The transformation segment is part of the value, not incidental: the page
 * renders this in a 96px circle, so `w_192,h_192` serves 2x for retina and no
 * more, `c_fill` matches the element's own `object-fit: cover`, and
 * `f_auto,q_auto` cut 28.7 KB of PNG to ~8 KB of WebP.
 */
const EDITORIAL_AVATAR =
    'https://res.cloudinary.com/djqdu6u93/image/upload/f_auto,q_auto,w_192,h_192,c_fill/' +
    'v1783526697/hospeda/prod/avatars/5748fbbd-7b13-4c65-b545-5510e106b0a5.png';

/** The shape this migration reads out of the `profile` JSONB column. */
type EditorialProfile = Record<string, unknown> & { avatar?: string | null };

export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    const [editorial] = await ctx.db
        .select({ id: users.id, profile: users.profile })
        .from(users)
        .where(eq(users.email, EDITORIAL_EMAIL))
        .limit(1);

    if (!editorial) {
        return {
            summary: `Editorial author "${EDITORIAL_EMAIL}" is absent from this environment; nothing to update.`,
            counts: { avatarsSet: 0 }
        };
    }

    const profile = (editorial.profile ?? {}) as EditorialProfile;
    const currentAvatar = typeof profile.avatar === 'string' ? profile.avatar.trim() : '';

    if (currentAvatar !== '') {
        return {
            summary:
                currentAvatar === EDITORIAL_AVATAR
                    ? 'Editorial author already carries the Hospeda isotype avatar.'
                    : `Editorial author already carries an avatar set elsewhere ("${currentAvatar}"); leaving it untouched.`,
            counts: { avatarsSet: 0 }
        };
    }

    // Spread first: the bio lives in this same column and must survive.
    await ctx.db
        .update(users)
        .set({
            profile: { ...profile, avatar: EDITORIAL_AVATAR },
            updatedAt: new Date()
        })
        .where(eq(users.id, editorial.id));

    return {
        summary: 'Set the Hospeda isotype as the editorial author avatar.',
        counts: { avatarsSet: 1 }
    };
}
