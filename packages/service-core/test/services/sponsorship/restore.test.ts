import type { SponsorshipModel } from '@repo/db';
import { PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SponsorshipService } from '../../../src/services/sponsorship/sponsorship.service';
import { createActor } from '../../factories/actorFactory';
import { createMockSponsorship, getMockSponsorshipId } from '../../factories/sponsorshipFactory';
import { createLoggerMock, createModelMock } from '../../utils/modelMockFactory';

describe('SponsorshipService.restore', () => {
    let service: SponsorshipService;
    let modelMock: ReturnType<typeof createModelMock>;
    let loggerMock: ReturnType<typeof createLoggerMock>;
    let actor: ReturnType<typeof createActor>;
    const id = getMockSponsorshipId('mock-id');

    beforeEach(() => {
        modelMock = createModelMock(['findById', 'restore']);
        loggerMock = createLoggerMock();
        service = new SponsorshipService({
            logger: loggerMock,
            model: modelMock as unknown as SponsorshipModel
        });
        // Actor with RESTORE_ANY can restore any soft-deleted sponsorship
        actor = createActor({ permissions: [PermissionEnum.SPONSORSHIP_RESTORE_ANY] });
        vi.clearAllMocks();
    });

    it('should restore a soft-deleted sponsorship when actor has RESTORE_ANY permission', async () => {
        // The entity must be soft-deleted (deletedAt set) for restore to execute the model call
        const existing = createMockSponsorship({ id, deletedAt: new Date() });
        modelMock.findById.mockResolvedValue(existing);
        modelMock.restore.mockResolvedValue(1);
        const result = await service.restore(actor, id);
        expect(result.data).toBeDefined();
        expect(result.error).toBeUndefined();
    });

    it('should restore a sponsorship when actor has RESTORE_OWN and is the sponsor', async () => {
        // Actor owns the sponsorship (sponsorUserId matches actor.id)
        const ownActor = createActor({ permissions: [PermissionEnum.SPONSORSHIP_RESTORE_OWN] });
        const existing = createMockSponsorship({
            id,
            sponsorUserId: ownActor.id as never,
            deletedAt: new Date()
        });
        modelMock.findById.mockResolvedValue(existing);
        modelMock.restore.mockResolvedValue(1);
        const result = await service.restore(ownActor, id);
        expect(result.data).toBeDefined();
        expect(result.error).toBeUndefined();
    });

    it('should return FORBIDDEN when actor has RESTORE_OWN but is not the sponsor', async () => {
        // Actor has OWN permission but the sponsorship belongs to a different user
        const otherActor = createActor({ permissions: [PermissionEnum.SPONSORSHIP_RESTORE_OWN] });
        const existing = createMockSponsorship({
            id,
            sponsorUserId: 'different-user-id' as never,
            deletedAt: new Date()
        });
        modelMock.findById.mockResolvedValue(existing);
        const result = await service.restore(otherActor, id);
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        expect(result.data).toBeUndefined();
    });

    it('should return FORBIDDEN if actor lacks all restore permissions', async () => {
        actor = createActor({ permissions: [] });
        const existing = createMockSponsorship({ id, deletedAt: new Date() });
        modelMock.findById.mockResolvedValue(existing);
        const result = await service.restore(actor, id);
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        expect(result.data).toBeUndefined();
    });

    it('should return NOT_FOUND if entity does not exist', async () => {
        modelMock.findById.mockResolvedValue(null);
        const result = await service.restore(actor, id);
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        expect(result.data).toBeUndefined();
    });

    it('should return UNAUTHORIZED if actor is null', async () => {
        // @ts-expect-error purposely passing null
        const result = await service.restore(null, id);
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe('UNAUTHORIZED');
        expect(result.data).toBeUndefined();
    });
});
