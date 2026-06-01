/**
 * @fileoverview
 * Test suite for the DestinationService.updateFaq method (SPEC-177 T-026).
 * Verifies FAQ update, permission enforcement, not-found handling, and error
 * propagation using the mocked model layer (no DB required).
 *
 * Pattern mirrors AccommodationService.updateFaq tests.
 */
import type { DestinationModel } from '@repo/db';
import * as db from '@repo/db';
import type { DestinationFaqUpdateInput } from '@repo/schemas';
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

describe('DestinationService.updateFaq', () => {
    let service: DestinationService;
    let model: ReturnType<typeof createModelMock>;
    let faqModelMock: ReturnType<typeof createModelMock>;
    let entity: ReturnType<typeof createDestination>;
    let actor: ReturnType<typeof createActor>;
    let faqId: string;
    let faq: { id: string; destinationId: string; question: string; answer: string };
    let input: DestinationFaqUpdateInput;

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
        faqId = getMockFaqId('dest-faq-1');
        faq = {
            id: faqId,
            destinationId: entity.id as string,
            question: '¿Cómo llego desde Buenos Aires?',
            answer: 'Por la Ruta Nacional 14 o en micro.'
        };
        input = {
            destinationId: entity.id as DestinationFaqUpdateInput['destinationId'],
            faqId: faqId as DestinationFaqUpdateInput['faqId'],
            faq: {
                question: '¿Cuál es la mejor ruta desde Buenos Aires?',
                answer: 'Por la Ruta Nacional 14, aproximadamente 4 horas de viaje.'
            }
        };
        vi.spyOn(db, 'DestinationFaqModel').mockImplementation(
            () => faqModelMock as unknown as db.DestinationFaqModel
        );
    });

    it('should update a FAQ successfully', async () => {
        (model.findById as Mock).mockResolvedValue(entity);
        (faqModelMock.findById as Mock).mockResolvedValue(faq);
        (faqModelMock.update as Mock).mockResolvedValue({ ...faq, ...input.faq });
        vi.spyOn(permissionHelpers, 'checkCanUpdateDestination').mockImplementation(() => {});

        const result = await service.updateFaq(actor, input);

        expect(result.error).toBeUndefined();
        expect(result.data?.faq).toMatchObject({
            id: faqId,
            question: input.faq.question,
            answer: input.faq.answer
        });
        expect(model.findById).toHaveBeenCalledWith(entity.id, undefined);
        expect(faqModelMock.findById).toHaveBeenCalledWith(faqId, undefined);
        expect(faqModelMock.update).toHaveBeenCalledWith(
            { id: faqId },
            expect.objectContaining({ question: input.faq.question }),
            undefined
        );
    });

    it('should return NOT_FOUND if destination does not exist', async () => {
        (model.findById as Mock).mockResolvedValue(null);

        const result = await service.updateFaq(actor, input);

        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        expect(faqModelMock.findById).not.toHaveBeenCalled();
    });

    it('should return NOT_FOUND if FAQ does not exist', async () => {
        (model.findById as Mock).mockResolvedValue(entity);
        (faqModelMock.findById as Mock).mockResolvedValue(null);
        vi.spyOn(permissionHelpers, 'checkCanUpdateDestination').mockImplementation(() => {});

        const result = await service.updateFaq(actor, input);

        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        expect(faqModelMock.update).not.toHaveBeenCalled();
    });

    it('should return NOT_FOUND if FAQ belongs to a different destination', async () => {
        (model.findById as Mock).mockResolvedValue(entity);
        (faqModelMock.findById as Mock).mockResolvedValue({
            ...faq,
            destinationId: 'other-destination-id'
        });
        vi.spyOn(permissionHelpers, 'checkCanUpdateDestination').mockImplementation(() => {});

        const result = await service.updateFaq(actor, input);

        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        expect(faqModelMock.update).not.toHaveBeenCalled();
    });

    it('should return FORBIDDEN if actor lacks DESTINATION_UPDATE', async () => {
        (model.findById as Mock).mockResolvedValue(entity);
        vi.spyOn(permissionHelpers, 'checkCanUpdateDestination').mockImplementation(() => {
            throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'forbidden');
        });

        const result = await service.updateFaq(actor, input);

        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        expect(faqModelMock.update).not.toHaveBeenCalled();
    });

    it('should return INTERNAL_ERROR when update returns null', async () => {
        (model.findById as Mock).mockResolvedValue(entity);
        (faqModelMock.findById as Mock).mockResolvedValue(faq);
        (faqModelMock.update as Mock).mockResolvedValue(null);
        vi.spyOn(permissionHelpers, 'checkCanUpdateDestination').mockImplementation(() => {});

        const result = await service.updateFaq(actor, input);

        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
    });

    it('should return INTERNAL_ERROR when FAQ model throws', async () => {
        (model.findById as Mock).mockResolvedValue(entity);
        (faqModelMock.findById as Mock).mockResolvedValue(faq);
        (faqModelMock.update as Mock).mockRejectedValue(new Error('DB error'));
        vi.spyOn(permissionHelpers, 'checkCanUpdateDestination').mockImplementation(() => {});

        const result = await service.updateFaq(actor, input);

        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
    });

    it('should return VALIDATION_ERROR for invalid input', async () => {
        // @ts-expect-error purposely invalid
        const result = await service.updateFaq(actor, {});

        expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
    });
});
