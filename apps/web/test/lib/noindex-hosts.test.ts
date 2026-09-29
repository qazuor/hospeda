/**
 * @file noindex-hosts.test.ts
 * @description `parseNoindexHosts` behaviour, and the import boundary that
 * keeps the lightweight endpoints off `middleware-helpers.ts`.
 *
 * The boundary half is a regression guard. `robots.txt` once imported this
 * parser from `middleware-helpers.ts`, whose graph (Sentry, `@repo/media` and,
 * since HOS-807, the icon sprite with every `@repo/icons` glyph) made the first
 * `import()` of the route cost ~10s under vitest and time out two static guards
 * in CI. Nothing about the parser needs that graph.
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseNoindexHosts as reExported } from '../../src/lib/middleware-helpers';
import { parseNoindexHosts } from '../../src/lib/noindex-hosts';

const WEB_SRC = path.resolve(__dirname, '../../src');

/** Endpoints that need only the parser and must not load the middleware graph. */
const LIGHTWEIGHT_ENDPOINTS = [
    'pages/robots.txt.ts',
    'pages/llms.txt.ts',
    'pages/api/indexnow.ts'
] as const;

/** Matches a static or dynamic import of `middleware-helpers` by alias or relative path. */
const MIDDLEWARE_HELPERS_IMPORT =
    /(?:from\s+|import\s*\(\s*)['"](?:@\/lib\/|(?:\.\.?\/)+(?:lib\/)?)middleware-helpers(?:\.js|\.ts)?['"]/;

describe('parseNoindexHosts', () => {
    it('falls back to the staging host when the value is missing or blank', () => {
        expect(parseNoindexHosts(undefined)).toStrictEqual(['staging.hospeda.com.ar']);
        expect(parseNoindexHosts('')).toStrictEqual(['staging.hospeda.com.ar']);
        expect(parseNoindexHosts('   ')).toStrictEqual(['staging.hospeda.com.ar']);
    });

    it('trims, lowercases, drops empty parts and deduplicates', () => {
        expect(
            parseNoindexHosts(
                ' Staging.Hospeda.com.ar , ,preview.hospeda.com.ar,STAGING.hospeda.com.ar'
            )
        ).toStrictEqual(['staging.hospeda.com.ar', 'preview.hospeda.com.ar']);
    });

    it('is the same function middleware-helpers re-exports (one parser, not two)', () => {
        expect(reExported).toBe(parseNoindexHosts);
    });
});

describe('lightweight endpoints stay off the middleware graph', () => {
    it('the detector recognises every import form it must reject (non-vacuity)', () => {
        expect(
            MIDDLEWARE_HELPERS_IMPORT.test("import { x } from '@/lib/middleware-helpers';")
        ).toBe(true);
        expect(
            MIDDLEWARE_HELPERS_IMPORT.test("import { x } from '../lib/middleware-helpers.js';")
        ).toBe(true);
        expect(MIDDLEWARE_HELPERS_IMPORT.test("await import('../../lib/middleware-helpers')")).toBe(
            true
        );
        expect(MIDDLEWARE_HELPERS_IMPORT.test("import { x } from '@/lib/noindex-hosts';")).toBe(
            false
        );
    });

    it.each(LIGHTWEIGHT_ENDPOINTS)('%s does not import middleware-helpers', (file) => {
        const source = fs.readFileSync(path.join(WEB_SRC, file), 'utf8');

        expect(source).toContain('parseNoindexHosts');
        expect(MIDDLEWARE_HELPERS_IMPORT.test(source)).toBe(false);
    });
});
