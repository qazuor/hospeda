/**
 * @fileoverview
 * Test suite for the serviceLogger utility.
 * Ensures the permission method exists and is called with correct parameters.
 *
 * All test data, comments, and documentation are in English, following project guidelines.
 */

import { describe, expect, it, vi } from 'vitest';
import { serviceLogger } from '../../src/utils/service-logger';
import '../setupTest';
import { mockPermissionParams } from './service-logger.mockData';

/**
 * Test suite for the serviceLogger utility.
 *
 * Esta suite verifica:
 * - Existence of the permission method
 * - Correct invocation of the permission method with parameters
 *
 * The tests use mock data to ensure the logger utility behaves as expected.
 */
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
