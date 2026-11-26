/**
 * @file i18n-client-namespaces.guard.test.ts
 * @description Keeps `CLIENT_I18N_NAMESPACES` equal to what browser code can
 * actually name, by recomputing it from the real import graph (HOS-369 W3-2).
 *
 * Why a guard rather than review: the failure mode is silent and
 * production-only. A namespace missing from the shipped asset does not throw —
 * `resolve()` in `src/lib/i18n.ts` renders the call site's inline fallback when
 * it has one, and otherwise **the raw key text**, since `[MISSING: …]` is
 * emitted only under `import.meta.env.DEV`. A wrong list therefore looks
 * correct in dev, in `astro check`, and in every component test, and ships
 * `account.profile.title` to a user.
 *
 * The graph is walked CONSERVATIVELY, because the two error directions are not
 * symmetric: over-including a namespace costs bytes, under-including it corrupts
 * a page. So every `.tsx` under `components/` counts as an island entry point,
 * and an import that cannot be resolved FAILS the test instead of quietly
 * truncating the graph — an unexplored subgraph is exactly how a namespace gets
 * misreported as unreachable.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { trans } from '@repo/i18n';
import { describe, expect, it } from 'vitest';
import {
    CLIENT_I18N_KEY_PREFIXES,
    EXTERNAL_I18N_KEY_PREFIXES,
    pickClientNamespaces
} from '../../src/lib/i18n-client-namespaces';
import {
    ALL_NAMESPACES,
    allIslandEntries,
    buildGraph,
    isCovered,
    prefixesNameableFrom,
    REPO_ROOT,
    TYPE_ONLY_STATEMENT_RE
} from '../helpers/i18n-client-graph';

// The graph walk, the specifier resolver and the literal scan live in
// `test/helpers/i18n-client-graph.ts`, shared with the HOS-2572 critical-prefix
// guard so the two lists are derived by the same rules.

describe('HOS-369 W3-2 — client i18n key prefixes', () => {
    const graph = buildGraph({ entries: allIslandEntries() });
    const nameable = prefixesNameableFrom(graph.modules);
    const declared = [...CLIENT_I18N_KEY_PREFIXES] as string[];

    it('resolves every import in the client graph', () => {
        // An unresolved import truncates the graph, and a truncated graph is how
        // a prefix gets reported unreachable when it is not. Fail loudly.
        expect(graph.unresolved, `unresolved imports:\n${graph.unresolved.join('\n')}`).toEqual([]);
        expect(graph.modules.size).toBeGreaterThan(400);
    });

    it('ships every prefix browser code can name', () => {
        const missing = [...nameable.entries()]
            .filter(([prefix]) => !isCovered(prefix, declared))
            .map(([prefix, files]) => `${prefix}  (named in ${files.join(', ')})`);

        expect(
            missing,
            'These prefixes are reachable from the browser but are NOT covered by ' +
                `CLIENT_I18N_KEY_PREFIXES, so their keys would render as raw key ` +
                `text in production:\n${missing.join('\n')}`
        ).toEqual([]);
    });

    it.each(['es', 'en', 'pt'] as const)('ships localized user menu actions in %s', (locale) => {
        const client = pickClientNamespaces(trans[locale]);

        expect(client['nav.userMenu.preferences']).toEqual(expect.stringMatching(/\S/));
        expect(client['nav.userMenu.signOut']).toEqual(expect.stringMatching(/\S/));
    });

    it.each(['es', 'en', 'pt'] as const)('ships localized tourist plan copy in %s', (locale) => {
        const client = pickClientNamespaces(trans[locale]);

        expect(client['pricing.planStatus.current']).toEqual(expect.stringMatching(/\S/));
        expect(client['billing.entitlement.price_alerts']).toEqual(expect.stringMatching(/\S/));
    });

    it('ships no prefix the browser cannot reach', () => {
        const nameableKeys = [...nameable.keys()];
        const dead = declared.filter(
            (p) =>
                !nameableKeys.some((n) => n === p || n.startsWith(`${p}.`) || p.startsWith(`${n}.`))
        );

        expect(
            dead,
            'These prefixes are declared but no client-reachable module names ' +
                `them — they are download weight for every visitor:\n${dead.join('\n')}`
        ).toEqual([]);
    });

    it('declares only real namespaces', () => {
        const unknown = declared
            .map((p) => (p.includes('.') ? p.slice(0, p.indexOf('.')) : p))
            .filter((ns) => !ALL_NAMESPACES.has(ns));
        expect(unknown, `not present in @repo/i18n/web: ${unknown.join(', ')}`).toEqual([]);
    });

    describe('external prefixes — key paths no scan of apps/web can see', () => {
        // Each EXTERNAL entry exists because a package builds the key. If that
        // code path is ever removed or renamed, the entry becomes dead weight
        // and nobody would notice — so assert the path itself still exists.
        it('common.apiError is still built inside @repo/i18n', () => {
            const src = readFileSync(join(REPO_ROOT, 'packages/i18n/src/api-errors.ts'), 'utf8');
            expect(EXTERNAL_I18N_KEY_PREFIXES).toContain('common.apiError');
            expect(src, 'api-errors.ts no longer builds common.apiError.* keys').toContain(
                'common.apiError.'
            );
        });

        it('validation is still fed from @repo/schemas at runtime', () => {
            const src = readFileSync(
                join(REPO_ROOT, 'apps/web/src/lib/forms/field-errors.ts'),
                'utf8'
            );
            // resolveValidationMessage rewrites zodError.X -> validation.X, so
            // the whole namespace stays reachable from PUBLIC forms.
            expect(src).toContain('resolveValidationMessage');
            expect(declared).toContain('validation');
        });
    });

    describe('the graph skips type-only edges, and ONLY those (HOS-1233)', () => {
        it('skips a whole-statement import type', () => {
            expect(TYPE_ONLY_STATEMENT_RE.test("\nimport type { A } from './a'")).toBe(true);
            expect(TYPE_ONLY_STATEMENT_RE.test("\nimport type A from './a'")).toBe(true);
            expect(TYPE_ONLY_STATEMENT_RE.test("\nexport type { A } from './a'")).toBe(true);
        });

        it('does NOT skip the inline type modifier — that statement still imports a value', () => {
            // The dangerous case. `import { type A, B }` erases A and keeps B,
            // so the edge is real and dropping it would hide every prefix B's
            // module names. Anchoring on `type` as the token right after
            // `import` is what separates the two forms.
            expect(TYPE_ONLY_STATEMENT_RE.test("\nimport { type A, B } from './a'")).toBe(false);
            expect(TYPE_ONLY_STATEMENT_RE.test("\nimport { type A } from './a'")).toBe(false);
        });

        it('does NOT skip an ordinary value import', () => {
            expect(TYPE_ONLY_STATEMENT_RE.test("\nimport { A } from './a'")).toBe(false);
            expect(TYPE_ONLY_STATEMENT_RE.test("\nimport A from './a'")).toBe(false);
        });

        it('does not match a module whose name merely contains "type"', () => {
            // Non-vacuity: the predicate must read the STATEMENT shape, never
            // the presence of the word anywhere in it.
            expect(TYPE_ONLY_STATEMENT_RE.test("\nimport { typeOf } from './types'")).toBe(false);
        });
    });
});
