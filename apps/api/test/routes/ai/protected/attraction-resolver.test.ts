/**
 * Unit tests for the attraction → destination resolver (HOS-111 T-016, G-11).
 *
 * Split mirrors the source file:
 * - `combineAttractionDestinationConstraint`: pure function, zero mocking —
 *   covers the intersect-or-NO-MATCH design decision directly (owner decision:
 *   an empty intersection is a no-match, NOT a silent substitution).
 * - `resolveAttractionConstraint`: mocks `AttractionService` from
 *   `@repo/service-core` to cover the non-fatal error / no-match / constrain
 *   paths without a real database, mirroring the `DestinationService.getNearby`
 *   mocking pattern used by `test/integration/ai/search-chat.test.ts`.
 *
 * This is the CI-executed unit-level coverage for the attraction resolution
 * logic (apps/api runs under the default vitest config); the end-to-end
 * AC-11 case lives in `test/integration/ai/search-chat.test.ts`, which only
 * runs under the e2e config (HOS-118 — known gap, not fixed here).
 *
 * @module apps/api/routes/ai/protected/attraction-resolver.test
 */

import type { PermissionEnum, RoleEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getDestinationIdsByAttractionSlugsMock, mockApiLogger } = vi.hoisted(() => ({
    getDestinationIdsByAttractionSlugsMock: vi.fn(),
    mockApiLogger: {
        info: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
        error: vi.fn()
    }
}));

vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/service-core')>();
    return {
        ...actual,
        AttractionService: class {
            getDestinationIdsByAttractionSlugs = getDestinationIdsByAttractionSlugsMock;
        }
    };
});

vi.mock('../../../../src/utils/logger', () => ({
    apiLogger: mockApiLogger
}));

import {
    combineAttractionDestinationConstraint,
    resolveAttractionConstraint
} from '../../../../src/routes/ai/protected/attraction-resolver';

const actor = {
    id: 'user-1',
    role: 'USER' as RoleEnum,
    permissions: [] as readonly PermissionEnum[]
};

// ─── combineAttractionDestinationConstraint (pure) ───────────────────────────

describe('combineAttractionDestinationConstraint', () => {
    it('constrains to the attraction-matched set when there is no existing constraint', () => {
        const result = combineAttractionDestinationConstraint({
            attractionDestinationIds: ['dest-1', 'dest-2'],
            currentDestinationIds: undefined
        });
        expect(result).toEqual({ kind: 'constrain', destinationIds: ['dest-1', 'dest-2'] });
    });

    it('constrains to the attraction-matched set when the existing constraint is an empty array', () => {
        const result = combineAttractionDestinationConstraint({
            attractionDestinationIds: ['dest-1'],
            currentDestinationIds: []
        });
        expect(result).toEqual({ kind: 'constrain', destinationIds: ['dest-1'] });
    });

    it('constrains to the intersection when there is overlap', () => {
        // "cabaña en Colón con carnavales" — Colón is the existing constraint,
        // and it happens to have a carnaval attraction too.
        const result = combineAttractionDestinationConstraint({
            attractionDestinationIds: ['colon', 'concordia', 'gualeguaychu'],
            currentDestinationIds: ['colon']
        });
        expect(result).toEqual({ kind: 'constrain', destinationIds: ['colon'] });
    });

    it('constrains to the intersection of a multi-destination (nearby-expanded) set', () => {
        const result = combineAttractionDestinationConstraint({
            attractionDestinationIds: ['gualeguaychu', 'gualeguay'],
            currentDestinationIds: ['colon', 'gualeguay', 'san-jose']
        });
        expect(result).toEqual({ kind: 'constrain', destinationIds: ['gualeguay'] });
    });

    it('returns NO-MATCH when the intersection is empty (owner decision — no silent substitution)', () => {
        // "cabaña en Federación con carnavales" — Federación has no carnaval
        // attraction; the two constraints are incompatible → zero results.
        const result = combineAttractionDestinationConstraint({
            attractionDestinationIds: ['gualeguaychu', 'colon'],
            currentDestinationIds: ['federacion']
        });
        expect(result).toEqual({ kind: 'no-match' });
    });
});

