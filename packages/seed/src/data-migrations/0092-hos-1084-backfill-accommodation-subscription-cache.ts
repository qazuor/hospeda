/**
 * @fileoverview
 * Data migration: 0092-hos-1084-backfill-accommodation-subscription-cache
 *
 * HOS-1084 gave accommodation the denormalized subscription-status cache
 * commerce already had, by renaming `commerce_listing_subscriptions` to
 * `entity_subscriptions` and teaching it a third `entity_type`. Structural
 * migration 0114 creates the shape; this fills it for every accommodation that
 * already exists.
 *
 * ## Why it is not optional
 *
 * A missing row is never a WRONG answer — the public read falls back to the
 * live QZPay walk it used before the cache existed — so an unbackfilled
 * database is correct. It is just slow, on every request, for every listing,
 * which is the entire condition HOS-1084 set out to remove. Without this
 * migration a live environment would sit at a 100% miss rate until the 6-hourly
 * `entity-subscription-cache-reconcile` cron happened to run.
 *
 * ## Rows written
 *
 * One row per NON-DELETED accommodation:
 *
 * - `entity_type = 'accommodation'`, `entity_id = accommodations.id`, so the
 *   table's `UNIQUE(entity_type, entity_id)` keeps meaning "one row per
 *   LISTING". A host with three properties gets three rows carrying the same
 *   subscription — which is exactly what a unique constraint on
 *   `subscription_id` would have made impossible.
 * - `status` / `plan_id` mirror the owner's current accommodation subscription;
 * - an owner with NO accommodation subscription gets `subscription_id = NULL`
 *   and `status = 'none'`. That NEGATIVE row is the point: it is the most
 *   common owner on the platform, and leaving them uncached would send every
 *   one of their requests down the live path.
 *
 * ## The domain filter runs in TypeScript, not in SQL
 *
 * `isAccommodationSubscription` is the only sanctioned way to ask whether a
 * subscription belongs to the accommodation domain, and it fails OPEN — a
 * `null` `product_domain` counts as accommodation, because the column
 * post-dates most rows in production. Re-deriving that as
 * `product_domain = 'accommodation'` in SQL would silently exclude every legacy
 * subscription and backfill the whole pre-column population as `'none'`, i.e.
 * cache "this host does not pay" over hosts who do. Since a cached negative is
 * believed by the public read, that is the one mistake here that would be
 * visible to customers.
 *
 * ## `meta.requiresColumns`
 *
 * This migration READS `entity_subscriptions.plan_id` (through the `excluded.`
 * upsert) and `billing_subscriptions.product_domain`. Both are columns the
 * structural carril ADDS or already provides, so the standard order
 * (`db:migrate` → `db:apply-extras` → `db:seed:migrate`) is the correct
 * direction — the opposite of HOS-433, where a backfill read a column the same
 * release dropped and was ledgered `ok` after moving zero rows. Declared anyway
 * so a future reordering aborts loudly instead of quietly writing nothing.
 *
 * ## `meta.contentOnly` — why a fresh database must RUN this, not stamp it
 *
 * `--baseline-stamp` records a migration as applied without running it, on the
 * premise that a fresh baseline seed already produced the same end state. That
 * premise is false here: no fixture under `src/data/**` writes an
 * `entity_subscriptions` row, so a stamped fresh database would carry the
 * migration in its ledger while the cache stayed empty — and the ledger would
 * then stop it from ever running. `contentOnly: true` makes `db:fresh` run it
 * for real, after the seed, which is what makes a fresh database and a
 * migrated one converge on the same rows.
 *
 * `db:fresh-dev` seeds its 18 billing test users AFTER this step, so their
 * accommodations start as cache MISSES. That is the benign case by design —
 * a miss resolves live — and the reconcile cron fills them.
 *
 * ## Idempotency
 *
 * Upsert on `(entity_type, entity_id)`. A re-run rewrites the same values, and
 * the counters report how many rows it touched rather than how many changed.
 *
 * ## `destructive` flag decision
 *
 * `false`. It only inserts and updates rows in a cache table whose rows are all
 * re-derivable from billing. Nothing is deleted, and the reconcile cron
 * reproduces the same end state on its own.
 */
import { isEntitlementGrantingStatus } from '@repo/billing';
import {
    accommodations,
    and,
    billingCustomers,
    billingSubscriptions,
    ENTITY_SUBSCRIPTION_STATUS_NONE,
    entitySubscriptions,
    eq,
    isNull,
    sql
} from '@repo/db';
import { ProductDomainEnum } from '@repo/schemas';
import { isAccommodationSubscription } from '@repo/service-core';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

