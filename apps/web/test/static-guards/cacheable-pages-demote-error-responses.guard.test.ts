/**
 * @file cacheable-pages-demote-error-responses.guard.test.ts
 * @description Static guard: no file may produce a shared-cacheable response
 * that can render its own failure state without reaching the degradation
 * marker (HOS-1154).
 *
 * ## Why a guard and not a review habit
 *
 * The runtime fix is already impossible to forget for the pages that exist
 * today: they render `ErrorBanner.astro`, and the banner marks the response
 * itself. What a guard adds is the case nobody is watching — the NEXT listing,
 * which draws its failure some other way, and whose error is then stored by
 * Cloudflare for the full catalog TTL with nothing able to purge it (tag purges
 * fire on entity writes; fixing an API is not a write). That defect is silent,
 * delayed, and invisible to every test that only asserts the healthy path.
 *
 * ## Scope, and the mistake it avoids
 *
 * The scan covers ALL of `src/`, not `src/pages`. A guard scoped to pages
 * certifies the page, not the RESPONSE: a layout or a wrapper component that
 * declares cacheability and renders a failure state is the same defect one
 * level up, and page-scoped guards in this repo have missed exactly that before
 * (the WB0-7 incident, documented in the sibling
 * `cacheable-responses-declare-tags.test.ts`).
 *
 * ## The measured scope, which is NOT the number in the issue
 *
 * HOS-1154 states 18 pages can cache their own error. Measured here with
 * comments stripped, it is **16**. The two named pages that do not belong —
 * `alojamientos/comodidades/[slug]` and `alojamientos/caracteristicas/[slug]` —
 * mention `applyCacheHeaders` only inside a JSDoc block that exists to say the
 * page deliberately has NO such call yet ("That is a GAP, not a decision"). A
 * text grep counts that sentence; this guard does not.
 *
 * They are covered anyway, and that is the point of fixing it at the component:
 * both render `ErrorBanner.astro`, so on the day someone closes that gap the
 * demotion is already wired and this guard already polices them.
 *
 * ## There is no exemption list
 *
 * Deliberately. Every entry in such a list is a response allowed to cache its
 * own error, and there is no case where that is right — a degraded page has
 * nothing worth sharing. An escape hatch here would be the fail-open.
 *
 * @module test/static-guards/cacheable-pages-demote-error-responses.guard
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
    isPolicedFile,
    marksDegradedResponse,
    marksDegradedResponseUnconditionally,
    matchedErrorSurfaces,
    mayBeEdgeCacheable,
    reachesDegradationMarker,
    rendersErrorSurface,
    resolveLocalImport,
    sliceCallArguments
} from './cacheable-pages-demote-error-responses';

const WEB_SRC = path.resolve(__dirname, '../../src');

/** File extensions this guard inspects. */
const SCANNED_EXTENSIONS = new Set(['.astro', '.ts', '.tsx']);

/** Directory names never worth descending into. */
const SKIPPED_DIRECTORIES = new Set([`node${'_'}modules`, 'dist']);

/**
 * The count of pages that can currently cache their own error, measured on
 * `origin/staging` at 60a39dae2 and asserted as a FLOOR.
 *
 * A floor rather than an equality: adding a cacheable listing is normal and
 * must not fail the build, but the number dropping means either a page was
 * retired or — far more likely, and the reason this assertion exists — one of
 * the two detector halves stopped recognising what it is looking at. Rename
 * `applyCacheHeaders` or `ErrorBanner` and the violation list stays empty
 * because the POLICED list emptied; this is what turns that silent blinding
 * into a failure.
 */
const POLICED_FLOOR = 16;

/** Recursively collect every scannable file under `dir`. */
function collectFiles(dir: string): string[] {
    if (!fs.existsSync(dir)) return [];

    const files: string[] = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (SKIPPED_DIRECTORIES.has(entry.name)) continue;
            files.push(...collectFiles(full));
            continue;
        }
        if (SCANNED_EXTENSIONS.has(path.extname(entry.name))) files.push(full);
    }
    return files;
}

const ALL_FILES = collectFiles(WEB_SRC);
const POLICED = ALL_FILES.filter((file) =>
    isPolicedFile({ source: fs.readFileSync(file, 'utf8') })
);

