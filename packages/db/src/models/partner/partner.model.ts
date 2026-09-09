import { ENTITLEMENT_GRANTING_STATUSES } from '@repo/billing';
import type { LifecycleStatusEnum, Partner, PartnerSubscriptionStatusEnum } from '@repo/schemas';
import {
    and,
    asc,
    count,
    desc,
    eq,
    exists,
    gte,
    inArray,
    isNotNull,
    isNull,
    lte,
    ne,
    not,
    or,
    sql
} from 'drizzle-orm';
import { BaseModelImpl } from '../../base/base.model.ts';
import { getDb } from '../../client.js';
import { allianceLeads } from '../../schemas/alliance/alliance_lead.dbschema.js';
import type {
    LifecycleStatusPgEnum,
    PartnerSubscriptionStatusPgEnum
} from '../../schemas/enums.dbschema.ts';
import type { SelectPartnerSubscription } from '../../schemas/partner/index.js';
import { partners } from '../../schemas/partner/partner.dbschema.js';
import { partnerSubscriptions } from '../../schemas/partner/partner_subscription.dbschema.js';
import { safeIlike } from '../../utils/drizzle-helpers.ts';

export interface SearchPartnerFilters {
    q?: string;
    type?: string;
    tier?: string;
    subscriptionStatus?: string;
    includeInactive?: boolean;
    page?: number;
    pageSize?: number;
    sort?: string;
    sortOrder?: 'asc' | 'desc';
}

export interface AdminSearchPartnerFilters extends SearchPartnerFilters {
    includeDeleted?: boolean;
}

/**
 * Partner model extending BaseModel
 * Handles all database operations for partners
 */
export class PartnerModel extends BaseModelImpl<Partner> {
    protected table = partners;
    public entityName = 'partner';

    /**
     * Grouped JSONB columns shallow-merged (PostgreSQL `||`) on update rather
     * than replaced wholesale (HOS-278 D3).
     *
     * `contactInfo` is here because the `/mi-cuenta` form models a SUBSET of
     * its keys (three of nine). Without the merge, saving a phone number would
     * replace the whole object and silently delete the emails and preference
     * enums the form never sent — the exact loss `accommodations` declared this
     * for. Clearing still works: every `ContactInfoSchema` field is
     * `.nullish()`, so "I deleted my phone" travels as an explicit `null`.
     *
     * `socialNetworks` is deliberately NOT here, and the reason is a real
     * dead-end rather than an oversight. Its schema fields are `.optional()`
     * but NOT `.nullable()`, so a cleared link cannot be expressed: `null` is
     * rejected by Zod, `''` fails the `.url()` regex, and under a merge an
     * omitted key is PRESERVED. Merging would ship a form whose "delete my
     * Instagram" button silently does nothing. Replacing wholesale makes
     * omission mean removal — which is safe here precisely because the partner
     * form models all six keys, so there is no sibling for it to lose.
     */
    protected override readonly mergeableJsonbColumns = ['contactInfo'] as const;

    protected getTableName(): string {
        return 'partners';
    }

    /**
     * Find partners by search filters (public)
     * This is a custom findAll with partner-specific filters
     */
    async findByFilters(filters: SearchPartnerFilters = {}): Promise<Partner[]> {
        const db = getDb();
        const conditions = [];

        // Only active partners by default
        if (!filters.includeInactive) {
            conditions.push(
                and(
                    eq(partners.lifecycleState, 'ACTIVE'),
                    eq(partners.subscriptionStatus, 'active')
                )
            );
        }

        // Text search on name and description.
        if (filters.q) {
            conditions.push(
                or(safeIlike(partners.name, filters.q), safeIlike(partners.description, filters.q))
            );
        }

        // Type filter
        if (filters.type) {
            conditions.push(eq(partners.type, filters.type));
        }

        // Tier filter
        if (filters.tier) {
            conditions.push(eq(partners.tier, filters.tier));
        }

        // Subscription status filter
        if (filters.subscriptionStatus) {
            conditions.push(eq(partners.subscriptionStatus, filters.subscriptionStatus));
        }

        // Soft delete filter
        conditions.push(isNull(partners.deletedAt));

        // Build query
        const query = db.select().from(partners);

        if (conditions.length > 0) {
            query.where(and(...conditions));
        }

        // Sorting: tier order (gold > silver) then startsAt.
        //
        // The `bronze` branch was dropped by HOS-294 along with the tier itself.
        // It is raw SQL, so nothing in the type system would ever have flagged
        // it — the enum could lose a value and this CASE would keep naming it
        // forever, silently dead. `ELSE 99` still catches anything unexpected.
        const sortBy = filters.sort || 'tier';
        const sortOrder = filters.sortOrder || 'desc';

        if (sortBy === 'tier') {
            query.orderBy(
                sql`CASE ${partners.tier} WHEN 'gold' THEN 0 WHEN 'silver' THEN 1 ELSE 99 END`,
                desc(partners.startsAt)
            );
        } else if (sortBy === 'startsAt') {
            query.orderBy(sortOrder === 'asc' ? asc(partners.startsAt) : desc(partners.startsAt));
        } else if (sortBy === 'name') {
            query.orderBy(sortOrder === 'asc' ? asc(partners.name) : desc(partners.name));
        } else {
            query.orderBy(desc(partners.startsAt));
        }

        // Pagination
        const page = filters.page || 1;
        const pageSize = Math.min(filters.pageSize || 20, 100);
        query.limit(pageSize).offset((page - 1) * pageSize);

        return query.execute() as Promise<Partner[]>;
    }

