import type { SponsorshipModel } from '@repo/db';
import { PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SponsorshipService } from '../../../src/services/sponsorship/sponsorship.service';
import { createActor } from '../../factories/actorFactory';
import { createMockSponsorship, getMockSponsorshipId } from '../../factories/sponsorshipFactory';
import { createLoggerMock, createModelMock } from '../../utils/modelMockFactory';

describe('SponsorshipService.getById', () => {
    let service: SponsorshipService;
    let modelMock: ReturnType<typeof createModelMock>;
    let loggerMock: ReturnType<typeof createLoggerMock>;
    let actor: ReturnType<typeof createActor>;
    const id = getMockSponsorshipId('mock-id');

    beforeEach(() => {
        modelMock = createModelMock(['findOne']);
        loggerMock = createLoggerMock();
        service = new SponsorshipService({
            logger: loggerMock,
            model: modelMock as unknown as SponsorshipModel
        });
        // Actor with SPONSORSHIP_VIEW_ANY can view any sponsorship
        actor = createActor({ permissions: [PermissionEnum.SPONSORSHIP_VIEW_ANY] });
        vi.clearAllMocks();
    });

    it('should get a sponsorship by id when actor has VIEW_ANY permission', async () => {
        const existing = createMockSponsorship({ id });
        modelMock.findOne.mockImplementation((where: Record<string, unknown>) =>
            where && where.id === id ? existing : null
        );
        const result = await service.getById(actor, id);
        expect(result.data).toBeDefined();
        expect(result.data?.slug).toEqual(existing.slug);
        expect(result.error).toBeUndefined();
        expect(modelMock.findOne).toHaveBeenCalledWith({ id });
    });

    it('should get a sponsorship by id when actor has VIEW_OWN and is the sponsor', async () => {
        // Actor is the sponsor of this sponsorship
        const ownActor = createActor({ permissions: [PermissionEnum.SPONSORSHIP_VIEW_OWN] });
        const existing = createMockSponsorship({ id, sponsorUserId: ownActor.id });
        modelMock.findOne.mockImplementation((where: Record<string, unknown>) =>
            where && where.id === id ? existing : null
        );
        const result = await service.getById(ownActor, id);
        expect(result.data).toBeDefined();
        expect(result.error).toBeUndefined();
    });

    it('should return FORBIDDEN when actor has VIEW_OWN but is not the sponsor', async () => {
        // Actor has OWN permission but the sponsorship belongs to a different user
        const otherActor = createActor({ permissions: [PermissionEnum.SPONSORSHIP_VIEW_OWN] });
        const existing = createMockSponsorship({ id, sponsorUserId: 'different-user-id' });
        modelMock.findOne.mockImplementation((where: Record<string, unknown>) =>
            where && where.id === id ? existing : null
        );
        const result = await service.getById(otherActor, id);
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        expect(result.data).toBeUndefined();
    });

    it('should return FORBIDDEN if actor lacks all view permissions', async () => {
        actor = createActor({ permissions: [] });
        const existing = createMockSponsorship({ id });
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