describe('cacheable pages demote their error responses', () => {
    it('scans a non-trivial number of files (the scan itself is not vacuous)', () => {
        expect(ALL_FILES.length).toBeGreaterThan(100);
    });

    it('still finds the pages it is supposed to police', () => {
        // See POLICED_FLOOR: this is what catches the detector going blind,
        // which would otherwise read as "zero violations".
        expect(POLICED.length).toBeGreaterThanOrEqual(POLICED_FLOOR);
    });

    it('no shared-cacheable response can render an error nothing demotes', () => {
        const violations = POLICED.filter(
            (file) => !reachesDegradationMarker({ file, srcRoot: WEB_SRC })
        ).map((file) => {
            const surfaces = matchedErrorSurfaces({ source: fs.readFileSync(file, 'utf8') });
            return `${path.relative(WEB_SRC, file)} (${surfaces.join('; ')})`;
        });

        // The message says only what the predicate checked: that nothing in the
        // file's own module graph calls the marker. It does not claim the page
        // WILL cache an error, only that nothing would stop it.
        expect(
            violations,
            'these files may declare a shared-cacheable response AND render a failure state, but nothing in their module graph calls markResponseDegraded'
        ).toEqual([]);
    });

    it('the page HOS-1154 measured is policed, and passes', () => {
        // Named explicitly so the guard cannot pass by accidentally excluding
        // the exact file the issue reproduced on.
        const gastronomy = path.join(WEB_SRC, 'pages/[lang]/gastronomia/index.astro');

        expect(fs.existsSync(gastronomy)).toBe(true);
        expect(isPolicedFile({ source: fs.readFileSync(gastronomy, 'utf8') })).toBe(true);
        expect(reachesDegradationMarker({ file: gastronomy, srcRoot: WEB_SRC })).toBe(true);
    });

    it('the pages reach the marker through the banner, not by calling it themselves', () => {
        // This is the whole design under test. If some future refactor moved
        // the call INTO the pages, they would still pass the rule above while
        // silently becoming 16 places to remember again — which is the option
        // HOS-1154 rejected. Assert the chokepoint is still a chokepoint.
        const selfMarking = POLICED.filter((file) =>
            marksDegradedResponse({ source: fs.readFileSync(file, 'utf8') })
        );

        expect(selfMarking).toEqual([]);
    });

    it('the banner every policed page renders is the thing that marks', () => {
        const banner = path.join(WEB_SRC, 'components/shared/feedback/ErrorBanner.astro');

        expect(fs.existsSync(banner)).toBe(true);
        expect(marksDegradedResponse({ source: fs.readFileSync(banner, 'utf8') })).toBe(true);
    });
});

describe('detector: what counts as shared-cacheable', () => {
    it('policies a listing that computes its cacheability at runtime', () => {
        // The shape every real listing writes. A static scan cannot evaluate
        // the call, and "I could not tell" must resolve to "police it".
        const source = `applyCacheHeaders({ locals: Astro.locals, headers: Astro.response.headers,
            cacheable: hasOnlyPaginationParams({ searchParams: Astro.url.searchParams }),
            cacheClass: 'catalog', tags: [CACHE_TAG_COLLECTIONS.gastronomy] });`;
        expect(mayBeEdgeCacheable({ source })).toBe(true);
    });

    it('exempts a call that is literally never cacheable', () => {
        const source = `applyCacheHeaders({ locals, headers, cacheable: false, cacheClass: 'catalog', tags: ['x'] });`;
        expect(mayBeEdgeCacheable({ source })).toBe(false);
    });

    it('does not let one uncacheable call excuse a cacheable one in the same file', () => {
        // Attribution matters: a naive "does the file contain `cacheable: false`"
        // check would clear this file, and its second response would ship
        // cacheable with an undemotable error inside it.
        const source = `
            applyCacheHeaders({ locals, headers, cacheable: false, cacheClass: 'catalog', tags: ['a'] });
            applyCacheHeaders({ locals, headers, cacheable: true, cacheClass: 'catalog', tags: ['b'] });
        `;
        expect(mayBeEdgeCacheable({ source })).toBe(true);
    });

    it('sees a hand-written public Cache-Control, not only the choke point', () => {
        const source = `Astro.response.headers.set('Cache-Control', 'public, s-maxage=3600');`;
        expect(mayBeEdgeCacheable({ source })).toBe(true);
    });

    it('does not read prose as a call', () => {
        const source = `/* It was never given an applyCacheHeaders call. */
            <div>{hasError && <ErrorBanner />}</div>`;
        expect(mayBeEdgeCacheable({ source })).toBe(false);
        // Exactly the two accommodation-facet pages: an error surface with no
        // cacheability, so not policed and not a violation.
        expect(isPolicedFile({ source })).toBe(false);
    });

    it('attributes an argument to its own call, not to text that follows', () => {
        const code = `applyCacheHeaders({ cacheable: true }); other({ cacheable: false });`;
        const args = sliceCallArguments({ code, openIndex: code.indexOf('(') });

        expect(args).toBe('{ cacheable: true }');
    });

    it('is not unbalanced by a parenthesis inside a string', () => {
        const code = `applyCacheHeaders({ tags: ['a)b'], cacheable: false });`;
        const args = sliceCallArguments({ code, openIndex: code.indexOf('(') });

        expect(args).toContain('cacheable: false');
        expect(mayBeEdgeCacheable({ source: code })).toBe(false);
    });
});

