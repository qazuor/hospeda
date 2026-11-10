/**
 * TEST:7.3:R1 — `packages/service-core/src` never statically imports `@repo/i18n`.
 *
 * The barrel `@repo/i18n` imports every locale JSON file without import
 * attributes. Playwright strips import attributes from the modules it loads, so
 * native Node ESM then fails with
 * `needs an import attribute of "type: json"` before the first e2e test runs.
 * `src/services/billing/plan-display-name.ts` is the pattern to copy instead:
 * a lazy, per-subpath
 * `import('@repo/i18n/locales/<locale>/<namespace>.json', { with: { type: 'json' } })`.
 *
 * `import type` is allowed: TypeScript erases it at compile time, so it never
 * loads a JSON module. Dynamic `import()` calls are allowed for the same reason.
 * `export ... from '@repo/i18n'` is treated as static too, because a re-export
 * also evaluates the module at load time.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(__dirname, '../../../..');
const SOURCE_DIR = join(root, 'packages/service-core/src');

/**
 * A static binding or side-effect import/export naming `@repo/i18n`.
 *
 * `\s+` after `import` excludes `import(...)`; the `(?!type\b)` guard excludes
 * `import type` and `export type`, which erase at compile time. The specifier
 * stops at `;` or a quote, so one statement cannot swallow the next one.
 */
const STATIC_REFERENCE =
    /\b(?:import|export)\s+(?!type\b)(?:[^'"`;]*?\bfrom\s+)?['"]@repo\/i18n(?:\/[^'"]*)?['"]/;

function sourceFiles(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) return sourceFiles(path);
        return entry.isFile() && entry.name.endsWith('.ts') ? [path] : [];
    });
}

function violations(files: readonly { path: string; source: string }[]): string[] {
    return files
        .filter(({ source }) => STATIC_REFERENCE.test(source))
        .map(
            ({ path }) =>
                `${path}: static @repo/i18n import loads locale JSON (Playwright strips import attributes and native Node ESM crashes); use a lazy import('@repo/i18n/locales/<locale>/<namespace>.json', { with: { type: 'json' } }) like src/services/billing/plan-display-name.ts`
        );
}

describe('service-core static @repo/i18n import guard', () => {
    it('allows only lazy JSON subpath imports', () => {
        const files = sourceFiles(SOURCE_DIR).map((path) => ({
            path: relative(root, path).split(sep).join('/'),
            source: readFileSync(path, 'utf8')
        }));

        expect(files.length).toBeGreaterThan(0);
        expect(violations(files)).toEqual([]);
    });

    it('flags static imports and exports but allows dynamic and type-only imports', () => {
        const flagged = violations([
            {
                path: 'packages/service-core/src/static-import.ts',
                source: "import { trans } from '@repo/i18n';"
            },
            {
                path: 'packages/service-core/src/subpath-import.ts',
                source: "import { trans } from '@repo/i18n/web';"
            },
            {
                path: 'packages/service-core/src/side-effect.ts',
                source: "import '@repo/i18n';"
            },
            {
                path: 'packages/service-core/src/re-export.ts',
                source: "export { trans } from '@repo/i18n';"
            }
        ]);
        expect(flagged).toHaveLength(4);

        expect(
            violations([
                {
                    path: 'packages/service-core/src/type-only.ts',
                    source: "import type { Locale } from '@repo/i18n';"
                },
                {
                    path: 'packages/service-core/src/lazy.ts',
                    source: "const copy = import('@repo/i18n/locales/es/venue.json', {\n    with: { type: 'json' }\n});"
                }
            ])
        ).toEqual([]);
    });
});
