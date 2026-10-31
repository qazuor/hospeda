/**
 * @fileoverview
 * Regression for HOS-1919: child writes (FAQs, IA data) on a soft-deleted
 * (trashed) accommodation must answer NOT_FOUND and write nothing.
 */
import type { AccommodationModel } from '@repo/db';
import * as db from '@repo/db';
import type { Mocked } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as permissionHelpers from '../../../src/services/accommodation/accommodation.permissions';
import { AccommodationService } from '../../../src/services/accommodation/accommodation.service';
import { AccommodationFactoryBuilder } from '../../factories/accommodationFactory';
import { ActorFactoryBuilder } from '../../factories/actorFactory';
import { expectNotFoundError, expectSuccess } from '../../helpers/assertions';
import { createServiceTestInstance } from '../../helpers/serviceTestFactory';
import { createModelMock } from '../../utils/modelMockFactory';

vi.mock('@repo/db', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/db')>();
    const doubles = await import('../../helpers/owner-act-doubles');
    return {
        ...actual,
        domainEventModel: doubles.domainEventModelDouble,
        withTransaction: doubles.fakeDbWithTransaction
    };
});

describe('AccommodationService child writes on a trashed accommodation (HOS-1919)', () => {
    let service: AccommodationService;
    let modelMock: Mocked<AccommodationModel>;
    let faqModelMock: ReturnType<typeof createModelMock>;
    let iaModelMock: ReturnType<typeof createModelMock>;
    const actor = new ActorFactoryBuilder().host().build();
    const accommodation = new AccommodationFactoryBuilder().public().build();
    const faqInput = {
        accommodationId: accommodation.id as never,
        faq: { question: 'Check-in time?', answer: 'From 2:00 PM.' }
    };

    beforeEach(() => {
        vi.clearAllMocks();
        modelMock = {
            ...createModelMock(['findById']),
            table: 'accommodation',
            entityName: 'accommodation'
        } as unknown as Mocked<AccommodationModel>;
        faqModelMock = createModelMock(['create', 'findById', 'update', 'findAll', 'hardDelete']);
        iaModelMock = createModelMock(['create', 'findById', 'update', 'hardDelete']);
        service = createServiceTestInstance(AccommodationService, modelMock);
        vi.spyOn(db, 'AccommodationFaqModel').mockImplementation(function () {
            return faqModelMock as unknown as db.AccommodationFaqModel;
        });
        vi.spyOn(db, 'AccommodationIaDataModel').mockImplementation(function () {
            return iaModelMock as unknown as db.AccommodationIaDataModel;
        });
        vi.spyOn(permissionHelpers, 'checkCanUpdate').mockReturnValue();
        faqModelMock.findAll.mockResolvedValue({ items: [] });
        faqModelMock.create.mockResolvedValue({ id: 'faq-1', ...faqInput.faq });
    });

    it('addFaq writes when the accommodation is live', async () => {
        modelMock.findById.mockResolvedValue({ ...accommodation, deletedAt: null });

        const result = await service.addFaq(actor, faqInput);

        expectSuccess(result);
        expect(faqModelMock.create).toHaveBeenCalled();
    });

    it('addFaq returns NOT_FOUND and writes nothing when the accommodation is soft-deleted', async () => {
        modelMock.findById.mockResolvedValue({ ...accommodation, deletedAt: new Date() });

        const result = await service.addFaq(actor, faqInput);

        expectNotFoundError(result);
        expect(faqModelMock.create).not.toHaveBeenCalled();
    });

    it('removeIAData returns NOT_FOUND and deletes nothing when the accommodation is soft-deleted', async () => {
        modelMock.findById.mockResolvedValue({ ...accommodation, deletedAt: new Date() });

        const result = await service.removeIAData(
            { accommodationId: accommodation.id as never, iaDataId: accommodation.id as never },
            actor
        );

        expectNotFoundError(result);
        expect(iaModelMock.hardDelete).not.toHaveBeenCalled();
    });
});
