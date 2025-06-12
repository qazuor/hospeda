import { DestinationModel } from '@repo/db';
import { LifecycleStatusEnum, ModerationStatusEnum, RoleEnum, VisibilityEnum } from '@repo/types';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';
import { DestinationService } from '../../destination/destination.service';
import * as permissionManager from '../../utils/permission-manager';
import { getMockDestination, getMockPublicUser, getMockUser } from '../mockData';

const admin = getMockUser({ role: RoleEnum.ADMIN });
const publicUser = getMockPublicUser();
const validInput = {
    slug: 'new-destination',
    name: 'New Destination',
    summary: 'A new destination',
    description: 'Description',
    location: { state: '', zipCode: '', country: '' },
    media: { featuredImage: { url: '', moderationState: ModerationStatusEnum.PENDING_REVIEW } },
    visibility: VisibilityEnum.PUBLIC
};

describe('destination.service.create', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should create a destination for authenticated user with permission', async () => {
        const spy = vi
            .spyOn(DestinationModel, 'create')
            .mockResolvedValue(getMockDestination({ ...validInput, createdById: admin.id }));
        const result = await DestinationService.create(validInput, admin);
        expect(result.destination).toMatchObject({ ...validInput, createdById: admin.id });
        expect(spy).toHaveBeenCalledTimes(1);
    });

    it('should throw for public user', async () => {
        const spy = vi.spyOn(DestinationModel, 'create');
        await expect(DestinationService.create(validInput, publicUser)).rejects.toThrow(
            'public user'
        );
        expect(spy).not.toHaveBeenCalled();
    });

    it('should throw for disabled user', async () => {
        const spy = vi.spyOn(DestinationModel, 'create');
        const disabledUser = getMockUser({ lifecycleState: LifecycleStatusEnum.INACTIVE });
        await expect(DestinationService.create(validInput, disabledUser)).rejects.toThrow(
            'disabled'
        );
        expect(spy).not.toHaveBeenCalled();
    });

    it('should throw if user lacks permission', async () => {
        const spy = vi.spyOn(DestinationModel, 'create');
        const hasPermissionMock = vi
            .spyOn(permissionManager, 'hasPermission')
            .mockImplementation(() => {
                throw new Error('Forbidden: user does not have permission to create destination');
            });
        const noPermUser = getMockUser({ role: RoleEnum.USER, permissions: [] });
        await expect(DestinationService.create(validInput, noPermUser)).rejects.toThrow(
            'permission'
        );
        expect(spy).not.toHaveBeenCalled();
        hasPermissionMock.mockRestore();
    });

    it('should throw on invalid input', async () => {
        await expect(
            DestinationService.create({ ...validInput, name: '' }, admin)
        ).rejects.toThrow();
    });

    it('should propagate model errors', async () => {
        (DestinationModel.create as unknown as Mock).mockRejectedValue(new Error('DB error'));
        await expect(DestinationService.create(validInput, admin)).rejects.toThrow('DB error');
    });
});
