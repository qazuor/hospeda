/**
 * @file safe-external-url.guard.test.ts
 * @description Static guard (HOS-703): the http/https scheme allow-list has ONE
 * declaration in this package, `common/safe-external-url.schema.ts`. Any other
 * hand-written scheme check is a second copy that drifts from the one
 * `apps/web` also reads. Three shapes are caught:
 *
 * - a `protocol: /^https?/` regex handed to Zod,
 * - a `.startsWith('http...')` prefix test,
 * - a `new RegExp('^https?...')` built by hand.
 *
 * `HTTPS_ONLY_EXEMPTIONS` lists the files that legitimately require HTTPS
 * ONLY. That is a deliberately stricter rule than the http/https allow-list
 * (a menu link or an iCal feed the server fetches must not be plain http), not
 * a copy of it, so each entry states why.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = join(__dirname, '../../src');
const SOURCE_OF_TRUTH = 'common/safe-external-url.schema.ts';

/** Shapes of a hand-written scheme check. */
const SCHEME_CHECKS: readonly RegExp[] = [
    /protocol:\s*\/\^?\(?https?/,
    /\.startsWith\(\s*['"`]https?:/,
    /new RegExp\(\s*['"`]\^\(?https?/
];

/** Files whose `startsWith('https://')` is an HTTPS-only rule, with the reason. */
const HTTPS_ONLY_EXEMPTIONS: Readonly<Record<string, string>> = Object.freeze({
    'entities/gastronomy/gastronomy.schema.ts':
        'menuUrl must be HTTPS only: stricter than the http/https allow-list, not a copy of it',
    'entities/gastronomy/gastronomy.http.schema.ts':
        'menuUrl input mirror of gastronomy.schema.ts (HTTPS only)',
    'entities/accommodation-calendar-sync/accommodation-calendar-sync.http.schema.ts':
        'iCal feedUrl is fetched server-side and must be HTTPS only'
});

function walk(dir: string): string[] {
    return readdirSync(dir).flatMap((entry) => {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) {
            return entry === '__tests__' ? [] : walk(full);
        }
        return full.endsWith('.ts') && !full.endsWith('.test.ts') ? [full] : [];
    });
}

const files = walk(SRC).map((file) => relative(SRC, file).split(sep).join('/'));

describe('scheme allow-list has a single declaration (HOS-703)', () => {
    it('no schema file hand-writes an http/https scheme check', () => {
        const offenders = files
            .filter((file) => file !== SOURCE_OF_TRUTH && !(file in HTTPS_ONLY_EXEMPTIONS))
            .filter((file) => {
                const source = readFileSync(join(SRC, file), 'utf8');
                return SCHEME_CHECKS.some((pattern) => pattern.test(source));
            });

        expect(
            offenders,
            'Use safeExternalUrl() / SAFE_EXTERNAL_URL_PROTOCOL from common/safe-external-url.schema.ts, ' +
                'or add an HTTPS_ONLY_EXEMPTIONS entry saying why this one is stricter.'
        ).toEqual([]);
    });

    it('every exemption still exists and still contains a scheme check', () => {
        for (const file of Object.keys(HTTPS_ONLY_EXEMPTIONS)) {
            expect(files, `${file} was renamed or removed`).toContain(file);
            const source = readFileSync(join(SRC, file), 'utf8');
            expect(
                SCHEME_CHECKS.some((pattern) => pattern.test(source)),
                `${file} no longer needs its exemption`
            ).toBe(true);
        }
    });

    it('the source of truth exists and declares the list', () => {
        const source = readFileSync(join(SRC, SOURCE_OF_TRUTH), 'utf8');
        expect(source).toContain("SAFE_EXTERNAL_URL_SCHEMES = ['http', 'https']");
    });
});
