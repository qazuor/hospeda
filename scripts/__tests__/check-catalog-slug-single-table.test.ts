/**
 * Unit tests for the one-slug-one-catalog-table guard (HOS-2059 G-5).
 *
 * These pin the PREDICATE on throwaway trees, plus one run against the real
 * repository, so the guard cannot silently become unable to fail (AC-2: a
 * planted duplicate turns it red).
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    CATALOG_DIRS,
    findCrossTableSlugs,
    REPO_ROOT,
    run
} from '../check-catalog-slug-single-table.js';

const dirs: string[] = [];

afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
    vi.restoreAllMocks();
});

/** Writes a fixture tree with the given amenity and feature slugs. */
function makeTree({
    amenities,
    features
}: {
    readonly amenities: readonly string[];
    readonly features: readonly string[];
}): string {
    const root = mkdtempSync(join(tmpdir(), 'catalog-slug-guard-'));
    dirs.push(root);
    const write = (dir: string, slugs: readonly string[]) => {
        mkdirSync(join(root, dir), { recursive: true });
        slugs.forEach((slug, index) => {
            writeFileSync(
                join(root, dir, `${String(index + 1).padStart(3, '0')}-${slug}.json`),
                JSON.stringify({ slug })
            );
        });
    };
    write(CATALOG_DIRS.amenity, amenities);
    write(CATALOG_DIRS.feature, features);
    return root;
}

describe('check-catalog-slug-single-table', () => {
    it('is green when no slug is shared', () => {
        // Arrange
        vi.spyOn(console, 'log').mockImplementation(() => undefined);
        const root = makeTree({ amenities: ['wifi', 'pool'], features: ['river_view'] });

        // Act + Assert
        expect(run(root)).toBe(0);
    });

    it('is red on a planted duplicate, and names it', () => {
        // Arrange
        const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
        const root = makeTree({
            amenities: ['wifi', 'laundry_service'],
            features: ['river_view', 'laundry_service']
        });

        // Act
        const code = run(root);

        // Assert
        expect(code).toBe(1);
        expect(log.mock.calls.flat().join('\n')).toContain('laundry_service');
    });

    it('is red when a catalog directory is empty (an empty scan proves nothing)', () => {
        // Arrange
        vi.spyOn(console, 'log').mockImplementation(() => undefined);
        const root = makeTree({ amenities: ['wifi'], features: [] });

        // Act + Assert
        expect(run(root)).toBe(1);
    });

    it('lists every shared slug with both files', () => {
        // Arrange
        const amenities = new Map([
            ['b', 'a-b.json'],
            ['a', 'a-a.json'],
            ['only_amenity', 'a-o.json']
        ]);
        const features = new Map([
            ['a', 'f-a.json'],
            ['b', 'f-b.json']
        ]);

        // Act
        const shared = findCrossTableSlugs({ amenities, features });

        // Assert
        expect(shared).toEqual([
            { slug: 'a', amenityFile: 'a-a.json', featureFile: 'f-a.json' },
            { slug: 'b', amenityFile: 'a-b.json', featureFile: 'f-b.json' }
        ]);
    });

    it('is green on the real repository', () => {
        // Arrange
        vi.spyOn(console, 'log').mockImplementation(() => undefined);

        // Act + Assert
        expect(run(REPO_ROOT)).toBe(0);
    });
});
