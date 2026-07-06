/**
 * @file env-schema-purity.guard.test.ts
 * @description Guards the "pure schema" contract (HOS-79 §6, Risk R-4) for the
 * four per-app `*-env-schema.ts` files:
 *
 *   - apps/api/src/utils/env-schema.ts
 *   - apps/web/src/env-schema.ts
 *   - apps/admin/src/env-schema.ts
 *   - apps/mobile/src/lib/env-schema.ts
 *
 * These files were extracted specifically so a plain root-level Node/tsx
 * script (no dotenv bootstrap, no Vite/Metro bundler) can `import` an app's
 * REAL Zod env schema for introspection — e.g. the HOS-79 registry-JSON
 * generator (`scripts/generate-env-registry-json.ts`). That only works if
 * each file imports EXCLUSIVELY from `zod` — no `@repo/logger`, no `dotenv`,
 * no Vite-only `@/` path aliases, no `expo-constants`, nothing else.
 *
 * This test lives in `packages/config` (not the 4 individual apps) for the
 * same reason `env-examples.guard.test.ts` in this same directory reaches
 * into every app's `.env.example`: it is a single cross-app invariant, so one
 * guard covering all 4 apps is less surprising than 4 near-identical guards
 * scattered across app test suites. It re-implements a tiny regex-based
 * import scanner inline (same convention `env-examples.guard.test.ts` already
 * uses for the generator logic) rather than importing a shared parser.
 *
 * A future edit that re-introduces a non-zod import into one of these 4
 * files (e.g. someone "temporarily" adding a logger call for debugging) will
 * fail this test instead of silently breaking the VPS-side JSON generation.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(import.meta.dirname, '../../../..');

/** The 4 pure per-app env schema files this guard protects. */
const PURE_SCHEMA_FILES: ReadonlyArray<{ readonly app: string; readonly path: string }> = [
    { app: 'api', path: resolve(ROOT, 'apps/api/src/utils/env-schema.ts') },
    { app: 'web', path: resolve(ROOT, 'apps/web/src/env-schema.ts') },
    { app: 'admin', path: resolve(ROOT, 'apps/admin/src/env-schema.ts') },
    { app: 'mobile', path: resolve(ROOT, 'apps/mobile/src/lib/env-schema.ts') }
];

/** Module specifiers considered "pure" — only the zod package itself. */
const ALLOWED_MODULE_SPECIFIERS = new Set<string>(['zod']);

/**
 * Extracts every static `import ... from '<specifier>'` module specifier from
 * TypeScript source text, plus side-effect-only `import '<specifier>';` forms.
 * Deliberately simple (regex-based, no AST) — matches the existing
 * `env-examples.guard.test.ts` convention of re-implementing minimal parsing
 * logic inline rather than pulling in a shared parser dependency.
 */
function extractImportSpecifiers(source: string): string[] {
    const specifiers: string[] = [];

    // `import ... from 'specifier'` (covers default, named, namespace, type-only)
    const fromImportRe = /^\s*import\s+(?:type\s+)?.+?\s+from\s+['"]([^'"]+)['"];?\s*$/gm;
    for (const match of source.matchAll(fromImportRe)) {
        const specifier = match[1];
        if (specifier) specifiers.push(specifier);
    }

    // Side-effect-only `import 'specifier';`
    const sideEffectImportRe = /^\s*import\s+['"]([^'"]+)['"];?\s*$/gm;
    for (const match of source.matchAll(sideEffectImportRe)) {
        const specifier = match[1];
        if (specifier) specifiers.push(specifier);
    }

    return specifiers;
}

describe('env schema purity guard (HOS-79 Risk R-4)', () => {
    for (const { app, path } of PURE_SCHEMA_FILES) {
        it(`${app}'s env-schema.ts should import ONLY from 'zod'`, () => {
            const source = readFileSync(path, 'utf-8');
            const specifiers = extractImportSpecifiers(source);

            expect(
                specifiers.length,
                `${path} has no static imports at all — expected at least the 'zod' import.`
            ).toBeGreaterThan(0);

            const disallowed = specifiers.filter((s) => !ALLOWED_MODULE_SPECIFIERS.has(s));

            expect(
                disallowed,
                `${path} imports from non-zod module(s): ${disallowed.join(', ')}.\n\nThis file MUST import ONLY from 'zod' so a plain root-level script can safely import it for introspection (HOS-79). Move any side-effect or app-specific logic (logging, dotenv, path aliases, expo-constants, etc.) into the app's env.ts instead.`
            ).toHaveLength(0);
        });
    }
});
