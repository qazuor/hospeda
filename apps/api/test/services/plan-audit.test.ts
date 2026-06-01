/**
 * Plan Audit Helper Tests — T-002
 *
 * Tests for `insertPlanAuditLog` and `diffPlanFields`.
 *
 * @module test/services/plan-audit
 */

import { diffPlanFields, insertPlanAuditLog } from '@repo/service-core';
import { describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@repo/db', () => ({
    billingAuditLogs: {
        id: 'id',
        action: 'action',
        entityType: 'entityType',
        entityId: 'entityId',
        actorId: 'actorId',
        actorType: 'actorType',
        changes: 'changes',
        previousValues: 'previousValues',
        livemode: 'livemode',
        ipAddress: 'ipAddress',
        userAgent: 'userAgent'
    }
}));

// ---------------------------------------------------------------------------
// diffPlanFields tests
// ---------------------------------------------------------------------------

describe('diffPlanFields', () => {
    describe('when snapshots are identical', () => {
        it('should return empty diff when objects are identical', () => {
            // Arrange
            const before = { active: true, sortOrder: 1, name: 'owner-basico' };
            const after = { active: true, sortOrder: 1, name: 'owner-basico' };

            // Act
            const result = diffPlanFields(before, after);

            // Assert
            expect(result.added).toEqual({});
            expect(result.removed).toEqual({});
            expect(result.changed).toEqual({});
        });

        it('should treat empty objects as identical', () => {
            const result = diffPlanFields({}, {});
            expect(result.added).toEqual({});
            expect(result.removed).toEqual({});
            expect(result.changed).toEqual({});
        });
    });

    describe('when fields are added', () => {
        it('should detect newly added fields', () => {
            // Arrange
            const before = { active: true };
            const after = { active: true, newField: 'hello' };

            // Act
            const result = diffPlanFields(before, after);

            // Assert
            expect(result.added).toEqual({ newField: 'hello' });
            expect(result.removed).toEqual({});
            expect(result.changed).toEqual({});
        });

        it('should detect multiple added fields', () => {
            const before = {};
            const after = { a: 1, b: 2, c: 3 };
            const result = diffPlanFields(before, after);
            expect(result.added).toEqual({ a: 1, b: 2, c: 3 });
            expect(result.removed).toEqual({});
        });
    });

    describe('when fields are removed', () => {
        it('should detect removed fields', () => {
            // Arrange
            const before = { active: true, oldField: 'x' };
            const after = { active: true };

            // Act
            const result = diffPlanFields(before, after);

            // Assert
            expect(result.removed).toEqual({ oldField: 'x' });
            expect(result.added).toEqual({});
            expect(result.changed).toEqual({});
        });
    });

    describe('when fields are changed', () => {
        it('should detect changed primitive values', () => {
            // Arrange
            const before = { active: true, sortOrder: 1 };
            const after = { active: false, sortOrder: 2 };

            // Act
            const result = diffPlanFields(before, after);

            // Assert
            expect(result.changed).toEqual({
                active: { before: true, after: false },
                sortOrder: { before: 1, after: 2 }
            });
            expect(result.added).toEqual({});
            expect(result.removed).toEqual({});
        });

        it('should detect changed nested object values', () => {
            // Arrange
            const before = { metadata: { displayName: 'Old Name', sortOrder: 1 } };
            const after = { metadata: { displayName: 'New Name', sortOrder: 1 } };

            // Act
            const result = diffPlanFields(before, after);

            // Assert
            expect(result.changed).toHaveProperty('metadata');
            const metaDiff = result.changed.metadata;
            expect(metaDiff?.before).toEqual({ displayName: 'Old Name', sortOrder: 1 });
            expect(metaDiff?.after).toEqual({ displayName: 'New Name', sortOrder: 1 });
        });

        it('should detect changed array values', () => {
            // Arrange
            const before = { entitlements: ['ENT_A', 'ENT_B'] };
            const after = { entitlements: ['ENT_A', 'ENT_C'] };

            // Act
            const result = diffPlanFields(before, after);

            // Assert
            expect(result.changed).toHaveProperty('entitlements');
            const entDiff = result.changed.entitlements;
            expect(entDiff?.before).toEqual(['ENT_A', 'ENT_B']);
            expect(entDiff?.after).toEqual(['ENT_A', 'ENT_C']);
        });

        it('should not flag equal arrays as changed', () => {
            const before = { entitlements: ['ENT_A', 'ENT_B'] };
            const after = { entitlements: ['ENT_A', 'ENT_B'] };
            const result = diffPlanFields(before, after);
            expect(result.changed).toEqual({});
        });
    });

    describe('combined added, removed, changed', () => {
        it('should handle all three categories simultaneously', () => {
            // Arrange
            const before = { keep: 1, change: 'old', remove: true };
            const after = { keep: 1, change: 'new', add: 42 };

            // Act
            const result = diffPlanFields(before, after);

            // Assert
            expect(result.added).toEqual({ add: 42 });
            expect(result.removed).toEqual({ remove: true });
            expect(result.changed).toEqual({ change: { before: 'old', after: 'new' } });
        });
    });

    describe('edge cases', () => {
        it('should handle null values', () => {
            const before = { field: null };
            const after = { field: 'value' };
            const result = diffPlanFields(before, after);
            expect(result.changed).toHaveProperty('field');
        });

        it('should handle numeric zero vs false as changed', () => {
            const before = { x: 0 };
            const after = { x: false };
            const result = diffPlanFields(before, after);
            // JSON.stringify(0) = '0', JSON.stringify(false) = 'false' — they differ
            expect(result.changed).toHaveProperty('x');
        });
    });
});

// ---------------------------------------------------------------------------
// insertPlanAuditLog tests
// ---------------------------------------------------------------------------

describe('insertPlanAuditLog', () => {
    it('should call db.insert with billingAuditLogs table and correct values', async () => {
        // Arrange
        const { billingAuditLogs } = await import('@repo/db');
        const mockValues = vi.fn().mockResolvedValue([]);
        const mockInsert = vi.fn().mockReturnValue({ values: mockValues });
        const mockDb = { insert: mockInsert } as unknown as Parameters<
            typeof insertPlanAuditLog
        >[0];

        // Act
        await insertPlanAuditLog(mockDb, {
            action: 'plan_created',
            planId: 'plan-uuid-123',
            actorId: 'actor-uuid-456',
            changes: { active: true },
            previousValues: null,
            livemode: false
        });

        // Assert
        expect(mockInsert).toHaveBeenCalledWith(billingAuditLogs);
        expect(mockValues).toHaveBeenCalledWith(
            expect.objectContaining({
                action: 'plan_created',
                entityType: 'plan',
                entityId: 'plan-uuid-123',
                actorId: 'actor-uuid-456',
                actorType: 'admin',
                livemode: false,
                ipAddress: null,
                userAgent: null
            })
        );
    });

    it('should set actorType to "system" when actorId is null', async () => {
        // Arrange
        const mockValues = vi.fn().mockResolvedValue([]);
        const mockInsert = vi.fn().mockReturnValue({ values: mockValues });
        const mockDb = { insert: mockInsert } as unknown as Parameters<
            typeof insertPlanAuditLog
        >[0];

        // Act
        await insertPlanAuditLog(mockDb, {
            action: 'plan_updated',
            planId: 'plan-uuid-123',
            actorId: null,
            changes: { active: false },
            previousValues: { active: true },
            livemode: true
        });

        // Assert
        expect(mockValues).toHaveBeenCalledWith(
            expect.objectContaining({
                actorId: null,
                actorType: 'system',
                livemode: true
            })
        );
    });
});
