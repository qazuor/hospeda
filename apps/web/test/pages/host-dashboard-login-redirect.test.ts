/**
 * @file host-dashboard-login-redirect.test.ts
 * @description Source-level regression test (HOS-2418): the host dashboard's
 * unauthenticated redirect must carry a return URL so the user lands back on it.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
    resolve(__dirname, '../../src/pages/[lang]/mi-cuenta/host-dashboard.astro'),
    'utf8'
);

describe('mi-cuenta/host-dashboard.astro login redirect', () => {
    it('redirects guests through buildLoginRedirect with the current URL', () => {
        expect(source).toContain("import { buildLoginRedirect } from '@/lib/auth-redirect';");
        expect(source).toMatch(
            /buildLoginRedirect\(\{\s*locale,\s*currentUrl:\s*Astro\.url\.pathname \+ Astro\.url\.search\s*\}\)/
        );
        expect(source).not.toContain("path: 'auth/signin'");
    });
});
