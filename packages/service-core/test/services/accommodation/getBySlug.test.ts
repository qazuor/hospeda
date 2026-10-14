/**
 * @fileoverview
 * Test suite for the AccommodationService.getBySlug method.
 * Ensures robust, type-safe, and homogeneous handling of getBySlug logic, including:
 * - Successful entity retrieval
 * - Input validation and error handling
 * - Permission checks and forbidden access
 * - Database/internal errors
 * - Lifecycle hook error propagation
 *
 * All test data, comments, and documentation are in English, following project guidelines.
 */
import type { AccommodationModel } from '@repo/db';
import { PermissionEnum, PublicationStatusEnum, ServiceErrorCode } from '@repo/schemas';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import * as permissionHelpers from '../../../src/services/accommodation/accommodation.permissions';
import { AccommodationService } from '../../../src/services/accommodation/accommodation.service';
import { ServiceError } from '../../../src/types';
import { createAccommodationWithMockIds } from '../../factories/accommodationFactory';
import { createActor } from '../../factories/actorFactory';
import { getMockId } from '../../factories/utilsFactory';
import {
    createLoggerMock,
    createModelMock,
    makeMediaModelStub
} from '../../utils/modelMockFactory';

const mockLogger = createLoggerMock();

const createViewActor = () => createActor({ permissions: [PermissionEnum.ACCOMMODATION_VIEW_ALL] });
const createEntity = () => createAccommodationWithMockIds({ deletedAt: undefined });

describe('AccommodationService.getBySlug', () => {
    let service: AccommodationService;
    let model: ReturnType<typeof createModelMock>;
    let entity: ReturnType<typeof createEntity>;
    let actor: ReturnType<typeof createViewActor>;

    beforeEach(() => {
        model = createModelMock();
        service = new AccommodationService(
            { logger: mockLogger },
            model as unknown as AccommodationModel,
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
        entity = createEntity();
        actor = createViewActor();
        vi.clearAllMocks();
    });

    it('should return an accommodation by slug', async () => {
        (model.findOne as Mock).mockResolvedValue(entity);
        (model.findOneWithRelations as Mock).mockResolvedValue(entity);
        vi.spyOn(permissionHelpers, 'checkCanView').mockReturnValue();
        const result = await service.getBySlug(actor, entity.slug);
        expect(result.data).toBeDefined();
        expect(result.data?.slug).toBe(entity.slug);
        expect(result.error).toBeUndefined();
    });

    it('should return a "not found" error if the entity does not exist', async () => {
        (model.findOne as Mock).mockResolvedValue(null);
        (model.findOneWithRelations as Mock).mockResolvedValue(null);
        vi.spyOn(permissionHelpers, 'checkCanView').mockReturnValue();
        const result = await service.getBySlug(actor, entity.slug);
        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        expect(result.data).toBeUndefined();
    });

    it('should return forbidden error if actor lacks permission', async () => {
        (model.findOne as Mock).mockResolvedValue(entity);
        (model.findOneWithRelations as Mock).mockResolvedValue(entity);
        vi.spyOn(permissionHelpers, 'checkCanView').mockImplementation(() => {
            throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'forbidden');
        });
        const result = await service.getBySlug(actor, entity.slug);
        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        expect(result.data).toBeUndefined();
    });

    it('should handle errors from the _beforeGetByField lifecycle hook', async () => {
        (model.findOne as Mock).mockResolvedValue(entity);
        (model.findOneWithRelations as Mock).mockResolvedValue(entity);
        vi.spyOn(permissionHelpers, 'checkCanView').mockReturnValue();
        const hookError = new Error('Error in beforeGetByField hook');
        vi.spyOn(
            service as unknown as { _beforeGetByField: () => void },
            '_beforeGetByField'
        ).mockRejectedValue(hookError);
        const result = await service.getBySlug(actor, entity.slug);
        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
        expect(result.data).toBeUndefined();
    });

    it('should handle errors from the _afterGetByField lifecycle hook', async () => {
        (model.findOne as Mock).mockResolvedValue(entity);
        (model.findOneWithRelations as Mock).mockResolvedValue(entity);
        vi.spyOn(permissionHelpers, 'checkCanView').mockReturnValue();
        const hookError = new Error('Error in afterGetByField hook');
        vi.spyOn(
            service as unknown as { _afterGetByField: () => void },
            '_afterGetByField'
        ).mockRejectedValue(hookError);
        const result = await service.getBySlug(actor, entity.slug);
        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
        expect(result.data).toBeUndefined();
    });

    it('should return an internal error if model throws', async () => {
        (model.findOne as Mock).mockRejectedValue(new Error('DB error'));
        (model.findOneWithRelations as Mock).mockRejectedValue(new Error('DB error'));
        vi.spyOn(permissionHelpers, 'checkCanView').mockReturnValue();
        const result = await service.getBySlug(actor, entity.slug);
        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
        expect(result.data).toBeUndefined();
    });
});

/**
 * AC:V5:5 / HOS-1641: the public read by slug answers only a PUBLISHED
 * accommodation to another account; every other publication status answers
 * exactly like a missing row. Runs the REAL `checkCanView` (no spy).
 */
describe('AccommodationService.getBySlug — public read by publication status (HOS-1641)', () => {
    let service: AccommodationService;
    let model: ReturnType<typeof createModelMock>;
    // NOT the factory's default user id, which is also the default owner id.
    const stranger = () =>
        createActor({ id: getMockId('user', 'hos-1641-stranger'), permissions: [] });

    beforeEach(() => {
        vi.restoreAllMocks();
        model = createModelMock();
        service = new AccommodationService(
            { logger: mockLogger },
            model as unknown as AccommodationModel,
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

    const arrange = (publicationStatus: PublicationStatusEnum) => {
        const entity = createAccommodationWithMockIds({ deletedAt: undefined, publicationStatus });
        (model.findOne as Mock).mockResolvedValue(entity);
        (model.findOneWithRelations as Mock).mockResolvedValue(entity);
        return entity;
    };

    it('answers a PUBLISHED accommodation to another account', async () => {
        const entity = arrange(PublicationStatusEnum.PUBLISHED);

        const result = await service.getBySlug(stranger(), entity.slug);

        expect(result.error).toBeUndefined();
        expect(result.data?.slug).toBe(entity.slug);
    });

    it.each([
        PublicationStatusEnum.MODERATED,
        PublicationStatusEnum.ARCHIVED,
        PublicationStatusEnum.DRAFT,
        PublicationStatusEnum.UNPUBLISHED_BY_BILLING,
        PublicationStatusEnum.PURGED
    ])('answers NOT_FOUND for a %s accommodation, like a missing row', async (status) => {
        const entity = arrange(status);

        const result = await service.getBySlug(stranger(), entity.slug);

        expect(result.data).toBeUndefined();
        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
    });
});
