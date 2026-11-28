/**
 * @fileoverview Admin moderation queue for host replies (HOS-2675).
 *
 * Pins the two things the route cannot show through its own tests: a read is
 * refused without ACCOMMODATION_REVIEW_MODERATE, and the exact page/filter
 * values reach the model instead of being rebuilt differently.
 */
import type { AccommodationReviewReplyModel } from '@repo/db';
import { ModerationStatusEnum, PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccommodationReviewReplyAdminService } from '../../../src/services/accommodationReview/accommodationReviewReplyAdmin.service';
import { ActorFactoryBuilder } from '../../factories/actorFactory';
import { getMockId } from '../../factories/utilsFactory';
import { createLoggerMock } from '../../utils/modelMockFactory';

const mockLogger = createLoggerMock();
const REVIEW_ID = getMockId('feature', 'admin-reply-review');
const ACCOMMODATION_ID = getMockId('accommodation', 'admin-reply-acc');
const ADMIN_ID = getMockId('user', 'admin-reply-moderator');

const adminActor = () =>
    new ActorFactoryBuilder()
        .withId(ADMIN_ID)
        .withPermissions([PermissionEnum.ACCOMMODATION_REVIEW_MODERATE])
        .build();
const plainActor = () => new ActorFactoryBuilder().withId(ADMIN_ID).withPermissions([]).build();

function buildService() {
    const model = {
        findAdminList: vi.fn(async () => ({
            items: [
                {
                    id: 'reply-1',
                    reviewId: REVIEW_ID,
                    content: 'Gracias.',
                    moderationState: 'PENDING',
                    moderationReason: null,
                    moderatedAt: null,
                    createdAt: new Date('2026-11-27T10:00:00.000Z'),
                    editedAt: null,
                    accommodationId: ACCOMMODATION_ID,
                    reviewTitle: 'Muy bien',
                    reviewContent: 'Todo bien',
                    reviewAverageRating: 5,
                    reviewerName: null
                }
            ],
            total: 1
        }))
    };

    const service = new AccommodationReviewReplyAdminService(
        { logger: mockLogger },
        { model: model as unknown as AccommodationReviewReplyModel }
    );
    return { service, model };
}

describe('AccommodationReviewReplyAdminService.listForModeration', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns the page and forwards every filter to the model', async () => {
        const { service, model } = buildService();

        const result = await service.listForModeration({
            page: 2,
            pageSize: 10,
            accommodationId: ACCOMMODATION_ID,
            moderationState: ModerationStatusEnum.PENDING,
            actor: adminActor()
        });

        expect(result.error).toBeUndefined();
        expect(result.data?.total).toBe(1);
        expect(result.data?.items[0]?.id).toBe('reply-1');
        expect(model.findAdminList).toHaveBeenCalledWith(
            {
                accommodationId: ACCOMMODATION_ID,
                moderationState: 'PENDING',
                page: 2,
                pageSize: 10
            },
            undefined
        );
    });

    it('applies the schema defaults when page and pageSize are omitted', async () => {
        const { service, model } = buildService();

        await service.listForModeration({ actor: adminActor() });

        expect(model.findAdminList).toHaveBeenCalledWith(
            { accommodationId: undefined, moderationState: undefined, page: 1, pageSize: 20 },
            undefined
        );
    });

    it('refuses an actor without ACCOMMODATION_REVIEW_MODERATE and never queries', async () => {
        const { service, model } = buildService();

        const result = await service.listForModeration({ actor: plainActor() });

        expect(result.data).toBeUndefined();
        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        expect(model.findAdminList).not.toHaveBeenCalled();
    });
});
