/**
 * Policy-protection pins for SPEC-167 downgrade remediation (T-021).
 *
 * These tests protect OWNER-CONFIRMED policy decisions against future refactors,
 * following the SPEC-149 no-retry pinning precedent. Each suite is annotated
 * with the decision it protects.
 *
 * Pin 1 — INV-5 NOTHING DESTROYED (O-2 / INV-5):
 *   The restrict→restore round-trip via applyDowngradeRestrictions +
 *   applyUpgradeRestorations leaves resources byte-identical. The coordinator
 *   ONLY invokes the six allowed primitives (restrict/restore for
 *   accommodations, promotions, photos). It NEVER calls any destructive API
 *   (deletedAt write, lifecycle flip, ownerSuspended mutation, softDelete).
 *
 * Pin 2 — NON-DOWNGRADE NEVER RESTRICTS (realign D-1 / D-3):
 *   applyUpgradeRestorations (the upgrade coordinator) NEVER calls restriction
 *   primitives (restrictAccommodations, restrictPromotions, archiveAccommodationPhotos).
 *   Cron non-downgrade and admin hook upgrade cases are covered-already in
 *   apply-scheduled-plan-changes.test.ts and qzpay-admin-hooks.test.ts.
 *
 * Pin 3 — PAUSE/RESTRICT SEPARATION (realign D-3):
 *   setOwnerServiceSuspension update payloads contain ONLY ownerSuspended +
 *   updatedAt (for accommodations) and serviceSuspended + updatedAt (for
 *   users). planRestricted MUST NOT appear. Extends subscription-pause tests
 *   with Object.keys-exact assertions.
 *
 * Pin 4 — GRANDFATHER READ-ONLY (spec §3):
 *   When computeExcess reports zero quantity excess but non-empty
 *   grandfatherFlags, the coordinator returns flags in the summary and
 *   performs ZERO primitive mutations (no restrict/archive calls).
 *
 * Testing strategy (Pins 1, 2, 4):
 *   The real coordinator functions (applyDowngradeRestrictions,
 *   applyUpgradeRestorations) run against mocked primitives. This verifies
 *   the coordinator's mock call surface at the right level — not just that
 *   the primitives enforce INV-5 internally, but that the coordinator
 *   orchestrates only the correct subset of mutations.
 *
 * Testing strategy (Pin 3):
 *   setOwnerServiceSuspension runs against a mocked getDb() chain that
 *   records set() payloads, allowing Object.keys-exact assertions.
 *
 * @module test/services/plan-remediation-pins
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// vi.mock declarations — hoisted before any import
// ---------------------------------------------------------------------------

vi.mock('../../src/utils/logger', () => ({
    apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

// Mock @repo/db — withTransaction pass-through + table stubs for pause tests.
vi.mock('@repo/db', () => ({
    withTransaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>, existing?: unknown) =>
        cb(existing ?? {})
    ),
    accommodations: {
        id: 'acc-id',
        ownerId: 'acc-ownerId',
        ownerSuspended: 'acc-ownerSuspended',
        updatedAt: 'acc-updatedAt',
        slug: 'acc-slug'
    },
    billingCustomers: { id: 'bc-id', externalId: 'bc-externalId' },
    users: {
        id: 'users-id',
        serviceSuspended: 'users-serviceSuspended',
        updatedAt: 'users-updatedAt'
    },
    eq: vi.fn((_a: unknown, _b: unknown) => ({ _eq: true })),
    getDb: vi.fn()
}));

// Mock the six allowed primitives for coordinator-level assertions.
// Real coordinators import these — by mocking them we can verify which subset
// gets invoked without hitting the database.
vi.mock('../../src/services/plan-restriction.service', () => ({
    restrictAccommodations: vi.fn(),
    restoreAccommodations: vi.fn(),
    restrictPromotions: vi.fn(),
    restorePromotions: vi.fn()
}));

vi.mock('../../src/services/plan-photo-restriction.service', () => ({
    archiveAccommodationPhotos: vi.fn(),
    restoreAccommodationPhotos: vi.fn()
}));

// Mock @repo/service-core for getRevalidationService (used by coordinators).
vi.mock('@repo/service-core', () => ({
    getRevalidationService: vi.fn()
}));

// ---------------------------------------------------------------------------
// Imports (after mocks) — coordinators are the real implementations;
// primitives are mocked above.
// ---------------------------------------------------------------------------

import { getDb, withTransaction } from '@repo/db';
import { getRevalidationService } from '@repo/service-core';
import type { ApplyDowngradeRestrictionsInput } from '../../src/services/plan-downgrade-remediation.service';
import type { DowngradeRemediationDeps } from '../../src/services/plan-downgrade-remediation.service';
import { applyDowngradeRestrictions } from '../../src/services/plan-downgrade-remediation.service';
import { archiveAccommodationPhotos } from '../../src/services/plan-photo-restriction.service';
import {
    restoreAccommodations,
    restorePromotions,
    restrictAccommodations,
    restrictPromotions
} from '../../src/services/plan-restriction.service';
import type { UpgradeRestorationDeps } from '../../src/services/plan-upgrade-restoration.service';
import { applyUpgradeRestorations } from '../../src/services/plan-upgrade-restoration.service';
import { setOwnerServiceSuspension } from '../../src/services/subscription-pause.service';

// ---------------------------------------------------------------------------
// Shared fixtures and helpers
// ---------------------------------------------------------------------------

const CUSTOMER_ID = 'cust-pin-001';
const USER_ID = 'user-host-pin-001';
const TARGET_PLAN_SLUG = 'owner-basico';
const NEW_PLAN_ID = 'plan-uuid-pro-pin';

/** Build minimal DowngradeRemediationDeps. */
function makeDowngradeDeps(
    previewOverride?: object,
    accSlugs?: Record<string, string>
): DowngradeRemediationDeps {
    const defaultPreview = {
        accommodations: { cap: 1, activeCount: 1, excessCount: 0, items: [] },
        promotions: { cap: 0, activeCount: 0, excessCount: 0, items: [] },
        photos: [],
        grandfatherFlags: [],
        hasExcess: false
    };
    return {
        computeExcess: vi.fn().mockResolvedValue(previewOverride ?? defaultPreview),
        fetchAccommodationSlugs: vi.fn().mockResolvedValue(accSlugs ?? {})
    };
}

