import type { SponsorshipLevelModel } from '@repo/db';
import { PermissionEnum, RoleEnum, ServiceErrorCode } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SponsorshipLevelService } from '../../../src/services/sponsorship/sponsorshipLevel.service';
import { createActor } from '../../factories/actorFactory';
import {
    createMockSponsorshipLevel,
    getMockSponsorshipLevelId
} from '../../factories/sponsorshipLevelFactory';
import { createLoggerMock, createModelMock } from '../../utils/modelMockFactory';

interface PaginatedMock<T> {
    items: T[];
    total: number;
    page: number;
    pageSize: number;
}

describe('SponsorshipLevelService.list', () => {
    let service: SponsorshipLevelService;
    let modelMock: ReturnType<typeof createModelMock>;
    let loggerMock: ReturnType<typeof createLoggerMock>;
    let actor: ReturnType<typeof createActor>;

    beforeEach(() => {
        modelMock = createModelMock(['findAll']);
        loggerMock = createLoggerMock();
        service = new SponsorshipLevelService({
            logger: loggerMock,
            model: modelMock as unknown as SponsorshipLevelModel
        });
        actor = createActor({ permissions: [PermissionEnum.SPONSORSHIP_VIEW] });
        vi.clearAllMocks();
    });

    it('should list sponsorship levels when permissions are valid', async () => {
        const items = [createMockSponsorshipLevel({ id: getMockSponsorshipLevelId('mock-id-1') })];
        modelMock.findAll.mockResolvedValue({ items, total: 1, page: 1, pageSize: 10 });
        const result = await service.list(actor, {});
        expect(result.data).toBeDefined();
        expect(result.data?.items).toBeDefined();
        expect(result.error).toBeUndefined();
        expect(modelMock.findAll).toHaveBeenCalled();
    });

    it('should return FORBIDDEN if actor lacks permission', async () => {
        actor = createActor({ permissions: [] });
        modelMock.findAll.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 10 });
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

    it('should return an empty list if there are no sponsorship levels', async () => {
        modelMock.findAll.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 10 });
        const result = await service.list(actor, {});
        expect(result.data).toBeDefined();
        expect(result.data?.items).toHaveLength(0);
        expect(result.data?.total).toBe(0);
        expect(result.error).toBeUndefined();
    });

    it('should list multiple sponsorship levels', async () => {
        const items = [
            createMockSponsorshipLevel({ id: getMockSponsorshipLevelId('mock-id-1') }),
            createMockSponsorshipLevel({ id: getMockSponsorshipLevelId('mock-id-2') })
        ];
        modelMock.findAll.mockResolvedValue({ items, total: 2, page: 1, pageSize: 10 });
        const result = await service.list(actor, {});
        expect(result.data).toBeDefined();
        expect(result.data?.items).toHaveLength(2);
        expect(result.data?.total).toBe(2);
        expect(result.error).toBeUndefined();
    });

    it('should list sponsorship levels as super admin', async () => {
        actor = createActor({
            role: RoleEnum.SUPER_ADMIN,
            permissions: Object.values(PermissionEnum)
        });
        const items = [createMockSponsorshipLevel({ id: getMockSponsorshipLevelId('mock-id-1') })];
        modelMock.findAll.mockResolvedValue({ items, total: 1, page: 1, pageSize: 10 });
        const result = await service.list(actor, {});
        expect(result.data).toBeDefined();
        expect(result.data?.items).toHaveLength(1);
        expect(result.error).toBeUndefined();
    });

    it('should return paginated results', async () => {
        const items = [createMockSponsorshipLevel({ id: getMockSponsorshipLevelId('mock-id-1') })];
        modelMock.findAll.mockResolvedValue({
            items,
            total: 5,
            page: 2,
            pageSize: 1
        } as PaginatedMock<ReturnType<typeof createMockSponsorshipLevel>>);
        const result = await service.list(actor, { page: 2, pageSize: 1 });
        expect(result.data).toBeDefined();
        expect(result.data?.items).toHaveLength(1);
        expect(result.data?.total).toBe(5);
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
