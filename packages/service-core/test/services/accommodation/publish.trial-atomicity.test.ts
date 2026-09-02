/**
 * publish.trial-atomicity.test.ts — HOS-1012 spec guard G-2.
 *
 * "Publish and trial-start commit together or neither does." Both failure modes
 * are expensive and neither is loud:
 *
 *  - a publish that lands while the trial insert fails leaves a LIVE listing
 *    with no clock — free forever, and nothing will ever notice;
 *  - a trial that starts while the publish fails burns the owner's days for
 *    nothing.
 *
 * ## Why this file does not reuse `publish.test.ts`'s transaction stub
 *
 * That stub is `async (cb) => cb({ tx: {}, hookState: {} })` — it runs the
 * callback and nothing else. Under it a write inside the boundary and a write
 * outside it are indistinguishable, so it can prove neither direction of G-2:
 * a test written against it stays green with the trial insert hoisted out of
 * the transaction, which is precisely the mutation this guard exists to kill.
 *
 * So this file models the boundary instead. `world` is the committed database;
 * a transaction stages its writes and merges them into `world` only when the
 * callback resolves, discarding them when it throws. A write that carries the
 * transaction's client lands in the staging area; a write that does NOT lands
 * straight in `world` and therefore survives a rollback — which is exactly what
 * escaping the transaction means, and what makes the hoist mutation fail here.
 */

import type { AccommodationModel, UserModel } from '@repo/db';
import { LifecycleStatusEnum, RoleEnum, ServiceErrorCode } from '@repo/schemas';
import type { Mock } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccommodationService } from '../../../src/services/accommodation/accommodation.service';
import type {
    AccommodationPublishDeps,
    StartLocalTrialResult
} from '../../../src/services/accommodation/accommodation.types';
import { createMockAccommodation } from '../../factories/accommodationFactory';
import { createHostActor } from '../../factories/actorFactory';
import { createMockBaseModel } from '../../factories/baseServiceFactory';
import { createLoggerMock, createModelMock } from '../../utils/modelMockFactory';
import { asMock } from '../../utils/test-utils';

const getUserRolesMock = vi.hoisted(() => vi.fn(async () => [] as unknown[]));

vi.mock('../../../src/services/user-role/user-role.service.js', () => ({
    grantRole: vi.fn(async () => ({ data: undefined })),
    getUserRoles: getUserRolesMock
}));

/**
 * The transaction client identity. A write is inside the boundary if and only
 * if it carries THIS object — comparing identity (rather than truthiness) is
 * what lets a hoisted call, which carries no client at all, be detected.
 */
const TX = { __tx: 'publish' } as const;

/** The committed database. */
const world = vi.hoisted(() => ({
    lifecycleState: 'DRAFT' as string,
    trialRows: [] as StartLocalTrialResult[]
}));

/** Writes staged by the transaction currently open, if any. */
const staging = vi.hoisted(() => ({
    current: null as null | { lifecycleState: string | null; trialRows: StartLocalTrialResult[] }
}));

vi.mock('../../../src/utils/transaction.js', () => ({
    withServiceTransaction: vi.fn(async (cb: (txCtx: unknown) => Promise<unknown>) => {
        const staged = { lifecycleState: null as string | null, trialRows: [] as never[] };
        staging.current = staged as never;
        try {
            const result = await cb({ tx: TX, hookState: {} });
            // COMMIT
            if (staged.lifecycleState !== null) {
                world.lifecycleState = staged.lifecycleState;
            }
            world.trialRows.push(...staged.trialRows);
            return result;
        } finally {
            // ROLLBACK on throw: `staged` simply goes out of scope unmerged.
            staging.current = null;
        }
    })
}));

/** Records a lifecycle write against the boundary the caller's client implies. */
function recordLifecycleWrite(tx: unknown, next: string): void {
    if (tx === TX && staging.current) {
        staging.current.lifecycleState = next;
        return;
    }
    world.lifecycleState = next;
}

/** Records a trial insert against the boundary the caller's client implies. */
function recordTrialWrite(tx: unknown, row: StartLocalTrialResult): void {
    if (tx === TX && staging.current) {
        staging.current.trialRows.push(row);
        return;
    }
    world.trialRows.push(row);
}

