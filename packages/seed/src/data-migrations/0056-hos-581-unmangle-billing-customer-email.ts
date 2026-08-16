/**
 * @fileoverview
 * Data migration: 0056-hos-581-unmangle-billing-customer-email
 *
 * Restores `billing_customers.email` to the address the user actually typed,
 * for rows mangled while BETA-164's persist-time sanitizing was in force.
 *
 * ## Why this migration exists
 *
 * MercadoPago rejects '+' in an email (error 612), so BETA-164 replaced it with
 * '.' — but at PERSISTENCE, which meant `billing_customers.email` stored an
 * address the user never wrote. Gmail collapses dots, so `user.tag@gmail.com`
 * resolves to `usertag@gmail.com`: a different mailbox from the `user@gmail.com`
 * the '+' form would have reached.
 *
 * That column is read back as `recipientEmail` by eight of Hospeda's OWN sends
 * (dunning, cancellation finalisation, scheduled plan changes, price
 * propagation, abandoned pending subscriptions, addon purchase, and the payment
 * success/failure webhook notifications), so for a plus-addressed signup every
 * one of those went to a mailbox nobody reads. HOS-581 moved the sanitizing to
 * the single boundary that actually hands the address to MercadoPago.
 *
 * The code fix alone does not converge existing rows. `syncCustomerData` does
 * update the email when it differs, but Better Auth only fires it on
 * `user.update.after` — so a mangled row heals only if that user's record
 * happens to change. This migration converges the rest deterministically.
 *
 * ## The predicate, and why it is narrow
 *
 * A row is rewritten ONLY when the stored billing email is exactly the
 * sanitized form of the user's current email:
 *
 *     replace(users.email, '+', '.') = billing_customers.email
 *
 * That is what makes this safe. A blanket "copy `users.email` over
 * `billing_customers.email` wherever they differ" would also clobber rows that
 * diverged for some other, legitimate reason (an operator edit, a partially
 * applied sync). Requiring the mangled-form match means every row this touches
 * is provably one BETA-164 produced.
 *
 * Rows whose user has no '+' are untouched by construction: for them the
 * predicate reduces to `users.email = billing_customers.email`, which the
 * inequality guard already excludes.
 *
 * ## Idempotency
 *
 * The `email <> users.email` guard means a converged row no longer matches, so
 * a second run affects zero rows. Soft-deleted users are skipped: their billing
 * rows are not mailed and there is nothing to repair.
 *
 * ## `destructive` flag decision
 *
 * `false`. It only UPDATEs an email column to a value derivable from another
 * live column, never deletes, and converges to an identical end state on
 * re-run. The prior value is not lost in any meaningful sense — it is exactly
 * `replace(email, '+', '.')` of what is written.
 *
 * ## Expected scope
 *
 * Measured against production on 2026-08-15: 5 of 25 live billing customers
 * carry a mangled address, all of them test accounts (`+alojamiento`,
 * `+r1host`, `+smoke2`, `+testlanzamiento`, `+testsmoke`). No real user had
 * signed up with a plus alias, so this repairs no live customer's mail today —
 * it closes the gap before one arrives.
 */
import { and, billingCustomers, eq, isNull, ne, sql, users } from '@repo/db';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

export const meta = {
    name: '0056-hos-581-unmangle-billing-customer-email',
    group: 'required',
    destructive: false
} as const satisfies SeedMigrationModule['meta'];

export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    // Resolve the rows first rather than issuing a correlated UPDATE..FROM, so
    // the summary can report exactly which addresses were repaired — this runs
    // against production, and "N rows changed" with no names is not an audit
    // trail worth having.
    const candidates = await ctx.db
        .select({
            customerId: billingCustomers.id,
            mangled: billingCustomers.email,
            real: users.email
        })
        .from(billingCustomers)
        .innerJoin(users, eq(billingCustomers.externalId, sql`${users.id}::text`))
        .where(
            and(
                isNull(users.deletedAt),
                ne(billingCustomers.email, users.email),
                // The stored email is exactly the sanitized form of the user's
                // real one — the signature BETA-164 leaves behind.
                eq(billingCustomers.email, sql`replace(${users.email}, '+', '.')`)
            )
        );

    if (candidates.length === 0) {
        return { summary: 'No mangled billing_customers.email rows found — nothing to converge' };
    }

    for (const row of candidates) {
        await ctx.db
            .update(billingCustomers)
            .set({ email: row.real })
            .where(eq(billingCustomers.id, row.customerId));
    }

    const repaired = candidates.map((row) => `${row.mangled} -> ${row.real}`).join(', ');

    return {
        summary: `Restored ${candidates.length} billing_customers.email row(s) to the user's real address: ${repaired}`
    };
}