// ─── resolveAttractionConstraint (thin async wrapper) ───────────────────────

describe('resolveAttractionConstraint', () => {
    beforeEach(() => {
        getDestinationIdsByAttractionSlugsMock.mockReset();
        mockApiLogger.warn.mockReset();
    });

    it('returns { kind: "none" } without calling the service when attractionSlugs is empty', async () => {
        const result = await resolveAttractionConstraint({
            actor,
            attractionSlugs: [],
            currentDestinationIds: undefined
        });

        expect(result).toEqual({ kind: 'none' });
        expect(getDestinationIdsByAttractionSlugsMock).not.toHaveBeenCalled();
    });

    it('constrains to the attraction-matched destinationIds on success (no existing constraint)', async () => {
        getDestinationIdsByAttractionSlugsMock.mockResolvedValue({
            data: { destinationIds: ['dest-1', 'dest-2'] }
        });

        const result = await resolveAttractionConstraint({
            actor,
            attractionSlugs: ['sede_carnaval', 'corsodromo'],
            currentDestinationIds: undefined
        });

        expect(result).toEqual({ kind: 'constrain', destinationIds: ['dest-1', 'dest-2'] });
        expect(getDestinationIdsByAttractionSlugsMock).toHaveBeenCalledWith(actor, {
            slugs: ['sede_carnaval', 'corsodromo']
        });
    });

    it('constrains to the intersection when the service resolves destinations that overlap the location', async () => {
        getDestinationIdsByAttractionSlugsMock.mockResolvedValue({
            data: { destinationIds: ['colon', 'concordia'] }
        });

        const result = await resolveAttractionConstraint({
            actor,
            attractionSlugs: ['sede_carnaval'],
            currentDestinationIds: ['colon']
        });

        expect(result).toEqual({ kind: 'constrain', destinationIds: ['colon'] });
    });

    it('returns NO-MATCH when the attraction destinations do not intersect the requested location', async () => {
        getDestinationIdsByAttractionSlugsMock.mockResolvedValue({
            data: { destinationIds: ['gualeguaychu', 'gualeguay'] }
        });

        const result = await resolveAttractionConstraint({
            actor,
            attractionSlugs: ['sede_carnaval'],
            currentDestinationIds: ['federacion']
        });

        expect(result).toEqual({ kind: 'no-match', attractionSlugs: ['sede_carnaval'] });
    });

    it('returns NO-MATCH when the attraction matched no destination at all', async () => {
        getDestinationIdsByAttractionSlugsMock.mockResolvedValue({
            data: { destinationIds: [] }
        });

        const result = await resolveAttractionConstraint({
            actor,
            attractionSlugs: ['unknown_slug'],
            currentDestinationIds: undefined
        });

        expect(result).toEqual({ kind: 'no-match', attractionSlugs: ['unknown_slug'] });
    });

    it('degrades to { kind: "none" } (non-fatal) and logs a warning when the service errors', async () => {
        getDestinationIdsByAttractionSlugsMock.mockResolvedValue({
            error: { code: 'INTERNAL_ERROR', message: 'DB unavailable' }
        });

        const result = await resolveAttractionConstraint({
            actor,
            attractionSlugs: ['sede_carnaval'],
            currentDestinationIds: ['colon']
        });

        expect(result).toEqual({ kind: 'none' });
        expect(mockApiLogger.warn).toHaveBeenCalled();
    });

    it('degrades to { kind: "none" } (non-fatal) and logs a warning when the service throws', async () => {
        getDestinationIdsByAttractionSlugsMock.mockRejectedValue(new Error('boom'));

        const result = await resolveAttractionConstraint({
            actor,
            attractionSlugs: ['sede_carnaval'],
            currentDestinationIds: undefined
        });

        expect(result).toEqual({ kind: 'none' });
        expect(mockApiLogger.warn).toHaveBeenCalled();
    });
});