describe('detector: what counts as rendering an error', () => {
    it.each([
        ['the banner as written today', '<ErrorBanner locale={locale} error={result.error} />'],
        ['a differently named error component', '<ApiErrorPanel status={500} />'],
        ['a namespaced one', '<Feedback.Error />'],
        ['a self-closing one with no space', '<ErrorState/>'],
        ['the flag, with no component in sight', 'const hasError = !result.ok;'],
        ['another spelling of the flag', 'const showError = failed;'],
        ['a state variable', 'const errorState = { status };'],
        ['the ARIA role an error announces itself with', '<div role="alert">Se rompió</div>']
    ])('catches %s', (_label, source) => {
        expect(rendersErrorSurface({ source })).toBe(true);
    });

    it.each([
        ['an ordinary listing with no failure state', '<AccommodationCard {...card} />'],
        [
            'a try/catch that never renders anything',
            'try { await go(); } catch (error) { log(error); }'
        ],
        ['a polite status region', '<div role="status">Cargando…</div>'],
        ['the word inside a longer identifier', 'const mirrored = terrorless;']
    ])('does not fire on %s', (_label, source) => {
        expect(rendersErrorSurface({ source })).toBe(false);
    });

    it('does not read prose as markup, in all three comment forms', () => {
        for (const source of [
            `/* renders <ErrorBanner /> when hasError */`,
            `// renders <ErrorBanner /> when hasError`,
            `<!-- renders <ErrorBanner /> when hasError -->`
        ]) {
            expect(rendersErrorSurface({ source }), source).toBe(false);
        }
    });
});

