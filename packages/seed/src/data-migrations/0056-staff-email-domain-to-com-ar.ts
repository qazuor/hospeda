/**
 * @fileoverview
 * Data migration: 0056-staff-email-domain-to-com-ar
 *
 * Moves the seeded staff accounts off `@hospeda.com` and onto the platform's
 * real domain, `@hospeda.com.ar`.
 *
 * ## Why this is not cosmetic
 *
 * `hospeda.com` is not ours and it publishes a **null MX record** (`0 .`,
 * RFC 7505) — an explicit declaration that the domain accepts no mail at all.
 * So every message ever addressed to one of these accounts came back from
 * Brevo as a soft bounce with `Unable to find MX of domain hospeda.com`. Not a
 * deliverability problem to tune: there is no mail server to deliver to, and a
 * SOFT bounce does not even land the address in a visible blocklist.
 *
 * The account that matters is the SUPER_ADMIN's: it is the one that would
 * receive any operational or billing notification addressed to staff, and it
 * is the only one of the three that can actually sign in. Everything sent to
 * it has been silently discarded since launch (smoke finding H-76).
 *
 * ## Why a rename rather than new accounts
 *
 * `superadmin@`, `admin@` and `guest@`. Renaming preserves their ids, roles,
 * credential row and every FK pointing at them; creating replacements would
 * orphan all of it. Better Auth is unaffected — `account.account_id` holds the
 * user's UUID, not the address — so the credential row keeps working and the
 * owner simply signs in with the new address from now on.
 *
 * ## What it updates
 *
 * 1. `users.email` — the login identifier and the address notifications go to.
 * 2. `users.contact_info.personalEmail` / `.workEmail` — the same domain,
 *    denormalised into the profile block. Left stale they would keep showing
 *    an address that cannot receive anything, including on Laura Vega's
 *    fixture, whose login is a gmail address but whose `workEmail` is
 *    `moderator@hospeda.com`.
 *
 * `preferredEmail` is deliberately untouched: it holds a channel selector
 * (`PERSONAL` / `WORK`), not an address.
 *
 * ## What it deliberately does NOT update
 *
 * - `billing_customers.email` (1 row in production). It is the qzpay-owned
 *   mirror of the customer that is also pushed to MercadoPago, so rewriting it
 *   here would leave the local row and MercadoPago's copy disagreeing with no
 *   mechanism to reconcile them. Flagged for the owner to decide.
 * - `newsletter_subscribers.email` (1 row). A subscription is a consent record
 *   tied to the address that gave it; silently repointing it at a different
 *   mailbox is not a data fix.
 * - `billing_notification_log.recipient`. History: those messages really were
 *   addressed to the old address, and that is the evidence for H-76.
 * - `example-fixture-ids.helpers.ts`, which lists `guest@hospeda.com` in its
 *   frozen `EXAMPLE_USER_EMAILS` allowlist. That file is a deliberate copy
 *   pinned to migrations 0023/0024, both long applied. Whoever writes the
 *   Phase 2 hard-delete must read the JSON fixtures — the documented source of
 *   truth — and will find the new address there.
 *
 * ## Collision safety
 *
 * `users.email` is UNIQUE. Each rename is guarded by a `NOT EXISTS` on the
 * target address, so an environment that already holds, say,
 * `admin@hospeda.com.ar` leaves the old row alone instead of aborting the whole
 * migration run on a constraint violation. Production holds none of the three
 * targets today; the guard is for the environments nobody checked.
 *
 * ## Idempotency
 *
 * Both statements are guarded on the OLD value (`LIKE '%@hospeda.com'`, and for
 * the JSON the `@hospeda.com"` fragment that only an unconverted value
 * produces). A second run matches zero rows.
 *
 * ## `destructive` flag decision
 *
 * `false`. Guarded UPDATEs, no deletes, and every id is preserved.
 */
import { sql, users } from '@repo/db';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

export const meta = {
    name: '0056-staff-email-domain-to-com-ar',
    group: 'required',
    destructive: false
} as const satisfies SeedMigrationModule['meta'];

/** The domain being retired. Not ours, and it publishes a null MX record. */
export const OLD_DOMAIN = '@hospeda.com';

/** The platform's real domain. */
export const NEW_DOMAIN = '@hospeda.com.ar';

/**
 * The `contact_info` keys that hold an address.
 *
 * `preferredEmail` is excluded on purpose — it names a channel, not a mailbox.
 */
const CONTACT_EMAIL_KEYS = ['personalEmail', 'workEmail'] as const;

export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    // ── 1. The login identifier ──────────────────────────────────────────
    //
    // `email || '.ar'` rather than a replace: the WHERE already pins the value
    // to one ending in `@hospeda.com`, so appending is exact and cannot touch
    // an address that merely contains the domain somewhere in the middle.
    const renamed = await ctx.db
        .update(users)
        .set({ email: sql`${users.email} || '.ar'`, updatedAt: new Date() })
        .where(
            sql`${users.email} LIKE ${`%${OLD_DOMAIN}`}
                AND NOT EXISTS (
                    SELECT 1 FROM users AS twin WHERE twin.email = ${users.email} || '.ar'
                )`
        )
        .returning({ id: users.id, email: users.email });

    // ── 2. The same domain, denormalised into the profile block ──────────
    //
    // The `CASE` is not defensive tidiness, it is required. `jsonb_set` is
    // STRICT: hand it a NULL in any argument and the whole call returns NULL.
    // A profile without a `workEmail` makes `contact_info->>'workEmail'` NULL,
    // so `to_jsonb(replace(NULL, …))` is NULL and the expression would blank
    // the ENTIRE contact block rather than skip the key. `create_missing =
    // false` does not save it — the NULL propagates before the path is even
    // considered. An integration test on a profile with only a personal
    // address is what surfaced this; a stubbed `ctx.db` could not have.
    //
    // A key present but not carrying the old domain is rewritten to itself,
    // which is a no-op.
    const contactInfoExpr = CONTACT_EMAIL_KEYS.reduce(
        (inner, key) =>
            sql`CASE WHEN ${users.contactInfo}->>${key} IS NULL THEN ${inner}
                     ELSE jsonb_set(${inner}, ${`{${key}}`}::text[], to_jsonb(replace(${users.contactInfo}->>${key}, ${OLD_DOMAIN}, ${NEW_DOMAIN})), false)
                END`,
        sql`${users.contactInfo}`
    );

    const contactUpdated = await ctx.db
        .update(users)
        .set({ contactInfo: contactInfoExpr, updatedAt: new Date() })
        // The closing quote is load-bearing: it matches a value that ENDS in
        // the old domain, so an already-converted `@hospeda.com.ar"` does not
        // match and the statement stays idempotent.
        .where(sql`${users.contactInfo}::text LIKE ${`%${OLD_DOMAIN}"%`}`)
        .returning({ id: users.id });

    const renamedList = renamed.map((row) => row.email).join(', ');

    return {
        summary:
            renamed.length === 0 && contactUpdated.length === 0
                ? `No account was still on ${OLD_DOMAIN} — nothing to update.`
                : `Moved ${renamed.length} account(s) to ${NEW_DOMAIN}${
                      renamedList ? ` (${renamedList})` : ''
                  } and rewrote the contact block on ${contactUpdated.length} profile(s).`,
        counts: { accountsRenamed: renamed.length, profilesUpdated: contactUpdated.length }
    };
}
