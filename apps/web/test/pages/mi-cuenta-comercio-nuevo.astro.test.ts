/**
 * @file mi-cuenta-comercio-nuevo.astro.test.ts
 * @description Source-level assertions for the owner self-service commerce
 * create page (HOS-257 pre-fill wiring).
 *
 * Astro pages cannot be rendered via Vitest, so we lean on string-level
 * assertions on the .astro source — same pattern used elsewhere in this repo
 * (see `mi-cuenta-editar.astro.test.ts`).
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
    resolve(__dirname, '../../src/pages/[lang]/mi-cuenta/comercio/nuevo/[vertical].astro'),
    'utf8'
);

describe('mi-cuenta/comercio/nuevo/[vertical].astro (HOS-257 pre-fill)', () => {
    it('fetches the caller own lead via fetchMyCommerceLead (never the lead service/table directly)', () => {
        expect(source).toContain('fetchMyCommerceLead');
        expect(source).not.toContain('CommerceLeadService');
        expect(source).not.toContain('commerce_leads');
    });

    it("forwards the request's Cookie header so the protected endpoint sees the session", () => {
        expect(source).toMatch(/Astro\.request\.headers\.get\(\s*['"]cookie['"]\s*\)/);
    });

    it('degrades to an undefined prefill (no lead-conditioned gate) when myLead is null', () => {
        expect(source).toContain('myLead');
        expect(source).toContain('? {');
        expect(source).toContain(': undefined');
    });

    it('passes prefill through to CommerceCreateForm', () => {
        expect(source).toMatch(/prefill=\{prefill\}/);
    });

    it('never sources prefill.name from the personal profile name', () => {
        expect(source).not.toMatch(/prefill.*Astro\.locals\.user\.name/);
    });
});
