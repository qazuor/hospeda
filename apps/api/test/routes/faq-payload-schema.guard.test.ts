/**
 * @file faq-payload-schema.guard.test.ts
 * @description Static guard: every FAQ mutating route declares the `requestBody`
 * schema that matches what its entity's table can actually store (H-119 / H-59).
 *
 * ## Why a guard and not more route tests
 *
 * The failure mode was not one broken route — it was fourteen routes sharing one
 * schema from `common/`, four of which needed a different one and nobody
 * noticed. Behavioural tests can only cover routes that exist today; the next
 * FAQ route someone adds will copy the nearest neighbour's imports and
 * reintroduce the bug silently, because dropping a key is a `200`.
 *
 * A guard states the invariant once, for every present and future route.
 *
 * ## The invariant, and why it cuts both ways
 *
 * Only `accommodation_faqs` carries `is_visible_on_listing` / `is_usable_by_ai`
 * (verified against the production schema, 2026-08-15). So:
 *
 * - **accommodation** FAQ routes MUST declare the flag-carrying schemas, or the
 *   flags are stripped at the HTTP boundary and the owner's choice is lost while
 *   the API reports success. That was H-119 / H-59.
 * - **destination / gastronomy / experience** FAQ routes MUST NOT declare them.
 *   There is no column to write, so accepting the key would move the silent
 *   discard one layer deeper instead of removing it. The plain schemas are
 *   `.strict()`, so those routes answer `400` and name the key — which is the
 *   whole point: the API stops acknowledging what it cannot process.
 *
 * When HOS-400 adds the columns to the other three entities, THIS guard is what
 * fails and tells the implementer which routes still need switching.
 *
 * ## What this guard does NOT verify
 *
 * - That the service and model actually persist the flags. That is behaviour,
 *   covered by `accommodation-faq-channel-visibility.test.ts`.
 * - Reorder / remove / list FAQ routes: they carry no FAQ text payload.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

/** Absolute path to the API route tree. */
const ROUTES_DIR = join(__dirname, '../../src/routes');

/**
 * The only entity whose FAQ table carries the channel-visibility columns.
 * Adding one here without adding the columns re-creates the original bug.
 */
const ENTITIES_WITH_FLAGS = new Set(['accommodation']);

/**
 * Every FAQ mutating route file present today, as `<entity>/<tier>/<file>`.
 *
 * Pinned deliberately. A discovery walk that silently returns fewer files than
 * exist would let this guard pass while covering nothing — the exact way an
 * `Array.isArray()` assertion against a missing directory always succeeds. If
 * this list drifts from disk the guard fails and demands a human look.
 */
const EXPECTED_ROUTES = [
    'accommodation/admin/addFaq.ts',
    'accommodation/admin/updateFaq.ts',
    'accommodation/protected/addFaq.ts',
    'accommodation/protected/updateFaq.ts',
    'destination/admin/addFaq.ts',
    'destination/admin/updateFaq.ts',
    'experience/admin/addFaq.ts',
    'experience/admin/updateFaq.ts',
    'experience/protected/addFaq.ts',
    'experience/protected/updateFaq.ts',
    'gastronomy/admin/addFaq.ts',
    'gastronomy/admin/updateFaq.ts',
    'gastronomy/protected/addFaq.ts',
    'gastronomy/protected/updateFaq.ts'
] as const;

/** Recursively collect every `.ts` file under a directory. */
function collectTsFiles(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
            out.push(...collectTsFiles(full));
        } else if (entry.name.endsWith('.ts')) {
            out.push(full);
        }
    }
    return out;
}

/** Every FAQ create/update route file, keyed by its `<entity>/<tier>/<file>` path. */
function discoverFaqMutationRoutes(): ReadonlyMap<string, string> {
    const found = new Map<string, string>();
    for (const file of collectTsFiles(ROUTES_DIR)) {
        const name = file.split(sep).at(-1);
        if (name !== 'addFaq.ts' && name !== 'updateFaq.ts') continue;
        found.set(relative(ROUTES_DIR, file).split(sep).join('/'), readFileSync(file, 'utf-8'));
    }
    return found;
}

/**
 * The `requestBody:` schema a route declares.
 *
 * Extracts the STATEMENT rather than searching the whole file: an import line
 * or a comment mentioning a schema name must not be able to satisfy — or
 * violate — this guard. Anchored on `requestBody:` for the same reason.
 */
function requestBodySchemaOf(source: string): string | null {
    return /^\s*requestBody:\s*([A-Za-z0-9_]+)\s*,?\s*$/m.exec(source)?.[1] ?? null;
}

/** The entity segment of a `<entity>/<tier>/<file>` route path. */
function entityOf(routePath: string): string {
    return routePath.split('/')[0] as string;
}

const routes = discoverFaqMutationRoutes();

describe('FAQ route requestBody schemas match their table (H-119 / H-59)', () => {
    it('discovers exactly the FAQ mutating routes that exist on disk', () => {
        // Instrument check. Every assertion below iterates this map, so a walk
        // that found nothing would make the whole guard vacuously green.
        expect([...routes.keys()].sort()).toEqual([...EXPECTED_ROUTES].sort());
    });

    it('every discovered route declares a requestBody schema', () => {
        const withoutBody = [...routes.entries()]
            .filter(([, source]) => requestBodySchemaOf(source) === null)
            .map(([path]) => path);

        expect(withoutBody).toEqual([]);
    });

    it('accommodation FAQ routes declare the flag-carrying schemas', () => {
        const offenders = [...routes.entries()]
            .filter(([path]) => ENTITIES_WITH_FLAGS.has(entityOf(path)))
            .filter(([, source]) => {
                const schema = requestBodySchemaOf(source);
                return schema !== null && !schema.startsWith('FaqWithChannelVisibility');
            })
            .map(([path]) => `${path} → ${requestBodySchemaOf(routes.get(path) as string)}`);

        expect(
            offenders,
            'These routes strip isVisibleOnListing / isUsableByAi from the body and ' +
                'still answer 2xx, so the owner is told a private FAQ was saved while ' +
                'the row is written public. Use FaqWithChannelVisibility{Create,Update}PayloadSchema.'
        ).toEqual([]);
    });

    it('entities without the columns do NOT declare the flag-carrying schemas', () => {
        const offenders = [...routes.entries()]
            .filter(([path]) => !ENTITIES_WITH_FLAGS.has(entityOf(path)))
            .filter(([, source]) =>
                (requestBodySchemaOf(source) ?? '').startsWith('FaqWithChannelVisibility')
            )
            .map(([path]) => path);

        expect(
            offenders,
            'These entities have no is_visible_on_listing / is_usable_by_ai column, so ' +
                'accepting the flags would move the silent discard from the HTTP boundary ' +
                'into the service. Add the columns (HOS-400) before switching the schema, ' +
                'and add the entity to ENTITIES_WITH_FLAGS in the same change.'
        ).toEqual([]);
    });
});
