/**
 * @file billing-barrel-client-isolation.test.ts
 * @description Static guard (HOS-360) enforcing the convention written down
 * across `apps/web`: **client components in this app deliberately do not import
 * `@repo/billing`**.
 *
 * `AnalyticsSection.client.tsx` and `PromotionList.client.tsx` hardcode their
 * entitlement wire strings as literals rather than import the enum, and
 * `hooks/useCompareGuard.ts` — a hook reachable from islands — does the same
 * ("Keys (must match @repo/billing EntitlementKey / LimitKey string values)").
 * `components/billing/TestDailyPlanButton.client.tsx` hardcodes a plan SLUG for
 * the same reason, and `CreatePropertyMiniForm.client.tsx` avoids the coupling
 * differently, by taking `trialDays: number` as a prop from its `.astro` parent.
 *
 * ## Why the convention exists
 *
 * `@repo/billing`'s barrel (`export * from './adapters/index.js'`,
 * `'./validation/index.js'`, and five more) has a runtime closure of 26 modules,
 * two of which import `@repo/logger`: `adapters/mercadopago.ts` and
 * `validation/config-validator.ts` (measured 2026-07-29). The logger reads
 * `process.env[key]` at MODULE SCOPE — `packages/logger/src/categories.ts` calls
 * `registerDefaultCategory()` at the top level — and there is no `process` in a
 * browser. Importing the barrel from an island therefore throws
 * `ReferenceError: process is not defined` during hydration and the island never
 * mounts. It also drags the MercadoPago adapter and the `@repo/config` env
 * registry into the client module graph.
 *
 * ## Why this guard is preventive, not corrective
 *
 * The motivating incident is real history: `MobileMenu.client.tsx` imported
 * `EntitlementKey` from the barrel for an entitlement-gated host CTA, and that
 * import broke the island in dev. It is NOT in the tree any more — PR #2541
 * (HOS-311) reverted the gated CTA and removed the import as collateral, which
 * means the invariant is currently restored by accident rather than by any
 * rule. This guard exists so the same class of import cannot come back
 * silently. It is expected to be green from the day it lands; the mutation
 * suite at the bottom is what proves it can still go red.
 *
 * ## What the production build was measured to contain (2026-07-29)
 *
 * The production build does NOT tree-shake the barrel away. Measured on the
 * then-live chunk `_astro/MobileMenu.client.BFcCCpWR.js`, BEFORE HOS-311's
 * revert:
 *
 * - The chunk contained `@repo/logger`'s category machinery, the
 *   `billing:mercadopago` category, the `EntitlementKey` values
 *   (`publish_accommodations`, …) and the full `@repo/config` env-registry
 *   prose — `HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN`, its `howToObtain` text, the
 *   Redis/BullMQ/cron entries. That part is verified and is the point.
 * - Neither `packages/logger/package.json` nor `packages/billing/package.json`
 *   declares `"sideEffects": false`, so none of it is eligible for shaking.
 *
 * **What is NOT known**: the barrel's own byte share. The chunk measured
 * 262,552 bytes raw / 71,579 gzip, but that is the WHOLE chunk — MobileMenu
 * itself, `MobileMenuAccountSection`, `LanguageSwitcher`, `ThemeControl`,
 * `IconButton`, `@repo/icons`, the i18n/`createTranslations` graph,
 * `nav-avatar`, `config/navigation`, `nav-gating`, `dialog-history`,
 * `auth-client` and `admin-panel-link` all ride in it. No build without the
 * barrel was ever produced, so the delta was never isolated, and the 2,276-gzip
 * sibling `UserMenu.client.*.js` is a different component with a different
 * dependency set, not a control. Do not quote a KB figure for "what the barrel
 * costs" — quote the contents instead.
 *
 * What actually differs between dev and prod is the env READ, not the module
 * graph. Vite's build `define`-replaces `process.env` with `{}`, so the four
 * readers in `packages/logger/src/environment.ts` emit `{}[key]` — verified
 * verbatim in the chunk as `function E(e){let t={}[e];return t===void 0?null:…}`,
 * with 0 occurrences of `process` followed by `.env` and exactly 4 of the `{}[`
 * shim, one per reader. `undefined` flows through the `=== undefined` branch
 * and the readers return `null` instead of throwing. Dev serves the aliased
 * `packages/logger/src` untransformed, so `process.env[key]` really executes
 * and really throws. That asymmetry is the whole of it: the barrel ships to
 * production either way.
 *
 * So the guard is not only about a dev-only crash. Keeping the barrel out also
 * stops shipping internal env-registry documentation to public browsers. A
 * per-component test cannot assert that: the invariant is what needs asserting,
 * not the current call sites.
 *
 * ## Scope — what this guard DOES and DOES NOT see
 *
 * DOES: every client entrypoint — the `*.client.tsx` filename sweep UNIONed
 * with every component carrying a `client:*` directive in an `.astro` file —
 * **and the full transitive closure of its relative / `@/`-aliased imports**.
 * Anchoring only on the entrypoints would leave the obvious hole of an island
 * importing a `lib/` helper that imports the barrel.
 *
 * The invariant: **no module reachable from a client entrypoint imports
 * `@repo/billing` at runtime**. Modules that DO import it are fine as long as
 * they stay unreachable. Measured on this tree (2026-07-29) there are 12 such
 * production modules under `apps/web/src` — five `.ts`
 * (`lib/price-alert-gate.ts`, `components/billing/plan-comparison-rows.ts`,
 * `lib/billing-i18n.ts`, `lib/owner-faq.ts`, `lib/host/usage-badge.ts`) and
 * seven `.astro` frontmatters (`layouts/Header.astro`,
 * `components/host/PropertyCard.astro`, `pages/[lang]/funcionalidades/index.astro`,
 * `pages/[lang]/preguntas-frecuentes/index.astro`,
 * `pages/[lang]/publicar/index.astro`, `pages/[lang]/publicar/nueva.astro`,
 * `pages/[lang]/suscriptores/planes/comparar/index.astro`) — all SSR-only, the
 * `.astro` ones by construction. Three colocated `src/lib/__tests__` suites
 * import it too and are likewise unreachable. The count is informational; the
 * assertion is reachability, so this list going stale does not weaken anything.
 *
 * DOES NOT:
 *
 * - **Bare-specifier hops** (an island importing `@repo/foo` which itself
 *   imports `@repo/billing`). Resolving those means walking `node_modules`.
 *   The live risk is real but currently unarmed: `@repo/service-core` DOES
 *   import `@repo/billing` at runtime and IS aliased to its `src` in
 *   `astro.config.mjs`, so an island importing it would inline the barrel —
 *   nothing under `apps/web/src` imports `@repo/service-core` today.
 * - **`FeedbackForm` from `@repo/feedback`**, the one island hydrated from a
 *   bare specifier (`pages/[lang]/feedback/index.astro`) — same hole as above.
 * - **Inline `<script>` blocks in `.astro` files**, a separate client graph.
 * - **Dynamic imports with a non-literal specifier** (`import(someVar)`).
 * - **Trailing / mid-line comments**: `stripComments` only blanks whole-line
 *   comments, so a `@repo/billing` import mentioned in a trailing comment would
 *   be reported. That is a false POSITIVE — loud, not silent.
 * - **A line-initial `/*` inside a template literal that the backtick-parity
 *   heuristic mis-tracks.** `stripComments` refuses to treat anything as a
 *   comment while its per-line backtick count says a template is open, but that
 *   count is line-local and can be thrown off by a stray backtick inside a
 *   quoted string. If it under-detects AND the resulting block comment happens
 *   to find a later `*\/`, lines in between are blanked silently. The
 *   unterminated-block throw and the corpus edge-set test below are the
 *   backstops; a mid-file `*\/` is not covered by either.
 * - **Side-effect imports not at the start of a line** (`;import './x';`), now
 *   that the side-effect pattern is line-anchored. The trade was deliberate —
 *   see `SIDE_EFFECT_PREFIX` in the detector.
 *
 * `import type` is intentionally allowed, both at the leaf and along the EDGES:
 * type-only statements are erased before the module reaches the browser.
 * `lib/billing/fetch-plans.ts` relies on this — three islands
 * (`PlanChangeFlow.client.tsx`, `PlanPicker.client.tsx`,
 * `SubscriptionDashboard.client.tsx`) import a type from it, while its `.astro`
 * consumers call it at runtime. Following that erased edge would judge an
 * SSR-only module by a client-side rule.
 *
 * @module test/static-guards/billing-barrel-client-isolation
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
    blankBlockCommentRegions,
    blankMarkupComments,
    clearStrippedCache,
    collectEntrypoints,
    collectFiles,
    countImportStatements,
    extractImportEdges,
    FORBIDDEN_PACKAGE,
    findOffenders,
    hasRuntimeBillingImport,
    scanAstroHydration,
    stripComments,
    WEB_SRC
} from './billing-import-detector';

const MOBILE_MENU = 'components/shared/navigation/MobileMenu.client.tsx';
const NAV_AVATAR = 'lib/nav-avatar.ts';
const abs = (relative: string) => path.join(WEB_SRC, relative);

/** Counts how many times each specifier appears in `source`'s import edges. */
const specifierCounts = (source: string): Map<string, number> => {
    const counts = new Map<string, number>();
    for (const { specifier } of extractImportEdges(source)) {
        counts.set(specifier, (counts.get(specifier) ?? 0) + 1);
    }
    return counts;
};

