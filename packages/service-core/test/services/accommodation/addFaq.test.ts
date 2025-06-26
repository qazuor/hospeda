/**
 * @fileoverview
 * Test suite for the AccommodationService.addFaq method.
 * Ensures robust, type-safe, and homogeneous handling of FAQ addition, validation, permission, and error propagation logic.
 *
 * All test data, comments, and documentation are in English, following project guidelines.
 */
import type { AccommodationModel } from '@repo/db';
import * as db from '@repo/db';
import { ServiceErrorCode } from '@repo/types';
import type { Mocked } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { z } from 'zod';
import * as permissionHelpers from '../../../src/services/accommodation/accommodation.permissions';
import type { AddFaqInputSchema } from '../../../src/services/accommodation/accommodation.schemas';
import { AccommodationService } from '../../../src/services/accommodation/accommodation.service';
import { ServiceError } from '../../../src/types';
import { AccommodationFactoryBuilder } from '../../factories/accommodationFactory';
import { ActorFactoryBuilder } from '../../factories/actorFactory';
import {
    expectForbiddenError,
    expectInternalError,
    expectNotFoundError,
    expectSuccess,
    expectValidationError
} from '../../helpers/assertions';
import { createFaqModelMock, createModelMock } from '../../helpers/modelMockFactory';
import { createServiceTestInstance } from '../../helpers/serviceTestFactory';

/**
 * Test suite for the AccommodationService.addFaq method.
 *
 * This suite verifies:
 * - Correct FAQ addition on valid input and permissions
 * - Validation and error codes for not found, forbidden, validation, and internal errors
 * - Robustness against errors in hooks and database operations
 *
 * The tests use mocks and spies to simulate model and service behavior, ensuring
 * all error paths and edge cases are covered in a type-safe, DRY, and robust manner.
 */
describe('AccommodationService.addFaq', () => {
    let service: AccommodationService;
    let modelMock: Mocked<AccommodationModel>;
    let faqModelMock: ReturnType<typeof createFaqModelMock>;
    let actor: ReturnType<typeof ActorFactoryBuilder.prototype.build>;
    let accommodation: ReturnType<typeof AccommodationFactoryBuilder.prototype.build>;
    let input: z.infer<typeof AddFaqInputSchema>;

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
        faqModelMock = createFaqModelMock();
        service = createServiceTestInstance(AccommodationService, modelMock);
        actor = new ActorFactoryBuilder().host().build();
        accommodation = new AccommodationFactoryBuilder().public().build();
        input = {
            accommodationId: accommodation.id,
            faq: {
                question: 'What is the check-in time?',
                answer: 'Check-in is from 2:00 PM.',
                accommodationId: accommodation.id
            }
        };
        // Mock AccommodationFaqModel for this test
        vi.spyOn(db, 'AccommodationFaqModel').mockImplementation(
            () => faqModelMock as unknown as db.AccommodationFaqModel
        );
    });

    it('should add a FAQ successfully', async () => {
        modelMock.findById.mockResolvedValue(accommodation);
        faqModelMock.create.mockResolvedValue({
            ...input.faq,
            id: 'faq-1',
            accommodationId: accommodation.id
        });
        vi.spyOn(permissionHelpers, 'checkCanUpdate').mockReturnValue();

        const result = await service.addFaq(actor, input);
        expectSuccess(result);
        expect(result.data?.faq).toMatchObject({
            question: input.faq.question,
            answer: input.faq.answer,
            accommodationId: accommodation.id
        });
        expect(modelMock.findById).toHaveBeenCalledWith(accommodation.id);
        expect(faqModelMock.create).toHaveBeenCalled();
        expect(permissionHelpers.checkCanUpdate).toHaveBeenCalledWith(actor, accommodation);
    });

    it('should return NOT_FOUND if accommodation does not exist', async () => {
        modelMock.findById.mockResolvedValue(null);
        const result = await service.addFaq(actor, input);
        expectNotFoundError(result);
        expect(modelMock.findById).toHaveBeenCalledWith(accommodation.id);
    });

    it('should return FORBIDDEN if actor cannot update', async () => {
        modelMock.findById.mockResolvedValue(accommodation);
        vi.spyOn(permissionHelpers, 'checkCanUpdate').mockImplementation(() => {
            throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'forbidden');
        });
        const result = await service.addFaq(actor, input);
        expectForbiddenError(result);
        expect(permissionHelpers.checkCanUpdate).toHaveBeenCalledWith(actor, accommodation);
    });

    it('should return INTERNAL_ERROR if FAQ creation fails', async () => {
        modelMock.findById.mockResolvedValue(accommodation);
        faqModelMock.create.mockRejectedValue(new Error('DB error'));
        vi.spyOn(permissionHelpers, 'checkCanUpdate').mockReturnValue();
        const result = await service.addFaq(actor, input);
        expectInternalError(result);
        expect(faqModelMock.create).toHaveBeenCalled();
    });

    it('should return VALIDATION_ERROR for invalid input', async () => {
        // @ts-expect-error purposely invalid
        const result = await service.addFaq(actor, {});
        expectValidationError(result);
    });
});
