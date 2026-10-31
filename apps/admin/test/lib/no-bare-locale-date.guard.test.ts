/**
 * @file no-bare-locale-date.guard.test.ts
 * @description HOS-1941 - a date must be formatted with the APP's locale.
 *
 * `date.toLocaleDateString()` (and `toLocaleTimeString()`, and `toLocaleString()`
 * on a `Date`) with no argument formats with the BROWSER's language, not the
 * admin's. An operator on `navigator.language = "es-US"` read `10/28/2026` in a
 * Spanish interface while the next field on the same screen read `8/9/2026`.
 *
 * Use the shared formatters in `@/lib/format-helpers` and pass the `locale`
 * from `useTranslations()`.
 *
 * Scope, on purpose: only the zero-argument date forms. A bare
 * `number.toLocaleString()` has the same browser dependence but is a separate
 * family (digit grouping) and is not asserted here.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC_DIR = resolve(HERE, '../../src');

/** `x.toLocaleDateString()` / `x.toLocaleTimeString()` with an empty argument list. */
const BARE_DATE_OR_TIME = /\.toLocale(?:Date|Time)String\(\s*\)/g;
/** `new Date(...).toLocaleString()` with an empty argument list. */
const BARE_DATE_STRING = /new Date\([^()]*(?:\([^()]*\)[^()]*)*\)\.toLocaleString\(\s*\)/g;

/**
 * Every `.ts`/`.tsx` file under `apps/admin/src`.
 *
 * @param dir - Directory to walk.
 * @returns Absolute file paths.
 */
function collectSourceFiles(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) {
            out.push(...collectSourceFiles(full));
        } else if (/\.tsx?$/.test(entry) && entry !== 'routeTree.gen.ts') {
            out.push(full);
        }
    }
    return out;
}

/**
 * Finds the bare date-locale calls in one source text.
 *
 * @param input - Wrapper object.
 * @param input.source - File contents.
 * @returns The offending snippets.
 */
function findBareLocaleDates({ source }: { readonly source: string }): string[] {
    // Comment lines may quote the bad form while explaining why it is bad.
    const code = source
        .split('\n')
        .filter((line) => !/^\s*(?:\*|\/\/|\/\*)/.test(line))
        .join('\n');
    return [...(code.match(BARE_DATE_OR_TIME) ?? []), ...(code.match(BARE_DATE_STRING) ?? [])];
}

describe('no bare toLocale*String() on dates in the admin (HOS-1941)', () => {
    it('the detector flags the bare forms and ignores explicit-locale ones', () => {
        expect(findBareLocaleDates({ source: 'a.toLocaleDateString()' })).toHaveLength(1);
        expect(findBareLocaleDates({ source: 'a.toLocaleTimeString( )' })).toHaveLength(1);
        expect(
            findBareLocaleDates({ source: 'new Date(x as string).toLocaleString()' })
        ).toHaveLength(1);
        expect(findBareLocaleDates({ source: "a.toLocaleDateString('es-AR')" })).toHaveLength(0);
        expect(findBareLocaleDates({ source: 'count.toLocaleString()' })).toHaveLength(0);
        expect(findBareLocaleDates({ source: ' * use a.toLocaleDateString() here' })).toHaveLength(
            0
        );
    });

    it('no source file formats a date with the browser locale', () => {
        const offenders = collectSourceFiles(SRC_DIR).flatMap((file) =>
            findBareLocaleDates({ source: readFileSync(file, 'utf8') }).map(
                (snippet) => `${relative(SRC_DIR, file)}: ${snippet}`
            )
        );

        expect(offenders).toEqual([]);
    });
});
