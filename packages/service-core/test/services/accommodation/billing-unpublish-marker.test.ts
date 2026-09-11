/**
 * billing-unpublish-marker.test.ts (HOS-1181)
 *
 * The marker that tells a billing-initiated unpublish apart from an
 * owner-initiated one. Both write the same row shape otherwise
 * (`lifecycleState: INACTIVE`), and the whole win-back republish hinges on
 * the difference: when the owner pays, exactly the listings BILLING took down
 * come back — never the ones their owner paused on purpose.
 *
 * The marker is not a second write. It is stamped in the SAME update that
 * flips the lifecycle state, and cleared in the SAME update that flips the
 * row back to ACTIVE. Two writes would leave a crash-window on each side: a
 * marker whose lifecycle flip rolled back (a republish candidate that never
 * went down), and a lifecycle flip without its marker (a listing silently
 * dropped from every future win-back).
 *
 * @module test/services/accommodation/billing-unpublish-marker
 */

import type { AccommodationModel, UserModel } from '@repo/db';
import { LifecycleStatusEnum, PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import type { Mock } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccommodationService } from '../../../src/services/accommodation/accommodation.service';
import type { AccommodationPublishDeps } from '../../../src/services/accommodation/accommodation.types';
import { createMockAccommodation } from '../../factories/accommodationFactory';
import { createActor } from '../../factories/actorFactory';
import { createMockBaseModel } from '../../factories/baseServiceFactory';
import { createLoggerMock, createModelMock } from '../../utils/modelMockFactory';

const grantRoleMock = vi.hoisted(() => vi.fn(async () => ({ data: undefined })));
const getUserRolesMock = vi.hoisted(() => vi.fn(async () => [] as unknown[]));

vi.mock('../../../src/services/user-role/user-role.service.js', () => ({
    grantRole: grantRoleMock,
    getUserRoles: getUserRolesMock
}));

vi.mock('../../../src/utils/transaction.js', () => ({
    // Same drop-in stub publish.test.ts uses: the transaction is a no-op
    // wrapper, so "same write" reduces to "the one update call carries both
    // fields" — which is exactly what these tests pin.
    withServiceTransaction: vi.fn(async (cb: (txCtx: unknown) => Promise<unknown>) => {
        return cb({ tx: {} as unknown, hookState: {} });
    })
}));

const OWNER_ID = 'user-marker-owner';

/**
 * Media model stub — publish reads the listing's media (the main image is a
 * publish requirement), and without this stub the service builds a REAL
 * `AccommodationMediaModel` and every publish test needs a database.
 * Mirrors the stub `publish.test.ts` uses.
 */
function createMediaModelMock() {
    return {
        findByAccommodations: vi.fn(
            async ({ accommodationIds }: { accommodationIds: string[] }) => {
                const rows = [
                    {
                        url: 'https://cdn.example.test/main.jpg',
                        isFeatured: true,
                        state: 'visible',
                        sortOrder: 0,
                        moderationState: 'APPROVED'
                    }
                ];
                return new Map(accommodationIds.map((id) => [id, rows]));
            }
        )
    };
}

function buildService(
    model: ReturnType<typeof createMockBaseModel>,
    publishDeps?: AccommodationPublishDeps
): AccommodationService {
    const userModel = createModelMock() as unknown as UserModel;
    return new AccommodationService(
        { logger: createLoggerMock() },
        model as AccommodationModel,
        null,
        userModel,
        publishDeps ?? null,
        undefined,
        undefined,
        undefined,
        undefined,
        createMediaModelMock() as never
    );
}

function publishDepsEligible(): AccommodationPublishDeps {
    return {
        checkEligibility: vi.fn().mockResolvedValue('has_active_sub'),
        startLocalTrial: vi.fn().mockResolvedValue(null),
        onTrialStarted: vi.fn().mockResolvedValue(undefined)
    };
}

/** The single `model.update` payload the method under test produced. */
function updatePayload(model: ReturnType<typeof createMockBaseModel>): Record<string, unknown> {
    const call = (model.update as Mock).mock.calls[0];
    return (call?.[1] as Record<string, unknown>) ?? {};
}

beforeEach(() => {
    vi.clearAllMocks();
    // Non-exempt owner hats: the publish paths below run their billing
    // eligibility branch rather than the admin bypass.
    getUserRolesMock.mockResolvedValue([]);
});

