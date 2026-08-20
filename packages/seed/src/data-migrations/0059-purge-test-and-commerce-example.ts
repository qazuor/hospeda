/**
 * @fileoverview
 * Data migration: 0059-purge-test-and-commerce-example
 *
 * The companion to `0058-purge-seed-example-data`, covering everything that one
 * deliberately PRESERVES plus the smoke-testing residue accumulated in
 * production between 2026-07 and 2026-08.
 *
 * HARD-DELETES:
 *
 * - The 23 **test accounts**: the four `@local.test` fixtures (the SPEC-143
 *   commerce owners plus the e2e tourist — live credentials in production,
 *   tracked as H-32 / L-1), the `qazuor+*` / `qazuor.*` smoke accounts, and the
 *   four `@hospeda.com.ar` throwaways (`newturista`, `ownertest`, `turistatest`,
 *   `alojamiento`).
 * - The **commerce example content** those accounts own: gastronomies,
 *   experiences and partners, including the `zzqa-*` rows created during smoke.
 * - The **`zzqa-*` accommodations** left over from smoke runs.
 * - **`billing_payments` rows owned by the purged accounts.** Owner decision,
 *   2026-08-20 (HOS-712): one of the 23 — `qazuor+r1host@gmail.com` — holds a
 *   `succeeded` payment of $18,000 ARS from 2026-08-14, the only `billing_payments`
 *   row across all 23 accounts. It is deleted along with the rest of that
 *   account's billing rows. The local mirror of that charge is lost; the charge
 *   itself still exists in MercadoPago, unaffected by this migration. This was
 *   deliberately NOT deleted before HOS-712 — the original version of this
 *   migration left `billing_payments` alone unconditionally and, on the account
 *   where that collided with a live `billing_subscriptions` row, aborted the
 *   whole seed-migration run instead of skipping cleanly (see "Deletion order"
 *   below).
 *
 * PRESERVES (never touched):
 *
 * - The whole operational history: `app_log_entries`, `cron_runs`,
 *   `revalidation_log`. It is the diagnostic trail, not demo data.
 * - Every curated real entity: the 26 destinations, the 52 real events, the blog
 *   posts, the 920 points of interest and the whole catalog.
 * - The eight real people who signed up, and the infrastructure accounts —
 *   `guest` above all, which every anonymous API request is built from. See
 *   {@link isProtectedInfrastructureEmail}: the check matches on the local-part
 *   precisely so a domain move cannot expose it.
 *
 * ## How the set is identified
 *
 * By **explicit literal lists** of emails and slugs, never by a `LIKE` pattern.
 * A pattern such as `qazuor%` would also match the owner's own account, and a
 * `zzqa%` pattern would match anything a future smoke run happens to name that
 * way. Every row removed here was inventoried against production on 2026-08-19.
 *
 * ## Deletion order (FK-safe — derived from the DATABASE, not from the schemas)
 *
 * The inbound foreign keys were read out of `information_schema` on the live
 * database rather than inferred from the Drizzle definitions, because the
 * database is what actually enforces them.
 *
 * Every inbound FK to `gastronomies`, `experiences` and `partners` is CASCADE
 * (the lone exception, `alliance_leads.provisioned_partner_id`, is SET NULL), so
 * those parents are deleted directly and Postgres clears their children.
 *
 * The FKs to `users` are the delicate ones. Measured against these 23 accounts,
 * only two hold rows:
 *
 *   - `accommodation_occupancy.created_by_id` — RESTRICT, NOT NULL (9 rows)
 *   - `accommodations.owner_id` — RESTRICT, NOT NULL (5 rows, the zzqa listings)
 *
 * Everything else came back zero: `owner_promotions`, `newsletter_campaigns`,
 * `sponsorships`, `accommodation_calendar_sync`, `events`, `posts`,
 * `ai_prompt_versions`, `ai_settings`, `platform_settings`. They are still
 * cleared defensively — a zero measured today is not a guarantee for the day
 * this runs.
 *
 * The four review tables deserve their own note: `user_id` is declared
 * `SET NULL` over a `NOT NULL` column, a shape that does not merely cascade
 * badly — it ERRORS on delete, because Postgres cannot write the null it was
 * told to write. They must be cleared before the users, not after.
 *
 * Order:
 *   1. Polymorphic rows with no FK at all (`entity_views`, `entity_comments`,
 *      `r_entity_tag`, `user_bookmarks`), which would otherwise orphan silently.
 *   2. `accommodation_occupancy` for the zzqa listings.
 *   3. Reviews authored by the test accounts (the NOT NULL + SET NULL trap).
 *   4. Gastronomies, experiences, partners — CASCADE clears their children.
 *   5. The zzqa accommodations.
 *   6. `billing_payments` for the customers about to be purged, deleted FIRST
 *      among the billing children — before `billing_subscriptions` — because
 *      `billing_payments.subscription_id` is `ON DELETE no action`, which
 *      blocks a subscription delete exactly as hard as `restrict` blocks a
 *      customer delete. A payment left in place here aborts the very next
 *      sub-step instead of the customer delete two steps down — same failure,
 *      one table earlier. This purge of real money is an explicit owner
 *      decision (2026-08-20, HOS-712) — see the module docstring's
 *      HARD-DELETES section for what it costs.
 *   7. The remaining RESTRICT holders on `billing_customers.id`:
 *      `billing_subscriptions`, `billing_addon_purchases`,
 *      `billing_dunning_attempts`, and `billing_invoices`. None of these four
 *      CASCADE — each one aborts the customer delete below (and every
 *      seed-migration numbered above it, per the runner's
 *      stop-at-first-failure contract) the moment a purged customer still has
 *      a live row there, which is exactly what production hits today for
 *      three gastronomy-owner accounts (HOS-712).
 *   8. Billing customers for the test accounts. The link from `billing_customers`
 *      to a user is `external_id`, an application-level string — NOT a database
 *      FK — so nothing cleans that link up on its own. (It USED to be assumed
 *      that deleting the customer cascaded its subscriptions; it does not —
 *      the FK is `restrict`, which is the whole reason steps 6 and 7 exist.)
 *   9. The 23 user rows.
 *
 * Re-running is a per-row no-op: every step deletes by a literal key set, so a
 * second pass simply matches nothing.
 *
 * @module data-migrations/0059-purge-test-and-commerce-example
 */

