import {
    accounts,
    billingCustomers,
    billingPlans,
    billingSubscriptions,
    commerceListingSubscriptions,
    eq,
    gastronomies,
    gastronomyFaqs,
    gastronomyReviews,
    getDb,
    sql,
    users
} from '@repo/db';
import type { DrizzleClient } from '@repo/db';
import { LifecycleStatusEnum, RoleEnum, VisibilityEnum } from '@repo/schemas';
import { hash } from 'bcryptjs';
import exampleManifest from '../manifest-example.json';
import { STATUS_ICONS } from '../utils/icons.js';
import { loadJsonFiles } from '../utils/loadJsonFile.js';
import { logger } from '../utils/logger.js';
import type { SeedContext } from '../utils/seedContext.js';
import { summaryTracker } from '../utils/summaryTracker.js';

/**
 * Bcrypt rounds — must match apps/api/src/lib/auth.ts BCRYPT_SALT_ROUNDS.
 */
const SALT_ROUNDS = 12;

/**
 * Shared password for all dev commerce-owner accounts.
 * Dev-only convenience — these accounts never exist on staging/prod.
 */
const DEV_PW = 'Password123!';

/**
 * Spec of a COMMERCE_OWNER user to seed.
 */
interface CommerceOwnerSpec {
    readonly seedId: string;
    readonly email: string;
    readonly displayName: string;
    readonly firstName: string;
    readonly lastName: string;
    readonly slug: string;
}

/**
 * Dev COMMERCE_OWNER users for gastronomy listings.
 * Three owners covering 6 listings (2 each):
 * - Julieta: listings 001 (la-parrilla-del-puerto, CdU) + 002 (cafe-del-palacio, Colón)
 * - Rodrigo: listings 003 (cerveceria-del-rio, Gualeguaychú) + 004 (heladeria-luna, Concordia)
 * - Valentina: listings 005 (restaurant-termas, Federación) + 006 (bar-rinconcito, CdU — DRAFT/PRIVATE)
 */
const COMMERCE_OWNERS: readonly CommerceOwnerSpec[] = [
    {
        seedId: '041-user-commerce-owner-julieta',
        email: 'gastro-owner-julieta@local.test',
        displayName: 'Julieta Ferreyra',
        firstName: 'Julieta',
        lastName: 'Ferreyra',
        slug: 'julieta-ferreyra-gastro'
    },
    {
        seedId: '042-user-commerce-owner-rodrigo',
        email: 'gastro-owner-rodrigo@local.test',
        displayName: 'Rodrigo Casas',
        firstName: 'Rodrigo',
        lastName: 'Casas',
        slug: 'rodrigo-casas-gastro'
    },
    {
        seedId: '043-user-commerce-owner-valentina',
        email: 'gastro-owner-valentina@local.test',
        displayName: 'Valentina Ríos',
        firstName: 'Valentina',
        lastName: 'Ríos',
        slug: 'valentina-rios-gastro'
    }
] as const;

/**
 * Raw shape of a gastronomy listing seed JSON file.
 *
 * Field `id` is seed-only metadata excluded from the DB insert.
 * Fields `ownerId` and `destinationId` are seed IDs resolved via idMapper.
 */
interface GastronomySeedData {
    readonly id: string;
    readonly ownerId: string;
    readonly destinationId: string;
    readonly slug: string;
    readonly name: string;
    readonly summary: string;
    readonly description: string;
    readonly type: string;
    readonly priceRange?: string | null;
    readonly menuUrl?: string | null;
    readonly visibility: string;
    readonly lifecycleState: string;
    readonly moderationState: string;
    readonly isFeatured: boolean;
    readonly contactInfo?: Record<string, unknown> | null;
    readonly socialNetworks?: Record<string, unknown> | null;
    readonly openingHours?: Record<string, unknown> | null;
    readonly media?: Record<string, unknown> | null;
    readonly seo?: Record<string, unknown> | null;
    readonly reviewsCount: number;
    readonly averageRating: number;
}

/**
 * Wrapper shape of a gastronomy FAQ seed JSON file.
 * `$gastronomyId` references the listing seed id; `faqs` is the array of entries.
 */
interface GastronomyFaqFile {
    readonly $gastronomyId: string;
    readonly faqs: ReadonlyArray<{
        readonly question: string;
        readonly answer: string;
        readonly category?: string | null;
        readonly displayOrder?: number | null;
    }>;
}

