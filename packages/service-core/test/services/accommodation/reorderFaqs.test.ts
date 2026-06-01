/**
 * @fileoverview
 * Test suite for AccommodationService.reorderFaqs (SPEC-177 T-027).
 *
 * Covers:
 * - Happy path: reorder persists the given displayOrder sequence
 * - VALIDATION_ERROR when an unknown/foreign faqId is supplied
 * - FORBIDDEN when actor lacks the required UPDATE permission
 * - NOT_FOUND when the accommodation does not exist
 * - Host non-owner denied (UPDATE_OWN without ownership)
 * - addFaq displayOrder: assigns max+1 when FAQs exist, 0 when empty
 *
 * withTransaction is mocked to execute the callback immediately so no real
 * DB connection is required.
 */
import type { AccommodationModel } from '@repo/db';
import * as db from '@repo/db';
import type { AccommodationFaqAddInput, AccommodationFaqReorderInput } from '@repo/schemas';
import { ServiceErrorCode } from '@repo/schemas';
import type { Mocked } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccommodationService } from '../../../src/services/accommodation/accommodation.service';
import { ServiceError } from '../../../src/types';
import { AccommodationFactoryBuilder } from '../../factories/accommodationFactory';
import { ActorFactoryBuilder } from '../../factories/actorFactory';
import { getMockFaqId } from '../../factories/utilsFactory';
import {
    expectForbiddenError,
    expectNotFoundError,
    expectSuccess,
    expectValidationError
} from '../../helpers/assertions';
import { createServiceTestInstance } from '../../helpers/serviceTestFactory';
import { createModelMock } from '../../utils/modelMockFactory';

describe('AccommodationService.reorderFaqs', () => {
    let service: AccommodationService;
    let modelMock: Mocked<AccommodationModel>;
    let faqModelMock: ReturnType<typeof createModelMock>;
    let actor: ReturnType<typeof ActorFactoryBuilder.prototype.build>;
    let accommodation: ReturnType<typeof AccommodationFactoryBuilder.prototype.build>;
    let faqId1: string;
    let faqId2: string;
    let existingFaqs: Array<{ id: string; accommodationId: string; displayOrder: number }>;
    let input: AccommodationFaqReorderInput;

    beforeEach(() => {
        vi.clearAllMocks();
        modelMock = {
            ...createModelMock(['findById']),
            table: 'accommodation',
            entityName: 'accommodation',
            countByFilters: vi.fn(),
            search: vi.fn(),
            create: vi.fn()
        } as unknown as Mocked<AccommodationModel>;
        faqModelMock = createModelMock(['create', 'findById', 'update', 'findAll', 'hardDelete']);
        service = createServiceTestInstance(AccommodationService, modelMock);
        actor = new ActorFactoryBuilder().host().build();
        accommodation = new AccommodationFactoryBuilder().public().build();
        faqId1 = getMockFaqId('acc-reorder-faq-1');
        faqId2 = getMockFaqId('acc-reorder-faq-2');
        existingFaqs = [
            { id: faqId1, accommodationId: accommodation.id as string, displayOrder: 1 },
            { id: faqId2, accommodationId: accommodation.id as string, displayOrder: 0 }
        ];
        input = {
            accommodationId: accommodation.id as AccommodationFaqReorderInput['accommodationId'],
            order: [
                { faqId: faqId1 as string, displayOrder: 0 },
                { faqId: faqId2 as string, displayOrder: 1 }
            ]
        };

        vi.spyOn(db, 'AccommodationFaqModel').mockImplementation(
            () => faqModelMock as unknown as db.AccommodationFaqModel
        );
        // withTransaction: execute callback immediately with a no-op tx
        vi.spyOn(db, 'withTransaction').mockImplementation(((
            fn: (tx: unknown) => Promise<unknown>
        ) => fn({})) as unknown as typeof db.withTransaction);
    });

    it('should reorder FAQs successfully and call update for each item', async () => {
        modelMock.findById.mockResolvedValue(accommodation);
        faqModelMock.findAll.mockResolvedValue({ items: existingFaqs });
        faqModelMock.update.mockResolvedValue({});
        vi.spyOn(Object.getPrototypeOf(service), '_canUpdate').mockImplementation(() => {});

        const result = await service.reorderFaqs(actor, input);

        expectSuccess(result);
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
        const unknownId = getMockFaqId('foreign-faq-id');
        modelMock.findById.mockResolvedValue(accommodation);
        faqModelMock.findAll.mockResolvedValue({ items: existingFaqs });
        vi.spyOn(Object.getPrototypeOf(service), '_canUpdate').mockImplementation(() => {});

        const inputWithForeign: AccommodationFaqReorderInput = {
            ...input,
            order: [
                { faqId: faqId1 as string, displayOrder: 0 },
                { faqId: unknownId as string, displayOrder: 1 }
            ]
        };

        const result = await service.reorderFaqs(actor, inputWithForeign);

        expectValidationError(result);
        expect(result.error?.message).toContain(unknownId);
        expect(faqModelMock.update).not.toHaveBeenCalled();
    });

    it('should return NOT_FOUND if accommodation does not exist', async () => {
        modelMock.findById.mockResolvedValue(null);

        const result = await service.reorderFaqs(actor, input);

        expectNotFoundError(result);
        expect(faqModelMock.findAll).not.toHaveBeenCalled();
    });

    it('should return FORBIDDEN for a host who is not the owner (UPDATE_OWN without ownership)', async () => {
        modelMock.findById.mockResolvedValue(accommodation);
        vi.spyOn(Object.getPrototypeOf(service), '_canUpdate').mockImplementation(() => {
            throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'forbidden: not the owner');
        });

        const result = await service.reorderFaqs(actor, input);

        expectForbiddenError(result);
        expect(faqModelMock.update).not.toHaveBeenCalled();
    });

    it('should return VALIDATION_ERROR for invalid input (empty order)', async () => {
        const result = await service.reorderFaqs(actor, {
            accommodationId: accommodation.id as AccommodationFaqReorderInput['accommodationId'],
            order: [] as AccommodationFaqReorderInput['order']
        });

        expectValidationError(result);
    });
});

