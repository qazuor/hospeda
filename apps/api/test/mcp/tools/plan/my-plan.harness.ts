/**
 * Shared world for the `get_my_plan` suites (HOS-2328): the readers behind
 * `readMyPlan` as mocks, and an effective set resolved by the REAL
 * `readEffectiveSet` over an in-test catalog, so a catalog edit reaches
 * `includes` exactly as it would in production (AC-C14).
 *
 * The suites mock these modules with the `mocks` below:
 * - `@repo/service-core` → `readOwnPlanState`;
 * - `services/billing-addon/owner-recurring-addons.service` → `readOwnerAddonHoldings`;
 * - `services/listing-notices/listing-notices.service` → `readTrialSummary`, `readOwnTrialPlan`;
 * - `services/plan-catalog/plan-of-version.service` → `readPlanOfVersion`;
 * - `routes/plan-catalog/public/read-sellable-catalog` → `readSellablePlanCatalog`
 *   (HOS-2398, the trial's Tourist VIP line);
 * - `utils/listing-access/ports` → `getListingAccessPorts().effectiveSet` and
 *   `getListingAccessPorts().billing.coverage` ({@link coverageOf}).
 *
 * @module test/mcp/tools/plan/my-plan.harness
 */

import { CoverageSourceSchema } from '@repo/billing-verticals-contract';
import { getCatalogKey, PermissionEnum, TrialStatusEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { readEffectiveSet } from '@repo/verticals';
import { vi } from 'vitest';

export const OWNER_ID = '11111111-1111-4111-8111-111111111111';
export const NOW = new Date('2026-11-18T12:00:00.000Z');
export const SITE = 'http://localhost:4321';
export const ACCOMMODATION_VERSION = '22222222-2222-4222-8222-222222222222';
export const VENUE_TRIAL_VERSION = '33333333-3333-4333-8333-333333333333';
/** The sellable tourist VIP version the inheritance resolves to (HOS-2398). */
export const TOURIST_VIP_VERSION = '66666666-6666-4666-8666-666666666666';
export const context = { channel: 'mcp' } as const;

export const mocks = {
    readOwnPlanState: vi.fn(),
    readOwnerAddonHoldings: vi.fn(),
    readTrialSummary: vi.fn(),
    readOwnTrialPlan: vi.fn(),
    readPlanOfVersion: vi.fn(),
    readSellablePlanCatalog: vi.fn(),
    effectiveSet: vi.fn(),
    coverage: vi.fn(),
    coverageInputs: [] as unknown[]
};

/** An owner actor; `billing` false drops `BILLING_VIEW_OWN`. */
export function ownerActor({ billing = true }: { readonly billing?: boolean } = {}): Actor {
    return {
        id: OWNER_ID,
        roles: ['HOST'],
        permissions: billing
            ? [PermissionEnum.BILLING_VIEW_OWN, PermissionEnum.CONVERSATION_VIEW_OWN]
            : [PermissionEnum.CONVERSATION_VIEW_OWN],
        emailVerified: true
    } as unknown as Actor;
}

/** One stored catalog version: what its rows grant. */
interface CatalogVersion {
    entitlements: { key: string; planQuota: number | null }[];
    limits: { key: string; value: number }[];
    /** `plan_version.inherits_tourist_vip`; absent means it does not (HOS-2398). */
    inheritsTouristVip?: boolean;
}

/** The in-test catalog. Tests edit it in place, like an admin edits catalog rows. */
export const catalog = new Map<string, CatalogVersion>();

function strategyOf(key: string) {
    const definition = getCatalogKey({ key });
    if (!definition) throw new Error(`Unknown catalog key: ${key}`);
    return definition.aggregationStrategy;
}

const catalogReader = {
    async findPlanVersion({ id }: { readonly id: string }) {
        const version = catalog.get(id);
        return version
            ? ({ id, inheritsTouristVip: version.inheritsTouristVip === true } as never)
            : null;
    },
    /** The tourist VIP version is the only sellable current tourist version, when it is in the catalog. */
    async findSellableCurrentVersions({ vertical }: { readonly vertical: string }) {
        return vertical === 'tourist' && catalog.has(TOURIST_VIP_VERSION)
            ? [
                  {
                      id: TOURIST_VIP_VERSION,
                      planId: `plan-${TOURIST_VIP_VERSION}`,
                      vertical: 'tourist',
                      rank: 2,
                      sellable: true,
                      current: true
                  }
              ]
            : [];
    },
    async findPlanVersionSummary({ id }: { readonly id: string }) {
        return catalog.has(id)
            ? {
                  id,
                  planId: `plan-${id}`,
                  vertical: 'accommodation',
                  rank: 1,
                  sellable: true,
                  current: true
              }
            : null;
    },
    /** Each in-test version is the current one of its own plan (`plan-<id>`), as the grant ratchet asks. */
    async findCurrentPlanVersion({ planId }: { readonly planId: string }) {
        return catalogReader.findPlanVersionSummary({ id: planId.replace(/^plan-/, '') });
    },
    async findPlanVersionEffects({ id }: { readonly id: string }) {
        const version = catalog.get(id);
        return {
            entitlements: (version?.entitlements ?? []).map((row) => ({
                ...row,
                trialQuota: null,
                aggregationStrategy: strategyOf(row.key)
            })),
            limits: (version?.limits ?? []).map((row) => ({
                ...row,
                aggregationStrategy: strategyOf(row.key)
            }))
        };
    },
    async findAddonVersion() {
        return null;
    }
};

/** The source billing reports per vertical: a subscription or the base plan, by version. */
export const coverageByVertical = new Map<string, string>();

/** Extra billing sources per vertical (a courtesy, a permanent grant), beside {@link coverageByVertical}. */
export const extraSources = new Map<string, unknown[]>();

/** A courtesy source on a plan version, ending at `until`. */
export function courtesySource(planVersionId: string, until: Date) {
    return CoverageSourceSchema.parse({
        type: 'COURTESY',
        reference: { kind: 'PLAN_VERSION', planVersionId },
        scope: 'VERTICAL',
        target: null,
        since: new Date('2026-11-01T00:00:00.000Z'),
        until,
        charged: null,
        floor: null
    });
}

/** A permanent-grant source anchored on a plan version (it never expires). */
export function grantSource(planVersionId: string) {
    return CoverageSourceSchema.parse({
        type: 'GRANT',
        reference: { kind: 'PLAN_VERSION', planVersionId },
        scope: 'VERTICAL',
        target: null,
        since: new Date('2026-11-01T00:00:00.000Z'),
        until: 'NEVER_EXPIRES',
        charged: null,
        floor: planVersionId
    });
}

/** Billing's `coverage(user, vertical)` over the in-test world: one answer for the reader and the effective set. */
export async function coverageOf({ vertical }: { readonly vertical: string }) {
    const versionId = coverageByVertical.get(vertical);
    const sources = [
        ...(versionId
            ? [
                  CoverageSourceSchema.parse({
                      type: 'SUBSCRIPTION',
                      reference: { kind: 'PLAN_VERSION', planVersionId: versionId },
                      scope: 'VERTICAL',
                      target: null,
                      since: new Date('2026-10-01T00:00:00.000Z'),
                      until: new Date('2026-12-31T00:00:00.000Z'),
                      charged: true,
                      floor: null
                  })
              ]
            : []),
        ...(extraSources.get(vertical) ?? [])
    ];
    return { covered: sources.length > 0, sources } as never;
}

/** Resolves the effective set with the real resolver over {@link catalog}. */
export function realEffectiveSet({ userId, vertical }: { userId: string; vertical: string }) {
    return readEffectiveSet({
        reader: catalogReader as never,
        // The asked vertical, not the outer one: the Tourist VIP inheritance
        // asks billing about every other vertical (HOS-2398).
        billing: { coverage: (args: { readonly vertical: string }) => coverageOf(args) },
        trials: { findTrial: async () => null },
        userId,
        vertical: vertical as never,
        cache: { readThrough: ({ load }) => load() }
    });
}

/** A live principal subscription row, as `readOwnSubscriptions` returns it. */
export function subscriptionRow(overrides: Record<string, unknown> = {}) {
    return {
        id: '44444444-4444-4444-8444-444444444444',
        predecessorId: null,
        vertical: 'accommodation',
        status: 'ACTIVE',
        paymentMethod: 'CARD',
        serviceEndsAt: null,
        graceEndsAt: null,
        createdAt: new Date('2026-10-01T10:00:00.000Z'),
        planVersionId: ACCOMMODATION_VERSION,
        plan: {
            slug: 'owner-basico',
            name: 'Catalog basic',
            amount: 1,
            currency: 'ARS',
            cycle: 'monthly'
        },
        nextCharge: { at: new Date('2026-12-01T10:00:00.000Z'), amount: 1, currency: 'ARS' },
        paidAfterCancellation: null,
        pause: null,
        promo: null,
        liveCourtesyMonths: 0,
        scheduledChange: null,
        succession: null,
        ...overrides
    };
}

/** The world of AC-C13: an active accommodation subscription and a venue trial. */
export function arrangeSubscriptionAndTrial(): void {
    catalog.set(ACCOMMODATION_VERSION, {
        entitlements: [
            { key: 'view_basic_stats', planQuota: null },
            { key: 'respond_reviews', planQuota: null }
        ],
        limits: [{ key: 'max_photos_per_accommodation', value: 15 }]
    });
    catalog.set(VENUE_TRIAL_VERSION, {
        entitlements: [{ key: 'manage_venue_menu', planQuota: null }],
        limits: []
    });
    coverageByVertical.set('accommodation', ACCOMMODATION_VERSION);
    coverageByVertical.set('venue', VENUE_TRIAL_VERSION);
    mocks.readOwnPlanState.mockResolvedValue({
        subscriptions: [subscriptionRow()],
        deferredCourtesies: []
    });
    mocks.readTrialSummary.mockImplementation(async ({ vertical }: { vertical: string }) =>
        vertical === 'venue'
            ? {
                  status: TrialStatusEnum.TRIAL_ACTIVE,
                  startedAt: '2026-11-11T12:00:00.000Z',
                  endsAt: '2026-11-25T12:00:00.000Z',
                  totalDays: 14,
                  origins: { base: 14, promo: 0, support: 0 }
              }
            : { status: 'NONE' }
    );
    mocks.readOwnTrialPlan.mockResolvedValue({
        slug: 'venue-basico',
        name: 'Catalog venue trial',
        planVersionId: VENUE_TRIAL_VERSION
    });
}

/** Resets the world to an owner with nothing. */
export function resetWorld(): void {
    catalog.clear();
    coverageByVertical.clear();
    extraSources.clear();
    mocks.readOwnPlanState.mockReset().mockResolvedValue({
        subscriptions: [],
        deferredCourtesies: []
    });
    mocks.readOwnerAddonHoldings.mockReset().mockResolvedValue([]);
    mocks.readTrialSummary.mockReset().mockResolvedValue({ status: 'NONE' });
    mocks.readOwnTrialPlan.mockReset().mockResolvedValue(null);
    mocks.readPlanOfVersion.mockReset().mockResolvedValue(null);
    // The sellable catalog sells plans that do not inherit Tourist VIP (HOS-2398).
    mocks.readSellablePlanCatalog
        .mockReset()
        .mockResolvedValue({ plans: [{ inheritsTouristVip: false }] });
    mocks.effectiveSet.mockReset().mockImplementation(realEffectiveSet);
    mocks.coverage.mockReset().mockImplementation(coverageOf);
}