/**
 * Wrapper shape of a gastronomy review seed JSON file.
 * `$gastronomyId` references the listing seed id; `reviews` is the array of entries.
 */
interface GastronomyReviewFile {
    readonly $gastronomyId: string;
    readonly reviews: ReadonlyArray<{
        readonly userId: string;
        readonly title?: string | null;
        readonly content?: string | null;
        readonly rating: Record<string, unknown>;
        readonly averageRating: number;
        readonly overallRating: number;
        readonly moderationState: string;
    }>;
}

/**
 * Ensures a `billing_customers` row exists for the given owner and returns the
 * customer id.
 */
async function ensureBillingCustomer(
    userId: string,
    email: string,
    db: DrizzleClient
): Promise<string> {
    const existing = await db
        .select({ id: billingCustomers.id })
        .from(billingCustomers)
        .where(eq(billingCustomers.externalId, userId))
        .limit(1);

    const existingRow = existing[0];
    if (existingRow) {
        return existingRow.id;
    }

    const inserted = await db
        .insert(billingCustomers)
        .values({
            email,
            externalId: userId,
            livemode: false,
            metadata: { source: 'gastronomy-example-seed' }
        })
        .returning({ id: billingCustomers.id });

    const insertedRow = inserted[0];
    if (!insertedRow) {
        throw new Error(`Insert into billing_customers returned no row for userId=${userId}`);
    }
    return insertedRow.id;
}

/**
 * Ensures a `billing_subscriptions` row (status=active) exists for the given
 * customer + commerce plan.  Returns the subscription id.
 *
 * Uses a 30-day window from seed time — period accuracy does not matter for
 * local dev; only `status = 'active'` drives visibility reconciliation.
 */
async function ensureCommerceSubscription(
    customerId: string,
    planId: string,
    db: DrizzleClient
): Promise<string> {
    const existing = await db
        .select({ id: billingSubscriptions.id })
        .from(billingSubscriptions)
        .where(eq(billingSubscriptions.customerId, customerId))
        .limit(1);

    const existingRow = existing[0];
    if (existingRow) {
        return existingRow.id;
    }

    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setDate(periodEnd.getDate() + 30);

    const inserted = await db
        .insert(billingSubscriptions)
        .values({
            customerId,
            planId,
            status: 'active',
            billingInterval: 'month',
            livemode: false,
            currentPeriodStart: now,
            currentPeriodEnd: periodEnd
        })
        .returning({ id: billingSubscriptions.id });

    const insertedRow = inserted[0];
    if (!insertedRow) {
        throw new Error(
            `Insert into billing_subscriptions returned no row for customerId=${customerId}`
        );
    }

    // Stamp product_domain='commerce' on the subscription (extras-carril column,
    // not in the qzpay-drizzle TS schema). Same pattern as the commerce checkout flow.
    await db.execute(
        sql`UPDATE billing_subscriptions SET product_domain = 'commerce' WHERE id = ${insertedRow.id}`
    );

    return insertedRow.id;
}

/**
 * Ensures a `commerce_listing_subscriptions` link row exists for the given
 * entity + subscription.  Idempotent via onConflictDoNothing on the
 * UNIQUE(entityType, entityId) index.
 *
 * This link is what makes a listing publicly visible: the public-read layer
 * checks `commerce_listing_subscriptions` status for each listing returned.
 */
async function ensureListingSubscriptionLink(
    subscriptionId: string,
    entityId: string,
    db: DrizzleClient
): Promise<void> {
    await db
        .insert(commerceListingSubscriptions)
        .values({
            subscriptionId,
            productDomain: 'commerce',
            entityType: 'gastronomy',
            entityId,
            status: 'active'
        })
        .onConflictDoNothing();
}

