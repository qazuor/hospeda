import { PermissionEnum, RoleEnum, ServiceErrorCode } from '@repo/schemas';
import { describe, expect, it, vi } from 'vitest';
import { ContentModerationThresholdService } from '../../../src/services/contentModeration/threshold.service';
import { createActor } from '../../factories/actorFactory';

const { invalidateModerationThresholdCache } = vi.hoisted(() => ({
    invalidateModerationThresholdCache: vi.fn()
}));

vi.mock('../../../src/services/contentModeration/get-threshold-for-context', () => ({
    invalidateModerationThresholdCache
}));

/** Shared fixture: a threshold row stored in the DB. */
const STORED_THRESHOLD = {
    id: '11111111-1111-1111-1111-111111111111',
    context: 'default',
    pending: 0.5 as number,
    reject: 0.85 as number,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null as Date | null,
    createdById: null as string | null,
    updatedById: null as string | null
};

/** Build a model mock around STORED_THRESHOLD with a mutable `update` result. */
function buildModel(updatedRow?: Record<string, unknown>) {
    return {
        findById: vi.fn().mockResolvedValue({ ...STORED_THRESHOLD }),
        update: vi.fn().mockResolvedValue({ ...STORED_THRESHOLD, ...updatedRow }),
        findOne: vi.fn(),
        findOneWithRelations: vi.fn(),
        create: vi.fn(),
        softDelete: vi.fn(),
        hardDelete: vi.fn(),
        restore: vi.fn(),
        findAll: vi.fn(),
        count: vi.fn()
    };
}

describe('ContentModerationThresholdService', () => {
    it('invalidates accessor cache after updates', async () => {
        const actor = createActor({
            role: RoleEnum.ADMIN,
            permissions: [PermissionEnum.MODERATION_THRESHOLD_UPDATE]
        });
        const model = buildModel({ pending: 0.4, reject: 0.8, updatedById: actor.id });

        const service = new ContentModerationThresholdService(
            { logger: undefined },
            model as never
        );
        const result = await service.update(actor, STORED_THRESHOLD.id, {
            pending: 0.4,
            reject: 0.8
        });

        expect(result.error).toBeUndefined();
        expect(invalidateModerationThresholdCache).toHaveBeenCalled();
    });

    // -----------------------------------------------------------------------
    // Partial-update invariant: pending < reject
    // -----------------------------------------------------------------------

    describe('partial update pending < reject invariant', () => {
        const actor = createActor({
            role: RoleEnum.ADMIN,
            permissions: [PermissionEnum.MODERATION_THRESHOLD_UPDATE]
        });

        it('accepts PATCH with only pending when result stays valid', async () => {
            // stored: pending=0.5, reject=0.85 → new pending=0.4 → 0.4 < 0.85 ✓
            const model = buildModel({ pending: 0.4, updatedById: actor.id });
            const service = new ContentModerationThresholdService(
                { logger: undefined },
                model as never
            );

            const result = await service.update(actor, STORED_THRESHOLD.id, { pending: 0.4 });

            expect(result.error).toBeUndefined();
        });

        it('accepts PATCH with only reject when result stays valid', async () => {
            // stored: pending=0.5, reject=0.85 → new reject=0.9 → 0.5 < 0.9 ✓
            const model = buildModel({ reject: 0.9, updatedById: actor.id });
            const service = new ContentModerationThresholdService(
                { logger: undefined },
                model as never
            );

            const result = await service.update(actor, STORED_THRESHOLD.id, { reject: 0.9 });

            expect(result.error).toBeUndefined();
        });

        it('returns VALIDATION_ERROR when PATCH only pending would violate invariant', async () => {
            // stored: pending=0.5, reject=0.85 → new pending=0.9 → 0.9 >= 0.85 ✗
            const model = buildModel();
            const service = new ContentModerationThresholdService(
                { logger: undefined },
                model as never
            );

            const result = await service.update(actor, STORED_THRESHOLD.id, { pending: 0.9 });

            expect(result.error).toBeDefined();
            expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
            expect(result.error?.message).toMatch(/pending.*must be less than reject/i);
            // model.update must NOT have been called — we short-circuit before the DB write
            expect(model.update).not.toHaveBeenCalled();
        });

        it('returns VALIDATION_ERROR when PATCH only reject would violate invariant', async () => {
            // stored: pending=0.5, reject=0.85 → new reject=0.3 → 0.5 >= 0.3 ✗
            const model = buildModel();
            const service = new ContentModerationThresholdService(
                { logger: undefined },
                model as never
            );

            const result = await service.update(actor, STORED_THRESHOLD.id, { reject: 0.3 });

            expect(result.error).toBeDefined();
            expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
            expect(model.update).not.toHaveBeenCalled();
        });

        it('returns VALIDATION_ERROR when PATCH pending equals reject (boundary)', async () => {
            // stored: pending=0.5, reject=0.85 → new pending=0.85 → 0.85 >= 0.85 ✗ (must be strictly <)
            const model = buildModel();
            const service = new ContentModerationThresholdService(
                { logger: undefined },
                model as never
            );

            const result = await service.update(actor, STORED_THRESHOLD.id, { pending: 0.85 });

            expect(result.error).toBeDefined();
            expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
            expect(model.update).not.toHaveBeenCalled();
        });

        it('returns NOT_FOUND when the row does not exist', async () => {
            const model = buildModel();
            // Simulate missing row
            model.findById.mockResolvedValue(null);

            const service = new ContentModerationThresholdService(
                { logger: undefined },
                model as never
            );

            const result = await service.update(actor, STORED_THRESHOLD.id, { pending: 0.4 });

            expect(result.error).toBeDefined();
            expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
            expect(model.update).not.toHaveBeenCalled();
        });
    });
});