describe('HOS-360 guard internals — the detector itself', () => {
    // Without these, a bug in stripComments() or in the import regexes would
    // make the corpus scan below pass over a real violation and report nothing.
    // The corpus can only tell us "no offenders found"; these tell us the
    // finder works at all, in BOTH directions.
    const runtimeForms = [
        `import { EntitlementKey } from '${FORBIDDEN_PACKAGE}';`,
        `import { EntitlementKey, type LimitKey } from '${FORBIDDEN_PACKAGE}';`,
        `import EK, { type LimitKey } from '${FORBIDDEN_PACKAGE}';`,
        `import ALL from '${FORBIDDEN_PACKAGE}';`,
        `import * as billing from '${FORBIDDEN_PACKAGE}';`,
        `import '${FORBIDDEN_PACKAGE}';`,
        `import { EntitlementKey } from "${FORBIDDEN_PACKAGE}";`,
        `import{EntitlementKey}from'${FORBIDDEN_PACKAGE}';`,
        `import {} from '${FORBIDDEN_PACKAGE}';`,
        `export { EntitlementKey } from '${FORBIDDEN_PACKAGE}';`,
        `export * from '${FORBIDDEN_PACKAGE}';`,
        `export * as billing from '${FORBIDDEN_PACKAGE}';`,
        `const mod = await import('${FORBIDDEN_PACKAGE}');`,
        `void import("${FORBIDDEN_PACKAGE}");`,
        `import { OWNER_TRIAL_DAYS } from '${FORBIDDEN_PACKAGE}/plans';`
    ];

    const erasedForms = [
        `import type { PlanCategory } from '${FORBIDDEN_PACKAGE}';`,
        `import { type PlanCategory, type LimitKey } from '${FORBIDDEN_PACKAGE}';`,
        `import type EntitlementKeys from '${FORBIDDEN_PACKAGE}';`,
        `export type { PlanCategory } from '${FORBIDDEN_PACKAGE}';`
    ];

    for (const form of runtimeForms) {
        it(`flags a runtime import: ${form}`, () => {
            expect(hasRuntimeBillingImport(stripComments(form))).toBe(true);
        });
    }

    for (const form of erasedForms) {
        it(`allows a type-only import: ${form}`, () => {
            expect(hasRuntimeBillingImport(stripComments(form))).toBe(false);
        });
    }

    it('does not let an earlier statement bleed into the clause it reads', () => {
        // `[^'";=]` bounding the clause is what stops the lazy span from
        // starting at `export const …;` and swallowing the type-only import
        // into a clause that then looks like a value import.
        const source = [
            'export const FEATURE_FLAG = 1;',
            `import type { PlanCategory } from '${FORBIDDEN_PACKAGE}';`
        ].join('\n');

        expect(hasRuntimeBillingImport(stripComments(source))).toBe(false);
    });

    it('does not let a preceding type alias make a runtime import look erased', () => {
        // The DANGEROUS direction of the same bleed, and the one that was
        // actually broken: the lazy clause started at `export`, so
        // `clauseSurvivesErasure` saw a clause beginning with `type` and
        // classified a real runtime import as erased — pruning the whole
        // subgraph below it, silently.
        const source = [
            'export type Foo = {',
            '    a: number',
            '}',
            `import { EntitlementKey } from '${FORBIDDEN_PACKAGE}';`
        ].join('\n');

        expect(hasRuntimeBillingImport(stripComments(source))).toBe(true);
        expect(extractImportEdges(stripComments(source))).toContainEqual({
            specifier: FORBIDDEN_PACKAGE,
            typeOnly: false
        });
    });

    it('does not let a semicolon-less type re-export bleed either', () => {
        // Covered by the tempered `(?!\b(?:import|export)\b)` rather than by
        // the `;` / `=` bounds, which both miss this shape.
        const source = [
            `export type { PlanCategory } from './local-types'`,
            `import { EntitlementKey } from '${FORBIDDEN_PACKAGE}';`
        ].join('\n');

        expect(hasRuntimeBillingImport(stripComments(source))).toBe(true);
    });

    it('does not let the word "import" inside a string swallow a side-effect edge', () => {
        // Real shape from components/host/CreatePropertyMiniForm.client.tsx.
        // Unanchored, `\bimport\b\s*['"]` matched at `import'` and its capture
        // ran to the NEXT quote, advancing lastIndex past the genuine
        // side-effect import below and dropping that edge entirely.
        const source = [
            `webLogger.info('CreatePropertyMiniForm: prefilled from import', { a: 1 });`,
            `import './side-effect';`
        ].join('\n');

        const edges = extractImportEdges(stripComments(source));

        expect(edges).toContainEqual({ specifier: './side-effect', typeOnly: false });
        expect(edges.every(({ specifier }) => !specifier.includes('\n'))).toBe(true);
    });

    it('does not let prose in a comment impersonate an import', () => {
        // The exact shape that produced a false positive on
        // lib/billing/fetch-plans.ts before stripComments() existed.
        const source = [
            '/**',
            ` * NOTE: PlanDefinition.limits in ${FORBIDDEN_PACKAGE} is an array. We do not`,
            ' * import it here; the shape is mirrored locally.',
            ' */',
            `import type { PlanCategory } from '${FORBIDDEN_PACKAGE}';`
        ].join('\n');

        expect(hasRuntimeBillingImport(stripComments(source))).toBe(false);
    });

    it('does not blank an import that merely follows a comment', () => {
        // Guards the dangerous direction: over-blanking would hide a real
        // violation and turn the whole suite silently green.
        const source = [
            '// A leading comment mentioning imports.',
            '/* and a block one */',
            `import { EntitlementKey } from '${FORBIDDEN_PACKAGE}';`
        ].join('\n');

        expect(hasRuntimeBillingImport(stripComments(source))).toBe(true);
    });

    it('does not treat a comment marker inside a string as a comment', () => {
        const source = `const url = '//example.com/*x*/'; import { K } from '${FORBIDDEN_PACKAGE}';`;

        expect(hasRuntimeBillingImport(stripComments(source))).toBe(true);
    });
});

