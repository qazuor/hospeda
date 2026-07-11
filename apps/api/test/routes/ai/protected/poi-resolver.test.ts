/**
 * Unit tests for the point-of-interest → destination + coordinate resolver
 * (HOS-113 §6.3).
 *
 * Split mirrors the source file:
 * - `combinePoiDestinationConstraint`: pure function, zero mocking — covers
 *   the intersect-or-NO-MATCH design decision directly (owner decision: an
 *   empty intersection is a no-match, NOT a silent substitution), mirroring
 *   `combineAttractionDestinationConstraint`.
 * - `resolvePoiConstraint`: mocks `PointOfInterestService` from
 *   `@repo/service-core` to cover the non-fatal error / no-match / constrain
 *   paths without a real database, mirroring `attraction-resolver.test.ts`'s
 *   mocking pattern.
 *
 * This is the CI-executed unit-level coverage for the POI resolution logic
 * (apps/api runs under the default vitest config); the end-to-end AC-6 case
 * lives in `test/integration/ai/search-chat.poi.test.ts`.
 *
 * @module apps/api/routes/ai/protected/poi-resolver.test
 */

import type { PermissionEnum, RoleEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getBySlugMock, getDestinationIdsByPointOfInterestSlugsMock, mockApiLogger } = vi.hoisted(
    () => ({
        getBySlugMock: vi.fn(),
        getDestinationIdsByPointOfInterestSlugsMock: vi.fn(),
        mockApiLogger: {
            info: vi.fn(),
            warn: vi.fn(),
            debug: vi.fn(),
            error: vi.fn()
        }
    })
);

vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/service-core')>();
    return {
        ...actual,
        PointOfInterestService: class {
            getBySlug = getBySlugMock;
            getDestinationIdsByPointOfInterestSlugs = getDestinationIdsByPointOfInterestSlugsMock;
        }
    };
});

vi.mock('../../../../src/utils/logger', () => ({
    apiLogger: mockApiLogger
}));

import {
    combinePoiDestinationConstraint,
    resolvePoiConstraint
} from '../../../../src/routes/ai/protected/poi-resolver';

const actor = {
    id: 'user-1',
    role: 'USER' as RoleEnum,
    permissions: [] as readonly PermissionEnum[]
};

const AUTODROMO_POI = {
    data: {
        id: 'poi-autodromo',
        slug: 'autodromo_concepcion_del_uruguay',
        lat: -32.423,
        long: -58.2591
    }
};

// ─── combinePoiDestinationConstraint (pure) ──────────────────────────────────

describe('combinePoiDestinationConstraint', () => {
    it('constrains to the POI-matched set when there is no existing constraint', () => {
        const result = combinePoiDestinationConstraint({
            poiDestinationIds: ['dest-1', 'dest-2'],
            currentDestinationIds: undefined
        });
        expect(result).toEqual({ kind: 'constrain', destinationIds: ['dest-1', 'dest-2'] });
    });

    it('constrains to the POI-matched set when the existing constraint is an empty array', () => {
        const result = combinePoiDestinationConstraint({
            poiDestinationIds: ['dest-1'],
            currentDestinationIds: []
        });
        expect(result).toEqual({ kind: 'constrain', destinationIds: ['dest-1'] });
    });

    it('constrains to the intersection when there is overlap', () => {
        const result = combinePoiDestinationConstraint({
            poiDestinationIds: ['concepcion-del-uruguay', 'colon'],
            currentDestinationIds: ['concepcion-del-uruguay']
        });
        expect(result).toEqual({ kind: 'constrain', destinationIds: ['concepcion-del-uruguay'] });
    });

    it('constrains to the intersection of a multi-destination (nearby-expanded) set', () => {
        const result = combinePoiDestinationConstraint({
            poiDestinationIds: ['colon', 'concordia'],
            currentDestinationIds: ['colon', 'federacion', 'concordia']
        });
        expect(result).toEqual({ kind: 'constrain', destinationIds: ['colon', 'concordia'] });
    });

    it('returns NO-MATCH when the intersection is empty (owner decision — no silent substitution)', () => {
        const result = combinePoiDestinationConstraint({
            poiDestinationIds: ['concepcion-del-uruguay'],
            currentDestinationIds: ['federacion']
        });
        expect(result).toEqual({ kind: 'no-match' });
    });
});

// ─── resolvePoiConstraint (thin async wrapper) ───────────────────────────────

