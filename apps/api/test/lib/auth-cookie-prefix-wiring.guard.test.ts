/**
 * CI guard: Better Auth must name its session cookie per deployment (HOS-955).
 *
 * Staging and production scope the session cookie to the same apex domain
 * (`hospeda.com.ar`). The cookie NAME is the only thing that keeps the two
 * environments from overwriting each other's session in the browser, and it
 * comes from one line in the `betterAuth({ advanced })` config. Instantiating
 * Better Auth under test needs a live DB, so the wiring is asserted over the
 * source: the `advanced` block must set `cookiePrefix` from the shared
 * `@repo/config` resolver, fed by `HOSPEDA_DEPLOY_ENV` — the same input the web
 * app uses to recognize the cookie.
 *
 * @module test/lib/auth-cookie-prefix-wiring.guard.test
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const AUTH_SOURCE = readFileSync(join(__dirname, '../../src/lib/auth.ts'), 'utf8');

/**
 * Slice the `advanced: { ... }` block of the Better Auth config, from its
 * opening line up to the next sibling key (`databaseHooks:`).
 */
function sliceAdvancedBlock(source: string): string {
    const start = source.indexOf('\n        advanced: {');
    const end = source.indexOf('\n        databaseHooks: {', start);
    if (start === -1 || end === -1) return '';
    return source.slice(start, end);
}

describe('Better Auth cookie prefix wiring (HOS-955)', () => {
    const advanced = sliceAdvancedBlock(AUTH_SOURCE);

    it('finds the advanced block (the slicer is not vacuous)', () => {
        expect(advanced).toContain('crossSubDomainCookies');
        expect(advanced).not.toContain('databaseHooks');
    });

    it('sets cookiePrefix from the shared resolver, keyed on HOSPEDA_DEPLOY_ENV', () => {
        expect(advanced).toMatch(
            /^\s*cookiePrefix: resolveAuthCookiePrefix\(\{ deployEnv: env\.HOSPEDA_DEPLOY_ENV \}\),$/m
        );
    });

    it('imports the resolver from @repo/config, the source the web app also reads', () => {
        expect(AUTH_SOURCE).toMatch(
            /^import \{ resolveAuthCookiePrefix \} from '@repo\/config';$/m
        );
    });
});
