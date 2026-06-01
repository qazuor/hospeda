/**
 * @fileoverview
 * Test suite for the DestinationService.removeFaq method (SPEC-177 T-026).
 * Verifies FAQ removal, permission enforcement, not-found handling, and error
 * propagation using the mocked model layer (no DB required).
 *
 * Pattern mirrors AccommodationService.removeFaq tests.
 */
import type { DestinationModel } from '@repo/db';
import * as db from '@repo/db';
import type { DestinationFaqRemoveInput } from '@repo/schemas';
import { PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';
import * as permissionHelpers from '../../../src/services/destination/destination.permission';
import { DestinationService } from '../../../src/services/destination/destination.service';
import { ServiceError } from '../../../src/types';
import { createActor } from '../../factories/actorFactory';
import { createDestination } from '../../factories/destinationFactory';
import { getMockFaqId } from '../../factories/utilsFactory';
import { createLoggerMock, createModelMock } from '../../utils/modelMockFactory';

const mockLogger = createLoggerMock();

describe('DestinationService.removeFaq', () => {
    let service: DestinationService;
    let model: ReturnType<typeof createModelMock>;
    let faqModelMock: ReturnType<typeof createModelMock>;
    let entity: ReturnType<typeof createDestination>;
    let actor: ReturnType<typeof createActor>;
    let faqId: string;
    let faq: { id: string; destinationId: string; question: string; answer: string };
    let input: DestinationFaqRemoveInput;

    beforeEach(() => {
        vi.clearAllMocks();
        model = createModelMock();
        faqModelMock = createModelMock(['create', 'findById', 'update', 'findAll', 'hardDelete']);
        service = new DestinationService(
            { logger: mockLogger },
            model as unknown as DestinationModel
        );
        entity = createDestination();
        actor = createActor({ permissions: [PermissionEnum.DESTINATION_UPDATE] });
        faqId = getMockFaqId('dest-faq-remove-1');
        faq = {
            id: faqId,
            destinationId: entity.id as string,
            question: '¿Cómo llego desde Buenos Aires?',
            answer: 'Por la Ruta Nacional 14 o en micro.'
        };
        input = {
            destinationId: entity.id as DestinationFaqRemoveInput['destinationId'],
            faqId: faqId as DestinationFaqRemoveInput['faqId']
        };
        vi.spyOn(db, 'DestinationFaqModel').mockImplementation(
            () => faqModelMock as unknown as db.DestinationFaqModel
        );
    });

    it('should remove a FAQ successfully', async () => {
        (model.findById as Mock).mockResolvedValue(entity);
        (faqModelMock.findById as Mock).mockResolvedValue(faq);
        (faqModelMock.hardDelete as Mock).mockResolvedValue(1);
        vi.spyOn(permissionHelpers, 'checkCanUpdateDestination').mockImplementation(() => {});

        const result = await service.removeFaq(actor, input);

        expect(result.error).toBeUndefined();
        expect(result.data).toEqual({ success: true });
        expect(model.findById).toHaveBeenCalledWith(entity.id, undefined);
        expect(faqModelMock.findById).toHaveBeenCalledWith(faqId, undefined);
        expect(faqModelMock.hardDelete).toHaveBeenCalledWith({ id: faqId }, undefined);
    });

    it('should return NOT_FOUND if destination does not exist', async () => {
        (model.findById as Mock).mockResolvedValue(null);

        const result = await service.removeFaq(actor, input);

        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        expect(faqModelMock.findById).not.toHaveBeenCalled();
    });

    it('should return NOT_FOUND if FAQ does not exist', async () => {
        (model.findById as Mock).mockResolvedValue(entity);
        (faqModelMock.findById as Mock).mockResolvedValue(null);
        vi.spyOn(permissionHelpers, 'checkCanUpdateDestination').mockImplementation(() => {});

        const result = await service.removeFaq(actor, input);

        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        expect(faqModelMock.hardDelete).not.toHaveBeenCalled();
    });

    it('should return NOT_FOUND if FAQ belongs to a different destination', async () => {
        (model.findById as Mock).mockResolvedValue(entity);
        (faqModelMock.findById as Mock).mockResolvedValue({
            ...faq,
            destinationId: 'other-destination-id'
        });
        vi.spyOn(permissionHelpers, 'checkCanUpdateDestination').mockImplementation(() => {});

        const result = await service.removeFaq(actor, input);

        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        expect(faqModelMock.hardDelete).not.toHaveBeenCalled();
    });

    it('should return FORBIDDEN if actor lacks DESTINATION_UPDATE', async () => {
        (model.findById as Mock).mockResolvedValue(entity);
        vi.spyOn(permissionHelpers, 'checkCanUpdateDestination').mockImplementation(() => {
            throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'forbidden');
        });

        const result = await service.removeFaq(actor, input);

        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        expect(faqModelMock.hardDelete).not.toHaveBeenCalled();
    });

    it('should return INTERNAL_ERROR when hardDelete throws', async () => {
        (model.findById as Mock).mockResolvedValue(entity);
        (faqModelMock.findById as Mock).mockResolvedValue(faq);
        (faqModelMock.hardDelete as Mock).mockRejectedValue(new Error('DB error'));
        vi.spyOn(permissionHelpers, 'checkCanUpdateDestination').mockImplementation(() => {});

        const result = await service.removeFaq(actor, input);

        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
    });

    it('should return VALIDATION_ERROR for invalid input', async () => {
        // @ts-expect-error purposely invalid
        const result = await service.removeFaq(actor, {});

        expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
    });
});
