/**
 * @fileoverview
 * Test suite for the DestinationService.addFaq method (SPEC-158).
 * Mirrors the AccommodationService.addFaq tests: validates FAQ addition,
 * permission enforcement, and error propagation in a type-safe, mocked manner.
 */
import type { DestinationModel } from '@repo/db';
import * as db from '@repo/db';
import type { DestinationFaqAddInput } from '@repo/schemas';
import { PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';
import * as permissionHelpers from '../../../src/services/destination/destination.permission';
import { DestinationService } from '../../../src/services/destination/destination.service';
import { ServiceError } from '../../../src/types';
import { createActor } from '../../factories/actorFactory';
import { createDestination } from '../../factories/destinationFactory';
import { createLoggerMock, createModelMock } from '../../utils/modelMockFactory';

const mockLogger = createLoggerMock();

describe('DestinationService.addFaq', () => {
    let service: DestinationService;
    let model: ReturnType<typeof createModelMock>;
    let faqModelMock: ReturnType<typeof createModelMock>;
    let entity: ReturnType<typeof createDestination>;
    let actor: ReturnType<typeof createActor>;
    let input: DestinationFaqAddInput;

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
        input = {
            destinationId: entity.id as DestinationFaqAddInput['destinationId'],
            faq: {
                question: '¿Cómo llego a la ciudad desde Buenos Aires?',
                answer: 'En auto por la Ruta Nacional 14 o en micro de larga distancia.',
                category: 'Cómo llegar'
            }
        };
        vi.spyOn(db, 'DestinationFaqModel').mockImplementation(
            () => faqModelMock as unknown as db.DestinationFaqModel
        );
        // addFaq now reads the current max displayOrder (SPEC-177) — default to empty.
        (faqModelMock.findAll as Mock).mockResolvedValue({ items: [] });
    });

    it('should add a FAQ successfully (with category persisted)', async () => {
        (model.findById as Mock).mockResolvedValue(entity);
        (faqModelMock.create as Mock).mockResolvedValue({
            ...input.faq,
            id: 'faq-1',
            destinationId: entity.id
        });
        vi.spyOn(permissionHelpers, 'checkCanUpdateDestination').mockImplementation(() => {});

        const result = await service.addFaq(actor, input);

        expect(result.error).toBeUndefined();
        expect(result.data?.faq).toMatchObject({
            question: input.faq.question,
            answer: input.faq.answer,
            category: 'Cómo llegar',
            destinationId: entity.id
        });
        expect(model.findById).toHaveBeenCalledWith(entity.id, undefined);
        expect(faqModelMock.create).toHaveBeenCalled();
    });

    it('should return NOT_FOUND if destination does not exist', async () => {
        (model.findById as Mock).mockResolvedValue(null);
        const result = await service.addFaq(actor, input);
        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
    });

    it('should return FORBIDDEN if actor cannot update', async () => {
        (model.findById as Mock).mockResolvedValue(entity);
        vi.spyOn(permissionHelpers, 'checkCanUpdateDestination').mockImplementation(() => {
            throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'forbidden');
        });
        const result = await service.addFaq(actor, input);
        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
    });

    it('should return INTERNAL_ERROR if FAQ creation fails', async () => {
        (model.findById as Mock).mockResolvedValue(entity);
        (faqModelMock.create as Mock).mockRejectedValue(new Error('DB error'));
        vi.spyOn(permissionHelpers, 'checkCanUpdateDestination').mockImplementation(() => {});
        const result = await service.addFaq(actor, input);
        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
    });

    it('should return VALIDATION_ERROR for invalid input', async () => {
        // @ts-expect-error purposely invalid
        const result = await service.addFaq(actor, {});
        expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
    });
});
