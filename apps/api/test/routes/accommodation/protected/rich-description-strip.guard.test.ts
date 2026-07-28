/**
 * BETA-199 / HOS-317 — static guard over the premium rich-description pair.
 *
 * `AccommodationProtectedSchema` declares `richDescription` +
 * `richDescriptionI18n` so the owner's editor GET can show translation status for
 * that field. But that schema is the `responseSchema` of EIGHT protected routes,
 * and a schema declaration is passive: it enforces nothing. The contract is
 *
 *   ONLY `getById` emits the pair, and only after resolving the OWNING host's
 *   entitlements. Every other route on this schema drops it unconditionally.
 *
 * which lives in exactly two places — a comment on the schema, and here. Only one
 * of the two can fail. A route added later, or an existing one refactored to lose
 * its strip, would ship the premium pair to a non-entitled owner with every test
 * still green; that is the same failure mode that let `richDescriptionI18n` bypass
 * the public gate for an entire release (HOS-339, where four separate hand-rolled
 * destructures each had to remember the field).
 *
 * This guard reads the real route files off disk rather than importing them: the
 * point is to catch a file nobody wired into a test, so discovery has to come from
 * the filesystem, not from an import list someone would have to remember to update.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROUTES_DIR = fileURLToPath(
    new URL('../../../../src/routes/accommodation/protected/', import.meta.url)
);

/** Routes known to respond with `AccommodationProtectedSchema` when written. */
const KNOWN_ROUTES = [
    'create.ts',
    'createDraft.ts',
    'getById.ts',
    'list.ts',
    'patch.ts',
    'publish.ts',
    'unpublish.ts',
    'update.ts'
] as const;

/** The one route allowed to emit the pair — it runs the owner-entitlement gate. */
const GATED_ROUTE = 'getById.ts';

interface RouteFile {
    readonly name: string;
    readonly source: string;
}

/**
 * Every `.ts` file under the protected-accommodation route directory whose
 * declared `responseSchema` is `AccommodationProtectedSchema`.
 */
function routesRespondingWithProtectedSchema(): RouteFile[] {
    return readdirSync(ROUTES_DIR)
        .filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts'))
        .map((name) => ({ name, source: readFileSync(join(ROUTES_DIR, name), 'utf8') }))
        .filter(({ source }) => /responseSchema:\s*AccommodationProtectedSchema/.test(source));
}

/**
 * Whether the file actually USES the strip helper, as opposed to merely naming it
 * in a comment or an unused import. Import lines are dropped before the check, so
 * an import with no call site does not satisfy the guard.
 */
function usesStripHelper(source: string): boolean {
    const withoutImports = source
        .split('\n')
        .filter((line) => !line.trimStart().startsWith('import '))
        .join('\n');
    return withoutImports.includes('stripRichDescriptionFields');
}

describe('protected accommodation routes — rich-description strip guard (BETA-199)', () => {
    const routes = routesRespondingWithProtectedSchema();

    it('finds every known route that responds with AccommodationProtectedSchema', () => {
        // Non-vacuity. A guard whose discovery silently returns nothing — wrong
        // directory, renamed schema, changed formatting — passes every assertion
        // below while checking nothing at all.
        const names = routes.map((route) => route.name).sort();
        for (const known of KNOWN_ROUTES) {
            expect(names).toContain(known);
        }
        expect(routes.length).toBeGreaterThanOrEqual(KNOWN_ROUTES.length);
    });

    it.each(
        KNOWN_ROUTES.filter((name) => name !== GATED_ROUTE)
    )('%s drops the rich-description pair unconditionally', (name) => {
        const route = routes.find((candidate) => candidate.name === name);
        expect(route, `${name} no longer responds with AccommodationProtectedSchema`).toBeDefined();
        expect(
            usesStripHelper((route as RouteFile).source),
            `${name} responds with AccommodationProtectedSchema but never calls stripRichDescriptionFields — it would ship the premium rich-description pair ungated. Either strip it, or gate it on the OWNER's entitlements the way getById.ts does.`
        ).toBe(true);
    });

    it('flags any NEW route on this schema that neither strips nor gates', () => {
        // The clause the `it.each` above cannot cover: a route file that does not
        // exist yet. Same rule, applied to whatever discovery actually found.
        const offenders = routes
            .filter((route) => route.name !== GATED_ROUTE)
            .filter((route) => !usesStripHelper(route.source))
            .map((route) => route.name);

        expect(
            offenders,
            `These routes respond with AccommodationProtectedSchema without stripping the premium rich-description pair: ${offenders.join(', ')}. Read the BETA-199 block on AccommodationProtectedSchema before adding one.`
        ).toEqual([]);
    });

    it('keeps getById as the only route that resolves owner entitlements', () => {
        // The other half of the contract. If a second route starts resolving owner
        // entitlements it is presumably trying to emit the pair too — which is a
        // deliberate decision that should not slip in unnoticed.
        const resolvers = routes
            .filter((route) => route.source.includes('resolveOwnerEntitlementsForOwnerId'))
            .map((route) => route.name);

        expect(resolvers).toEqual([GATED_ROUTE]);
    });
});
