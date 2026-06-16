/**
 * Unit tests for plan.audit.ts
 *
 * Covers:
 * - diffPlanFields: all branch paths (added, removed, changed, unchanged)
 * - insertPlanAuditLog: happy path delegation to drizzle
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { diffPlanFields, insertPlanAuditLog } from '../../src/services/billing/plan/plan.audit.js';

// ---------------------------------------------------------------------------
// diffPlanFields — pure function, no mocking needed
// ---------------------------------------------------------------------------

describe('diffPlanFields()', () => {
    it('should return empty diff when objects are identical', () => {
        // Arrange
        const before = { name: 'Basic', active: true, sortOrder: 1 };
        const after = { name: 'Basic', active: true, sortOrder: 1 };

        // Act
        const result = diffPlanFields(before, after);

        // Assert
        expect(result.added).toEqual({});
        expect(result.removed).toEqual({});
        expect(result.changed).toEqual({});
    });

    it('should detect added fields (present in after but not before)', () => {
        // Arrange
        const before = { name: 'Basic' };
        const after = { name: 'Basic', active: true, newField: 'value' };

        // Act
        const result = diffPlanFields(before, after);

        // Assert
        expect(result.added).toEqual({ active: true, newField: 'value' });
        expect(result.removed).toEqual({});
        expect(result.changed).toEqual({});
    });

    it('should detect removed fields (present in before but not after)', () => {
        // Arrange
        const before = { name: 'Basic', obsolete: 'data', deprecated: 42 };
        const after = { name: 'Basic' };

        // Act
        const result = diffPlanFields(before, after);

        // Assert
        expect(result.added).toEqual({});
        expect(result.removed).toEqual({ obsolete: 'data', deprecated: 42 });
        expect(result.changed).toEqual({});
    });

    it('should detect changed fields (present in both but values differ)', () => {
        // Arrange
        const before = { name: 'Basic', active: true, sortOrder: 1 };
        const after = { name: 'Premium', active: false, sortOrder: 1 };

        // Act
        const result = diffPlanFields(before, after);

        // Assert
        expect(result.added).toEqual({});
        expect(result.removed).toEqual({});
        expect(result.changed).toEqual({
            name: { before: 'Basic', after: 'Premium' },
            active: { before: true, after: false }
        });
    });

    it('should not flag unchanged fields as changed', () => {
        // Arrange
        const before = { a: 1, b: 'same', c: true };
        const after = { a: 2, b: 'same', c: true };

        // Act
        const result = diffPlanFields(before, after);

        // Assert
        expect(Object.keys(result.changed)).toEqual(['a']);
        expect(result.changed.a).toEqual({ before: 1, after: 2 });
    });

    it('should handle all three diff types simultaneously', () => {
        // Arrange
        const before = { kept: 'same', changed: 'old', removed: 'gone' };
        const after = { kept: 'same', changed: 'new', added: 'fresh' };

        // Act
        const result = diffPlanFields(before, after);

        // Assert
        expect(result.added).toEqual({ added: 'fresh' });
        expect(result.removed).toEqual({ removed: 'gone' });
        expect(result.changed).toEqual({ changed: { before: 'old', after: 'new' } });
    });

    it('should deep-compare nested objects using JSON stringify', () => {
        // Arrange
        const before = { metadata: { key: 'value', nested: { a: 1 } } };
        const after = { metadata: { key: 'value', nested: { a: 2 } } };

        // Act
        const result = diffPlanFields(before, after);

        // Assert
        expect(result.changed.metadata).toEqual({
            before: { key: 'value', nested: { a: 1 } },
            after: { key: 'value', nested: { a: 2 } }
        });
    });

    it('should handle empty objects', () => {
        // Arrange & Act
        const result = diffPlanFields({}, {});

        // Assert
        expect(result.added).toEqual({});
        expect(result.removed).toEqual({});
        expect(result.changed).toEqual({});
    });

    it('should handle null/undefined values as field values', () => {
        // Arrange
        const before = { field: null as unknown };
        const after = { field: undefined as unknown };

        // Act
        const result = diffPlanFields(before, after);

        // Assert — null !== undefined when stringified
        expect(result.changed.field).toBeDefined();
    });
});

// ---------------------------------------------------------------------------
// insertPlanAuditLog — requires a Drizzle mock
// ---------------------------------------------------------------------------

describe('insertPlanAuditLog()', () => {
    const mockValuesChain = { values: vi.fn().mockResolvedValue(undefined) };
    const mockDb = {
        insert: vi.fn().mockReturnValue(mockValuesChain)
    };

    beforeEach(() => {
        vi.clearAllMocks();
        mockValuesChain.values.mockResolvedValue(undefined);
        mockDb.insert.mockReturnValue(mockValuesChain);
    });

    it('should insert an audit log entry with all provided fields', async () => {
        // Arrange
        const input = {
            action: 'plan_created',
            planId: 'plan-uuid-1',
            actorId: 'admin-uuid',
            changes: { name: 'Basic', active: true },
            previousValues: null,
            livemode: false
        };

        // Act
        await insertPlanAuditLog(mockDb as never, input);

        // Assert
        expect(mockDb.insert).toHaveBeenCalledOnce();
        expect(mockValuesChain.values).toHaveBeenCalledWith(
            expect.objectContaining({
                action: 'plan_created',
                entityType: 'plan',
                entityId: 'plan-uuid-1',
                actorId: 'admin-uuid',
                actorType: 'admin',
                changes: { name: 'Basic', active: true },
                previousValues: null,
                livemode: false
            })
        );
    });

    it('should set actorType to "system" when actorId is null', async () => {
        // Arrange
        const input = {
            action: 'plan_auto_updated',
            planId: 'plan-uuid-2',
            actorId: null,
            changes: { active: false },
            previousValues: { active: true },
            livemode: true
        };

        // Act
        await insertPlanAuditLog(mockDb as never, input);

        // Assert
        expect(mockValuesChain.values).toHaveBeenCalledWith(
            expect.objectContaining({
                actorId: null,
                actorType: 'system',
                livemode: true
            })
        );
    });

    it('should pass ipAddress and userAgent as null', async () => {
        // Arrange
        const input = {
            action: 'plan_deleted',
            planId: 'plan-uuid-3',
            actorId: 'admin-2',
            changes: null,
            previousValues: { name: 'Old Plan' },
            livemode: false
        };

        // Act
        await insertPlanAuditLog(mockDb as never, input);

        // Assert
        expect(mockValuesChain.values).toHaveBeenCalledWith(
            expect.objectContaining({
                ipAddress: null,
                userAgent: null
            })
        );
    });
});
