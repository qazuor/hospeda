/**
 * Tests for permission HTTP schema converter functions.
 *
 * Verifies:
 * - PermissionSearchHttpSchema accepts string query parameters
 * - httpToDomainPermissionSearch passes through coerced data
 */
import { describe, expect, it } from 'vitest';
import {
    PermissionSearchHttpSchema,
    httpToDomainPermissionSearch
} from '../../../src/entities/permission/permission.http.schema.js';

// ---------------------------------------------------------------------------
// PermissionSearchHttpSchema — query string parsing
// ---------------------------------------------------------------------------

describe('PermissionSearchHttpSchema — safeParse', () => {
    it('should accept an empty object (all fields optional)', () => {
        const result = PermissionSearchHttpSchema.safeParse({});
        expect(result.success).toBe(true);
    });

    it('should accept role and permission string filters', () => {
        const result = PermissionSearchHttpSchema.safeParse({
            role: 'ADMIN',
            permission: 'manage:users'
        });
        expect(result.success).toBe(true);
    });

    it('should coerce isActive from string to boolean', () => {
        const result = PermissionSearchHttpSchema.safeParse({ isActive: 'true' });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.isActive).toBe(true);
        }
    });

    it('should coerce isSystem from string "false" to boolean false', () => {
        const result = PermissionSearchHttpSchema.safeParse({ isSystem: 'false' });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.isSystem).toBe(false);
        }
    });

    it('should accept roles array filter as comma-separated string', () => {
        const result = PermissionSearchHttpSchema.safeParse({ roles: 'ADMIN,HOST' });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.roles).toEqual(['ADMIN', 'HOST']);
        }
    });

    it('should accept permissions array filter as comma-separated string', () => {
        const result = PermissionSearchHttpSchema.safeParse({
            permissions: 'manage:users,view:dashboard'
        });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.permissions).toEqual(['manage:users', 'view:dashboard']);
        }
    });

    it('should accept pagination fields', () => {
        const result = PermissionSearchHttpSchema.safeParse({ page: '2', pageSize: '20' });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.page).toBe(2);
            expect(result.data.pageSize).toBe(20);
        }
    });
});

// ---------------------------------------------------------------------------
// httpToDomainPermissionSearch — identity pass-through
// ---------------------------------------------------------------------------

describe('httpToDomainPermissionSearch', () => {
    it('should return the same object structure (pass-through)', () => {
        // Arrange
        const parsed = PermissionSearchHttpSchema.parse({
            role: 'ADMIN',
            permission: 'manage:users',
            isActive: 'true',
            isSystem: 'false',
            page: '1',
            pageSize: '10'
        });

        // Act
        const result = httpToDomainPermissionSearch(parsed);

        // Assert
        expect(result.role).toBe('ADMIN');
        expect(result.permission).toBe('manage:users');
        expect(result.isActive).toBe(true);
        expect(result.isSystem).toBe(false);
        expect(result.page).toBe(1);
        expect(result.pageSize).toBe(10);
    });

    it('should preserve roles array when provided', () => {
        // Arrange
        const parsed = PermissionSearchHttpSchema.parse({
            roles: 'HOST,USER'
        });

        // Act
        const result = httpToDomainPermissionSearch(parsed);

        // Assert
        expect(result.roles).toEqual(['HOST', 'USER']);
    });

    it('should preserve permissions array when provided', () => {
        // Arrange
        const parsed = PermissionSearchHttpSchema.parse({
            permissions: 'view:posts'
        });

        // Act
        const result = httpToDomainPermissionSearch(parsed);

        // Assert
        expect(result.permissions).toEqual(['view:posts']);
    });

    it('should handle empty input with all-undefined fields', () => {
        // Arrange
        const parsed = PermissionSearchHttpSchema.parse({});

        // Act
        const result = httpToDomainPermissionSearch(parsed);

        // Assert
        expect(result.role).toBeUndefined();
        expect(result.isActive).toBeUndefined();
        expect(result.isSystem).toBeUndefined();
    });
});