describe('HOS-360 guard internals — stripComments never eats code', () => {
    // A character-level scanner has no notion of a regex literal, so `\/` inside
    // one reads as a `//` comment and a `/*` inside one opens a block scan.
    // Both DELETE source — the silently-green direction.
    const survivalCases: ReadonlyArray<{ readonly name: string; readonly source: string }> = [
        {
            name: 'a regex containing an escaped slash',
            source: [
                "const withoutScheme = raw.replace(/^https?:\\/\\//i, '').replace(/^www\\./i, '');",
                `import { A } from './a';`
            ].join('\n')
        },
        {
            name: 'a regex containing a block-comment opener',
            source: ['const weird = /[/*]/.test(value);', `import { B } from './b';`].join('\n')
        },
        {
            name: 'a regex containing quotes',
            source: [`const quoted = /['"]/g;`, `export { C } from './c';`].join('\n')
        },
        {
            name: 'a plain division expression',
            source: ['const ratio = a / b / c;', `import D from './d';`].join('\n')
        }
    ];

    for (const { name, source } of survivalCases) {
        it(`keeps every import statement past ${name}`, () => {
            const stripped = stripComments(source);

            expect(countImportStatements(stripped)).toBe(countImportStatements(source));
            // And the offending line itself is untouched, character for character.
            expect(stripped.split('\n')[0]).toBe(source.split('\n')[0]);
        });
    }

    it('still blanks the comment forms it exists to blank', () => {
        const source = [
            '/**',
            ` * import { X } from '${FORBIDDEN_PACKAGE}';`,
            ' */',
            `// import { Y } from '${FORBIDDEN_PACKAGE}';`,
            'const kept = 1;'
        ].join('\n');

        const stripped = stripComments(source);

        expect(stripped).toContain('const kept = 1;');
        expect(hasRuntimeBillingImport(stripped)).toBe(false);
    });

    it('removes only a LEADING comment prefix, never text from mid-line', () => {
        // The function is line-oriented, but "never removes text from the middle
        // of a line" would be false on its own terms: when a whole-line comment
        // closes mid-line the tail is kept and the prefix dropped. That, and
        // only that, is the text it ever removes from a surviving line.
        expect(stripComments("    /* c */ import { A } from './a';")).toBe(
            " import { A } from './a';"
        );
    });

    it('does not treat a line-initial /* inside a template literal as a comment', () => {
        // The silent-green hazard this design exists to remove: `inBlock` was
        // set by the `/*` opening a CSS comment INSIDE a template literal, and
        // every following line was blanked to EOF — including the import.
        const source = [
            'const css = `',
            '/* a css comment opened inside a template literal',
            '`;',
            `import { EntitlementKey } from '${FORBIDDEN_PACKAGE}';`
        ].join('\n');

        const stripped = stripComments(source);

        expect(countImportStatements(stripped)).toBe(countImportStatements(source));
        expect(hasRuntimeBillingImport(stripped)).toBe(true);
    });

    it('throws instead of silently blanking when a block comment never closes', () => {
        const source = [
            '/* opened and never closed',
            `import { EntitlementKey } from '${FORBIDDEN_PACKAGE}';`
        ].join('\n');

        expect(() => stripComments(source)).toThrow(/never closes/);
    });

    it('never loses an import edge anywhere in apps/web/src', () => {
        // Corpus-level safety net: turns this whole class of bug from silent
        // into loud.
        //
        // The baseline is the raw source with block-comment REGIONS blanked,
        // not the raw source itself. A deliberately commented-out
        // `/*\nimport { K } from './k';\n*/` is normal debugging practice, and
        // counting it as expected would fail this test for a removal
        // stripComments was right to make.
        const sources = collectFiles(
            WEB_SRC,
            (name) => name.endsWith('.ts') || name.endsWith('.tsx')
        );

        const losses = sources
            .map((file) => {
                const raw = fs.readFileSync(file, 'utf-8');
                const baseline = specifierCounts(blankBlockCommentRegions(raw));
                const kept = specifierCounts(stripComments(raw));

                const missing = [...baseline.entries()]
                    .filter(([specifier, count]) => (kept.get(specifier) ?? 0) < count)
                    .map(([specifier]) => specifier);

                return { file: path.relative(WEB_SRC, file), missing };
            })
            .filter(({ missing }) => missing.length > 0);

        expect(sources.length).toBeGreaterThan(400);
        expect(losses).toEqual([]);
    });

    it('extracts no specifier that spans a newline anywhere in apps/web/src', () => {
        // Non-vacuity for the line-anchored side-effect pattern: a specifier
        // containing a newline is proof the regex ran away inside a string
        // literal, and every genuine edge inside that span is lost.
        const sources = collectFiles(
            WEB_SRC,
            (name) => name.endsWith('.ts') || name.endsWith('.tsx') || name.endsWith('.astro')
        );

        const runaway = sources
            .flatMap((file) =>
                extractImportEdges(stripComments(fs.readFileSync(file, 'utf-8'))).map(
                    ({ specifier }) => ({ file: path.relative(WEB_SRC, file), specifier })
                )
            )
            .filter(({ specifier }) => specifier.includes('\n') || specifier.length > 120);

        expect(runaway).toEqual([]);
    });
});

