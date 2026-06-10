/**
 * @fileoverview
 * Test suite for DestinationService.reorderFaqs (SPEC-177 T-027).
 *
 * Covers:
 * - Happy path: reorder persists the given displayOrder sequence
 * - VALIDATION_ERROR when an unknown or foreign faqId is supplied
 * - FORBIDDEN when actor lacks DESTINATION_UPDATE
 * - NOT_FOUND when the destination does not exist
 * - addFaq displayOrder assignment: assigns max+1 when FAQs exist, 0 when none
 *
 * withTransaction is mocked to execute the callback immediately so no real
 * DB connection is required.
 */
import type { DestinationModel } from '@repo/db';
import * as db from '@repo/db';
import type { DestinationFaqAddInput, DestinationFaqReorderInput } from '@repo/schemas';
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

describe('DestinationService.reorderFaqs', () => {
    let service: DestinationService;
    let model: ReturnType<typeof createModelMock>;
    let faqModelMock: ReturnType<typeof createModelMock>;
    let entity: ReturnType<typeof createDestination>;
    let actor: ReturnType<typeof createActor>;
    let faqId1: string;
    let faqId2: string;
    let existingFaqs: Array<{ id: string; destinationId: string; displayOrder: number }>;
    let input: DestinationFaqReorderInput;

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
        faqId1 = getMockFaqId('dest-reorder-faq-1');
        faqId2 = getMockFaqId('dest-reorder-faq-2');
        existingFaqs = [
            { id: faqId1, destinationId: entity.id as string, displayOrder: 1 },
            { id: faqId2, destinationId: entity.id as string, displayOrder: 0 }
        ];
        input = {
            destinationId: entity.id as DestinationFaqReorderInput['destinationId'],
            order: [
                { faqId: faqId1 as string, displayOrder: 0 },
                { faqId: faqId2 as string, displayOrder: 1 }
            ]
        };

        vi.spyOn(db, 'DestinationFaqModel').mockImplementation(
            () => faqModelMock as unknown as db.DestinationFaqModel
        );
        // withTransaction: execute callback immediately with a no-op tx
        vi.spyOn(db, 'withTransaction').mockImplementation(((
            fn: (tx: unknown) => Promise<unknown>
        ) => fn({})) as unknown as typeof db.withTransaction);
    });

    it('should reorder FAQs successfully and call update for each item', async () => {
        (model.findById as Mock).mockResolvedValue(entity);
        (faqModelMock.findAll as Mock).mockResolvedValue({ items: existingFaqs });
        (faqModelMock.update as Mock).mockResolvedValue({});
        vi.spyOn(permissionHelpers, 'checkCanUpdateDestination').mockImplementation(() => {});

        const result = await service.reorderFaqs(actor, input);

        expect(result.error).toBeUndefined();
        expect(result.data).toEqual({ success: true });
        expect(faqModelMock.update).toHaveBeenCalledTimes(2);
        expect(faqModelMock.update).toHaveBeenCalledWith(
            { id: faqId1 },
            { displayOrder: 0 },
            expect.anything()
        );
        expect(faqModelMock.update).toHaveBeenCalledWith(
            { id: faqId2 },
            { displayOrder: 1 },
            expect.anything()
        );
    });

    it('should return VALIDATION_ERROR when an unknown faqId is supplied', async () => {
        const unknownFaqId = getMockFaqId('completely-unknown-faq');
        (model.findById as Mock).mockResolvedValue(entity);
        (faqModelMock.findAll as Mock).mockResolvedValue({ items: existingFaqs });
        vi.spyOn(permissionHelpers, 'checkCanUpdateDestination').mockImplementation(() => {});

        const inputWithUnknown: DestinationFaqReorderInput = {
            ...input,
            order: [
                { faqId: faqId1 as string, displayOrder: 0 },
                { faqId: unknownFaqId as string, displayOrder: 1 }
            ]
        };

        const result = await service.reorderFaqs(actor, inputWithUnknown);

        expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        expect(result.error?.message).toContain(unknownFaqId);
        expect(faqModelMock.update).not.toHaveBeenCalled();
    });

    it('should return NOT_FOUND if destination does not exist', async () => {
        (model.findById as Mock).mockResolvedValue(null);

        const result = await service.reorderFaqs(actor, input);

        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        expect(faqModelMock.findAll).not.toHaveBeenCalled();
        expect(faqModelMock.update).not.toHaveBeenCalled();
    });

    it('should return FORBIDDEN if actor lacks DESTINATION_UPDATE', async () => {
        (model.findById as Mock).mockResolvedValue(entity);
        vi.spyOn(permissionHelpers, 'checkCanUpdateDestination').mockImplementation(() => {
            throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'forbidden');
        });

        const result = await service.reorderFaqs(actor, input);

        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        expect(faqModelMock.update).not.toHaveBeenCalled();
    });

    it('should return VALIDATION_ERROR for invalid input (empty order)', async () => {
        // The schema requires order.min(1) so an empty array is invalid
        const result = await service.reorderFaqs(actor, {
            destinationId: entity.id as DestinationFaqReorderInput['destinationId'],
            order: [] as DestinationFaqReorderInput['order']
        });

        expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
    });
});