import {
    accommodationOccupancy,
    accommodationReviews,
    accommodations,
    billingAddonPurchases,
    billingCustomers,
    billingDunningAttempts,
    billingInvoices,
    billingPayments,
    billingSubscriptions,
    destinationReviews,
    entityComments,
    entityViews,
    experienceReviews,
    experiences,
    gastronomies,
    gastronomyReviews,
    inArray,
    partners,
    users
} from '@repo/db';
import type { PgColumn, PgTable } from 'drizzle-orm/pg-core';
import { logger } from '../utils/logger.js';
import { isProtectedInfrastructureEmail } from './purge-seed-example-data.helpers.js';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

export const meta = {
    name: '0059-purge-test-and-commerce-example',
    // 'required', not 'example': the prod gate refuses example-group migrations
    // in production unconditionally, and this purge exists to run there.
    group: 'required',
    destructive: true
} as const satisfies SeedMigrationModule['meta'];

/**
 * The test accounts to remove, listed literally.
 *
 * A `LIKE 'qazuor%'` pattern would also match the owner's own account
 * (`qazuor@gmail.com`), which owns the only public accommodation on the site.
 * Enumerating is the point, not an inconvenience.
 */
const TEST_ACCOUNT_EMAILS: readonly string[] = [
    // SPEC-143 commerce fixtures — live credentials in production (H-32 / L-1).
    'e2e-tourist@local.test',
    'gastro-owner-julieta@local.test',
    'gastro-owner-rodrigo@local.test',
    'gastro-owner-valentina@local.test',
    // Smoke accounts.
    'qazuor+alojamiento@gmail.com',
    'qazuor+ownersinplan@gmail.com',
    'qazuor+pruebaspromocode@gmail.com',
    'qazuor+r1host@gmail.com',
    'qazuor+r2gastro@gmail.com',
    'qazuor+r5prov@gmail.com',
    'qazuor+smoke164@gmail.com',
    'qazuor+smoke2@gmail.com',
    'qazuor+testlanzamiento@gmail.com',
    'qazuor+testsmoke@gmail.com',
    'qazuor+turista@gmail.com',
    'qazuor+usercomun@gmail.com',
    'qazuor+zzqa19@gmail.com',
    'qazuor.smoke164b@gmail.com',
    'qazuor.testlast@gmail.com',
    // Throwaway staff accounts.
    'alojamiento@hospeda.com.ar',
    'newturista@hospeda.com.ar',
    'ownertest@hospeda.com.ar',
    'turistatest@hospeda.com.ar'
] as const;

