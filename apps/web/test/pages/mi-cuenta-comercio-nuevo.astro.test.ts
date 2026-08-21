/**
 * @file mi-cuenta-comercio-nuevo.astro.test.ts
 * @description Source-level assertions for the owner self-service commerce
 * create page (HOS-693 §6.2 pre-fill removal, HOS-687 access gate).
 *
 * Astro pages cannot be rendered via Vitest, so we lean on string-level
 * assertions on the .astro source — same pattern used elsewhere in this repo
 * (see `mi-cuenta-editar.astro.test.ts`).
 *
 * A source-level test cannot tell a DECLARED value from a RENDERED one, so it
 * is a poor instrument for "what does the page output". It is a good one for
 * what HOS-687 actually did: REMOVE a guard, and REPLACE a redirect target.
 * Both are absence/presence facts about the module's own code.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const PAGES_ROOT = resolve(__dirname, '../../src/pages/[lang]/mi-cuenta/comercio');

const source = readFileSync(resolve(PAGES_ROOT, 'nuevo/[vertical].astro'), 'utf8');
const verticalPickerSource = readFileSync(resolve(PAGES_ROOT, 'nuevo/index.astro'), 'utf8');
const listingIndexSource = readFileSync(resolve(PAGES_ROOT, 'index.astro'), 'utf8');
const editorSource = readFileSync(resolve(PAGES_ROOT, '[vertical]/[id]/editar.astro'), 'utf8');

describe('mi-cuenta/comercio/nuevo/[vertical].astro — HOS-257 pre-fill removed (HOS-693 §6.2)', () => {
    it('no longer fetches the caller own lead — fetchMyCommerceLead and the lead endpoint are gone', () => {
        expect(source).not.toContain('fetchMyCommerceLead');
        expect(source).not.toContain('leads/mine');
        expect(source).not.toContain('CommerceLeadService');
        expect(source).not.toContain('commerce_leads');
    });

    it('never passes a prefill prop to CommerceCreateForm', () => {
        expect(source).not.toContain('prefill');
    });
});

describe('mi-cuenta/comercio/nuevo — the create path stops requiring the role it grants (HOS-687)', () => {
    // The third of the three bolts on the same door. It demanded
    // COMMERCE_EDIT_OWN, which only a COMMERCE_OWNER holds, on the one page
    // that grants COMMERCE_OWNER.
    it('the create form no longer gates on hasCommerceNavAccess', () => {
        expect(source).not.toContain('hasCommerceNavAccess');
        expect(source).not.toContain('nav-gating');
    });

    it('the vertical picker that leads to it no longer gates on it either', () => {
        // Gating the doorway while opening the room leaves the form reachable
        // only by typing its URL.
        expect(verticalPickerSource).not.toContain('hasCommerceNavAccess');
        expect(verticalPickerSource).not.toContain('nav-gating');
    });

    // The companion half: only the CREATE path was opened. If a later change
    // strips the gate from the pages that read and write existing listings,
    // this fails.
    it('the listing index and the editor KEEP their commerce-role gate', () => {
        expect(listingIndexSource).toContain('hasCommerceNavAccess');
        expect(editorSource).toContain('hasCommerceNavAccess');
    });

    // AC-18 — the anonymous visitor comes back to the form they asked for.
    it.each([
        ['create form', () => source],
        ['vertical picker', () => verticalPickerSource]
    ])('%s sends an anonymous visitor to sign-in WITH a return URL (AC-18)', (_label, read) => {
        const pageSource = read();
        expect(pageSource).toMatch(
            /buildLoginRedirect\(\{\s*locale,\s*currentUrl:\s*Astro\.url\.pathname\s*\}\)/
        );
        // The old redirect threw the destination away, landing the visitor on
        // a bare sign-in and then on /mi-cuenta.
        expect(pageSource).not.toMatch(/path:\s*['"]auth\/signin['"]/);
    });

    it('still refuses an anonymous visitor — only the ROLE gate went away', () => {
        expect(source).toMatch(/const user = Astro\.locals\.user;/);
        expect(source).toMatch(/if \(!user\) \{/);
        expect(verticalPickerSource).toMatch(/if \(!user\) \{/);
    });
});