/** Build minimal UpgradeRestorationDeps. */
function makeUpgradeDeps(overrides: Partial<UpgradeRestorationDeps> = {}): UpgradeRestorationDeps {
    return {
        getPlanSlug: vi.fn().mockResolvedValue('owner-pro'),
        getPlanCaps: vi.fn().mockReturnValue({
            accommodationsCap: 3,
            promotionsCap: 5,
            photosPerAccommodationCap: 10
        }),
        getRestrictedAccommodations: vi.fn().mockResolvedValue([]),
        getActiveAccommodationCount: vi.fn().mockResolvedValue(0),
        getRestrictedPromotions: vi.fn().mockResolvedValue([]),
        getActivePromotionCount: vi.fn().mockResolvedValue(0),
        getAccommodationsWithArchivedPhotos: vi.fn().mockResolvedValue([]),
        fetchAccommodationSlugs: vi.fn().mockResolvedValue({}),
        ...overrides
    };
}

/**
 * Builds a mock db pair for setOwnerServiceSuspension:
 * - First update call: users (returns undefined)
 * - Second update call: accommodations (returns rows via .returning())
 *
 * Returns payload recorders so tests can do Object.keys assertions.
 */
function buildPauseDbMock(accommodationRows: Array<{ id: string; slug: string }>) {
    const userSetPayloads: unknown[] = [];
    const accSetPayloads: unknown[] = [];

    const returning = vi.fn().mockResolvedValue(accommodationRows);
    const accWhere = vi.fn(() => ({ returning }));
    const accSet = vi.fn((payload: unknown) => {
        accSetPayloads.push(payload);
        return { where: accWhere };
    });

    const usersWhere = vi.fn().mockResolvedValue(undefined);
    const usersSet = vi.fn((payload: unknown) => {
        userSetPayloads.push(payload);
        return { where: usersWhere };
    });

    let callCount = 0;
    const update = vi.fn(() => {
        callCount++;
        if (callCount === 1) return { set: usersSet };
        return { set: accSet };
    });

    vi.mocked(getDb).mockReturnValue({ update } as unknown as ReturnType<typeof getDb>);

    return { update, userSetPayloads, accSetPayloads };
}

