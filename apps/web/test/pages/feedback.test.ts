/**
 * @file feedback.test.ts
 * @description Source-level regression tests for the standalone feedback page.
 *
 * Astro components cannot be rendered in Vitest, so behavior is asserted by
 * inspecting the source for the expected wiring (per the web CLAUDE.md
 * "Astro component test" pattern).
 *
 * Regression target — BETA-45 ("report modal/form transparent on Chrome 109"):
 * this standalone page intentionally bypasses BaseLayout, so it cannot rely on
 * the global token stylesheet (which carries the SPEC-176 sRGB fallback). The
 * page defined its own tokens with raw `oklch()` (invalid on browsers without
 * oklch support → transparent) AND referenced undefined `--core-*` variables
 * for the form container background. Both are guarded here.
 *
 * @module test/pages/feedback
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(resolve(__dirname, '../../src/pages/[lang]/feedback/index.astro'), 'utf8');
const overrides = readFileSync(
    resolve(__dirname, '../../src/styles/feedback-overrides.css'),
    'utf8'
);

/*
 * Strip JS/CSS comments so doc-comments mentioning `oklch`/`--core-` for
 * historical context don't trip the guards below.
 *
 * Line comments go FIRST, and the order is load-bearing. Stripping blocks
 * first made the `/*` inside this file's own `// ... /_astro/*.webp` comment
 * open a phantom block that only closed 80 lines later, swallowing the imports
 * and the entire markup — so every guard reading `withoutComments` was
 * silently scanning a truncated file and could not have failed on anything in
 * the body.
 */
const withoutComments = src.replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

describe('feedback/index.astro (BETA-45)', () => {
    it('defines no raw oklch() tokens (breaks on Chrome 109 and older)', () => {
        expect(withoutComments).not.toMatch(/oklch\(/);
    });

    it('references no undefined --core-* custom properties', () => {
        // The standalone page does not load global.css, so any `--core-*`
        // reference resolves to nothing → transparent surfaces.
        expect(withoutComments).not.toMatch(/var\(--core-/);
    });

    it('uses sRGB hex for the card token so the form container is opaque', () => {
        expect(withoutComments).toContain('--card: #ffffff');
    });

    it('applies the feedback-root class so the embedded form gets its tokens', () => {
        // FeedbackForm styles + --fb-* tokens cascade from a `.feedback-root`
        // ancestor (same mechanism the modal uses via the <dialog>).
        expect(src).toContain('feedback-standalone__form feedback-root');
    });
});

describe('feedback/index.astro — logo aspect ratio', () => {
    // The asset is 200x216. The page used to hardcode width="120" height="32"
    // on it, imposing a 3.75 ratio on a near-square image, and nothing failed
    // because both numbers were plausible on their own.
    it("emits the asset's own intrinsic dimensions", () => {
        expect(src).toContain('width={logoSrc.width}');
        expect(src).toContain('height={logoSrc.height}');
    });

    it('hardcodes no literal dimensions on the logo', () => {
        const logoTag = withoutComments.match(/<img[^>]*alt="Hospeda"[^>]*>/);
        expect(logoTag, 'logo <img> not found').not.toBeNull();
        expect(logoTag?.[0]).not.toMatch(/width="\d+"/);
        expect(logoTag?.[0]).not.toMatch(/height="\d+"/);
    });

    it('constrains the rendered height in CSS instead', () => {
        expect(withoutComments).toMatch(/\.feedback-standalone__logo img\s*{[^}]*width:\s*auto/);
    });
});

describe('feedback/index.astro — widget surface tokens', () => {
    /*
     * The page pins data-theme="light" on <html>, but the widget package
     * themes itself from `@media (prefers-color-scheme: dark)` in
     * packages/feedback/src/styles/tokens.css — it never reads data-theme. A
     * visitor whose OS was set to dark therefore got a dark form inside a
     * light page: near-black inputs, and labels at ~1.03:1 against the page
     * background. Overriding only --fb-primary (as this page did) leaves the
     * media query in charge of every surface.
     *
     * Every other page is spared because BaseLayout loads
     * feedback-overrides.css; this standalone page cannot import that sheet,
     * since it maps --fb-* onto global brand tokens that only exist under
     * BaseLayout.
     */
    const SURFACE_TOKENS = [
        '--fb-background',
        '--fb-foreground',
        '--fb-foreground-muted',
        '--fb-card',
        '--fb-border',
        '--fb-input-bg',
        '--fb-input-border'
    ] as const;

    const rootBlock = withoutComments.match(/\.feedback-root\s*{([^}]*)}/)?.[1] ?? '';

    it('overrides every surface token, not just the brand color', () => {
        expect(rootBlock, '.feedback-root block not found').not.toBe('');
        for (const token of SURFACE_TOKENS) {
            expect(rootBlock, `${token} left to the package default`).toContain(`${token}:`);
        }
    });

    it("points them at this page's own tokens rather than repeating hex codes", () => {
        // Repeating the literals is what drifts when the palette moves.
        for (const token of SURFACE_TOKENS) {
            const declaration = rootBlock.match(new RegExp(`${token}:\\s*([^;]+);`))?.[1] ?? '';
            expect(declaration.trim(), `${token} should reference a :root token`).toMatch(
                /^var\(--[a-z-]+\)$/
            );
        }
    });
});

describe('feedback-overrides.css (BETA-45 — FAB modal on Chrome 109)', () => {
    // The web overrides the widget's --fb-* tokens. Raw oklch() in the base
    // block left the FAB modal backdrop/shadow/hover invalid on Chrome 109.
    // The CI relative-colors guard only catches `oklch(from`, NOT plain
    // `oklch()`, so this guards the regression directly.
    const base = overrides.split('@supports')[0];

    it('uses sRGB fallbacks (no raw oklch) outside the @supports block', () => {
        expect(base).not.toMatch(/oklch\(/);
    });

    it('restores oklch inside an @supports block for modern browsers', () => {
        expect(overrides).toContain('@supports (color: oklch(0 0 0))');
    });
});
