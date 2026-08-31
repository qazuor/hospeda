/**
 * @file commerce-landing-cta.guard.test.ts
 * @description HOS-810 static guard — the three `.astro` files that make the
 * commerce navigation loop close, and the wiring between them.
 *
 * ## Why a guard, and what it can and cannot say
 *
 * The logic itself is unit-tested in `test/lib/commerce/start-url.test.ts` and
 * `test/lib/auth-redirect.test.ts`, where it can actually be executed. What no
 * runnable test can cover is whether the pages CALL it: Astro components do not
 * render under vitest, so the connection between `buildCommerceStartUrl` and
 * the `href` the landing ships is only visible in the source.
 *
 * This guard is therefore deliberately narrow. It asserts the wiring — the
 * import, the call, the vertical each landing passes, and the absence of the
 * bare `auth/signup` href the fix replaced. It does NOT and cannot claim the
 * rendered page contains any particular link; a test that read the whole file
 * and matched `/<a[\s\S]*?signup/` would "pass" on a file where the anchor and
 * the word live a thousand lines apart, which is worse than no test.
 *
 * The predicates anchor on the *token that cannot survive a revert* — the
 * `vertical: '<v>'` argument — rather than on a function name alone, so a
 * rename that drops the behaviour fails here instead of quietly passing.
 *
 * @module test/pages/commerce-landing-cta.guard
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const PAGES = resolve(__dirname, '../../src/pages/[lang]');
const LIB = resolve(__dirname, '../../src/lib');

const read = (relative: string): string => readFileSync(resolve(PAGES, relative), 'utf8');
const readLib = (relative: string): string => readFileSync(resolve(LIB, relative), 'utf8');

const experienceLanding = read('publicar-experiencia/index.astro');
const gastronomyLanding = read('publicar-restaurante/index.astro');
const signup = read('auth/signup.astro');
const signin = read('auth/signin.astro');

const LANDINGS: ReadonlyArray<{
    readonly label: string;
    readonly src: string;
    readonly vertical: string;
}> = [
    { label: 'publicar-experiencia', src: experienceLanding, vertical: 'experience' },
    { label: 'publicar-restaurante', src: gastronomyLanding, vertical: 'gastronomy' }
];

describe('HOS-810 — commerce landing CTA wiring', () => {
    it('guards both landings, not one', () => {
        // Non-vacuity: a one-element list would let the sibling regress unseen,
        // which is exactly how the gastronomy landing kept the old copy while
        // the experience one was being looked at.
        expect(LANDINGS).toHaveLength(2);
    });

    for (const { label, src, vertical } of LANDINGS) {
        describe(label, () => {
            it('imports the shared CTA builder', () => {
                expect(src).toContain(
                    "import { buildCommerceStartUrl } from '@/lib/commerce/start-url';"
                );
            });

            it(`builds its CTA for the ${vertical} vertical`, () => {
                expect(src).toContain(`buildCommerceStartUrl({ locale, vertical: '${vertical}' })`);
            });

            it('no longer links straight at the bare signup page', () => {
                // The exact expression the fix replaced. Its return would restore
                // the loop verbatim, so it is worth naming.
                expect(src).not.toContain("buildUrl({ locale, path: 'auth/signup' })");
            });

            it('feeds that value to the hero CTA button', () => {
                // Narrow on purpose: the assignment and the single `href={signupUrl}`
                // binding, not a span across the file.
                expect(src).toContain('const signupUrl = buildCommerceStartUrl(');
                expect(src).toContain('href={signupUrl}');
            });

            it('still parses no session — it stays edge-cacheable (HOS-690 AC-37)', () => {
                // The obvious alternative fix (branch on Astro.locals.user here)
                // would break `cacheable-routes-parse-no-session.guard.test.ts`
                // and personalise a shared-cache page. Keep it impossible.
                expect(src).not.toContain('Astro.locals.user');
            });
        });
    }
});

describe('HOS-810 — signup.astro honours the return destination', () => {
    it('reads returnUrl from the query string', () => {
        expect(signup).toContain("Astro.url.searchParams.get('returnUrl')");
    });

    it('accepts the legacy `redirect` alias too, mirroring signin', () => {
        expect(signup).toContain("Astro.url.searchParams.get('redirect')");
    });

    // HOS-959: `resolveSafeReturnPath` moved one hop further away — both
    // signin.astro and signup.astro now compute their redirect config via
    // the shared `resolveAuthTabsRedirectConfig` helper (which itself calls
    // `resolveSafeReturnPath` internally; see `test/lib/auth-tabs-config.test.ts`
    // for the BEHAVIORAL coverage of that predicate actually running — an
    // upgrade over what a source-string check here could ever prove). What
    // this guard can still assert is that signup.astro does not hand-copy a
    // second implementation of its own — it delegates to the one shared
    // helper, same as signin.astro.
    it('runs the raw value through the shared open-redirect guard (via resolveAuthTabsRedirectConfig)', () => {
        expect(signup).toContain(
            "import { resolveAuthTabsRedirectConfig } from '@/lib/auth-tabs-config';"
        );
        expect(signup).not.toContain("from '@/lib/auth-redirect'");
        expect(signup).toContain('resolveAuthTabsRedirectConfig(');
    });

    it('redirects an authenticated visitor to the resolved path, not a fixed one', () => {
        // HOS-959 addition: a validated callbackUrl now takes precedence
        // here too (mirroring signin.astro) — still a RESOLVED path, never
        // the fixed literal the guard forbids below.
        expect(signup).toContain('Astro.redirect(validatedCallbackUrl ?? returnPath)');
        // The literal it replaced. Restoring it re-closes the loop.
        expect(signup).not.toContain("Astro.redirect(buildUrl({ locale, path: 'mi-cuenta' }))");
    });

    it('forwards the destination to its own sign-in link', () => {
        expect(signup).toContain('const signInHref =');
        expect(signup).toContain('href={signInHref}');
    });

    it('sends an OAuth registration to the same destination', () => {
        // The one registration path where the destination CAN survive: the
        // provider vouches for the address, so a session exists on callback.
        // HOS-959: this now lives in signUpConfig.oauthRedirectTo, computed
        // by the shared helper (see auth-tabs-config.test.ts — "also becomes
        // the sign-up tab OAuth destination" — for the behavioral proof it
        // resolves to the same authenticated target as sign-in, callbackUrl
        // included). What this guard can still assert on the page itself is
        // that the config gets forwarded to the island.
        expect(signup).toContain('signUpConfig={signUpConfig}');
        // `mi-cuenta` must not be reachable as a hard-coded OAuth destination
        // anywhere in this file any more — `returnPath` already falls back to
        // it when no destination was requested.
        expect(signup).not.toContain("buildUrl({ locale, path: 'mi-cuenta' })");
    });

    it('keeps the password registration on verify-email-sent', () => {
        // HOS-959: the literal moved into the shared helper — see
        // auth-tabs-config.test.ts "sign-up password-registration destination"
        // for the behavioral proof (real returnUrl/callbackUrl inputs still
        // resolve to verify-email-sent). Not a regression to fix: that flow
        // has no session to redirect with until the verification link is
        // opened.
        expect(signup).not.toContain("path: 'auth/verify-email-sent'");
        expect(readLib('auth-tabs-config.ts')).toContain("path: 'auth/verify-email-sent'");
    });
});

describe('HOS-810 — signin.astro keeps its open-redirect guard', () => {
    // HOS-959: see the matching note on the signup.astro describe block above.
    it('uses the shared predicate rather than a hand-copied second version', () => {
        expect(signin).toContain(
            "import { resolveAuthTabsRedirectConfig } from '@/lib/auth-tabs-config';"
        );
        expect(signin).not.toContain("from '@/lib/auth-redirect'");
        expect(signin).toContain('resolveAuthTabsRedirectConfig(');
    });

    it('still reads both accepted param names (inside the shared helper)', () => {
        // HOS-959: signin.astro itself no longer calls searchParams.get for
        // returnUrl/redirect — resolveAuthTabsRedirectConfig does, once, for
        // both pages. Behavioral coverage: auth-tabs-config.test.ts.
        expect(readLib('auth-tabs-config.ts')).toContain("astroUrl.searchParams.get('returnUrl')");
        expect(readLib('auth-tabs-config.ts')).toContain("astroUrl.searchParams.get('redirect')");
    });
});
