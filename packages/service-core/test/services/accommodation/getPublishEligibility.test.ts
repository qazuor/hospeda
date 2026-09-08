/**
 * getPublishEligibility.test.ts
 *
 * `AccommodationService.getPublishEligibility` — the read side of the publish
 * decision (HOS-1183 D-1).
 *
 * The method exists so a publish affordance can ask what `publish()` would
 * decide WITHOUT posting and taking a 403. So what these tests pin is the
 * agreement between the two, verdict by verdict: whenever `canPublish` is true
 * here, `publish()` must not reject for billing, and vice versa.
 */

import type { AccommodationModel, UserModel } from '@repo/db';
import { RoleEnum, ServiceErrorCode } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccommodationService } from '../../../src/services/accommodation/accommodation.service';
import type {
    AccommodationPublishDeps,
    PublishEligibility
} from '../../../src/services/accommodation/accommodation.types';
import {
    createActor,
    createAdminActor,
    createHostActor,
    createSuperAdminActor
} from '../../factories/actorFactory';
import { createMockBaseModel } from '../../factories/baseServiceFactory';
import { createLoggerMock, createModelMock } from '../../utils/modelMockFactory';

function createPublishDeps(eligibility: PublishEligibility): AccommodationPublishDeps {
    return {
        checkEligibility: vi.fn().mockResolvedValue(eligibility),
        startLocalTrial: vi.fn(),
        onTrialStarted: vi.fn()
    };
}

function buildService(publishDeps: AccommodationPublishDeps | null): AccommodationService {
    return new AccommodationService(
        { logger: createLoggerMock() },
        createMockBaseModel() as unknown as AccommodationModel,
        null,
        createModelMock() as unknown as UserModel,
        publishDeps
    );
}

describe('AccommodationService.getPublishEligibility', () => {
    let deps: AccommodationPublishDeps;

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('the verdict is reported verbatim', () => {
        it.each([
            'first_publish',
            'has_active_sub',
            'subscription_required'
        ] as const)('returns %s exactly as checkEligibility answered it', async (verdict) => {
            deps = createPublishDeps(verdict);
            const result = await buildService(deps).getPublishEligibility(createHostActor());

            expect(result.error).toBeUndefined();
            expect(result.data?.eligibility).toBe(verdict);
        });

        it('asks checkEligibility about the ACTOR, once', async () => {
            // Owner-level by construction (D-1): the page resolves billing once
            // for the whole portfolio, not once per card.
            deps = createPublishDeps('has_active_sub');
            const actor = createHostActor({ id: 'owner-42' });

            await buildService(deps).getPublishEligibility(actor);

            expect(deps.checkEligibility).toHaveBeenCalledTimes(1);
            expect(deps.checkEligibility).toHaveBeenCalledWith('owner-42', expect.anything());
        });
    });

    describe('canPublish agrees with what publish() would do', () => {
        it('lets a paying owner publish', async () => {
            deps = createPublishDeps('has_active_sub');
            const result = await buildService(deps).getPublishEligibility(createHostActor());

            expect(result.data?.canPublish).toBe(true);
            expect(result.data?.startsTrial).toBe(false);
        });

        it('lets a trial-eligible owner publish — the HOS-1183 bug', async () => {
            // The card used to hide the button here, because `plan == null`.
            // publish() has published this owner since HOS-1012, starting a
            // local trial in the same transaction.
            deps = createPublishDeps('first_publish');
            const result = await buildService(deps).getPublishEligibility(createHostActor());

            expect(result.data?.canPublish).toBe(true);
            expect(result.data?.startsTrial).toBe(true);
        });

        it('refuses an owner whose trial is spent and has no plan', async () => {
            deps = createPublishDeps('subscription_required');
            const result = await buildService(deps).getPublishEligibility(createHostActor());

            expect(result.data?.canPublish).toBe(false);
            expect(result.data?.startsTrial).toBe(false);
        });
    });

    describe('platform staff bypass billing, exactly as publish() does', () => {
        // publish() resolves the owner's hats and skips the eligibility check
        // entirely for them. If this endpoint did not, a staff owner would be
        // shown a plans link while the server published them on request — the
        // same two-sided disagreement this whole issue is about, in a narrower
        // audience.
        it.each([
            ['ADMIN', createAdminActor],
            ['SUPER_ADMIN', createSuperAdminActor]
        ])('%s publishes on a subscription_required verdict', async (_label, makeActor) => {
            deps = createPublishDeps('subscription_required');
            const result = await buildService(deps).getPublishEligibility(makeActor());

            expect(result.data?.canPublish).toBe(true);
        });

        it('CLIENT_MANAGER publishes on a subscription_required verdict', async () => {
            deps = createPublishDeps('subscription_required');
            const actor = createActor({ roles: [RoleEnum.CLIENT_MANAGER] });
            const result = await buildService(deps).getPublishEligibility(actor);

            expect(result.data?.canPublish).toBe(true);
        });

        it('still reports the honest billing verdict rather than a flattering one', async () => {
            // The bypass changes what the server will DO, not what billing
            // says. Rewriting the verdict here would make a staff account
            // indistinguishable from a paying one in any later diagnosis.
            deps = createPublishDeps('subscription_required');
            const result = await buildService(deps).getPublishEligibility(createAdminActor());

            expect(result.data?.eligibility).toBe('subscription_required');
        });

        it('never starts a trial for staff, even on first_publish', async () => {
            // publish() sets startsLocalTrial only inside the non-exempt
            // branch, so no trial row is ever inserted for staff. Announcing
            // one would promise a clock that never starts.
            deps = createPublishDeps('first_publish');
            const result = await buildService(deps).getPublishEligibility(createAdminActor());

            expect(result.data?.canPublish).toBe(true);
            expect(result.data?.startsTrial).toBe(false);
        });

        it('a HOST is not staff — holding the host hat grants no bypass', async () => {
            // Guards the guard: if the exempt set ever widened to HOST, every
            // staff test above would still pass while the billing gate was
            // gone for everyone.
            deps = createPublishDeps('subscription_required');
            const result = await buildService(deps).getPublishEligibility(createHostActor());

            expect(result.data?.canPublish).toBe(false);
        });
    });

    describe('misconfiguration', () => {
        it('fails with CONFIGURATION_ERROR when built without billing deps', async () => {
            // Deliberately not a permissive default: answering "sure, publish"
            // with no billing wired would hand out unbounded free listings.
            const result = await buildService(null).getPublishEligibility(createHostActor());

            expect(result.data).toBeUndefined();
            expect(result.error?.code).toBe(ServiceErrorCode.CONFIGURATION_ERROR);
        });
    });
});