describe('HOS-360 guard internals — markup comments are not hydration', () => {
    it('blanks <!-- --> and {/* */} spans while preserving every offset', () => {
        const template = [
            '<Real client:load />',
            '<!-- <Fake client:idle /> -->',
            '{/* <Other client:visible /> */}'
        ].join('\n');

        const blanked = blankMarkupComments(template);

        expect(blanked).toContain('<Real client:load />');
        expect(blanked).not.toContain('Fake');
        expect(blanked).not.toContain('Other');
        expect(blanked.length).toBe(template.length);
        expect(blanked.split('\n').length).toBe(template.split('\n').length);
    });

    it('does not attribute a documented directive to an unrelated preceding tag', () => {
        // The live shape: an HTML comment explaining a hydration choice sits
        // AFTER a real tag. Without blanking, the `client:idle` inside the
        // comment attributes to <Real> and injects a second, bogus island.
        const template = '<Real client:load /> <!-- use client:idle here instead -->';
        const directive = /\bclient:(?:load|idle|visible|only|media)\b/g;

        expect(template.match(directive)).toHaveLength(2);
        expect(blankMarkupComments(template).match(directive)).toHaveLength(1);
    });
});

describe('HOS-360 guard internals — type-only edges are not graph edges', () => {
    const edgeCases: ReadonlyArray<{ readonly source: string; readonly typeOnly: boolean }> = [
        { source: `import type { A } from './x';`, typeOnly: true },
        { source: `import { type A, type B } from './x';`, typeOnly: true },
        { source: `export type { A } from './x';`, typeOnly: true },
        { source: `import { A } from './x';`, typeOnly: false },
        { source: `import { type A, B } from './x';`, typeOnly: false },
        { source: `import Def, { type A } from './x';`, typeOnly: false },
        { source: `export * from './x';`, typeOnly: false },
        { source: `import './x';`, typeOnly: false },
        { source: `await import('./x');`, typeOnly: false }
    ];

    for (const { source, typeOnly } of edgeCases) {
        it(`marks typeOnly=${typeOnly} for: ${source}`, () => {
            expect(extractImportEdges(source)).toContainEqual({ specifier: './x', typeOnly });
        });
    }
});

