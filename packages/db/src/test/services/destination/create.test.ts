import { RoleEnum, VisibilityEnum } from '@repo/types';
import { LifecycleStatusEnum } from '@repo/types/enums/lifecycle-state.enum';
import { ModerationStatusEnum } from '@repo/types/enums/state.enum';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';
import { DestinationModel } from '../../../models/destination/destination.model';
import { create as createDestination } from '../../../services/destination/destination.service';
import { getMockDestination, getMockPublicUser, getMockUser } from '../../../test/mockData';
import * as permissionManager from '../../../utils/permission-manager';

// vi.mock('../../../models/destination/destination.model');

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
        const result = await createDestination(validInput, admin);
        expect(result.destination).toMatchObject({ ...validInput, createdById: admin.id });
        expect(spy).toHaveBeenCalledTimes(1);
    });

    it('should throw for public user', async () => {
        const spy = vi.spyOn(DestinationModel, 'create');
        await expect(createDestination(validInput, publicUser)).rejects.toThrow('public user');
        expect(spy).not.toHaveBeenCalled();
    });

    it('should throw for disabled user', async () => {
        const spy = vi.spyOn(DestinationModel, 'create');
        const disabledUser = getMockUser({ lifecycleState: LifecycleStatusEnum.INACTIVE });
        await expect(createDestination(validInput, disabledUser)).rejects.toThrow('disabled');
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
        await expect(createDestination(validInput, noPermUser)).rejects.toThrow('permission');
        expect(spy).not.toHaveBeenCalled();
        hasPermissionMock.mockRestore();
    });

    it('should throw on invalid input', async () => {
        await expect(createDestination({ ...validInput, name: '' }, admin)).rejects.toThrow();
    });

    it('should propagate model errors', async () => {
        (DestinationModel.create as unknown as Mock).mockRejectedValue(new Error('DB error'));
        await expect(createDestination(validInput, admin)).rejects.toThrow('DB error');
    });
});
