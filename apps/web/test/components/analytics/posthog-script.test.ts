/**
 * @file posthog-script.test.ts
 * @description Regression test for the PostHog inline snippet rendering.
 *
 * There have been TWO distinct ways this snippet shipped broken. This test
 * guards against re-introducing either.
 *
 * ── Broken pattern #1 (JSX expression children) ────────────────────────────
 *   <script ... define:vars={...}>{`!function(t,e){...}(...)`}</script>
 * Astro emits the children INSIDE an IIFE that prepends the var declarations,
 * but does NOT evaluate the JSX braces in the body — they are written verbatim,
 * so the snippet becomes a dead JS block (`{ \`...\` }`) that never executes.
 *
 * ── Broken pattern #2 (define:vars + set:html on the SAME <script>) ─────────
 *   <script ... define:vars={{ posthogKey, ... }} set:html={snippetBody} />
 * This was believed to be the fix for #1 and shipped to production. It is ALSO
 * broken: in the production Astro build the two directives do NOT compose — the
 * `define:vars` wrapper wins and the `set:html` body is DROPPED. The page ships
 *   <script>(function(){ posthogKey:"phc_…"; posthogHost:"…"; })()</script>
 * — the vars are declared, the IIFE is empty, the PostHog loader + init are
 * gone, and `window.posthog` never initializes. It stayed invisible until the
 * Dockerfile build-arg fix made `posthogKey` non-empty (before that, the empty
 * key made `shouldRender=false`, so no <script> appeared at all and prod
 * captured zero events).
 *
 * ── Correct pattern ────────────────────────────────────────────────────────
 * Interpolate the env values straight into the snippet string with
 * `JSON.stringify(...)` (safe — they are build-time env constants) and emit the
 * fully self-contained body through a SINGLE `set:html`, with NO `define:vars`:
 *
 *   const snippetBody = `!function(t,e){...}; window.posthog.init(${JSON.stringify(posthogKey)}, {...})`;
 *   <script is:inline nonce={cspNonce} set:html={snippetBody} />
 *
 * We cannot render `.astro` files in Vitest (no Astro runtime here), so these
 * assertions are on the source string. The definitive check that the built
 * <script> actually contains the loader + init is a production build grep of
 * `dist/` (run locally / in the deploy pipeline before promotion), because the
 * pattern-#2 failure only manifests in the real build — a source assertion
 * alone is what let it ship. The `must NOT declare vars via define:vars` guard
 * below is the source-level proxy that would have caught it.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SOURCE_PATH = resolve(__dirname, '../../../src/components/analytics/PostHogScript.astro');
const source = readFileSync(SOURCE_PATH, 'utf8');

describe('PostHogScript.astro — snippet rendering pattern', () => {
    it('must NOT render the snippet via JSX expression children (broken pattern #1)', () => {
        const buggyJsxChildren = /<script\b[^>]*\bdefine:vars\b[^>]*>\s*\{`/;
        expect(
            source,
            'PostHogScript.astro must not wrap the inline snippet in JSX expression braces. ' +
                'Interpolate values into the string and use `set:html={snippetBody}`.'
        ).not.toMatch(buggyJsxChildren);
    });

    it('must NOT combine define:vars with set:html (broken pattern #2)', () => {
        // `define:vars` + `set:html` on the same <script> drops the body in the
        // production build. The snippet must carry its values via interpolation,
        // never via `define:vars`.
        // Match the directive as an ATTRIBUTE (`define:vars=…`), so prose in
        // comments that merely names `define:vars` does not trip the guard.
        expect(
            source,
            'PostHogScript.astro must NOT use `define:vars`: combined with `set:html` the ' +
                'production Astro build drops the snippet body (empty IIFE), so PostHog never ' +
                'initializes. Interpolate the env values into the snippet string instead.'
        ).not.toMatch(/define:vars\s*=/);
    });

    it('must inject the snippet body via a single set:html', () => {
        const correctPattern = /<script\b[^>]*\bset:html=\{snippetBody\}/;
        expect(
            source,
            'PostHogScript.astro must render the inline snippet via set:html so the body is ' +
                'emitted as raw script text.'
        ).toMatch(correctPattern);
    });

    it('must define a snippetBody string that initializes PostHog with interpolated env values', () => {
        // The snippet body must declare the stub IIFE and the init call, with
        // the key + host interpolated (not referenced as define:vars variables).
        expect(source).toMatch(/const\s+snippetBody\s*=\s*`/);
        expect(source).toContain('!function(t,e){');
        expect(source).toContain('window.posthog.init(${JSON.stringify(posthogKey)}, {');
        expect(source).toContain('api_host: ${JSON.stringify(posthogHost)},');
    });

    it('enables pageleave and web vitals capture for Web Analytics health', () => {
        expect(source).toContain('capture_pageleave: true');
        expect(source).toContain('capture_performance: { web_vitals: true }');
    });

    it('must gate rendering on dev mode and key presence', () => {
        expect(source).toContain('const isDev = import.meta.env.DEV === true');
        expect(source).toContain('const shouldRender = !isDev && posthogKey.length > 0');
    });

    it('registers app_version as a super property on load (interpolated)', () => {
        expect(source).toContain('const appVersion = import.meta.env.PUBLIC_VERSION');
        expect(source).toContain('ph.register({ app_version: ${JSON.stringify(appVersion)} });');
    });
});