describe('HOS-360 static guard — @repo/billing never enters the web client graph', () => {
    const scan = scanAstroHydration();
    const entrypoints = collectEntrypoints();
    const clientTsxSweep = new Set(collectFiles(WEB_SRC, (name) => name.endsWith('.client.tsx')));
    const astroDerived = new Set(
        scan.islands.map(({ file }) => file).filter((file): file is string => file !== null)
    );
    const visited = new Set<string>();
    const offenders = findOffenders(entrypoints, visited);

    it('finds the island entrypoints it claims to scan', () => {
        // Non-vacuity: an empty (or badly shrunken) scan would make every
        // assertion below trivially pass. Measured 2026-07-29: 162 entrypoints,
        // 159 of them from the filename sweep alone.
        expect(entrypoints.length).toBeGreaterThanOrEqual(160);
    });

    it('derives entrypoints from client:* directives, not just from filenames', () => {
        // A floor on the TOTAL is satisfied by the `*.client.tsx` sweep on its
        // own (159 of the 162), so a total regression of the .astro scan would
        // sail through it. This floors the .astro-derived set separately:
        // measured 2026-07-29 it resolves 100 distinct modules.
        expect(astroDerived.size).toBeGreaterThanOrEqual(95);

        // `*.client.tsx` is a naming convention. These three islands are
        // hydrated from modules that do not carry the suffix, so the filename
        // sweep alone never scans them.
        const beyondTheSweep = entrypoints
            .filter((file) => !clientTsxSweep.has(file))
            .map((file) => path.relative(WEB_SRC, file))
            .sort();

        expect(beyondTheSweep).toEqual([
            'components/accommodation/AiChatWidget.tsx',
            'components/accommodation/PriceAlertButton.tsx',
            'components/account/EditableNote.tsx'
        ]);
    });

    it('resolves every hydrated component except the known bare specifier', () => {
        // If the .astro parsing regressed, `file: null` would spread and the
        // scope would silently shrink back to the filename sweep.
        const unresolved = scan.islands
            .filter((island) => island.file === null)
            .map((island) => `${island.from} -> ${island.tag} (${island.specifier})`);

        expect(unresolved).toEqual([
            'pages/[lang]/feedback/index.astro -> FeedbackForm (@repo/feedback)'
        ]);
    });

    it('accounts for every .astro file and every client:* directive it skips', () => {
        // The two silent-shrink paths inside the .astro sweep. A file with no
        // frontmatter fence contributes ZERO islands; a directive whose owning
        // tag cannot be found is skipped. Before markup comments were blanked
        // there were 11 unattributed directives (measured 2026-07-29, out of
        // 168 raw occurrences), excluded only by luck — the `[^<]*$` guard
        // tripping on the `<` of `<!--` — rather than by design.
        //
        // Exactly one survives, and it is the documented out-of-scope surface:
        // a `/* … */` comment INSIDE an inline `<script is:inline>` template
        // literal in BaseLayout, describing when the feedback FAB hydrates. It
        // is correctly unattributed — the nearest preceding tag is the
        // lowercase `<script>` — and inline scripts are a separate client
        // graph this guard never claims to walk.
        expect(scan.skippedFiles).toEqual([]);
        expect(scan.unattributed).toEqual([
            'layouts/BaseLayout.astro: …Captures navigation BEFORE the FAB island hydrates with'
        ]);
    });

    it('actually walks past the entrypoints into their imports', () => {
        // Non-vacuity part 2: if module resolution silently broke, `visited`
        // would collapse towards the entrypoints. Measured 2026-07-29: 472
        // modules reached from 162 entrypoints. A 2x floor (324) tolerated a
        // 31% collapse; this one does not.
        expect(visited.size).toBeGreaterThanOrEqual(450);
    });

    it('reaches known modules at depth 1 and depth 2', () => {
        // A resolver that dropped the `@/` alias branch (which carries most of
        // the closure) would still satisfy a bare `visited > entrypoints`
        // count. These pin a concrete chain instead:
        // MobileMenu.client.tsx -> @/lib/nav-avatar -> its own imports.
        expect(visited.has(abs(MOBILE_MENU))).toBe(true);
        expect(visited.has(abs(NAV_AVATAR))).toBe(true);
        expect(visited.has(abs('config/navigation.ts'))).toBe(true);
        expect(visited.has(abs('lib/nav-gating.ts'))).toBe(true);
    });

    it('does not follow type-only edges into SSR-only modules', () => {
        // Three islands import a TYPE from lib/billing/fetch-plans.ts. That
        // edge is erased, so the module never reaches the browser and must not
        // be judged by a client-side rule. The mutation test below proves this
        // is the erasure rule at work and not a dead resolver.
        expect(visited.has(abs('lib/billing/fetch-plans.ts'))).toBe(false);
    });

    it('no client island reaches @repo/billing at runtime', () => {
        const report = offenders.map(({ chain }) => chain.join(' -> '));

        expect(
            report,
            `Client islands reaching ${FORBIDDEN_PACKAGE}. Its barrel re-exports the ` +
                'MercadoPago adapter, @repo/logger and the @repo/config env registry. In ' +
                'dev the logger reads process.env at module scope and the island dies ' +
                'during hydration with "process is not defined"; in production nothing is ' +
                'tree-shaken, so the adapter, the logger category machinery and the ' +
                'env-registry prose (HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN and its howToObtain ' +
                'text included) all ship to public browsers. Use the wire string literal ' +
                'instead (see the convention comment in AnalyticsSection.client.tsx), or ' +
                '`import type` if you only need types.'
        ).toEqual([]);
    });
});

