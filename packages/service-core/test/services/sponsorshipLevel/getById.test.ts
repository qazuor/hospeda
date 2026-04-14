import type { SponsorshipLevelModel } from '@repo/db';
import { PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SponsorshipLevelService } from '../../../src/services/sponsorship/sponsorshipLevel.service';
import { createActor } from '../../factories/actorFactory';
import {
    createMockSponsorshipLevel,
    getMockSponsorshipLevelId
} from '../../factories/sponsorshipLevelFactory';
import { createLoggerMock, createModelMock } from '../../utils/modelMockFactory';

describe('SponsorshipLevelService.getById', () => {
    let service: SponsorshipLevelService;
    let modelMock: ReturnType<typeof createModelMock>;
    let loggerMock: ReturnType<typeof createLoggerMock>;
    let actor: ReturnType<typeof createActor>;
    const id = getMockSponsorshipLevelId('mock-id');
    const existing = { ...createMockSponsorshipLevel({ id }) };

    beforeEach(() => {
        modelMock = createModelMock(['findOne']);
        loggerMock = createLoggerMock();
        service = new SponsorshipLevelService({
            logger: loggerMock,
            model: modelMock as unknown as SponsorshipLevelModel
        });
        actor = createActor({ permissions: [PermissionEnum.SPONSORSHIP_VIEW] });
        vi.clearAllMocks();
    });

    it('should get a sponsorship level by id when permissions are valid', async () => {
        modelMock.findOne.mockImplementation((where: Record<string, unknown>) =>
            where && where.id === id ? existing : null
        );
        const result = await service.getById(actor, id);
        expect(result.data).toBeDefined();
        expect(result.data?.name).toEqual(existing.name);
        expect(result.error).toBeUndefined();
        expect(modelMock.findOne).toHaveBeenCalledWith({ id }, undefined);
    });

    it('should return FORBIDDEN if actor lacks permission', async () => {
        actor = createActor({ permissions: [] });
        modelMock.findOne.mockImplementation((where: Record<string, unknown>) =>
            where && where.id === id ? existing : null
        );
        const result = await service.getById(actor, id);
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        expect(result.data).toBeUndefined();
    });

    it('should return NOT_FOUND if entity does not exist', async () => {
        modelMock.findOne.mockResolvedValue(null);
        const result = await service.getById(actor, id);
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        expect(result.data).toBeUndefined();
    });

    it('should return INTERNAL_ERROR if model throws', async () => {
        modelMock.findOne.mockRejectedValue(new Error('DB error'));
        const result = await service.getById(actor, id);
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
        expect(result.data).toBeUndefined();
    });
});
