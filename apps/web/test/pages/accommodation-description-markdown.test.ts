/**
 * @file accommodation-description-markdown.test.ts
 * @description HOS-817 — the public accommodation page must RENDER the
 * formatting the host editor lets an entitled owner save, and must never let
 * host-authored markup reach the DOM unsanitized.
 *
 * ## Why the bug existed
 *
 * `components/host/editor/BasicInfoSection.client.tsx` binds its
 * `<RichTextEditor>` to `data.description` — NOT to `richDescription`. So an
 * entitled host's bold/italic/lists are stored in `accommodation.description`,
 * while the public page routed that field through `renderPlain` (escape-only,
 * markdown NOT interpreted). Result: literal `**asterisks**` on a paid feature.
 *
 * ## Why rendering it leaks no entitlement
 *
 * `gateRichDescription` (apps/api/src/middlewares/accommodation-entitlements.ts)
 * neutralizes markdown in `description` at WRITE time via
 * `stripRichDescriptionSyntax` for any owner lacking CAN_USE_RICH_DESCRIPTION.
 * Markdown surviving in `description` therefore implies an entitled owner, so
 * the renderer needs no entitlement check of its own (and the page is pinned
 * below to keep having none).
 *
 * ## What this suite can and cannot prove
 *
 * Vitest cannot render `.astro` in this repo (no Astro vite plugin in the test
 * pipeline — the same limitation documented in
 * `test/components/account/PartnerMentionsSection.test.ts` and
 * `test/pages/detail-pages-html-sanitization.test.ts`). So the split is:
 *
 * - The XSS and markdown guarantees are asserted BEHAVIORALLY, by executing the
 *   real `renderContent` pipeline (`marked` -> `sanitizeHtml`) that the page
 *   feeds into `set:html`. These run actual code, not a source regex.
 * - The WIRING — that the page uses that pipeline for `description` and that the
 *   component never puts anything else into `set:html` — is asserted with
 *   static guards, because that is the only layer a source test can reach.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { renderContent } from '@/lib/render-content';

const SITE_ORIGIN = 'https://hospeda.test';

const PAGE_SRC = readFileSync(
    resolve(__dirname, '../../src/pages/[lang]/alojamientos/[slug].astro'),
    'utf8'
);

const COMPONENT_SRC = readFileSync(
    resolve(__dirname, '../../src/components/accommodation/Description.astro'),
    'utf8'
);

/**
 * Strips `/* *\/` and `//` comments so a wiring assertion reads the CODE, not
 * the prose about it — several of the comments in these two files quote the
 * very identifiers being asserted on (`renderPlain`, `set:html`).
 */