describe('HOS-360 static guard — the corpus walk goes RED on a planted violation', () => {
    const entrypoints = collectEntrypoints();
    const violation = `\nimport { EntitlementKey } from '${FORBIDDEN_PACKAGE}';\n`;

    /**
     * Appends a runtime billing import to the content the walker sees for
     * `targets`, without touching disk.
     *
     * The detector memoises stripped sources, so the cache MUST be dropped on
     * both sides of the mutation — otherwise the walk reads a pre-mutation
     * (or post-restore) copy and the test proves nothing.
     */
    const plant = (targets: readonly string[]) => {
        const readFileSync = fs.readFileSync.bind(fs);
        const poisoned = new Set(targets);
        clearStrippedCache();

        return vi.spyOn(fs, 'readFileSync').mockImplementation(((
            file: Parameters<typeof fs.readFileSync>[0],
            options: Parameters<typeof fs.readFileSync>[1]
        ) => {
            const content = readFileSync(file, options);
            return typeof file === 'string' && poisoned.has(file)
                ? `${content as string}${violation}`
                : content;
        }) as typeof fs.readFileSync);
    };

    const unplant = (spy: { mockRestore: () => void }) => {
        spy.mockRestore();
        clearStrippedCache();
    };

    it('reports a planted violation at the entrypoint AND one reached transitively', () => {
        const spy = plant([abs(MOBILE_MENU), abs(NAV_AVATAR)]);

        try {
            const offenders = findOffenders([abs(MOBILE_MENU)], new Set());

            expect(offenders.map(({ module }) => module)).toEqual([MOBILE_MENU, NAV_AVATAR]);
            expect(offenders.find(({ module }) => module === NAV_AVATAR)?.chain).toEqual([
                MOBILE_MENU,
                NAV_AVATAR
            ]);
        } finally {
            unplant(spy);
        }

        // …and clean again the moment the mutation is gone.
        expect(findOffenders([abs(MOBILE_MENU)], new Set())).toEqual([]);
    });

    it('reports one shared offender once, not once per island reaching it', () => {
        // lib/cn.ts is reached from 83 of the 162 entrypoints (measured
        // 2026-07-29). A per-entrypoint `seen` set produced 83 identical rows
        // for a single bug.
        const spy = plant([abs('lib/cn.ts')]);

        try {
            const visited = new Set<string>();
            const offenders = findOffenders(entrypoints, visited);

            expect(offenders.map(({ module }) => module)).toEqual(['lib/cn.ts']);
            expect(offenders[0]?.chain.at(-1)).toBe('lib/cn.ts');
            // The mutation ran through the REAL walk, not a short-circuited one.
            expect(visited.size).toBeGreaterThanOrEqual(450);
        } finally {
            unplant(spy);
        }
    });

    it('follows the fetch-plans edge as soon as it stops being type-only', () => {
        // Non-vacuity for the type-only skip: the module IS resolvable and IS
        // one hop from an island — it is excluded by the erasure rule alone.
        const island = abs('components/account/PlanPicker.client.tsx');
        const readFileSync = fs.readFileSync.bind(fs);
        clearStrippedCache();
        const spy = vi.spyOn(fs, 'readFileSync').mockImplementation(((
            file: Parameters<typeof fs.readFileSync>[0],
            options: Parameters<typeof fs.readFileSync>[1]
        ) => {
            const content = readFileSync(file, options);
            return file === island
                ? (content as string).replace(
                      `import type { PublicPlanData } from '@/lib/billing/fetch-plans';`,
                      `import { filterPlansByCategory } from '@/lib/billing/fetch-plans';`
                  )
                : content;
        }) as typeof fs.readFileSync);

        try {
            const visited = new Set<string>();
            findOffenders([island], visited);

            expect(visited.has(abs('lib/billing/fetch-plans.ts'))).toBe(true);
        } finally {
            unplant(spy);
        }
    });
});
