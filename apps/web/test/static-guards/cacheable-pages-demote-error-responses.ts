/**
 * @file cacheable-pages-demote-error-responses.ts
 * @description Detector used by the guard of the same name (HOS-1154).
 *
 * Split from the test file, like its sibling
 * `cacheable-responses-declare-tags.ts`, so the detection rules can themselves
 * be exercised on synthetic sources. A guard that is never shown to FAIL is a
 * guard nobody knows works.
 *
 * ## The rule
 *
 * A file that can produce a shared-cacheable response, and that can also render
 * a user-visible failure state, must REACH `markResponseDegraded` — itself, or
 * through something it imports. Reaching it is what makes middleware strip the
 * public `Cache-Control` before the response leaves the origin.
 *
 * "Reach" rather than "call" is the load-bearing word. None of the 16 listing
 * pages calls the marker; every one of them renders `ErrorBanner.astro`, which
 * does. Demanding the call at the page would re-introduce the 16-places-to-
 * remember problem this fix exists to remove, and would fail every page that is
 * already correct. So the check follows local imports transitively and asks
 * whether the marker is anywhere in the page's own module graph.
 *
 * That also gives the guard a useful failure mode on a rename: delete the call
 * from `ErrorBanner.astro`, or rename `markResponseDegraded` at its call sites,
 * and all 16 pages become violations at once, loudly, instead of the guard
 * going quietly blind. (Measured, both ways.) Renaming ONLY the declaration is
 * not caught here and is not meant to be — that source does not compile, so it
 * is typecheck's failure to report, not this guard's.
 *
 * `16`, not the `18` HOS-1154 states: the two accommodation-facet pages in that
 * count mention `applyCacheHeaders` only inside a JSDoc saying they deliberately
 * have no such call. See the guard test's module doc for the full accounting.
 *
 * @module test/static-guards/cacheable-pages-demote-error-responses
 */

import fs from 'node:fs';
import path from 'node:path';
import { classifyCacheControl, stripComments } from './cacheable-responses-declare-tags';

/**
 * Every way this app renders a user-visible failure state into a response.
 *
 * A union rather than one pattern, on purpose: `hasError`, `!result.ok` and
 * `<ErrorBanner>` are three spellings of the same thing, and a guard anchored
 * on whichever one happens to be idiomatic today lets the other two through.
 * All of them are anchored (`\b`, or a tag opening) so a rename cannot slip
 * past on a substring match.
 *
 * WHAT THIS DOES NOT SEE, stated so nobody mistakes it for total coverage:
 *
 *   - **The FAIL-SOFT class, and this is the big one.** A page that swallows a
 *     load failure into `result.ok ? … : []` renders no failure markup at all,
 *     so none of the signals above fire and it is not even policed. This entry
 *     used to say such a page "would still have to be WRITTEN" and that a
 *     reviewer would be the last line. **Both halves were false and review
 *     measured it**: with the API down, `/es/` answered 200 with
 *     `public, s-maxage=3600, stale-while-revalidate=3600`,
 *     `cache-tag: dev:all,dev:home`, zero `<article>` elements and
 *     `destinations: []` — the highest-traffic page on the site, already
 *     shipped, already caching its own outage.
 *
 *     Those sites are fixed (`pages/[lang]/index.astro` and its four homepage
 *     sections, `autores/[slug]`, `destinos/lugar/[slug]`) but they are fixed
 *     by hand, NOT by this guard. Adding a fail-soft signal here was measured
 *     and rejected: 65 cacheable files, 9 with an unpoliced fail-soft, 6 of
 *     them unmarked — and every one of those 6 swallows a DECORATION (a
 *     bookmark counter, a related-posts strip) on a detail page whose primary
 *     fetch succeeded. Demoting those would cost the edge cache HOS-369 built
 *     for no user-visible gain, and exempting them one by one would be the
 *     fail-open this file refuses elsewhere.
 *
 *     The line that actually separates them is semantic, so write it down
 *     rather than pretend a regex draws it: **a fail-soft that makes the page
 *     ASSERT SOMETHING FALSE is a degradation** ("este autor no tiene
 *     publicaciones", an empty home, "nothing nearby"); **one that omits a
 *     decoration is not**. A new page in the first category is not caught here
 *     — it is caught in review, by someone who read this paragraph.
 *   - A failure state whose markup and variable names avoid the word "error"
 *     entirely (`<Oops>`, `const broken = …`).
 *   - It reads source text, so a component resolved dynamically
 *     (`const C = cond ? A : B; <C />`) is invisible to it.
 */