const TRIAL: StartLocalTrialResult = {
    subscriptionId: 'sub-trial-001',
    customerId: 'cust-001',
    trialEnd: new Date('2026-10-01T00:00:00.000Z')
};

const OWNER_ID = 'host-g2';
const ACC_ID = 'acc-g2';

function createMediaModelMock() {
    return {
        findByAccommodations: vi.fn(
            async ({ accommodationIds }: { accommodationIds: string[] }) => {
                return new Map(
                    accommodationIds.map((id) => [
                        id,
                        [
                            {
                                url: 'https://cdn.example.test/main.jpg',
                                isFeatured: true,
                                state: 'visible',
                                sortOrder: 0,
                                moderationState: 'APPROVED'
                            }
                        ]
                    ])
                );
            }
        )
    };
}

/**
 * Deps whose owner is on `first_publish` — the only eligibility that starts a
 * trial. `startLocalTrial` writes through the boundary helper, so whether its
 * row survives a rollback is decided by the client the SERVICE hands it, not by
 * this stub.
 */
function createTrialDeps(overrides: Partial<AccommodationPublishDeps> = {}) {
    return {
        checkEligibility: vi.fn().mockResolvedValue('first_publish'),
        startLocalTrial: vi.fn(async ({ ctx }: { ctx: { tx?: unknown } }) => {
            recordTrialWrite(ctx?.tx, TRIAL);
            return TRIAL;
        }),
        onTrialStarted: vi.fn(async () => undefined),
        ...overrides
    } as AccommodationPublishDeps;
}