describe('detector: reaching the marker', () => {
    const SRC = '/fake/src';

    /** A synthetic module graph, so the traversal is tested without the repo. */
    function graph(files: Readonly<Record<string, string>>) {
        return {
            readFile: (target: string): string => {
                const source = files[target];
                if (source === undefined) throw new Error(`no such file: ${target}`);
                return source;
            },
            fileExists: (target: string): boolean => target in files
        };
    }

    it('THE TRAP: a new cacheable listing that draws its own error and marks nothing is a violation', () => {
        // The page this guard exists to stop. It is well-formed, it looks like
        // its 16 siblings, and every one of its assertions would pass — the
        // only thing wrong with it is that its error response is shareable.
        const source = `
            import ShinyNewErrorPanel from '@/components/ShinyNewErrorPanel.astro';
            applyCacheHeaders({ locals: Astro.locals, headers: Astro.response.headers,
                cacheable: hasOnlyPaginationParams({ searchParams: Astro.url.searchParams }),
                cacheClass: 'catalog', tags: ['list-new'] });
            const hasError = !result.ok;
            ---
            {hasError && <ShinyNewErrorPanel />}
        `;

        expect(isPolicedFile({ source })).toBe(true);
        expect(
            reachesDegradationMarker({
                file: `${SRC}/pages/nuevo.astro`,
                srcRoot: SRC,
                ...graph({
                    [`${SRC}/pages/nuevo.astro`]: source,
                    [`${SRC}/components/ShinyNewErrorPanel.astro`]: '<div role="alert">Roto</div>'
                })
            })
        ).toBe(false);
    });

    it('the same page passes once its panel marks the response', () => {
        const page = `
            import ShinyNewErrorPanel from '@/components/ShinyNewErrorPanel.astro';
            const hasError = !result.ok;
            {hasError && <ShinyNewErrorPanel />}
        `;

        expect(
            reachesDegradationMarker({
                file: `${SRC}/pages/nuevo.astro`,
                srcRoot: SRC,
                ...graph({
                    [`${SRC}/pages/nuevo.astro`]: page,
                    [`${SRC}/components/ShinyNewErrorPanel.astro`]: `
                        import { markResponseDegraded } from '@/lib/cache/response-cache';
                        markResponseDegraded({ locals: Astro.locals });
                    `
                })
            })
        ).toBe(true);
    });

    it('THE IMPORT TRAP: importing the banner without rendering it is NOT enough', () => {
        // Reproduced by review on `pages/[lang]/gastronomia/index.astro` — the
        // exact page HOS-1154 measured. Replacing the `<ErrorBanner …>` render
        // with inline markup and leaving the import alone put the public
        // Cache-Control straight back on the error response, and the FIRST
        // version of this detector passed it, because it walked imports.
        //
        // All three nets missed that mutation: guard + middleware suite gave
        // `45 passed`; `biome check` said `Checked 0 files` (.astro is excluded
        // from Biome by config) so the dead import was not even a warning; and
        // `astro check` gave `0 errors, 0 warnings` because ts(6133) is a hint.
        // Nothing else in the toolchain was going to catch it.
        const page = `
            import ErrorBanner from '@/components/shared/feedback/ErrorBanner.astro';
            applyCacheHeaders({ locals, headers, cacheable: isCacheable, cacheClass: 'catalog', tags: ['t'] });
            const hasError = !result.ok;
            ---
            {hasError && <p class="load-failure" role="alert">No pudimos cargar.</p>}
        `;

        expect(isPolicedFile({ source: page })).toBe(true);
        expect(
            reachesDegradationMarker({
                file: `${SRC}/pages/nuevo.astro`,
                srcRoot: SRC,
                ...graph({
                    [`${SRC}/pages/nuevo.astro`]: page,
                    [`${SRC}/components/shared/feedback/ErrorBanner.astro`]: `markResponseDegraded({ locals: Astro.locals });`
                })
            })
        ).toBe(false);
    });

    it('follows more than one hop, because a banner can be wrapped', () => {
        expect(
            reachesDegradationMarker({
                file: `${SRC}/pages/nuevo.astro`,
                srcRoot: SRC,
                ...graph({
                    [`${SRC}/pages/nuevo.astro`]: `import Wrapper from './Wrapper.astro';
                        <Wrapper />`,
                    [`${SRC}/pages/Wrapper.astro`]: `import Banner from '@/components/Banner.astro';
                        <Banner />`,
                    [`${SRC}/components/Banner.astro`]: `markResponseDegraded({ locals: Astro.locals });`
                })
            })
        ).toBe(true);
    });

    it('honours an `as` rename, so the template name still resolves', () => {
        expect(
            reachesDegradationMarker({
                file: `${SRC}/pages/nuevo.astro`,
                srcRoot: SRC,
                ...graph({
                    [`${SRC}/pages/nuevo.astro`]: `import { Banner as Boom } from '@/components/Banner.astro';
                        <Boom />`,
                    [`${SRC}/components/Banner.astro`]: `markResponseDegraded({ locals: Astro.locals });`
                })
            })
        ).toBe(true);
    });

    it('a CONDITIONAL marker in a component does not certify the page that renders it', () => {
        // `components/ErrorBanner.astro` marks behind `if (variant === 'error')`.
        // That is right at runtime — `info`/`warning` are advisory notes on
        // content that rendered fine — but rendering it is not proof anything
        // was marked, so it cannot vouch for a caller that draws its real
        // failure some other way.
        expect(
            reachesDegradationMarker({
                file: `${SRC}/pages/nuevo.astro`,
                srcRoot: SRC,
                ...graph({
                    [`${SRC}/pages/nuevo.astro`]: `import Banner from '@/components/Banner.astro';
                        <Banner variant="info" />`,
                    [`${SRC}/components/Banner.astro`]: `if (variant === 'error') markResponseDegraded({ locals: Astro.locals });`
                })
            })
        ).toBe(false);
    });

    it('THE FORMATTING TRAP: a BLOCK-form conditional does not certify either', () => {
        // Review's mutation on `shared/feedback/ErrorBanner.astro`. The first
        // version of the unconditional check was
        // `/(?:^|[{};])\s*markResponseDegraded\s*\(/m`, where `^` under `/m` is
        // LINE start and `[{};]` matches the opening brace of the very `if` —
        // so this exact shape counted as unconditional, the banner stopped
        // marking in practice, and all 40 tests stayed green with the 16 pages
        // still certified.
        //
        // The one-line form was the ONLY thing it rejected, which made the
        // whole distinction a matter of FORMATTING — and `.astro` is excluded
        // from Biome, so nothing normalises that line in either direction.
        expect(
            reachesDegradationMarker({
                file: `${SRC}/pages/nuevo.astro`,
                srcRoot: SRC,
                ...graph({
                    [`${SRC}/pages/nuevo.astro`]: `import Banner from '@/components/Banner.astro';
                        <Banner />`,
                    [`${SRC}/components/Banner.astro`]: `
                        if (error?.status === 599) {
                            markResponseDegraded({ locals: Astro.locals });
                        }
                    `
                })
            })
        ).toBe(false);
    });

    it('but a page may mark inside its OWN failure branch', () => {
        // The fail-soft shape: no banner, a conditional call at the page. It is
        // marking exactly when it should, so the entry file's own call counts
        // whether or not it is unconditional.
        expect(
            reachesDegradationMarker({
                file: `${SRC}/pages/home.astro`,
                srcRoot: SRC,
                ...graph({
                    [`${SRC}/pages/home.astro`]: `if (!result.ok) markResponseDegraded({ locals: Astro.locals });`
                })
            })
        ).toBe(true);
    });

    it('terminates on an import cycle instead of hanging', () => {
        expect(
            reachesDegradationMarker({
                file: `${SRC}/a.astro`,
                srcRoot: SRC,
                ...graph({
                    [`${SRC}/a.astro`]: `import B from './b.astro';
                        <B />`,
                    [`${SRC}/b.astro`]: `import A from './a.astro';
                        <A />`
                })
            })
        ).toBe(false);
    });

    it('THE OTHER TRAP: the module that DEFINES the marker does not count as calling it', () => {
        // This detector shipped with exactly this fail-open and mutation caught
        // it. `markResponseDegraded` lives in the same module as
        // `applyCacheHeaders`, which every cacheable page imports — so a
        // traversal that accepted the function SIGNATURE reported "reached" for
        // every page in the app, and the guard's main rule passed on nothing.
        expect(
            marksDegradedResponse({
                source: `export function markResponseDegraded({ locals }: { locals: App.Locals }): void {
                    locals.responseDegraded = true;
                }`
            })
        ).toBe(false);

        expect(
            reachesDegradationMarker({
                file: `${SRC}/pages/nuevo.astro`,
                srcRoot: SRC,
                ...graph({
                    [`${SRC}/pages/nuevo.astro`]: `import { applyCacheHeaders } from '@/lib/cache/response-cache';
                        <ResponseCache />`,
                    [`${SRC}/lib/cache/response-cache.ts`]: `export function markResponseDegraded({ locals }) { locals.responseDegraded = true; }`
                })
            })
        ).toBe(false);
    });

    it('does not credit an import of the marker that is never called', () => {
        expect(
            marksDegradedResponse({ source: `import { markResponseDegraded } from '@/x';` })
        ).toBe(false);
    });

    it('does not credit a marker that is only mentioned in a comment', () => {
        expect(
            reachesDegradationMarker({
                file: `${SRC}/a.astro`,
                srcRoot: SRC,
                ...graph({
                    [`${SRC}/a.astro`]: `// we should call markResponseDegraded({ locals }) here one day`
                })
            })
        ).toBe(false);
    });
});

