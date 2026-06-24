/**
 * @fileoverview
 * Tests for SPEC-097 location privacy projection wired into AccommodationService
 * read hooks (_afterGetByField, _afterList, _afterSearch).
 *
 * Verifies that:
 * - Anonymous and unprivileged actors see `approximateLocation` and have
 *   exact location fields stripped from the response.
 * - Owners and actors with `ACCOMMODATION_LOCATION_EXACT_VIEW` see exact
 *   coordinates and full address.
 * - When the salt is missing from env, the service falls back gracefully and
 *   does NOT add `approximateLocation`.
 */
import type { AccommodationModel } from '@repo/db';
import { PermissionEnum } from '@repo/schemas';
import { type Mock, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as permissionHelpers from '../../../src/services/accommodation/accommodation.permissions';
import { AccommodationService } from '../../../src/services/accommodation/accommodation.service';
import { createAccommodationWithMockIds } from '../../factories/accommodationFactory';
import { createActor } from '../../factories/actorFactory';
import {
    createLoggerMock,
    createModelMock,
    makeMediaModelStub
} from '../../utils/modelMockFactory';

const mockLogger = createLoggerMock();
const TEST_SALT = 'test-location-salt-fixed-for-deterministic-tests-32+chars';

const buildEntityWithCoords = () =>
    createAccommodationWithMockIds({
        deletedAt: undefined,
        location: {
            street: 'Av. Belgrano',
            number: '123',
            floor: '2',
            apartment: 'B',
            coordinates: { lat: '-30.7521', long: '-58.0429' }
        }
    });

describe('AccommodationService — SPEC-097 location privacy', () => {
    let service: AccommodationService;
    let model: ReturnType<typeof createModelMock>;
    let originalSalt: string | undefined;

    beforeEach(() => {
        originalSalt = process.env.HOSPEDA_LOCATION_SALT;
        process.env.HOSPEDA_LOCATION_SALT = TEST_SALT;
        model = createModelMock();
        // SPEC-204 T-013: _afterGetByField/_afterList/_afterSearch now call
        // findByAccommodations on the media model. Inject a stub returning an empty
        // Map so the read hooks preserve the entity's original `media` without a DB.
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
        vi.clearAllMocks();
    });

    afterEach(() => {
        if (originalSalt === undefined) {
            // biome-ignore lint/performance/noDelete: process.env requires delete to truly unset (assigning undefined coerces to the string "undefined").
            delete process.env.HOSPEDA_LOCATION_SALT;
        } else {
            process.env.HOSPEDA_LOCATION_SALT = originalSalt;
        }
    });

    describe('_afterGetByField (getBySlug)', () => {
        it('strips exact location and adds approximateLocation for anonymous actors', async () => {
            const entity = buildEntityWithCoords();
            (model.findOne as Mock).mockResolvedValue(entity);
            (model.findOneWithRelations as Mock).mockResolvedValue(entity);
            vi.spyOn(permissionHelpers, 'checkCanView').mockReturnValue();

            const unprivilegedActor = createActor({
                id: '11111111-1111-1111-1111-111111111111',
                permissions: []
            });
            const result = await service.getBySlug(unprivilegedActor, entity.slug);

            expect(result.data).toBeDefined();
            const data = result.data as unknown as {
                location?: Record<string, unknown>;
                approximateLocation?: { lat: number; lng: number; radiusMeters: number };
            };
            expect(data.approximateLocation).toBeDefined();
            expect(data.approximateLocation?.radiusMeters).toBe(150);
            expect(data.location?.coordinates).toBeUndefined();
            expect(data.location?.street).toBeUndefined();
            expect(data.location?.number).toBeUndefined();
            expect(data.location?.floor).toBeUndefined();
            expect(data.location?.apartment).toBeUndefined();
        });

        it('keeps exact location for actors with ACCOMMODATION_LOCATION_EXACT_VIEW', async () => {
            const entity = buildEntityWithCoords();
            (model.findOne as Mock).mockResolvedValue(entity);
            (model.findOneWithRelations as Mock).mockResolvedValue(entity);
            vi.spyOn(permissionHelpers, 'checkCanView').mockReturnValue();

            const adminActor = createActor({
                permissions: [
                    PermissionEnum.ACCOMMODATION_VIEW_ALL,
                    PermissionEnum.ACCOMMODATION_LOCATION_EXACT_VIEW
                ]
            });
            const result = await service.getBySlug(adminActor, entity.slug);

            const data = result.data as unknown as {
                location?: Record<string, unknown>;
                approximateLocation?: { lat: number; lng: number };
            };
            expect(data.location?.coordinates).toEqual({
                lat: '-30.7521',
                long: '-58.0429'
            });
            expect(data.location?.street).toBe('Av. Belgrano');
            expect(data.approximateLocation).toBeDefined();
        });

        it('keeps exact location for the owner of the accommodation', async () => {
            const entity = buildEntityWithCoords();
            (model.findOne as Mock).mockResolvedValue(entity);
            (model.findOneWithRelations as Mock).mockResolvedValue(entity);
            vi.spyOn(permissionHelpers, 'checkCanView').mockReturnValue();

            const ownerActor = createActor({
                id: entity.ownerId,
                permissions: [PermissionEnum.ACCOMMODATION_VIEW_ALL]
            });
            const result = await service.getBySlug(ownerActor, entity.slug);

            const data = result.data as unknown as {
                location?: Record<string, unknown>;
            };
            expect(data.location?.coordinates).toEqual({
                lat: '-30.7521',
                long: '-58.0429'
            });
            expect(data.location?.street).toBe('Av. Belgrano');
        });

        it('skips approximateLocation when salt is missing from env', async () => {
            // biome-ignore lint/performance/noDelete: must truly unset process.env to exercise the missing-salt branch.
            delete process.env.HOSPEDA_LOCATION_SALT;
            const entity = buildEntityWithCoords();
            (model.findOne as Mock).mockResolvedValue(entity);
            (model.findOneWithRelations as Mock).mockResolvedValue(entity);
            vi.spyOn(permissionHelpers, 'checkCanView').mockReturnValue();

            const result = await service.getBySlug(
                createActor({ id: '11111111-1111-1111-1111-111111111111', permissions: [] }),
                entity.slug
            );

            const data = result.data as unknown as {
                approximateLocation?: unknown;
                location?: Record<string, unknown>;
            };
            expect(data.approximateLocation).toBeUndefined();
            expect(data.location?.coordinates).toEqual({
                lat: '-30.7521',
                long: '-58.0429'
            });
        });

        it('produces deterministic approximateLocation across calls with same actor and salt', async () => {
            const entity = buildEntityWithCoords();
            (model.findOne as Mock).mockResolvedValue(entity);
            (model.findOneWithRelations as Mock).mockResolvedValue(entity);
            vi.spyOn(permissionHelpers, 'checkCanView').mockReturnValue();

            const actor = createActor({
                id: '11111111-1111-1111-1111-111111111111',
                permissions: []
            });
            const a = await service.getBySlug(actor, entity.slug);
            const b = await service.getBySlug(actor, entity.slug);

            const aLoc = (
                a.data as unknown as { approximateLocation?: { lat: number; lng: number } }
            )?.approximateLocation;
            const bLoc = (
                b.data as unknown as { approximateLocation?: { lat: number; lng: number } }
            )?.approximateLocation;
            expect(aLoc).toEqual(bLoc);
        });
    });
});
