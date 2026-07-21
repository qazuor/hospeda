/**
 * @file AccommodationEditor.featured-mount.test.ts
 * @description Regression guard (HOS-224): the property editor MUST import and
 * mount `FeaturedToggleSection`. The component shipped orphaned (SPEC-309 built
 * it but never wired it into the editor), which is the exact bug HOS-224 fixes.
 * This read-source assertion fails if anyone removes the mount again.
 *
 * Read-source (not RTL) on purpose: the editor is a heavy island whose full
 * render is exercised elsewhere; here we only need to prove the wiring exists.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
    resolve(__dirname, '../../../src/components/host/AccommodationEditor.client.tsx'),
    'utf8'
);

describe('AccommodationEditor — FeaturedToggleSection mount (HOS-224)', () => {
    it('imports FeaturedToggleSection from the editor subfolder', () => {
        expect(source).toContain(
            "import { FeaturedToggleSection } from './editor/FeaturedToggleSection.client'"
        );
    });

    it('mounts <FeaturedToggleSection> with locale and accommodationId', () => {
        expect(source).toContain('<FeaturedToggleSection');
        // Passed the same two props the component requires.
        const mountBlock = source.slice(source.indexOf('<FeaturedToggleSection'));
        expect(mountBlock).toContain('locale={locale}');
        expect(mountBlock).toContain('accommodationId={accommodationId}');
    });
});
