import type { SponsorshipModel } from '@repo/db';
import { PermissionEnum, RoleEnum, ServiceErrorCode } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SponsorshipService } from '../../../src/services/sponsorship/sponsorship.service';
import { createActor } from '../../factories/actorFactory';
import { createMockSponsorship, getMockSponsorshipId } from '../../factories/sponsorshipFactory';
import { createLoggerMock, createModelMock } from '../../utils/modelMockFactory';

interface PaginatedMock<T> {
    items: T[];
    total: number;
    page: number;
    pageSize: number;
}

describe('SponsorshipService.list', () => {
    let service: SponsorshipService;
    let modelMock: ReturnType<typeof createModelMock>;
    let loggerMock: ReturnType<typeof createLoggerMock>;
    let actor: ReturnType<typeof createActor>;

    beforeEach(() => {
        modelMock = createModelMock(['findAll']);
        loggerMock = createLoggerMock();
        service = new SponsorshipService({
            logger: loggerMock,
            model: modelMock as unknown as SponsorshipModel
        });
        actor = createActor({ permissions: [PermissionEnum.SPONSORSHIP_VIEW] });
        vi.clearAllMocks();
    });

    it('should list sponsorships when permissions are valid', async () => {
        const items = [createMockSponsorship({ id: getMockSponsorshipId('mock-id-1') })];
        modelMock.findAllWithRelations.mockResolvedValue({
            items,
            total: 1,
            page: 1,
            pageSize: 10
        });
        const result = await service.list(actor, {});
        expect(result.data).toBeDefined();
        expect(result.data?.items).toBeDefined();
        expect(result.error).toBeUndefined();
        expect(modelMock.findAllWithRelations).toHaveBeenCalled();
    });

    it('should return FORBIDDEN if actor lacks permission', async () => {
        actor = createActor({ permissions: [] });
        modelMock.findAllWithRelations.mockResolvedValue({
            items: [],
            total: 0,
            page: 1,
            pageSize: 10
        });
        const result = await service.list(actor, {});
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        expect(result.data).toBeUndefined();
    });

    it('should return INTERNAL_ERROR if model throws', async () => {
        modelMock.findAllWithRelations.mockRejectedValue(new Error('DB error'));
        const result = await service.list(actor, {});
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
        expect(result.data).toBeUndefined();
    });

    it('should return an empty list if there are no sponsorships', async () => {
        modelMock.findAllWithRelations.mockResolvedValue({
            items: [],
            total: 0,
            page: 1,
            pageSize: 10
        });
        const result = await service.list(actor, {});
        expect(result.data).toBeDefined();
        expect(result.data?.items).toHaveLength(0);
        expect(result.data?.total).toBe(0);
        expect(result.error).toBeUndefined();
    });

    it('should list multiple sponsorships', async () => {
        const items = [
            createMockSponsorship({ id: getMockSponsorshipId('mock-id-1') }),
            createMockSponsorship({ id: getMockSponsorshipId('mock-id-2') })
        ];
        modelMock.findAllWithRelations.mockResolvedValue({
            items,
            total: 2,
            page: 1,
            pageSize: 10
        });
        const result = await service.list(actor, {});
        expect(result.data).toBeDefined();
        expect(result.data?.items).toHaveLength(2);
        expect(result.data?.total).toBe(2);
        expect(result.error).toBeUndefined();
    });

    it('should list sponsorships as super admin', async () => {
        actor = createActor({
            role: RoleEnum.SUPER_ADMIN,
            permissions: Object.values(PermissionEnum)
        });
        const items = [createMockSponsorship({ id: getMockSponsorshipId('mock-id-1') })];
        modelMock.findAllWithRelations.mockResolvedValue({
            items,
            total: 1,
            page: 1,
            pageSize: 10
        });
        const result = await service.list(actor, {});
        expect(result.data).toBeDefined();
        expect(result.data?.items).toHaveLength(1);
        expect(result.error).toBeUndefined();
    });

    it('should return paginated results', async () => {
        const items = [createMockSponsorship({ id: getMockSponsorshipId('mock-id-1') })];
        modelMock.findAllWithRelations.mockResolvedValue({
            items,
            total: 5,
            page: 2,
            pageSize: 1
        } as PaginatedMock<ReturnType<typeof createMockSponsorship>>);
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
