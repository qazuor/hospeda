/**
 * @fileoverview
 * Test suite for the AccommodationService.getFaqs method.
 * Ensures robust, type-safe, and homogeneous handling of FAQ retrieval, validation, permission, and error propagation logic.
 *
 * All test data, comments, and documentation are in English, following project guidelines.
 */
import type { AccommodationModel } from '@repo/db';
import * as db from '@repo/db';
import type { AccommodationFaqListInput } from '@repo/schemas';
import { ServiceErrorCode } from '@repo/types';
import type { Mocked } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as permissionHelpers from '../../../src/services/accommodation/accommodation.permissions';
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
import { createServiceTestInstance } from '../../helpers/serviceTestFactory';
import { createModelMock } from '../../utils/modelMockFactory';

/**
 * Test suite for the AccommodationService.getFaqs method.
 *
 * This suite verifies:
 * - Correct FAQ retrieval on valid input and permissions
 * - Validation and error codes for not found, forbidden, validation, and internal errors
 * - Robustness against errors in hooks and database operations
 *
 * The tests use mocks and spies to simulate model and service behavior, ensuring
 * all error paths and edge cases are covered in a type-safe, DRY, and robust manner.
 */
describe('AccommodationService.getFaqs', () => {
    let service: AccommodationService;
    let modelMock: Mocked<AccommodationModel>;
    let faqModelMock: ReturnType<typeof createModelMock>;
    let actor: ReturnType<typeof ActorFactoryBuilder.prototype.build>;
    let accommodation: ReturnType<typeof AccommodationFactoryBuilder.prototype.build>;
    let input: AccommodationFaqListInput;
    let faqs: Array<{ id: string; question: string; answer: string; accommodationId: string }>;

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
        input = { accommodationId: accommodation.id as any };
        faqs = [
            {
                id: 'faq-1',
                question: 'What is the check-in time?',
                answer: 'Check-in is from 2:00 PM.',
                accommodationId: accommodation.id as any
            },
            {
                id: 'faq-2',
                question: 'Are pets allowed?',
                answer: 'Yes, pets are allowed upon request.',
                accommodationId: accommodation.id as any
            }
        ];
        vi.spyOn(db, 'AccommodationFaqModel').mockImplementation(
            () => faqModelMock as unknown as db.AccommodationFaqModel
        );
    });

    it('should return faqs for an accommodation', async () => {
        modelMock.findById.mockResolvedValue(accommodation);
        faqModelMock.findAll.mockResolvedValue({ items: faqs });
        vi.spyOn(permissionHelpers, 'checkCanView').mockReturnValue();
        const result = await service.getFaqs(actor, input);
        expectSuccess(result);
        expect(result.data?.faqs).toEqual(faqs);
        expect(modelMock.findById).toHaveBeenCalledWith(accommodation.id as any);
        expect(faqModelMock.findAll).toHaveBeenCalledWith({
            accommodationId: accommodation.id as any
        });
        expect(permissionHelpers.checkCanView).toHaveBeenCalledWith(actor, accommodation);
    });

    it('should return NOT_FOUND if accommodation does not exist', async () => {
        modelMock.findById.mockResolvedValue(null);
        const result = await service.getFaqs(actor, input);
        expectNotFoundError(result);
        expect(modelMock.findById).toHaveBeenCalledWith(accommodation.id as any);
    });

    it('should return FORBIDDEN if actor cannot view', async () => {
        modelMock.findById.mockResolvedValue(accommodation);
        vi.spyOn(permissionHelpers, 'checkCanView').mockImplementation(() => {
            throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'forbidden');
        });
        const result = await service.getFaqs(actor, input);
        expectForbiddenError(result);
        expect(permissionHelpers.checkCanView).toHaveBeenCalledWith(actor, accommodation);
    });

    it('should return INTERNAL_ERROR if FAQ model fails', async () => {
        modelMock.findById.mockResolvedValue(accommodation);
        faqModelMock.findAll.mockRejectedValue(new Error('DB error'));
        vi.spyOn(permissionHelpers, 'checkCanView').mockReturnValue();
        const result = await service.getFaqs(actor, input);
        expectInternalError(result);
        expect(faqModelMock.findAll).toHaveBeenCalledWith({
            accommodationId: accommodation.id as any
        });
    });

    it('should return VALIDATION_ERROR for invalid input', async () => {
        // @ts-expect-error purposely invalid
        const result = await service.getFaqs(actor, {});
        expectValidationError(result);
    });
});
