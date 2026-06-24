/**
 * @fileoverview
 * Unit tests for AccommodationService.adminGetById and adminGetFaqs (SPEC-169 §2.1/§5.2).
 *
 * These admin detail/sub-tab methods use checkCanAdminView (NOT the generic _canView): an actor
 * with ACCOMMODATION_VIEW_ALL sees any record; an actor with only ACCOMMODATION_VIEW_OWN sees only
 * their own, and another owner's accommodation (even PUBLIC) resolves to NOT_FOUND (decision D2,
 * no existence leak).
 */
import { PermissionEnum, RoleEnum, ServiceErrorCode } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccommodationService } from '../../../src/services/accommodation/accommodation.service';
import type { Actor, ServiceConfig } from '../../../src/types';
import { makeMediaModelStub } from '../../utils/modelMockFactory';

vi.mock('../../../src/services/destination/destination.service', () => ({
    DestinationService: vi.fn().mockImplementation(() => ({}))
}));

vi.mock('../../../src/revalidation/revalidation-init.js', () => ({
    getRevalidationService: vi.fn().mockReturnValue(null)
}));

vi.mock('@repo/db', async (importOriginal) => {
    const original = await importOriginal<typeof import('@repo/db')>();
    return {
        ...original,
        buildSearchCondition: vi.fn(),
        DestinationModel: vi.fn().mockImplementation(() => ({ findById: vi.fn() }))
    };
});

const OWNER_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_ID = '22222222-2222-4222-8222-222222222222';
const ACC_ID = '33333333-3333-4333-8333-333333333333';

class MockAccommodationModel {
    findOneWithRelations = vi.fn();
    findWithRelations = vi.fn();
    findOne = vi.fn();
    findById = vi.fn();
    getTable = vi.fn();
    getTableName = vi.fn().mockReturnValue('accommodations');
}

const actorWith = (permissions: PermissionEnum[], id = OWNER_ID): Actor => ({
    id,
    role: RoleEnum.HOST,
    permissions
});

const ownAccommodation = { id: ACC_ID, ownerId: OWNER_ID, visibility: 'PRIVATE' };
const othersPublicAccommodation = { id: ACC_ID, ownerId: OTHER_ID, visibility: 'PUBLIC' };

describe('AccommodationService.adminGetById (SPEC-169)', () => {
    let model: MockAccommodationModel;
    let service: AccommodationService;

    beforeEach(() => {
        vi.clearAllMocks();
        model = new MockAccommodationModel();
        service = new AccommodationService(
            {} as ServiceConfig,
            model as never,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            // biome-ignore lint/suspicious/noExplicitAny: test stub
            makeMediaModelStub() as any
        );
    });

    it('VIEW_ALL actor gets any accommodation, incl. another owner (AC-4)', async () => {
        model.findOneWithRelations.mockResolvedValue(othersPublicAccommodation);
        const result = await service.adminGetById(
            actorWith([PermissionEnum.ACCOMMODATION_VIEW_ALL], OWNER_ID),
            ACC_ID
        );
        expect(result.error).toBeUndefined();
        expect(result.data?.id).toBe(ACC_ID);
    });

    it('VIEW_OWN actor gets their OWN accommodation (AC-8)', async () => {
        model.findOneWithRelations.mockResolvedValue(ownAccommodation);
        const result = await service.adminGetById(
            actorWith([PermissionEnum.ACCOMMODATION_VIEW_OWN], OWNER_ID),
            ACC_ID
        );
        expect(result.error).toBeUndefined();
        expect(result.data?.id).toBe(ACC_ID);
    });

    it('VIEW_OWN actor gets NOT_FOUND for another owner PUBLIC accommodation (AC-9)', async () => {
        model.findOneWithRelations.mockResolvedValue(othersPublicAccommodation);
        const result = await service.adminGetById(
            actorWith([PermissionEnum.ACCOMMODATION_VIEW_OWN], OWNER_ID),
            ACC_ID
        );
        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
    });

    it('returns NOT_FOUND when the accommodation does not exist', async () => {
        model.findOneWithRelations.mockResolvedValue(null);
        const result = await service.adminGetById(
            actorWith([PermissionEnum.ACCOMMODATION_VIEW_ALL], OWNER_ID),
            ACC_ID
        );
        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
    });
});

describe('AccommodationService.adminGetFaqs (SPEC-169)', () => {
    let model: MockAccommodationModel;
    let service: AccommodationService;

    beforeEach(() => {
        vi.clearAllMocks();
        model = new MockAccommodationModel();
        service = new AccommodationService(
            {} as ServiceConfig,
            model as never,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            // biome-ignore lint/suspicious/noExplicitAny: test stub
            makeMediaModelStub() as any
        );
    });

    it('VIEW_OWN actor gets FAQs of their OWN accommodation (AC-8)', async () => {
        model.findWithRelations.mockResolvedValue({
            ...ownAccommodation,
            faqs: [{ id: 'faq-1', question: 'q', answer: 'a' }]
        });
        const result = await service.adminGetFaqs(
            actorWith([PermissionEnum.ACCOMMODATION_VIEW_OWN], OWNER_ID),
            { accommodationId: ACC_ID }
        );
        expect(result.error).toBeUndefined();
        expect(result.data?.faqs).toHaveLength(1);
    });

    it('VIEW_OWN actor gets NOT_FOUND for another owner accommodation FAQs (AC-9)', async () => {
        model.findWithRelations.mockResolvedValue({ ...othersPublicAccommodation, faqs: [] });
        const result = await service.adminGetFaqs(
            actorWith([PermissionEnum.ACCOMMODATION_VIEW_OWN], OWNER_ID),
            { accommodationId: ACC_ID }
        );
        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
    });

    it('VIEW_ALL staff gets FAQs of any accommodation (AC-4)', async () => {
        model.findWithRelations.mockResolvedValue({
            ...othersPublicAccommodation,
            faqs: [{ id: 'faq-1', question: 'q', answer: 'a' }]
        });
        const result = await service.adminGetFaqs(
            actorWith([PermissionEnum.ACCOMMODATION_VIEW_ALL], OWNER_ID),
            { accommodationId: ACC_ID }
        );
        expect(result.error).toBeUndefined();
        expect(result.data?.faqs).toHaveLength(1);
    });
});
