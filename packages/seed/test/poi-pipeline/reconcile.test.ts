import { describe, expect, it } from 'vitest';
import {
    loadRealDestinationSlugs,
    reconcileDestinationSlug,
    reconcileRows
} from '../../scripts/poi-pipeline/reconcile.js';
import type { RawCsvRow } from '../../scripts/poi-pipeline/types.js';

/** Builds a RawCsvRow with the two fields reconciliation reads; rest blank. */
function row(id: string, destinationSlug: string): RawCsvRow {
    return {
        id,
        destinationSlug,
        destinationName: '',
        destinationTier: '',
        relation: 'PRIMARY',
        name: '',
        description: '',
        priority: '',
        address: '',
        lat: '',
        lng: '',
        verified: 'False',
        source: '',
        verifiedAt: '',
        notes: '',
        categorySlugs: '',
        categoryNames: '',
        keywords: '',
        nearbyDestinationSlugs: '',
        nearbyDestinationNames: ''
    };
}

describe('loadRealDestinationSlugs (real fixtures)', () => {
    it('includes the real city slugs the two CSV fixups point at', () => {
        // Act
        const slugs = loadRealDestinationSlugs();

        // Assert
        expect(slugs.has('liebig')).toBe(true);
        expect(slugs.has('paranacito')).toBe(true);
        expect(slugs.has('concepcion-del-uruguay')).toBe(true);
    });

    it('does NOT include the raw CSV mismatch slugs', () => {
        // Act
        const slugs = loadRealDestinationSlugs();

        // Assert
        expect(slugs.has('pueblo-liebig')).toBe(false);
        expect(slugs.has('villa-paranacito')).toBe(false);
    });
});

describe('reconcileDestinationSlug', () => {
    const realSlugs = new Set(['liebig', 'paranacito', 'concepcion-del-uruguay', 'colon']);

    it('applies the fixup table (pueblo-liebig -> liebig)', () => {
        expect(reconcileDestinationSlug({ slug: 'pueblo-liebig', realSlugs })).toBe('liebig');
    });

    it('applies the fixup table (villa-paranacito -> paranacito)', () => {
        expect(reconcileDestinationSlug({ slug: 'villa-paranacito', realSlugs })).toBe(
            'paranacito'
        );
    });

    it('passes a slug that already matches a real destination', () => {
        expect(reconcileDestinationSlug({ slug: 'colon', realSlugs })).toBe('colon');
    });

    it('returns null for a slug that resolves to nothing real', () => {
        expect(reconcileDestinationSlug({ slug: 'atlantis', realSlugs })).toBeNull();
    });
});

describe('reconcileRows', () => {
    const realSlugs = new Set(['liebig', 'paranacito', 'concepcion-del-uruguay']);

    it('reconciles every row and carries the reconciled slug', () => {
        // Arrange
        const rows = [
            row('cdu__plaza', 'concepcion-del-uruguay'),
            row('liebig__museo', 'pueblo-liebig'),
            row('paranacito__muelle', 'villa-paranacito')
        ];

        // Act
        const result = reconcileRows({ rows, realSlugs });

        // Assert
        expect(result.map((r) => r.destinationSlug)).toEqual([
            'concepcion-del-uruguay',
            'liebig',
            'paranacito'
        ]);
    });

    it('fails loud listing every unresolvable row, never silently dropping', () => {
        // Arrange
        const rows = [
            row('cdu__plaza', 'concepcion-del-uruguay'),
            row('ghost__x', 'atlantis'),
            row('ghost__y', 'narnia')
        ];

        // Act & Assert
        expect(() => reconcileRows({ rows, realSlugs })).toThrow(/failed for 2 row\(s\)/);
        expect(() => reconcileRows({ rows, realSlugs })).toThrow(
            /ghost__x \(destinationSlug='atlantis'\)/
        );
    });
});