describe('detector: which marker calls certify a component', () => {
    it.each([
        ['a plain top-level call', `markResponseDegraded({ locals: Astro.locals });`],
        [
            'a top-level call after other statements',
            `const t = createT(locale);\nmarkResponseDegraded({ locals: Astro.locals });\nconst x = 1;`
        ],
        [
            'a call whose argument object spans lines',
            `markResponseDegraded({\n    locals: Astro.locals\n});`
        ]
    ])('CERTIFIES %s', (_label, source) => {
        expect(marksDegradedResponseUnconditionally({ source })).toBe(true);
    });

    it.each([
        [
            'the one-line if',
            `if (variant === 'error') markResponseDegraded({ locals: Astro.locals });`
        ],
        [
            'the BLOCK if — the form that defeated the first regex',
            `if (variant === 'error') {\n    markResponseDegraded({ locals: Astro.locals });\n}`
        ],
        [
            'an else branch',
            `if (a) {\n    b();\n} else {\n    markResponseDegraded({ locals: Astro.locals });\n}`
        ],
        ['a logical-and guard', `ok && markResponseDegraded({ locals: Astro.locals });`],
        ['a ternary', `ok ? noop() : markResponseDegraded({ locals: Astro.locals });`],
        [
            'inside a loop',
            `for (const r of results) {\n    markResponseDegraded({ locals: Astro.locals });\n}`
        ],
        [
            'inside a catch',
            `try {\n    load();\n} catch {\n    markResponseDegraded({ locals: Astro.locals });\n}`
        ],
        [
            'inside a helper the component may or may not call',
            `const degrade = () => {\n    markResponseDegraded({ locals: Astro.locals });\n};`
        ]
    ])('does NOT certify %s', (_label, source) => {
        expect(marksDegradedResponseUnconditionally({ source })).toBe(false);
    });

    it('is not fooled by a brace inside a string literal', () => {
        const source = `const msg = "if (x) {";\nmarkResponseDegraded({ locals: Astro.locals });`;
        expect(marksDegradedResponseUnconditionally({ source })).toBe(true);
    });

    it('the real banner certifies; the real variant-gated one does not', () => {
        const banner = fs.readFileSync(
            path.join(WEB_SRC, 'components/shared/feedback/ErrorBanner.astro'),
            'utf8'
        );
        const generic = fs.readFileSync(path.join(WEB_SRC, 'components/ErrorBanner.astro'), 'utf8');

        expect(marksDegradedResponseUnconditionally({ source: banner })).toBe(true);
        // Marks only for `variant === 'error'`, so it protects itself but
        // cannot vouch for a caller.
        expect(marksDegradedResponse({ source: generic })).toBe(true);
        expect(marksDegradedResponseUnconditionally({ source: generic })).toBe(false);
    });
});