/** Gastronomy slugs to remove: the six seed fixtures plus three smoke rows. */
const GASTRONOMY_SLUGS: readonly string[] = [
    'bar-el-rinconcito',
    'cafe-del-palacio-colon',
    'heladeria-artesanal-luna',
    'la-cerveceria-del-rio',
    'la-parrilla-del-puerto',
    'restaurant-termas-federacion',
    'zzqa-gastro-test-borrar',
    'zzqa-parrilla-de-prueba-19-08-borrar',
    'zzqa-restaurante-de-prueba-13-08-borrar'
] as const;

/** Experience slugs to remove: the five seed fixtures plus two smoke rows. */
const EXPERIENCE_SLUGS: readonly string[] = [
    'alquiler-kayak-colon-termas',
    'excursion-rio-uruguay-concepcion',
    'guia-turistica-gualeguaychu-carnaval',
    'paseo-en-lancha-concordia-lago',
    'tour-cultural-casas-historicas-concepcion',
    'zzqa-excursion-de-prueba-19-08-borrar',
    'zzqa-experiencia-test-borrar'
] as const;

/** Partner slugs to remove: the six seed fixtures plus two smoke rows. */
const PARTNER_SLUGS: readonly string[] = [
    'autoservice-litoral',
    'fundacion-entre-rios-sustentable',
    'ong-amigos-del-rio-uruguay',
    'panaderia-la-espiga',
    'supermercado-don-jose',
    'universidad-tecnologica-del-litoral',
    'zzqa-partner-de-prueba-13-08',
    'zzqa-partner-negocio-borrar'
] as const;

/** Accommodation slugs left over from smoke runs. */
const TEST_ACCOMMODATION_SLUGS: readonly string[] = [
    'cabin-zzqa-borrador-uno-borrar',
    'cabin-zzqa-cabana-r1-borrar',
    'countryhouse-zzqa-casa-quinta-alquiler-por-diasema',
    'house-zzqa-casa-de-prueba-19-08-borrar',
    'resort-zzqa-smoke-1808-borrar'
] as const;

/**
 * Deletes every row of `table` whose `column` is in `values`, returning the
 * count. A no-op returning 0 on an empty set, so a re-run never emits a
 * `WHERE ... IN ()`.
 */
async function deleteWhereIn(params: {
    readonly db: SeedMigrationCtx['db'];
    readonly table: PgTable;
    readonly column: PgColumn;
    readonly values: readonly string[];
}): Promise<number> {
    const { db, table, column, values } = params;
    if (values.length === 0) {
        return 0;
    }
    const deleted = await db
        .delete(table)
        .where(inArray(column, [...values]))
        .returning({ deletedId: column });
    return deleted.length;
}

