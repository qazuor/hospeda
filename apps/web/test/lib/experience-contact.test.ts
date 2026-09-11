/**
 * @file experience-contact.test.ts
 * @description `hasPublicContactChannel` (HOS-1056) — the predicate that decides
 * both whether `ExperienceContactBlock` renders and whether the private-groups
 * CTA is a link or a plain sentence.
 *
 * The CTA is an ANCHOR into that block, so the two decisions must come from one
 * function. What these assertions protect is that single answer: every input for
 * which the block renders nothing must return `false`, or the CTA links to an
 * element that is not on the page — a click that does nothing, with no console
 * error and nothing visibly wrong.
 *
 * Vitest cannot render `.astro`, so this does NOT prove the block and the CTA
 * call it. What it proves is the answer they both consume; the call sites are a
 * one-line import each, checked by review and by `pnpm typecheck`.
 */

import { describe, expect, it } from 'vitest';
import type { ExperienceContactInfo } from '@/data/types';
import { hasPublicContactChannel } from '@/lib/experience-contact';

const has = (contactInfo: ExperienceContactInfo | null): boolean =>
    hasPublicContactChannel({ contactInfo });

describe('hasPublicContactChannel', () => {
    it('accepts any single published channel', () => {
        expect(has({ workPhone: '+54 3442 412233' })).toBe(true);
        expect(has({ mobilePhone: '+54 9 3442 555555' })).toBe(true);
        expect(has({ workEmail: 'hola@excursiones.test' })).toBe(true);
        expect(has({ website: 'https://excursiones.test' })).toBe(true);
    });

    it('rejects a listing with no contact object at all', () => {
        // The three seeded experience listings have an empty `contact_info`
        // (noted on HOS-815), so this is a live case, not a hypothetical.
        expect(has(null)).toBe(false);
        expect(has({})).toBe(false);
    });

    it('rejects values that are present but unusable', () => {
        // `contact_info` is an unbounded JSONB blob: a key can hold null, '',
        // or whitespace, and a whitespace phone would otherwise make the block
        // "present" while rendering an empty pill.
        expect(has({ workPhone: '', mobilePhone: '   ', workEmail: null })).toBe(false);
    });

    it('rejects a website the safe-URL allow-list refuses', () => {
        // THE case the two sides could have disagreed on. `z.string().url()`
        // accepts `javascript:`, and `ExperienceContactBlock` drops such a link
        // entirely — so if this returned true for it, a listing whose only
        // channel was a javascript: URL would render no block and still get a
        // CTA anchored to it.
        expect(has({ website: 'javascript:alert(1)' })).toBe(false);
        expect(has({ website: 'not a url at all' })).toBe(false);
    });

    it('accepts a listing whose only usable channel is its website', () => {
        // Non-vacuity for the test above: the refusal has to come from the
        // allow-list, not from websites being ignored altogether.
        expect(has({ workPhone: '  ', website: 'https://excursiones.test' })).toBe(true);
    });
});
