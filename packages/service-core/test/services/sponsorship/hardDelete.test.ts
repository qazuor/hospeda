import type { SponsorshipModel } from '@repo/db';
import { PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SponsorshipService } from '../../../src/services/sponsorship/sponsorship.service';
import { createActor } from '../../factories/actorFactory';
import { createMockSponsorship, getMockSponsorshipId } from '../../factories/sponsorshipFactory';
import { createLoggerMock, createModelMock } from '../../utils/modelMockFactory';

describe('SponsorshipService.hardDelete', () => {
    let service: SponsorshipService;
    let modelMock: ReturnType<typeof createModelMock>;
    let loggerMock: ReturnType<typeof createLoggerMock>;
    let actor: ReturnType<typeof createActor>;
    const id = getMockSponsorshipId('mock-id');

    beforeEach(() => {
        modelMock = createModelMock(['findById', 'hardDelete']);
        loggerMock = createLoggerMock();
        service = new SponsorshipService({
            logger: loggerMock,
            model: modelMock as unknown as SponsorshipModel
        });
        // Actor with HARD_DELETE_ANY can permanently delete any sponsorship
        actor = createActor({ permissions: [PermissionEnum.SPONSORSHIP_HARD_DELETE_ANY] });
        vi.clearAllMocks();
    });

    it('should hard delete a sponsorship when actor has HARD_DELETE_ANY permission', async () => {
        const existing = createMockSponsorship({ id });
        modelMock.findById.mockResolvedValue(existing);
        modelMock.hardDelete.mockResolvedValue(1);
        const result = await service.hardDelete(actor, id);
        expect(result.data).toBeDefined();
        expect(result.error).toBeUndefined();
    });

    it('should hard delete a sponsorship when actor has HARD_DELETE_OWN and is the sponsor', async () => {
        // Actor owns the sponsorship (sponsorUserId matches actor.id)
        const ownActor = createActor({ permissions: [PermissionEnum.SPONSORSHIP_HARD_DELETE_OWN] });
        const existing = createMockSponsorship({ id, sponsorUserId: ownActor.id as never });
        modelMock.findById.mockResolvedValue(existing);
        modelMock.hardDelete.mockResolvedValue(1);
        const result = await service.hardDelete(ownActor, id);
        expect(result.data).toBeDefined();
        expect(result.error).toBeUndefined();
    });

    it('should return FORBIDDEN when actor has HARD_DELETE_OWN but is not the sponsor', async () => {
        // Actor has OWN permission but the sponsorship belongs to a different user
        const otherActor = createActor({
            permissions: [PermissionEnum.SPONSORSHIP_HARD_DELETE_OWN]
        });
        const existing = createMockSponsorship({ id, sponsorUserId: 'different-user-id' as never });
        modelMock.findById.mockResolvedValue(existing);
        const result = await service.hardDelete(otherActor, id);
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        expect(result.data).toBeUndefined();
    });

    it('should return FORBIDDEN if actor lacks all hard-delete permissions', async () => {
        actor = createActor({ permissions: [] });
        const existing = createMockSponsorship({ id });
        modelMock.findById.mockResolvedValue(existing);
        const result = await service.hardDelete(actor, id);
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        expect(result.data).toBeUndefined();
    });

    it('should return NOT_FOUND if entity does not exist', async () => {
        modelMock.findById.mockResolvedValue(null);
        const result = await service.hardDelete(actor, id);
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        expect(result.data).toBeUndefined();
    });

    it('should return UNAUTHORIZED if actor is null', async () => {
        // @ts-expect-error purposely passing null
        const result = await service.hardDelete(null, id);
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe('UNAUTHORIZED');
        expect(result.data).toBeUndefined();
    });
});
