/**
 * @file publish-ready-prompt-wiring.guard.test.ts
 * @description Static guard: every editor section that owns a blocking publish
 * requirement is wired to the post-save publish prompt (HOS-1183).
 *
 * ## The defect this exists to catch
 *
 * The prompt fires on the save that makes a listing publishable, and only two
 * of the editor's eleven routes can produce that save — the two that own the
 * five blocking requirements. Wiring exactly those two is correct today and
 * silently wrong the day a sixth requirement lands somewhere else: the owner
 * who completes their listing in that new section would finish their work and
 * be told nothing, with no error anywhere and every existing test green.
 *
 * The failure is invisible by construction, which is why it needs a guard
 * rather than a test. The requirement objects already declare their
 * `editorSectionId`, so the expected set is DERIVED from the same list the
 * server rejects from — never hand-copied, which is the mistake H-101 made when
 * the hub's warning list and the gate's list ended up with no field in common.
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ACCOMMODATION_PUBLISH_REQUIREMENTS } from '@repo/schemas';
import { describe, expect, it } from 'vitest';

const SRC_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../src');

/**
 * The component that owns each section's save, keyed by the `editorSectionId`
 * a requirement declares.
 *
 * An entry here is a claim that the file calls the prompt. The assertions below
 * check that claim against the source; the section→file mapping itself is the
 * only hand-written part, and a section with no entry fails loudly.
 */
const PROMPT_WIRING_BY_SECTION: Readonly<Record<string, string>> = {
    capacityPricing: 'components/host/editor/forms/CapacityPricingForm.client.tsx',
    photos: 'components/host/editor/PhotoSection.client.tsx'
};

/** Every section that owns at least one blocking requirement. */
const SECTIONS_THAT_GATE_PUBLISHING = [
    ...new Set(ACCOMMODATION_PUBLISH_REQUIREMENTS.map((r) => r.editorSectionId))
].sort();

function readSrc(relativePath: string): string {
    return readFileSync(resolve(SRC_ROOT, relativePath), 'utf-8');
}

describe('HOS-1183 guard: the publish prompt is wired to every gating section', () => {
    it('has a wiring entry for every section that owns a blocking requirement', () => {
        const unwired = SECTIONS_THAT_GATE_PUBLISHING.filter(
            (section) => !(section in PROMPT_WIRING_BY_SECTION)
        );

        expect(
            unwired,
            `These editor sections own a blocking publish requirement but are not wired to ` +
                `the post-save publish prompt:\n${unwired.map((s) => `  - ${s}`).join('\n')}\n\n` +
                'An owner who completes their listing there finishes their work and is told ' +
                'nothing, with no error anywhere. Wire the section (call usePublishReadyPrompt ' +
                'from its component) and add it to PROMPT_WIRING_BY_SECTION.'
        ).toEqual([]);
    });

    it.each(
        Object.entries(PROMPT_WIRING_BY_SECTION)
    )('%s actually calls the prompt in %s', (section, file) => {
        // The entry is a claim; this is what makes it one the code has to
        // keep. A mapping nobody verifies is a list that rots into fiction.
        expect(
            readSrc(file),
            `${file} is listed as the wiring for the "${section}" section but does not ` +
                'call usePublishReadyPrompt.'
        ).toMatch(/usePublishReadyPrompt\s*\(/);
    });

    it('lists no section that has stopped gating publishing', () => {
        // The other direction. A stale entry costs nothing at runtime but
        // claims a section still matters, and the next reader trusts it.
        const gating = new Set(SECTIONS_THAT_GATE_PUBLISHING);
        const stale = Object.keys(PROMPT_WIRING_BY_SECTION).filter(
            (section) => !gating.has(section)
        );

        expect(
            stale,
            `Wired for the publish prompt but no longer owning any blocking requirement:\n` +
                `${stale.map((s) => `  - ${s}`).join('\n')}`
        ).toEqual([]);
    });

    it('derives the expected sections from the shared requirement list, not a literal', () => {
        // Guards the guard: if ACCOMMODATION_PUBLISH_REQUIREMENTS were ever
        // imported empty (a barrel change, a bad mock), every assertion above
        // would pass while checking nothing at all.
        expect(ACCOMMODATION_PUBLISH_REQUIREMENTS.length).toBeGreaterThan(0);
        expect(SECTIONS_THAT_GATE_PUBLISHING.length).toBeGreaterThan(0);
    });
});
