/**
 * The three verticals retain their content editing routes after the old
 * subscription gate is removed. Scan the route definitions so a route cannot
 * silently keep a dependency on the retired billing middleware.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROUTES_DIR = join(import.meta.dirname, '../../src/routes');
const VERTICALS = ['accommodation', 'gastronomy', 'experience'] as const;

function mutatingRoutes(vertical: string): Array<{ file: string; source: string }> {
    const base = join(ROUTES_DIR, vertical, 'protected');
    return readdirSync(base)
        .filter((file) => file.endsWith('.ts') && file !== 'index.ts')
        .map((file) => ({ file, source: readFileSync(join(base, file), 'utf8') }))
        .filter(({ source }) => /method:\s*'(?:post|put|patch|delete)'/.test(source));
}

describe('content editing routes survive the billing transition', () => {
    for (const vertical of VERTICALS) {
        const routes = mutatingRoutes(vertical);

        it(`${vertical}: discovers the mutating routes`, () => {
            expect(routes.length).toBeGreaterThan(10);
        });

        it(`${vertical}: no route declares the retired subscription middleware`, () => {
            const offenders = routes
                .filter(({ source }) => /requireLiveSubscription\s*\(/.test(source))
                .map(({ file }) => file);
            expect(offenders).toEqual([]);
        });
    }
});
