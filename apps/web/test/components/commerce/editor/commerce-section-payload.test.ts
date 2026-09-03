/**
 * @file commerce-section-payload.test.ts
 * @description The ownership invariant behind the commerce editor's split
 * (HOS-1080).
 *
 * `buildPatchPayload` still computes the diff over the WHOLE form state; each
 * page then keeps only the keys it owns. That arrangement has one failure mode
 * and it is silent in both directions:
 *
 *  - a key owned by NO section is a field the owner can edit and never save —
 *    the form goes clean, the toast says saved, the column does not change;
 *  - a key owned by TWO sections is a field two pages both claim, so whichever
 *    is saved last wins with data the other page was holding.
 *
 * Neither shows up in a rendering test, because both pages render correctly.
 * So the check is static, and it reads the REAL emitter — the source of
 * `buildPatchPayload` — rather than a hand-maintained list of what it emits,
 * which would drift the same way the thing it guards would.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
    COMMERCE_SECTION_PAYLOAD_KEYS,
    restrictPayloadToSection
} from '@/components/commerce/editor/commerce-section-payload';
import { buildCommerceEditorSections } from '@/lib/editor/commerce-editor-sections';

const SRC = resolve(__dirname, '../../../../src');

/** Source with comments removed — this file's own prose must not be scanned. */
function codeOf(path: string): string {
    return readFileSync(path, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/(^|\s)\/\/.*$/gm, '');
}

/**
 * Every PATCH key `buildPatchPayload` can emit.
 *
 * Two emission shapes, both real: direct assignment (`payload.name = …`, the
 * overwhelming majority) and the slug-refresh block, which arrives through
 * `Object.assign(payload, buildSlugRefreshPayload(…))` and therefore names its
 * key in a different file.
 */
function emittedKeys(): readonly string[] {
    const editor = codeOf(resolve(SRC, 'components/commerce/CommerceListingEditor.client.tsx'));
    const slugRefresh = codeOf(resolve(SRC, 'lib/listing-slug-refresh.ts'));

    const direct = [...editor.matchAll(/\bpayload\.([A-Za-z0-9_]+)\s*=/g)].map((match) => match[1]);
    const merged = [...slugRefresh.matchAll(/return \{ ([A-Za-z0-9_]+): true \}/g)].map(
        (match) => match[1]
    );

    return [...new Set([...direct, ...merged])].filter((key): key is string => Boolean(key));
}

describe('every PATCH key has exactly one owning section', () => {
    const emitted = emittedKeys();
    const owned = Object.values(COMMERCE_SECTION_PAYLOAD_KEYS).flat();

    it('should have found the real emitter, not an empty scan', () => {
        // The scan is a regex over source. If a refactor renames `payload` or
        // changes the assignment shape, every assertion below would pass
        // vacuously over an empty list — so the list's size is asserted first.
        // The editor emits about two dozen keys; twenty is a floor, not a count.
        expect(emitted.length).toBeGreaterThanOrEqual(20);
        expect(emitted).toContain('name');
        expect(emitted).toContain('refreshSlugFromName');
    });

    it('should give every emitted key a section that owns it', () => {
        const orphans = emitted.filter((key) => !owned.includes(key));

        expect(
            orphans,
            `these PATCH keys belong to no section, so no page can ever save them: ${orphans.join(', ')}`
        ).toEqual([]);
    });

    it('should not let two sections claim the same key', () => {
        const duplicates = owned.filter((key, index) => owned.indexOf(key) !== index);

        expect(
            duplicates,
            `these PATCH keys are claimed by more than one section: ${duplicates.join(', ')}`
        ).toEqual([]);
    });

    it('should not own a key the editor never emits', () => {
        // The other direction: a stale entry here is dead weight that reads as
        // coverage. It would also silently absorb a renamed field.
        const stale = owned.filter((key) => !emitted.includes(key));

        expect(stale, `these owned keys are never emitted: ${stale.join(', ')}`).toEqual([]);
    });
});

