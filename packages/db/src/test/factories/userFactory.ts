import { LifecycleStatusEnum, PermissionEnum, RoleEnum } from '@repo/types';
import { getMockPublicUser, getMockUser, getMockUserId } from '../mockData';

export const makeAdmin = (overrides = {}) =>
    getMockUser({
        id: getMockUserId(),
        role: RoleEnum.ADMIN,
        permissions: [PermissionEnum.ACCOMMODATION_UPDATE_ANY],
        ...overrides
    });

export const makeOwner = (overrides = {}) =>
    getMockUser({
        id: getMockUserId(),
        permissions: [PermissionEnum.ACCOMMODATION_UPDATE_OWN],
        ...overrides
    });

export const makeUserWithoutPermissions = (overrides = {}) =>
    getMockUser({
        id: getMockUserId(),
        permissions: [],
        ...overrides
    });

export const makeDisabledUser = (overrides = {}) =>
    getMockUser({
        id: getMockUserId(),
        permissions: [PermissionEnum.ACCOMMODATION_UPDATE_OWN],
        lifecycleState: LifecycleStatusEnum.INACTIVE,
        ...overrides
    });

export const makePublicUser = () => getMockPublicUser();
