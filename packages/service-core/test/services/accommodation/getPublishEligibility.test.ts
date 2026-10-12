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

    describe('AC:V5:17 - a staff role gets the same verdict as any owner', () => {
        it.each([
            ['ADMIN', createAdminActor],
            ['SUPER_ADMIN', createSuperAdminActor]
        ])('%s cannot publish on a subscription_required verdict', async (_label, makeActor) => {
            deps = createPublishDeps('subscription_required');
            const result = await buildService(deps).getPublishEligibility(makeActor());

            expect(result.data?.canPublish).toBe(false);
        });

        it('CLIENT_MANAGER cannot publish on a subscription_required verdict', async () => {
            deps = createPublishDeps('subscription_required');
            const actor = createActor({ roles: [RoleEnum.CLIENT_MANAGER] });
            const result = await buildService(deps).getPublishEligibility(actor);

            expect(result.data?.canPublish).toBe(false);
        });

        it('still reports the honest billing verdict rather than a flattering one', async () => {
            // Role does not change the published billing verdict.
            deps = createPublishDeps('subscription_required');
            const result = await buildService(deps).getPublishEligibility(createAdminActor());

            expect(result.data?.eligibility).toBe('subscription_required');
        });

        it('an ADMIN starts a trial on first_publish', async () => {
            deps = createPublishDeps('first_publish');
            const result = await buildService(deps).getPublishEligibility(createAdminActor());

            expect(result.data?.canPublish).toBe(true);
            expect(result.data?.startsTrial).toBe(true);
        });

        it('a HOST also receives the billing verdict', async () => {
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

    describe('new signups freeze', () => {
        it('reports a paused first publish: no publish, no trial', async () => {
            // Arrange
            deps = {
                ...createPublishDeps('first_publish'),
                readNewSignupsFreeze: vi.fn().mockResolvedValue({ frozen: true })
            };

            // Act
            const result = await buildService(deps).getPublishEligibility(createHostActor());

            // Assert
            expect(result.data).toEqual({
                eligibility: 'first_publish',
                canPublish: false,
                startsTrial: false,
                firstPublishPaused: true
            });
        });

        it('leaves a paying owner untouched and never reads the freeze', async () => {
            // Arrange
            const readNewSignupsFreeze = vi.fn().mockResolvedValue({ frozen: true });
            deps = { ...createPublishDeps('has_active_sub'), readNewSignupsFreeze };

            // Act
            const result = await buildService(deps).getPublishEligibility(createHostActor());

            // Assert
            expect(result.data?.canPublish).toBe(true);
            expect(result.data?.firstPublishPaused).toBe(false);
            expect(readNewSignupsFreeze).not.toHaveBeenCalled();
        });

        it('reports firstPublishPaused false when signups are open', async () => {
            // Arrange
            deps = {
                ...createPublishDeps('first_publish'),
                readNewSignupsFreeze: vi.fn().mockResolvedValue({ frozen: false })
            };

            // Act
            const result = await buildService(deps).getPublishEligibility(createHostActor());

            // Assert
            expect(result.data?.canPublish).toBe(true);
            expect(result.data?.startsTrial).toBe(true);
            expect(result.data?.firstPublishPaused).toBe(false);
        });
    });
});
