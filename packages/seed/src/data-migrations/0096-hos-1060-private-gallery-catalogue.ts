/**
 * @fileoverview
 * Data migration: 0096-hos-1060-private-gallery-catalogue
 *
 * Dual-write counterpart (HOS-25) for HOS-1060 phase 1 — the billing rail for
 * private per-tourist galleries. Four deltas, all applied to `plans.config.ts`,
 * `limits.config.ts`, `entitlements.config.ts` and `addons.config.ts` in the
 * same PR:
 *
 * 1. the `max_active_private_galleries` limit lookup row;
 * 2. the `manage_experience_private_galleries` entitlement lookup row;
 * 3. the grant on `experience-premium`, plus the cap on all SIX commerce plan
 *    rows (premium at 20, the other five at an explicit `0`);
 * 4. the three `private-galleries-+N` add-ons, seeded INACTIVE.
 *
 * ## Why the migration is required at all
 *
 * `ensureCommercePlan` and `ensureAddon` both INSERT ONLY — an existing row is
 * skipped wholesale. Editing the baseline alone therefore reaches a fresh
 * `db:fresh` and nothing else: staging and production would keep an
 * `experience-premium` that grants nothing, six plan rows with no gallery cap,
 * and no pack to buy, with the build green throughout (the HOS-789 shape this
 * whole carril exists to prevent).
 *
 * ## The zeros are the load-bearing half, not the twenty
 *
 * Writing the grant and the premium cap while omitting the five zeros would be
 * worse than writing neither. An ABSENT limit key is resolved as UNLIMITED by
 * every layer beneath (`commerce-limits.config.ts` opens with that warning), so
 * the four tiers that grant nothing and the whole gastronomy vertical would each
 * hold an uncapped photo store the moment anything starts reading the key.
 * Storage is the one recurring per-use cost in this epic; an explicit `0` and a
 * missing key are opposite claims.
 *
 * ## `productDomain` on the eight existing add-ons is NOT backfilled here
 *
 * Deliberately, and it is not an omission. `AddonDefinition.productDomain`
 * (HOS-1060, closing HOS-974 D-C) is a Model C `'capability'` fact resolved from
 * the CATALOGUE by slug — `resolveAddonProductDomain` in `@repo/billing`, called
 * by `addon-catalog.mapper.ts`. It is never stored in `billing_addons`, so there
 * is nothing in those eight rows to correct. Reading it from the database would
 * have made a stale row the authority over the binary that also carries the
 * check, which is the ordering hazard `commerce-entitlements.config.ts` was
 * written around.
 *
 * ## Idempotency
 *
 * - Lookup rows: inserted only when absent.
 * - The grant: the array is rewritten to the UNION of what the row holds and the
 *   one key, so re-running adds nothing.
 * - The cap: written per row only when the key is ABSENT. Limit values are a
 *   `'commercial'` field and the database wins, so an operator who tuned a cap
 *   through the SPEC-168 admin editor keeps their value. Unlike `0094` there is
 *   no scoped overwrite to make: this key has never existed on any row, so
 *   "write when absent" reaches every environment on the first run and nothing
 *   on the second.
 * - Add-ons: inserted only when absent, matched on `name` — the same idempotency
 *   key `ensureAddon` and `0061` use.
 *
 * A re-run affects zero rows.
 *
 * ## No column dependency, hence no `meta.requiresColumns`
 *
 * Touches `billing_limits`, `billing_entitlements`, `billing_plans`
 * (`entitlements` and `limits`, both long-existing JSON columns) and
 * `billing_addons`. HOS-1060 phase 1 ships no structural migration.
 *
 * ## `destructive` flag decision
 *
 * `false`. Conditional lookup inserts, an additive array union, additive limit
 * keys and conditional add-on inserts. Nothing is deleted and no row loses a
 * grant, a key or a cap.
 */
import {
    billingAddons,
    billingEntitlements,
    billingLimits,
    billingPlans,
    eq,
    inArray
} from '@repo/db';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

export const meta = {
    name: '0096-hos-1060-private-gallery-catalogue',
    group: 'required',
    destructive: false
} as const satisfies SeedMigrationModule['meta'];

/**
 * The limit key this migration introduces, with the metadata its lookup row
 * carries.
 *
 * Literal rather than imported from `LIMIT_METADATA`, for the reason `0094`
 * states: a migration records the delta it applied on the day it ran, and must
 * keep describing that delta after a later baseline edit changes the constant
 * underneath it.
 */
