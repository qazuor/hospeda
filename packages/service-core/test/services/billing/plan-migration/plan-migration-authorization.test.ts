import { PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import { describe, expect, it, vi } from 'vitest';
import {
    assertPlanMigrationActionPermitted,
    PLAN_MIGRATION_REJECTIONS,
    planMigrationRejection,
    REJECTION_CODES
} from '../../../../src/services/billing/plan-migration/plan-migration-authorization.js';
import { previewPlanMigration } from '../../../../src/services/billing/plan-migration/plan-migration-preview.service.js';
import type { Actor } from '../../../../src/types/index.js';

const { getDb } = vi.hoisted(() => ({ getDb: vi.fn() }));
vi.mock('@repo/db', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@repo/db')>()),
    getDb
}));

const actor = (permissions: PermissionEnum[], system = false): Actor => ({
    id: crypto.randomUUID(),
    roles: [],
    permissions,
    _isSystemActor: system
});

describe('AC:B12:2 ACC_17 permission rejects before reading the database', () => {
    it.each([
        ['absent actor', undefined],
        ['system actor', actor([PermissionEnum.BILLING_MIGRATE_PLAN], true)],
        ['actor without ACC_17', actor([PermissionEnum.ACCESS_PANEL_ADMIN])]
    ])('rejects %s before any database read', async (_label, candidate) => {
        expect(() => assertPlanMigrationActionPermitted({ actor: candidate })).toThrowError(
            expect.objectContaining({ reason: 'ADMINISTRATIVE_ACTION_FORBIDDEN' })
        );
        await expect(
            previewPlanMigration({
                actor: candidate,
                input: {},
                verticals: {
                    planPolicy: vi.fn(),
                    changeDirection: vi.fn()
                }
            })
        ).rejects.toMatchObject({ reason: 'ADMINISTRATIVE_ACTION_FORBIDDEN' });
        expect(getDb).toHaveBeenCalledTimes(0);
    });
    it('accepts the dedicated permission', () => {
        expect(() =>
            assertPlanMigrationActionPermitted({
                actor: actor([PermissionEnum.BILLING_MIGRATE_PLAN])
            })
        ).not.toThrow();
    });
    it.each(PLAN_MIGRATION_REJECTIONS)('maps %s to a typed service error', (reason) => {
        const error = planMigrationRejection({ reason, message: reason });
        expect(error.code).toBe(REJECTION_CODES[reason]);
        expect(error.code).toBeOneOf([
            ServiceErrorCode.FORBIDDEN,
            ServiceErrorCode.NOT_FOUND,
            ServiceErrorCode.ALREADY_EXISTS,
            ServiceErrorCode.VALIDATION_ERROR
        ]);
    });
});
