/**
 * BETA-199 / HOS-317 — static guard over the premium rich-description pair.
 *
 * `AccommodationProtectedSchema` declares `richDescription` +
 * `richDescriptionI18n` so the owner's editor GET can show translation status for
 * that field. But a schema declaration is passive — `stripWithSchema` removes only
 * UNDECLARED keys, so declaring the pair means every route on that schema now
 * emits it unless the route itself drops it. The contract is
 *
 *   ONLY `accommodation/protected/getById` emits the pair, and only after
 *   resolving the OWNING host's entitlements. Every other route responding with
 *   this schema drops it unconditionally.
 *
 * which lives in exactly two places — a comment on the schema, and here. Only one
 * of the two can fail. A route added later, or an existing one refactored to lose
 * its strip, would ship the premium pair to a non-entitled owner with every test
 * still green; that is the same failure mode that let `richDescriptionI18n` bypass
 * the public gate for an entire release (HOS-339, where four separate hand-rolled
 * destructures each had to remember the field).
 *
 * Scope: the WHOLE `apps/api/src/routes` tree, not the accommodation folder. An
 * earlier revision of this guard scanned only
 * `routes/accommodation/protected/` and therefore stated the contract in absolute
 * terms it could not check — which is precisely how the nested-embed leak through
 * `GET /protected/owner-promotions` went unnoticed. (That axis is NOT covered here:
 * a route responding with some OTHER schema that EMBEDS an accommodation is pinned
 * by `packages/schemas/test/entities/accommodation/nested-embed.guard.test.ts`.)
 *
 * This reads the real route files off disk rather than importing them: the point is
 * to catch a file nobody wired into a test, so discovery has to come from the
 * filesystem, not from an import list someone would have to remember to update.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROUTES_DIR = fileURLToPath(new URL('../../src/routes/', import.meta.url));

/** Routes known to respond with `AccommodationProtectedSchema` when written. */
const KNOWN_ROUTES = [
    'accommodation/protected/create.ts',
    'accommodation/protected/createDraft.ts',
    'accommodation/protected/getById.ts',
    'accommodation/protected/list.ts',
    'accommodation/protected/patch.ts',
    'accommodation/protected/publish.ts',
    'accommodation/protected/unpublish.ts',
    'accommodation/protected/update.ts'
] as const;

/** The one route allowed to emit the pair — it runs the owner-entitlement gate. */
const GATED_ROUTE = 'accommodation/protected/getById.ts';

interface RouteFile {
    readonly name: string;
    readonly source: string;
}

/** Every `.ts` file under `src/routes`, recursively. */
function allRouteFiles(dir: string = ROUTES_DIR): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) {
            out.push(...allRouteFiles(full));
        } else if (entry.endsWith('.ts') && !entry.endsWith('.test.ts')) {
            out.push(full);
        }
    }
    return out;
}

/** Source with comments and string literals blanked out. */
function code(source: string): string {
    return source
        .replace(/\/\*[\s\S]*?\*\//g, ' ')
        .replace(/\/\/[^\n]*/g, ' ')
        .replace(/'(?:[^'\\]|\\.)*'/g, "''")
        .replace(/"(?:[^"\\]|\\.)*"/g, '""');
}

/** Every route whose declared `responseSchema` is `AccommodationProtectedSchema`. */
function routesRespondingWithProtectedSchema(): RouteFile[] {
    return allRouteFiles()
        .map((full) => ({
            name: full.slice(ROUTES_DIR.length),
            source: code(readFileSync(full, 'utf8'))
        }))
        .filter(({ source }) => /responseSchema:\s*AccommodationProtectedSchema\b/.test(source));
}

/**
 * Whether the file actually CALLS the strip helper on a returned value.
 *
 * Comments and string literals are already gone from `source`, and the shape is
 * checked rather than the bare identifier: an earlier revision accepted any
 * mention outside an import line, which a `// TODO: reinstate
 * stripRichDescriptionFields` — or the explanatory block every one of these routes
 * carries — would have satisfied while the call itself was gone.
 */
function usesStripHelper(source: string): boolean {
    return (
        /return\s+stripRichDescriptionFields\(/.test(source) ||
        /\.map\(stripRichDescriptionFields\)/.test(source)
    );
}

describe('API routes — rich-description strip guard (BETA-199)', () => {
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

    it('flags any route on this schema that neither strips nor gates', () => {
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
        // entitlements it is presumably trying to emit the pair too — a deliberate
        // decision that should not slip in unnoticed.
        const resolvers = routes
            .filter((route) => route.source.includes('resolveOwnerEntitlementsForOwnerId'))
            .map((route) => route.name);

        expect(resolvers).toEqual([GATED_ROUTE]);
    });

    it('does not accept a mention of the helper in a comment', () => {
        // `usesStripHelper` is the load-bearing half. Pin what it rejects, or the
        // guard quietly degrades to "the identifier appears somewhere".
        expect(usesStripHelper(code('// stripRichDescriptionFields(result.data)'))).toBe(false);
        expect(usesStripHelper(code('/** drops it via stripRichDescriptionFields */'))).toBe(false);
        expect(usesStripHelper(code("const msg = 'stripRichDescriptionFields';"))).toBe(false);
        // And what it accepts — both real call shapes in the tree.
        expect(usesStripHelper('return stripRichDescriptionFields(result.data);')).toBe(true);
        expect(usesStripHelper('items: rows.map(stripRichDescriptionFields),')).toBe(true);
    });
});