const GALLERY_LIMIT = {
    key: 'max_active_private_galleries',
    name: 'Active private galleries',
    description:
        'Maximum number of private per-tourist photo galleries an experience provider may hold alive at once. Counts galleries that have not expired yet (each lives 30 days from creation), not galleries ever created, so the cap refills as they lapse. Raised by the private-galleries-+5/+10/+20 add-ons.'
} as const;

/** The entitlement key this migration introduces, spelled out for the same reason. */
const GALLERY_ENTITLEMENT = {
    key: 'manage_experience_private_galleries',
    name: 'Private tourist galleries',
    description:
        'Allows creating a private photo gallery per tourist, shared by a secret link rather than an account, so whoever did the outing can see and download their own photos. Capped by max_active_private_galleries and expiring 30 days after creation.'
} as const;

/**
 * Every commerce plan row and the gallery cap it must declare.
 *
 * All SIX are listed, including the five zeros — see the file docblock for why
 * an explicit `0` and a missing key are opposite claims. `experience-premium` is
 * also the only row that receives the grant.
 */
const GALLERY_CAP_BY_PLAN_NAME: Readonly<Record<string, number>> = {
    'gastronomy-basico': 0,
    'gastronomy-pro': 0,
    'gastronomy-premium': 0,
    'experience-basico': 0,
    'experience-pro': 0,
    'experience-premium': 20
};

/** The plan row that carries the escalón grant (owner decision, 2026-09-04). */
const GRANTED_PLAN_NAME = 'experience-premium';

/**
 * The three packs, in the exact column layout `ensureAddon` writes.
 *
 * Spelled out rather than imported from `ALL_PRIVATE_GALLERY_ADDONS` for the
 * `0094` reason above, and because the prices are placeholders the owner
 * confirms at activation: this migration must keep reporting the rows it
 * actually created, not whatever the catalogue says later.
 *
 * `active: false` on all three. The gallery routes do not exist in phase 1, and
 * an active add-on for a feature that does not exist means the provider pays and
 * receives nothing — the precedent `ai-support-monthly` sets.
 */
const GALLERY_ADDONS: readonly {
    name: string;
    slug: string;
    description: string;
    priceArs: number;
    galleries: number;
    sortOrder: number;
}[] = [
    {
        name: 'Private Galleries Pack (+5)',
        slug: 'private-galleries-5',
        description:
            'Adds 5 additional active private galleries for your experiences, and enables private galleries on plans that do not include them. Renews monthly.',
        priceArs: 800_000,
        galleries: 5,
        sortOrder: 9
    },
    {
        name: 'Private Galleries Pack (+10)',
        slug: 'private-galleries-10',
        description:
            'Adds 10 additional active private galleries for your experiences, and enables private galleries on plans that do not include them. Renews monthly.',
        priceArs: 1_400_000,
        galleries: 10,
        sortOrder: 10
    },
    {
        name: 'Private Galleries Pack (+20)',
        slug: 'private-galleries-20',
        description:
            'Adds 20 additional active private galleries for your experiences, and enables private galleries on plans that do not include them. Renews monthly.',
        priceArs: 2_400_000,
        galleries: 20,
        sortOrder: 11
    }
];

/**
 * Applies HOS-1060's billing rail to an existing environment.
 *
 * @param ctx - Data-migration context; only `ctx.db` is used.
 * @returns A summary plus per-table counters.
 */
