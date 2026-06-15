/**
 * Tests for user HTTP schema converter functions.
 *
 * Verifies:
 * - UserSearchHttpSchema coerces string query params to typed fields
 * - httpToDomainUserSearch maps to domain search input
 * - httpToDomainUserCreate sets required domain defaults
 * - httpToDomainUserUpdate maps partial HTTP fields to domain update input
 */
import { describe, expect, it } from 'vitest';
import {
    UserSearchHttpSchema,
    httpToDomainUserCreate,
    httpToDomainUserSearch,
    httpToDomainUserUpdate
} from '../../../src/entities/user/user.http.schema.js';
import { RoleEnum } from '../../../src/enums/index.js';
import { LifecycleStatusEnum } from '../../../src/enums/lifecycle-state.enum.js';
import { VisibilityEnum } from '../../../src/enums/visibility.enum.js';

// ---------------------------------------------------------------------------
// UserSearchHttpSchema — query string parsing
// ---------------------------------------------------------------------------

describe('UserSearchHttpSchema — safeParse', () => {
    it('should accept an empty object', () => {
        const result = UserSearchHttpSchema.safeParse({});
        expect(result.success).toBe(true);
    });

    it('should accept valid email filter', () => {
        const result = UserSearchHttpSchema.safeParse({ email: 'user@example.com' });
        expect(result.success).toBe(true);
    });

    it('should reject invalid email', () => {
        const result = UserSearchHttpSchema.safeParse({ email: 'not-an-email' });
        expect(result.success).toBe(false);
    });

    it('should coerce isEmailVerified from string "true" to boolean', () => {
        const result = UserSearchHttpSchema.safeParse({ isEmailVerified: 'true' });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.isEmailVerified).toBe(true);
        }
    });

    it('should coerce isActive from string "false" to boolean', () => {
        const result = UserSearchHttpSchema.safeParse({ isActive: 'false' });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.isActive).toBe(false);
        }
    });

    it('should coerce minAge and maxAge from strings to numbers', () => {
        const result = UserSearchHttpSchema.safeParse({ minAge: '18', maxAge: '65' });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.minAge).toBe(18);
            expect(result.data.maxAge).toBe(65);
        }
    });

    it('should accept valid role enum filter', () => {
        const result = UserSearchHttpSchema.safeParse({ role: RoleEnum.ADMIN });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.role).toBe(RoleEnum.ADMIN);
        }
    });

    it('should accept roles array filter as comma-separated string', () => {
        const result = UserSearchHttpSchema.safeParse({ roles: 'ADMIN,HOST' });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.roles).toEqual(['ADMIN', 'HOST']);
        }
    });
});

// ---------------------------------------------------------------------------
// httpToDomainUserSearch
// ---------------------------------------------------------------------------

describe('httpToDomainUserSearch', () => {
    it('should map pagination fields to domain search', () => {
        // Arrange
        const parsed = UserSearchHttpSchema.parse({ page: '2', pageSize: '15' });

        // Act
        const result = httpToDomainUserSearch(parsed);

        // Assert
        expect(result.page).toBe(2);
        expect(result.pageSize).toBe(15);
    });

    it('should include role filter in domain output', () => {
        // Arrange
        const parsed = UserSearchHttpSchema.parse({ role: RoleEnum.HOST });

        // Act
        const result = httpToDomainUserSearch(parsed);

        // Assert
        expect(result.role).toBe(RoleEnum.HOST);
    });

    it('should include isActive boolean in domain output', () => {
        // Arrange
        const parsed = UserSearchHttpSchema.parse({ isActive: 'true' });

        // Act
        const result = httpToDomainUserSearch(parsed);

        // Assert
        expect(result.isActive).toBe(true);
    });

    it('should include isEmailVerified boolean in domain output', () => {
        // Arrange
        const parsed = UserSearchHttpSchema.parse({ isEmailVerified: 'false' });

        // Act
        const result = httpToDomainUserSearch(parsed);

        // Assert
        expect(result.isEmailVerified).toBe(false);
    });

    it('should include age range filters in domain output', () => {
        // Arrange
        const parsed = UserSearchHttpSchema.parse({ minAge: '21', maxAge: '60' });

        // Act
        const result = httpToDomainUserSearch(parsed);

        // Assert
        expect(result.minAge).toBe(21);
        expect(result.maxAge).toBe(60);
    });

    it('should include date range filters in domain output', () => {
        // Arrange
        const parsed = UserSearchHttpSchema.parse({
            createdAfter: '2024-01-01',
            createdBefore: '2024-12-31',
            lastLoginAfter: '2024-06-01',
            lastLoginBefore: '2024-06-30'
        });

        // Act
        const result = httpToDomainUserSearch(parsed);

        // Assert
        expect(result.createdAfter).toBeInstanceOf(Date);
        expect(result.createdBefore).toBeInstanceOf(Date);
        expect(result.lastLoginAfter).toBeInstanceOf(Date);
        expect(result.lastLoginBefore).toBeInstanceOf(Date);
    });

    it('should not include email in domain output (privacy)', () => {
        // Arrange
        const parsed = UserSearchHttpSchema.parse({ email: 'user@example.com' });

        // Act
        const result = httpToDomainUserSearch(parsed);

        // Assert — email exists in HTTP schema but not in domain search for privacy
        expect((result as Record<string, unknown>).email).toBeUndefined();
    });

    it('should handle empty input with all-undefined domain fields', () => {
        // Arrange
        const parsed = UserSearchHttpSchema.parse({});

        // Act
        const result = httpToDomainUserSearch(parsed);

        // Assert
        expect(result.role).toBeUndefined();
        expect(result.isActive).toBeUndefined();
        expect(result.isEmailVerified).toBeUndefined();
    });
});

