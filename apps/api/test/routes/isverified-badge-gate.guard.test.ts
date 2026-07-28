/**
 * HOS-341 — static guard over the `isVerified` verification badge.
 *
 * `AccommodationPublicSchema` picks `isVerified`, so `stripWithSchema` does NOT
 * hide it: every route responding with that schema emits whatever the DB row
 * carries unless the route itself runs the OWNER-entitlement gate. The contract
 * checked here is
 *
 *   every route that names `AccommodationPublicSchema` in its own source gates
 *   `isVerified` against the OWNING host's `HAS_VERIFICATION_BADGE` entitlement —
 *   list routes via `filterAccommodationListByOwnerEntitlements`, detail routes
 *   via `filterAccommodationByEntitlements` — and resolves owner entitlements to
 *   feed it.
 *
 * ⚠️ That is NOT "the badge is gated everywhere", and this header must not be read
 * as claiming it. `AccommodationPublicCardSchema` is
 * `AccommodationPublicSchema.omit({ richDescription, richDescriptionI18n })` — it
 * drops the premium pair and KEEPS `isVerified`. It is embedded in
 * `PostPublicSchema.relatedAccommodation`, `OwnerPromotionPublicSchema.accommodation`
 * and `AccommodationReviewPublicSchema.accommodation`, whose owning services
 * eager-load the relation with no column allowlist. Those routes never name
 * `AccommodationPublicSchema`, so this guard cannot see them and a green run says
 * nothing about them. The sibling rich-description guard discloses the same axis
 * and hands it to `packages/schemas/test/entities/accommodation/nested-embed.guard.test.ts`
 * — which today covers the rich pair only, NOT `isVerified`. That gap is real and
 * pre-dates HOS-341; it is tracked as HOS-351. Do not infer coverage from here.
 *
 * HOS-341 IS the failure mode this guard exists for: four listings had the gate,
 * three did not, and nothing was red. Per-route regression suites cannot give the
 * guarantee — they only cover routes somebody remembered to write a suite for, and
 * the eighth route ships the raw badge with the whole suite green. Two of the
 * three offenders sat under shared-cached prefixes whose cache key carries no
 * `Authorization`, so the un-gated badge was replayed to every visitor for the TTL.
 *
 * Discovery is by ANY code reference to `AccommodationPublicSchema`, not by a
 * `responseSchema:` line. That is deliberate: `getTopRatedByDestination.ts` builds
 * its response through an intermediate const
 * (`PaginationResultSchema(AccommodationPublicSchema)`), so a `responseSchema:`
 * pattern silently misses it — the exact class of blind spot the sibling
 * rich-description guard documents in its own header.
 *
 * The cost of that loose pattern is a false positive: a future route importing the
 * schema for a NARROWED projection (`AccommodationPublicSchema.pick({ id, name })`,
 * which carries no `isVerified`) would be reported as an offender. No such route
 * exists today. If one appears, add it to an explicit exemption const here with the
 * reason — do not loosen `usesBadgeGate`, which is the load-bearing half.
 *
 * Modeled on `rich-description-strip.guard.test.ts`, including its `code()`
 * blanking helper and the ordering bug that helper's header records (strings
 * before comments, both line-bounded). This copy additionally blanks template
 * literals, because it matches a bare `identifier(` rather than the sibling's
 * anchored `return `/`.map(` shapes — a backtick log message naming a gate would
 * otherwise satisfy it.
 *
 * This reads the real route files off disk rather than importing them: the point
 * is to catch a file nobody wired into a test, so discovery has to come from the
 * filesystem, not from an import list someone would have to remember to update.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROUTES_DIR = fileURLToPath(new URL('../../src/routes/', import.meta.url));

/** Routes known to respond with `AccommodationPublicSchema` when written. */
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

/**
 * Source with string literals and comments blanked out.
 *
 * Strings go FIRST, and both patterns are line-bounded. Blanking comments first
 * truncates `'https://…'` at the `//`, orphans the opening quote, and lets the
 * string pass swallow everything up to some later quote — which would drop a
 * route out of discovery entirely. See the sibling rich-description guard, where
 * that defect was found and measured.
 */
