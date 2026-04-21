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
        // Actor with UPDATE_ANY + STATUS_MANAGE can update any sponsorship,
        // including the `sponsorshipStatus` field. STATUS_MANAGE is required
        // by the field-level guard added in SPEC-063-gaps T-030.
        actor = createActor({
            permissions: [
                PermissionEnum.SPONSORSHIP_UPDATE_ANY,
                PermissionEnum.SPONSORSHIP_STATUS_MANAGE
            ]
        });
        vi.clearAllMocks();
    });

    it('should update a sponsorship when actor has UPDATE_ANY permission', async () => {
        const existing = createMockSponsorship({ id });
        const updated = createMockSponsorship({
            id,
            sponsorshipStatus: SponsorshipStatusEnum.CANCELLED
        });
        modelMock.findById.mockResolvedValue(existing);
        modelMock.update.mockResolvedValue(updated);
        const result = await service.update(actor, id, {
            sponsorshipStatus: SponsorshipStatusEnum.CANCELLED
        });
        expect(result.data).toBeDefined();
        expect(result.error).toBeUndefined();
    });

    it('should update a sponsorship when actor has UPDATE_OWN and is the sponsor', async () => {
        // Actor owns the sponsorship (sponsorUserId matches actor.id) and has
        // STATUS_MANAGE (required by T-030 field-level guard for sponsorshipStatus mutations).
        const ownActor = createActor({
            permissions: [
                PermissionEnum.SPONSORSHIP_UPDATE_OWN,
                PermissionEnum.SPONSORSHIP_STATUS_MANAGE
            ]
        });
        const existing = createMockSponsorship({ id, sponsorUserId: ownActor.id as never });
        const updated = createMockSponsorship({
            id,
            sponsorUserId: ownActor.id as never,
            sponsorshipStatus: SponsorshipStatusEnum.EXPIRED
        });
        modelMock.findById.mockResolvedValue(existing);
        modelMock.update.mockResolvedValue(updated);
        const result = await service.update(ownActor, id, {
            sponsorshipStatus: SponsorshipStatusEnum.EXPIRED
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
            sponsorshipStatus: SponsorshipStatusEnum.CANCELLED
        });
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        expect(result.data).toBeUndefined();
    });

    it('T-030: should return FORBIDDEN when actor has UPDATE_ANY but lacks STATUS_MANAGE and payload mutates sponsorshipStatus', async () => {
        // Actor has UPDATE permission but NOT the field-level STATUS_MANAGE permission
        const noStatusActor = createActor({
            permissions: [PermissionEnum.SPONSORSHIP_UPDATE_ANY]
        });
        const existing = createMockSponsorship({ id });
        modelMock.findById.mockResolvedValue(existing);
        const result = await service.update(noStatusActor, id, {
            sponsorshipStatus: SponsorshipStatusEnum.CANCELLED
        });
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        expect(result.data).toBeUndefined();
        // The model.update must NOT have been invoked — the guard fires before persistence
        expect(modelMock.update).not.toHaveBeenCalled();
    });

    it('T-030: should ALLOW update when actor has UPDATE_ANY without STATUS_MANAGE if payload omits sponsorshipStatus', async () => {
        const noStatusActor = createActor({
            permissions: [PermissionEnum.SPONSORSHIP_UPDATE_ANY]
        });
        const existing = createMockSponsorship({ id });
        const updated = createMockSponsorship({ id });
        modelMock.findById.mockResolvedValue(existing);
        modelMock.update.mockResolvedValue(updated);
        // Payload mutates a non-status field — STATUS_MANAGE not required
        const result = await service.update(noStatusActor, id, {
            slug: 'new-slug'
        });
        expect(result.error).toBeUndefined();
        expect(result.data).toBeDefined();
    });

    it('should return FORBIDDEN if actor lacks all update permissions', async () => {
        actor = createActor({ permissions: [] });
        const existing = createMockSponsorship({ id });
        modelMock.findById.mockResolvedValue(existing);
        const result = await service.update(actor, id, {
            sponsorshipStatus: SponsorshipStatusEnum.CANCELLED
        });
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        expect(result.data).toBeUndefined();
    });

    it('should return NOT_FOUND if entity does not exist', async () => {
        modelMock.findById.mockResolvedValue(null);
        const result = await service.update(actor, id, {
            sponsorshipStatus: SponsorshipStatusEnum.CANCELLED
        });
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        expect(result.data).toBeUndefined();
    });

    it('should return INTERNAL_ERROR if model throws during update', async () => {
        const existing = createMockSponsorship({ id });
        modelMock.findById.mockResolvedValue(existing);
        modelMock.update.mockRejectedValue(new Error('DB error'));
        const result = await service.update(actor, id, {
            sponsorshipStatus: SponsorshipStatusEnum.CANCELLED
        });
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
        expect(result.data).toBeUndefined();
    });

    it('should return UNAUTHORIZED if actor is null', async () => {
        // @ts-expect-error purposely passing null
        const result = await service.update(null, id, {
            sponsorshipStatus: SponsorshipStatusEnum.CANCELLED
        });
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe('UNAUTHORIZED');
        expect(result.data).toBeUndefined();
    });
});