describe('detector: import resolution', () => {
    it('resolves the @/ alias against src, the way the app writes it', () => {
        const resolved = resolveLocalImport({
            specifier: '@/lib/cache/response-cache',
            fromFile: path.join(WEB_SRC, 'pages/[lang]/gastronomia/index.astro'),
            srcRoot: WEB_SRC
        });

        expect(resolved).toBe(path.join(WEB_SRC, 'lib/cache/response-cache.ts'));
    });

    it('resolves a .js specifier to the .ts source it really means', () => {
        // `response-cache.ts` imports `./listing-cache.js`. A resolver that took
        // the extension literally would stop walking there.
        const resolved = resolveLocalImport({
            specifier: './listing-cache.js',
            fromFile: path.join(WEB_SRC, 'lib/cache/response-cache.ts'),
            srcRoot: WEB_SRC
        });

        expect(resolved).toBe(path.join(WEB_SRC, 'lib/cache/listing-cache.ts'));
    });

    it('ignores anything outside src — a package cannot hold the marker', () => {
        expect(
            resolveLocalImport({
                specifier: '@repo/icons',
                fromFile: path.join(WEB_SRC, 'components/shared/feedback/ErrorBanner.astro'),
                srcRoot: WEB_SRC
            })
        ).toBeNull();
    });
});
