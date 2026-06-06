/**
 * Unit tests for computeDowngradeExcess (SPEC-167 T-005 / T-006).
 *
 * Red-first TDD: this file is written BEFORE the implementation exists. All
 * tests import from the sibling module `subscription-downgrade-excess.service`
 * which does not exist yet — so the suite is expected to FAIL at import time
 * until T-006 implements the module.
 *
 * Coverage:
 * - under-cap: all dimensions zero — empty diff, no items.
 * - exactly-at-cap: equals target limit → no excess.
 * - over-cap (accommodations): excess items computed, default keep applied,
 *   ordering by updatedAt desc (most-recently-updated first), viewCount as
 *   tiebreaker when non-null.
 * - over-cap (promotions): same shape as accommodations excess.
 * - unlimited target (limit value -1): no excess for that dimension.
 * - already-restricted excluded: planRestricted=true items excluded from active
 *   counts so the helper is idempotent (T-011 foundation).
 * - photo excess per accommodation: featured counts toward cap, always kept;
 *   gallery items beyond cap are overflow.
 * - photo exactly-at-cap: no overflow.
 * - photo featured-only accommodation (no gallery): no excess even if cap=1.
 * - grandfather flags: rich description detected, video URL detected.
 * - grandfather flags: target plan has rich/video entitlements → no flags.
 * - grandfather flags: no rich/video content → empty flags.
 * - mixed multi-dimension: accommodations + promotions + photos + grandfather.
 * - hasExcess convenience flag follows quantity excess, NOT grandfather.
 *
 * No HTTP context needed: the helper is framework-agnostic.
 * All DB dependencies are mocked via vi.mock().
 *
 * @module test/services/subscription-downgrade-excess.service
 */

import { EntitlementKey, LimitKey } from '@repo/billing';
import { type MockedFunction, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    type ComputeDowngradeExcessDeps,
    computeDowngradeExcess
} from '../../src/services/subscription-downgrade-excess.service';

// ---------------------------------------------------------------------------
// vi.mock declarations (hoisted — must be at top level, no factory closures)
// ---------------------------------------------------------------------------

vi.mock('@repo/billing', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/billing')>();
    return {
        ...actual
        // getPlanBySlug will be replaced per-test via vi.mocked()
    };
});

vi.mock('@repo/db', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/db')>();
    return {
        ...actual
        // accommodationModel and ownerPromotionModel will be mocked via deps injection
    };
});

// ---------------------------------------------------------------------------
// Test fixtures & helpers
// ---------------------------------------------------------------------------

const USER_ID = 'user-host-001';

// Plan limit helpers
type PlanShape = {
    entitlements: EntitlementKey[];
    limits: Array<{ key: LimitKey; value: number; name: string; description: string }>;
};

function makePlan(
    overrides: Partial<{
        maxAccommodations: number;
        maxPhotosPerAccommodation: number;
        maxActivePromotions: number;
        hasRichDescription: boolean;
        hasVideoEmbed: boolean;
    }> = {}
): PlanShape {
    const {
        maxAccommodations = 1,
        maxPhotosPerAccommodation = 5,
        maxActivePromotions = 0,
        hasRichDescription = false,
        hasVideoEmbed = false
    } = overrides;

    const limits: PlanShape['limits'] = [
        {
            key: LimitKey.MAX_ACCOMMODATIONS,
            value: maxAccommodations,
            name: 'Max Accommodations',
            description: ''
        },
        {
            key: LimitKey.MAX_PHOTOS_PER_ACCOMMODATION,
            value: maxPhotosPerAccommodation,
            name: 'Photos per Accommodation',
            description: ''
        },
        {
            key: LimitKey.MAX_ACTIVE_PROMOTIONS,
            value: maxActivePromotions,
            name: 'Max Active Promotions',
            description: ''
        }
    ];

    const entitlements: EntitlementKey[] = [];
    if (hasRichDescription) entitlements.push(EntitlementKey.CAN_USE_RICH_DESCRIPTION);
    if (hasVideoEmbed) entitlements.push(EntitlementKey.CAN_EMBED_VIDEO);

    return { limits, entitlements };
}

// Minimal accommodation fixture for excess computation
type AccommodationRow = {
    id: string;
    name: string;
    updatedAt: Date;
    planRestricted: boolean;
    description: string;
    media?: {
        featuredImage?: { url: string } | null;
        gallery?: Array<{ url: string }>;
    } | null;
};

