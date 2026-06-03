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

// Strip JS/CSS comments so doc-comments mentioning `oklch`/`--core-` for
// historical context don't trip the guards below.
const withoutComments = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

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