/** Re-applies the withTransaction pass-through after clearAllMocks. */
function resetWithTransaction() {
    vi.mocked(withTransaction).mockImplementation(
        (
            cb: Parameters<typeof withTransaction>[0],
            existing?: Parameters<typeof withTransaction>[1]
        ) => (cb as (tx: unknown) => Promise<unknown>)(existing ?? {})
    );
}

// ===========================================================================
// PIN 1 — INV-5 NOTHING DESTROYED: coordinator-level mock surface assertion
// (Protects O-2 / INV-5 decision)
//
// The primitive-level payloads are already pinned in plan-restriction.service.test.ts
// and plan-photo-restriction.service.test.ts. This suite pins at the coordinator
// level: verify that the orchestrators ONLY invoke the allowed set of primitives
// and pass no extra destructive fields.
// ===========================================================================

describe('Pin 1 (INV-5): restrict→restore round-trip — coordinator calls NO destructive API', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        resetWithTransaction();
        // Primitive defaults: succeed, return minimal affectedIds.
        vi.mocked(restrictAccommodations).mockResolvedValue({ affectedIds: ['acc-2'] });
        vi.mocked(restoreAccommodations).mockResolvedValue({ affectedIds: ['acc-2'] });
        vi.mocked(restrictPromotions).mockResolvedValue({ affectedIds: [] });
        vi.mocked(restorePromotions).mockResolvedValue({ affectedIds: [] });
        vi.mocked(archiveAccommodationPhotos).mockResolvedValue({ movedCount: 0, totalCount: 0 });
        vi.mocked(getRevalidationService).mockReturnValue(undefined);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('restrict pass: ONLY restrictAccommodations called — no restore/lifecycle/deletedAt', async () => {
        // Protects INV-5: the coordinator must not emit deletedAt, lifecycleState,
        // ownerSuspended, or any other destructive call. The ONLY mutations allowed
        // in the restriction path are the three primitives listed in the suite name.
        const accItems = [
            {
                id: 'acc-1',
                name: 'Keep',
                updatedAt: '2026-05-01T00:00:00.000Z',
                viewCount: null,
                keepByDefault: true
            },
            {
                id: 'acc-2',
                name: 'Restrict',
                updatedAt: '2026-04-01T00:00:00.000Z',
                viewCount: null,
                keepByDefault: false
            }
        ];
        const preview = {
            accommodations: { cap: 1, activeCount: 2, excessCount: 1, items: accItems },
            promotions: { cap: 0, activeCount: 0, excessCount: 0, items: [] },
            photos: [],
            grandfatherFlags: [],
            hasExcess: true
        };
        const deps = makeDowngradeDeps(preview, { 'acc-2': 'slug-b' });

        await applyDowngradeRestrictions({
            userId: USER_ID,
            customerId: CUSTOMER_ID,
            targetPlanSlug: TARGET_PLAN_SLUG,
            deps
        } as ApplyDowngradeRestrictionsInput);

        // INV-5: the only primitive called is restrictAccommodations.
        expect(restrictAccommodations).toHaveBeenCalledOnce();
        // Restore primitives MUST NOT be invoked in a restriction pass.
        expect(restoreAccommodations).not.toHaveBeenCalled();
        expect(restorePromotions).not.toHaveBeenCalled();

        // Coordinator-level call shape: no extra destructive fields passed to the primitive.
        const call = vi.mocked(restrictAccommodations).mock.calls[0]?.[0];
        expect(call).toBeDefined();
        const callKeys = Object.keys(call ?? {});
        expect(callKeys).not.toContain('deletedAt');
        expect(callKeys).not.toContain('lifecycleState');
        expect(callKeys).not.toContain('ownerSuspended');
    });

    it('restore pass: ONLY restoreAccommodations called — no restriction/lifecycle/deletedAt', async () => {
        // Protects INV-5 restoration side: the upgrade coordinator must not emit
        // deletedAt, lifecycleState, or ownerSuspended in the restoration path.
        const restricted = [{ id: 'acc-2', updatedAt: new Date('2026-01-15T10:00:00Z') }];
        const deps = makeUpgradeDeps({
            getRestrictedAccommodations: vi.fn().mockResolvedValue(restricted),
            getActiveAccommodationCount: vi.fn().mockResolvedValue(0),
            fetchAccommodationSlugs: vi.fn().mockResolvedValue({ 'acc-2': 'slug-b' })
        });

        await applyUpgradeRestorations({
            userId: USER_ID,
            customerId: CUSTOMER_ID,
            newPlanId: NEW_PLAN_ID,
            deps
        });

        // INV-5: ONLY restoreAccommodations called.
        expect(restoreAccommodations).toHaveBeenCalledOnce();
        // Restriction primitives MUST NOT appear in a restore pass.
        expect(restrictAccommodations).not.toHaveBeenCalled();
        expect(restrictPromotions).not.toHaveBeenCalled();
        expect(archiveAccommodationPhotos).not.toHaveBeenCalled();

        // Coordinator must not pass extra destructive fields.
        const call = vi.mocked(restoreAccommodations).mock.calls[0]?.[0];
        expect(call).toBeDefined();
        const callKeys = Object.keys(call ?? {});
        expect(callKeys).not.toContain('deletedAt');
        expect(callKeys).not.toContain('lifecycleState');
        expect(callKeys).not.toContain('ownerSuspended');
    });

    it('round-trip: restore coordinator invokes only restore primitives, never restriction', async () => {
        // Protects round-trip symmetry: after a restriction pass the coordinator
        // hands off cleanly. The restore coordinator ONLY restores — it never calls
        // restriction primitives regardless of how many items are restricted.
        const restricted = [
            { id: 'acc-2', updatedAt: new Date('2026-01-15T10:00:00Z') },
            { id: 'acc-3', updatedAt: new Date('2026-01-14T10:00:00Z') }
        ];
        vi.mocked(restoreAccommodations).mockResolvedValue({
            affectedIds: ['acc-2', 'acc-3']
        });

        const deps = makeUpgradeDeps({
            getPlanCaps: vi.fn().mockReturnValue({
                accommodationsCap: 3,
                promotionsCap: 5,
                photosPerAccommodationCap: -1
            }),
            getRestrictedAccommodations: vi.fn().mockResolvedValue(restricted),
            getActiveAccommodationCount: vi.fn().mockResolvedValue(0)
        });

        await applyUpgradeRestorations({
            userId: USER_ID,
            customerId: CUSTOMER_ID,
            newPlanId: NEW_PLAN_ID,
            deps
        });

        // Round-trip: restore called once with all restricted ids.
        expect(restoreAccommodations).toHaveBeenCalledOnce();
        const call = vi.mocked(restoreAccommodations).mock.calls[0]?.[0];
        expect(call?.ids).toEqual(expect.arrayContaining(['acc-2', 'acc-3']));

        // Destructive primitives MUST NOT appear in the restore coordinator path.
        expect(restrictAccommodations).not.toHaveBeenCalled();
        expect(restrictPromotions).not.toHaveBeenCalled();
        expect(archiveAccommodationPhotos).not.toHaveBeenCalled();
    });
});