function makeAccommodation(
    overrides: Partial<AccommodationRow> & { id: string }
): AccommodationRow {
    return {
        id: overrides.id,
        name: overrides.name ?? `Accommodation ${overrides.id}`,
        updatedAt: overrides.updatedAt ?? new Date('2026-01-01T00:00:00.000Z'),
        planRestricted: overrides.planRestricted ?? false,
        description: overrides.description ?? 'Plain text description.',
        media: overrides.media ?? { gallery: [] }
    };
}

// Minimal promotion fixture
type PromotionRow = {
    id: string;
    title: string;
    updatedAt: Date;
    lifecycleState: string;
    planRestricted: boolean;
};

function makePromotion(overrides: Partial<PromotionRow> & { id: string }): PromotionRow {
    return {
        id: overrides.id,
        title: overrides.title ?? `Promotion ${overrides.id}`,
        updatedAt: overrides.updatedAt ?? new Date('2026-01-01T00:00:00.000Z'),
        lifecycleState: overrides.lifecycleState ?? 'ACTIVE',
        planRestricted: overrides.planRestricted ?? false
    };
}

// ---------------------------------------------------------------------------
// Dependency injection (deps) mock factory
// ---------------------------------------------------------------------------

type MockDeps = {
    getActiveAccommodationsForOwner: MockedFunction<
        ComputeDowngradeExcessDeps['getActiveAccommodationsForOwner']
    >;
    getActivePromotionsForOwner: MockedFunction<
        ComputeDowngradeExcessDeps['getActivePromotionsForOwner']
    >;
    getPlanBySlug: MockedFunction<ComputeDowngradeExcessDeps['getPlanBySlug']>;
};

