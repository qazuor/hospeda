/**
 * Public plans list endpoint
 *
 * Returns active billing plans sourced from the database via PlanService.
 * Response shape is backwards-compatible with the previous ALL_PLANS-based
 * implementation (same fields: slug, name, category, prices, entitlements, limits).
 *
 * @module routes/billing/public/listPlans
 */

import { billingPlans, getDb, ne } from '@repo/db';
import {
    type AdminBillingPlanResponse,
    isPubliclyListedPlan,
    ProductDomainEnumSchema,
    type ProductDomainValue,
    ServiceErrorCode
} from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { PlanService } from '../../../services/plan.service';
import { collectCatalogPages } from '../../../utils/collect-catalog-pages';
import { apiLogger } from '../../../utils/logger';
import { createSimpleRoute } from '../../../utils/route-factory.js';
import { z } from '../../../utils/zod';

/** The domain served when `?domain=` is absent — i.e. every caller that exists today. */
const DEFAULT_DOMAIN: ProductDomainValue = 'accommodation';

/**
 * Resolve the set of plan slugs that do NOT belong to `domain`
 * (SPEC-239 T-049 isolation, parameterised by HOS-685).
 *
 * Deliberately still an *exclusion* set rather than an inclusion filter: with
 * `domain = 'accommodation'` this is the pre-HOS-685 query character for
 * character, so the default response — the only one any caller asks for today —
 * cannot drift. `productDomain` is `notNull()` with a default
 * (`0044_adorable_longshot.sql`), so no NULL is ever possible and `ne()` remains
 * exactly equivalent to the previous raw `IS DISTINCT FROM`.
 *
 * Returns `null` when the query itself fails, so the caller can pick a
 * fail-mode per domain rather than having one imposed here — see the handler.
 */
async function getPlanSlugsOutsideDomain(domain: ProductDomainValue): Promise<Set<string> | null> {
    try {
        const db = getDb();
        const rows = await db
            .select({ name: billingPlans.name })
            .from(billingPlans)
            .where(ne(billingPlans.productDomain, domain));
        return new Set(rows.map((r) => r.name));
    } catch (error) {
        apiLogger.warn(
            { error: error instanceof Error ? error.message : String(error), domain },
            'Failed to resolve out-of-domain plan slugs for public list'
        );
        return null;
    }
}

/**
 * Read and validate `?domain=`.
 *
 * `createSimpleRoute` declares no `request.query`, so this is validated in the
 * handler rather than by the factory. The consequence worth knowing: the
 * parameter does not appear in the generated OpenAPI document. Migrating the
 * route to a factory that supports query schemas would also drop
 * `assertConcretePublicSchema`, which is a worse trade for a public response.
 *
 * An unrecognised value is a 400, not an empty list: a silent empty catalogue
 * on a typo is the exact failure mode this whole vocabulary change exists to
 * stop being possible.
 */
function resolveRequestedDomain(ctx: Context): ProductDomainValue {
    const raw = ctx.req.query('domain');
    if (raw === undefined || raw === '') {
        return DEFAULT_DOMAIN;
    }

    const parsed = ProductDomainEnumSchema.safeParse(raw);
    if (!parsed.success) {
        throw new ServiceError(
            ServiceErrorCode.VALIDATION_ERROR,
            `Unknown product domain '${raw}'`
        );
    }

    return parsed.data;
}

/**
 * Public response schema for a single plan.
 *
 * Intentionally matches the previous ALL_PLANS shape so existing web client
 * code does not need changes. The `id` field is added for completeness but
 * the web client can ignore it.
 *
 * `publicListing` (HOS-1062 F1) is deliberately ABSENT: `stripWithSchema` drops
 * every key this schema does not declare, so the mark that decides what the
 * public sees never travels to the public itself. Every plan that survives the
 * filter is listed, which makes the field redundant here anyway.
 */
const PlanPublicSchema = z.object({
    id: z.string().uuid().openapi({ description: 'Plan UUID' }),
    slug: z.string().openapi({ description: 'Unique plan identifier' }),
    name: z.string().openapi({ description: 'Plan display name' }),
    description: z.string().openapi({ description: 'Plan description' }),
    category: z
        .enum(['owner', 'complex', 'tourist'])
        .openapi({ description: 'Target user category' }),
    monthlyPriceArs: z
        .number()
        .openapi({ description: 'Monthly price in ARS cents (0 for free plans)' }),
    annualPriceArs: z
        .number()
        .nullable()
        .openapi({ description: 'Annual price in ARS cents (null if no annual option)' }),
    monthlyPriceUsdRef: z
        .number()
        .openapi({ description: 'USD reference price for display purposes' }),
    hasTrial: z.boolean().openapi({ description: 'Whether this plan has a trial period' }),
    trialDays: z.number().openapi({ description: 'Trial duration in days (0 if no trial)' }),
    isDefault: z
        .boolean()
        .openapi({ description: 'Whether this is the default plan for its category' }),
    sortOrder: z.number().openapi({ description: 'Sort order for display' }),
    isActive: z
        .boolean()
        .openapi({ description: 'Whether the plan is currently available for purchase' }),
    entitlements: z
        .array(z.string())
        .openapi({ description: 'Entitlement keys included in this plan' }),
    limits: z
        .record(z.string(), z.number())
        .openapi({ description: 'Limits applied to this plan (key → value, -1 means unlimited)' }),
    createdAt: z.string().openapi({ description: 'ISO 8601 creation timestamp' }),
    updatedAt: z.string().openapi({ description: 'ISO 8601 last-update timestamp' })
});

const PlansListResponseSchema = z.array(PlanPublicSchema);

