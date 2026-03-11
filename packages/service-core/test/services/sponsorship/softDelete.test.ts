import type { SponsorshipModel } from '@repo/db';
import { PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SponsorshipService } from '../../../src/services/sponsorship/sponsorship.service';
import { createActor } from '../../factories/actorFactory';
import { createMockSponsorship, getMockSponsorshipId } from '../../factories/sponsorshipFactory';
import { createLoggerMock, createModelMock } from '../../utils/modelMockFactory';

describe('SponsorshipService.softDelete', () => {
    let service: SponsorshipService;
    let modelMock: ReturnType<typeof createModelMock>;
    let loggerMock: ReturnType<typeof createLoggerMock>;
    let actor: ReturnType<typeof createActor>;
    const id = getMockSponsorshipId('mock-id');

    beforeEach(() => {
        modelMock = createModelMock(['findById', 'softDelete']);
        loggerMock = createLoggerMock();
        service = new SponsorshipService({
            logger: loggerMock,
            model: modelMock as unknown as SponsorshipModel
        });
        // Actor with SOFT_DELETE_ANY can delete any sponsorship
        actor = createActor({ permissions: [PermissionEnum.SPONSORSHIP_SOFT_DELETE_ANY] });
        vi.clearAllMocks();
    });

    it('should soft delete a sponsorship when actor has SOFT_DELETE_ANY permission', async () => {
        const existing = createMockSponsorship({ id });
        modelMock.findById.mockResolvedValue(existing);
        modelMock.softDelete.mockResolvedValue(1);
        const result = await service.softDelete(actor, id);
        expect(result.data).toBeDefined();
        expect(result.error).toBeUndefined();
    });

    it('should soft delete a sponsorship when actor has SOFT_DELETE_OWN and is the sponsor', async () => {
        const ownActor = createActor({ permissions: [PermissionEnum.SPONSORSHIP_SOFT_DELETE_OWN] });
        const existing = createMockSponsorship({ id, sponsorUserId: ownActor.id });
        modelMock.findById.mockResolvedValue(existing);
        modelMock.softDelete.mockResolvedValue(1);
        const result = await service.softDelete(ownActor, id);
        expect(result.data).toBeDefined();
        expect(result.error).toBeUndefined();
    });

    it('should return FORBIDDEN when actor has SOFT_DELETE_OWN but is not the sponsor', async () => {
        const otherActor = createActor({
            permissions: [PermissionEnum.SPONSORSHIP_SOFT_DELETE_OWN]
        });
        const existing = createMockSponsorship({ id, sponsorUserId: 'different-user-id' });
        modelMock.findById.mockResolvedValue(existing);
        const result = await service.softDelete(otherActor, id);
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        expect(result.data).toBeUndefined();
    });

    it('should return FORBIDDEN if actor lacks all soft-delete permissions', async () => {
        actor = createActor({ permissions: [] });
        const existing = createMockSponsorship({ id });
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
