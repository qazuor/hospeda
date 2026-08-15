/**
 * moderate.test.ts
 *
 * Tests for `AccommodationService.moderate` (H-102).
 *
 * The defect this closes is an absence, not a wrong branch: an accommodation
 * could not leave `PENDING` by any route. `ACCOMMODATION_MODERATION_CHANGE` was
 * in the enum and granted in the seed, and nothing read it; the only moderation
 * route under `routes/accommodation/` moderated REVIEWS. Meanwhile
 * `ModerationAggregationService` counted pending accommodations for the admin
 * panel, so it counted work no action could complete. Every accommodation row
 * in production is `PENDING`, the two published ones included.
 */

import type { AccommodationModel } from '@repo/db';
import { ModerationStatusEnum, PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import type { Mock } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccommodationService } from '../../../src/services/accommodation/accommodation.service';
import { createMockAccommodation } from '../../factories/accommodationFactory';
import { createActor } from '../../factories/actorFactory';
import { createMockBaseModel } from '../../factories/baseServiceFactory';
import { createLoggerMock } from '../../utils/modelMockFactory';

vi.mock('../../../src/utils/transaction.js', () => ({
    withServiceTransaction: vi.fn(async (cb: (txCtx: unknown) => Promise<unknown>) =>
        cb({ tx: {} as unknown, hookState: {} })
    )
}));

describe('AccommodationService.moderate', () => {
    let accommodationModel: ReturnType<typeof createMockBaseModel>;
    let service: AccommodationService;

    beforeEach(() => {
        vi.clearAllMocks();
        accommodationModel = createMockBaseModel();
        service = new AccommodationService(
            { logger: createLoggerMock() },
            accommodationModel as AccommodationModel
        );
    });

    /** An actor holding the moderation permission. */
    function moderator() {
        return createActor({
            id: 'staff-1',
            permissions: [PermissionEnum.ACCOMMODATION_MODERATION_CHANGE]
        });
    }

    it('approves a pending accommodation', async () => {
        // Arrange — the state 100% of production rows are stuck in.
        const accommodation = createMockAccommodation({
            id: 'acc-1',
            moderationState: ModerationStatusEnum.PENDING
        });
        (accommodationModel.findById as Mock).mockResolvedValue(accommodation);
        (accommodationModel.update as Mock).mockResolvedValue({
            ...accommodation,
            moderationState: ModerationStatusEnum.APPROVED
        });

        // Act
        const result = await service.moderate({
            actor: moderator(),
            id: 'acc-1',
            moderationState: ModerationStatusEnum.APPROVED
        });

        // Assert
        expect(result.error).toBeUndefined();
        expect(result.data?.moderationState).toBe(ModerationStatusEnum.APPROVED);
    });

    it('writes moderationState and nothing that governs visibility', async () => {
        // Arrange
        const accommodation = createMockAccommodation({ id: 'acc-2' });
        (accommodationModel.findById as Mock).mockResolvedValue(accommodation);
        (accommodationModel.update as Mock).mockResolvedValue(accommodation);

        // Act
        await service.moderate({
            actor: moderator(),
            id: 'acc-2',
            moderationState: ModerationStatusEnum.REJECTED
        });

        // Assert — approving must not publish and rejecting must not unpublish,
        // exactly like the post and event equivalents. No public read of any
        // content entity filters on `moderationState` today, so enforcing it
        // here would pull live listings off the site.
        const patch = (accommodationModel.update as Mock).mock.calls[0]?.[1];
        expect(patch).toHaveProperty('moderationState', ModerationStatusEnum.REJECTED);
        expect(patch).not.toHaveProperty('lifecycleState');
        expect(patch).not.toHaveProperty('visibility');
    });

    it('refuses an actor without ACCOMMODATION_MODERATION_CHANGE', async () => {
        // Arrange — the permission existed and was granted long before anything
        // read it. This is the first thing that does.
        const accommodation = createMockAccommodation({ id: 'acc-3' });
        (accommodationModel.findById as Mock).mockResolvedValue(accommodation);

        // Act
        const result = await service.moderate({
            actor: createActor({ id: 'nobody', permissions: [] }),
            id: 'acc-3',
            moderationState: ModerationStatusEnum.APPROVED
        });

        // Assert
        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        expect(accommodationModel.update).not.toHaveBeenCalled();
    });

    it('returns NOT_FOUND for an accommodation that does not exist', async () => {
        // Arrange
        (accommodationModel.findById as Mock).mockResolvedValue(null);

        // Act
        const result = await service.moderate({
            actor: moderator(),
            id: 'missing',
            moderationState: ModerationStatusEnum.APPROVED
        });

        // Assert
        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
    });

    it('can move a listing back to PENDING', async () => {
        // Arrange — the queue has to work in both directions, or an approval
        // becomes irreversible and the counter simply stops being usable the
        // other way round.
        const accommodation = createMockAccommodation({
            id: 'acc-4',
            moderationState: ModerationStatusEnum.APPROVED
        });
        (accommodationModel.findById as Mock).mockResolvedValue(accommodation);
        (accommodationModel.update as Mock).mockResolvedValue({
            ...accommodation,
            moderationState: ModerationStatusEnum.PENDING
        });

        // Act
        const result = await service.moderate({
            actor: moderator(),
            id: 'acc-4',
            moderationState: ModerationStatusEnum.PENDING
        });

        // Assert
        expect(result.data?.moderationState).toBe(ModerationStatusEnum.PENDING);
    });
});