export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    const { db } = ctx;

    // Production-only gate, matching 0058: staging and local are development
    // environments where this data is what makes the platform demo-able, so the
    // purge is a deliberate no-op there. Returning a result still records the
    // migration in the ledger, so a later unrelated `db:seed:migrate` on staging
    // never re-triggers it. See HOS-261.
    if (process.env.NODE_ENV !== 'production') {
        return {
            summary:
                'Skipped: test-account and commerce-example purge runs in production only ' +
                '(staging/local keep the demo data).',
            counts: { skipped: 1 }
        };
    }

    // ── Step 1: resolve the test accounts, refusing infrastructure ──────────
    const candidates = await db
        .select({ id: users.id, email: users.email })
        .from(users)
        .where(inArray(users.email, [...TEST_ACCOUNT_EMAILS]));

    const testUserIds: string[] = [];
    let usersProtectedAsInfrastructure = 0;
    for (const user of candidates) {
        // Infrastructure wins over any list. `guest` reached production owning
        // seed rows and was found, on 2026-08-19, one stale domain away from
        // being deleted by 0058's allowlist. This is the same belt.
        if (user.email && isProtectedInfrastructureEmail({ email: user.email })) {
            usersProtectedAsInfrastructure += 1;
            logger.warn(
                `purge-test: ${user.email} is protected infrastructure — refusing to delete it.`
            );
            continue;
        }
        testUserIds.push(user.id);
    }

    // ── Step 2: resolve the content ids from their slugs ────────────────────
    const gastronomyRows = await db
        .select({ id: gastronomies.id })
        .from(gastronomies)
        .where(inArray(gastronomies.slug, [...GASTRONOMY_SLUGS]));
    const experienceRows = await db
        .select({ id: experiences.id })
        .from(experiences)
        .where(inArray(experiences.slug, [...EXPERIENCE_SLUGS]));
    const partnerRows = await db
        .select({ id: partners.id })
        .from(partners)
        .where(inArray(partners.slug, [...PARTNER_SLUGS]));
    const accommodationRows = await db
        .select({ id: accommodations.id })
        .from(accommodations)
        .where(inArray(accommodations.slug, [...TEST_ACCOMMODATION_SLUGS]));

    const gastronomyIds = gastronomyRows.map((row) => row.id);
    const experienceIds = experienceRows.map((row) => row.id);
    const partnerIds = partnerRows.map((row) => row.id);
    const accommodationIds = accommodationRows.map((row) => row.id);

    // Polymorphic tables key rows by a bare `entity_id` (a globally unique uuid),
    // so matching on the id alone — without the entity_type discriminator — is
    // exact and cannot collide across entity types.
    const contentIds = [...gastronomyIds, ...experienceIds, ...partnerIds, ...accommodationIds];

    // ── Step 3: polymorphic rows with no FK — they would orphan silently ────
    const entityViewsDeleted = await deleteWhereIn({
        db,
        table: entityViews,
        column: entityViews.entityId,
        values: contentIds
    });
    const entityCommentsDeleted = await deleteWhereIn({
        db,
        table: entityComments,
        column: entityComments.entityId,
        values: contentIds
    });

    // ── Step 4: the RESTRICT holders measured against these accounts ────────
    const occupancyDeleted = await deleteWhereIn({
        db,
        table: accommodationOccupancy,
        column: accommodationOccupancy.accommodationId,
        values: accommodationIds
    });

    // ── Step 5: reviews — `user_id` is SET NULL over a NOT NULL column, which
    // ERRORS on delete rather than cascading. These must go first. ──────────
    const accommodationReviewsDeleted = await deleteWhereIn({
        db,
        table: accommodationReviews,
        column: accommodationReviews.userId,
        values: testUserIds
    });
    const destinationReviewsDeleted = await deleteWhereIn({
        db,
        table: destinationReviews,
        column: destinationReviews.userId,
        values: testUserIds
    });
    const gastronomyReviewsDeleted = await deleteWhereIn({
        db,
        table: gastronomyReviews,
        column: gastronomyReviews.userId,
        values: testUserIds
    });
    const experienceReviewsDeleted = await deleteWhereIn({
        db,
        table: experienceReviews,
        column: experienceReviews.userId,
        values: testUserIds
    });

    // ── Step 6: the commerce content. Every inbound FK is CASCADE. ──────────
    const gastronomiesDeleted = await deleteWhereIn({
        db,
        table: gastronomies,
        column: gastronomies.id,
        values: gastronomyIds
    });
    const experiencesDeleted = await deleteWhereIn({
        db,
        table: experiences,
        column: experiences.id,
        values: experienceIds
    });
    const partnersDeleted = await deleteWhereIn({
        db,
        table: partners,
        column: partners.id,
        values: partnerIds
    });
    const accommodationsDeleted = await deleteWhereIn({
        db,
        table: accommodations,
        column: accommodations.id,
        values: accommodationIds
    });

    // ── Step 6/7: the RESTRICT / NO ACTION holders on `billing_customers.id`
    // (and, for `billing_payments`, on `billing_subscriptions.id` too),
    // resolved from the customers about to be purged below. `billing_customers`
    // has NO database FK up to `users` — that link is the application-level
    // `external_id` — but it DOES have several inbound FKs from its own
    // billing children, and five of them block a delete somewhere in this
    // chain: `billing_payments`, `billing_subscriptions`,
    // `billing_addon_purchases`, `billing_dunning_attempts`, and
    // `billing_invoices`. Deleting `billing_customers` first — as this
    // migration originally did, on the false assumption that the delete
    // cascaded — aborts the whole seed-migration run (HOS-25 G-5: no partial
    // runs, first failure stops everything numbered after it) the moment a
    // purged customer still has a live row in any of them. Measured against
    // production on 2026-08-20, three gastronomy-owner accounts hit this via
    // `billing_subscriptions` (HOS-712).
    //
    // `billing_payments` goes FIRST, ahead of `billing_subscriptions`:
    // `billing_payments.subscription_id` is `ON DELETE no action`, which
    // Postgres enforces exactly like `restrict` — a payment still pointing at
    // a subscription blocks that subscription's delete just as hard as an
    // unresolved subscription blocks the customer's delete. Also measured
    // against production on 2026-08-20: `qazuor+r1host@gmail.com` — one of
    // the 23 purged accounts — holds a `succeeded` $18,000 ARS payment hanging
    // off one of its subscriptions (HOS-712). Purging it is an explicit owner
    // decision, not an oversight: see the module docstring's HARD-DELETES
    // section for what that costs.
    const billingCustomerRows = await db
        .select({ id: billingCustomers.id })
        .from(billingCustomers)
        .where(inArray(billingCustomers.externalId, testUserIds));
    const billingCustomerIds = billingCustomerRows.map((row) => row.id);

    const billingPaymentsDeleted = await deleteWhereIn({
        db,
        table: billingPayments,
        column: billingPayments.customerId,
        values: billingCustomerIds
    });
    const billingSubscriptionsDeleted = await deleteWhereIn({
        db,
        table: billingSubscriptions,
        column: billingSubscriptions.customerId,
        values: billingCustomerIds
    });
    const billingAddonPurchasesDeleted = await deleteWhereIn({
        db,
        table: billingAddonPurchases,
        column: billingAddonPurchases.customerId,
        values: billingCustomerIds
    });
    const billingDunningAttemptsDeleted = await deleteWhereIn({
        db,
        table: billingDunningAttempts,
        column: billingDunningAttempts.customerId,
        values: billingCustomerIds
    });
    const billingInvoicesDeleted = await deleteWhereIn({
        db,
        table: billingInvoices,
        column: billingInvoices.customerId,
        values: billingCustomerIds
    });

    // ── Step 8: billing customers for the test accounts. The customer→user
    // link is `external_id`, an application-level string and NOT a database
    // FK, so nothing cleans that link up on its own — but the RESTRICT/NO
    // ACTION children cleared in steps 6-7 DO need to be gone first, or this
    // delete aborts on the FK. `billing_payments` is no longer an exception:
    // it is purged along with the rest (see steps 6-7's comment and the
    // module docstring's HARD-DELETES section).
    const billingCustomersDeleted = await deleteWhereIn({
        db,
        table: billingCustomers,
        column: billingCustomers.externalId,
        values: testUserIds
    });

    // ── Step 9: the accounts themselves ─────────────────────────────────────
    const usersDeleted = await deleteWhereIn({
        db,
        table: users,
        column: users.id,
        values: testUserIds
    });

    const counts = {
        usersResolved: candidates.length,
        usersDeleted,
        usersProtectedAsInfrastructure,
        gastronomiesDeleted,
        experiencesDeleted,
        partnersDeleted,
        accommodationsDeleted,
        billingPaymentsDeleted,
        billingSubscriptionsDeleted,
        billingAddonPurchasesDeleted,
        billingDunningAttemptsDeleted,
        billingInvoicesDeleted,
        billingCustomersDeleted,
        occupancyDeleted,
        entityViewsDeleted,
        entityCommentsDeleted,
        accommodationReviewsDeleted,
        destinationReviewsDeleted,
        gastronomyReviewsDeleted,
        experienceReviewsDeleted
    };

    return {
        summary:
            `Purged test data: ${usersDeleted} accounts, ${gastronomiesDeleted} gastronomies, ` +
            `${experiencesDeleted} experiences, ${partnersDeleted} partners, ` +
            `${accommodationsDeleted} accommodations, ${billingCustomersDeleted} billing customers ` +
            `(${usersProtectedAsInfrastructure} protected as infrastructure).`,
        counts
    };
}
