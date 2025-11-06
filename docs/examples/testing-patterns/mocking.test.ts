/**
 * Mocking Patterns
 *
 * This file demonstrates various mocking strategies for testing:
 * - Mocking database calls with vi.fn()
 * - Mocking external services
 * - Mocking actor context
 * - Spy patterns with vi.spyOn()
 * - Stub patterns
 * - Partial mocking
 *
 * Mocking allows you to isolate the code under test from its dependencies,
 * enabling faster, more reliable, and more focused tests.
 */

import { CategoryModel } from '@repo/db';
import type { CategoryIdType } from '@repo/schemas';
import { PermissionEnum, RoleEnum, ServiceErrorCode } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CategoryService } from '../../../src/services/category/category.service';
import type { Actor } from '../../../src/types';
import { createActor } from '../../factories/actorFactory';
import { createMockCategory } from '../../factories/categoryFactory';
import { getMockId } from '../../factories/utilsFactory';

// ============================================================================
// BASIC MOCKING WITH vi.fn()
// ============================================================================

describe('Mocking Patterns - Basic vi.fn()', () => {
    it('should mock a simple function', () => {
        // Arrange - Create a mock function
        const mockFn = vi.fn();

        // Configure mock to return specific value
        mockFn.mockReturnValue('mocked result');

        // Act
        const result = mockFn('test input');

        // Assert
        expect(result).toBe('mocked result');
        expect(mockFn).toHaveBeenCalledTimes(1);
        expect(mockFn).toHaveBeenCalledWith('test input');
    });

    it('should mock with different return values for consecutive calls', () => {
        // Arrange
        const mockFn = vi.fn();

        mockFn
            .mockReturnValueOnce('first call')
            .mockReturnValueOnce('second call')
            .mockReturnValue('default');

        // Act & Assert
        expect(mockFn()).toBe('first call');
        expect(mockFn()).toBe('second call');
        expect(mockFn()).toBe('default');
        expect(mockFn()).toBe('default');
    });

    it('should mock async functions with promises', async () => {
        // Arrange
        const mockAsyncFn = vi.fn();

        mockAsyncFn.mockResolvedValue({ id: '123', name: 'Test' });

        // Act
        const result = await mockAsyncFn();

        // Assert
        expect(result).toEqual({ id: '123', name: 'Test' });
    });

    it('should mock async functions to reject', async () => {
        // Arrange
        const mockAsyncFn = vi.fn();

        mockAsyncFn.mockRejectedValue(new Error('Mock error'));

        // Act & Assert
        await expect(mockAsyncFn()).rejects.toThrow('Mock error');
    });
});

// ============================================================================
// MOCKING DATABASE CALLS WITH vi.spyOn()
// ============================================================================