/**
 * Seeds the three COMMERCE_OWNER users, their billing subscriptions, the
 * gastronomy listings (via Drizzle insert), gastronomy FAQs, gastronomy
 * reviews, and the `commerce_listing_subscriptions` link rows.
 *
 * ### Ordering constraint
 * MUST run after destinations, example users, and the required `commercePlan`
 * seeds so that:
 * - `idMapper` already holds `destinations.*` and `users.*` mappings.
 * - The commerce billing plan exists in `billing_plans`.
 *
 * ### Visibility model
 * - Listings 001–005: `visibility=PUBLIC` + `lifecycleState=ACTIVE` +
 *   active `commerce_listing_subscriptions` link → publicly visible on /gastronomia.
 * - Listing 006: `visibility=PRIVATE` + `lifecycleState=DRAFT` + NO link →
 *   intentionally NOT visible; demonstrates the gating.
 *
 * ### Idempotency
 * - Gastronomy rows: idempotent via `onConflictDoNothing` on the unique `slug`.
 * - Commerce owner users: idempotent via pre-check on `email`.
 * - Billing rows: idempotent via pre-check on `externalId` / `customerId`.
 * - Subscription links: idempotent via `onConflictDoNothing` on UNIQUE(entityType, entityId).
 * - FAQ rows: idempotent via `onConflictDoNothing`.
 * - Review rows: idempotent via `onConflictDoNothing` on UNIQUE(userId, gastronomyId).
 *
 * @param context - Seed context providing the idMapper and actor
 */
