import crypto from 'node:crypto';
import { ModerationCategoryEnum, PermissionEnum, RoleEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ContentModerationTermService } from '../../../src/services/contentModeration/term.service';
import { createActor } from '../../factories/actorFactory';

const { invalidateModerationCache, invalidateModerationCacheByTermPattern } = vi.hoisted(() => ({
    invalidateModerationCache: vi.fn(),
    invalidateModerationCacheByTermPattern: vi.fn()
}));

vi.mock('@repo/content-moderation', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@repo/content-moderation')>()),
    invalidateModerationCache,
    invalidateModerationCacheByTermPattern
}));

vi.mock('../../../src/utils/transaction', () => ({
    withServiceTransaction: vi.fn(
        async (
            fn: (ctx: { tx: undefined; hookState: Record<string, never> }) => Promise<unknown>
        ) => fn({ tx: undefined, hookState: {} })
    )
}));

describe('ContentModerationTermService', () => {
    const actor = createActor({
        role: RoleEnum.ADMIN,
        permissions: [PermissionEnum.MODERATION_TERM_CREATE, PermissionEnum.MODERATION_TERM_VIEW]
    });

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('invalidates the moderation cache after bulk imports commit', async () => {
        const model = {
            create: vi.fn(async (data: Record<string, unknown>) => ({
                id: crypto.randomUUID(),
                term: data.term,
                kind: data.kind,
                category: data.category,
                severity: data.severity,
                enabled: data.enabled,
                createdAt: new Date(),
                updatedAt: new Date(),
                deletedAt: null,
                createdById: actor.id,
                updatedById: actor.id
            })),
            findOne: vi.fn().mockResolvedValue(null),
            findById: vi.fn().mockResolvedValue(null),
            update: vi.fn(),
            softDelete: vi.fn(),
            hardDelete: vi.fn(),
            restore: vi.fn(),
            findAll: vi.fn(),
            count: vi.fn(),
            findEnabledTerms: vi.fn().mockResolvedValue([])
        };

        const service = new ContentModerationTermService({ logger: undefined }, model as never);
        const result = await service.bulkImport(actor, {
            rows: [
                {
                    term: 'badword',
                    kind: 'word',
                    category: ModerationCategoryEnum.OTHER,
                    severity: 1,
                    enabled: true
                }
            ]
        });

        expect(result.error).toBeUndefined();
        expect(invalidateModerationCache).toHaveBeenCalled();
    });

    it('rejects bulk imports larger than 5000 rows', async () => {
        const service = new ContentModerationTermService({ logger: undefined }, {
            create: vi.fn(),
            findOne: vi.fn(),
            findById: vi.fn(),
            update: vi.fn(),
            softDelete: vi.fn(),
            hardDelete: vi.fn(),
            restore: vi.fn(),
            findAll: vi.fn(),
            count: vi.fn(),
            findEnabledTerms: vi.fn().mockResolvedValue([])
        } as never);

        const rows = Array.from({ length: 5001 }, (_, index) => ({
            term: `blocked-${index}`,
            kind: 'word' as const,
            category: ModerationCategoryEnum.OTHER,
            severity: 1,
            enabled: true
        }));

        const result = await service.bulkImport(actor, { rows });

        expect(result.error?.code).toBe('VALIDATION_ERROR');
    });
});
