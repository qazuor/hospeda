/**
 * baseServiceFactory.ts - Factory for base service mock data
 * Provides standardized mock data generation for base service testing
 */

import type { BaseModel } from '@repo/db';
import { vi } from 'vitest';

/**
 * Creates a mock base model with standard methods
 */
export const createMockBaseModel = <T = any>(): BaseModel<T> => {
    const mockModel = {
        findById: vi.fn(),
        findAll: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        softDelete: vi.fn(),
        hardDelete: vi.fn(),
        restore: vi.fn(),
        count: vi.fn(),
        search: vi.fn(),
        findBySlug: vi.fn(),
        findByName: vi.fn(),
        exists: vi.fn(),
        validate: vi.fn(),
        // Database connection and transaction methods
        db: {} as any,
        entityName: 'test',
        table: {} as any,
        // Audit methods
        setAuditFields: vi.fn(),
        applyPagination: vi.fn(),
        buildSelectQuery: vi.fn(),
        buildWhereClause: vi.fn(),
        // Common query builders
        withSoftDeleted: vi.fn(),
        onlyTrashed: vi.fn(),
        withoutGlobalScopes: vi.fn()
    } as any;

    return mockModel;
};