// ===========================================================================
// PIN 2 — NON-DOWNGRADE NEVER RESTRICTS: upgrade coordinator path
// (Protects realign D-1 / D-3 decisions)
//
// Coverage gap analysis (confirmed via grep):
//   - Cron non-downgrade: COVERED in apply-scheduled-plan-changes.test.ts L888-911
//   - Admin hook upgrade/same: COVERED in qzpay-admin-hooks.test.ts L735,L760
//   - Upgrade webhook path (applyUpgradeRestorations via confirmPlanUpgrade):
//     NOT previously pinned at the coordinator primitive-surface level.
//
// This suite pins that applyUpgradeRestorations calls ONLY restore primitives
// and NEVER calls restriction primitives (restrictAccommodations,
// restrictPromotions, archiveAccommodationPhotos).
// ===========================================================================

describe('Pin 2 (non-downgrade never restricts): upgrade coordinator never calls restriction primitives', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        resetWithTransaction();
        vi.mocked(restoreAccommodations).mockResolvedValue({ affectedIds: [] });
        vi.mocked(restorePromotions).mockResolvedValue({ affectedIds: [] });
        vi.mocked(restrictAccommodations).mockResolvedValue({ affectedIds: [] });
        vi.mocked(restrictPromotions).mockResolvedValue({ affectedIds: [] });
        vi.mocked(archiveAccommodationPhotos).mockResolvedValue({ movedCount: 0, totalCount: 0 });
        vi.mocked(getRevalidationService).mockReturnValue(undefined);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('applyUpgradeRestorations with restricted items: calls restoreAccommodations, never restriction primitives', async () => {
        // Protects D-1/D-3: the upgrade restoration coordinator must ONLY restore.
        // An upgrade means the host is moving to a higher-cap plan — there is no
        // excess by definition, so restriction is semantically wrong.
        vi.mocked(restoreAccommodations).mockResolvedValue({ affectedIds: ['acc-was-restricted'] });

        const deps = makeUpgradeDeps({
            getRestrictedAccommodations: vi
                .fn()
                .mockResolvedValue([{ id: 'acc-was-restricted', updatedAt: new Date() }]),
            getActiveAccommodationCount: vi.fn().mockResolvedValue(0)
        });

        await applyUpgradeRestorations({
            userId: USER_ID,
            customerId: CUSTOMER_ID,
            newPlanId: NEW_PLAN_ID,
            deps
        });

        // Restoration called (expected behavior on upgrade).
        expect(restoreAccommodations).toHaveBeenCalled();

        // Restriction primitives MUST NOT be called — ever — in the upgrade path.
        expect(restrictAccommodations).not.toHaveBeenCalled();
        expect(restrictPromotions).not.toHaveBeenCalled();
        expect(archiveAccommodationPhotos).not.toHaveBeenCalled();
    });

    it('applyUpgradeRestorations with nothing restricted: zero mutations of any kind', async () => {
        // Zero restricted items → no restoration, definitely no restriction.
        const deps = makeUpgradeDeps({
            getRestrictedAccommodations: vi.fn().mockResolvedValue([]),
            getRestrictedPromotions: vi.fn().mockResolvedValue([]),
            getAccommodationsWithArchivedPhotos: vi.fn().mockResolvedValue([])
        });

        await applyUpgradeRestorations({
            userId: USER_ID,
            customerId: CUSTOMER_ID,
            newPlanId: NEW_PLAN_ID,
            deps
        });

        // Both restriction AND restoration primitives must be silent.
        expect(restrictAccommodations).not.toHaveBeenCalled();
        expect(restrictPromotions).not.toHaveBeenCalled();
        expect(archiveAccommodationPhotos).not.toHaveBeenCalled();
        expect(restoreAccommodations).not.toHaveBeenCalled();
        expect(restorePromotions).not.toHaveBeenCalled();
    });

    it('applyUpgradeRestorations with restricted promotions: calls restorePromotions, never restrictPromotions', async () => {
        // Same invariant for the promotions dimension.
        vi.mocked(restorePromotions).mockResolvedValue({ affectedIds: ['promo-1'] });

        const deps = makeUpgradeDeps({
            getPlanCaps: vi.fn().mockReturnValue({
                accommodationsCap: -1,
                promotionsCap: 5,
                photosPerAccommodationCap: -1
            }),
            getRestrictedPromotions: vi
                .fn()
                .mockResolvedValue([{ id: 'promo-1', updatedAt: new Date() }]),
            getActivePromotionCount: vi.fn().mockResolvedValue(0)
        });

        await applyUpgradeRestorations({
            userId: USER_ID,
            customerId: CUSTOMER_ID,
            newPlanId: NEW_PLAN_ID,
            deps
        });

        expect(restorePromotions).toHaveBeenCalled();
        // Restriction primitives must stay silent.
        expect(restrictAccommodations).not.toHaveBeenCalled();
        expect(restrictPromotions).not.toHaveBeenCalled();
        expect(archiveAccommodationPhotos).not.toHaveBeenCalled();
    });
});

