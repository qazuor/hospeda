/**
 * @file cache-class-matches-tag.test.ts
 * @description A page's cache class agrees with the tag it declares (HOS-426).
 *
 * WHAT THIS GUARD DOES NOT DO, because something else already does it: assert
 * that every `applyCacheHeaders` call passes a `cacheClass`, or that the value
 * is one of the five valid classes. `cacheClass` is a REQUIRED parameter typed
 * as `CacheClass`, and `astro check` runs in CI, so both of those are compile
 * errors. A test re-asserting them would only confirm what the compiler already
 * proves.
 *
 * WHAT IT DOES DO is the part no type can express: whether the class a page
 * declared is the class its invalidation mechanism implies. The freshness
 * budget only makes sense if it matches what can actually change the page, and
 * the honest signal for that is the cache tag — `site-config` means "only a
 * deploy changes this", `pricing` means "a plan write changes this". A page
 * that copies its `applyCacheHeaders` call from a neighbour of a different kind
 * compiles perfectly and then gets the wrong staleness budget, silently, until
 * someone notices stale content or an origin bill.
 *
 * THE PREDICATE IS A BICONDITIONAL OVER THREE CLASSES, NOT FIVE. `static`,
 * `home` and `pricing` each map 1:1 to a distinctive tag, in both directions:
 * declaring the tag requires the class, and declaring the class requires the
 * tag. `catalog` and `detail` are deliberately NOT checked — a listing scoped
 * to one entity (`destinos/[slug]/eventos/`) legitimately carries both a
 * collection tag and that entity's tags, so no source-level rule separates them
 * from a detail page without lying. Telling those two apart is a judgment the
 * §5.2 table in the spec records and a reviewer makes; this guard does not
 * claim to.
 *
 * FAILURE MODE IS FAIL-CLOSED AND NOISY, by choice. The scan reads the call's
 * argument text verbatim, comments included, so a comment mentioning
 * `CACHE_TAG_HOME` inside an `applyCacheHeaders` call would demand the `home`
 * class and fail. That is the safe direction: a false alarm is read and
 * dismissed by a human, whereas stripping comments to avoid it risks eating the
 * code under test — this repo has already been bitten by a comment-stripping
 * guard that did exactly that.
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const PAGES_DIR = path.resolve(__dirname, '../../src/pages');

/**
 * Tags that pin a class, in both directions.
 *
 * Read as: a call whose arguments mention this token MUST declare this class,
 * and a call declaring this class MUST mention this token.
 */
const TAG_TO_REQUIRED_CLASS = [
    { token: 'CACHE_TAG_SITE_CONFIG', cacheClass: 'static' },
    { token: 'CACHE_TAG_HOME', cacheClass: 'home' },
    { token: 'CACHE_TAG_PRICING', cacheClass: 'pricing' }
] as const;

/** One `applyCacheHeaders(...)` call found in the tree. */
interface CacheCall {
    /** Path relative to `src/pages`, for a readable failure message. */
    readonly file: string;
    /** The call's argument text, verbatim. */
    readonly args: string;
}

/**
 * Collect every file under a directory whose extension is scanned.
 *
 * @param params.dir - Directory to walk.
 * @returns Absolute paths.
 */
function collectSourceFiles({ dir }: { readonly dir: string }): readonly string[] {
    const found: string[] = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            found.push(...collectSourceFiles({ dir: full }));
            continue;
        }
        if (entry.name.endsWith('.astro') || entry.name.endsWith('.ts')) found.push(full);
    }
    return found;
}

/**
 * Extract the argument text of every `applyCacheHeaders(` call in a source
 * string, by balancing parentheses from the opening one.
 *
 * Balancing rather than a regex because the argument is a multi-line object
 * literal containing nested calls (`buildEntityCacheTags({ … })`), which a
 * non-greedy regex truncates at the first `)` and a greedy one runs past.
 *
 * @param params.source - File contents.
 * @returns The argument text of each call, in source order.
 */
function extractCallArguments({ source }: { readonly source: string }): readonly string[] {
    const calls: string[] = [];
    const needle = 'applyCacheHeaders(';

    let searchFrom = 0;
    while (true) {
        const start = source.indexOf(needle, searchFrom);
        if (start === -1) break;

        // An import line mentions the name without opening a call with an
        // argument; skip anything whose match is part of `import {`.
        const openParen = start + needle.length - 1;
        let depth = 0;
        let end = -1;
        for (let i = openParen; i < source.length; i += 1) {
            const char = source[i];
            if (char === '(') depth += 1;
            else if (char === ')') {
                depth -= 1;
                if (depth === 0) {
                    end = i;
                    break;
                }
            }
        }
        if (end === -1) break;

        calls.push(source.slice(openParen + 1, end));
        searchFrom = end;
    }

    return calls;
}

/** Every `applyCacheHeaders` call under `src/pages`, collected once. */
const CACHE_CALLS: readonly CacheCall[] = collectSourceFiles({ dir: PAGES_DIR }).flatMap((file) => {
    const source = fs.readFileSync(file, 'utf8');
    return extractCallArguments({ source }).map((args) => ({
        file: path.relative(PAGES_DIR, file),
        args
    }));
});

/**
 * Read the class literal a call declares.
 *
 * @param params.args - The call's argument text.
 * @returns The declared class, or `null` when it is not a plain literal.
 */
function declaredClassOf({ args }: { readonly args: string }): string | null {
    const match = args.match(/cacheClass:\s*'([a-z]+)'/);
    return match?.[1] ?? null;
}

describe('cache class matches the declared tag', () => {
    it('finds the call sites it is meant to guard', () => {
        // A scan that silently matched nothing reads exactly like a clean pass.
        // The floor is deliberately loose — it exists to catch a broken walk or
        // a renamed function, not to pin a count that grows with the app.
        expect(CACHE_CALLS.length).toBeGreaterThan(30);
    });

    it.each(
        TAG_TO_REQUIRED_CLASS
    )('every call declaring $token also declares cacheClass "$cacheClass"', ({
        token,
        cacheClass
    }) => {
        const offenders = CACHE_CALLS.filter(
            (call) =>
                call.args.includes(token) && declaredClassOf({ args: call.args }) !== cacheClass
        ).map((call) => `${call.file} declares ${declaredClassOf({ args: call.args })}`);

        expect(offenders, `${token} pins the "${cacheClass}" class`).toEqual([]);
    });

    it.each(
        TAG_TO_REQUIRED_CLASS
    )('every call declaring cacheClass "$cacheClass" also declares $token', ({
        token,
        cacheClass
    }) => {
        const offenders = CACHE_CALLS.filter(
            (call) =>
                declaredClassOf({ args: call.args }) === cacheClass && !call.args.includes(token)
        ).map((call) => call.file);

        expect(
            offenders,
            `the "${cacheClass}" class is only correct for a response tagged ${token}`
        ).toEqual([]);
    });
});
