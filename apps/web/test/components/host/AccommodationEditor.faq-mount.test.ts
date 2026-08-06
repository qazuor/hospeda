/**
 * @file AccommodationEditor.faq-mount.test.ts
 * @description Regression guard (HOS-393): the property editor MUST import and
 * mount `FaqSection` inside its own card, with a matching sticky-nav entry.
 *
 * Read-source (not RTL) on purpose — mirrors
 * `AccommodationEditor.featured-mount.test.ts`.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
    resolve(__dirname, '../../../src/components/host/AccommodationEditor.client.tsx'),
    'utf8'
);

describe('AccommodationEditor — FaqSection mount (HOS-393)', () => {
    it('imports FaqSection from the editor subfolder', () => {
        expect(source).toContain("import { FaqSection } from './editor/FaqSection.client'");
    });

    it('mounts <FaqSection> with locale, accommodationId, and initialFaqs', () => {
        expect(source).toContain('<FaqSection');
        const mountBlock = source.slice(source.indexOf('<FaqSection'));
        expect(mountBlock).toContain('locale={locale}');
        expect(mountBlock).toContain('accommodationId={accommodationId}');
        expect(mountBlock).toContain('initialFaqs={initialFaqs}');
    });

    it('adds a matching sticky-nav entry for the FAQ card', () => {
        expect(source).toContain("{ id: 'editor-faqs', label: sectionLabels.faqs }");
    });

    // AC-2 (HOS-393): FaqSection must stay OUTSIDE the PATCH-diff pipeline.
    // `buildPatchPayload` is the single function that assembles the editor's
    // save payload — a `faq`/`faqs` key there would mean FAQ edits are being
    // routed through the main "Guardar" button instead of persisting on
    // their own endpoints.
    it('does NOT reference faqs inside buildPatchPayload (FAQs never enter the PATCH diff)', () => {
        const start = source.indexOf('const buildPatchPayload');
        const end = source.indexOf('\n    );', start);
        expect(start).toBeGreaterThan(-1);
        const fnBody = source.slice(start, end === -1 ? undefined : end);
        expect(fnBody.toLowerCase()).not.toContain('faq');
    });
});
