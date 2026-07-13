import { describe, expect, it } from 'vitest';
import type { SluggedRow } from '../../scripts/poi-pipeline/dedup.js';
import { buildRelations } from '../../scripts/poi-pipeline/relations.js';
import type { RawCsvRow } from '../../scripts/poi-pipeline/types.js';

function slugged(slug: string, destinationSlug: string, nearbyDestinationSlugs = ''): SluggedRow {
    const row = { nearbyDestinationSlugs } as unknown as RawCsvRow;
    return { row, destinationSlug, slug };
}

const realSlugs = new Set(['colon', 'concepcion-del-uruguay', 'liebig', 'paranacito']);

describe('buildRelations', () => {
    it('emits one PRIMARY relation per POI', () => {
        // Arrange
        const rows = [slugged('a', 'colon'), slugged('b', 'concepcion-del-uruguay')];

        // Act
        const { relations } = buildRelations({ rows, realSlugs });

        // Assert
        expect(relations).toEqual([
            { destinationSlug: 'colon', poiSlug: 'a', relation: 'PRIMARY' },
            { destinationSlug: 'concepcion-del-uruguay', poiSlug: 'b', relation: 'PRIMARY' }
        ]);
    });

    it('derives NEARBY relations from nearbyDestinationSlugs, reconciled through fixups', () => {
        // Arrange — pueblo-liebig fixes up to liebig
        const rows = [slugged('a', 'colon', 'concepcion-del-uruguay; pueblo-liebig')];

        // Act
        const { relations } = buildRelations({ rows, realSlugs });

        // Assert
        expect(relations).toContainEqual({
            destinationSlug: 'concepcion-del-uruguay',
            poiSlug: 'a',
            relation: 'NEARBY'
        });
        expect(relations).toContainEqual({
            destinationSlug: 'liebig',
            poiSlug: 'a',
            relation: 'NEARBY'
        });
    });

    it('never emits a NEARBY that duplicates the POI PRIMARY destination', () => {
        // Arrange — nearby includes the POI's own destination
        const rows = [slugged('a', 'colon', 'colon; liebig')];

        // Act
        const { relations } = buildRelations({ rows, realSlugs });

        // Assert — colon only appears once (as PRIMARY)
        const colonRels = relations.filter((r) => r.destinationSlug === 'colon');
        expect(colonRels).toEqual([
            { destinationSlug: 'colon', poiSlug: 'a', relation: 'PRIMARY' }
        ]);
    });

    it('collects unresolved nearby references instead of aborting', () => {
        // Arrange
        const rows = [slugged('a', 'colon', 'atlantis; liebig')];

        // Act
        const { relations, unresolvedNearby } = buildRelations({ rows, realSlugs });

        // Assert
        expect(unresolvedNearby).toEqual(["a -> 'atlantis'"]);
        expect(relations).toContainEqual({
            destinationSlug: 'liebig',
            poiSlug: 'a',
            relation: 'NEARBY'
        });
    });
});