describe('unpublish — the billing marker (HOS-1181)', () => {
    it('with billingUnpublish: true, stamps the marker IN the same write as the INACTIVE flip', async () => {
        const model = createMockBaseModel();
        const accommodation = createMockAccommodation({
            id: 'acc-marker',
            ownerId: OWNER_ID,
            lifecycleState: LifecycleStatusEnum.ACTIVE
        });
        (model.findById as Mock).mockResolvedValue(accommodation);
        (model.update as Mock).mockResolvedValue({
            ...accommodation,
            lifecycleState: LifecycleStatusEnum.INACTIVE
        });
        const service = buildService(model);

        const actor = createActor({
            id: OWNER_ID,
            permissions: [PermissionEnum.ACCOMMODATION_UPDATE_OWN]
        });
        const result = await service.unpublish(actor, 'acc-marker', undefined, {
            billingUnpublish: true
        });

        expect(result.error).toBeUndefined();
        // ONE update, carrying BOTH the flip and the marker — the atomicity
        // that keeps a crash from splitting them.
        expect(model.update).toHaveBeenCalledTimes(1);
        const payload = updatePayload(model);
        expect(payload.lifecycleState).toBe(LifecycleStatusEnum.INACTIVE);
        expect(payload.billingUnpublishedAt).toBeInstanceOf(Date);
    });

    it('WITHOUT the flag (the owner panel path), writes NO marker at all', async () => {
        // The load-bearing half of the distinction: this is the code path the
        // protected unpublish route takes, and the win-back must never be able
        // to see its result as a billing takedown.
        const model = createMockBaseModel();
        const accommodation = createMockAccommodation({
            id: 'acc-owner',
            ownerId: OWNER_ID,
            lifecycleState: LifecycleStatusEnum.ACTIVE
        });
        (model.findById as Mock).mockResolvedValue(accommodation);
        (model.update as Mock).mockResolvedValue({
            ...accommodation,
            lifecycleState: LifecycleStatusEnum.INACTIVE
        });
        const service = buildService(model);

        const actor = createActor({
            id: OWNER_ID,
            permissions: [PermissionEnum.ACCOMMODATION_UPDATE_OWN]
        });
        const result = await service.unpublish(actor, 'acc-owner');

        expect(result.error).toBeUndefined();
        const payload = updatePayload(model);
        expect(payload.lifecycleState).toBe(LifecycleStatusEnum.INACTIVE);
        // Absent, not null: the conditional spread means the KEY is not there,
        // which is what keeps an owner-paused listing indistinguishable from a
        // pre-HOS-1181 row for every win-back read.
        expect(payload).not.toHaveProperty('billingUnpublishedAt');
    });

    it('refuses anything that is not ACTIVE, marker or no marker', async () => {
        const model = createMockBaseModel();
        const accommodation = createMockAccommodation({
            id: 'acc-draft',
            ownerId: OWNER_ID,
            lifecycleState: LifecycleStatusEnum.DRAFT
        });
        (model.findById as Mock).mockResolvedValue(accommodation);
        const service = buildService(model);

        const actor = createActor({
            id: OWNER_ID,
            permissions: [PermissionEnum.ACCOMMODATION_UPDATE_OWN]
        });
        const result = await service.unpublish(actor, 'acc-draft', undefined, {
            billingUnpublish: true
        });

        // A DRAFT can therefore never acquire a marker through this path —
        // the win-back has nothing to act on for listings the owner never
        // published.
        expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        expect(model.update).not.toHaveBeenCalled();
    });
});

describe('publish — the marker clear (HOS-1181)', () => {
    it('clears the marker IN the same write as the ACTIVE flip', async () => {
        // The win-back republish goes through publish(), so this is also the
        // assertion that a republished listing can never keep a stale marker
        // for a later pass to act on after its owner deliberately unpublishes
        // it again.
        const model = createMockBaseModel();
        const accommodation = createMockAccommodation({
            id: 'acc-comeback',
            ownerId: OWNER_ID,
            lifecycleState: LifecycleStatusEnum.INACTIVE
        });
        (model.findById as Mock).mockResolvedValue(accommodation);
        (model.update as Mock).mockResolvedValue({
            ...accommodation,
            lifecycleState: LifecycleStatusEnum.ACTIVE
        });
        const service = buildService(model, publishDepsEligible());

        const actor = createActor({
            id: OWNER_ID,
            permissions: [PermissionEnum.ACCOMMODATION_UPDATE_OWN]
        });
        const result = await service.publish(actor, 'acc-comeback');

        expect(result.error).toBeUndefined();
        expect(model.update).toHaveBeenCalledTimes(1);
        const payload = updatePayload(model);
        expect(payload.lifecycleState).toBe(LifecycleStatusEnum.ACTIVE);
        expect(payload.billingUnpublishedAt).toBeNull();
    });
});