// ---------------------------------------------------------------------------
// httpToDomainUserCreate
// ---------------------------------------------------------------------------

describe('httpToDomainUserCreate', () => {
    it('should map required fields to domain create input', () => {
        // Arrange
        const httpData = {
            email: 'host@example.com',
            firstName: 'Alice',
            lastName: 'Smith',
            role: RoleEnum.HOST,
            status: 'pending' as const
        };

        // Act
        const result = httpToDomainUserCreate(httpData);

        // Assert
        expect(result.email).toBe('host@example.com');
        expect(result.firstName).toBe('Alice');
        expect(result.lastName).toBe('Smith');
    });

    it('should set emailVerified to false by default', () => {
        // Arrange
        const httpData = {
            email: 'user@example.com',
            firstName: 'Bob',
            lastName: 'Jones',
            role: RoleEnum.USER,
            status: 'pending' as const
        };

        // Act
        const result = httpToDomainUserCreate(httpData);

        // Assert
        expect(result.emailVerified).toBe(false);
    });

    it('should set lifecycleState to ACTIVE by default', () => {
        // Arrange
        const httpData = {
            email: 'user@example.com',
            firstName: 'Carol',
            lastName: 'Williams',
            role: RoleEnum.USER,
            status: 'pending' as const
        };

        // Act
        const result = httpToDomainUserCreate(httpData);

        // Assert
        expect(result.lifecycleState).toBe(LifecycleStatusEnum.ACTIVE);
    });

    it('should set visibility to PUBLIC by default', () => {
        // Arrange
        const httpData = {
            email: 'user@example.com',
            firstName: 'Dan',
            lastName: 'Brown',
            role: RoleEnum.GUEST,
            status: 'pending' as const
        };

        // Act
        const result = httpToDomainUserCreate(httpData);

        // Assert
        expect(result.visibility).toBe(VisibilityEnum.PUBLIC);
    });

    it('should set permissions to empty array by default', () => {
        // Arrange
        const httpData = {
            email: 'user@example.com',
            firstName: 'Eve',
            lastName: 'Davis',
            role: RoleEnum.USER,
            status: 'pending' as const
        };

        // Act
        const result = httpToDomainUserCreate(httpData);

        // Assert
        expect(result.permissions).toEqual([]);
    });

    it('should generate a slug from firstName and lastName', () => {
        // Arrange
        const httpData = {
            email: 'user@example.com',
            firstName: 'Frank',
            lastName: 'Miller',
            role: RoleEnum.USER,
            status: 'pending' as const
        };

        // Act
        const result = httpToDomainUserCreate(httpData);

        // Assert
        expect(result.slug).toMatch(/^frank-miller-\d+$/);
    });

    it('should map email to personalEmail in contactInfo', () => {
        // Arrange
        const httpData = {
            email: 'contact@example.com',
            firstName: 'Grace',
            lastName: 'Lee',
            role: RoleEnum.USER,
            status: 'pending' as const
        };

        // Act
        const result = httpToDomainUserCreate(httpData);

        // Assert
        expect(result.contactInfo).toBeDefined();
        expect(result.contactInfo?.personalEmail).toBe('contact@example.com');
    });

    it('should use provided phone in mobilePhone when given', () => {
        // Arrange
        const httpData = {
            email: 'user@example.com',
            firstName: 'Henry',
            lastName: 'Wilson',
            phone: '+5491112345678',
            role: RoleEnum.USER,
            status: 'pending' as const
        };

        // Act
        const result = httpToDomainUserCreate(httpData);

        // Assert
        expect(result.contactInfo).toBeDefined();
        expect(result.contactInfo?.mobilePhone).toBe('+5491112345678');
    });
});

// ---------------------------------------------------------------------------
// httpToDomainUserUpdate
// ---------------------------------------------------------------------------

describe('httpToDomainUserUpdate', () => {
    it('should map firstName to domain update input', () => {
        // Arrange
        const httpData = { firstName: 'Updated' };

        // Act
        const result = httpToDomainUserUpdate(httpData);

        // Assert
        expect(result.firstName).toBe('Updated');
    });

    it('should map lastName to domain update input', () => {
        // Arrange
        const httpData = { lastName: 'UpdatedLast' };

        // Act
        const result = httpToDomainUserUpdate(httpData);

        // Assert
        expect(result.lastName).toBe('UpdatedLast');
    });

    it('should map role to domain update input', () => {
        // Arrange
        const httpData = { role: RoleEnum.EDITOR };

        // Act
        const result = httpToDomainUserUpdate(httpData);

        // Assert
        expect(result.role).toBe(RoleEnum.EDITOR);
    });

    it('should handle empty update payload', () => {
        // Arrange
        const httpData = {};

        // Act
        const result = httpToDomainUserUpdate(httpData);

        // Assert
        expect(result.firstName).toBeUndefined();
        expect(result.lastName).toBeUndefined();
        expect(result.role).toBeUndefined();
    });
});
