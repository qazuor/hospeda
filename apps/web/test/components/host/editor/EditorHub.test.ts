/**
 * @file EditorHub.test.ts
 * @description Source-level guards for the editor hub (HOS-318 T-007/T-008, AC-4).
 *
 * As with `EditorRouteNav`, Vitest cannot render `.astro`, so these assertions
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
    it('should derive its rows from the section registry', () => {
        expect(CODE).toContain('ACCOMMODATION_EDITOR_SECTIONS');
    });

    it('should group rows using the declared group order', () => {
        expect(CODE).toContain('EDITOR_SECTION_GROUPS');
        expect(CODE).toContain('EDITOR_SECTION_GROUP_LABEL_KEYS');
    });

    it('should build hrefs with the shared URL builder, not by hand', () => {
        expect(CODE).toContain('buildEditorSectionUrl');
        expect(CODE).not.toContain('mi-cuenta/propiedades/');
    });

    it('should hide the translations row when there is no translation data', () => {
        expect(CODE).toContain('hasTranslations');
    });

    it('should render a heading per group, associated with its list', () => {
        expect(CODE).toContain('aria-labelledby');
        expect(CODE).toContain('editor-hub__group-heading');
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
        const match = CODE.match(/min-height:\s*(\d+)px/);

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
        // The warning modifier only recolours; the words come from the i18n
        // string, which already carries its own marker.
        expect(CODE).toContain('editor-hub__status--warning');
        expect(CODE).toContain('status.tone');
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