describe('AccommodationService.addFaq – displayOrder assignment', () => {
    let service: AccommodationService;
    let modelMock: Mocked<AccommodationModel>;
    let faqModelMock: ReturnType<typeof createModelMock>;
    let actor: ReturnType<typeof ActorFactoryBuilder.prototype.build>;
    let accommodation: ReturnType<typeof AccommodationFactoryBuilder.prototype.build>;

    beforeEach(() => {
        vi.restoreAllMocks();
        vi.clearAllMocks();
        modelMock = {
            ...createModelMock(['findById']),
            table: 'accommodation',
            entityName: 'accommodation',
            countByFilters: vi.fn(),
            search: vi.fn(),
            create: vi.fn()
        } as unknown as Mocked<AccommodationModel>;
        faqModelMock = createModelMock(['create', 'findById', 'update', 'findAll', 'hardDelete']);
        service = createServiceTestInstance(AccommodationService, modelMock);
        actor = new ActorFactoryBuilder().host().build();
        accommodation = new AccommodationFactoryBuilder().public().build();

        vi.spyOn(db, 'AccommodationFaqModel').mockImplementation(
            () => faqModelMock as unknown as db.AccommodationFaqModel
        );
    });

    it('should assign displayOrder = max+1 when FAQs already exist', async () => {
        const highestOrder = 7;
        modelMock.findById.mockResolvedValue(accommodation);
        faqModelMock.findAll.mockResolvedValue({
            items: [{ id: getMockFaqId('faq-existing'), displayOrder: highestOrder }]
        });
        faqModelMock.create.mockImplementation((data: Record<string, unknown>) =>
            Promise.resolve({ id: getMockFaqId('new-faq'), ...data })
        );
        vi.spyOn(Object.getPrototypeOf(service), '_canUpdate').mockImplementation(() => {});

        const input: AccommodationFaqAddInput = {
            accommodationId: accommodation.id as AccommodationFaqAddInput['accommodationId'],
            faq: {
                question: 'What time is checkout?',
                answer: 'Checkout is at 11:00 AM.'
            }
        };

        const result = await service.addFaq(actor, input);

        expectSuccess(result);
        expect(faqModelMock.create).toHaveBeenCalledWith(
            expect.objectContaining({ displayOrder: highestOrder + 1 }),
            undefined
        );
    });

    it('should assign displayOrder = 0 when no FAQs exist yet', async () => {
        modelMock.findById.mockResolvedValue(accommodation);
        faqModelMock.findAll.mockResolvedValue({ items: [] });
        faqModelMock.create.mockImplementation((data: Record<string, unknown>) =>
            Promise.resolve({ id: getMockFaqId('first-faq'), ...data })
        );
        vi.spyOn(Object.getPrototypeOf(service), '_canUpdate').mockImplementation(() => {});

        const input: AccommodationFaqAddInput = {
            accommodationId: accommodation.id as AccommodationFaqAddInput['accommodationId'],
            faq: {
                question: 'Is breakfast included?',
                answer: 'Yes, continental breakfast is included.'
            }
        };

        const result = await service.addFaq(actor, input);

        expectSuccess(result);
        expect(faqModelMock.create).toHaveBeenCalledWith(
            expect.objectContaining({ displayOrder: 0 }),
            undefined
        );
    });
});
