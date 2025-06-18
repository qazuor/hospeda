/**
 * service-logger.test.ts
 *
 * Tests for service-logger util.
 */

import { describe, expect, it, vi } from 'vitest';
import { serviceLogger } from '../../src/utils/service-logger';
import '../setupTest';
import { mockPermissionParams } from './service-logger.mockData';

describe('serviceLogger util', () => {
    it('should have a permission method', () => {
        expect(typeof serviceLogger.permission).toBe('function');
    });

    it('calls the permission method with correct params', () => {
        // Arrange
        const spy = vi.spyOn(serviceLogger, 'permission');
        // Act
        serviceLogger.permission(mockPermissionParams);
        // Assert
        expect(spy).toHaveBeenCalledWith(mockPermissionParams);
        spy.mockRestore();
    });
});