function createDeps(overrides: Partial<MockDeps> = {}): ComputeDowngradeExcessDeps {
    return {
        getActiveAccommodationsForOwner:
            overrides.getActiveAccommodationsForOwner ?? vi.fn().mockResolvedValue([]),
        getActivePromotionsForOwner:
            overrides.getActivePromotionsForOwner ?? vi.fn().mockResolvedValue([]),
        getPlanBySlug: overrides.getPlanBySlug ?? vi.fn().mockReturnValue(makePlan())
    } as ComputeDowngradeExcessDeps;
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('computeDowngradeExcess', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    // ── Under-cap / empty diff ─────────────────────────────────────────────

    it('returns empty diff when host has no accommodations and target cap=1', async () => {
        const deps = createDeps();
        const result = await computeDowngradeExcess(
            { userId: USER_ID, targetPlanSlug: 'owner-basico' },
            deps
        );

        expect(result.accommodations.activeCount).toBe(0);
        expect(result.accommodations.excessCount).toBe(0);
        expect(result.accommodations.items).toHaveLength(0);
        expect(result.promotions.activeCount).toBe(0);
        expect(result.promotions.excessCount).toBe(0);
        expect(result.photos).toHaveLength(0);
        expect(result.grandfatherFlags).toHaveLength(0);
        expect(result.hasExcess).toBe(false);
    });

    it('returns empty diff when host is exactly at the accommodation cap', async () => {
        const deps = createDeps({
            getActiveAccommodationsForOwner: vi
                .fn()
                .mockResolvedValue([makeAccommodation({ id: 'acc-1' })]),
            getPlanBySlug: vi.fn().mockReturnValue(makePlan({ maxAccommodations: 1 }))
        });

        const result = await computeDowngradeExcess(
            { userId: USER_ID, targetPlanSlug: 'owner-basico' },
            deps
        );

        expect(result.accommodations.cap).toBe(1);
        expect(result.accommodations.activeCount).toBe(1);
        expect(result.accommodations.excessCount).toBe(0);
        expect(result.accommodations.items).toHaveLength(0);
        expect(result.hasExcess).toBe(false);
    });

    // ── Over-cap (accommodations) ──────────────────────────────────────────

    it('computes accommodation excess with correct count and items when over cap', async () => {
        const acc1 = makeAccommodation({
            id: 'acc-1',
            updatedAt: new Date('2026-06-01T00:00:00.000Z') // newest
        });
        const acc2 = makeAccommodation({
            id: 'acc-2',
            updatedAt: new Date('2026-05-01T00:00:00.000Z') // oldest
        });
        const acc3 = makeAccommodation({
            id: 'acc-3',
            updatedAt: new Date('2026-05-15T00:00:00.000Z') // middle
        });

        const deps = createDeps({
            getActiveAccommodationsForOwner: vi.fn().mockResolvedValue([acc1, acc2, acc3]),
            getPlanBySlug: vi.fn().mockReturnValue(makePlan({ maxAccommodations: 1 }))
        });

        const result = await computeDowngradeExcess(
            { userId: USER_ID, targetPlanSlug: 'owner-basico' },
            deps
        );

        expect(result.accommodations.cap).toBe(1);
        expect(result.accommodations.activeCount).toBe(3);
        expect(result.accommodations.excessCount).toBe(2);
        expect(result.accommodations.items).toHaveLength(3);

        // Default keep: most-recently-updated first
        const first = result.accommodations.items[0]!;
        const second = result.accommodations.items[1]!;
        const third = result.accommodations.items[2]!;
        expect(first.id).toBe('acc-1'); // newest updatedAt
        expect(first.keepByDefault).toBe(true);
        expect(second.id).toBe('acc-3'); // middle
        expect(second.keepByDefault).toBe(false);
        expect(third.id).toBe('acc-2'); // oldest
        expect(third.keepByDefault).toBe(false);

        expect(result.hasExcess).toBe(true);
    });

    it('keeps exactly cap items with keepByDefault=true when cap=2 and 4 active', async () => {
        const accs = [
            makeAccommodation({ id: 'a4', updatedAt: new Date('2026-04-01T00:00:00.000Z') }),
            makeAccommodation({ id: 'a1', updatedAt: new Date('2026-06-01T00:00:00.000Z') }),
            makeAccommodation({ id: 'a3', updatedAt: new Date('2026-05-01T00:00:00.000Z') }),
            makeAccommodation({ id: 'a2', updatedAt: new Date('2026-05-15T00:00:00.000Z') })
        ];

        const deps = createDeps({
            getActiveAccommodationsForOwner: vi.fn().mockResolvedValue(accs),
            getPlanBySlug: vi.fn().mockReturnValue(makePlan({ maxAccommodations: 2 }))
        });

        const result = await computeDowngradeExcess(
            { userId: USER_ID, targetPlanSlug: 'owner-pro' },
            deps
        );

        expect(result.accommodations.excessCount).toBe(2);
        const kept = result.accommodations.items.filter((i) => i.keepByDefault);
        const excess = result.accommodations.items.filter((i) => !i.keepByDefault);
        expect(kept).toHaveLength(2);
        expect(excess).toHaveLength(2);

        // Kept = two most-recently-updated
        expect(kept[0]!.id).toBe('a1');
        expect(kept[1]!.id).toBe('a2');
    });

    it('uses viewCount as tiebreaker when updatedAt values are identical', async () => {
        const sameTime = new Date('2026-06-01T00:00:00.000Z');
        const accA = { ...makeAccommodation({ id: 'acc-a', updatedAt: sameTime }), viewCount: 100 };
        const accB = { ...makeAccommodation({ id: 'acc-b', updatedAt: sameTime }), viewCount: 50 };

        const deps = createDeps({
            getActiveAccommodationsForOwner: vi.fn().mockResolvedValue([accB, accA]),
            getPlanBySlug: vi.fn().mockReturnValue(makePlan({ maxAccommodations: 1 }))
        });

        const result = await computeDowngradeExcess(
            { userId: USER_ID, targetPlanSlug: 'owner-basico' },
            deps
        );

        // acc-a (100 views) should sort before acc-b (50 views) when updatedAt ties
        expect(result.accommodations.items[0]!.id).toBe('acc-a');
        expect(result.accommodations.items[0]!.keepByDefault).toBe(true);
        expect(result.accommodations.items[1]!.id).toBe('acc-b');
        expect(result.accommodations.items[1]!.keepByDefault).toBe(false);
    });

    // ── Unlimited target ───────────────────────────────────────────────────

    it('produces no accommodation excess when target plan limit is -1 (unlimited)', async () => {
        const deps = createDeps({
            getActiveAccommodationsForOwner: vi
                .fn()
                .mockResolvedValue([
                    makeAccommodation({ id: 'a1' }),
                    makeAccommodation({ id: 'a2' }),
                    makeAccommodation({ id: 'a3' })
                ]),
            getPlanBySlug: vi.fn().mockReturnValue(makePlan({ maxAccommodations: -1 }))
        });

        const result = await computeDowngradeExcess(
            { userId: USER_ID, targetPlanSlug: 'owner-premium' },
            deps
        );

        expect(result.accommodations.excessCount).toBe(0);
        expect(result.accommodations.items).toHaveLength(0);
        expect(result.hasExcess).toBe(false);
    });

    it('produces no promotion excess when target plan promotion limit is -1', async () => {
        const deps = createDeps({
            getActivePromotionsForOwner: vi
                .fn()
                .mockResolvedValue([
                    makePromotion({ id: 'p1' }),
                    makePromotion({ id: 'p2' }),
                    makePromotion({ id: 'p3' })
                ]),
            getPlanBySlug: vi.fn().mockReturnValue(makePlan({ maxActivePromotions: -1 }))
        });

        const result = await computeDowngradeExcess(
            { userId: USER_ID, targetPlanSlug: 'owner-premium' },
            deps
        );

        expect(result.promotions.excessCount).toBe(0);
        expect(result.promotions.items).toHaveLength(0);
        expect(result.hasExcess).toBe(false);
    });

    // ── Already-restricted exclusion ──────────────────────────────────────

    it('excludes planRestricted=true accommodations from active count (idempotency)', async () => {
        const active = makeAccommodation({ id: 'acc-active', planRestricted: false });
        const restricted = makeAccommodation({ id: 'acc-restricted', planRestricted: true });

        const deps = createDeps({
            // The mock returns both; the service MUST filter out planRestricted=true
            getActiveAccommodationsForOwner: vi.fn().mockResolvedValue([active, restricted]),
            getPlanBySlug: vi.fn().mockReturnValue(makePlan({ maxAccommodations: 1 }))
        });

        const result = await computeDowngradeExcess(
            { userId: USER_ID, targetPlanSlug: 'owner-basico' },
            deps
        );

        // Only 1 non-restricted active accommodation → at cap → no excess
        expect(result.accommodations.activeCount).toBe(1);
        expect(result.accommodations.excessCount).toBe(0);
    });

    it('excludes planRestricted=true promotions from active count', async () => {
        const activePromo = makePromotion({ id: 'p1', planRestricted: false });
        const restrictedPromo = makePromotion({ id: 'p2', planRestricted: true });

        const deps = createDeps({
            getActivePromotionsForOwner: vi.fn().mockResolvedValue([activePromo, restrictedPromo]),
            getPlanBySlug: vi.fn().mockReturnValue(makePlan({ maxActivePromotions: 1 }))
        });

        const result = await computeDowngradeExcess(
            { userId: USER_ID, targetPlanSlug: 'owner-pro' },
            deps
        );

        expect(result.promotions.activeCount).toBe(1);
        expect(result.promotions.excessCount).toBe(0);
    });

    // ── Over-cap (promotions) ──────────────────────────────────────────────

    it('computes promotion excess when active promotions exceed cap', async () => {
        const promos = [
            makePromotion({ id: 'p1', updatedAt: new Date('2026-06-01T00:00:00.000Z') }),
            makePromotion({ id: 'p2', updatedAt: new Date('2026-05-15T00:00:00.000Z') }),
            makePromotion({ id: 'p3', updatedAt: new Date('2026-05-01T00:00:00.000Z') })
        ];

        const deps = createDeps({
            getActivePromotionsForOwner: vi.fn().mockResolvedValue(promos),
            getPlanBySlug: vi.fn().mockReturnValue(makePlan({ maxActivePromotions: 1 }))
        });

        const result = await computeDowngradeExcess(
            { userId: USER_ID, targetPlanSlug: 'owner-pro' },
            deps
        );

        expect(result.promotions.cap).toBe(1);
        expect(result.promotions.activeCount).toBe(3);
        expect(result.promotions.excessCount).toBe(2);
        expect(result.promotions.items).toHaveLength(3);

        expect(result.promotions.items[0]!.id).toBe('p1');
        expect(result.promotions.items[0]!.keepByDefault).toBe(true);
        expect(result.promotions.items[1]!.keepByDefault).toBe(false);
        expect(result.promotions.items[2]!.keepByDefault).toBe(false);

        expect(result.hasExcess).toBe(true);
    });

    it('promotions at-cap produces no excess', async () => {
        const deps = createDeps({
            getActivePromotionsForOwner: vi.fn().mockResolvedValue([makePromotion({ id: 'p1' })]),
            getPlanBySlug: vi.fn().mockReturnValue(makePlan({ maxActivePromotions: 1 }))
        });

        const result = await computeDowngradeExcess(
            { userId: USER_ID, targetPlanSlug: 'owner-pro' },
            deps
        );

        expect(result.promotions.excessCount).toBe(0);
        expect(result.hasExcess).toBe(false);
    });

    // ── Photo excess per accommodation ─────────────────────────────────────

    it('detects photo overflow when gallery exceeds cap minus featuredImage slot', async () => {
        const acc = makeAccommodation({
            id: 'acc-photo',
            media: {
                featuredImage: { url: 'https://example.com/featured.jpg' },
                // 5 gallery photos; with featuredImage, total = 6; cap = 5 → 1 overflow
                gallery: [
                    { url: 'https://example.com/g1.jpg' },
                    { url: 'https://example.com/g2.jpg' },
                    { url: 'https://example.com/g3.jpg' },
                    { url: 'https://example.com/g4.jpg' },
                    { url: 'https://example.com/g5.jpg' }
                ]
            }
        });

        const deps = createDeps({
            getActiveAccommodationsForOwner: vi.fn().mockResolvedValue([acc]),
            getPlanBySlug: vi.fn().mockReturnValue(makePlan({ maxPhotosPerAccommodation: 5 }))
        });

        const result = await computeDowngradeExcess(
            { userId: USER_ID, targetPlanSlug: 'owner-basico' },
            deps
        );

        expect(result.photos).toHaveLength(1);
        const photoExcess = result.photos[0]!;
        expect(photoExcess.accommodationId).toBe('acc-photo');
        expect(photoExcess.cap).toBe(5);
        // 1 featured + 5 gallery = 6 total
        expect(photoExcess.totalCount).toBe(6);
        expect(photoExcess.excessCount).toBe(1);
        expect(photoExcess.hasFeaturedImage).toBe(true);
        // Overflow is the last gallery item(s)
        expect(photoExcess.overflowPhotoUrls).toHaveLength(1);
        expect(photoExcess.overflowPhotoUrls[0]!).toBe('https://example.com/g5.jpg');
    });

    it('photo at-cap: no overflow entry when total equals cap', async () => {
        const acc = makeAccommodation({
            id: 'acc-ok',
            media: {
                featuredImage: { url: 'https://example.com/featured.jpg' },
                // 4 gallery + 1 featured = 5 total, cap = 5 → no overflow
                gallery: [
                    { url: 'https://example.com/g1.jpg' },
                    { url: 'https://example.com/g2.jpg' },
                    { url: 'https://example.com/g3.jpg' },
                    { url: 'https://example.com/g4.jpg' }
                ]
            }
        });

        const deps = createDeps({
            getActiveAccommodationsForOwner: vi.fn().mockResolvedValue([acc]),
            getPlanBySlug: vi.fn().mockReturnValue(makePlan({ maxPhotosPerAccommodation: 5 }))
        });

        const result = await computeDowngradeExcess(
            { userId: USER_ID, targetPlanSlug: 'owner-basico' },
            deps
        );

        expect(result.photos).toHaveLength(0);
    });

    it('featured-only accommodation: no photo overflow even when cap=1', async () => {
        const acc = makeAccommodation({
            id: 'acc-featured-only',
            media: {
                featuredImage: { url: 'https://example.com/featured.jpg' },
                gallery: []
            }
        });

        const deps = createDeps({
            getActiveAccommodationsForOwner: vi.fn().mockResolvedValue([acc]),
            getPlanBySlug: vi.fn().mockReturnValue(makePlan({ maxPhotosPerAccommodation: 1 }))
        });

        const result = await computeDowngradeExcess(
            { userId: USER_ID, targetPlanSlug: 'owner-basico' },
            deps
        );

        expect(result.photos).toHaveLength(0);
    });

    it('no-featuredImage accommodation with 3 gallery photos and cap=2: 1 overflow', async () => {
        const acc = makeAccommodation({
            id: 'acc-no-featured',
            media: {
                // no featuredImage
                gallery: [
                    { url: 'https://example.com/g1.jpg' },
                    { url: 'https://example.com/g2.jpg' },
                    { url: 'https://example.com/g3.jpg' }
                ]
            }
        });

        const deps = createDeps({
            getActiveAccommodationsForOwner: vi.fn().mockResolvedValue([acc]),
            getPlanBySlug: vi.fn().mockReturnValue(makePlan({ maxPhotosPerAccommodation: 2 }))
        });

        const result = await computeDowngradeExcess(
            { userId: USER_ID, targetPlanSlug: 'owner-basico' },
            deps
        );

        expect(result.photos).toHaveLength(1);
        const photoEntry = result.photos[0]!;
        expect(photoEntry.hasFeaturedImage).toBe(false);
        expect(photoEntry.totalCount).toBe(3);
        expect(photoEntry.excessCount).toBe(1);
        expect(photoEntry.overflowPhotoUrls).toHaveLength(1);
        expect(photoEntry.overflowPhotoUrls[0]!).toBe('https://example.com/g3.jpg');
    });

    it('photo excess only appears for accommodations that actually have overflow', async () => {
        const accOk = makeAccommodation({
            id: 'acc-ok',
            media: { gallery: [{ url: 'https://example.com/g1.jpg' }] }
        });
        const accOver = makeAccommodation({
            id: 'acc-over',
            media: {
                gallery: [
                    { url: 'https://example.com/a1.jpg' },
                    { url: 'https://example.com/a2.jpg' },
                    { url: 'https://example.com/a3.jpg' }
                ]
            }
        });

        const deps = createDeps({
            getActiveAccommodationsForOwner: vi.fn().mockResolvedValue([accOk, accOver]),
            getPlanBySlug: vi.fn().mockReturnValue(makePlan({ maxPhotosPerAccommodation: 2 }))
        });

        const result = await computeDowngradeExcess(
            { userId: USER_ID, targetPlanSlug: 'owner-basico' },
            deps
        );

        expect(result.photos).toHaveLength(1);
        expect(result.photos[0]!.accommodationId).toBe('acc-over');
    });

    // ── Grandfather flags ──────────────────────────────────────────────────

    it('detects rich description (markdown) in accommodation and returns grandfather flag', async () => {
        const acc = makeAccommodation({
            id: 'acc-rich',
            description: '**Bold heading** with *italic* text'
        });

        const deps = createDeps({
            getActiveAccommodationsForOwner: vi.fn().mockResolvedValue([acc]),
            // Target plan does NOT have CAN_USE_RICH_DESCRIPTION
            getPlanBySlug: vi
                .fn()
                .mockReturnValue(makePlan({ hasRichDescription: false, maxAccommodations: 5 }))
        });

        const result = await computeDowngradeExcess(
            { userId: USER_ID, targetPlanSlug: 'owner-basico' },
            deps
        );

        expect(result.grandfatherFlags).toHaveLength(1);
        const richFlag = result.grandfatherFlags[0]!;
        expect(richFlag.accommodationId).toBe('acc-rich');
        expect(richFlag.hasRichDescription).toBe(true);
        expect(richFlag.hasVideoEmbed).toBe(false);
    });

    it('detects video embed URL in accommodation description', async () => {
        const acc = makeAccommodation({
            id: 'acc-video',
            description: 'Check our video: https://www.youtube.com/watch?v=abc123xyz'
        });

        const deps = createDeps({
            getActiveAccommodationsForOwner: vi.fn().mockResolvedValue([acc]),
            getPlanBySlug: vi
                .fn()
                .mockReturnValue(makePlan({ hasVideoEmbed: false, maxAccommodations: 5 }))
        });

        const result = await computeDowngradeExcess(
            { userId: USER_ID, targetPlanSlug: 'owner-basico' },
            deps
        );

        expect(result.grandfatherFlags).toHaveLength(1);
        const videoFlag = result.grandfatherFlags[0]!;
        expect(videoFlag.hasVideoEmbed).toBe(true);
        expect(videoFlag.hasRichDescription).toBe(false);
    });

    it('no grandfather flags when target plan HAS CAN_USE_RICH_DESCRIPTION + CAN_EMBED_VIDEO', async () => {
        const acc = makeAccommodation({
            id: 'acc-rich-video',
            description: '**Bold** https://www.youtube.com/watch?v=abc123'
        });

        const deps = createDeps({
            getActiveAccommodationsForOwner: vi.fn().mockResolvedValue([acc]),
            // Target plan HAS both entitlements — no grandfather flag needed
            getPlanBySlug: vi
                .fn()
                .mockReturnValue(makePlan({ hasRichDescription: true, hasVideoEmbed: true }))
        });

        const result = await computeDowngradeExcess(
            { userId: USER_ID, targetPlanSlug: 'owner-pro' },
            deps
        );

        expect(result.grandfatherFlags).toHaveLength(0);
    });

    it('no grandfather flags when description is plain text', async () => {
        const acc = makeAccommodation({
            id: 'acc-plain',
            description: 'This is a perfectly plain description without any formatting.'
        });

        const deps = createDeps({
            getActiveAccommodationsForOwner: vi.fn().mockResolvedValue([acc]),
            getPlanBySlug: vi
                .fn()
                .mockReturnValue(makePlan({ hasRichDescription: false, hasVideoEmbed: false }))
        });

        const result = await computeDowngradeExcess(
            { userId: USER_ID, targetPlanSlug: 'owner-basico' },
            deps
        );

        expect(result.grandfatherFlags).toHaveLength(0);
    });

    it('emits flag for accommodation with both rich description AND video embed', async () => {
        const acc = makeAccommodation({
            id: 'acc-both',
            description: '# Title\nhttps://www.youtube.com/watch?v=abc'
        });

        const deps = createDeps({
            getActiveAccommodationsForOwner: vi.fn().mockResolvedValue([acc]),
            getPlanBySlug: vi.fn().mockReturnValue(
                makePlan({
                    hasRichDescription: false,
                    hasVideoEmbed: false,
                    maxAccommodations: 5
                })
            )
        });

        const result = await computeDowngradeExcess(
            { userId: USER_ID, targetPlanSlug: 'owner-basico' },
            deps
        );

        expect(result.grandfatherFlags).toHaveLength(1);
        const bothFlag = result.grandfatherFlags[0]!;
        expect(bothFlag.hasRichDescription).toBe(true);
        expect(bothFlag.hasVideoEmbed).toBe(true);
    });

    // ── hasExcess convenience flag ─────────────────────────────────────────

    it('hasExcess is false when only grandfather flags exist (no quantity excess)', async () => {
        const acc = makeAccommodation({
            id: 'acc-rich',
            description: '**Bold** text',
            media: { gallery: [] }
        });

        const deps = createDeps({
            // 1 active, cap is also 1 — no accommodation quantity excess
            getActiveAccommodationsForOwner: vi.fn().mockResolvedValue([acc]),
            getPlanBySlug: vi.fn().mockReturnValue(
                makePlan({
                    hasRichDescription: false,
                    maxAccommodations: 1,
                    maxPhotosPerAccommodation: 5
                })
            )
        });

        const result = await computeDowngradeExcess(
            { userId: USER_ID, targetPlanSlug: 'owner-basico' },
            deps
        );

        expect(result.grandfatherFlags).toHaveLength(1);
        expect(result.hasExcess).toBe(false);
    });

    it('hasExcess is true when photo excess exists even if quantity excess is 0', async () => {
        const acc = makeAccommodation({
            id: 'acc-photos',
            media: {
                gallery: [
                    { url: 'https://example.com/g1.jpg' },
                    { url: 'https://example.com/g2.jpg' },
                    { url: 'https://example.com/g3.jpg' }
                ]
            }
        });

        const deps = createDeps({
            getActiveAccommodationsForOwner: vi.fn().mockResolvedValue([acc]),
            getPlanBySlug: vi.fn().mockReturnValue(
                makePlan({
                    maxAccommodations: 5,
                    maxActivePromotions: 5,
                    maxPhotosPerAccommodation: 2
                })
            )
        });

        const result = await computeDowngradeExcess(
            { userId: USER_ID, targetPlanSlug: 'owner-basico' },
            deps
        );

        expect(result.accommodations.excessCount).toBe(0);
        expect(result.promotions.excessCount).toBe(0);
        expect(result.photos).toHaveLength(1);
        expect(result.hasExcess).toBe(true);
    });

    // ── Mixed multi-dimension ──────────────────────────────────────────────

    it('handles mixed excess across all dimensions simultaneously', async () => {
        // 3 accommodations, cap=1 → 2 excess
        const acc1 = makeAccommodation({
            id: 'acc-1',
            updatedAt: new Date('2026-06-01T00:00:00.000Z'),
            description: '**Rich** text with https://www.youtube.com/watch?v=xyz video',
            media: {
                featuredImage: { url: 'https://example.com/f.jpg' },
                // 6 gallery + 1 featured = 7 total; cap=5 → 2 overflow gallery
                gallery: [
                    { url: 'https://example.com/g1.jpg' },
                    { url: 'https://example.com/g2.jpg' },
                    { url: 'https://example.com/g3.jpg' },
                    { url: 'https://example.com/g4.jpg' },
                    { url: 'https://example.com/g5.jpg' },
                    { url: 'https://example.com/g6.jpg' }
                ]
            }
        });
        const acc2 = makeAccommodation({
            id: 'acc-2',
            updatedAt: new Date('2026-05-01T00:00:00.000Z')
        });
        const acc3 = makeAccommodation({
            id: 'acc-3',
            updatedAt: new Date('2026-04-01T00:00:00.000Z')
        });

        // 2 active promotions, cap=0 → 2 excess
        const p1 = makePromotion({ id: 'p1', updatedAt: new Date('2026-06-01T00:00:00.000Z') });
        const p2 = makePromotion({ id: 'p2', updatedAt: new Date('2026-05-01T00:00:00.000Z') });

        const deps = createDeps({
            getActiveAccommodationsForOwner: vi.fn().mockResolvedValue([acc1, acc2, acc3]),
            getActivePromotionsForOwner: vi.fn().mockResolvedValue([p1, p2]),
            getPlanBySlug: vi.fn().mockReturnValue(
                makePlan({
                    maxAccommodations: 1,
                    maxActivePromotions: 0,
                    maxPhotosPerAccommodation: 5,
                    hasRichDescription: false,
                    hasVideoEmbed: false
                })
            )
        });

        const result = await computeDowngradeExcess(
            { userId: USER_ID, targetPlanSlug: 'owner-basico' },
            deps
        );

        // Accommodations
        expect(result.accommodations.excessCount).toBe(2);
        expect(result.accommodations.items[0]!.id).toBe('acc-1'); // most recent → kept

        // Promotions
        expect(result.promotions.excessCount).toBe(2);
        expect(result.promotions.cap).toBe(0);

        // Photos
        expect(result.photos).toHaveLength(1);
        const mixedPhoto = result.photos[0]!;
        expect(mixedPhoto.accommodationId).toBe('acc-1');
        // 1 featured + 6 gallery = 7 total; cap=5; gallery beyond (5-1=4) = 2 overflow
        expect(mixedPhoto.excessCount).toBe(2);
        expect(mixedPhoto.overflowPhotoUrls).toHaveLength(2);

        // Grandfather flags (for acc-1 which has rich + video, target plan lacks both)
        expect(result.grandfatherFlags).toHaveLength(1);
        expect(result.grandfatherFlags[0]!.accommodationId).toBe('acc-1');

        expect(result.hasExcess).toBe(true);
    });

    // ── Plan not found ─────────────────────────────────────────────────────

    it('throws when targetPlanSlug is not found in the billing catalog', async () => {
        const deps = createDeps({
            getPlanBySlug: vi.fn().mockReturnValue(undefined)
        });

        await expect(
            computeDowngradeExcess({ userId: USER_ID, targetPlanSlug: 'non-existent-plan' }, deps)
        ).rejects.toThrow();
    });

    // ── Return type validates against DowngradePreviewSchema ──────────────

    it('return value matches DowngradePreviewSchema structure', async () => {
        const { DowngradePreviewSchema } = await import('@repo/schemas');

        const deps = createDeps();
        const result = await computeDowngradeExcess(
            { userId: USER_ID, targetPlanSlug: 'owner-basico' },
            deps
        );

        const parsed = DowngradePreviewSchema.safeParse(result);
        expect(parsed.success).toBe(true);
    });
});
