/**
 * @file posthog-script.test.ts
 * @description Regression test for the PostHog inline snippet rendering bug.
 *
 * Background:
 * The first SPEC-140 follow-up authored `PostHogScript.astro` as
 *
 *   <script ... define:vars={...}>{`!function(t,e){...}(...)`}</script>
 *
 * In an Astro `<script is:inline define:vars={...}>`, the children expression
 * is emitted INSIDE an IIFE that prepends the var declarations:
 *
 *   (function(){ const posthogKey="..."; const posthogHost="..."; <CHILDREN> })()
 *
 * Astro does NOT evaluate the JSX expression braces inside the script body —
 * they are written through to the HTML verbatim. The resulting JS therefore
 * reads:
 *
 *   (function(){
 *     const posthogKey="...";
 *     const posthogHost="...";
 *     {  // <-- this is a JS *block*
 *       `the entire snippet as a template literal whose value is discarded`
 *     }
 *   })();
 *
 * That parses cleanly, but the snippet body never executes. `window.posthog`
 * stays undefined, no `array.js` request is made, and every downstream
 * `trackEvent()` call short-circuits silently.
 *
 * The fix is to assign the snippet body to a const and inject it via
 * `set:html`, which bypasses the JSX path:
 *
 *   const snippetBody = `!function(t,e){...}(...)`;
 *   <script ... define:vars={...} set:html={snippetBody} />
 *
 * This test guards against re-introduction of the broken pattern. We cannot
 * render `.astro` files in Vitest (no Astro runtime here), so we assert on
 * the source string directly.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SOURCE_PATH = resolve(__dirname, '../../../src/components/analytics/PostHogScript.astro');
const source = readFileSync(SOURCE_PATH, 'utf8');

describe('PostHogScript.astro — snippet rendering pattern', () => {
    it('must NOT render the snippet via JSX expression children', () => {
        // The bug pattern: <script ... define:vars={...}>{`...`}</script>.
        // Detects an opening template literal `{`\`` immediately inside a
        // <script> tag that already uses `define:vars`. If this matches, the
        // snippet body is wrapped in JSX braces that Astro emits literally,
        // producing the dead-block bug described above.
        const buggyJsxChildren = /<script\b[^>]*\bdefine:vars\b[^>]*>\s*\{`/;

        expect(
            source,
            'PostHogScript.astro must not wrap the inline snippet in JSX expression braces. ' +
                'Use `set:html={snippetBody}` instead. See file-level doc in this test for full ' +
                'rationale.'
        ).not.toMatch(buggyJsxChildren);
    });

    it('must inject the snippet body via set:html', () => {
        // The correct pattern: <script ... set:html={snippetBody} />.
        // Astro writes the string verbatim into the <script> contents, and
        // `define:vars` composes with it without going through the JSX path.
        const correctPattern = /<script\b[^>]*\bset:html=\{snippetBody\}/;

        expect(
            source,
            'PostHogScript.astro must render the inline snippet via set:html so the body is ' +
                'emitted as raw script text.'
        ).toMatch(correctPattern);
    });

    it('must define a snippetBody string that initializes PostHog', () => {
        // The snippet body must declare the stub IIFE and the init call.
        // Without these, even a correctly-rendered <script> would be a no-op.
        expect(source).toMatch(/const\s+snippetBody\s*=\s*`/);
        expect(source).toContain('!function(t,e){');
        expect(source).toContain('window.posthog.init(posthogKey, {');
    });

    it('must gate rendering on dev mode and key presence', () => {
        // shouldRender = !isDev && posthogKey.length > 0
        expect(source).toContain('const isDev = import.meta.env.DEV === true');
        expect(source).toContain('const shouldRender = !isDev && posthogKey.length > 0');
    });
});
