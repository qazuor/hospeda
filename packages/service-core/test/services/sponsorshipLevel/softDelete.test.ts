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

describe('SponsorshipLevelService.softDelete', () => {
    let service: SponsorshipLevelService;
    let modelMock: ReturnType<typeof createModelMock>;
    let loggerMock: ReturnType<typeof createLoggerMock>;
    let actor: ReturnType<typeof createActor>;
    const id = getMockSponsorshipLevelId('mock-id');
    const existing = createMockSponsorshipLevel({ id });

    beforeEach(() => {
        modelMock = createModelMock(['findById', 'softDelete']);
        loggerMock = createLoggerMock();
        service = new SponsorshipLevelService({
            logger: loggerMock,
            model: modelMock as unknown as SponsorshipLevelModel
        });
        actor = createActor({ permissions: [PermissionEnum.SPONSORSHIP_DELETE] });
        vi.clearAllMocks();
    });

    it('should soft delete a sponsorship level when permissions are valid', async () => {
        modelMock.findById.mockResolvedValue(existing);
        modelMock.softDelete.mockResolvedValue(1);
        const result = await service.softDelete(actor, id);
        expect(result.data).toBeDefined();
        expect(result.error).toBeUndefined();
    });

    it('should return FORBIDDEN if actor lacks permission', async () => {
        actor = createActor({ permissions: [] });
        modelMock.findById.mockResolvedValue(existing);
        const result = await service.softDelete(actor, id);
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        expect(result.data).toBeUndefined();
    });

    it('should return NOT_FOUND if entity does not exist', async () => {
        modelMock.findById.mockResolvedValue(null);
        const result = await service.softDelete(actor, id);
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        expect(result.data).toBeUndefined();
    });
});
