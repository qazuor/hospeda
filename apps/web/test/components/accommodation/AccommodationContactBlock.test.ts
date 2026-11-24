/**
 * @file AccommodationContactBlock.test.ts
 * @description Tests for `AccommodationContactBlock.astro` (H-118).
 *
 * Astro components cannot be rendered in Vitest (no DOM renderer for `.astro`
 * in this repo — see `apps/web/CLAUDE.md` Testing section: "Astro components |
 * Read source file, assert on content (no DOM renderer in Vitest)"). This
 * suite therefore asserts on the component SOURCE for what a DOM test would
 * otherwise check — the empty-state guard, the `rel` on every outbound link,
 * and that it never touches the WhatsApp number — mirroring the pattern used
 * by `WhatsNearbySection.test.ts` / `DestinationPOISection.test.ts`.
 *
 * The actual data decision behind the empty-state guard (whether
 * `contactInfo`/`socialNetworks` are present at all) is real, unit-testable
 * JS logic and is covered separately in
 * `test/lib/api/transforms.test.ts` — "contactInfo + socialNetworks (H-118)".
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(
    resolve(__dirname, '../../../src/components/accommodation/AccommodationContactBlock.astro'),
    'utf8'
);

describe('AccommodationContactBlock.astro (source-based)', () => {
    it('renders nothing when neither contactInfo nor socialNetworks has anything to show', () => {
        expect(src).toContain('if (!hasContact && !hasSocial) {');
        expect(src).toContain('return;');
    });

    it('derives hasContact from phone/landline/email/website only — never from whatsapp', () => {
        expect(src).toContain(
            'contactInfo && (contactInfo.phone || contactInfo.landlinePhone || contactInfo.email || websiteHref)'
        );
        // Defense in depth: the component's own logic must never reference a
        // whatsapp field at all, even though the prop type doesn't carry one.
        expect(src).not.toContain('contactInfo.whatsapp');
        expect(src).not.toContain('contactInfo?.whatsapp');
    });

    it('derives hasSocial from facebook/instagram only (owner decision, H-118)', () => {
        expect(src).toContain('Boolean(facebookHref || instagramHref)');
    });

    it('routes every host-authored URL through the scheme allow-list', () => {
        // `z.string().url()` accepts `javascript:` and `data:`, so the schema is
        // not what keeps a payload out of these hrefs — `resolveSafeExternalUrl`
        // is. These three fields are written by the host and published with no
        // review in between, so a raw href here is a stored-XSS sink.
        expect(src).toContain('resolveSafeExternalUrl(contactInfo?.website)');
        expect(src).toContain('resolveSafeExternalUrl(socialNetworks?.facebook)');
        expect(src).toContain('resolveSafeExternalUrl(socialNetworks?.instagram)');

        // And no outbound href may bypass it by reading the raw value.
        expect(src).not.toContain('href={contactInfo.website}');
        expect(src).not.toContain('href={socialNetworks.facebook}');
        expect(src).not.toContain('href={socialNetworks.instagram}');
    });

    it('builds the phone link as a tel: URI and the email link as a mailto: URI', () => {
        // biome-ignore lint/suspicious/noTemplateCurlyInString: asserting literal source text, not interpolating.
        expect(src).toContain('href: `tel:${contactInfo.phone}`');
        // biome-ignore lint/suspicious/noTemplateCurlyInString: asserting literal source text, not interpolating.
        expect(src).toContain('href: `mailto:${contactInfo.email}`');
    });

    it('hands the allow-listed website, Facebook and Instagram hrefs to the shared component', () => {
        expect(src).toContain('href: websiteHref');
        expect(src).toContain('href: facebookHref');
        expect(src).toContain('href: instagramHref');
        expect(src).toContain('Icon: FacebookIcon');
        expect(src).toContain('Icon: InstagramIcon');
    });

    it('delegates all markup (target/rel, buttons) to ListingContactChannels', () => {
        expect(src).toContain('<ListingContactChannels');
        expect(src).not.toContain('<GradientButton');
        expect(src).not.toContain('<IconButton');
        expect(src).not.toContain('target=');
    });

    it('never imports the WhatsApp icon or the WhatsAppContact island — that channel stays separate', () => {
        expect(src).not.toContain('WhatsAppIcon');
        expect(src).not.toContain('WhatsAppContact.client');
        expect(src).not.toContain('import { WhatsAppContact }');
    });

    it('uses the accommodations.detail.contact.* i18n namespace for every label', () => {
        expect(src).toContain("'accommodations.detail.contact.title'");
        expect(src).toContain("'accommodations.detail.contact.phoneAriaLabel'");
        expect(src).toContain("'accommodations.detail.contact.emailAriaLabel'");
        expect(src).toContain("'accommodations.detail.contact.websiteAriaLabel'");
        expect(src).toContain("'accommodations.detail.contact.facebookAriaLabel'");
        expect(src).toContain("'accommodations.detail.contact.instagramAriaLabel'");
    });

    it('does NOT import CSS Modules — vanilla scoped <style> per web conventions', () => {
        expect(src).not.toContain('.module.css');
    });
});