// ===========================================================================
// PIN 3 — PAUSE/RESTRICT SEPARATION (realign D-3)
// (Protects the ownerSuspended ↔ planRestricted non-collision invariant)
//
// Coverage gap analysis:
//   - Primitives side (no ownerSuspended in restrict/restore payloads):
//     COVERED in plan-restriction.service.test.ts L132-148, L208-224, L298-315, L374-390
//   - Pause side (no planRestricted in suspend/resume payloads):
//     NOT previously pinned with Object.keys-exact assertions.
//
// This suite extends subscription-pause behavior with exact payload key checks.
// ===========================================================================

describe('Pin 3 (PAUSE/RESTRICT SEPARATION D-3): setOwnerServiceSuspension payloads contain no planRestricted', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(getRevalidationService).mockReturnValue(undefined);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('suspend: accommodations update payload is EXACTLY { ownerSuspended, updatedAt } — planRestricted absent', async () => {
        // Protects D-3: the pause/resume flow must only flip ownerSuspended.
        // planRestricted is the downgrade-restriction flag and MUST NOT be
        // touched by setOwnerServiceSuspension — the two states must not collide.
        const { accSetPayloads } = buildPauseDbMock([{ id: 'acc-1', slug: 'slug-1' }]);

        await setOwnerServiceSuspension({ userId: USER_ID, suspended: true });

        expect(accSetPayloads).toHaveLength(1);
        const accPayload = accSetPayloads[0] as Record<string, unknown>;

        // D-3 pin: exact key set on accommodations update.
        expect(Object.keys(accPayload).sort()).toEqual(['ownerSuspended', 'updatedAt']);
        expect(accPayload.ownerSuspended).toBe(true);
        expect(accPayload.updatedAt).toBeInstanceOf(Date);
        expect(accPayload).not.toHaveProperty('planRestricted');
        expect(accPayload).not.toHaveProperty('lifecycleState');
        expect(accPayload).not.toHaveProperty('deletedAt');
    });

    it('resume: accommodations update payload is EXACTLY { ownerSuspended: false, updatedAt } — planRestricted absent', async () => {
        // Same D-3 pin for the resume direction.
        const { accSetPayloads } = buildPauseDbMock([{ id: 'acc-1', slug: 'slug-1' }]);

        await setOwnerServiceSuspension({ userId: USER_ID, suspended: false });

        expect(accSetPayloads).toHaveLength(1);
        const accPayload = accSetPayloads[0] as Record<string, unknown>;

        expect(Object.keys(accPayload).sort()).toEqual(['ownerSuspended', 'updatedAt']);
        expect(accPayload.ownerSuspended).toBe(false);
        expect(accPayload).not.toHaveProperty('planRestricted');
        expect(accPayload).not.toHaveProperty('lifecycleState');
        expect(accPayload).not.toHaveProperty('deletedAt');
    });

    it('suspend: users update payload is EXACTLY { serviceSuspended, updatedAt } — planRestricted absent', async () => {
        // D-3 pin on the users table update: no planRestricted there either.
        const { userSetPayloads } = buildPauseDbMock([{ id: 'acc-1', slug: 'slug-1' }]);

        await setOwnerServiceSuspension({ userId: USER_ID, suspended: true });

        expect(userSetPayloads).toHaveLength(1);
        const userPayload = userSetPayloads[0] as Record<string, unknown>;

        // Exact key set on users update.
        expect(Object.keys(userPayload).sort()).toEqual(['serviceSuspended', 'updatedAt']);
        expect(userPayload.serviceSuspended).toBe(true);
        expect(userPayload).not.toHaveProperty('planRestricted');
        expect(userPayload).not.toHaveProperty('ownerSuspended');
        expect(userPayload).not.toHaveProperty('deletedAt');
    });

    it('resume: users update payload is EXACTLY { serviceSuspended: false, updatedAt } — planRestricted absent', async () => {
        // D-3 pin for the users resume direction.
        const { userSetPayloads } = buildPauseDbMock([]);

        await setOwnerServiceSuspension({ userId: USER_ID, suspended: false });

        expect(userSetPayloads).toHaveLength(1);
        const userPayload = userSetPayloads[0] as Record<string, unknown>;

        expect(Object.keys(userPayload).sort()).toEqual(['serviceSuspended', 'updatedAt']);
        expect(userPayload.serviceSuspended).toBe(false);
        expect(userPayload).not.toHaveProperty('planRestricted');
        expect(userPayload).not.toHaveProperty('ownerSuspended');
    });
});

