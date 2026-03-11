import type { SponsorshipModel } from '@repo/db';
import { PermissionEnum, ServiceErrorCode, SponsorshipStatusEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SponsorshipService } from '../../../src/services/sponsorship/sponsorship.service';
import { createActor } from '../../factories/actorFactory';
import { createMockSponsorship, getMockSponsorshipId } from '../../factories/sponsorshipFactory';
import { createLoggerMock, createModelMock } from '../../utils/modelMockFactory';

describe('SponsorshipService.update', () => {
    let service: SponsorshipService;
    let modelMock: ReturnType<typeof createModelMock>;
    let loggerMock: ReturnType<typeof createLoggerMock>;
    let actor: ReturnType<typeof createActor>;
    const id = getMockSponsorshipId('mock-id');

    beforeEach(() => {
        modelMock = createModelMock(['findById', 'update']);
        loggerMock = createLoggerMock();
        service = new SponsorshipService({
            logger: loggerMock,
            model: modelMock as unknown as SponsorshipModel
        });
        // Actor with UPDATE_ANY can update any sponsorship
        actor = createActor({ permissions: [PermissionEnum.SPONSORSHIP_UPDATE_ANY] });
        vi.clearAllMocks();
    });

    it('should update a sponsorship when actor has UPDATE_ANY permission', async () => {
        const existing = createMockSponsorship({ id });
        const updated = createMockSponsorship({ id, status: SponsorshipStatusEnum.CANCELLED });
        modelMock.findById.mockResolvedValue(existing);
        modelMock.update.mockResolvedValue(updated);
        const result = await service.update(actor, id, { status: SponsorshipStatusEnum.CANCELLED });
        expect(result.data).toBeDefined();
        expect(result.error).toBeUndefined();
    });

    it('should update a sponsorship when actor has UPDATE_OWN and is the sponsor', async () => {
        // Actor owns the sponsorship (sponsorUserId matches actor.id)
        const ownActor = createActor({ permissions: [PermissionEnum.SPONSORSHIP_UPDATE_OWN] });
        const existing = createMockSponsorship({ id, sponsorUserId: ownActor.id as never });
        const updated = createMockSponsorship({
            id,
            sponsorUserId: ownActor.id as never,
            status: SponsorshipStatusEnum.EXPIRED
        });
        modelMock.findById.mockResolvedValue(existing);
        modelMock.update.mockResolvedValue(updated);
        const result = await service.update(ownActor, id, {
            status: SponsorshipStatusEnum.EXPIRED
        });
        expect(result.data).toBeDefined();
        expect(result.error).toBeUndefined();
    });

    it('should return FORBIDDEN when actor has UPDATE_OWN but is not the sponsor', async () => {
        // Actor has OWN permission but the sponsorship belongs to a different user
        const otherActor = createActor({ permissions: [PermissionEnum.SPONSORSHIP_UPDATE_OWN] });
        const existing = createMockSponsorship({ id, sponsorUserId: 'different-user-id' as never });
        modelMock.findById.mockResolvedValue(existing);
        const result = await service.update(otherActor, id, {
            status: SponsorshipStatusEnum.CANCELLED
        });
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        expect(result.data).toBeUndefined();
    });

    it('should return FORBIDDEN if actor lacks all update permissions', async () => {
        actor = createActor({ permissions: [] });
        const existing = createMockSponsorship({ id });
        modelMock.findById.mockResolvedValue(existing);
        const result = await service.update(actor, id, { status: SponsorshipStatusEnum.CANCELLED });
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        expect(result.data).toBeUndefined();
    });

    it('should return NOT_FOUND if entity does not exist', async () => {
        modelMock.findById.mockResolvedValue(null);
        const result = await service.update(actor, id, { status: SponsorshipStatusEnum.CANCELLED });
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        expect(result.data).toBeUndefined();
    });

    it('should return INTERNAL_ERROR if model throws during update', async () => {
        const existing = createMockSponsorship({ id });
        modelMock.findById.mockResolvedValue(existing);
        modelMock.update.mockRejectedValue(new Error('DB error'));
        const result = await service.update(actor, id, { status: SponsorshipStatusEnum.CANCELLED });
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
        expect(result.data).toBeUndefined();
    });

    it('should return UNAUTHORIZED if actor is null', async () => {
        // @ts-expect-error purposely passing null
        const result = await service.update(null, id, { status: SponsorshipStatusEnum.CANCELLED });
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe('UNAUTHORIZED');
        expect(result.data).toBeUndefined();
    });
});