describe('AccommodationService.publish — G-2: the trial and the publish are one transaction', () => {
    let accommodationModel: ReturnType<typeof createMockBaseModel>;
    let userModel: UserModel;

    /**
     * Builds the service with a model whose `update` writes through the
     * boundary helper, so a rolled-back publish really does leave the listing
     * as it was.
     */
    function buildService(deps: AccommodationPublishDeps): AccommodationService {
        return new AccommodationService(
            { logger: createLoggerMock() },
            accommodationModel as AccommodationModel,
            null,
            userModel,
            deps,
            undefined,
            undefined,
            undefined,
            undefined,
            createMediaModelMock() as never
        );
    }

    beforeEach(() => {
        vi.clearAllMocks();
        world.lifecycleState = 'DRAFT';
        world.trialRows.length = 0;
        staging.current = null;

        accommodationModel = createMockBaseModel();
        userModel = createModelMock() as unknown as UserModel;
        getUserRolesMock.mockResolvedValue([RoleEnum.USER]);

        const accommodation = createMockAccommodation({
            id: ACC_ID,
            ownerId: OWNER_ID,
            lifecycleState: LifecycleStatusEnum.DRAFT,
            extraInfo: { capacity: 4, minNights: 1, bedrooms: 2, bathrooms: 1 }
        });
        (accommodationModel.findById as Mock).mockResolvedValue(accommodation);
        asMock(userModel.findById as Mock).mockResolvedValue({ id: OWNER_ID });
        (accommodationModel.update as Mock).mockImplementation(
            async (_where: unknown, data: { lifecycleState: string }, tx: unknown) => {
                recordLifecycleWrite(tx, data.lifecycleState);
                return { ...accommodation, lifecycleState: data.lifecycleState };
            }
        );
    });

    it('commits both writes on a successful first publish', async () => {
        const deps = createTrialDeps();
        const result = await buildService(deps).publish(createHostActor({ id: OWNER_ID }), ACC_ID);

        expect(result.error).toBeUndefined();
        expect(world.lifecycleState).toBe(LifecycleStatusEnum.ACTIVE);
        expect(world.trialRows).toEqual([TRIAL]);
        // INV-1: the cache clear runs, and only after the commit — a local trial
        // has no webhook, so nothing else would ever clear it.
        expect(deps.onTrialStarted).toHaveBeenCalledWith(TRIAL);
    });

    it('(a) a failing trial insert leaves the accommodation NOT active and no trial row', async () => {
        // The expensive direction: a listing that went live with no clock is
        // free forever and silent about it.
        const deps = createTrialDeps({
            startLocalTrial: vi.fn(async ({ ctx }: { ctx: { tx?: unknown } }) => {
                // Model a partially-applied write that the rollback must undo:
                // the row is staged, THEN the statement fails.
                recordTrialWrite(ctx?.tx, TRIAL);
                throw new Error('insert into billing_subscriptions failed');
            })
        });

        const result = await buildService(deps).publish(createHostActor({ id: OWNER_ID }), ACC_ID);

        expect(result.error).toBeDefined();
        expect(world.lifecycleState).toBe('DRAFT');
        expect(world.trialRows).toEqual([]);
        expect(deps.onTrialStarted).not.toHaveBeenCalled();
    });

    it('(a2) a trial that cannot be created at all rejects BEFORE the listing is written to', async () => {
        // `null` means no customer row / no trial plan / billing off. The
        // rejection has to happen before any lifecycle write is even attempted:
        // that ordering is what this assertion pins, and swapping the two writes
        // inside the transaction breaks it.
        const deps = createTrialDeps({ startLocalTrial: vi.fn(async () => null) });

        const result = await buildService(deps).publish(createHostActor({ id: OWNER_ID }), ACC_ID);

        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        expect(result.error?.message).toMatch(/subscription_required/);
        expect(accommodationModel.update).not.toHaveBeenCalled();
        expect(world.lifecycleState).toBe('DRAFT');
        expect(world.trialRows).toEqual([]);
    });

    it('(b) a failing lifecycle update leaves NO orphan trial row', async () => {
        // The other direction: days burned for a listing that never went live.
        // This is the assertion that dies if the trial insert is hoisted out of
        // the transaction — the row would then already be durable in `world`.
        (accommodationModel.update as Mock).mockRejectedValue(
            new Error('update accommodations failed')
        );
        const deps = createTrialDeps();

        const result = await buildService(deps).publish(createHostActor({ id: OWNER_ID }), ACC_ID);

        expect(result.error).toBeDefined();
        expect(world.trialRows).toEqual([]);
        expect(world.lifecycleState).toBe('DRAFT');
        expect(deps.onTrialStarted).not.toHaveBeenCalled();
    });

    it('(b2) a lifecycle update that returns nothing also leaves no orphan trial row', async () => {
        // `model.update` resolving `null` is the other way the flip can fail —
        // publish turns it into INTERNAL_ERROR, and the rollback must be the
        // same.
        (accommodationModel.update as Mock).mockResolvedValue(null);
        const deps = createTrialDeps();

        const result = await buildService(deps).publish(createHostActor({ id: OWNER_ID }), ACC_ID);

        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
        expect(world.trialRows).toEqual([]);
        expect(world.lifecycleState).toBe('DRAFT');
    });

    it('the trial insert runs with the publish transaction client, not a pooled one', async () => {
        // Stated directly so the mechanism, and not only its consequence, is
        // covered: `startLocalTrial` receives the transaction's context.
        const deps = createTrialDeps();
        await buildService(deps).publish(createHostActor({ id: OWNER_ID }), ACC_ID);

        expect(deps.startLocalTrial).toHaveBeenCalledWith(
            expect.objectContaining({ ownerId: OWNER_ID, ctx: expect.objectContaining({ tx: TX }) })
        );
    });

    it('a publish that starts no trial (has_active_sub) touches neither trial hook', async () => {
        const deps = createTrialDeps({
            checkEligibility: vi.fn().mockResolvedValue('has_active_sub')
        });

        const result = await buildService(deps).publish(createHostActor({ id: OWNER_ID }), ACC_ID);

        expect(result.error).toBeUndefined();
        expect(world.lifecycleState).toBe(LifecycleStatusEnum.ACTIVE);
        expect(deps.startLocalTrial).not.toHaveBeenCalled();
        expect(deps.onTrialStarted).not.toHaveBeenCalled();
    });

    it('a post-commit cache-clear failure does NOT fail the publish', async () => {
        // The publish is already durable at that point; failing the request
        // would tell the owner their listing did not go live when it did.
        const deps = createTrialDeps({
            onTrialStarted: vi.fn(async () => {
                throw new Error('cache clear exploded');
            })
        });

        const result = await buildService(deps).publish(createHostActor({ id: OWNER_ID }), ACC_ID);

        expect(result.error).toBeUndefined();
        expect(world.lifecycleState).toBe(LifecycleStatusEnum.ACTIVE);
        expect(world.trialRows).toEqual([TRIAL]);
    });
});
