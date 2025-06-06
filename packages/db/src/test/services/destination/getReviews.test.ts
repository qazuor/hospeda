import { LifecycleStatusEnum, PermissionEnum, RoleEnum, VisibilityEnum } from '@repo/types';
import type { Mock } from 'vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DestinationModel } from '../../../models/destination/destination.model';
import { DestinationReviewModel } from '../../../models/destination/destination_review.model';
import * as destinationHelper from '../../../services/destination/destination.helper';
import * as DestinationService from '../../../services/destination/destination.service';
import { CanViewReasonEnum } from '../../../utils/service-helper';
import {
    getMockDestination,
    getMockDestinationId,
    getMockUser,
    getMockUserId
} from '../../mockData';
import { expectInfoLog } from '../../utils/logAssertions';

vi.mock('../../../utils/logger');
vi.mock('../../../models/destination/destination.model', async (importOriginal) => {
    const actualImport = await importOriginal();
    const actual = typeof actualImport === 'object' && actualImport !== null ? actualImport : {};
    return {
        ...actual,
        DestinationModel: {
            ...((actual as Record<string, unknown>).DestinationModel ?? {}),
            getById: vi.fn()
        }
    };
});
vi.mock('../../../models/destination/destination_review.model', async (importOriginal) => {
    const actualImport = await importOriginal();
    const actual = typeof actualImport === 'object' && actualImport !== null ? actualImport : {};
    return {
        ...actual,
        DestinationReviewModel: {
            ...((actual as Record<string, unknown>).DestinationReviewModel ?? {}),
            list: vi.fn()
        }
    };
});

describe('destination.service.getReviews', () => {
    const admin = getMockUser({ id: getMockUserId(), role: RoleEnum.ADMIN });
    const user = getMockUser({ id: getMockUserId(), role: RoleEnum.USER });
    const disabledUser = { ...user, lifecycleState: LifecycleStatusEnum.INACTIVE };
    const destinationId = getMockDestinationId();
    const baseDestination = getMockDestination({
        id: destinationId,
        visibility: VisibilityEnum.PUBLIC
    });
    const review1 = { id: 'rev-1', destinationId, userId: user.id, rating: 5 };
    const review2 = { id: 'rev-2', destinationId, userId: admin.id, rating: 4 };
    const reviewOther = { id: 'rev-3', destinationId: 'other', userId: user.id, rating: 3 };
    const input = { destinationId, limit: 10, offset: 0 };

    beforeEach(() => {
        vi.clearAllMocks();
    });
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should return reviews for admin', async () => {
        (DestinationModel.getById as Mock).mockResolvedValue(baseDestination);
        (DestinationReviewModel.list as Mock).mockResolvedValue([review1, review2, reviewOther]);
        const result = await DestinationService.getReviews(input, admin);
        expect(result.reviews).toEqual([review1, review2]);
        expectInfoLog({ input, actor: admin }, 'getReviews:start');
        expectInfoLog({ result: { reviews: [review1, review2] } }, 'getReviews:end');
    });

    it('should return empty array if destination not found', async () => {
        (DestinationModel.getById as Mock).mockResolvedValue(null);
        const result = await DestinationService.getReviews(input, admin);
        expect(result.reviews).toEqual([]);
        expectInfoLog({ input, actor: admin }, 'getReviews:start');
        expectInfoLog({ result: { reviews: [] } }, 'getReviews:end');
    });

    it('should return empty array if user is disabled', async () => {
        (DestinationModel.getById as Mock).mockResolvedValue(baseDestination);
        const result = await DestinationService.getReviews(input, disabledUser);
        expect(result.reviews).toEqual([]);
        expectInfoLog({ input, actor: disabledUser }, 'getReviews:start');
        expectInfoLog({ result: { reviews: [] } }, 'getReviews:end');
    });

    it('should return empty array if user does not have permission', async () => {
        (DestinationModel.getById as Mock).mockResolvedValue(baseDestination);
        vi.spyOn(destinationHelper, 'canViewDestination').mockReturnValue({
            canView: false,
            reason: CanViewReasonEnum.PERMISSION_CHECK_REQUIRED,
            checkedPermission: PermissionEnum.DESTINATION_VIEW_PRIVATE
        });
        const result = await DestinationService.getReviews(input, user);
        expect(result.reviews).toEqual([]);
        expectInfoLog({ input, actor: user }, 'getReviews:start');
        expectInfoLog({ result: { reviews: [] } }, 'getReviews:end');
    });

    it('should throw if destination has unknown visibility', async () => {
        (DestinationModel.getById as Mock).mockResolvedValue({
            ...baseDestination,
            visibility: 'UNKNOWN'
        });
        vi.spyOn(destinationHelper, 'canViewDestination').mockReturnValue({
            canView: false,
            reason: CanViewReasonEnum.UNKNOWN_VISIBILITY,
            checkedPermission: undefined
        });
        await expect(DestinationService.getReviews(input, admin)).rejects.toThrow(
            'Unknown destination visibility: UNKNOWN'
        );
        expectInfoLog({ input, actor: admin }, 'getReviews:start');
        expectInfoLog({ result: { reviews: [] } }, 'getReviews:end');
    });
});
