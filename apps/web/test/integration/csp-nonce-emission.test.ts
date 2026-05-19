/**
 * @file csp-nonce-emission.test.ts
 * @description Integration smoke test for SPEC-046 T-005 — verifies the full
 * pipeline (`buildCspHeader` -> nonce extraction -> `injectNonce`) end-to-end
 * against a representative HTML fixture mirroring what Astro emits in
 * production: inline styles, vite dev-id styles, ClientRouter script,
 * external bundled script, pre-stamped tags, a literal `<style>` inside a
 * script body, and a `<noscript>` block whose children must be left alone.
 *
 * Approach rationale (spec offered two options):
 *
 * - Build + preview programmatically: rejected for the always-on suite.
 *   The full web build takes ~5–10 minutes which is incompatible with a
 *   per-commit CI gate. A separate opt-in target (env-gated) would be
 *   reasonable, but the dev-mode smoke captured live during T-003
 *   (apps/web running on localhost, 131 tags total, 130 stamped, 1
 *   noscript descendant correctly skipped) already exercised the same
 *   middleware + injector code path the production build would exercise.
 *
 * - Fixture-based assertion: chosen. The static dist/ HTML the spec
 *   mentions as a fallback CANNOT carry nonces (they are per-request,
 *   generated in middleware), so a real dist/ inspection would verify the
 *   wrong thing. Using a controlled fixture lets us pin the exact tag
 *   shapes we care about (ClientRouter, vite dev-id, noscript-nested,
 *   pre-existing-nonce, script-with-style-literal) in one place.
 *
 * What this catches that the unit tests in inject-nonce.test.ts do not:
 * - Real `buildCspHeader` output gets parsed for its nonce.
 * - Nonce flows the same way the middleware threads it: header value MUST
 *   match the attribute stamped on every inline tag.
 * - Pre-existing nonce values on tags survive (regression guard).
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { type DefaultTreeAdapterMap, parse } from 'parse5';
import { describe, expect, it } from 'vitest';
import { injectNonce } from '../../integrations/csp-nonce-injector';
import { buildCspHeader } from '../../src/lib/middleware-helpers';

type Node = DefaultTreeAdapterMap['node'];
type Element = DefaultTreeAdapterMap['element'];
type ParentNode = DefaultTreeAdapterMap['parentNode'];

const FIXTURE_PATH = resolve(__dirname, 'fixtures/astro-emitted-page.html');
const FIXTURE_HTML = readFileSync(FIXTURE_PATH, 'utf-8');

interface ScriptOrStyleTag {
    readonly tagName: 'script' | 'style';
    readonly nonce: string | null;
    readonly insideNoscript: boolean;
}

/**
 * Walks the parse5 AST and collects every <script> and <style> element along
 * with whether it sits inside a <noscript> ancestor and what its nonce value
 * is (null if absent). Mirrors the data the live response would expose.
 */
function collectScriptStyleTags(html: string): ReadonlyArray<ScriptOrStyleTag> {
    const out: ScriptOrStyleTag[] = [];
    const doc = parse(html);

    function visit(node: Node, insideNoscript: boolean): void {
        if ('tagName' in node) {
            const el = node as Element;
            if (el.tagName === 'script' || el.tagName === 'style') {
                const nonceAttr = el.attrs.find((a) => a.name === 'nonce');
                out.push({
                    tagName: el.tagName,
                    nonce: nonceAttr ? nonceAttr.value : null,
                    insideNoscript
                });
            }
            const nextInsideNoscript = insideNoscript || el.tagName === 'noscript';
            const children = (node as ParentNode).childNodes;
            if (children) {
                for (const child of children) {
                    visit(child, nextInsideNoscript);
                }
            }
            return;
        }
        if ('childNodes' in node && (node as ParentNode).childNodes) {
            for (const child of (node as ParentNode).childNodes) {
                visit(child, insideNoscript);
            }
        }
    }

    visit(doc, false);
    return out;
}

/**
 * Pulls the nonce token out of a `script-src` directive in the CSP header
 * string. This matches how a browser parses `'nonce-XYZ'` source expressions.
 */
function extractNonceFromCsp(header: string): string | null {
    const match = header.match(/'nonce-([^']+)'/);
    return match ? match[1] : null;
}

describe('CSP nonce emission (end-to-end pipeline)', () => {
    it('extracted nonce from buildCspHeader matches the value we passed in', () => {
        const nonce = 'integration-test-nonce-abc123';
        const header = buildCspHeader({ nonce });

        const extracted = extractNonceFromCsp(header);

        expect(extracted).toBe(nonce);
    });

    it('every <script>/<style> outside <noscript> gets stamped with the policy nonce', () => {
        const nonce = 'integration-test-nonce-abc123';
        const header = buildCspHeader({ nonce });
        const headerNonce = extractNonceFromCsp(header);
        expect(headerNonce).not.toBeNull();

        const { html: rewritten } = injectNonce({
            html: FIXTURE_HTML,
            nonce: headerNonce!
        });

        const tags = collectScriptStyleTags(rewritten);

        const outsideNoscriptWithoutNonce = tags.filter(
            (t) => !t.insideNoscript && t.nonce === null
        );
        expect(outsideNoscriptWithoutNonce).toEqual([]);
    });

    it('preserves pre-existing nonce values (does not overwrite them)', () => {
        const policyNonce = 'fresh-policy-nonce';
        const { html: rewritten } = injectNonce({ html: FIXTURE_HTML, nonce: policyNonce });

        const tags = collectScriptStyleTags(rewritten);
        const preExisting = tags.filter((t) => t.nonce === 'pre-existing-nonce');

        // The fixture has one <script> and one <style> with the pre-existing
        // nonce. Both must survive the rewrite untouched.
        expect(preExisting.length).toBe(2);
    });

    it('does NOT stamp <script>/<style> nested inside <noscript>', () => {
        const policyNonce = 'fresh-policy-nonce';
        const { html: rewritten } = injectNonce({ html: FIXTURE_HTML, nonce: policyNonce });

        const tags = collectScriptStyleTags(rewritten);
        const insideNoscriptStamped = tags.filter(
            (t) => t.insideNoscript && t.nonce === policyNonce
        );

        expect(insideNoscriptStamped).toEqual([]);
    });

    it('all stamped tags carry the SAME nonce — header and body never desync', () => {
        const policyNonce = 'fresh-policy-nonce';
        const header = buildCspHeader({ nonce: policyNonce });
        const headerNonce = extractNonceFromCsp(header);

        const { html: rewritten } = injectNonce({
            html: FIXTURE_HTML,
            nonce: headerNonce!
        });
        const tags = collectScriptStyleTags(rewritten);

        // Every nonce we observe on a tag is either the policy nonce we
        // injected (the common case) OR a pre-existing value the walker
        // intentionally leaves alone. There is no third value, ever.
        const distinctNonces = new Set(
            tags.map((t) => t.nonce).filter((n): n is string => n !== null)
        );
        const allowed = new Set([policyNonce, 'pre-existing-nonce']);
        for (const observed of distinctNonces) {
            expect(allowed.has(observed)).toBe(true);
        }
    });

    it('does not corrupt script content that contains a literal <style> string', () => {
        const policyNonce = 'fresh-policy-nonce';
        const { html: rewritten } = injectNonce({ html: FIXTURE_HTML, nonce: policyNonce });

        // The fixture has a script whose body text contains
        // "<style>this is text inside a script body</style>". That literal
        // string must round-trip intact (parse5 treats script contents as
        // raw text, which is what we rely on).
        expect(rewritten).toContain('this is text inside a script body');
    });
});