/** Singleton plan service instance */
const planService = new PlanService();

/**
 * Loads every ACTIVE plan the public may see, filtering the visibility mark
 * BEFORE any window is applied (HOS-1062).
 *
 * The bug this replaces: the handler called `planService.list({ active: true })`
 * with no `pageSize`, so it read `listPlans`' default page of TWENTY rows and
 * filtered those in memory. Harmless while the catalogue was a fixed set of six
 * — and no longer harmless as of this very spec, whose premise is one plan row
 * per negotiated agreement. Past twenty active plans the public list would start
 * dropping ordinary catalogue plans it never saw, with no error and no log line.
 * Ordering does not save it: `createPlan` never writes `metadata.sortOrder`, so
 * an admin-created plan sorts in the NULL block (last in Postgres' ASC) — until
 * the day an admin sets one.
 *
 * Same treatment `loadServableCatalog` gives the protected endpoint, through the
 * same walk (`collectCatalogPages`), so there is one implementation of "see the
 * whole catalogue, then filter" in the repo rather than two that can drift.
 *
 * @returns Every active, publicly-listed plan, or `null` if the catalogue could
 *   not be read in full — the caller then serves nothing rather than a list it
 *   cannot vouch for.
 */
async function loadPubliclyListedPlans(): Promise<AdminBillingPlanResponse[] | null> {
    const collected = await collectCatalogPages<AdminBillingPlanResponse>({
        fetchPage: async ({ pageIndex, pageSize }) => {
            const result = await planService.list({
                active: true,
                page: pageIndex + 1,
                pageSize
            });

            if (!result.success || !result.data) {
                apiLogger.error(
                    { error: result.error, page: pageIndex + 1 },
                    'Failed to load active plans from DB for public endpoint'
                );
                return null;
            }

            const { page, totalPages, total } = result.data.pagination;
            // `total` is handed over so the walk can CHECK this `hasMore`
            // against the row count instead of taking it on faith.
            return { items: result.data.items, hasMore: page < totalPages, total };
        },
        onTruncated: ({ fetched, maxPages, expected }) => {
            apiLogger.error(
                { fetched, maxPages, expected },
                'Public /plans read a short billing catalogue — the response is truncated'
            );
        }
    });

    if (collected === null) {
        return null;
    }

    // ONE exit, and it filters. `isPubliclyListedPlan` tests positively
    // (`=== 'listed'`), so a plan whose mark went missing on the way here is
    // withheld rather than served.
    return collected.filter(isPubliclyListedPlan);
}

/**
 * GET /api/v1/public/plans
 * List all active billing plans — Public endpoint.
 *
 * Source of truth is now the database (via PlanService). Previously sourced
 * from the ALL_PLANS in-memory config (SPEC-168 T-011).
 *
 * Only plans with isActive=true are returned, sorted by sortOrder ascending.
 */
export const publicListPlansRoute = createSimpleRoute({
    method: 'get',
    path: '/',
    summary: 'List billing plans',
    description:
        'Returns all active billing plans from the database. Includes pricing in ARS and USD, trial information, entitlements, and limits. Only active plans are returned. Optional `?domain=` scopes the list to one product domain (default `accommodation`); a response never mixes domains.',
    tags: ['Plans'],
    responseSchema: PlansListResponseSchema,
    handler: async (ctx: Context) => {
        const domain = resolveRequestedDomain(ctx);
        apiLogger.debug({ domain }, 'Public listing active billing plans from DB');

        // HOS-1062 F1 — the visibility mark is applied inside the loader, over
        // the WHOLE catalogue, before any window or domain logic. Every return
        // below is built from this one array.
        //
        // Filtering here rather than inside a branch is what makes the mark fail
        // CLOSED on every path the handler can take, including the domain-query
        // failure right below, which fails OPEN for `accommodation` by deliberate
        // design. That asymmetry belongs to the DOMAIN filter alone — a plan from
        // another vertical leaking for one request is a cosmetic wrong; a
        // negotiated price on the pricing page is not, and nobody files a ticket
        // to report having seen one.
        const publiclyListedPlans = await loadPubliclyListedPlans();

        if (publiclyListedPlans === null) {
            // The catalogue could not be read in full. Serve nothing rather than
            // a list we cannot vouch for; the web falls back gracefully.
            return [];
        }

        // SPEC-239 T-049 / HOS-685: scope the list to ONE product domain instead
        // of hardcoding "everything that is not accommodation". The isolation the
        // exclusion bought is now preserved by construction, and a new vertical
        // is invisible to accommodation callers without anyone remembering to
        // extend a deny-list.
        const excludedSlugs = await getPlanSlugsOutsideDomain(domain);

        if (excludedSlugs === null) {
            // The domain query failed. Accommodation keeps the pre-HOS-685
            // fail-open behaviour exactly: serve the unfiltered list rather than
            // break the public pricing page, accepting that a commerce plan may
            // briefly leak. Every other domain fails CLOSED — an empty vertical
            // catalogue is recoverable, a response that mixes domains is the one
            // outcome AC-22 forbids.
            //
            // Both arms answer from `publiclyListedPlans`: the fail-open half of
            // this asymmetry serves an UNFILTERED-BY-DOMAIN list, never an
            // unfiltered-by-visibility one.
            return domain === DEFAULT_DOMAIN ? publiclyListedPlans : [];
        }

        if (excludedSlugs.size === 0) {
            return publiclyListedPlans;
        }
        return publiclyListedPlans.filter((plan) => !excludedSlugs.has(plan.slug));
    },
    options: {
        skipAuth: true,
        cacheTTL: 3600,
        customRateLimit: { requests: 100, windowMs: 60000 }
    }
});