describe('the owning sections are real sections', () => {
    it('should name only ids the registry declares', () => {
        const registryIds = buildCommerceEditorSections({ vertical: 'experience' }).map(
            (section) => section.id
        );

        for (const sectionId of Object.keys(COMMERCE_SECTION_PAYLOAD_KEYS)) {
            expect(registryIds, `"${sectionId}" owns keys but is not a section`).toContain(
                sectionId
            );
        }
    });

    it('should leave exactly the two self-persisting sections without keys', () => {
        // `media` and `faqs` persist through their own endpoints, so they own no
        // PATCH key and their routes render no form. Any OTHER section missing
        // from the map would be a page with a Save button that saves nothing.
        const registryIds = buildCommerceEditorSections({ vertical: 'experience' }).map(
            (section) => section.id
        );
        const withoutKeys = registryIds.filter((id) => !(id in COMMERCE_SECTION_PAYLOAD_KEYS));

        expect(withoutKeys.sort()).toEqual(['faqs', 'media']);
    });
});

describe('the editor actually routes its payload through the restriction', () => {
    it('should wrap buildPatchPayload in restrictPayloadToSection', () => {
        // Every OTHER assertion about the restriction is a unit test of the
        // function, and a unit test cannot notice the call being deleted from
        // the component. The rendering tests cannot either: a section page does
        // not render another section's control, so a foreign key never reaches
        // the diff to be stripped in the first place, and dropping the wrapper
        // leaves every one of them green.
        //
        // That is the whole reason this guard is here rather than there. It is a
        // static one because the failure it catches is the absence of a call,
        // which no observable behaviour distinguishes today — it only matters
        // the moment a future edit lets foreign state into the form.
        const editor = codeOf(resolve(SRC, 'components/commerce/CommerceListingEditor.client.tsx'));

        expect(editor).toContain('restrictPayloadToSection({');
        expect(editor).toMatch(/restrictPayloadToSection\(\{\s*payload:\s*buildPatchPayload\(/);
        // The memo has to re-run when the page's section changes, or a client
        // navigation between two sections would keep the previous one's mask.
        expect(editor).toMatch(
            /\[formData, baseline, vertical, currentLifecycleState, sectionId\]/
        );
    });
});

describe('restrictPayloadToSection', () => {
    it('should keep the keys the section owns', () => {
        const restricted = restrictPayloadToSection({
            payload: { priceRange: null, menuUrl: 'https://x.test' },
            sectionId: 'price'
        });

        expect(restricted).toEqual({ priceRange: null, menuUrl: 'https://x.test' });
    });

    it('should drop a key another section owns', () => {
        const restricted = restrictPayloadToSection({
            payload: { name: 'Otro nombre', priceRange: 'MID' },
            sectionId: 'price'
        });

        expect(restricted).toEqual({ priceRange: 'MID' });
    });

    it('should preserve an explicit null, which is not the same as an absent key', () => {
        // The whole gastronomy clearing contract rides on this: `null` means
        // "clear the column", an absent key means "no change". A restriction
        // implemented with a falsy check would turn every clear into a no-op.
        const restricted = restrictPayloadToSection({
            payload: { priceRange: null },
            sectionId: 'price'
        });

        expect(Object.hasOwn(restricted, 'priceRange')).toBe(true);
        expect(restricted.priceRange).toBeNull();
    });

    it('should keep a key explicitly set to undefined, which the wire drops on its own', () => {
        // `priceFrom` cleared is `undefined`, and `JSON.stringify` is what
        // removes it. Dropping it HERE instead would be the same outcome today
        // and a different one the moment a caller stops serializing.
        const restricted = restrictPayloadToSection({
            payload: { priceFrom: undefined },
            sectionId: 'price'
        });

        expect(Object.hasOwn(restricted, 'priceFrom')).toBe(true);
    });

    it('should return an empty body for a section that owns nothing', () => {
        // Read by the editor as "no changes", which is the safe reading — never
        // as "save everything".
        expect(
            restrictPayloadToSection({
                payload: { name: 'x' },
                // @ts-expect-error — `media` is not a form section; asserting the
                // fallback holds for an id that slips past the type anyway.
                sectionId: 'media'
            })
        ).toEqual({});
    });
});