export async function seedGastronomies(context: SeedContext): Promise<void> {
    const entityName = 'Gastronomies';
    context.currentEntity = entityName;

    if (!context.actor) {
        throw new Error(
            `${STATUS_ICONS.Error} Actor not available in context. Super admin must be loaded first.`
        );
    }

    const files: string[] =
        ((exampleManifest as Record<string, unknown>).gastronomies as string[]) ?? [];

    if (files.length === 0) {
        logger.warn(`${STATUS_ICONS.Warning} No gastronomy files declared in manifest — skipping.`);
        return;
    }

    logger.info(`${STATUS_ICONS.Seed} Seeding ${entityName} (${files.length} entries)...`);

    const db = getDb();
    let successCount = 0;
    let errorCount = 0;

    // ── Step 1: Resolve the commerce plan id ────────────────────────────────
    const commercePlanRows = await db
        .select({ id: billingPlans.id })
        .from(billingPlans)
        .where(eq(billingPlans.name, 'commerce-listing'))
        .limit(1);

    const commercePlanRow = commercePlanRows[0];
    if (!commercePlanRow) {
        throw new Error(
            'Commerce plan "commerce-listing" not found in billing_plans. ' +
                'Run the required seed (seedCommercePlan) before seedGastronomies.'
        );
    }
    const commercePlanId = commercePlanRow.id;

    // ── Step 2: Seed COMMERCE_OWNER users + billing customers ───────────────
    const passwordHash = await hash(DEV_PW, SALT_ROUNDS);

    for (const owner of COMMERCE_OWNERS) {
        // Idempotent: check by email before inserting
        const existingUser = await db
            .select({ id: users.id })
            .from(users)
            .where(eq(users.email, owner.email))
            .limit(1);

        let realUserId: string;

        const existingUserRow = existingUser[0];
        if (existingUserRow) {
            realUserId = existingUserRow.id;
            logger.debug(
                `  ${STATUS_ICONS.Info} COMMERCE_OWNER "${owner.displayName}" already exists — skipped`
            );
            // Heal: ensure profile_completed = true on existing rows so the
            // profile-completion middleware gate does not block the commerce area.
            await db.execute(
                sql`UPDATE users SET profile_completed = true WHERE id = ${realUserId} AND profile_completed = false`
            );
        } else {
            const insertedUsers = await db
                .insert(users)
                .values({
                    email: owner.email,
                    emailVerified: true,
                    displayName: owner.displayName,
                    firstName: owner.firstName,
                    lastName: owner.lastName,
                    slug: owner.slug,
                    role: RoleEnum.COMMERCE_OWNER as (typeof users.$inferInsert)['role'],
                    mustChangePassword: false,
                    profileCompleted: true,
                    lifecycleState:
                        LifecycleStatusEnum.ACTIVE as (typeof users.$inferInsert)['lifecycleState'],
                    visibility: VisibilityEnum.PUBLIC as (typeof users.$inferInsert)['visibility']
                })
                .returning({ id: users.id });

            const insertedUserRow = insertedUsers[0];
            if (!insertedUserRow) {
                throw new Error(`Insert into users returned no row for email=${owner.email}`);
            }
            realUserId = insertedUserRow.id;

            // Create Better Auth account row (email + password credential provider)
            await db.insert(accounts).values({
                id: crypto.randomUUID(),
                // Better Auth convention: accountId = userId for credential provider
                accountId: realUserId,
                userId: realUserId,
                providerId: 'credential',
                password: passwordHash,
                createdAt: new Date(),
                updatedAt: new Date()
            });

            logger.debug(
                `  ${STATUS_ICONS.Success} Created COMMERCE_OWNER "${owner.displayName}" (${owner.email})`
            );
        }

        // Register in idMapper so gastronomy JSON files can resolve ownerId
        context.idMapper.setMapping('users', owner.seedId, realUserId, owner.displayName);

        // Ensure billing customer row (idempotent)
        await ensureBillingCustomer(realUserId, owner.email, db);

        summaryTracker.trackSuccess('CommerceOwners');
    }

    // ── Step 3: Load and insert gastronomy listing JSON files ────────────────
    const items = (await loadJsonFiles(
        'src/data/gastronomy',
        files
    )) as unknown as GastronomySeedData[];

    for (const [index, item] of items.entries()) {
        context.currentFile = files[index] ?? '';

        try {
            // Resolve destinationId seed ID → real UUID
            const realDestinationId = context.idMapper.getMappedDestinationId(item.destinationId);
            if (!realDestinationId) {
                throw new Error(`No mapping found for destination ID: ${item.destinationId}`);
            }

            // Resolve ownerId seed ID → real UUID
            const realOwnerId = context.idMapper.getMappedUserId(item.ownerId);
            if (!realOwnerId) {
                throw new Error(`No mapping found for owner ID: ${item.ownerId}`);
            }

            const [inserted] = await db
                .insert(gastronomies)
                .values({
                    slug: item.slug,
                    name: item.name,
                    summary: item.summary,
                    description: item.description,
                    type: item.type as (typeof gastronomies.$inferInsert)['type'],
                    priceRange: (item.priceRange ??
                        null) as (typeof gastronomies.$inferInsert)['priceRange'],
                    menuUrl: item.menuUrl ?? null,
                    ownerId: realOwnerId,
                    destinationId: realDestinationId,
                    visibility: item.visibility as (typeof gastronomies.$inferInsert)['visibility'],
                    lifecycleState:
                        item.lifecycleState as (typeof gastronomies.$inferInsert)['lifecycleState'],
                    moderationState:
                        item.moderationState as (typeof gastronomies.$inferInsert)['moderationState'],
                    isFeatured: item.isFeatured,
                    contactInfo: (item.contactInfo ??
                        null) as (typeof gastronomies.$inferInsert)['contactInfo'],
                    socialNetworks: (item.socialNetworks ??
                        null) as (typeof gastronomies.$inferInsert)['socialNetworks'],
                    openingHours: (item.openingHours ??
                        null) as (typeof gastronomies.$inferInsert)['openingHours'],
                    media: (item.media ?? null) as (typeof gastronomies.$inferInsert)['media'],
                    seo: (item.seo ?? null) as (typeof gastronomies.$inferInsert)['seo'],
                    reviewsCount: item.reviewsCount,
                    averageRating: item.averageRating,
                    createdById: context.actor.id,
                    updatedById: context.actor.id
                })
                .onConflictDoNothing()
                .returning({ id: gastronomies.id });

            const realId = inserted?.id;

            if (realId) {
                // Register in idMapper so downstream (reviews, FAQs) can resolve
                context.idMapper.setMapping('gastronomies', item.id, realId, item.name);

                // ── Step 4: Subscription link (PUBLIC/ACTIVE only) ─────────────
                // Listings 001–005 (PUBLIC + ACTIVE) get a `commerce_listing_subscriptions`
                // link so the public read layer considers them visible.
                // Listing 006 (PRIVATE + DRAFT) is intentionally skipped.
                if (item.visibility === 'PUBLIC' && item.lifecycleState === 'ACTIVE') {
                    const ownerCustomerRows = await db
                        .select({ id: billingCustomers.id })
                        .from(billingCustomers)
                        .where(eq(billingCustomers.externalId, realOwnerId))
                        .limit(1);

                    const ownerCustomerRow = ownerCustomerRows[0];
                    if (ownerCustomerRow) {
                        const subscriptionId = await ensureCommerceSubscription(
                            ownerCustomerRow.id,
                            commercePlanId,
                            db
                        );
                        await ensureListingSubscriptionLink(subscriptionId, realId, db);
                    }
                }

                logger.debug(
                    `  ${STATUS_ICONS.Success} [${index + 1}/${items.length}] "${item.name}" (${item.type}) → ${item.destinationId} [${item.visibility}/${item.lifecycleState}]`
                );
            } else {
                logger.debug(
                    `  ${STATUS_ICONS.Info} [${index + 1}/${items.length}] "${item.name}" already exists — skipped (slug conflict)`
                );
            }

            summaryTracker.trackSuccess(entityName);
            successCount++;
        } catch (error) {
            errorCount++;
            const msg = error instanceof Error ? error.message : String(error);
            logger.error(
                `  ${STATUS_ICONS.Error} [${index + 1}/${items.length}] Failed to seed "${item.name}": ${msg}`
            );

            if (!context.continueOnError) {
                throw error;
            }
        }
    }

    // ── Step 5: Seed FAQs ────────────────────────────────────────────────────
    const faqFiles: string[] =
        ((exampleManifest as Record<string, unknown>).gastronomyFaqs as string[]) ?? [];
    let faqSuccessCount = 0;

    for (const faqFile of faqFiles) {
        try {
            const [faqFileData] = (await loadJsonFiles('src/data/gastronomy/faqs', [
                faqFile
            ])) as unknown as [GastronomyFaqFile];

            const realGastronomyId = context.idMapper.getRealId(
                'gastronomies',
                faqFileData.$gastronomyId
            );

            if (!realGastronomyId) {
                logger.warn(
                    `  ${STATUS_ICONS.Warning} FAQ file "${faqFile}": could not resolve gastronomy "${faqFileData.$gastronomyId}" — skipping`
                );
                continue;
            }

            for (const faq of faqFileData.faqs) {
                await db
                    .insert(gastronomyFaqs)
                    .values({
                        gastronomyId: realGastronomyId,
                        question: faq.question,
                        answer: faq.answer,
                        category: faq.category ?? null,
                        displayOrder: faq.displayOrder ?? null,
                        lifecycleState: 'ACTIVE',
                        createdById: context.actor.id,
                        updatedById: context.actor.id
                    })
                    .onConflictDoNothing();

                faqSuccessCount++;
            }
        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            logger.warn(`  ${STATUS_ICONS.Warning} Failed to seed FAQs from "${faqFile}": ${msg}`);
            if (!context.continueOnError) {
                throw error;
            }
        }
    }

    // ── Step 6: Seed Reviews ─────────────────────────────────────────────────
    const reviewFiles: string[] =
        ((exampleManifest as Record<string, unknown>).gastronomyReviews as string[]) ?? [];
    let reviewSuccessCount = 0;

    for (const reviewFile of reviewFiles) {
        try {
            const [reviewFileData] = (await loadJsonFiles('src/data/gastronomy/reviews', [
                reviewFile
            ])) as unknown as [GastronomyReviewFile];

            const realGastronomyId = context.idMapper.getRealId(
                'gastronomies',
                reviewFileData.$gastronomyId
            );

            if (!realGastronomyId) {
                logger.warn(
                    `  ${STATUS_ICONS.Warning} Review file "${reviewFile}": could not resolve gastronomy "${reviewFileData.$gastronomyId}" — skipping`
                );
                continue;
            }

            for (const review of reviewFileData.reviews) {
                const realUserId = context.idMapper.getMappedUserId(review.userId);
                if (!realUserId) {
                    logger.warn(
                        `  ${STATUS_ICONS.Warning} Review in "${reviewFile}": could not resolve user "${review.userId}" — skipping entry`
                    );
                    continue;
                }

                // onConflictDoNothing protects the UNIQUE(userId, gastronomyId) index
                await db
                    .insert(gastronomyReviews)
                    .values({
                        gastronomyId: realGastronomyId,
                        userId: realUserId,
                        title: review.title ?? null,
                        content: review.content ?? null,
                        rating: review.rating as (typeof gastronomyReviews.$inferInsert)['rating'],
                        averageRating: review.averageRating,
                        overallRating: review.overallRating,
                        lifecycleState: 'ACTIVE',
                        moderationState:
                            review.moderationState as (typeof gastronomyReviews.$inferInsert)['moderationState'],
                        createdById: context.actor.id,
                        updatedById: context.actor.id
                    })
                    .onConflictDoNothing();

                reviewSuccessCount++;
            }
        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            logger.warn(
                `  ${STATUS_ICONS.Warning} Failed to seed reviews from "${reviewFile}": ${msg}`
            );
            if (!context.continueOnError) {
                throw error;
            }
        }
    }

    logger.info(
        `${STATUS_ICONS.Success} ${entityName}: ${successCount} seeded, ${errorCount} errors. FAQs: ${faqSuccessCount}. Reviews: ${reviewSuccessCount}.`
    );
}