describe('resolvePoiConstraint', () => {
    beforeEach(() => {
        getBySlugMock.mockReset();
        getDestinationIdsByPointOfInterestSlugsMock.mockReset();
        mockApiLogger.warn.mockReset();
    });

    it('returns { kind: "none" } without calling the service when poiSlugs is empty', async () => {
        const result = await resolvePoiConstraint({
            actor,
            poiSlugs: [],
            currentDestinationIds: undefined
        });

        expect(result).toEqual({ kind: 'none' });
        expect(getBySlugMock).not.toHaveBeenCalled();
        expect(getDestinationIdsByPointOfInterestSlugsMock).not.toHaveBeenCalled();
    });

    it('constrains to the POI-matched destinationIds + primary lat/long on success (no existing constraint)', async () => {
        getBySlugMock.mockResolvedValue(AUTODROMO_POI);
        getDestinationIdsByPointOfInterestSlugsMock.mockResolvedValue({
            data: { destinationIds: ['concepcion-del-uruguay'] }
        });

        const result = await resolvePoiConstraint({
            actor,
            poiSlugs: ['autodromo_concepcion_del_uruguay'],
            currentDestinationIds: undefined
        });

        expect(result).toEqual({
            kind: 'constrain',
            destinationIds: ['concepcion-del-uruguay'],
            poiSlugs: ['autodromo_concepcion_del_uruguay'],
            lat: -32.423,
            long: -58.2591
        });
        expect(getBySlugMock).toHaveBeenCalledWith(actor, 'autodromo_concepcion_del_uruguay');
        expect(getDestinationIdsByPointOfInterestSlugsMock).toHaveBeenCalledWith(actor, {
            slugs: ['autodromo_concepcion_del_uruguay']
        });
    });

    it('constrains to the intersection when the service resolves destinations that overlap the location', async () => {
        getBySlugMock.mockResolvedValue(AUTODROMO_POI);
        getDestinationIdsByPointOfInterestSlugsMock.mockResolvedValue({
            data: { destinationIds: ['concepcion-del-uruguay', 'colon'] }
        });

        const result = await resolvePoiConstraint({
            actor,
            poiSlugs: ['autodromo_concepcion_del_uruguay'],
            currentDestinationIds: ['concepcion-del-uruguay']
        });

        expect(result).toEqual({
            kind: 'constrain',
            destinationIds: ['concepcion-del-uruguay'],
            poiSlugs: ['autodromo_concepcion_del_uruguay'],
            lat: -32.423,
            long: -58.2591
        });
    });

    it('returns NO-MATCH when the POI destinations do not intersect the requested location', async () => {
        getBySlugMock.mockResolvedValue(AUTODROMO_POI);
        getDestinationIdsByPointOfInterestSlugsMock.mockResolvedValue({
            data: { destinationIds: ['concepcion-del-uruguay'] }
        });

        const result = await resolvePoiConstraint({
            actor,
            poiSlugs: ['autodromo_concepcion_del_uruguay'],
            currentDestinationIds: ['federacion']
        });

        expect(result).toEqual({
            kind: 'no-match',
            poiSlugs: ['autodromo_concepcion_del_uruguay']
        });
    });

    it('returns NO-MATCH when the POI matched no destination at all', async () => {
        getBySlugMock.mockResolvedValue(AUTODROMO_POI);
        getDestinationIdsByPointOfInterestSlugsMock.mockResolvedValue({
            data: { destinationIds: [] }
        });

        const result = await resolvePoiConstraint({
            actor,
            poiSlugs: ['autodromo_concepcion_del_uruguay'],
            currentDestinationIds: undefined
        });

        expect(result).toEqual({
            kind: 'no-match',
            poiSlugs: ['autodromo_concepcion_del_uruguay']
        });
    });

    it('degrades to { kind: "none" } (non-fatal) and logs a warning when the primary POI is not found', async () => {
        getBySlugMock.mockResolvedValue({ error: { code: 'NOT_FOUND', message: 'not found' } });

        const result = await resolvePoiConstraint({
            actor,
            poiSlugs: ['autodromo_concepcion_del_uruguay'],
            currentDestinationIds: undefined
        });

        expect(result).toEqual({ kind: 'none' });
        expect(mockApiLogger.warn).toHaveBeenCalled();
        expect(getDestinationIdsByPointOfInterestSlugsMock).not.toHaveBeenCalled();
    });

    it('degrades to { kind: "none" } (non-fatal) and logs a warning when the destination-lookup service errors', async () => {
        getBySlugMock.mockResolvedValue(AUTODROMO_POI);
        getDestinationIdsByPointOfInterestSlugsMock.mockResolvedValue({
            error: { code: 'INTERNAL_ERROR', message: 'DB unavailable' }
        });

        const result = await resolvePoiConstraint({
            actor,
            poiSlugs: ['autodromo_concepcion_del_uruguay'],
            currentDestinationIds: ['concepcion-del-uruguay']
        });

        expect(result).toEqual({ kind: 'none' });
        expect(mockApiLogger.warn).toHaveBeenCalled();
    });

    it('degrades to { kind: "none" } (non-fatal) and logs a warning when the service throws', async () => {
        getBySlugMock.mockRejectedValue(new Error('boom'));

        const result = await resolvePoiConstraint({
            actor,
            poiSlugs: ['autodromo_concepcion_del_uruguay'],
            currentDestinationIds: undefined
        });

        expect(result).toEqual({ kind: 'none' });
        expect(mockApiLogger.warn).toHaveBeenCalled();
    });
});
