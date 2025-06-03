import { PermissionEnum, RoleEnum } from '@repo/types';
import { describe, expect, it, vi } from 'vitest';
import { getMockPublicUser, getMockUser } from '../test/mockData';
import {
    type LoggerWithPermission,
    logDenied,
    logGrant,
    logOverride,
    logUserDisabled
} from './permission-logger';

/**
 * Returns a mock logger with a spy for the permission method.
 */
const mockLogger = () => {
    return { permission: vi.fn() } as unknown as LoggerWithPermission;
};

// Mock user and public user for testing
const user = getMockUser({ role: RoleEnum.ADMIN });
const publicUser = getMockPublicUser();
const resource = { visibility: 'PRIVATE' };
const input = { foo: 'bar' };

/**
 * Unit tests for the permission-logger helpers.
 * Ensures all logging helpers produce the correct structure for permission logs.
 */
describe('permission-logger', () => {
    it('logDenied logs correct structure', () => {
        const logger = mockLogger();
        logDenied(
            logger,
            user,
            input,
            resource,
            'missing permission',
            PermissionEnum.ACCOMMODATION_VIEW_PRIVATE
        );
        expect(logger.permission).toHaveBeenCalledWith({
            permission: PermissionEnum.ACCOMMODATION_VIEW_PRIVATE,
            userId: user.id,
            role: user.role,
            extraData: { input, visibility: resource.visibility, error: 'missing permission' }
        });
    });

    it('logDenied uses fallback for missing permission', () => {
        const logger = mockLogger();
        logDenied(logger, publicUser, input, resource, 'reason');
        expect(logger.permission).toHaveBeenCalledWith({
            permission: 'UNKNOWN_PERMISSION',
            userId: publicUser.id,
            role: publicUser.role,
            extraData: { input, visibility: resource.visibility, error: 'reason' }
        });
    });

    it('logGrant logs correct structure', () => {
        const logger = mockLogger();
        logGrant(logger, user, input, resource, PermissionEnum.ACCOMMODATION_CREATE, 'created');
        expect(logger.permission).toHaveBeenCalledWith({
            permission: PermissionEnum.ACCOMMODATION_CREATE,
            userId: user.id,
            role: user.role,
            extraData: {
                input,
                visibility: resource.visibility,
                access: 'granted',
                reason: 'created',
                actor: { id: user.id, role: user.role }
            }
        });
    });

    it('logUserDisabled logs correct structure', () => {
        const logger = mockLogger();
        logUserDisabled(logger, user, input, resource, PermissionEnum.ACCOMMODATION_UPDATE_OWN);
        expect(logger.permission).toHaveBeenCalledWith({
            permission: PermissionEnum.ACCOMMODATION_UPDATE_OWN,
            userId: user.id,
            role: user.role,
            extraData: {
                input,
                visibility: resource.visibility,
                access: 'denied',
                reason: 'user disabled',
                actor: { id: user.id, role: user.role }
            }
        });
    });

    it('logOverride logs correct structure', () => {
        const logger = mockLogger();
        logOverride(
            logger,
            input,
            PermissionEnum.ACCOMMODATION_VIEW_ALL,
            'Forced visibility=PUBLIC'
        );
        expect(logger.permission).toHaveBeenCalledWith({
            permission: PermissionEnum.ACCOMMODATION_VIEW_ALL,
            userId: 'public',
            role: RoleEnum.GUEST,
            extraData: { input, override: 'Forced visibility=PUBLIC' }
        });
    });
});
