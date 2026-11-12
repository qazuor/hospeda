/**
 * @file outbound-href-migration.test.ts
 * @description Per-component regression tests for HOS-592 (production finding
 * F-02): the outbound links that used to render a stored URL raw.
 *
 * The static guard next door (`test/static-guards/outbound-href-sanitization`)
 * is what stops the TENTH call site. These pin the nine that existed, one row
 * per rendered `href`, so a revert shows up as a named component rather than as
 * one line in a guard's list.
 *
 * Vitest cannot render `.astro`, so for those components the assertion is on
 * the source text — but deliberately on the ATTRIBUTE, not on the file at
 * large: `href={websiteHref}` present AND `href={partner.websiteUrl}` absent
 * says the rendered link changed, where "the file mentions the sanitizer
 * somewhere" would not.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC_ROOT = join(__dirname, '../../src');

/** One migrated outbound link. */
interface MigratedLink {
    /** Path under `apps/web/src`. */
    readonly file: string;
    /** What the component renders now. */
    readonly renders: readonly string[];
    /** The raw shape that used to ship, which must not come back. */
    readonly neverRenders: readonly string[];
}

const MIGRATED: readonly MigratedLink[] = [
    {
        // The finding itself: a gold partner's own page.
        file: 'pages/[lang]/partners/[slug].astro',
        renders: [
            'const websiteHref = resolveSafeExternalUrl(partner.websiteUrl)',
            'href={websiteHref}',
            'href={link.href}'
        ],
        neverRenders: ['href={partner.websiteUrl}', 'href={link.url}']
    },
    {
        // The finding's second half: the home logo carousel, which renders its
        // track twice, so a raw value shipped the same link twice.
        file: 'lib/partner-logo-link.ts',
        renders: ['const websiteHref = resolveSafeExternalUrl(partner.url)', 'href: websiteHref'],
        neverRenders: ['href: partner.url']
    },
    {
        file: 'components/post/PostSponsorshipBanner.astro',
        renders: ['resolveSafeExternalUrl(sponsorship.websiteUrl)', 'href={websiteHref}'],
        neverRenders: ['href={sponsorship.websiteUrl}']
    },
    {
        file: 'components/event/EventDetailOrganizerCard.astro',
        renders: [
            'resolveSafeExternalUrl(contact?.website)',
            'href={websiteHref}',
            'href={facebookHref}',
            'href={instagramHref}',
            'href={twitterHref}',
            'href={youtubeHref}',
            'href={linkedinHref}'
        ],
        neverRenders: [
            'href={contact.website}',
            'href={social.facebook}',
            'href={social.instagram}',
            'href={social.twitter}',
            'href={social.youtube}',
            'href={social.linkedin}'
        ]
    },
    {
        file: 'components/experience/ExperienceInfo.astro',
        renders: ['const href = resolveSafeExternalUrl(', 'href={href}'],
        neverRenders: ['href={url}']
    },
    {
        file: 'components/venue/VenueContactBlock.astro',
        renders: [
            'const menuHref = resolveSafeExternalUrl(menuUrl)',
            'const href = resolveSafeExternalUrl(socialNetworks?.[key])',
            'href={menuHref}',
            'href={href}'
        ],
        neverRenders: ['href={menuUrl}', 'href={url}']
    },
    {
        file: 'components/account/PartnerMentionsSection.astro',
        renders: ['resolveSafeExternalUrl(mention.url)', 'href={mentionHref}'],
        neverRenders: ['href={mention.url}']
    },
    {
        // The reputation block resolves every platform href through ONE helper,
        // which applies the allow-list to the deep link and then to the plain
        // listing URL. The component itself is pinned to that helper below.
        file: 'lib/external-reputation-visibility.ts',
        renders: [
            'resolveSafeExternalUrl(input.item.deepLink)',
            'resolveSafeExternalUrl(input.item.url)'
        ],
        neverRenders: []
    },
    {
        file: 'components/accommodation/ExternalReviews.client.tsx',
        renders: ['resolveSafeExternalUrl(snippet.authorUrl)', 'href={authorHref}'],
        neverRenders: ['href={snippet.authorUrl}']
    },
    {
        // Not in the original report — found by the guard's "one scheme
        // allow-list" prong, which flagged its local `startsWith('https://')`.
        file: 'components/host/host-trades/TradeCard.tsx',
        renders: ['resolveSafeExternalUrl(trimmed)'],
        neverRenders: ["trimmed.startsWith('https://')"]
    },
    {
        // Same: a local `^https?://` regex, replaced by the shared helper.
        file: 'lib/authors/author-social-links.ts',
        renders: ['resolveSafeExternalUrl(socialNetworks[key])'],
        neverRenders: ['/^https?:\\/\\//i.test(']
    }
];

describe.each(MIGRATED)('$file — outbound href sanitization (HOS-592)', (link) => {
    const source = readFileSync(join(SRC_ROOT, link.file), 'utf8');

    it('imports the one scheme allow-list', () => {
        expect(source).toContain('resolveSafeExternalUrl');
    });

    it.each(link.renders)('renders %j', (snippet) => {
        expect(source).toContain(snippet);
    });

    it.each(link.neverRenders)('never renders %j again', (snippet) => {
        // The exact text that shipped the bug. `z.string().url()` accepts
        // `javascript:`, so this attribute WAS the sink.
        expect(source).not.toContain(snippet);
    });
});

describe('components/accommodation/ExternalReputation.astro — platform hrefs go through resolvePlatformHref (HOS-592)', () => {
    // The per-platform score row lives in its own component, so the block is
    // checked as the two files together.
    const source = [
        'components/accommodation/ExternalReputation.astro',
        'components/accommodation/ExternalReputationSummaryRow.astro'
    ]
        .map((file) => readFileSync(join(SRC_ROOT, file), 'utf8'))
        .join('\n');

    it('derives every platform href from the allow-listing helper', () => {
        expect(source).toContain('resolvePlatformHref({ item })');
        expect(source).toContain('resolvePlatformHref({ item: googleItem })');
    });

    it.each([
        'href={deepLinkHref}',
        'href={pillHref}',
        'href={googleHref}'
    ])('renders %j', (snippet) => {
        expect(source).toContain(snippet);
    });

    it.each([
        'href={item.deepLink}',
        'href={item.url}',
        'href={googleItem.url}'
    ])('never renders the raw stored URL %j', (snippet) => {
        expect(source).not.toContain(snippet);
    });
});