describe('Mocking Patterns - Database with vi.spyOn()', () => {
    let service: CategoryService;
    let mockModel: CategoryModel;

    beforeEach(() => {
        // Create real model instance
        mockModel = new CategoryModel();

        // Create service with model
        service = new CategoryService({ logger: console }, mockModel);
    });

    it('should spy on model.findById', async () => {
        // Arrange
        const mockCategory = createMockCategory({ name: 'Mocked Category' });
        const categoryId = mockCategory.id;

        // Spy on the method and mock its return value
        const findByIdSpy = vi.spyOn(mockModel, 'findById').mockResolvedValue(mockCategory);

        const actor = createActor({ role: RoleEnum.ADMIN });

        // Act
        const result = await service.getById(actor, categoryId);

        // Assert
        expect(result.data).toBeDefined();
        expect(result.data?.name).toBe('Mocked Category');
        expect(findByIdSpy).toHaveBeenCalledTimes(1);
        expect(findByIdSpy).toHaveBeenCalledWith(categoryId);

        // Cleanup
        findByIdSpy.mockRestore();
    });

    it('should mock create operation', async () => {
        // Arrange
        const createData = {
            name: 'New Category',
            slug: 'new-category'
        };

        const createdCategory = createMockCategory(createData);

        const createSpy = vi.spyOn(mockModel, 'create').mockResolvedValue(createdCategory);

        const actor = createActor({ role: RoleEnum.ADMIN });

        // Act
        const result = await service.create(actor, createData);

        // Assert
        expect(result.data).toBeDefined();
        expect(createSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                name: 'New Category',
                slug: 'new-category'
            }),
            undefined // No transaction
        );

        createSpy.mockRestore();
    });

    it('should mock update operation', async () => {
        // Arrange
        const existingCategory = createMockCategory({ name: 'Old Name' });
        const updatedCategory = createMockCategory({ ...existingCategory, name: 'New Name' });

        vi.spyOn(mockModel, 'findById').mockResolvedValue(existingCategory);
        const updateSpy = vi.spyOn(mockModel, 'update').mockResolvedValue(updatedCategory);

        const actor = createActor({ role: RoleEnum.ADMIN });

        // Act
        const result = await service.update(actor, existingCategory.id, { name: 'New Name' });

        // Assert
        expect(result.data?.name).toBe('New Name');
        expect(updateSpy).toHaveBeenCalledWith(
            existingCategory.id,
            expect.objectContaining({ name: 'New Name' }),
            undefined
        );
    });

    it('should mock list operation with pagination', async () => {
        // Arrange
        const mockCategories = [
            createMockCategory({ name: 'Category 1' }),
            createMockCategory({ name: 'Category 2' }),
            createMockCategory({ name: 'Category 3' })
        ];

        const findAllSpy = vi.spyOn(mockModel, 'findAll').mockResolvedValue({
            items: mockCategories,
            total: 3
        });

        const actor = createActor({ role: RoleEnum.USER });

        // Act
        const result = await service.list(actor, { page: 1, pageSize: 10 });

        // Assert
        expect(result.data?.items).toHaveLength(3);
        expect(findAllSpy).toHaveBeenCalled();
    });
});

// ============================================================================
// MOCKING ACTOR CONTEXT
// ============================================================================

describe('Mocking Patterns - Actor Context', () => {
    let service: CategoryService;
    let mockModel: CategoryModel;

    beforeEach(() => {
        mockModel = new CategoryModel();
        service = new CategoryService({ logger: console }, mockModel);

        // Mock common model methods
        vi.spyOn(mockModel, 'findById').mockResolvedValue(createMockCategory());
        vi.spyOn(mockModel, 'create').mockResolvedValue(createMockCategory());
    });

    it('should mock admin actor', async () => {
        // Arrange - Create admin actor
        const adminActor: Actor = {
            id: 'admin-123',
            role: RoleEnum.ADMIN,
            permissions: [
                PermissionEnum.CATEGORY_CREATE,
                PermissionEnum.CATEGORY_UPDATE,
                PermissionEnum.CATEGORY_DELETE
            ]
        };

        // Act - Admin can create
        const result = await service.create(adminActor, {
            name: 'Test',
            slug: 'test'
        });

        // Assert
        expect(result.data).toBeDefined();
        expect(result.error).toBeUndefined();
    });

    it('should mock user actor without permissions', async () => {
        // Arrange - Create user without create permission
        const userActor: Actor = {
            id: 'user-123',
            role: RoleEnum.USER,
            permissions: [] // No permissions
        };

        // Act - User cannot create
        const result = await service.create(userActor, {
            name: 'Test',
            slug: 'test'
        });

        // Assert
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
    });

    it('should mock guest actor', async () => {
        // Arrange - Create guest actor (anonymous)
        const guestActor: Actor = {
            id: '',
            role: RoleEnum.GUEST,
            permissions: []
        };

        // Act - Guest can view (public operation)
        const result = await service.getById(guestActor, getMockId('category') as CategoryIdType);

        // Assert
        expect(result.data).toBeDefined();
    });
});

// ============================================================================
// STUB PATTERNS - PARTIAL MOCKING
// ============================================================================

describe('Mocking Patterns - Stubs and Partial Mocking', () => {
    it('should create stub with partial data', () => {
        // Arrange - Create stub with only needed properties
        const categoryStub = {
            id: 'cat-123' as CategoryIdType,
            name: 'Stub Category',
            slug: 'stub-category'
            // Other properties omitted
        };

        // Act - Use stub in test
        const name = categoryStub.name;

        // Assert
        expect(name).toBe('Stub Category');
    });

    it('should use factory with partial overrides', () => {
        // Arrange - Use factory but override specific fields
        const category = createMockCategory({
            name: 'Custom Name'
            // Factory provides all other fields
        });

        // Assert
        expect(category.name).toBe('Custom Name');
        expect(category.id).toBeDefined(); // From factory
        expect(category.createdAt).toBeDefined(); // From factory
    });
});

