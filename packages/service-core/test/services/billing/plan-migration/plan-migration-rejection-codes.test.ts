import { PLAN_MIGRATION_REJECTIONS as FROM_SCHEMAS } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { PLAN_MIGRATION_REJECTIONS } from '../../../../src/services/billing/plan-migration/plan-migration-authorization.js';

describe('HOS-2110 plan migration rejections live in @repo/schemas', () => {
    it('service-core re-exports the schemas tuple by reference', () => {
        // Arrange + Act + Assert
        expect(PLAN_MIGRATION_REJECTIONS).toBe(FROM_SCHEMAS);
    });

    it('keeps the same values and length', () => {
        // Arrange + Act + Assert
        expect([...PLAN_MIGRATION_REJECTIONS]).toEqual([...FROM_SCHEMAS]);
        expect(PLAN_MIGRATION_REJECTIONS).toHaveLength(14);
    });
});
