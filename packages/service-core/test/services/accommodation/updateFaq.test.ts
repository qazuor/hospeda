/**
 * @fileoverview
 * Test suite for the AccommodationService.updateFaq method.
 * Ensures robust, type-safe, and homogeneous handling of FAQ update, validation, permission, and error propagation logic.
 *
 * All test data, comments, and documentation are in English, following project guidelines.
 */
import type { AccommodationModel } from '@repo/db';
import * as db from '@repo/db';
import type { AccommodationFaqUpdateInput } from '@repo/schemas';
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
    expectInternalError,
    expectNotFoundError,
    expectSuccess,
    expectValidationError
} from '../../helpers/assertions';
import { createServiceTestInstance } from '../../helpers/serviceTestFactory';
import { createModelMock } from '../../utils/modelMockFactory';

/**
 * Test suite for the AccommodationService.updateFaq method.
 *
 * This suite verifies:
 * - Correct FAQ update on valid input and permissions
 * - Validation and error codes for not found, forbidden, validation, and internal errors
 * - Robustness against errors in hooks and database operations
 *
 * The tests use mocks and spies to simulate model and service behavior, ensuring
 * all error paths and edge cases are covered in a type-safe, DRY, and robust manner.
 */
describe('AccommodationService.updateFaq', () => {
    let service: AccommodationService;
    let modelMock: Mocked<AccommodationModel>;
    let faqModelMock: ReturnType<typeof createModelMock>;
    let actor: ReturnType<typeof ActorFactoryBuilder.prototype.build>;
    let accommodation: ReturnType<typeof AccommodationFactoryBuilder.prototype.build>;
    let faq: { id: string; accommodationId: string; question: string; answer: string };
    let input: AccommodationFaqUpdateInput;
    let updateData: { question: string; answer: string; accommodationId: string };

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
        faq = {
            id: getMockFaqId('faq-1'),
            accommodationId: accommodation.id as any,
            question: 'What is the check-in time?',
            answer: 'From 2:00 PM.'
        };
        updateData = {
            question: 'Updated question?',
            answer: 'From 3:00 PM.',
            accommodationId: accommodation.id as any
        };
        input = {
            accommodationId: accommodation.id as any,
            faqId: getMockFaqId(faq.id) as any,
            faq: {
                question: updateData.question,
                answer: updateData.answer
            }
        };
        vi.spyOn(db, 'AccommodationFaqModel').mockImplementation(
            () => faqModelMock as unknown as db.AccommodationFaqModel
        );
    });

    it('should update a FAQ successfully', async () => {
        modelMock.findById.mockResolvedValue(accommodation);
        faqModelMock.findById.mockResolvedValue(faq);
        faqModelMock.update.mockResolvedValue({ ...faq, ...updateData });
        vi.spyOn(Object.getPrototypeOf(service), '_canUpdate').mockImplementation(() => {});
        const result = await service.updateFaq(actor, input);
        expectSuccess(result);
        expect(result.data?.faq).toMatchObject({ ...faq, ...updateData });
        expect(modelMock.findById).toHaveBeenCalledWith(accommodation.id as any);
        expect(faqModelMock.findById).toHaveBeenCalledWith(faq.id as any);
        expect(faqModelMock.update).toHaveBeenCalledWith({ id: faq.id as any }, updateData);
    });

    it('should return NOT_FOUND if accommodation does not exist', async () => {
        modelMock.findById.mockResolvedValue(null);
        const result = await service.updateFaq(actor, input);
        expectNotFoundError(result);
        expect(modelMock.findById).toHaveBeenCalledWith(accommodation.id as any);
    });

    it('should return NOT_FOUND if FAQ does not exist', async () => {
        modelMock.findById.mockResolvedValue(accommodation);
        faqModelMock.findById.mockResolvedValue(null);
        vi.spyOn(Object.getPrototypeOf(service), '_canUpdate').mockImplementation(() => {});
        const result = await service.updateFaq(actor, input);
        expectNotFoundError(result);
        expect(modelMock.findById).toHaveBeenCalledWith(accommodation.id as any);
        expect(faqModelMock.findById).toHaveBeenCalledWith(faq.id as any);
    });

    it('should return NOT_FOUND if FAQ does not belong to accommodation', async () => {
        modelMock.findById.mockResolvedValue(accommodation);
        faqModelMock.findById.mockResolvedValue({
            ...faq,
            accommodationId: 'different-accommodation-id' as any
        });
        vi.spyOn(Object.getPrototypeOf(service), '_canUpdate').mockImplementation(() => {});
        const result = await service.updateFaq(actor, input);
        expectNotFoundError(result);
        expect(modelMock.findById).toHaveBeenCalledWith(accommodation.id as any);
        expect(faqModelMock.findById).toHaveBeenCalledWith(faq.id as any);
    });

    it('should return FORBIDDEN if actor cannot update', async () => {
        modelMock.findById.mockResolvedValue(accommodation);
        faqModelMock.findById.mockResolvedValue(faq);
        vi.spyOn(Object.getPrototypeOf(service), '_canUpdate').mockImplementation(() => {
            throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'forbidden');
        });
        const result = await service.updateFaq(actor, input);
        expectForbiddenError(result);
        expect(modelMock.findById).toHaveBeenCalledWith(accommodation.id as any);
    });

    it('should return INTERNAL_ERROR if FAQ update fails', async () => {
        modelMock.findById.mockResolvedValue(accommodation);
        faqModelMock.findById.mockResolvedValue(faq);
        faqModelMock.update.mockResolvedValue(null);
        vi.spyOn(Object.getPrototypeOf(service), '_canUpdate').mockImplementation(() => {});
        const result = await service.updateFaq(actor, input);
        expectInternalError(result);
        expect(modelMock.findById).toHaveBeenCalledWith(accommodation.id as any);
        expect(faqModelMock.findById).toHaveBeenCalledWith(faq.id as any);
        expect(faqModelMock.update).toHaveBeenCalledWith({ id: faq.id as any }, updateData);
    });

    it('should return INTERNAL_ERROR if FAQ model throws', async () => {
        modelMock.findById.mockResolvedValue(accommodation);
        faqModelMock.findById.mockResolvedValue(faq);
        faqModelMock.update.mockRejectedValue(new Error('DB error'));
        vi.spyOn(Object.getPrototypeOf(service), '_canUpdate').mockImplementation(() => {});
        const result = await service.updateFaq(actor, input);
        expectInternalError(result);
        expect(modelMock.findById).toHaveBeenCalledWith(accommodation.id as any);
        expect(faqModelMock.findById).toHaveBeenCalledWith(faq.id as any);
        expect(faqModelMock.update).toHaveBeenCalledWith({ id: faq.id as any }, updateData);
    });

    it('should return VALIDATION_ERROR for invalid input', async () => {
        const result = await service.updateFaq(actor, {} as any);
        expectValidationError(result);
    });
});
