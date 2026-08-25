/**
 * @file experience-contact-block.test.ts
 * @description HOS-815 — an experience listing cannot be published without a
 * phone or an email, so the public page must actually show one.
 *
 * Before this, `ExperiencePublicSchema` omitted `contactInfo` entirely, so the
 * only contact affordance on the page was the site-wide WhatsApp button —
 * which points at Hospeda's number, not the provider's. The datum was demanded
 * at publication time and then withheld from the person it was demanded for.
 *
 * ## What this suite proves, and how
 *
 * Vitest cannot render `.astro` in this repo (documented in
 * `test/components/account/PartnerMentionsSection.test.ts`), so:
 *
 * - The FIELD SELECTION — which contact keys become public and which are
 *   stripped — is asserted BEHAVIORALLY against the real Zod schema. That is
 *   the layer that actually enforces it (`stripWithSchema` strips unknown keys
 *   before the payload leaves the API), so these tests execute the control
 *   rather than describing it.
 * - The transform is asserted behaviorally too.
 * - The component/page WIRING is asserted with static guards, that being the
 *   only layer a source test can reach.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ExperiencePublicSchema } from '@repo/schemas';
import { describe, expect, it } from 'vitest';

const COMPONENT_SRC = readFileSync(
    resolve(__dirname, '../../src/components/experience/ExperienceContactBlock.astro'),
    'utf8'
);

const PAGE_SRC = readFileSync(
    resolve(__dirname, '../../src/pages/[lang]/experiencias/[slug].astro'),
    'utf8'
);

/** Strips comments so wiring assertions read CODE, not the prose about it. */
function stripComments(source: string): string {
    return source
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/^\s*\/\/.*$/gm, '');
}

const COMPONENT_CODE = stripComments(COMPONENT_SRC);
const PAGE_CODE = stripComments(PAGE_SRC);

/**
 * Parses through the public schema's `contactInfo` field.
 *
 * Reads the shape lazily and asserts the field EXISTS first. Without that, an
 * edit that drops `contactInfo` from the public schema (i.e. reintroduces the
 * HOS-815 bug) makes this module throw at COLLECTION time, and vitest reports
 * "no tests" — technically red, but a signal that reads like a broken file
 * rather than a broken contract.
 */
function parsePublicContactInfo(row: unknown): Record<string, unknown> | null | undefined {
    const field = ExperiencePublicSchema.shape.contactInfo;
    expect(
        field,
        'ExperiencePublicSchema must declare `contactInfo` — an experience cannot be published without a phone or an email, so the public page has to be able to show one (HOS-815)'
    ).toBeDefined();
    return field.parse(row) as Record<string, unknown> | null | undefined;
}

/** A row carrying every key `contact_info` can hold. */
const FULL_CONTACT_ROW = {
    personalEmail: 'leandro.personal@gmail.com',
    workEmail: 'contacto@kayakaventura.com.ar',
    homePhone: '+54 3442 111111',
    workPhone: '+54 3442 222222',
    mobilePhone: '+54 3447 412233',
    whatsapp: '+54 9 3447 412233',
    website: 'https://kayakaventura.com.ar',
    preferredEmail: 'WORK',
    preferredPhone: 'MOBILE'
};

// ============================================================================
// 1. THE FIX — the required datum now reaches the public payload
// ============================================================================

describe('HOS-815 — the public experience payload publishes a contact channel', () => {
    it('keeps the business email, phones and website', () => {
        const parsed = parsePublicContactInfo(FULL_CONTACT_ROW);

        expect(parsed).toMatchObject({
            workEmail: 'contacto@kayakaventura.com.ar',
            workPhone: '+54 3442 222222',
            mobilePhone: '+54 3447 412233',
            website: 'https://kayakaventura.com.ar'
        });
    });

    it('publishes the exact pair from the issue report', () => {
        const parsed = parsePublicContactInfo({
            workEmail: 'contacto@kayakaventura.com.ar',
            mobilePhone: '+54 3447 412233'
        });

        expect(parsed?.workEmail).toBe('contacto@kayakaventura.com.ar');
        expect(parsed?.mobilePhone).toBe('+54 3447 412233');
    });

    it('tolerates a legacy phone format the strict WRITE regex would reject', () => {
        // HOS-190 read-superset-of-write: a stored `0223-155-1234` must not 500
        // the public page.
        expect(() => parsePublicContactInfo({ workPhone: '0223-155-1234' })).not.toThrow();
    });

    it('accepts a null / absent contactInfo without throwing', () => {
        expect(() => parsePublicContactInfo(null)).not.toThrow();
        expect(() => parsePublicContactInfo(undefined)).not.toThrow();
    });

    it('declares contactInfo on the public schema at all', () => {
        expect(ExperiencePublicSchema.shape.contactInfo).toBeDefined();
    });
});

