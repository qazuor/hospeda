import { AccommodationModel } from '@repo/db';
import type { AccommodationId, VisibilityEnum } from '@repo/types';
import { LifecycleStatusEnum, PermissionEnum, RoleEnum } from '@repo/types';
import type { Mock } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccommodationService } from '../../accommodation/accommodation.service';
import {
    getMockAccommodation,
    getMockAccommodationId,
    getMockAccommodationPrivate,
    getMockAccommodationPublic
} from '../factories';
import { getMockDisabledUser, getMockPublicUser, getMockUser } from '../factories/userFactory';
import { expectInfoLog, expectNoPermissionLog, expectPermissionLog } from '../utils/log-assertions';

describe('accommodation.service.getById', () => {
    const publicUser = getMockPublicUser();
    const user = getMockUser({
        role: RoleEnum.ADMIN,
        permissions: [PermissionEnum.ACCOMMODATION_CREATE]
    });
    const disabledUser = getMockDisabledUser();
    const accommodationPublic = getMockAccommodationPublic();
    const accommodationPrivate = getMockAccommodationPrivate();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should return accommodation for public user if visibility is PUBLIC', async () => {
        (AccommodationModel.getById as Mock).mockResolvedValue(accommodationPublic);
        const result = await AccommodationService.getById(
            { id: 'acc-1' as AccommodationId },
            publicUser
        );
        expect(result.accommodation).toEqual(accommodationPublic);
        expectInfoLog(
            { input: { id: 'acc-1' as AccommodationId }, actor: publicUser },
            'getById:start'
        );
        expectInfoLog({ result: { accommodation: accommodationPublic } }, 'getById:end');
    });

    it('should return null and log permission for public user if visibility is PRIVATE', async () => {
        (AccommodationModel.getById as Mock).mockResolvedValue(accommodationPrivate);
        const result = await AccommodationService.getById(
            { id: getMockAccommodationId() },
            publicUser
        );
        expect(result.accommodation).toBeNull();
        expectPermissionLog({
            permission: PermissionEnum.ACCOMMODATION_VIEW_PRIVATE,
            userId: 'public',
            role: RoleEnum.GUEST,
            extraData: expect.anything()
        });
    });

    it('should return accommodation for logged in user regardless of visibility', async () => {
        (AccommodationModel.getById as Mock).mockResolvedValue(accommodationPrivate);
        const result = await AccommodationService.getById({ id: getMockAccommodationId() }, user);
        expect(result.accommodation).toEqual(accommodationPrivate);
        expectInfoLog({ input: { id: getMockAccommodationId() }, actor: user }, 'getById:start');
        expectInfoLog({ result: { accommodation: accommodationPrivate } }, 'getById:end');
    });

    it('should return null if accommodation does not exist', async () => {
        (AccommodationModel.getById as Mock).mockResolvedValue(undefined);
        const result = await AccommodationService.getById(
            { id: 'not-exist' as AccommodationId },
            publicUser
        );
        expect(result.accommodation).toBeNull();
        expectNoPermissionLog();
    });

    it('should return null and log permission if user is disabled', async () => {
        (AccommodationModel.getById as Mock).mockResolvedValue(accommodationPrivate);
        const result = await AccommodationService.getById(
            { id: getMockAccommodationId() },
            { ...disabledUser, lifecycleState: LifecycleStatusEnum.INACTIVE }
        );
        expect(result.accommodation).toBeNull();
        expectPermissionLog({
            permission: PermissionEnum.ACCOMMODATION_VIEW_PRIVATE,
            userId: disabledUser.id,
            role: disabledUser.role,
            extraData: expect.objectContaining({ reason: 'user disabled' })
        });
    });

    it('should throw and log if accommodation has unknown visibility', async () => {
        const accommodationUnknown = getMockAccommodation({
            id: getMockAccommodationId(),
            visibility: 'UNKNOWN' as unknown as VisibilityEnum
        });
        (AccommodationModel.getById as Mock).mockResolvedValue(accommodationUnknown);
        await expect(
            AccommodationService.getById({ id: getMockAccommodationId() }, user)
        ).rejects.toThrow(/Unknown accommodation visibility/);
        expectPermissionLog({
            permission: 'UNKNOWN_PERMISSION',
            userId: user.id,
            role: user.role,
            extraData: expect.objectContaining({
                error: 'unknown visibility',
                visibility: 'UNKNOWN',
                input: expect.any(Object)
            })
        });
    });
});