function code(source: string): string {
    return source
        .replace(/'(?:[^'\\\n]|\\.)*'/g, "''")
        .replace(/"(?:[^"\\\n]|\\.)*"/g, '""')
        .replace(/`(?:[^`\\]|\\.)*`/g, '``')
        .replace(/\/\*[\s\S]*?\*\//g, ' ')
        .replace(/\/\/[^\n]*/g, ' ');
}

/**
 * Every route that references `AccommodationPublicSchema` in code.
 *
 * Comments are already blanked, so the explanatory blocks these routes carry —
 * several name the schema in prose — do not put a file on this list by themselves.
 */
function routesRespondingWithPublicSchema(): RouteFile[] {
    return allRouteFiles()
        .map((full) => ({
            name: full.slice(ROUTES_DIR.length),
            source: code(readFileSync(full, 'utf8'))
        }))
        .filter(({ source }) => /\bAccommodationPublicSchema\b/.test(source));
}

/**
 * Whether the file actually CALLS one of the two entitlement gates.
 *
 * The call shape is checked rather than the bare identifier: a `// TODO: reinstate
 * filterAccommodationListByOwnerEntitlements`, or the named import itself, would
 * satisfy a bare-mention check while the call was gone. Comments and strings are
 * already blanked from `source`; the trailing `(` is what excludes the import.
 */
function usesBadgeGate(source: string): boolean {
    return (
        /\bfilterAccommodationListByOwnerEntitlements\s*\(/.test(source) ||
        /\bfilterAccommodationByEntitlements\s*\(/.test(source)
    );
}

describe('API routes — isVerified badge gate guard (HOS-341)', () => {
    const routes = routesRespondingWithPublicSchema();

    it('finds every known route that responds with AccommodationPublicSchema', () => {
        // Non-vacuity. A guard whose discovery silently returns nothing — wrong
        // directory, renamed schema, changed formatting — passes every assertion
        // below while checking nothing at all.
        const names = routes.map((route) => route.name).sort();
        for (const known of KNOWN_ROUTES) {
            expect(names).toContain(known);
        }
        expect(routes.length).toBeGreaterThanOrEqual(KNOWN_ROUTES.length);
    });

    it('flags any route on this schema that does not gate isVerified', () => {
        const offenders = routes
            .filter((route) => !usesBadgeGate(route.source))
            .map((route) => route.name);

        expect(
            offenders,
            `These routes respond with AccommodationPublicSchema without gating isVerified by the owner's HAS_VERIFICATION_BADGE entitlement: ${offenders.join(', ')}. List routes call filterAccommodationListByOwnerEntitlements with the map from resolveOwnerEntitlementsForOwnerIds; detail routes call filterAccommodationByEntitlements. The gate is keyed on the row's OWNER, never on the reader — a per-viewer check on these shared-cached prefixes is the HOS-288 cache-poisoning bug.`
        ).toEqual([]);
    });

    it('requires every such route to also resolve owner entitlements', () => {
        // The second half of the contract, and the reason it is not redundant:
        // `filterAccommodationByEntitlements`'s third parameter `ownerEntitlements`
        // is OPTIONAL, and called without it the function gates NOTHING — the
        // tombstone at entitlement-filter.ts records a helper deleted for exactly
        // that. A call-shape check alone therefore cannot tell a real detail-route
        // gate from an inert one. Requiring the resolver too closes that: a route
        // that resolves nothing has nothing to pass.
        const unresolved = routes
            .filter((route) => !/\bresolveOwnerEntitlementsForOwnerIds?\s*\(/.test(route.source))
            .map((route) => route.name);

        expect(
            unresolved,
            `These routes call an entitlement gate without resolving the owner's entitlements to feed it: ${unresolved.join(', ')}. filterAccommodationByEntitlements gates nothing when its third argument is omitted.`
        ).toEqual([]);
    });

    it('does not accept a mention of the gate in a comment or an import', () => {
        // `usesBadgeGate` is the load-bearing half. Pin what it rejects, or the
        // guard quietly degrades to "the identifier appears somewhere".
        expect(
            usesBadgeGate(code('// filterAccommodationListByOwnerEntitlements(items, map)'))
        ).toBe(false);
        expect(usesBadgeGate(code('/** gated via filterAccommodationByEntitlements */'))).toBe(
            false
        );
        expect(usesBadgeGate(code("const msg = 'filterAccommodationByEntitlements';"))).toBe(false);
        // Template literals too: this matcher accepts a bare `identifier(`, so a
        // backtick log message naming a gate would satisfy it if `code()` left
        // template literals alone. That is why this copy blanks them.
        expect(
            usesBadgeGate(code('const log = `ran filterAccommodationByEntitlements(ctx, a, e)`;'))
        ).toBe(false);
        expect(
            usesBadgeGate(
                code(
                    'import {\n    filterAccommodationListByOwnerEntitlements,\n    stripRichDescriptionFields\n} from "../../../utils/entitlement-filter";'
                )
            )
        ).toBe(false);
        // And what it accepts — both real call shapes in the tree.
        expect(usesBadgeGate('return filterAccommodationListByOwnerEntitlements(rows, map);')).toBe(
            true
        );
        expect(usesBadgeGate('const f = filterAccommodationByEntitlements(ctx, acc, ents);')).toBe(
            true
        );
    });

    it('discovers the schema through an intermediate const, not just a responseSchema line', () => {
        // `getTopRatedByDestination.ts` never writes `responseSchema:
        // AccommodationPublicSchema` — it builds
        // `PaginationResultSchema(AccommodationPublicSchema)` into a const first. A
        // `responseSchema:`-anchored guard would miss it, which is why discovery is
        // by any code reference. Pin that, so nobody "tightens" the pattern later.
        const topRated = routes.find(
            (route) => route.name === 'accommodation/public/getTopRatedByDestination.ts'
        );
        expect(topRated).toBeDefined();
        expect(/responseSchema:\s*AccommodationPublicSchema\b/.test(topRated?.source ?? '')).toBe(
            false
        );
    });

    it('blanks strings without swallowing the code after them', () => {
        // A URL literal must not truncate at its `//`, orphan the quote, and blank
        // an arbitrary region after it — that would silently drop a route from
        // discovery.
        const sample = [
            "const authUrl = 'https://accounts.google.com/o/oauth2/v2/auth';",
            '    responseSchema: AccommodationPublicSchema,',
            "const scope = 'calendar';"
        ].join('\n');

        const stripped = code(sample);

        expect(/\bAccommodationPublicSchema\b/.test(stripped)).toBe(true);
        expect(stripped).not.toContain('accounts.google.com');
    });

    it('does not lose a route to the blanking pass', () => {
        // End-to-end version of the above against the real tree. Every file naming
        // the schema anywhere must survive `code()` still naming it — today all nine
        // reference it in real code, not only in prose, so the two counts match. A
        // regression in `code()` shows up here as a shrinking route set, which the
        // non-vacuity test above then attributes by name.
        const rawMatches = allRouteFiles().filter((full) =>
            /\bAccommodationPublicSchema\b/.test(readFileSync(full, 'utf8'))
        ).length;

        expect(routes.length).toBe(rawMatches);
    });
});