export const meta = {
    name: '0092-hos-1084-backfill-accommodation-subscription-cache',
    group: 'required',
    destructive: false,
    contentOnly: true,
    requiresColumns: [
        { table: 'entity_subscriptions', column: 'plan_id' },
        { table: 'billing_subscriptions', column: 'product_domain' }
    ]
} as const satisfies SeedMigrationModule['meta'];

/** `entity_subscriptions.entity_type` for an accommodation row. */
const ACCOMMODATION_ENTITY_TYPE = 'accommodation';

/** How many rows one upsert statement carries. */
const CHUNK_SIZE = 200;

/** The state one owner's accommodations should be cached with. */
interface OwnerState {
    readonly subscriptionId: string | null;
    readonly status: string;
    readonly planId: string | null;
}

const NO_SUBSCRIPTION: OwnerState = {
    subscriptionId: null,
    status: ENTITY_SUBSCRIPTION_STATUS_NONE,
    planId: null
};

export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    // ── 1. Every live accommodation and its owner ───────────────────────────
    const owned = await ctx.db
        .select({ id: accommodations.id, ownerId: accommodations.ownerId })
        .from(accommodations)
        .where(isNull(accommodations.deletedAt));

    if (owned.length === 0) {
        return {
            summary: 'HOS-1084: no accommodations to backfill — nothing written.',
            counts: { accommodations: 0, rowsWritten: 0, ownersWithSubscription: 0 }
        };
    }

    // ── 2. The subscription each owner's rows should mirror ─────────────────
    const subscriptionRows = await ctx.db
        .select({
            ownerId: billingCustomers.externalId,
            id: billingSubscriptions.id,
            status: billingSubscriptions.status,
            planId: billingSubscriptions.planId,
            productDomain: billingSubscriptions.productDomain,
            createdAt: billingSubscriptions.createdAt
        })
        .from(billingSubscriptions)
        .innerJoin(billingCustomers, eq(billingCustomers.id, billingSubscriptions.customerId))
        .where(and(isNull(billingCustomers.deletedAt), isNull(billingSubscriptions.deletedAt)));

    const stateByOwner = new Map<string, OwnerState>();
    const chosenRank = new Map<string, { granting: boolean; createdAt: number }>();

    for (const row of subscriptionRows) {
        if (!isAccommodationSubscription(row)) {
            continue;
        }
        const granting = isEntitlementGrantingStatus(row.status);
        const createdAt = row.createdAt?.getTime() ?? 0;
        const incumbent = chosenRank.get(row.ownerId);

        // An entitlement-granting subscription always wins; between two of the
        // same rank, the newest does.
        const wins =
            incumbent === undefined ||
            (granting && !incumbent.granting) ||
            (granting === incumbent.granting && createdAt > incumbent.createdAt);
        if (!wins) {
            continue;
        }

        stateByOwner.set(row.ownerId, {
            subscriptionId: row.id,
            status: row.status,
            planId: row.planId ?? null
        });
        chosenRank.set(row.ownerId, { granting, createdAt });
    }

    // ── 3. One row per accommodation ────────────────────────────────────────
    const values = owned.map((accommodation) => {
        const state = stateByOwner.get(accommodation.ownerId) ?? NO_SUBSCRIPTION;
        return {
            subscriptionId: state.subscriptionId,
            productDomain: ProductDomainEnum.ACCOMMODATION as string,
            entityType: ACCOMMODATION_ENTITY_TYPE,
            entityId: accommodation.id,
            status: state.status,
            planId: state.planId
        };
    });

    for (let offset = 0; offset < values.length; offset += CHUNK_SIZE) {
        await ctx.db
            .insert(entitySubscriptions)
            .values(values.slice(offset, offset + CHUNK_SIZE))
            .onConflictDoUpdate({
                target: [entitySubscriptions.entityType, entitySubscriptions.entityId],
                set: {
                    subscriptionId: sql`excluded.subscription_id`,
                    productDomain: sql`excluded.product_domain`,
                    status: sql`excluded.status`,
                    planId: sql`excluded.plan_id`,
                    updatedAt: new Date()
                }
            });
    }

    const ownersWithSubscription = stateByOwner.size;
    const counts = {
        accommodations: owned.length,
        rowsWritten: values.length,
        ownersWithSubscription
    };

    return {
        summary: `HOS-1084: backfilled ${values.length} entity_subscriptions row(s) for ${owned.length} accommodation(s); ${ownersWithSubscription} owner(s) hold an accommodation subscription, the rest cached as '${ENTITY_SUBSCRIPTION_STATUS_NONE}'.`,
        counts
    };
}
