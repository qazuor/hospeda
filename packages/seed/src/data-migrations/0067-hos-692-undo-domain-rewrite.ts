/**
 * @fileoverview
 * Data migration: 0067-hos-692-undo-domain-rewrite
 *
 * HOS-692 (epic HOS-589), release B. The undo counterpart to
 * `0066-hos-692-domain-rewrite-and-plan-cleanup`'s Part 1 (the
 * commerce/gastronomy/experience domain rewrite), written and committed
 * NOW rather than improvised during an incident (spec §13 — "make the code
 * revertible, and write the undo before it is needed").
 *
 * It does NOT undo Part 2 (plan catalogue cleanup) — the spec's own undo
 * section (§13) only discusses the domain columns; folding back deleted
 * `complex-*` plans or restoring the metadata mirror isn't asked for and
 * isn't safe to infer.
 *
 * ## Why this migration is inert by default — READ BEFORE INVOKING
 *
 * `packages/seed/src/data-migrations/runner.ts` runs every PENDING migration
 * in strict numeric-prefix order, in one call, with no way to run a single
 * numbered migration in isolation. Both this file and 0066 are committed in
 * the SAME PR, so on the very first `db:seed:migrate` invocation against any
 * environment that has neither applied yet, this migration becomes pending
 * in the SAME BATCH as 0066 and would run immediately after it.
 *
 * Its own bound — `created_at < (0066's applied_at)` — does not save it: at
 * the moment this migration's `up()` runs, 0066 has ALREADY committed (each
 * migration runs in its own transaction, committed before the runner moves
 * to the next), so 0066's `seed_migrations.applied_at` row already exists,
 * and EVERY row 0066 just rewrote has a `created_at` earlier than that
 * `applied_at` by construction. Left ungated, this migration would silently
 * undo 0066 within seconds of it applying, on every environment, the first
 * time anyone runs the normal migrate command — the exact "the revert causes
 * the incident it was meant to end" failure spec §13 warns about, just at a
 * different layer (data, not code).
 *
 * So this migration REFUSES to act unless explicitly told to, via the
 * `HOSPEDA_CONFIRM_HOS_692_DOMAIN_ROLLBACK=true` environment variable. Without
 * it, `up()` performs NO writes and returns a normal (non-throwing) skipped
 * result — which the runner ledgers exactly like any other applied migration
 * (see `0059`/`0024`'s own environment-gated skip pattern; this is the same
 * idiom, gated by an explicit flag instead of `NODE_ENV`).
 *
 * ## The one-shot consequence — READ BEFORE RELYING ON THIS FOR A REAL INCIDENT
 *
 * `seed_migrations` is append-only: once THIS file's `name` is recorded (skip
 * or not — the runner ledgers on any non-throwing return), the runner will
 * never reconsider it again, on any environment, no matter how its own logic
 * changes afterward. In the overwhelmingly likely case (nobody sets the
 * confirm flag on the routine deploy that applies 0066), this migration
 * *permanently* records itself as a no-op the very first time `db:seed:migrate`
 * runs after this PR merges.
 *
 * That means this exact numbered file is NOT a live rollback switch you can
 * flip months later. If release B genuinely needs reverting after it has
 * soaked, the correct action is to **author a new, separately-numbered
 * migration whose `up()` copies this file's logic verbatim** (the SQL and the
 * bound below are the hard part, and they are already written, reviewed, and
 * ready — only the migration NUMBER and NAME need to change). This file's
 * value is as a tested, ready-to-copy reference implementation, not as a
 * switch this exact ledger row can re-arm.
 *
 * ## What it does, when explicitly invoked
 *
 * Maps `'gastronomy'` / `'experience'` back to `'commerce'` on BOTH
 * `billing_subscriptions.product_domain` and
 * `commerce_listing_subscriptions.product_domain` (§6.13 — two columns, one
 * purchase), bounded by `created_at < <0066's recorded applied_at>` on each
 * table independently. Every row carrying the new values at the moment 0066
 * applied is one 0066 created (those values did not exist before it ran); a
 * row created AFTER 0066 is a real sale, and folding it back to `'commerce'`
 * would put a live owner on the wrong vertical's cap.
 *
 * **Never writes `NULL`** — every write is the literal string `'commerce'`.
 *
 * ## `destructive` flag
 *
 * `true`: a real invocation mutates existing rows and it is invoked, by
 * design, ONLY as a genuine incident response.
 */
import { and, billingSubscriptions, commerceListingSubscriptions, inArray, lt } from '@repo/db';
import { ProductDomainEnum } from '@repo/schemas';
import { getAppliedMigrations } from './ledger.js';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

export const meta = {
    name: '0067-hos-692-undo-domain-rewrite',
    group: 'required',
    destructive: true
} as const satisfies SeedMigrationModule['meta'];

/** The forward migration this file undoes — its `applied_at` is the bound. */
const FORWARD_MIGRATION_NAME = '0066-hos-692-domain-rewrite-and-plan-cleanup';

/** Explicit opt-in required for this migration to perform any write. See module docblock. */
const CONFIRM_ENV_VAR = 'HOSPEDA_CONFIRM_HOS_692_DOMAIN_ROLLBACK';

export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    if (process.env[CONFIRM_ENV_VAR] !== 'true') {
        return {
            summary:
                `Skipped (default, safe state): set ${CONFIRM_ENV_VAR}=true to actually run this ` +
                "rollback. See this file's module docblock — this is a one-shot ledger entry; " +
                "if 0066 needs reverting after it has already soaked, copy this file's logic into " +
                'a NEW migration number instead of relying on re-triggering this one.',
            counts: { skipped: 1 }
        };
    }

    const { db } = ctx;

    const { rows: appliedRows } = await getAppliedMigrations({ db });
    const forward = appliedRows.find((row) => row.name === FORWARD_MIGRATION_NAME);
    if (!forward) {
        throw new Error(
            `Cannot run the HOS-692 domain-rewrite rollback: "${FORWARD_MIGRATION_NAME}" has not ` +
                'applied on this database, so there is no bound to revert against.'
        );
    }
    const bound = forward.appliedAt;

    const revertedSubscriptions = await db
        .update(billingSubscriptions)
        .set({ productDomain: ProductDomainEnum.COMMERCE })
        .where(
            and(
                inArray(billingSubscriptions.productDomain, [
                    ProductDomainEnum.GASTRONOMY,
                    ProductDomainEnum.EXPERIENCE
                ]),
                lt(billingSubscriptions.createdAt, bound)
            )
        )
        .returning({ id: billingSubscriptions.id });

    const revertedLinkRows = await db
        .update(commerceListingSubscriptions)
        .set({ productDomain: ProductDomainEnum.COMMERCE })
        .where(
            and(
                inArray(commerceListingSubscriptions.productDomain, [
                    ProductDomainEnum.GASTRONOMY,
                    ProductDomainEnum.EXPERIENCE
                ]),
                lt(commerceListingSubscriptions.createdAt, bound)
            )
        )
        .returning({ id: commerceListingSubscriptions.id });

    return {
        summary:
            `HOS-692 rollback EXECUTED: ${revertedSubscriptions.length} subscription(s) and ` +
            `${revertedLinkRows.length} link row(s) reverted to product_domain='commerce' ` +
            `(bound: created_at < ${bound.toISOString()}, the recorded applied_at of "${FORWARD_MIGRATION_NAME}").`,
        counts: {
            subscriptionsReverted: revertedSubscriptions.length,
            linkRowsReverted: revertedLinkRows.length
        }
    };
}