describe('DestinationService.addFaq – displayOrder assignment', () => {
    let service: DestinationService;
    let model: ReturnType<typeof createModelMock>;
    let faqModelMock: ReturnType<typeof createModelMock>;
    let entity: ReturnType<typeof createDestination>;
    let actor: ReturnType<typeof createActor>;

    beforeEach(() => {
        vi.restoreAllMocks();
        vi.clearAllMocks();
        model = createModelMock();
        faqModelMock = createModelMock(['create', 'findById', 'update', 'findAll', 'hardDelete']);
        service = new DestinationService(
            { logger: mockLogger },
            model as unknown as DestinationModel
        );
        entity = createDestination();
        actor = createActor({ permissions: [PermissionEnum.DESTINATION_UPDATE] });

        vi.spyOn(db, 'DestinationFaqModel').mockImplementation(
            () => faqModelMock as unknown as db.DestinationFaqModel
        );
    });

    it('should assign displayOrder = max+1 when existing FAQs are present', async () => {
        const existingFaq = { id: getMockFaqId('existing-faq'), displayOrder: 5 };
        (model.findById as Mock).mockResolvedValue(entity);
        (faqModelMock.findAll as Mock).mockResolvedValue({ items: [existingFaq] });
        (faqModelMock.create as Mock).mockImplementation((data: Record<string, unknown>) =>
            Promise.resolve({ id: getMockFaqId('new'), ...data })
        );
        vi.spyOn(permissionHelpers, 'checkCanUpdateDestination').mockImplementation(() => {});

        const input: DestinationFaqAddInput = {
            destinationId: entity.id as DestinationFaqAddInput['destinationId'],
            faq: {
                question: '¿Qué hacer en invierno en Colón?',
                answer: 'Disfrutar de las termas y el Parque Nacional El Palmar.'
            }
        };

        const result = await service.addFaq(actor, input);

        expect(result.error).toBeUndefined();
        expect(faqModelMock.create).toHaveBeenCalledWith(
            expect.objectContaining({ displayOrder: 6 }),
            undefined
        );
    });

    it('should assign displayOrder = 0 when no FAQs exist yet', async () => {
        (model.findById as Mock).mockResolvedValue(entity);
        (faqModelMock.findAll as Mock).mockResolvedValue({ items: [] });
        (faqModelMock.create as Mock).mockImplementation((data: Record<string, unknown>) =>
            Promise.resolve({ id: getMockFaqId('first'), ...data })
        );
        vi.spyOn(permissionHelpers, 'checkCanUpdateDestination').mockImplementation(() => {});

        const input: DestinationFaqAddInput = {
            destinationId: entity.id as DestinationFaqAddInput['destinationId'],
            faq: {
                question: '¿Cuándo ir a Colón por primera vez?',
                answer: 'En primavera o otoño para temperaturas agradables.'
            }
        };

        const result = await service.addFaq(actor, input);

        expect(result.error).toBeUndefined();
        expect(faqModelMock.create).toHaveBeenCalledWith(
            expect.objectContaining({ displayOrder: 0 }),
            undefined
        );
    });
});
