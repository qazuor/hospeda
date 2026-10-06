/**
 * HOS-341: every public accommodation route keeps the verification badge hidden
 * while the replacement coverage contract is being built.
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

function callsPublicMask(source: string): boolean {
    return (
        /\bmaskLegacyPremiumFields\s*\(/.test(source) ||
        /\.map\s*\(\s*maskLegacyPremiumFields\s*\)/.test(source)
    );
}

describe('public accommodation badge masking', () => {
    const routes = guardedRoutes();

    it('discovers every known route that returns AccommodationPublicSchema', () => {
        const names = routes.map(({ name }) => name);
        for (const known of KNOWN_ROUTES) expect(names).toContain(known);
    });

    it('applies the transitory mask in every route', () => {
        const offenders = routes
            .filter(({ source }) => !callsPublicMask(source))
            .map(({ name }) => name);
        expect(offenders).toEqual([]);
    });

    it('requires a call, not a comment, string or import', () => {
        expect(callsPublicMask(executableSource('// maskLegacyPremiumFields(row)'))).toBe(false);
        expect(
            callsPublicMask(executableSource("const text = 'maskLegacyPremiumFields(row)';"))
        ).toBe(false);
        expect(callsPublicMask(executableSource('maskLegacyPremiumFields(row)'))).toBe(true);
        expect(callsPublicMask(executableSource('rows.map(maskLegacyPremiumFields)'))).toBe(true);
    });
});