function stripComments(source: string): string {
    return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

const PAGE_CODE = stripComments(PAGE_SRC);
const COMPONENT_CODE = stripComments(COMPONENT_SRC);

// ============================================================================
// 1. THE BUG ITSELF — formatting must survive to HTML
// ============================================================================

describe('HOS-817 — the saved formatting reaches the public HTML', () => {
    /** The exact payload from the issue's reproduction. */
    const ISSUE_PAYLOAD =
        'Prueba: **esto va en negrita** y *esto en cursiva*\n\n- Primer punto de la lista\n- Segundo punto';

    it('renders **bold** as <strong>, not as literal asterisks', () => {
        const html = renderContent({ raw: ISSUE_PAYLOAD, siteOrigin: SITE_ORIGIN });

        expect(html).toContain('<strong>esto va en negrita</strong>');
        expect(html).not.toContain('**esto va en negrita**');
    });

    it('renders *italic* as <em>', () => {
        const html = renderContent({ raw: ISSUE_PAYLOAD, siteOrigin: SITE_ORIGIN });

        expect(html).toContain('<em>esto en cursiva</em>');
    });

    it('renders "- item" lines as a real <ul>/<li> list', () => {
        const html = renderContent({ raw: ISSUE_PAYLOAD, siteOrigin: SITE_ORIGIN });

        expect(html).toContain('<ul>');
        expect(html).toContain('<li>Primer punto de la lista</li>');
        expect(html).not.toMatch(/^- Primer punto/m);
    });

    it('renders ## headings as <h2>', () => {
        const html = renderContent({ raw: '## Servicios\n\ntexto', siteOrigin: SITE_ORIGIN });

        expect(html).toContain('<h2>Servicios</h2>');
    });

    it('leaves plain prose without markdown markers untouched in meaning', () => {
        const html = renderContent({
            raw: 'Casa quinta con pileta y parrilla.',
            siteOrigin: SITE_ORIGIN
        });

        expect(html).toContain('Casa quinta con pileta y parrilla.');
        expect(html).not.toContain('<strong>');
    });
});

// ============================================================================
// 2. XSS — THE MOST IMPORTANT TESTS IN THIS FILE
// ============================================================================

describe('HOS-817 security — host-authored payloads must not reach the DOM executable', () => {
    it('strips <script>alert(1)</script> entirely', () => {
        const html = renderContent({
            raw: 'Hola <script>alert(1)</script> mundo',
            siteOrigin: SITE_ORIGIN
        });

        expect(html).not.toContain('<script');
        expect(html).not.toContain('alert(1)');
        expect(html).toContain('Hola');
        expect(html).toContain('mundo');
    });

    it('strips an onerror handler from <img src=x onerror=...>', () => {
        const html = renderContent({
            raw: '<img src=x onerror="alert(document.cookie)">',
            siteOrigin: SITE_ORIGIN
        });

        expect(html).not.toContain('onerror');
        expect(html).not.toContain('alert(document.cookie)');
    });

    it('strips on* handlers off any allowed tag', () => {
        const html = renderContent({
            raw: '<p onclick="alert(1)" onmouseover="alert(2)">texto</p>',
            siteOrigin: SITE_ORIGIN
        });

        expect(html).not.toContain('onclick');
        expect(html).not.toContain('onmouseover');
        expect(html).toContain('texto');
    });

    it('removes a javascript: href from a markdown link', () => {
        const html = renderContent({
            raw: '[click me](javascript:alert(1))',
            siteOrigin: SITE_ORIGIN
        });

        expect(html).not.toContain('javascript:');
        expect(html).toContain('click me');
    });

    it('removes a javascript: href from a raw anchor', () => {
        const html = renderContent({
            raw: '<a href="javascript:alert(1)">click</a>',
            siteOrigin: SITE_ORIGIN
        });

        expect(html).not.toContain('javascript:');
    });

    it('discards a non-YouTube <iframe> completely', () => {
        const html = renderContent({
            raw: '<iframe src="https://evil.example/pwn"></iframe>',
            siteOrigin: SITE_ORIGIN
        });

        expect(html).not.toContain('<iframe');
        expect(html).not.toContain('evil.example');
    });

    it('strips <svg onload=...> and <object>/<embed> vectors', () => {
        const html = renderContent({
            raw: '<svg onload="alert(1)"></svg><object data="x"></object><embed src="x">',
            siteOrigin: SITE_ORIGIN
        });

        expect(html).not.toContain('onload');
        expect(html).not.toContain('<object');
        expect(html).not.toContain('<embed');
    });

    it('neutralizes a data: URI scheme in an image', () => {
        const html = renderContent({
            raw: '<img src="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==">',
            siteOrigin: SITE_ORIGIN
        });

        expect(html).not.toContain('data:text/html');
    });
});

// ============================================================================
// 3. WIRING GUARDS — the layer a source test can actually reach
// ============================================================================

describe('HOS-817 wiring — the page feeds description through the sanitizing pipeline', () => {
    it('the page imports the markdown+sanitize pipeline', () => {
        expect(PAGE_CODE).toMatch(
            /import\s*\{\s*renderContent\s+as\s+renderRich\s*\}\s*from\s*['"]@\/lib\/render-content['"]/
        );
    });

    it('the page builds description HTML with renderRich, not renderPlain', () => {
        expect(PAGE_CODE).toMatch(
            /const\s+safeDescriptionHtml\s*=\s*accommodation\.description[\s\S]{0,120}?renderRich\(\{/
        );
    });

    it('the page no longer routes description through the escape-only helper', () => {
        // This is the regression that produced the literal asterisks.
        expect(PAGE_CODE).not.toContain('renderPlain');
        expect(PAGE_CODE).not.toContain('render-plain');
    });

    it('the page passes the sanitized HTML into the component', () => {
        expect(PAGE_CODE).toContain('descriptionHtml={safeDescriptionHtml}');
    });

    it('the page still gates rich HTML on richDescription presence only, with no entitlement logic', () => {
        // SPEC-187 FR-4: the API decides entitlement, the page never does.
        expect(PAGE_CODE).toMatch(/accommodation\.richDescription\s*\?/);
        expect(PAGE_CODE).not.toMatch(/import\s*\{[^}]*EntitlementKey/);
        expect(PAGE_CODE).not.toContain('hasEntitlement(');
        expect(PAGE_CODE).not.toContain('EntitlementKey.');
    });
});

describe('HOS-817 wiring — Description.astro only ever set:html the sanitized prop', () => {
    it('declares descriptionHtml and no longer declares the plain-text prop', () => {
        expect(COMPONENT_CODE).toMatch(/readonly\s+descriptionHtml\s*:\s*string/);
        expect(COMPONENT_CODE).not.toMatch(/readonly\s+descriptionText\s*:/);
    });

    it('emits the description body via set:html bound to descriptionHtml', () => {
        expect(COMPONENT_CODE).toMatch(/set:html=\{descriptionHtml\}/);
    });

    it('has exactly one set:html in the whole component', () => {
        // A second one is the shape a future edit would take to reintroduce the
        // XSS surface; make adding it a failing test rather than a review catch.
        const occurrences = COMPONENT_CODE.match(/set:html/g) ?? [];
        expect(occurrences).toHaveLength(1);
    });

    it('never pipes a raw or plain-text value into set:html', () => {
        expect(COMPONENT_CODE).not.toMatch(/set:html=\{\s*(?:descriptionText|summary|raw)/);
    });

    it('keeps summary as an auto-escaped text child, never as HTML', () => {
        // Deliberate scope decision (HOS-817): `summary` has NO write-time
        // entitlement gate, so interpreting markdown there would hand the paid
        // formatting feature to Basic-plan owners.
        expect(COMPONENT_CODE).toMatch(/<p>\{summary\}<\/p>/);
    });

    it('does not import the escape-only helper any more', () => {
        expect(COMPONENT_CODE).not.toContain('renderPlain');
    });
});
