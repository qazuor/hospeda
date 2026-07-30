/**
 * Guard: every `RoleEnum` value has a label in EVERY locale (HOS-296).
 *
 * This exists because nothing else catches a role that is missing from ALL
 * three locale files — which is exactly what happened to `COMMERCE_OWNER`:
 *
 * - `buildRoleLabelKey` interpolates the role into the key string and casts
 *   the result `as TranslationKey`, so the compiler cannot check it.
 * - `key-coverage.test.ts` only enforces es ↔ en/pt parity, so a role absent
 *   from all three passes.
 * - `UserRolesCard.test.tsx` stubs `t` to echo its argument, so it asserts on
 *   the KEY, never on a resolved label.
 *
 * The symptom of the gap is silent in every one of those layers and visible
 * only in the browser, as a raw dotted key rendered where a role name belongs.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { RoleEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { buildRoleLabelKey } from '@/features/users/utils/role-label';

const LOCALES = ['es', 'en', 'pt'] as const;

// Resolve locale JSON relative to the monorepo root — crossing the package
// boundary with a bare import is not reliable under Vite's ESM context.
const repoRoot = path.resolve(fileURLToPath(import.meta.url), '../../../../../..');
const i18nBase = path.join(repoRoot, 'packages/i18n/src/locales');

/** Reads `admin-pages.json` for one locale. */
const loadAdminPages = (locale: string): Record<string, unknown> =>
    JSON.parse(readFileSync(path.join(i18nBase, locale, 'admin-pages.json'), 'utf8'));

/** Resolves a dot-notation key against a nested object. */
const resolveKey = (params: { obj: Record<string, unknown>; key: string }): unknown =>
    params.key.split('.').reduce<unknown>((current, part) => {
        if (current && typeof current === 'object' && !Array.isArray(current)) {
            return (current as Record<string, unknown>)[part];
        }
        return undefined;
    }, params.obj);

describe('role label catalogue coverage (HOS-296)', () => {
    for (const locale of LOCALES) {
        const adminPages = loadAdminPages(locale);

        for (const role of Object.values(RoleEnum)) {
            it(`[${locale}] has a name for ${role}`, () => {
                // The key under test is the one the app actually builds, not a
                // literal re-written here — a change to `buildRoleLabelKey`
                // must break this test, not slip past it.
                const key = buildRoleLabelKey({ role });
                // The JSON has no `admin-pages` root object; the namespace IS
                // the filename.
                const withoutNamespace = key.replace(/^admin-pages\./, '');
                const value = resolveKey({ obj: adminPages, key: withoutNamespace });

                expect(typeof value, `missing i18n key "${key}" in ${locale}`).toBe('string');
                expect((value as string).trim().length).toBeGreaterThan(0);
            });
        }
    }
});
