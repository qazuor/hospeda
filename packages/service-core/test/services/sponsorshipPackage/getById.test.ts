import type { SponsorshipPackageModel } from '@repo/db';
import { PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SponsorshipPackageService } from '../../../src/services/sponsorship/sponsorshipPackage.service';
import { createActor } from '../../factories/actorFactory';
import {
    createMockSponsorshipPackage,
    getMockSponsorshipPackageId
} from '../../factories/sponsorshipPackageFactory';
import { createLoggerMock, createModelMock } from '../../utils/modelMockFactory';

describe('SponsorshipPackageService.getById', () => {
    let service: SponsorshipPackageService;
    let modelMock: ReturnType<typeof createModelMock>;
    let loggerMock: ReturnType<typeof createLoggerMock>;
    let actor: ReturnType<typeof createActor>;
    const id = getMockSponsorshipPackageId('mock-id');
    const existing = { ...createMockSponsorshipPackage({ id }) };

    beforeEach(() => {
        modelMock = createModelMock(['findOne', 'findOneWithRelations']);
        loggerMock = createLoggerMock();
        service = new SponsorshipPackageService({
            logger: loggerMock,
            model: modelMock as unknown as SponsorshipPackageModel
        });
        actor = createActor({ permissions: [PermissionEnum.SPONSORSHIP_VIEW] });
        vi.clearAllMocks();
    });

    it('should get a sponsorship package by id when permissions are valid', async () => {
        modelMock.findOneWithRelations.mockImplementation((where: Record<string, unknown>) =>
            where && where.id === id ? existing : null
        );
        const result = await service.getById(actor, id);
        expect(result.data).toBeDefined();
        expect(result.data?.name).toEqual(existing.name);
        expect(result.error).toBeUndefined();
        expect(modelMock.findOneWithRelations).toHaveBeenCalledWith(
            { id },
            { eventLevel: true },
            undefined
        );
        expect(modelMock.findOne).not.toHaveBeenCalled();
    });

    it('should return FORBIDDEN if actor lacks permission', async () => {
        actor = createActor({ permissions: [] });
        modelMock.findOneWithRelations.mockImplementation((where: Record<string, unknown>) =>
            where && where.id === id ? existing : null
        );
        const result = await service.getById(actor, id);
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        expect(result.data).toBeUndefined();
    });

    it('should return NOT_FOUND if entity does not exist', async () => {
        modelMock.findOneWithRelations.mockResolvedValue(null);
        const result = await service.getById(actor, id);
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        expect(result.data).toBeUndefined();
    });

    it('should return INTERNAL_ERROR if model throws', async () => {
        modelMock.findOneWithRelations.mockRejectedValue(new Error('DB error'));
        const result = await service.getById(actor, id);
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
        expect(result.data).toBeUndefined();
    });
});
