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

describe('SponsorshipPackageService.softDelete', () => {
    let service: SponsorshipPackageService;
    let modelMock: ReturnType<typeof createModelMock>;
    let loggerMock: ReturnType<typeof createLoggerMock>;
    let actor: ReturnType<typeof createActor>;
    const id = getMockSponsorshipPackageId('mock-id');
    const existing = createMockSponsorshipPackage({ id });

    beforeEach(() => {
        modelMock = createModelMock(['findById', 'softDelete']);
        loggerMock = createLoggerMock();
        service = new SponsorshipPackageService({
            logger: loggerMock,
            model: modelMock as unknown as SponsorshipPackageModel
        });
        actor = createActor({ permissions: [PermissionEnum.SPONSORSHIP_DELETE] });
        vi.clearAllMocks();
    });

    it('should soft delete a sponsorship package when permissions are valid', async () => {
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
