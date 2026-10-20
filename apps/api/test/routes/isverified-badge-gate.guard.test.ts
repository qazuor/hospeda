/**
 * Every public route applies owner-scoped grants before returning paid fields,
 * including the verification badge.
 *
 * This scans route definitions so a newly added endpoint cannot accidentally
 * return the database value through AccommodationPublicSchema.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROUTES_DIR = fileURLToPath(new URL('../../src/routes/', import.meta.url));
const KNOWN_ROUTES = [
    'accommodation/public/getByDestination.ts',
    'accommodation/public/getById.ts',
    'accommodation/public/getBySlug.ts',
    'accommodation/public/getTopRatedByDestination.ts',
    'accommodation/public/list.ts',
    'accommodation/public/similar.ts',
    'destination/public/getAccommodations.ts',
    'feature/public/getAccommodationsByFeature.ts',
    'user/public/getAccommodations.ts'
] as const;

function allRouteFiles(dir: string = ROUTES_DIR): string[] {
    return readdirSync(dir).flatMap((entry) => {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) return allRouteFiles(full);
        return entry.endsWith('.ts') && !entry.endsWith('.test.ts') ? [full] : [];
    });
}

function executableSource(source: string): string {
    return source
        .replace(/'(?:[^'\\\n]|\\.)*'/g, "''")
        .replace(/"(?:[^"\\\n]|\\.)*"/g, '""')
        .replace(/`(?:[^`\\]|\\.)*`/g, '``')
        .replace(/\/\*[\s\S]*?\*\//g, ' ')
        .replace(/\/\/[^\n]*/g, ' ');
}

function guardedRoutes(): Array<{ name: string; source: string }> {
    return allRouteFiles()
        .map((full) => ({
            name: full.slice(ROUTES_DIR.length),
            source: executableSource(readFileSync(full, 'utf8'))
        }))
        .filter(({ source }) => /\bAccommodationPublicSchema\b/.test(source));
}

function appliesOwnerGrantFilter(source: string): boolean {
    return (
        /\bfilterPublicPaidFieldsForOwner\s*\(/.test(source) ||
        (/\bresolvePublicFieldGrants\s*\(/.test(source) &&
            /\bfilterPublicPaidFields\s*\(/.test(source))
    );
}

describe('public accommodation badge masking', () => {
    const routes = guardedRoutes();

    it('discovers every known route that returns AccommodationPublicSchema', () => {
        const names = routes.map(({ name }) => name);
        for (const known of KNOWN_ROUTES) expect(names).toContain(known);
    });

    it('filters paid public fields using grants resolved for each owner', () => {
        const offenders = routes
            .filter(({ source }) => !appliesOwnerGrantFilter(source))
            .map(({ name }) => name);
        expect(offenders).toEqual([]);
    });

    it('requires executable owner-grant filtering, not comments, strings or imports', () => {
        expect(
            appliesOwnerGrantFilter(
                executableSource('// filterPublicPaidFieldsForOwner(row, grants)')
            )
        ).toBe(false);
        expect(
            appliesOwnerGrantFilter(
                executableSource("const text = 'filterPublicPaidFieldsForOwner(row, grants)';")
            )
        ).toBe(false);
        expect(
            appliesOwnerGrantFilter(executableSource('filterPublicPaidFieldsForOwner(row, grants)'))
        ).toBe(true);
        expect(
            appliesOwnerGrantFilter(
                executableSource(
                    'resolvePublicFieldGrants(ids); filterPublicPaidFields(row, grants)'
                )
            )
        ).toBe(true);
    });
});
