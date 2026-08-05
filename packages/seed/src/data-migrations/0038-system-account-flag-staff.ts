/**
 * @fileoverview
 * Data migration: 0038-system-account-flag-staff
 *
 * Flips `users.is_system_account` to `true` on the two required-seed staff
 * accounts in environments that were seeded before the column existed.
 *
 * ## What the flag is for
 *
 * A system account represents the PLATFORM, not a person, and never gets a
 * public author surface: it is excluded from the author-page indexability
 * predicate and from the sitemap (HOS-375 §6.10.1). Without this migration a
 * live environment keeps both staff accounts at the column default (`false`),
 * so `/autores/super-admin-user/` — titled "Super Admin" — becomes eligible for
 * Google the moment it has a bio, an avatar and one published item. It has 44
 * imported events attributed to it in production today.
 *
 * ## Why a stored flag and not a role check
 *
 * The role is mutable and this property is not. Evaluating `SUPER_ADMIN`/`ADMIN`
 * live would mean promoting a real editor silently unpublishes their author page
 * and drops it from the sitemap, and demoting a staff account publishes it — an
 * indexed URL appearing or vanishing as a side effect of a permissions change
 * nobody connected to SEO. Role is consulted exactly once, here, to decide the
 * initial value; never at read time. See HOS-375 §6.10.1.
 *
 * ## Resolved by email, never by slug or id
 *
 * Both differ per environment. The slug in particular is auto-generated from the
 * row id for any account created without one, so a hardcoded value silently
 * targets the wrong row — or no row — outside the machine it was written on. The
 * emails are the stable identity of these two fixtures
 * (`src/data/user/required/*.json`).
 *
 * ## Dual-write
 *
 * The baseline half lives in those same two fixtures, which now declare
 * `"isSystemAccount": true` so a fresh database is built correct without running
 * this migration at all. That is also why this migration is NOT `contentOnly`
 * (HOS-375 §6.11): unlike `0025`/`0027`/`0028`, the rows it acts on genuinely
 * exist on a fresh build, produced by a real fixture.
 *
 * ## Scope guards
 *
 * Matches the two emails exactly, and only writes rows where the flag is still
 * `false`. An account an operator deliberately flagged — or a future service
 * account already marked — is never rewritten, and an environment missing one or
 * both accounts (a production database bootstrapped with
 * `--required --exclude=users` never creates them) is a silent skip rather than
 * a failure. The returned counts report how many rows actually flipped.
 *
 * ## Idempotency
 *
 * Re-running is a no-op: after the first pass neither targeted row still has
 * `is_system_account = false`.
 *
 * ## `destructive` flag decision
 *
 * `false` — flips one boolean on at most two identified rows, deletes nothing,
 * and is reversible by setting the same rows back to `false`.
 */
import { and, eq, inArray, users } from '@repo/db';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

export const meta = {
    name: '0038-system-account-flag-staff',
    group: 'required',
    destructive: false
} as const satisfies SeedMigrationModule['meta'];

/**
 * The stable identity of the two required-seed staff accounts. Mirrors
 * `"isSystemAccount": true` in `src/data/user/required/admin-user.json` and
 * `super-admin-user.json` (dual-write rule) — keep both sides in sync.
 *
 * Emails, not slugs or ids: see this file's header for why.
 */
const SYSTEM_ACCOUNT_EMAILS = ['superadmin@hospeda.com', 'admin@hospeda.com'] as const;

export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    const flagged = await ctx.db
        .update(users)
        .set({ isSystemAccount: true, updatedAt: new Date() })
        .where(
            and(inArray(users.email, [...SYSTEM_ACCOUNT_EMAILS]), eq(users.isSystemAccount, false))
        )
        .returning({ email: users.email });

    const flaggedEmails = flagged.map((row) => row.email).sort();

    return {
        summary:
            flaggedEmails.length > 0
                ? `Marked ${flaggedEmails.length} staff account(s) as system accounts: ${flaggedEmails.join(', ')}.`
                : 'No staff account needed flagging (targeted rows already marked, or absent from this environment).',
        counts: {
            accountsFlagged: flaggedEmails.length,
            accountsTargeted: SYSTEM_ACCOUNT_EMAILS.length
        }
    };
}