// ============================================================================
// MOCKING EXTERNAL SERVICES
// ============================================================================

/**
 * Mock external email service
 */
class EmailService {
    async sendEmail(to: string, subject: string, body: string): Promise<boolean> {
        // Real implementation would send email
        return true;
    }
}

describe('Mocking Patterns - External Services', () => {
    it('should mock external email service', async () => {
        // Arrange
        const emailService = new EmailService();
        const sendEmailSpy = vi.spyOn(emailService, 'sendEmail').mockResolvedValue(true);

        // Act
        const result = await emailService.sendEmail(
            'user@example.com',
            'Test Subject',
            'Test Body'
        );

        // Assert
        expect(result).toBe(true);
        expect(sendEmailSpy).toHaveBeenCalledWith(
            'user@example.com',
            'Test Subject',
            'Test Body'
        );
    });

    it('should mock external service failure', async () => {
        // Arrange
        const emailService = new EmailService();
        const sendEmailSpy = vi
            .spyOn(emailService, 'sendEmail')
            .mockRejectedValue(new Error('Email service unavailable'));

        // Act & Assert
        await expect(
            emailService.sendEmail('user@example.com', 'Subject', 'Body')
        ).rejects.toThrow('Email service unavailable');
    });
});

// ============================================================================
// VERIFICATION PATTERNS
// ============================================================================

describe('Mocking Patterns - Verification', () => {
    it('should verify function called exactly once', () => {
        const mockFn = vi.fn();
        mockFn('test');

        expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should verify function called with specific arguments', () => {
        const mockFn = vi.fn();
        mockFn('arg1', 'arg2', { key: 'value' });

        expect(mockFn).toHaveBeenCalledWith('arg1', 'arg2', { key: 'value' });
    });

    it('should verify function called with partial match', () => {
        const mockFn = vi.fn();
        mockFn({ id: '123', name: 'Test', extra: 'data' });

        expect(mockFn).toHaveBeenCalledWith(
            expect.objectContaining({
                id: '123',
                name: 'Test'
                // Don't care about 'extra'
            })
        );
    });

    it('should verify function never called', () => {
        const mockFn = vi.fn();

        expect(mockFn).not.toHaveBeenCalled();
    });

    it('should verify function call order', () => {
        const mockFn = vi.fn();

        mockFn('first');
        mockFn('second');
        mockFn('third');

        expect(mockFn).toHaveBeenNthCalledWith(1, 'first');
        expect(mockFn).toHaveBeenNthCalledWith(2, 'second');
        expect(mockFn).toHaveBeenNthCalledWith(3, 'third');
    });
});

// ============================================================================
// RESET AND CLEANUP
// ============================================================================

describe('Mocking Patterns - Cleanup', () => {
    it('should clear mock calls between tests', () => {
        const mockFn = vi.fn();

        // First call
        mockFn('test');
        expect(mockFn).toHaveBeenCalledTimes(1);

        // Clear call history
        mockFn.mockClear();

        // Verify cleared
        expect(mockFn).toHaveBeenCalledTimes(0);

        // Second call
        mockFn('test2');
        expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should reset mock implementation', () => {
        const mockFn = vi.fn();

        // Set implementation
        mockFn.mockReturnValue('mocked');
        expect(mockFn()).toBe('mocked');

        // Reset implementation
        mockFn.mockReset();

        // Returns undefined after reset
        expect(mockFn()).toBeUndefined();
    });

    it('should restore original implementation', () => {
        const obj = {
            method: () => 'original'
        };

        const spy = vi.spyOn(obj, 'method').mockReturnValue('mocked');

        expect(obj.method()).toBe('mocked');

        // Restore original
        spy.mockRestore();

        expect(obj.method()).toBe('original');
    });
});