    /**
     * Count active partners matching the given filters.
     *
     * Uses a SQL `COUNT(*)` aggregation rather than fetching rows and counting
     * in memory.  Applies the same text-search filter on `name`/`description`
     * that {@link findByFilters} uses so the total is always consistent with
     * the paginated results returned for the same query.
     */
    async countActivePartners(
        filters: { q?: string; type?: string; tier?: string } = {}
    ): Promise<number> {
        const db = getDb();
        const conditions = [
            eq(partners.lifecycleState, 'ACTIVE'),
            eq(partners.subscriptionStatus, 'active'),
            isNull(partners.deletedAt)
        ];

        // Text search — mirrors findByFilters so counts are always consistent.
        if (filters.q) {
            const textSearch = or(
                safeIlike(partners.name, filters.q),
                safeIlike(partners.description, filters.q)
            );
            if (textSearch) {
                conditions.push(textSearch);
            }
        }

        if (filters.type) {
            conditions.push(eq(partners.type, filters.type));
        }

        if (filters.tier) {
            conditions.push(eq(partners.tier, filters.tier));
        }

        const result = await db
            .select({ count: count() })
            .from(partners)
            .where(and(...conditions));

        return result[0]?.count ?? 0;
    }

    /**
     * Find partner by slug
     */
    async findBySlug(slug: string): Promise<Partner | null> {
        return this.findOne({ slug });
    }

    /**
     * Find partner with subscription details
     */
    async findWithSubscription(
        id: string
    ): Promise<(Partner & { subscription: SelectPartnerSubscription | null }) | null> {
        const db = getDb();
        const result = await db
            .select({
                partner: partners,
                subscription: partnerSubscriptions
            })
            .from(partners)
            .leftJoin(partnerSubscriptions, eq(partners.id, partnerSubscriptions.partnerId))
            .where(and(eq(partners.id, id), isNull(partners.deletedAt)))
            .limit(1);

        if (result.length === 0) return null;

        const row = result[0];
        if (!row) return null;

        return {
            ...row.partner,
            subscription: row.subscription
        } as Partner & { subscription: SelectPartnerSubscription | null };
    }

    /**
     * Find partners expiring soon (for cron)
     */
    async findExpiringSoon(days = 7): Promise<Partner[]> {
        const db = getDb();
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() + days);

        const result = await db
            .select()
            .from(partners)
            .where(
                and(
                    eq(partners.lifecycleState, 'ACTIVE'),
                    eq(partners.subscriptionStatus, 'active'),
                    isNull(partners.deletedAt),
                    gte(partners.endsAt, new Date()),
                    lte(partners.endsAt, cutoffDate)
                )
            );