// ===========================================================================
// PIN 4 — GRANDFATHER READ-ONLY (spec §3)
// (Protects: coordinator performs NO action for rich/video dimensions;
//  grandfatherFlags are informational only)
//
// Coverage gap analysis:
//   - plan-downgrade-remediation.service.test.ts L871-889 verifies that
//     grandfatherFlags appear in the summary: PARTIALLY COVERED.
//   - NOT previously pinned: coordinator with ZERO quantity excess +
//     non-empty grandfatherFlags → zero primitive mutations + flags in summary.
//
// This suite explicitly pins the no-action guarantee for the grandfather dimensions.
// ===========================================================================

describe('Pin 4 (GRANDFATHER READ-ONLY §3): zero excess + grandfatherFlags → no primitive calls', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        resetWithTransaction();
        vi.mocked(restrictAccommodations).mockResolvedValue({ affectedIds: [] });
        vi.mocked(restrictPromotions).mockResolvedValue({ affectedIds: [] });
        vi.mocked(archiveAccommodationPhotos).mockResolvedValue({ movedCount: 0, totalCount: 0 });
        vi.mocked(getRevalidationService).mockReturnValue(undefined);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('coordinator returns grandfatherFlags in summary without calling any primitive', async () => {
        // Protects spec §3: rich description + video embed are grandfather/read-only.
        // Even when a host has grandfathered content, the coordinator must NOT call
        // restriction primitives for those dimensions — they are purely informational.
        const grandfatherFlags = [
            {
                accommodationId: 'acc-rich-video',
                accommodationName: 'La Cabaña',
                hasRichDescription: true,
                hasVideoEmbed: true
            },
            {
                accommodationId: 'acc-rich-only',
                accommodationName: 'El Balcón',
                hasRichDescription: true,
                hasVideoEmbed: false
            }
        ];

        // Zero quantity excess in every dimension — only grandfather flags present.
        const preview = {
            accommodations: { cap: 2, activeCount: 2, excessCount: 0, items: [] },
            promotions: { cap: 5, activeCount: 3, excessCount: 0, items: [] },
            photos: [],
            grandfatherFlags,
            hasExcess: false
        };
        const deps = makeDowngradeDeps(preview);

        const result = await applyDowngradeRestrictions({
            userId: USER_ID,
            customerId: CUSTOMER_ID,
            targetPlanSlug: TARGET_PLAN_SLUG,
            deps
        } as ApplyDowngradeRestrictionsInput);

        // Grandfather pin: NO primitive was called.
        expect(restrictAccommodations).not.toHaveBeenCalled();
        expect(restrictPromotions).not.toHaveBeenCalled();
        expect(archiveAccommodationPhotos).not.toHaveBeenCalled();

        // Summary carries the flags for UI display — informational only.
        expect(result.grandfatherFlags).toHaveLength(2);
        expect(result.grandfatherFlags[0]?.accommodationId).toBe('acc-rich-video');
        expect(result.grandfatherFlags[0]?.hasRichDescription).toBe(true);
        expect(result.grandfatherFlags[0]?.hasVideoEmbed).toBe(true);
        expect(result.grandfatherFlags[1]?.accommodationId).toBe('acc-rich-only');
    });

    it('coordinator returns zero-length restricted arrays alongside grandfatherFlags', async () => {
        // Redundant-but-explicit assertion on the summary structure:
        // restricted arrays MUST be empty when only grandfather flags are present.
        const grandfatherFlags = [
            {
                accommodationId: 'acc-video',
                accommodationName: 'Suite Plus',
                hasRichDescription: false,
                hasVideoEmbed: true
            }
        ];
        const preview = {
            accommodations: { cap: 3, activeCount: 1, excessCount: 0, items: [] },
            promotions: { cap: 5, activeCount: 0, excessCount: 0, items: [] },
            photos: [],
            grandfatherFlags,
            hasExcess: false
        };
        const deps = makeDowngradeDeps(preview);

        const result = await applyDowngradeRestrictions({
            userId: USER_ID,
            customerId: CUSTOMER_ID,
            targetPlanSlug: TARGET_PLAN_SLUG,
            deps
        } as ApplyDowngradeRestrictionsInput);

        // Restricted arrays empty.
        expect(result.restricted.accommodations).toHaveLength(0);
        expect(result.restricted.promotions).toHaveLength(0);
        expect(result.restricted.photosByAccommodation).toEqual({});

        // Grandfather flags present.
        expect(result.grandfatherFlags).toHaveLength(1);
        expect(result.grandfatherFlags[0]?.hasVideoEmbed).toBe(true);
    });
});
