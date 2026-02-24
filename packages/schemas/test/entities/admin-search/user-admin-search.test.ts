import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { UserAdminSearchSchema } from '../../../src/index.js';

describe('UserAdminSearchSchema', () => {
    describe('base schema defaults', () => {
        it('should apply all base defaults when parsing empty object', () => {
            // Arrange & Act
            const result = UserAdminSearchSchema.parse({});

            // Assert
            expect(result.page).toBe(1);
            expect(result.pageSize).toBe(20);
            expect(result.sort).toBe('createdAt:desc');
            expect(result.status).toBe('all');
            expect(result.includeDeleted).toBe(false);
        });

        it('should leave optional base fields undefined when not provided', () => {
            // Arrange & Act
            const result = UserAdminSearchSchema.parse({});

            // Assert
            expect(result.search).toBeUndefined();
            expect(result.createdAfter).toBeUndefined();
            expect(result.createdBefore).toBeUndefined();
        });

        it('should leave user-specific optional fields undefined when not provided', () => {
            // Arrange & Act
            const result = UserAdminSearchSchema.parse({});

            // Assert
            expect(result.role).toBeUndefined();
            expect(result.email).toBeUndefined();
            expect(result.authProvider).toBeUndefined();
        });
    });

    describe('page', () => {
        it('should accept valid page numbers', () => {
            // Arrange & Act & Assert
            expect(UserAdminSearchSchema.parse({ page: 1 }).page).toBe(1);
            expect(UserAdminSearchSchema.parse({ page: 100 }).page).toBe(100);
        });

        it('should coerce string to number', () => {
            // Arrange & Act
            const result = UserAdminSearchSchema.parse({ page: '3' });

            // Assert
            expect(result.page).toBe(3);
        });

        it('should reject zero or negative page', () => {
            // Arrange & Act & Assert
            expect(() => UserAdminSearchSchema.parse({ page: 0 })).toThrow(ZodError);
            expect(() => UserAdminSearchSchema.parse({ page: -1 })).toThrow(ZodError);
        });

        it('should reject non-integer page', () => {
            // Arrange & Act & Assert
            expect(() => UserAdminSearchSchema.parse({ page: 2.5 })).toThrow(ZodError);
        });
    });

    describe('pageSize', () => {
        it('should accept valid pageSize values', () => {
            // Arrange & Act & Assert
            expect(UserAdminSearchSchema.parse({ pageSize: 1 }).pageSize).toBe(1);
            expect(UserAdminSearchSchema.parse({ pageSize: 50 }).pageSize).toBe(50);
            expect(UserAdminSearchSchema.parse({ pageSize: 100 }).pageSize).toBe(100);
        });

        it('should coerce string to number', () => {
            // Arrange & Act
            const result = UserAdminSearchSchema.parse({ pageSize: '25' });

            // Assert
            expect(result.pageSize).toBe(25);
        });

        it('should reject pageSize over 100', () => {
            // Arrange & Act & Assert
            expect(() => UserAdminSearchSchema.parse({ pageSize: 101 })).toThrow(ZodError);
        });

        it('should reject zero or negative pageSize', () => {
            // Arrange & Act & Assert
            expect(() => UserAdminSearchSchema.parse({ pageSize: 0 })).toThrow(ZodError);
            expect(() => UserAdminSearchSchema.parse({ pageSize: -5 })).toThrow(ZodError);
        });
    });

    describe('includeDeleted', () => {
        it('should default to false', () => {
            // Arrange & Act
            const result = UserAdminSearchSchema.parse({});

            // Assert
            expect(result.includeDeleted).toBe(false);
        });

        it('should accept boolean true', () => {
            // Arrange & Act
            const result = UserAdminSearchSchema.parse({ includeDeleted: true });

            // Assert
            expect(result.includeDeleted).toBe(true);
        });

        it('should coerce string "true" to boolean true', () => {
            // Arrange & Act
            const result = UserAdminSearchSchema.parse({ includeDeleted: 'true' });

            // Assert
            expect(result.includeDeleted).toBe(true);
        });

        it('should coerce falsy values to false', () => {
            // Arrange & Act & Assert
            // z.coerce.boolean() uses Boolean() coercion: empty string and 0 are false
            expect(UserAdminSearchSchema.parse({ includeDeleted: '' }).includeDeleted).toBe(false);
            expect(UserAdminSearchSchema.parse({ includeDeleted: 0 }).includeDeleted).toBe(false);
        });
    });

    describe('role filter', () => {
        it('should accept SUPER_ADMIN role', () => {
            // Arrange & Act
            const result = UserAdminSearchSchema.parse({ role: 'SUPER_ADMIN' });

            // Assert
            expect(result.role).toBe('SUPER_ADMIN');
        });

        it('should accept ADMIN role', () => {
            // Arrange & Act
            const result = UserAdminSearchSchema.parse({ role: 'ADMIN' });

            // Assert
            expect(result.role).toBe('ADMIN');
        });

        it('should accept CLIENT_MANAGER role', () => {
            // Arrange & Act
            const result = UserAdminSearchSchema.parse({ role: 'CLIENT_MANAGER' });

            // Assert
            expect(result.role).toBe('CLIENT_MANAGER');
        });

        it('should accept EDITOR role', () => {
            // Arrange & Act
            const result = UserAdminSearchSchema.parse({ role: 'EDITOR' });

            // Assert
            expect(result.role).toBe('EDITOR');
        });

        it('should accept HOST role', () => {
            // Arrange & Act
            const result = UserAdminSearchSchema.parse({ role: 'HOST' });

            // Assert
            expect(result.role).toBe('HOST');
        });

        it('should accept SPONSOR role', () => {
            // Arrange & Act
            const result = UserAdminSearchSchema.parse({ role: 'SPONSOR' });

            // Assert
            expect(result.role).toBe('SPONSOR');
        });

        it('should accept USER role', () => {
            // Arrange & Act
            const result = UserAdminSearchSchema.parse({ role: 'USER' });

            // Assert
            expect(result.role).toBe('USER');
        });

        it('should accept GUEST role', () => {
            // Arrange & Act
            const result = UserAdminSearchSchema.parse({ role: 'GUEST' });

            // Assert
            expect(result.role).toBe('GUEST');
        });

        it('should reject invalid role value', () => {
            // Arrange & Act & Assert
            expect(() => UserAdminSearchSchema.parse({ role: 'INVALID_ROLE' })).toThrow(ZodError);
        });

        it('should reject lowercase role value', () => {
            // Arrange & Act & Assert
            expect(() => UserAdminSearchSchema.parse({ role: 'admin' })).toThrow(ZodError);
        });

        it('should be optional and remain undefined when omitted', () => {
            // Arrange & Act
            const result = UserAdminSearchSchema.parse({});

            // Assert
            expect(result.role).toBeUndefined();
        });
    });

    describe('email filter', () => {
        it('should accept a valid email string', () => {
            // Arrange & Act
            const result = UserAdminSearchSchema.parse({ email: 'user@example.com' });

            // Assert
            expect(result.email).toBe('user@example.com');
        });

        it('should accept a partial email for partial matching', () => {
            // Arrange & Act
            const result = UserAdminSearchSchema.parse({ email: 'john' });

            // Assert
            expect(result.email).toBe('john');
        });

        it('should accept empty string', () => {
            // Arrange & Act
            const result = UserAdminSearchSchema.parse({ email: '' });

            // Assert
            expect(result.email).toBe('');
        });

        it('should be optional and remain undefined when omitted', () => {
            // Arrange & Act
            const result = UserAdminSearchSchema.parse({});

            // Assert
            expect(result.email).toBeUndefined();
        });
    });

    describe('authProvider filter', () => {
        it('should accept a valid auth provider string', () => {
            // Arrange & Act
            const result = UserAdminSearchSchema.parse({ authProvider: 'google' });

            // Assert
            expect(result.authProvider).toBe('google');
        });

        it('should accept any string value for authProvider', () => {
            // Arrange & Act
            const result = UserAdminSearchSchema.parse({ authProvider: 'github' });

            // Assert
            expect(result.authProvider).toBe('github');
        });

        it('should accept email as auth provider', () => {
            // Arrange & Act
            const result = UserAdminSearchSchema.parse({ authProvider: 'email' });

            // Assert
            expect(result.authProvider).toBe('email');
        });

        it('should be optional and remain undefined when omitted', () => {
            // Arrange & Act
            const result = UserAdminSearchSchema.parse({});

            // Assert
            expect(result.authProvider).toBeUndefined();
        });
    });

    describe('combined filters', () => {
        it('should parse a complete admin search query with all user-specific fields', () => {
            // Arrange
            const input = {
                page: '2',
                pageSize: '50',
                search: 'john doe',
                sort: 'name:asc',
                status: 'ACTIVE',
                includeDeleted: 'true',
                createdAfter: '2025-01-01T00:00:00.000Z',
                createdBefore: '2025-12-31T23:59:59.999Z',
                role: 'HOST',
                email: 'john@example.com',
                authProvider: 'google'
            };

            // Act
            const result = UserAdminSearchSchema.parse(input);

            // Assert
            expect(result.page).toBe(2);
            expect(result.pageSize).toBe(50);
            expect(result.search).toBe('john doe');
            expect(result.sort).toBe('name:asc');
            expect(result.status).toBe('ACTIVE');
            expect(result.includeDeleted).toBe(true);
            expect(result.createdAfter).toBeInstanceOf(Date);
            expect(result.createdBefore).toBeInstanceOf(Date);
            expect(result.role).toBe('HOST');
            expect(result.email).toBe('john@example.com');
            expect(result.authProvider).toBe('google');
        });

        it('should parse with only role filter applied', () => {
            // Arrange & Act
            const result = UserAdminSearchSchema.parse({ role: 'EDITOR' });

            // Assert
            expect(result.page).toBe(1);
            expect(result.pageSize).toBe(20);
            expect(result.role).toBe('EDITOR');
            expect(result.email).toBeUndefined();
            expect(result.authProvider).toBeUndefined();
        });

        it('should parse with only email filter applied', () => {
            // Arrange & Act
            const result = UserAdminSearchSchema.parse({ email: '@hospeda.com' });

            // Assert
            expect(result.page).toBe(1);
            expect(result.role).toBeUndefined();
            expect(result.email).toBe('@hospeda.com');
            expect(result.authProvider).toBeUndefined();
        });

        it('should parse with only authProvider filter applied', () => {
            // Arrange & Act
            const result = UserAdminSearchSchema.parse({ authProvider: 'github' });

            // Assert
            expect(result.page).toBe(1);
            expect(result.role).toBeUndefined();
            expect(result.email).toBeUndefined();
            expect(result.authProvider).toBe('github');
        });
    });
});
