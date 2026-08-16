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

    it('derives hasContact from phone/email/website only — never from whatsapp', () => {
        expect(src).toContain(
            'contactInfo && (contactInfo.phone || contactInfo.email || websiteHref)'
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

    it('renders the phone link as a tel: URI with no target/rel (internal-scheme link)', () => {
        // biome-ignore lint/suspicious/noTemplateCurlyInString: asserting literal source text, not interpolating.
        expect(src).toContain('href={`tel:${contactInfo.phone}`}');
    });

    it('renders the email link as a mailto: URI with no target/rel (internal-scheme link)', () => {
        // biome-ignore lint/suspicious/noTemplateCurlyInString: asserting literal source text, not interpolating.
        expect(src).toContain('href={`mailto:${contactInfo.email}`}');
    });

    it('renders the website link with rel="noopener noreferrer", not sponsored/nofollow', () => {
        const websiteBlock = src.slice(
            src.indexOf('href={websiteHref}'),
            src.indexOf('href={websiteHref}') + 300
        );
        expect(websiteBlock).toContain('target="_blank"');
        expect(websiteBlock).toContain('rel="noopener noreferrer"');
        expect(websiteBlock).not.toContain('sponsored');
        expect(websiteBlock).not.toContain('nofollow');
    });

    it('renders the Facebook link with rel="noopener noreferrer", not sponsored/nofollow', () => {
        const fbBlock = src.slice(
            src.indexOf('href={facebookHref}'),
            src.indexOf('href={facebookHref}') + 300
        );
        expect(fbBlock).toContain('target="_blank"');
        expect(fbBlock).toContain('rel="noopener noreferrer"');
        expect(fbBlock).not.toContain('sponsored');
        expect(fbBlock).not.toContain('nofollow');
    });

    it('renders the Instagram link with rel="noopener noreferrer", not sponsored/nofollow', () => {
        const igBlock = src.slice(
            src.indexOf('href={instagramHref}'),
            src.indexOf('href={instagramHref}') + 300
        );
        expect(igBlock).toContain('target="_blank"');
        expect(igBlock).toContain('rel="noopener noreferrer"');
        expect(igBlock).not.toContain('sponsored');
        expect(igBlock).not.toContain('nofollow');
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