// ============================================================================
// 2. THE NARROWING — non-published fields must never reach an anonymous visitor
// ============================================================================

describe('HOS-815 privacy — the public payload strips the non-published keys', () => {
    const parsed = () => parsePublicContactInfo(FULL_CONTACT_ROW);

    it('never publishes personalEmail', () => {
        expect(parsed()).not.toHaveProperty('personalEmail');
    });

    it('never publishes homePhone', () => {
        expect(parsed()).not.toHaveProperty('homePhone');
    });

    it('never publishes whatsapp — it stays gated by the VIEWER plan (HOS-19)', () => {
        // This response is shared-cached with no auth in the cache key, so
        // emitting the gated number here would serve it to everyone.
        expect(parsed()).not.toHaveProperty('whatsapp');
    });

    it('never publishes the internal routing preferences', () => {
        const value = parsed();
        expect(value).not.toHaveProperty('preferredEmail');
        expect(value).not.toHaveProperty('preferredPhone');
    });

    it('publishes exactly four keys and no more', () => {
        // Fail-closed: a new key added to `contact_info` is NOT published until
        // someone deliberately adds it to the public schema, and this count is
        // what makes that a decision instead of an accident.
        expect(Object.keys(parsed() ?? {}).sort()).toEqual([
            'mobilePhone',
            'website',
            'workEmail',
            'workPhone'
        ]);
    });

    it('strips an unknown key an imported row might carry', () => {
        const withJunk = parsePublicContactInfo({
            workEmail: 'a@b.com',
            secretInternalNote: 'do not publish'
        });

        expect(withJunk).not.toHaveProperty('secretInternalNote');
    });
});

// ============================================================================
// 3. WIRING
// ============================================================================

describe('HOS-815 wiring — the page renders the contact block', () => {
    it('imports and renders ExperienceContactBlock', () => {
        expect(PAGE_CODE).toMatch(
            /import\s+ExperienceContactBlock\s+from\s+['"]@\/components\/experience\/ExperienceContactBlock\.astro['"]/
        );
        expect(PAGE_CODE).toMatch(/<ExperienceContactBlock/);
    });

    it('feeds it the transformed contactInfo', () => {
        expect(PAGE_CODE).toMatch(/contactInfo=\{experience\.contactInfo\}/);
    });
});

describe('HOS-815 wiring — the component follows the site conventions', () => {
    it('renders a tel: link and a mailto: link', () => {
        expect(COMPONENT_CODE).toContain('tel:');
        expect(COMPONENT_CODE).toContain('mailto:');
    });

    it('strips separators out of the tel: href but keeps them in the label', () => {
        expect(COMPONENT_CODE).toMatch(/replace\(\/\[\^\\d\+\]\/g,\s*''\)/);
    });

    it('routes the provider website through the safe-URL allow-list', () => {
        // `z.string().url()` accepts `javascript:`; this allow-list is the
        // control that keeps a payload out of the href (HOS-592 / F-02).
        expect(COMPONENT_CODE).toMatch(
            /import\s*\{\s*resolveSafeExternalUrl\s*\}\s*from\s*['"]@\/lib\/safe-external-url['"]/
        );
        expect(COMPONENT_CODE).toMatch(/resolveSafeExternalUrl\(contactInfo\?\.website/);
    });

    it('marks the outbound site link noopener noreferrer, not sponsored', () => {
        expect(COMPONENT_CODE).toContain('rel="noopener noreferrer"');
        expect(COMPONENT_CODE).not.toContain('sponsored');
    });

    it('never renders the private contact fields even if a payload carried them', () => {
        expect(COMPONENT_CODE).not.toContain('personalEmail');
        expect(COMPONENT_CODE).not.toContain('homePhone');
    });

    it('does not invent a WhatsApp deep link from the mobile number', () => {
        // Deliberate: the repo keeps WhatsApp a separate, entitlement-gated
        // channel sourced only from `contactInfo.whatsapp`. Deriving one from a
        // mobile line would invent a channel the provider never opted into.
        expect(COMPONENT_CODE).not.toContain('wa.me');
        expect(COMPONENT_CODE).not.toContain('buildWhatsAppLink');
    });

    it('uses no HTML injection sink', () => {
        expect(COMPONENT_CODE).not.toContain('set:html');
    });

    it('renders nothing when there is no publishable channel', () => {
        // The three seeded experience listings have an empty `contact_info`;
        // an empty contact card would be worse than none.
        expect(COMPONENT_CODE).toMatch(
            /if\s*\(phones\.length === 0 && !workEmail && !websiteHref\)\s*\{\s*return;/
        );
    });
});
