/**
 * @fileoverview
 * Test suite for the DestinationService.adminGetFaqs method (SPEC-177 T-026).
 * Verifies admin FAQ listing, permission enforcement, not-found handling, and
 * error propagation using the mocked model layer (no DB required).
 *
 * adminGetFaqs uses _canUpdate (requires DESTINATION_UPDATE) as the gate,
 * unlike getFaqs which uses _canView. This distinction is tested here.
 */
import type { DestinationModel } from '@repo/db';
import type { DestinationFaqListInput } from '@repo/schemas';
import { PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';
import * as permissionHelpers from '../../../src/services/destination/destination.permission';
import { DestinationService } from '../../../src/services/destination/destination.service';
import { ServiceError } from '../../../src/types';
import { createActor } from '../../factories/actorFactory';
import { createDestination } from '../../factories/destinationFactory';
import { createLoggerMock, createModelMock } from '../../utils/modelMockFactory';

const mockLogger = createLoggerMock();

describe('DestinationService.adminGetFaqs', () => {
    let service: DestinationService;
    let model: ReturnType<typeof createModelMock>;
    let entity: ReturnType<typeof createDestination>;
    let actor: ReturnType<typeof createActor>;
    let input: DestinationFaqListInput;

    const sampleFaqs = [
        {
            id: 'faq-1',
            destinationId: 'dest-1',
            question: '¿Cómo llego desde Buenos Aires?',
            answer: 'Por la Ruta Nacional 14.',
            category: 'Cómo llegar',
            displayOrder: 0
        },
        {
            id: 'faq-2',
            destinationId: 'dest-1',
            question: '¿Qué hacer en verano?',
            answer: 'Visitar el río y las playas.',
            category: 'Qué hacer',
            displayOrder: 1
        }
    ];

    beforeEach(() => {
        vi.clearAllMocks();
        model = createModelMock();
        service = new DestinationService(
            { logger: mockLogger },
            model as unknown as DestinationModel
        );
        entity = createDestination();
        actor = createActor({ permissions: [PermissionEnum.DESTINATION_UPDATE] });
        input = { destinationId: entity.id as DestinationFaqListInput['destinationId'] };
    });

    it('should return FAQs for an admin with DESTINATION_UPDATE permission', async () => {
        (model.findWithRelations as Mock).mockResolvedValue({ ...entity, faqs: sampleFaqs });
        vi.spyOn(permissionHelpers, 'checkCanUpdateDestination').mockImplementation(() => {});

        const result = await service.adminGetFaqs(actor, input);

        expect(result.error).toBeUndefined();
        expect(result.data?.faqs).toHaveLength(2);
        expect(result.data?.faqs[0]).toMatchObject({ question: '¿Cómo llego desde Buenos Aires?' });
        expect(model.findWithRelations).toHaveBeenCalledWith(
            { id: entity.id },
            { faqs: true },
            undefined
        );
    });

    it('should return an empty array when destination has no FAQs', async () => {
        (model.findWithRelations as Mock).mockResolvedValue({ ...entity, faqs: [] });
        vi.spyOn(permissionHelpers, 'checkCanUpdateDestination').mockImplementation(() => {});

        const result = await service.adminGetFaqs(actor, input);

        expect(result.error).toBeUndefined();
        expect(result.data?.faqs).toEqual([]);
    });

    it('should default to empty array when the faqs relation is absent', async () => {
        (model.findWithRelations as Mock).mockResolvedValue({ ...entity });
        vi.spyOn(permissionHelpers, 'checkCanUpdateDestination').mockImplementation(() => {});

        const result = await service.adminGetFaqs(actor, input);

        expect(result.error).toBeUndefined();
        expect(result.data?.faqs).toEqual([]);
    });

    it('should return NOT_FOUND if destination does not exist', async () => {
        (model.findWithRelations as Mock).mockResolvedValue(null);

        const result = await service.adminGetFaqs(actor, input);

        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
    });

    it('should return FORBIDDEN if actor lacks DESTINATION_UPDATE', async () => {
        (model.findWithRelations as Mock).mockResolvedValue({ ...entity, faqs: sampleFaqs });
        vi.spyOn(permissionHelpers, 'checkCanUpdateDestination').mockImplementation(() => {
            throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'forbidden');
        });

        const result = await service.adminGetFaqs(actor, input);

        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
    });

    it('should return INTERNAL_ERROR when the relation query throws', async () => {
        (model.findWithRelations as Mock).mockRejectedValue(new Error('DB error'));
        vi.spyOn(permissionHelpers, 'checkCanUpdateDestination').mockImplementation(() => {});

        const result = await service.adminGetFaqs(actor, input);

        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
    });

    it('should return VALIDATION_ERROR for invalid input', async () => {
        // @ts-expect-error purposely invalid
        const result = await service.adminGetFaqs(actor, {});

        expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
    });
});