const ERROR_SURFACE_PATTERNS: ReadonlyArray<{ readonly name: string; readonly pattern: RegExp }> = [
    {
        name: 'element whose tag name contains "Error"',
        // `<ErrorBanner`, `<ApiErrorPanel`, `<Feedback.Error`. The trailing
        // class requires a real token boundary, so `<ErrorBannerish` still
        // matches (it is one too) but prose like "<Error" inside a word does
        // not run away with the rest of the line.
        pattern: /<\s*[A-Za-z0-9_$.]*[Ee]rror[A-Za-z0-9_$.]*[\s/>]/
    },
    {
        name: 'an error-state flag',
        pattern: /\b(?:has|is|show|had|render|renders|load|fetch|got|with)Error\b/
    },
    {
        name: 'an error-state variable',
        pattern: /\berrorState\b|\berrorBanner\b/
    },
    {
        name: 'the ARIA role an error state announces itself with',
        pattern: /role\s*=\s*['"]alert['"]/
    }
];

/**
 * Whether a source file renders a user-visible failure state.
 *
 * @param params.source - Raw file contents.
 * @returns `true` when at least one error-surface signal is present.
 */
export function rendersErrorSurface({ source }: { readonly source: string }): boolean {
    return matchedErrorSurfaces({ source }).length > 0;
}

/**
 * Which error-surface signals a source file carries — the same answer as
 * {@link rendersErrorSurface}, itemised, so a guard failure can say WHY a file
 * was policed instead of leaving the reader to guess.
 *
 * @param params.source - Raw file contents.
 * @returns The names of every signal that matched.
 */
export function matchedErrorSurfaces({ source }: { readonly source: string }): readonly string[] {
    const code = stripComments({ source });
    return ERROR_SURFACE_PATTERNS.filter(({ pattern }) => pattern.test(code)).map(
        ({ name }) => name
    );
}

/**
 * The slice of source between a call's opening parenthesis and its matching
 * close, so an argument can be attributed to the call it belongs to rather than
 * to whatever happens to appear later in the file.
 *
 * Quote-aware but not a parser: it skips over `'…'`, `"…"` and `` `…` `` so a
 * parenthesis inside a string cannot unbalance the count. Template
 * interpolations are not descended into, which can only end the slice EARLY —
 * i.e. err towards reading fewer arguments, never towards reading a `false`
 * that belongs to some later call.
 *
 * @param params.code - Comment-stripped source.
 * @param params.openIndex - Index of the `(` that opens the call.
 * @returns The argument text, without the enclosing parentheses.
 */
export function sliceCallArguments({
    code,
    openIndex
}: {
    readonly code: string;
    readonly openIndex: number;
}): string {
    let depth = 0;
    let quote: string | null = null;

    for (let i = openIndex; i < code.length; i += 1) {
        const char = code[i] as string;

        if (quote !== null) {
            if (char === '\\') {
                i += 1;
                continue;
            }
            if (char === quote) quote = null;
            continue;
        }

        if (char === "'" || char === '"' || char === '`') {
            quote = char;
            continue;
        }
        if (char === '(') depth += 1;
        else if (char === ')') {
            depth -= 1;
            if (depth === 0) return code.slice(openIndex + 1, i);
        }
    }

    return code.slice(openIndex + 1);
}

/** Call sites that can hand a response to the shared cache. */
const CACHE_DECLARERS: ReadonlyArray<RegExp> = [
    /\bapplyCacheHeaders\s*\(/g,
    /\bbuildStaticCacheHeaders\s*\(/g
];

/**
 * Whether a source file can produce a shared-cacheable response.
 *
 * `applyCacheHeaders({ cacheable: false, … })` — the literal, decided at the
 * call site — is the ONE shape read as never-cacheable. Everything else,
 * including the `cacheable: someExpression(...)` every listing actually writes,
 * is read as "it might be": a static scan cannot evaluate the expression, and
 * "I could not tell" has to resolve to "police it" or the guard becomes an
 * escape hatch with a fail-open inside it.
 *
 * @param params.source - Raw file contents.
 * @returns `true` when some response this file produces may be shared-cacheable.
 */
export function mayBeEdgeCacheable({ source }: { readonly source: string }): boolean {
    const code = stripComments({ source });

    // A hand-written `Cache-Control`, judged by the sibling detector so the two
    // guards can never disagree about what "cacheable" means.
    if (classifyCacheControl({ source }).kind === 'cacheable') return true;

    for (const declarer of CACHE_DECLARERS) {
        // Fresh lastIndex per file: these are module-level /g regexes.
        declarer.lastIndex = 0;
        let match = declarer.exec(code);
        while (match !== null) {
            const openIndex = code.indexOf('(', match.index);
            if (openIndex === -1) return true;
            const args = sliceCallArguments({ code, openIndex });
            if (!/\bcacheable\s*:\s*false\b/.test(args)) return true;
            match = declarer.exec(code);
        }
    }

    return false;
}

/** The one call that withdraws shared cacheability from a degraded render. */
const DEGRADATION_MARKER = /\bmarkResponseDegraded\s*\(/;

/**
 * Where the marker is DECLARED rather than called.
 *
 * Removed before the call is looked for, and this is load-bearing rather than
 * tidy. `markResponseDegraded` is defined in `lib/cache/response-cache.ts` —
 * the same module that exports `applyCacheHeaders`, which every cacheable page
 * imports. Without this, the traversal walks one hop into that module, finds
 * the function SIGNATURE, and reports the marker "reached" for every page in
 * the app. The rule then passes unconditionally and the guard watches nothing.
 *
 * That is not a hypothetical: this detector shipped with the bug and was caught
 * by mutation — deleting the call from `ErrorBanner.astro` left the violation
 * list empty. The `defining module does not count as calling` test below is the
 * regression.
 */
const DEGRADATION_MARKER_DECLARATION =
    /\b(?:export\s+)?(?:async\s+)?function\s+markResponseDegraded\s*\(|\b(?:export\s+)?const\s+markResponseDegraded\s*=/g;

/**
 * Whether a source file actually CALLS the degradation marker.
 *
 * Declaring it does not count, and neither does importing it: the import
 * binding carries no parenthesis, so only an invocation matches.
 *
 * @param params.source - Raw file contents.
 * @returns `true` when the marker is called in this file.
 */
export function marksDegradedResponse({ source }: { readonly source: string }): boolean {
    const code = stripComments({ source }).replace(DEGRADATION_MARKER_DECLARATION, ' ');
    return DEGRADATION_MARKER.test(code);
}

/**
 * A marker call that opens its own statement, i.e. one that runs on EVERY render
 * of the file that contains it.
 *
 * The distinction decides whether a component may CERTIFY the pages that render
 * it. `components/ErrorBanner.astro` marks behind `if (variant === 'error')`,
 * which is right at runtime — `warning`/`info` are advisory notes on content
 * that rendered fine — but it means rendering that component is not by itself
 * proof that anything was marked. Counting it would let a page render
 * `<ErrorBanner variant="info">`, satisfy this guard, and then draw its real
 * failure some other way with nothing to demote it.
 *
 * So only an unconditional call certifies. A component whose marking is
 * conditional is still correct, still protects its own error variant at
 * runtime, and simply cannot vouch for its callers — the caller has to arrange
 * its own demotion, and until it does this guard says so.
 *
 * Anchored to the start of a statement (line start, or after `{`/`;`) so
 * `if (x) markResponseDegraded(…)` and `x && markResponseDegraded(…)` do not
 * match while an ordinary top-level call does.
 */
const UNCONDITIONAL_DEGRADATION_MARKER = /(?:^|[{};])\s*markResponseDegraded\s*\(/m;

/**
 * Whether a source file marks the response on EVERY render of it.
 *
 * @param params.source - Raw file contents.
 * @returns `true` when the file carries an unconditional marker call.
 */
export function marksDegradedResponseUnconditionally({
    source
}: {
    readonly source: string;
}): boolean {
    const code = stripComments({ source }).replace(DEGRADATION_MARKER_DECLARATION, ' ');
    return UNCONDITIONAL_DEGRADATION_MARKER.test(code);
}

/**
 * Local bindings an `import` statement introduces, paired with its specifier:
 * `import X from '…'`, `import X, { A } from '…'`, `import { A as B } from '…'`.
 *
 * The NAME is what makes render-based reachability possible — without it there
 * is no way to tell an imported component that is rendered from one that is
 * merely imported.
 */
const IMPORT_BINDING = /\bimport\s+([^;]*?)\s+from\s*['"]([^'"]+)['"]/g;

/**
 * Component names this source actually RENDERS.
 *
 * Only capitalised tags, which is how Astro and JSX distinguish a component
 * from an HTML element. For a namespaced tag (`<Feedback.Error />`) the base
 * binding is what the import introduced, so that is what is returned.
 *
 * @param params.source - Raw file contents.
 * @returns The distinct component binding names appearing as elements.
 */
export function renderedComponentNames({
    source
}: {
    readonly source: string;
}): ReadonlySet<string> {
    const code = stripComments({ source });
    const names = new Set<string>();
    for (const match of code.matchAll(/<\s*([A-Z][A-Za-z0-9_$]*)(?:\.[A-Za-z0-9_$]+)*[\s/>]/g)) {
        const name = match[1];
        if (name !== undefined) names.add(name);
    }
    return names;
}

/**
 * The local bindings a file imports from inside `src`, keyed by the name the
 * file refers to them by.
 *
 * @param params.source - Raw file contents.
 * @param params.fromFile - Absolute path of the importing file.
 * @param params.srcRoot - Absolute path of `apps/web/src`.
 * @param params.fileExists - Existence predicate, injectable for tests.
 * @returns A map from local binding name to the resolved absolute path.
 */
export function localImportBindings({
    source,
    fromFile,
    srcRoot,
    fileExists
}: {
    readonly source: string;
    readonly fromFile: string;
    readonly srcRoot: string;
    readonly fileExists?: (target: string) => boolean;
}): ReadonlyMap<string, string> {
    const code = stripComments({ source });
    const bindings = new Map<string, string>();

    IMPORT_BINDING.lastIndex = 0;
    let match = IMPORT_BINDING.exec(code);
    while (match !== null) {
        const clause = match[1] ?? '';
        const specifier = match[2] ?? '';
        const resolved = resolveLocalImport({ specifier, fromFile, srcRoot, fileExists });
        if (resolved !== null) {
            // Default binding: everything before the first `{` or `,`.
            const defaultName = clause.split(/[,{]/)[0]?.trim();
            if (defaultName !== undefined && /^[A-Za-z_$][\w$]*$/.test(defaultName)) {
                bindings.set(defaultName, resolved);
            }
            // Named bindings, honouring `as` renames — the LOCAL name is what
            // the template writes, so it is the one that must be keyed.
            const named = clause.match(/\{([^}]*)\}/)?.[1] ?? '';
            for (const entry of named.split(',')) {
                const local = entry.includes(' as ')
                    ? entry.split(' as ')[1]?.trim()
                    : entry.trim();
                if (local !== undefined && /^[A-Za-z_$][\w$]*$/.test(local)) {
                    bindings.set(local, resolved);
                }
            }
        }
        match = IMPORT_BINDING.exec(code);
    }

    return bindings;
}

/** Extension candidates tried, in order, when resolving a specifier to a file. */
const RESOLUTION_SUFFIXES: readonly string[] = [
    '',
    '.ts',
    '.tsx',
    '.astro',
    '.js',
    '/index.ts',
    '/index.tsx',
    '/index.astro'
];

/**
 * Resolve one import specifier to a file inside this app's `src`, or `null` for
 * anything outside it (a package, a virtual module, a type-only alias).
 *
 * Only local graph edges matter here: the marker lives in `src/lib/cache`, so a
 * path that leaves `src` cannot lead to it.
 *
 * @param params.specifier - The raw specifier as written.
 * @param params.fromFile - Absolute path of the importing file.
 * @param params.srcRoot - Absolute path of `apps/web/src`, the `@/` alias root.
 * @param params.fileExists - Existence predicate, injectable so the resolution
 *   rules can be exercised on a synthetic graph rather than on the repo.
 * @returns The resolved absolute path, or `null`.
 */
export function resolveLocalImport({
    specifier,
    fromFile,
    srcRoot,
    fileExists = (target: string) => fs.existsSync(target) && fs.statSync(target).isFile()
}: {
    readonly specifier: string;
    readonly fromFile: string;
    readonly srcRoot: string;
    readonly fileExists?: (target: string) => boolean;
}): string | null {
    let base: string;
    if (specifier.startsWith('@/')) base = path.join(srcRoot, specifier.slice(2));
    else if (specifier.startsWith('./') || specifier.startsWith('../'))
        base = path.resolve(path.dirname(fromFile), specifier);
    else return null;

    // `.js` specifiers that mean a `.ts` source (the app writes both).
    const candidates = base.endsWith('.js')
        ? [base, `${base.slice(0, -3)}.ts`, `${base.slice(0, -3)}.tsx`]
        : RESOLUTION_SUFFIXES.map((suffix) => `${base}${suffix}`);

    for (const candidate of candidates) {
        if (fileExists(candidate)) return candidate;
    }
    return null;
}

/**
 * Whether a file's response is demoted when it renders — either because the
 * file marks the response itself, or because it RENDERS a component that always
 * does.
 *
 * ## Why this follows renders and not imports
 *
 * The first version of this walked every local import. It passed the whole
 * repo, and it was wrong in a way that matters more than the definition bug it
 * replaced: an import is not a render. A page that imports `ErrorBanner` was
 * certified for as long as the import line survived, whatever the template
 * actually drew.
 *
 * That is not a contrived shape, it is what a refactor looks like. Measured on
 * `pages/[lang]/gastronomia/index.astro` — the page HOS-1154 itself measured —
 * replacing
 *
 *     {hasError && !result.ok && <ErrorBanner … />}
 *
 * with an inline `<p class="load-failure" role="alert">…</p>` and leaving the
 * import alone put the public `Cache-Control` straight back on the error
 * response, and all three nets missed it: this guard and the middleware suite
 * gave `45 passed`, `biome check` reported `Checked 0 files` because `.astro`
 * is excluded from Biome by configuration, and `astro check` reported
 * `0 errors, 0 warnings` because an unused import is only a `ts(6133)` hint.
 * The dead import was not even a warning.
 *
 * So the question this answers is "does something that RUNS on this render
 * demote the response", which is the property the fix actually depends on.
 * Recursion is over rendered components too, so a banner behind a wrapper still
 * counts.
 *
 * Only an UNCONDITIONAL marker call in a rendered component certifies its
 * caller — see {@link marksDegradedResponseUnconditionally}. The file's OWN
 * call may be conditional, because a page that marks inside its failure branch
 * is marking exactly when it should.
 *
 * @param params.file - Absolute path of the file to start from.
 * @param params.srcRoot - Absolute path of `apps/web/src`.
 * @param params.readFile - File reader, injectable so the traversal can be
 *   exercised on synthetic graphs.
 * @param params.fileExists - Existence predicate, injected together with
 *   `readFile` for the same reason.
 * @returns `true` when this render demotes its own response.
 */
export function reachesDegradationMarker({
    file,
    srcRoot,
    readFile = (target: string) => fs.readFileSync(target, 'utf8'),
    fileExists
}: {
    readonly file: string;
    readonly srcRoot: string;
    readonly readFile?: (target: string) => string;
    readonly fileExists?: (target: string) => boolean;
}): boolean {
    const seen = new Set<string>();

    /** @param current - Absolute path of the file being examined. */
    const visit = (current: string, isEntry: boolean): boolean => {
        if (seen.has(current)) return false;
        seen.add(current);

        let source: string;
        try {
            source = readFile(current);
        } catch {
            return false;
        }

        // The entry file may mark conditionally — a page marking inside its own
        // failure branch is marking exactly when it should. A component vouching
        // for its CALLER must mark on every render of itself.
        const marks = isEntry
            ? marksDegradedResponse({ source })
            : marksDegradedResponseUnconditionally({ source });
        if (marks) return true;

        const rendered = renderedComponentNames({ source });
        if (rendered.size === 0) return false;

        const bindings = localImportBindings({
            source,
            fromFile: current,
            srcRoot,
            fileExists
        });

        for (const name of rendered) {
            const target = bindings.get(name);
            if (target !== undefined && visit(target, false)) return true;
        }
        return false;
    };

    return visit(file, true);
}

/**
 * Whether a file is POLICED by this guard: it can be shared-cacheable and it
 * can render a failure state, so its error response is a candidate for the edge
 * cache.
 *
 * @param params.source - Raw file contents.
 * @returns `true` when both halves hold.
 */
export function isPolicedFile({ source }: { readonly source: string }): boolean {
    return mayBeEdgeCacheable({ source }) && rendersErrorSurface({ source });
}