        return result as Partner[];
    }

    /**
     * Find expired partners that need status update (for cron)
     */
    async findExpired(): Promise<Partner[]> {
        const db = getDb();
        const now = new Date();

        const result = await db
            .select()
            .from(partners)
            .where(
                and(
                    eq(partners.lifecycleState, 'ACTIVE'),
                    eq(partners.subscriptionStatus, 'active'),
                    isNull(partners.deletedAt),
                    lte(partners.endsAt, now)
                )
            );

        return result as Partner[];
    }

    /**
     * Partners whose confirmed period has elapsed and for whom the system holds
     * no record of payment (HOS-1299).
     *
     * The population `partner-expiry` cannot see and `partner-unpaid-reaper`
     * deliberately excludes: somebody an admin activated with
     * `registerManualPayment` — cash, cheque, a transfer — who is therefore
     * active, has a `starts_at`, has no `ends_at` (NOTHING in the codebase
     * writes that column outside the admin form) and has no billing
     * subscription. Both crons miss them by construction, so nothing looks at
     * them again, ever.
     *
     * This query does NOT decide anything. It produces the list a human is
     * asked about. Five conditions narrow it, and each excludes a population
     * that belongs to somebody else:
     *
     * - **`content_approved_at IS NOT NULL`** — the payment gate itself. Both
     *   `registerManualPayment` and `send-link` refuse without it, so a partner
     *   who never cleared it has never been able to pay through any path and
     *   cannot be suspected of having stopped.
     *
     *   MEASURED CAVEAT about the six curated example fixtures
     *   (`packages/seed/src/data/partner/*.json`): this clause excludes them on
     *   an already-seeded environment and NOT on a fresh one, because the two
     *   paths that put them there write different rows. Seed migration 0019
     *   inserts through `PartnerModel` directly, bypassing
     *   `PartnerService._beforeCreate`, so staging and production hold them
     *   with `content_approved_at` NULL — excluded. A fresh seed runs
     *   `partners.seed.ts`, which goes through `PartnerService.create()`, and
     *   that hook stamps `contentApprovedAt` — so on a local database the six
     *   demo partners DO match, carry a 2025 `starts_at`, and are flagged on
     *   the first tick. Noisy rather than wrong (a partner with no payment
     *   record is the shape this hunts for) and it changes no state, but do not
     *   read this predicate as "the fixtures are excluded".
     * - **no link row in an entitlement-granting status** — the subscription
     *   carril already governs those, through the webhook, dunning and
     *   `finalize-cancelled-subs`. (That chain has its own gaps — HOS-1306 —
     *   but they are that issue's, and flagging here would double up on
     *   machinery that mostly works.) The status set is
     *   {@link ENTITLEMENT_GRANTING_STATUSES}, reused rather than spelled out,
     *   and the two members that are NOT about being charged are the reason
     *   this clause has to be a status test rather than a plain row test:
     *
     *   - `comp` — a permanently complimentary subscription. **HOS-1160** opens
     *     these to partners, and grants one by calling
     *     `reconcilePartnerForSubscription`, which seals `starts_at` (it must:
     *     otherwise `partner-unpaid-reaper` archives the comped partner on day
     *     90). A comped partner therefore has a sealed start date and, by
     *     design, no payments EVER. Without this clause the cron would email an
     *     admin asking whether to take down a partner the platform deliberately
     *     gave the product to — the exact false accusation this feature exists
     *     to avoid, aimed at the one partner who can never clear it.
     *   - `courtesy` — a finite run of gifted cycles (HOS-180). Same shape, same
     *     answer: no charge is expected while the window runs.
     *
     *   Reading the STATUS and not merely the row's existence also closes a real
     *   gap in the other direction: a partner whose MercadoPago subscription
     *   lapsed and who then paid cash keeps a stale `cancelled` link row, and a
     *   plain row test would hide them forever — which is the very bug this
     *   issue is about, wearing a different hat.
     *
     *   Note the split: `comp`/`courtesy` are NOT representable on
     *   `partners.subscription_status` (a four-value enum), so this exclusion
     *   cannot be read off the partner row and genuinely needs the link table.
     * - **`starts_at IS NOT NULL`** — a partner who never started is the unpaid
     *   reaper's, which reads exactly that column.
     * - **`payment_review_state IS NULL`** — already asked. This is what makes
     *   the cron idempotent: the flag is its own memory, so the admin gets one
     *   alert and not one per night.
     * - **`revoked_at IS NULL`** — an admin already dealt with them.
     *
     * The clock is `coalesce(payment_confirmed_through, starts_at)`, never
     * `ends_at`: writing a period into that column would arm `partner-expiry`,
     * which archives unattended.
     *
     * @param input - `{ confirmedThroughBefore }` (RO-RO) — the cutoff, i.e.
     *   `now` minus the review window.
     * @param limit - Batch ceiling, mirroring the other two partner crons.
     * @returns The partners an admin should be asked about.
     */
    async findDueForPaymentReview(
        input: { readonly confirmedThroughBefore: Date },
        limit = 100
    ): Promise<Partner[]> {
        const db = getDb();

        const result = await db
            .select()
            .from(partners)
            .where(
                and(
                    eq(partners.lifecycleState, 'ACTIVE'),
                    eq(partners.subscriptionStatus, 'active'),
                    isNull(partners.deletedAt),
                    isNull(partners.revokedAt),
                    isNull(partners.paymentReviewState),
                    isNotNull(partners.contentApprovedAt),
                    isNotNull(partners.startsAt),
                    lte(
                        sql`coalesce(${partners.paymentConfirmedThrough}, ${partners.startsAt})`,
                        input.confirmedThroughBefore
                    ),
                    not(
                        exists(
                            db
                                .select({ one: sql`1` })
                                .from(partnerSubscriptions)
                                .where(
                                    and(
                                        eq(partnerSubscriptions.partnerId, partners.id),
                                        // Never narrow this to `['active']`. It
                                        // would re-admit `comp` (HOS-1160) and
                                        // `courtesy` (HOS-180) — partners who
                                        // legitimately never pay — into an alert
                                        // asking an admin to take them down.
                                        inArray(partnerSubscriptions.status, [
                                            ...ENTITLEMENT_GRANTING_STATUSES
                                        ])
                                    )
                                )
                        )
                    )
                )
            )
            .limit(limit);

        return result as Partner[];
    }

    /**
     * Partners that were provisioned from an approved lead and never paid
     * (HOS-278 R-3).
     *
     * The population R-3 is about — "un partner puede cargar todo y no pagar
     * nunca" — and deliberately NOT every unpaid partner. The scope is decided
     * by `alliance_leads.provisioned_partner_id`: a partner an admin typed in
     * by hand is that admin's working state, and archiving it out from under
     * them would be the cron deciding their queue is stale. Same predicate the
     * migration-0080 backfill used to draw the same line.
     *
     * "Never paid" is `starts_at IS NULL`: that column is written only when a
     * subscription actually activates, which makes it the honest record of
     * whether money ever moved. Reading `subscription_status` instead would
     * also match a partner who paid once and lapsed — a different story, owned
     * by the dunning flow, not by this reaper.
     *
     * Already-archived and revoked rows are excluded so the cron is idempotent
     * and never re-touches a partner an admin has already dealt with.
     *
     * @param input - `{ createdBefore, noticeState }` (RO-RO).
     *   `noticeState: 'un-notified'` returns candidates for the nudge (stage
     *   one); `'any'` returns candidates for archiving (stage two), which does
     *   not care whether the notice went out — a partner who was created
     *   before the notice column existed must still be archivable.
     * @param limit - Batch ceiling, mirroring the expiry cron.
     * @returns The matching partners.
     */
    async findUnpaidProvisioned(
        input: { readonly createdBefore: Date; readonly noticeState: 'un-notified' | 'any' },
        limit = 100
    ): Promise<Partner[]> {
        const db = getDb();

        const conditions = [
            isNull(partners.startsAt),
            isNull(partners.revokedAt),
            isNull(partners.deletedAt),
            ne(partners.lifecycleState, 'ARCHIVED'),
            lte(partners.createdAt, input.createdBefore),
            exists(
                db
                    .select({ one: sql`1` })
                    .from(allianceLeads)
                    .where(eq(allianceLeads.provisionedPartnerId, partners.id))
            )
        ];

        if (input.noticeState === 'un-notified') {
            conditions.push(isNull(partners.unpaidNoticeSentAt));
        }

        const result = await db
            .select()
            .from(partners)
            .where(and(...conditions))
            .limit(limit);

        return result as Partner[];
    }

    /**
     * Update partner subscription status
     */
    async updateSubscriptionStatus(
        id: string,
        status: (typeof PartnerSubscriptionStatusPgEnum.enumValues)[number]
    ): Promise<Partner | null> {
        return this.update(
            { id },
            { subscriptionStatus: status as PartnerSubscriptionStatusEnum }
        ) as Promise<Partner | null>;
    }

    /**
     * Update partner lifecycle state
     */
    async updateLifecycleState(
        id: string,
        state: (typeof LifecycleStatusPgEnum.enumValues)[number]
    ): Promise<Partner | null> {
        return this.update(
            { id },
            { lifecycleState: state as LifecycleStatusEnum }
        ) as Promise<Partner | null>;
    }

    /**
     * Link partner to subscription (for webhook handling)
     */
    async linkSubscription(
        partnerId: string,
        subscriptionId: string
    ): Promise<SelectPartnerSubscription> {
        const db = getDb();
        const result = await db
            .insert(partnerSubscriptions)
            .values({
                subscriptionId,
                partnerId,
                status: 'active',
                productDomain: 'partner'
            })
            .onConflictDoUpdate({
                target: partnerSubscriptions.partnerId,
                set: {
                    subscriptionId,
                    status: 'active',
                    updatedAt: new Date()
                }
            })
            .returning();

        if (!result[0]) {
            throw new Error('Failed to link partner subscription');
        }
        return result[0];
    }

    /**
     * Unlink partner subscription (for cancellation)
     */
    async unlinkSubscription(partnerId: string): Promise<void> {
        const db = getDb();
        await db
            .update(partnerSubscriptions)
            .set({ status: 'cancelled', updatedAt: new Date() })
            .where(eq(partnerSubscriptions.partnerId, partnerId));
    }

    /**
     * Increment analytics (impressions/clicks)
     */
    async incrementAnalytics(
        id: string,
        field: 'impressions' | 'clicks',
        increment = 1
    ): Promise<void> {
        const partner = await this.findById(id);
        if (!partner) return;

        const currentAnalytics = partner.analytics || {};
        const currentValue = currentAnalytics[field] || 0;

        await this.update(
            { id },
            {
                analytics: {
                    ...currentAnalytics,
                    [field]: currentValue + increment
                }
            }
        );
    }
}
