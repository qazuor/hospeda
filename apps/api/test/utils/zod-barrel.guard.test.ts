/**
 * HOS-430: guards the invariants that keep `z` correctly typed and `.openapi()`
 * actually present at runtime.
 *
 * Three assertions, because the migration rests on three separate facts. Each
 * one was mutation-tested (deliberately broken, confirmed failing) before this
 * file was committed.
 *
 * 1. Nothing sources `z` from `@hono/zod-openapi`. Its re-export resolves to
 *    `any` as of 1.5.2, which silently untypes every schema built from it —
 *    no error, just a green build with no inference. This is the regression
 *    that motivated the whole change.
 *
 * 2. Any file that CALLS `.openapi()` sources `z` from the barrel. `.openapi()`
 *    is a monkey-patch applied to zod's prototype as an import side effect, but
 *    its type augmentation is global — so a file importing `z` straight from
 *    `zod` type-checks and then throws `.openapi is not a function` if it
 *    evaluates before anything imported `@hono/zod-openapi`. This assertion is
 *    deliberately narrow: importing `z` from `zod` is fine and 350+ files do
 *    it. It is only *calling `.openapi()`* on such an import that is unsafe.
 *
 * 3. The barrel keeps its side-effect import. That single line is what makes
 *    assertion 2's guarantee real; without it the barrel hands out an unpatched
 *    `z` and every consumer breaks at runtime.
 *
 * Known blind spot, stated rather than implied: this reads source text, so a
 * call built dynamically (`const m = 'openapi'; schema[m]({...})`) is invisible
 * to it, as is a `z` obtained through a re-export chain this file does not
 * follow. It proves nothing is *literally written* the unsafe way.
 *
 * @see HOS-430
 * @see apps/api/src/utils/zod.ts
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const API_ROOT = join(import.meta.dirname, '..', '..');
const BARREL_REL = join('src', 'utils', 'zod.ts');

/** Matches `import { z } from '@hono/zod-openapi'` and its `import type` form. */
const Z_FROM_HONO = /^import(?: type)? \{[^}]*\bz\b[^}]*\} from '@hono\/zod-openapi';/m;

/** Matches `import { z } from 'zod'` and its `import type` form. */
const Z_FROM_ZOD = /^import(?: type)? \{[^}]*\bz\b[^}]*\} from 'zod';/m;

/** Matches a `.openapi(` call. */
const OPENAPI_CALL = /\.openapi\(/;

/** Matches an import that brings the prototype patch into the module. */
const PATCH_SOURCE = /from '@hono\/zod-openapi'|import '@hono\/zod-openapi'|utils\/zod'/;

const SKIPPED_DIRS = new Set(['dist', 'coverage', 'test-results']);

/**
 * Every `.ts`/`.tsx` file under `src/` and `test/`, as `{ relPath, source }`.
 *
 * Walks the tree directly rather than pulling in a glob dependency, matching
 * the approach the repo's other static guards use.
 */
function readSourceFiles(): ReadonlyArray<{ readonly relPath: string; readonly source: string }> {
    const out: Array<{ relPath: string; source: string }> = [];

    const walk = (dir: string): void => {
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
            if (entry.isDirectory()) {
                if (SKIPPED_DIRS.has(entry.name) || entry.name.startsWith('.')) continue;
                walk(join(dir, entry.name));
                continue;
            }
            if (!/\.tsx?$/.test(entry.name)) continue;
            const full = join(dir, entry.name);
            out.push({
                relPath: full.slice(API_ROOT.length + 1),
                source: readFileSync(full, 'utf-8')
            });
        }
    };

    walk(join(API_ROOT, 'src'));
    walk(join(API_ROOT, 'test'));
    return out;
}

describe('HOS-430: zod barrel invariants', () => {
    it('no file sources `z` from @hono/zod-openapi', () => {
        const offenders = readSourceFiles()
            .filter(({ source }) => Z_FROM_HONO.test(source))
            .map(({ relPath }) => relPath);

        expect(
            offenders,
            `These files import \`z\` from @hono/zod-openapi: ${offenders.join(', ')}. ` +
                'That re-export resolves to `any` (1.5.2), so every schema built from it ' +
                'silently loses its type — the build stays green while inference ' +
                "disappears. Import from 'src/utils/zod' instead. See HOS-430."
        ).toHaveLength(0);
    });

    it('every file calling .openapi() sources `z` from the barrel', () => {
        const offenders = readSourceFiles()
            .filter(({ relPath }) => relPath !== BARREL_REL)
            .filter(
                ({ source }) =>
                    OPENAPI_CALL.test(source) &&
                    Z_FROM_ZOD.test(source) &&
                    !PATCH_SOURCE.test(source)
            )
            .map(({ relPath }) => relPath);

        expect(
            offenders,
            `These files call .openapi() on a \`z\` imported straight from 'zod': ` +
                `${offenders.join(', ')}. .openapi() is patched onto zod's prototype as ` +
                'an import side effect, but its type augmentation is global — so this ' +
                'compiles and then throws `.openapi is not a function` depending on module ' +
                "evaluation order. Import `z` from 'src/utils/zod' instead. See HOS-430."
        ).toHaveLength(0);
    });

    it('the barrel keeps the side-effect import that applies the patch', () => {
        const barrel = readFileSync(join(API_ROOT, BARREL_REL), 'utf-8');

        expect(
            /^import '@hono\/zod-openapi';$/m.test(barrel),
            "src/utils/zod.ts must keep its bare `import '@hono/zod-openapi';`. That line " +
                "is what applies .openapi() to zod's prototype; without it the barrel hands " +
                'out an unpatched `z` and every consumer throws at runtime. See HOS-430.'
        ).toBe(true);
    });
});
