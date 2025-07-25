import type { PostSponsorModel } from '@repo/db';
import { PermissionEnum, RoleEnum, ServiceErrorCode } from '@repo/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PostSponsorService } from '../../../src/services/postSponsor/postSponsor.service';
import { createActor } from '../../factories/actorFactory';
import { createMockPostSponsor, getMockPostSponsorId } from '../../factories/postSponsorFactory';
import { createLoggerMock, createModelMock } from '../../utils/modelMockFactory';

// Tipo auxiliar para mocks de paginación
interface PaginatedMock<T> {
    items: T[];
    total: number;
    page: number;
    pageSize: number;
}

describe('PostSponsorService.list', () => {
    let service: PostSponsorService;
    let modelMock: ReturnType<typeof createModelMock>;
    let loggerMock: ReturnType<typeof createLoggerMock>;
    let actor: ReturnType<typeof createActor>;

    beforeEach(() => {
        modelMock = createModelMock(['findAll']);
        loggerMock = createLoggerMock();
        service = new PostSponsorService(
            { logger: loggerMock },
            modelMock as unknown as PostSponsorModel
        );
        actor = createActor({ permissions: [PermissionEnum.POST_SPONSOR_MANAGE] });
        vi.clearAllMocks();
    });

    it('should list post sponsors when permissions are valid', async () => {
        const items = [createMockPostSponsor({ id: getMockPostSponsorId('mock-id-1') })];
        modelMock.findAll.mockResolvedValue({ items, total: 1, page: 1, pageSize: 10 });
        const result = await service.list(actor, {});
        expect(result.data).toBeDefined();
        expect(result.data?.items).toBeDefined();
        if (
            !result.data ||
            !result.data.items ||
            result.data.items.length === 0 ||
            !items[0] ||
            !items[0].logo
        ) {
            throw new Error(
                'Expected at least one item in result.data.items and items, and logo defined'
            );
        }
        const firstResult = result.data.items[0] as NonNullable<(typeof result.data.items)[0]>;
        const firstMock = items[0] as NonNullable<(typeof items)[0]>;
        expect(firstResult.logo).toBeDefined();
        expect(firstResult.logo).toEqual(firstMock.logo);
        expect(result.error).toBeUndefined();
        expect(modelMock.findAll).toHaveBeenCalled();
    });

    it('should return FORBIDDEN if actor lacks permission', async () => {
        actor = createActor({ permissions: [] });
        const items = [createMockPostSponsor({ id: getMockPostSponsorId('mock-id-1') })];
        modelMock.findAll.mockResolvedValue({ items, total: 1, page: 1, pageSize: 10 });
        const result = await service.list(actor, {});
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        expect(result.data).toBeUndefined();
    });

    it('should return INTERNAL_ERROR if model throws', async () => {
        modelMock.findAll.mockRejectedValue(new Error('DB error'));
        const result = await service.list(actor, {});
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
        expect(result.data).toBeUndefined();
    });

    it('should return an empty list if there are no post sponsors', async () => {
        modelMock.findAll.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 10 });
        const result = await service.list(actor, {});
        expect(result.data).toBeDefined();
        expect(result.data?.items).toHaveLength(0);
        expect(result.data?.total).toBe(0);
        expect(result.error).toBeUndefined();
    });

    it('should list multiple post sponsors', async () => {
        const items = [
            createMockPostSponsor({ id: getMockPostSponsorId('mock-id-1') }),
            createMockPostSponsor({ id: getMockPostSponsorId('mock-id-2') })
        ];
        modelMock.findAll.mockResolvedValue({ items, total: 2, page: 1, pageSize: 10 });
        const result = await service.list(actor, {});
        expect(result.data).toBeDefined();
        expect(result.data?.items).toHaveLength(2);
        expect(result.data?.total).toBe(2);
        expect(result.error).toBeUndefined();
    });

    it('should list post sponsors as super admin', async () => {
        actor = createActor({
            role: RoleEnum.SUPER_ADMIN,
            permissions: Object.values(PermissionEnum)
        });
        const items = [createMockPostSponsor({ id: getMockPostSponsorId('mock-id-1') })];
        modelMock.findAll.mockResolvedValue({ items, total: 1, page: 1, pageSize: 10 });
        const result = await service.list(actor, {});
        expect(result.data).toBeDefined();
        expect(result.data?.items).toHaveLength(1);
        expect(result.error).toBeUndefined();
    });

    it('should return paginated results', async () => {
        const items = [createMockPostSponsor({ id: getMockPostSponsorId('mock-id-1') })];
        modelMock.findAll.mockResolvedValue({
            items,
            total: 5,
            page: 2,
            pageSize: 1
        } as PaginatedMock<ReturnType<typeof createMockPostSponsor>>);
        const result = await service.list(actor, { page: 2, pageSize: 1 });
        expect(result.data).toBeDefined();
        expect(result.data?.items).toHaveLength(1);
        expect((result.data as PaginatedMock<ReturnType<typeof createMockPostSponsor>>).page).toBe(
            2
        );
        expect(
            (result.data as PaginatedMock<ReturnType<typeof createMockPostSponsor>>).pageSize
        ).toBe(1);
        expect(result.data?.total).toBe(5);
        expect(result.error).toBeUndefined();
    });

    it('should handle empty input (default pagination)', async () => {
        const items = [createMockPostSponsor({ id: getMockPostSponsorId('mock-id-1') })];
        modelMock.findAll.mockResolvedValue({
            items,
            total: 1,
            page: 1,
            pageSize: 20
        } as PaginatedMock<ReturnType<typeof createMockPostSponsor>>);
        const result = await service.list(actor);
        expect(result.data).toBeDefined();
        expect(result.data?.items).toHaveLength(1);
        expect((result.data as PaginatedMock<ReturnType<typeof createMockPostSponsor>>).page).toBe(
            1
        );
        expect(
            (result.data as PaginatedMock<ReturnType<typeof createMockPostSponsor>>).pageSize
        ).toBe(20);
        expect(result.error).toBeUndefined();
    });

    it('should return UNAUTHORIZED if actor is null', async () => {
        // @ts-expect-error purposely passing null
        const result = await service.list(null, {});
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe('UNAUTHORIZED');
        expect(result.data).toBeUndefined();
    });
});
