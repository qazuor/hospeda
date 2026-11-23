/**
 * @file EditorHub.test.ts
 * @description Source-level guards for the editor hub (HOS-318 T-007/T-008, AC-4).
 *
 * Vitest cannot render `.astro`, so these assertions
 * cover only genuinely textual properties. The status logic itself is unit-tested
 * for real in `editor-hub-status-model.test.ts`.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SOURCE = readFileSync(
    resolve(__dirname, '../../../../src/components/host/editor/EditorHub.astro'),
    'utf8'
);

/** Source with comments removed — absence claims must be made against code. */
const CODE = SOURCE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '');

describe('EditorHub.astro — structure (AC-4)', () => {
    it('should derive its rows from the section registry it is given', () => {
        // HOS-1080: the registry is a PROP now, not an import. That is what lets
        // venue and experience render the same hub — and it is why an
        // import of the accommodation registry here would be a regression.
        expect(CODE).toContain('getVisibleEditorSections({ registry, visibility })');
        expect(CODE).not.toContain('ACCOMMODATION_EDITOR_SECTIONS');
    });

    it("should group rows using the registry's declared group order", () => {
        expect(CODE).toContain('registry.groups');
        expect(CODE).toContain('registry.groupLabelKeys[group]');
    });

    it('should build hrefs with the shared URL builder, not by hand', () => {
        expect(CODE).toContain('buildEditorSectionUrl');
        expect(CODE).not.toContain('mi-cuenta/propiedades/');
    });

    it('should hide a section whose visibility key is not satisfied', () => {
        // The accommodation editor's `translations` row is the live case; the
        // hub never names it, it only honours the registry's answer.
        expect(CODE).toContain('visibility');
    });

    it('should render each group flat: a heading and a list, no card (HOS-2493)', () => {
        // Spec HOS-2415 §6.1: the hub's groups are flat sections, the same as
        // the rest of the kit pages, not stacked cards.
        expect(CODE).toContain('<h2 class="editor-hub__heading"');
        expect(CODE).toContain('{t(entry.headingKey)}');
        expect(CODE).not.toContain('AccountSectionCard');
    });

    it('should show the completeness meter fed by the page (HOS-2499)', () => {
        expect(CODE).toContain('<CompletenessMeter');
        expect(CODE).toContain('buildEditorSectionUrl({ locale, registry, entityId, section })');
    });
});

describe('EditorHub.astro — status lines', () => {
    it('should render the second line only when a status exists', () => {
        // `{status && (...)}` is what keeps a section with nothing to report from
        // rendering an empty or zero line.
        expect(CODE).toMatch(/\{status\s*&&/);
    });

    it('should pass interpolation params through to t()', () => {
        expect(CODE).toContain('status.params');
    });

    it('should not hardcode any status string', () => {
        for (const literal of ['fotos', 'seleccionados', 'huéspedes', 'Sin ']) {
            expect(CODE).not.toContain(`>${literal}`);
        }
    });
});

describe('EditorHub.astro — built for the target user', () => {
    it('should give rows a tap target above the 44px floor', () => {
        const match = CODE.match(/min-block-size:\s*(\d+)px/);

        expect(match).not.toBeNull();
        expect(Number(match?.[1])).toBeGreaterThanOrEqual(44);
    });

    it('should give rows a visible focus ring', () => {
        expect(CODE).toContain('focus-visible');
    });

    it('should render the chevron as decorative only', () => {
        // It is an affordance hint, not information — a screen reader reading
        // "›" after every row is pure noise.
        expect(CODE).toMatch(/editor-hub__chevron"\s+aria-hidden="true"/);
    });

    it('should never rely on colour alone for a warning', () => {
        // The kit pill always carries the words (HOS-2493); the tone only
        // recolours them.
        expect(CODE).toContain('<StatusPill tone={PILL_TONE[status.tone]}');
        expect(CODE).toContain('{statusText(status)}');
    });
});

describe('EditorHub.astro — no JavaScript', () => {
    it('should not hydrate as an island', () => {
        expect(CODE).not.toMatch(/client:(load|idle|visible|only|media)/);
    });

    it('should not import React', () => {
        expect(CODE).not.toMatch(/from ['"]react['"]/);
    });
});

describe('EditorHub.astro — styling rules', () => {
    it('should use design tokens rather than hardcoded colors', () => {
        const hardcoded = SOURCE.match(/(?:color|background-color):\s*(#[0-9a-f]{3,8}|rgb\()/gi);

        expect(hardcoded).toBeNull();
    });
});
