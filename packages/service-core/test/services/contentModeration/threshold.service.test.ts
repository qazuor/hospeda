import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { describe, expect, it, vi } from 'vitest';
import { ContentModerationThresholdService } from '../../../src/services/contentModeration/threshold.service';
import { createActor } from '../../factories/actorFactory';

const { invalidateModerationThresholdCache } = vi.hoisted(() => ({
    invalidateModerationThresholdCache: vi.fn()
}));

vi.mock('../../../src/services/contentModeration/get-threshold-for-context', () => ({
    invalidateModerationThresholdCache
}));

describe('ContentModerationThresholdService', () => {
    it('invalidates accessor cache after updates', async () => {
        const actor = createActor({
            role: RoleEnum.ADMIN,
            permissions: [PermissionEnum.MODERATION_THRESHOLD_UPDATE]
        });
        const model = {
            findById: vi.fn().mockResolvedValue({
                id: '11111111-1111-1111-1111-111111111111',
                context: 'default',
                pending: 0.5,
                reject: 0.85,
                createdAt: new Date(),
                updatedAt: new Date(),
                deletedAt: null,
                createdById: null,
                updatedById: null
            }),
            update: vi.fn().mockResolvedValue({
                id: '11111111-1111-1111-1111-111111111111',
                context: 'default',
                pending: 0.4,
                reject: 0.8,
                createdAt: new Date(),
                updatedAt: new Date(),
                deletedAt: null,
                createdById: null,
                updatedById: actor.id
            }),
            findOne: vi.fn(),
            create: vi.fn(),
            softDelete: vi.fn(),
            hardDelete: vi.fn(),
            restore: vi.fn(),
            findAll: vi.fn(),
            count: vi.fn()
        };

        const service = new ContentModerationThresholdService(
            { logger: undefined },
            model as never
        );
        const result = await service.update(actor, '11111111-1111-1111-1111-111111111111', {
            pending: 0.4,
            reject: 0.8
        });

        expect(result.error).toBeUndefined();
        expect(invalidateModerationThresholdCache).toHaveBeenCalled();
    });
});
