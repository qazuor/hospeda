/**
 * @fileoverview
 * Test suite for the DestinationService.getFaqs method (SPEC-158).
 * Validates FAQ listing via the destination relation, permission enforcement,
 * the empty-list case, and error propagation in a type-safe, mocked manner.
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

describe('DestinationService.getFaqs', () => {
    let service: DestinationService;
    let model: ReturnType<typeof createModelMock>;
    let entity: ReturnType<typeof createDestination>;
    let actor: ReturnType<typeof createActor>;
    let input: DestinationFaqListInput;

    beforeEach(() => {
        vi.clearAllMocks();
        model = createModelMock();
        service = new DestinationService(
            { logger: mockLogger },
            model as unknown as DestinationModel
        );
        entity = createDestination();
        actor = createActor({ permissions: [PermissionEnum.DESTINATION_VIEW_PRIVATE] });
        input = { destinationId: entity.id as DestinationFaqListInput['destinationId'] };
    });

    it('should return the FAQs loaded via the destination relation', async () => {
        const faqs = [
            {
                id: 'faq-1',
                destinationId: entity.id,
                question: 'Q1?',
                answer: 'A1',
                category: 'Cómo llegar'
            },
            {
                id: 'faq-2',
                destinationId: entity.id,
                question: 'Q2?',
                answer: 'A2',
                category: 'Qué hacer'
            }
        ];
        (model.findWithRelations as Mock).mockResolvedValue({ ...entity, faqs });
        vi.spyOn(permissionHelpers, 'checkCanViewDestination').mockImplementation(() => {});

        const result = await service.getFaqs(actor, input);

        expect(result.error).toBeUndefined();
        expect(result.data?.faqs).toHaveLength(2);
        expect(result.data?.faqs?.[0]).toMatchObject({ question: 'Q1?', category: 'Cómo llegar' });
        expect(model.findWithRelations).toHaveBeenCalledWith(
            { id: entity.id },
            { faqs: true },
            undefined
        );
    });

    it('should return an empty array when the destination has no FAQs', async () => {
        (model.findWithRelations as Mock).mockResolvedValue({ ...entity, faqs: [] });
        vi.spyOn(permissionHelpers, 'checkCanViewDestination').mockImplementation(() => {});
        const result = await service.getFaqs(actor, input);
        expect(result.error).toBeUndefined();
        expect(result.data?.faqs).toEqual([]);
    });

    it('should default to an empty array when the relation is absent', async () => {
        (model.findWithRelations as Mock).mockResolvedValue({ ...entity });
        vi.spyOn(permissionHelpers, 'checkCanViewDestination').mockImplementation(() => {});
        const result = await service.getFaqs(actor, input);
        expect(result.error).toBeUndefined();
        expect(result.data?.faqs).toEqual([]);
    });

    it('should return NOT_FOUND if destination does not exist', async () => {
        (model.findWithRelations as Mock).mockResolvedValue(null);
        const result = await service.getFaqs(actor, input);
        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
    });

    it('should return FORBIDDEN if actor cannot view', async () => {
        (model.findWithRelations as Mock).mockResolvedValue({ ...entity, faqs: [] });
        vi.spyOn(permissionHelpers, 'checkCanViewDestination').mockImplementation(() => {
            throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'forbidden');
        });
        const result = await service.getFaqs(actor, input);
        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
    });

    it('should return VALIDATION_ERROR for invalid input', async () => {
        // @ts-expect-error purposely invalid
        const result = await service.getFaqs(actor, {});
        expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
    });
});
