import type { PostSponsorshipModel } from '@repo/db';
import { PermissionEnum, RoleEnum, ServiceErrorCode } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PostSponsorshipService } from '../../../src/services/postSponsorship/postSponsorship.service';
import { createActor } from '../../factories/actorFactory';
import { getMockPostSponsorId } from '../../factories/postSponsorFactory';
import {
    createMockPostSponsorship,
    getMockPostSponsorshipId
} from '../../factories/postSponsorshipFactory';
import { getMockId } from '../../factories/utilsFactory';
import { createLoggerMock, createModelMock } from '../../utils/modelMockFactory';

interface PaginatedMock<T> {
    items: T[];
    total: number;
    page: number;
    pageSize: number;
}

describe('PostSponsorshipService.search', () => {
    let service: PostSponsorshipService;
    let modelMock: ReturnType<typeof createModelMock>;
    let loggerMock: ReturnType<typeof createLoggerMock>;
    let actor: ReturnType<typeof createActor>;
    const validInput = {
        sponsorId: getMockPostSponsorId('sponsor-1'),
        postId: getMockId('post', 'post-1') as any, // PostId branded type
        page: 1,
        pageSize: 10
    };

    beforeEach(() => {
        modelMock = createModelMock(['findAll']);
        loggerMock = createLoggerMock();
        service = new PostSponsorshipService(
            { logger: loggerMock },
            modelMock as unknown as PostSponsorshipModel
        );
        actor = createActor({ permissions: [PermissionEnum.POST_SPONSOR_MANAGE] });
        vi.clearAllMocks();
    });

    it('should search post sponsorships when permissions and input are valid', async () => {
        const items = [createMockPostSponsorship({ id: getMockPostSponsorshipId('mock-id-1') })];
        modelMock.findAll.mockResolvedValue({ items, total: 1, page: 1, pageSize: 10 });
        const result = await service.search(actor, validInput);
        expect(result.data).toBeDefined();
        expect(result.data?.items).toBeDefined();
        if (!result.data || !result.data.items || result.data.items.length === 0 || !items[0]) {
            throw new Error('Expected at least one item in result.data.items and items');
        }
        const firstResult = result.data.items[0] as NonNullable<(typeof result.data.items)[0]>;
        const firstMock = items[0] as NonNullable<(typeof items)[0]>;
        expect(firstResult.id).toBeDefined();
        expect(firstResult.id).toEqual(firstMock.id);
        expect(result.error).toBeUndefined();
        expect(modelMock.findAll).toHaveBeenCalled();
    });

    it('should return FORBIDDEN if actor lacks permission', async () => {
        actor = createActor({ permissions: [] });
        const items = [createMockPostSponsorship({ id: getMockPostSponsorshipId('mock-id-1') })];
        modelMock.findAll.mockResolvedValue({ items, total: 1, page: 1, pageSize: 10 });
        const result = await service.search(actor, validInput);
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        expect(result.data).toBeUndefined();
    });

    it('should return VALIDATION_ERROR for invalid input', async () => {
        const invalid = {
            sponsorId: '' as any,
            postId: '' as any,
            page: 1,
            pageSize: 10
        };
        const result = await service.search(actor, invalid);
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        expect(result.data).toBeUndefined();
    });

    it('should return INTERNAL_ERROR if model throws', async () => {
        modelMock.findAll.mockRejectedValue(new Error('DB error'));
        const result = await service.search(actor, validInput);
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
        expect(result.data).toBeUndefined();
    });

    it('should return an empty list if no post sponsorships match', async () => {
        modelMock.findAll.mockResolvedValue({
            items: [],
            total: 0,
            page: 1,
            pageSize: 10
        } as PaginatedMock<ReturnType<typeof createMockPostSponsorship>>);
        const result = await service.search(actor, validInput);
        expect(result.data).toBeDefined();
        expect(result.data?.items).toHaveLength(0);
        expect(result.data?.total).toBe(0);
        expect(result.error).toBeUndefined();
    });

    it('should search multiple post sponsorships', async () => {
        const items = [
            createMockPostSponsorship({ id: getMockPostSponsorshipId('mock-id-1') }),
            createMockPostSponsorship({ id: getMockPostSponsorshipId('mock-id-2') })
        ];
        modelMock.findAll.mockResolvedValue({
            items,
            total: 2,
            page: 1,
            pageSize: 10
        } as PaginatedMock<ReturnType<typeof createMockPostSponsorship>>);
        const result = await service.search(actor, validInput);
        expect(result.data).toBeDefined();
        expect(result.data?.items).toHaveLength(2);
        expect(result.data?.total).toBe(2);
        expect(result.error).toBeUndefined();
    });

    it('should search as super admin', async () => {
        actor = createActor({
            role: RoleEnum.SUPER_ADMIN,
            permissions: Object.values(PermissionEnum)
        });
        const items = [createMockPostSponsorship({ id: getMockPostSponsorshipId('mock-id-1') })];
        modelMock.findAll.mockResolvedValue({
            items,
            total: 1,
            page: 1,
            pageSize: 10
        } as PaginatedMock<ReturnType<typeof createMockPostSponsorship>>);
        const result = await service.search(actor, validInput);
        expect(result.data).toBeDefined();
        expect(result.data?.items).toHaveLength(1);
        expect(result.error).toBeUndefined();
    });

    it('should return paginated results', async () => {
        const items = [createMockPostSponsorship({ id: getMockPostSponsorshipId('mock-id-1') })];
        modelMock.findAll.mockResolvedValue({
            items,
            total: 5,
            page: 2,
            pageSize: 1
        } as PaginatedMock<ReturnType<typeof createMockPostSponsorship>>);
        const result = await service.search(actor, {
            ...validInput,
            page: 2,
            pageSize: 1
        });
        expect(result.data).toBeDefined();
        expect(result.data?.items).toHaveLength(1);
        expect(
            (result.data as PaginatedMock<ReturnType<typeof createMockPostSponsorship>>).page
        ).toBe(2);
        expect(
            (result.data as PaginatedMock<ReturnType<typeof createMockPostSponsorship>>).pageSize
        ).toBe(1);
        expect(result.data?.total).toBe(5);
        expect(result.error).toBeUndefined();
    });

    it('should search with empty filters (all)', async () => {
        const items = [createMockPostSponsorship({ id: getMockPostSponsorshipId('mock-id-1') })];
        modelMock.findAll.mockResolvedValue({
            items,
            total: 1,
            page: 1,
            pageSize: 10
        } as PaginatedMock<ReturnType<typeof createMockPostSponsorship>>);
        const result = await service.search(actor, { page: 1, pageSize: 10 });
        expect(result.data).toBeDefined();
        expect(result.data?.items).toHaveLength(1);
        expect(result.error).toBeUndefined();
    });

    it('should return UNAUTHORIZED if actor is null', async () => {
        // @ts-expect-error purposely passing null
        const result = await service.search(null, validInput);
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe('UNAUTHORIZED');
        expect(result.data).toBeUndefined();
    });
});
