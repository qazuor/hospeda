import type {
    PostIdType,
    PostSponsorIdType,
    PostSponsorship,
    PostSponsorshipIdType,
    UserIdType
} from '@repo/schemas';
import { LifecycleStatusEnum, PriceCurrencyEnum } from '@repo/schemas';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as dbUtils from '../../src/client';
import { PostSponsorshipModel } from '../../src/models/post/postSponsorship.model';
import { DbError } from '../../src/utils/error';
import { createDrizzleRelationMock } from '../utils/drizzle-mock';

vi.mock('../../src/utils/logger');

const model = new PostSponsorshipModel();
const asPostId = (id: string) => id as unknown as PostIdType;
const asPostSponsorId = (id: string) => id as unknown as PostSponsorIdType;
const asPostSponsorshipId = (id: string) => id as unknown as PostSponsorshipIdType;
const asUserId = (id: string) => id as unknown as UserIdType;

/**
 * Test suite for PostSponsorshipModel.
 * Uses '@ts-expect-error' in Drizzle mocks because it is not possible to replicate the full RelationalQueryBuilder interface in tests. Only the used methods (findFirst, etc.) are mocked.
 * This is documented and justified according to project rules.
 */

describe('PostSponsorshipModel', () => {
    beforeEach(() => {
        vi.spyOn(dbUtils, 'getDb');
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('findWithRelations - relación encontrada', async () => {
        const postSponsorshipsMock = createDrizzleRelationMock({
            findFirst: vi.fn().mockResolvedValue({
                id: asPostSponsorshipId('dummy-id'),
                postId: asPostId('a'),
                sponsorId: asPostSponsorId('b'),
                description: 'desc',
                paid: { price: 0, currency: PriceCurrencyEnum.USD },
                createdAt: new Date(),
                updatedAt: new Date(),
                deletedAt: undefined,
                post: {}
            })
        });
        vi.mocked(dbUtils.getDb).mockReturnValue({
            query: {
                // @ts-ignore: mock Drizzle relation for test
                postSponsorships: postSponsorshipsMock
            }
        });
        const result = await model.findWithRelations({ postId: asPostId('a') }, { post: true });
        expect(result).toBeTruthy();
        expect((result as { post?: unknown }).post).toBeDefined();
    });

    it('findWithRelations - sin relaciones, fallback a findOne', async () => {
        const dummy: PostSponsorship = {
            id: asPostSponsorshipId('dummy-id'),
            postId: asPostId('a'),
            sponsorId: asPostSponsorId('b'),
            description: 'desc',
            paid: { price: 0, currency: PriceCurrencyEnum.USD },
            isHighlighted: false,
            createdAt: new Date(),
            updatedAt: new Date(),
            deletedAt: undefined,
            createdById: asUserId('dummy-user'),
            updatedById: asUserId('dummy-user'),
            lifecycleState: LifecycleStatusEnum.ACTIVE
        };
        const spy = vi.spyOn(model, 'findOne').mockResolvedValue(dummy);
        const result = await model.findWithRelations({ postId: asPostId('a') }, {});
        expect(spy).toHaveBeenCalled();
        expect(result).toBeTruthy();
    });

    it('findWithRelations - no encontrada', async () => {
        const postSponsorshipsMock = createDrizzleRelationMock({
            findFirst: vi.fn().mockResolvedValue(null)
        });
        vi.mocked(dbUtils.getDb).mockReturnValue({
            query: {
                // @ts-ignore: mock Drizzle relation for test
                postSponsorships: postSponsorshipsMock
            }
        });
        const result = await model.findWithRelations({ postId: asPostId('x') }, { post: true });
        expect(result).toBeNull();
    });

    it('findWithRelations - error de DB', async () => {
        const postSponsorshipsMock = createDrizzleRelationMock({
            findFirst: vi.fn().mockRejectedValue(new Error('fail'))
        });
        vi.mocked(dbUtils.getDb).mockReturnValue({
            query: {
                // @ts-ignore: mock Drizzle relation for test
                postSponsorships: postSponsorshipsMock
            }
        });
        await expect(
            model.findWithRelations({ postId: asPostId('a') }, { post: true })
        ).rejects.toThrow(DbError);
    });

    // ========================================================================
    // T-049: tx propagation for PostSponsorshipModel
    // ========================================================================
    describe('tx propagation', () => {
        it('findWithRelations() uses tx when provided (with relations branch)', async () => {
            // Arrange
            const findFirst = vi.fn().mockResolvedValue(null);
            const mockTx = { query: { postSponsorships: { findFirst } } } as any;
            const spy = vi.spyOn(model as any, 'getClient');
            spy.mockReturnValue(mockTx);

            // Act
            await model.findWithRelations({ postId: asPostId('p1') }, { post: true }, mockTx);

            // Assert
            expect(spy).toHaveBeenCalledWith(mockTx);
            expect(dbUtils.getDb).not.toHaveBeenCalled();

            spy.mockRestore();
        });

        it('findWithRelations() threads tx to findOne in fallback branch', async () => {
            // Arrange
            const mockTx = {} as any;
            const findOneSpy = vi.spyOn(model, 'findOne').mockResolvedValue(null);
            const spy = vi.spyOn(model as any, 'getClient');
            spy.mockReturnValue(mockTx);

            // Act
            await model.findWithRelations({ postId: asPostId('p1') }, {}, mockTx);

            // Assert
            expect(findOneSpy).toHaveBeenCalledWith({ postId: asPostId('p1') }, mockTx);

            spy.mockRestore();
            findOneSpy.mockRestore();
        });
    });
});