export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    const db = ctx.db;
    const livemode = process.env.NODE_ENV === 'production';

    let limitsCreated = 0;
    let entitlementsCreated = 0;
    let plansGranted = 0;
    let capsWritten = 0;
    let capsAlreadyDeclared = 0;
    let addonsCreated = 0;

    // ── 1. Lookup rows, created when absent ──────────────────────────────────
    // A grant naming a key with no `billing_entitlements` row is a dangling
    // grant, and a plan limit naming a key with no `billing_limits` row is the
    // same thing on the other axis. Both are created rather than assumed —
    // `0093` and `0094` state the reason: the documented run order
    // (`db:migrate` → `db:apply-extras` → `db:seed:migrate`) does not include
    // the required seed, so a database can legitimately hold the plan rows while
    // the lookup tables are still nearly empty.
    const existingLimit = await db
        .select({ key: billingLimits.key })
        .from(billingLimits)
        .where(eq(billingLimits.key, GALLERY_LIMIT.key))
        .limit(1);

    if (existingLimit.length === 0) {
        await db.insert(billingLimits).values({
            key: GALLERY_LIMIT.key,
            name: GALLERY_LIMIT.name,
            description: GALLERY_LIMIT.description,
            // Same as `billingLimits.seed.ts`: the real value comes from the plan.
            defaultValue: 0
        });
        limitsCreated++;
    }

    const existingEntitlement = await db
        .select({ key: billingEntitlements.key })
        .from(billingEntitlements)
        .where(eq(billingEntitlements.key, GALLERY_ENTITLEMENT.key))
        .limit(1);

    if (existingEntitlement.length === 0) {
        await db.insert(billingEntitlements).values({
            key: GALLERY_ENTITLEMENT.key,
            name: GALLERY_ENTITLEMENT.name,
            description: GALLERY_ENTITLEMENT.description
        });
        entitlementsCreated++;
    }

    // ── 2. The grant and the caps, per commerce plan row ─────────────────────
    // A database with no commerce plan rows is a clean no-op here, not a
    // refusal — `0094` was the only one of 94 migrations that aborted the
    // ledger run by assuming otherwise.
    const planRows = await db
        .select({
            id: billingPlans.id,
            name: billingPlans.name,
            entitlements: billingPlans.entitlements,
            limits: billingPlans.limits
        })
        .from(billingPlans)
        .where(inArray(billingPlans.name, Object.keys(GALLERY_CAP_BY_PLAN_NAME)));

    for (const row of planRows) {
        const currentEntitlements = Array.isArray(row.entitlements)
            ? (row.entitlements as string[])
            : [];
        const currentLimits =
            row.limits && typeof row.limits === 'object'
                ? (row.limits as Record<string, number>)
                : {};

        const needsGrant =
            row.name === GRANTED_PLAN_NAME &&
            !currentEntitlements.includes(GALLERY_ENTITLEMENT.key);

        // Additive only. The key has never existed on any row, so this reaches
        // every environment on the first run; after that an operator's own
        // value — including a deliberate zero — is what stays.
        const capAlreadyPresent = GALLERY_LIMIT.key in currentLimits;
        if (capAlreadyPresent) {
            capsAlreadyDeclared++;
        }

        if (!needsGrant && capAlreadyPresent) {
            continue;
        }

        const nextLimits: Record<string, number> = { ...currentLimits };
        if (!capAlreadyPresent) {
            nextLimits[GALLERY_LIMIT.key] = GALLERY_CAP_BY_PLAN_NAME[row.name] ?? 0;
        }

        await db
            .update(billingPlans)
            .set({
                ...(needsGrant
                    ? { entitlements: [...currentEntitlements, GALLERY_ENTITLEMENT.key] }
                    : {}),
                ...(capAlreadyPresent ? {} : { limits: nextLimits }),
                updatedAt: new Date()
            })
            .where(eq(billingPlans.id, row.id));

        if (needsGrant) {
            plansGranted++;
        }
        if (!capAlreadyPresent) {
            capsWritten++;
        }
    }

    // ── 3. The three packs ───────────────────────────────────────────────────
    // Column layout mirrors `ensureAddon` in `billingAddons.seed.ts` exactly —
    // `addon-catalog.mapper.ts` reads `metadata.slug` as the primary identifier,
    // so a row written differently here would be invisible to the catalogue.
    for (const addon of GALLERY_ADDONS) {
        const existing = await db
            .select({ id: billingAddons.id })
            .from(billingAddons)
            .where(eq(billingAddons.name, addon.name))
            .limit(1);

        if (existing.length > 0) {
            continue;
        }

        await db.insert(billingAddons).values({
            name: addon.name,
            description: addon.description,
            active: false,
            unitAmount: addon.priceArs,
            currency: 'ARS',
            billingInterval: 'month',
            billingIntervalCount: 1,
            entitlements: [GALLERY_ENTITLEMENT.key],
            limits: { [GALLERY_LIMIT.key]: addon.galleries },
            livemode,
            metadata: {
                slug: addon.slug,
                durationDays: null,
                targetCategories: ['owner'],
                sortOrder: addon.sortOrder
            }
        });
        addonsCreated++;
    }

    const counts = {
        limitsCreated,
        entitlementsCreated,
        plansGranted,
        capsWritten,
        capsAlreadyDeclared,
        addonsCreated
    };
    const changed =
        limitsCreated + entitlementsCreated + plansGranted + capsWritten + addonsCreated > 0;

    const summary = changed
        ? `HOS-1060: created ${limitsCreated} billing_limits and ${entitlementsCreated} billing_entitlements row(s), ` +
          `granted private galleries on ${plansGranted} plan row(s), wrote ${capsWritten} gallery cap(s) ` +
          `and created ${addonsCreated} add-on(s)` +
          (capsAlreadyDeclared > 0
              ? `; left ${capsAlreadyDeclared} cap(s) alone because the row already declared one.`
              : '.')
        : 'HOS-1060: the private-gallery catalogue is already in place — no change.';

    return { summary, counts };
}
