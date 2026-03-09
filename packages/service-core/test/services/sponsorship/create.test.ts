import type { SponsorshipModel } from '@repo/db';
import { PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SponsorshipService } from '../../../src/services/sponsorship/sponsorship.service';
import { createActor } from '../../factories/actorFactory';
import {
    createMockSponsorship,
    createMockSponsorshipCreateInput,
    getMockSponsorshipId
} from '../../factories/sponsorshipFactory';
import { createLoggerMock, createModelMock } from '../../utils/modelMockFactory';

describe('SponsorshipService.create', () => {
    let service: SponsorshipService;
    let modelMock: ReturnType<typeof createModelMock>;
    let loggerMock: ReturnType<typeof createLoggerMock>;
    let actor: ReturnType<typeof createActor>;

    beforeEach(() => {
        modelMock = createModelMock(['create']);
        loggerMock = createLoggerMock();
        service = new SponsorshipService({
            logger: loggerMock,
            model: modelMock as unknown as SponsorshipModel
        });
        actor = createActor({ permissions: [PermissionEnum.SPONSORSHIP_CREATE] });
        vi.clearAllMocks();
    });

    it('should create a sponsorship when permissions are valid', async () => {
        const input = createMockSponsorshipCreateInput();
        const created = createMockSponsorship({ id: getMockSponsorshipId('new-id') });
        modelMock.create.mockResolvedValue(created);
        const result = await service.create(actor, input);
        expect(result.data).toBeDefined();
        expect(result.error).toBeUndefined();
        expect(modelMock.create).toHaveBeenCalled();
    });

    it('should return FORBIDDEN if actor lacks permission', async () => {
        actor = createActor({ permissions: [] });
        const input = createMockSponsorshipCreateInput();
        const result = await service.create(actor, input);
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        expect(result.data).toBeUndefined();
    });

    it('should return INTERNAL_ERROR if model throws', async () => {
        const input = createMockSponsorshipCreateInput();
        modelMock.create.mockRejectedValue(new Error('DB error'));
        const result = await service.create(actor, input);
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
        expect(result.data).toBeUndefined();
    });

    it('should return UNAUTHORIZED if actor is null', async () => {
        const input = createMockSponsorshipCreateInput();
        // @ts-expect-error purposely passing null
        const result = await service.create(null, input);
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe('UNAUTHORIZED');
        expect(result.data).toBeUndefined();
    });
});
