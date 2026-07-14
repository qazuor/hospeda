import { describe, expect, it } from 'vitest';
import { computeSlugs, extractPoiSegment, toSnakeCase } from '../../scripts/poi-pipeline/dedup.js';
import type { ReconciledRow } from '../../scripts/poi-pipeline/reconcile.js';
import type { RawCsvRow } from '../../scripts/poi-pipeline/types.js';

/** Builds a ReconciledRow from an id + reconciled destination slug. */
function reconciled(id: string, destinationSlug: string): ReconciledRow {
    const row = { id, destinationSlug } as unknown as RawCsvRow;
    return { row, destinationSlug };
}

describe('toSnakeCase', () => {
    it('converts a hyphenated slug to underscores', () => {
        expect(toSnakeCase('plaza-general-francisco-ramirez')).toBe(
            'plaza_general_francisco_ramirez'
        );
    });

    it('lowercases and collapses non-alphanumeric runs, trimming edges', () => {
        expect(toSnakeCase('  Terminal--Omnibus! ')).toBe('terminal_omnibus');
    });

    it('leaves an already snake_case slug unchanged', () => {
        expect(toSnakeCase('museo_del_arroz')).toBe('museo_del_arroz');
    });
});

describe('extractPoiSegment', () => {
    it('returns everything after the first __ separator', () => {
        expect(extractPoiSegment('concepcion-del-uruguay__plaza-general-francisco-ramirez')).toBe(
            'plaza-general-francisco-ramirez'
        );
    });

    it('throws when the id has no separator', () => {
        expect(() => extractPoiSegment('no-separator-here')).toThrow(/no '__'/);
    });
});

describe('computeSlugs', () => {
    it('leaves a non-colliding bare slug bare', () => {
        // Arrange
        const rows = [reconciled('colon__termas_colon', 'colon')];

        // Act
        const result = computeSlugs({ rows });

        // Assert
        expect(result[0]?.slug).toBe('termas_colon');
    });

    it('destination-prefixes a slug claimed by more than one destination', () => {
        // Arrange — municipalidad in two distinct destinations
        const rows = [
            reconciled('colon__municipalidad', 'colon'),
            reconciled('concordia__municipalidad', 'concordia')
        ];

        // Act
        const result = computeSlugs({ rows });

        // Assert
        expect(result.map((r) => r.slug)).toEqual([
            'colon_municipalidad',
            'concordia_municipalidad'
        ]);
    });

    it('snake_cases a multi-word destination slug in the collision prefix', () => {
        // Arrange
        const rows = [
            reconciled('concepcion-del-uruguay__terminal-omnibus', 'concepcion-del-uruguay'),
            reconciled('colon__terminal-omnibus', 'colon')
        ];

        // Act
        const result = computeSlugs({ rows });

        // Assert
        expect(result.map((r) => r.slug)).toEqual([
            'concepcion_del_uruguay_terminal_omnibus',
            'colon_terminal_omnibus'
        ]);
    });

    it('produces a globally unique slug set (no throw) for a mixed batch', () => {
        // Arrange
        const rows = [
            reconciled('colon__municipalidad', 'colon'),
            reconciled('concordia__municipalidad', 'concordia'),
            reconciled('colon__termas_colon', 'colon')
        ];

        // Act
        const slugs = computeSlugs({ rows }).map((r) => r.slug);

        // Assert
        expect(new Set(slugs).size).toBe(slugs.length);
    });

    it('fails loud on a residual duplicate (same slug, same destination)', () => {
        // Arrange — two POIs that snake_case to the same slug in one destination
        const rows = [
            reconciled('colon__plaza-san-martin', 'colon'),
            reconciled('colon__plaza_san_martin', 'colon')
        ];

        // Act & Assert
        expect(() => computeSlugs({ rows })).toThrow(/duplicate slug/i);
    });
});
