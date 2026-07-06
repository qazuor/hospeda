/**
 * @fileoverview
 * Regression test for AccommodationService.compareByIds() (HOS-85).
 *
 * The comparison matrix on `/comparar` rendered an empty "Ubicación" row for
 * every accommodation because `compareByIds()` never populated
 * `cityDestination` on the returned summaries — `location` does not carry a
 * city, only the `destination` relation does (SPEC-095), and `findByIds()`
 * (a flat `SELECT ... WHERE id IN (...)`) does not eager-load relations the
 * way the list/search path's `getDefaultListRelations()` does. This test
 * pins the fix: `compareByIds()` now batch-fetches the linked destinations
 * and projects `cityDestination` onto each summary, mirroring `_afterList`.
 */
import type { AccommodationMediaModel, AccommodationModel } from '@repo/db';
import { PermissionEnum, VisibilityEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccommodationService } from '../../../src/services/accommodation/accommodation.service';
import {
    createMockAccommodation,
    getMockAccommodationId
} from '../../factories/accommodationFactory';
import { createActor } from '../../factories/actorFactory';
import { createMockDestination } from '../../factories/destinationFactory';
import {
    createLoggerMock,
    createModelMock,
    makeMediaModelStub
} from '../../utils/modelMockFactory';

// ── Inline vi.mock declarations ──────────────────────────────────────────────
// These must live at the top level so Vitest hoists them before imports.
// `destinationFindByIdsMock` is created via `vi.hoisted` so both the
// `@repo/db` mock factory (hoisted) and the test bodies (not hoisted) can
// reference the same mock function instance.
const { destinationFindByIdsMock } = vi.hoisted(() => ({
    destinationFindByIdsMock: vi.fn()
}));

vi.mock('../../../src/services/destination/destination.service', () => ({
    // Vitest 4: `new DestinationService(ctx)` forwards straight to
    // mockImplementation via Reflect.construct, so the implementation must
    // itself be constructible — an arrow function throws "is not a
    // constructor". A regular function expression works and still returns
    // an empty stub.
    DestinationService: vi.fn().mockImplementation(function DestinationServiceStub() {
        return {};
    })
}));

vi.mock('../../../src/revalidation/revalidation-init.js', () => ({
    getRevalidationService: vi.fn().mockReturnValue(null)
}));

vi.mock('@repo/db', async (importOriginal) => {
    const original = await importOriginal<typeof import('@repo/db')>();
    return {
        ...original,
        buildSearchCondition: vi.fn(),
        // Vitest 4: `new DestinationModel()` requires a constructible
        // implementation (see the DestinationService mock above for why).
        DestinationModel: vi.fn().mockImplementation(function DestinationModelStub() {
            return {
                findById: vi.fn(),
                findByIds: destinationFindByIdsMock
            };
        })
    };
});

const mockLogger = createLoggerMock();

const ACC_ID_1 = getMockAccommodationId('11111111-1111-4111-8111-111111111111');
const ACC_ID_2 = getMockAccommodationId('22222222-2222-4222-8222-222222222222');
const DESTINATION_ID = '33333333-3333-4333-8333-333333333333';

describe('AccommodationService.compareByIds() (HOS-85)', () => {
    let service: AccommodationService;
    let model: ReturnType<typeof createModelMock>;
    let findByIdsMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        vi.clearAllMocks();
        destinationFindByIdsMock.mockReset();
        model = createModelMock();
        findByIdsMock = vi.fn();
        model.findByIds = findByIdsMock;
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
            makeMediaModelStub() as unknown as AccommodationMediaModel
        );
    });

    it('populates cityDestination on every returned summary', async () => {
        const accommodations = [
            createMockAccommodation({
                id: ACC_ID_1,
                destinationId: DESTINATION_ID,
                visibility: VisibilityEnum.PUBLIC
            }),
            createMockAccommodation({
                id: ACC_ID_2,
                destinationId: DESTINATION_ID,
                visibility: VisibilityEnum.PUBLIC
            })
        ];
        findByIdsMock.mockResolvedValue(accommodations);

        const destination = createMockDestination({
            id: DESTINATION_ID,
            name: 'Concepción del Uruguay',
            slug: 'concepcion-del-uruguay'
        });
        destinationFindByIdsMock.mockResolvedValue([destination]);

        const result = await service.compareByIds(createActor(), {
            ids: [ACC_ID_1, ACC_ID_2]
        });

        expect(result.error).toBeUndefined();
        expect(result.data?.items).toHaveLength(2);
        for (const item of result.data?.items ?? []) {
            expect(item.cityDestination).toEqual(
                expect.objectContaining({
                    id: DESTINATION_ID,
                    name: 'Concepción del Uruguay',
                    slug: 'concepcion-del-uruguay'
                })
            );
        }

        // Batch-read: exactly one call to the destination model, with the
        // deduplicated set of destination IDs — never one call per row.
        expect(destinationFindByIdsMock).toHaveBeenCalledTimes(1);
        expect(destinationFindByIdsMock.mock.calls[0]?.[0]).toEqual([DESTINATION_ID]);
    });

    it('omits cityDestination when the destination cannot be found', async () => {
        const accommodation = createMockAccommodation({
            id: ACC_ID_1,
            destinationId: DESTINATION_ID,
            visibility: VisibilityEnum.PUBLIC
        });
        const otherAccommodation = createMockAccommodation({
            id: ACC_ID_2,
            destinationId: DESTINATION_ID,
            visibility: VisibilityEnum.PUBLIC
        });
        findByIdsMock.mockResolvedValue([accommodation, otherAccommodation]);
        destinationFindByIdsMock.mockResolvedValue([]); // destination row missing/deleted

        const result = await service.compareByIds(createActor(), {
            ids: [ACC_ID_1, ACC_ID_2]
        });

        expect(result.error).toBeUndefined();
        for (const item of result.data?.items ?? []) {
            expect(item.cityDestination).toBeUndefined();
        }
    });

    it('does not call the destination model when no ids are viewable', async () => {
        findByIdsMock.mockResolvedValue([]);

        const result = await service.compareByIds(
            createActor({ permissions: [PermissionEnum.ACCOMMODATION_VIEW_ALL] }),
            { ids: [ACC_ID_1, ACC_ID_2] }
        );

        expect(result.error).toBeUndefined();
        expect(result.data?.items).toEqual([]);
        expect(destinationFindByIdsMock).not.toHaveBeenCalled();
    });
});
