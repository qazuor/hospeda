/**
 * @file outbound-href-sanitization.test.ts
 * @description Static guard for HOS-592 (production finding F-02): a partner's
 * `websiteUrl` reached an `href` raw, so a link on `hospeda.com.ar` could run
 * `javascript:` in this origin for any logged-out visitor who clicked it.
 *
 * ## Why a guard and not nine more unit tests
 *
 * Nine call sites had forgotten the gate. Fixing nine and writing nine
 * regression tests leaves the tenth exactly as unprotected as the nine were —
 * and this is the THIRD time this repo has created a canonical helper and left
 * old call sites on the old behaviour (`normalizeStoredSubscriptionStatus`,
 * `isEntitlementGrantingStatus`; the latter killed addon sales in production
 * for months). When N call sites forget a gate, the answer is one guard.
 *
 * ## Three questions, because one has an escape
 *
 * 1. **Every outbound link is sanitized.** Anchored on the `href` token and on
 *    the outbound markers (`target="_blank"`, `rel` naming
 *    `noopener`/`sponsored`/…) rather than on a syntactic shape — see the
 *    scanner's file docs for the four shapes a shape-anchored version missed.
 * 2. **Every href reading a known third-party URL field is sanitized**, whether
 *    or not it is marked outbound. This is the escape hatch for prong 1: a link
 *    that forgets `target`/`rel` is invisible to it, and `websiteUrl` /
 *    `menuUrl` / `deepLink` are the field names such a link would realistically
 *    read.
 * 3. **Nobody writes a second scheme allow-list.** The drift this issue is
 *    about is not only "forgot to call the helper" — `author-social-links.ts`
 *    had its own `^https?://` test, which is a fourth copy of the rule waiting
 *    to diverge. One place decides which schemes may be linked.
 *
 * Every exemption is a written reason, not a bare path: "it is safe" has to be
 * checkable by the next reader without re-deriving it.
 *
 * ## What was mutation-tested, so "it is green" means something
 *
 * Each of these was applied, watched fail, and removed again:
 * the original bug restored (`href={partner.websiteUrl}`, both prongs 1 and 2);
 * a fresh outbound link on a neutral identifier (`href={somethingElse}`, prong
 * 1 only); a third-party field linked with NO `target`/`rel` (prong 2 only);
 * and a local `^https?://` test put back into `author-social-links.ts` (prong
 * 3). Prong 3's first draft survived that last one — its regex could not read
 * an escaped `\\/` inside a regex literal — which is the reason it is written
 * as two explicit shapes now.
 *
 * ## What prong 3 still does not see
 *
 * `startsWith('http')` with no colon. `TradeCard.tsx` uses exactly that twice,
 * to decide `target`/`rel` — a presentation choice, not a gate — and matching
 * it would mean exempting that whole file, which would then also exempt a real
 * drift landing in it later. The narrower predicate is worth more than the
 * broader one plus a blanket exemption.
 */

import { readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
    collectSourceFiles,
    findLinkSites,
    findUnprovenOutboundSites,
    isOutbound,
    isSanitized,
    SANITIZER,
    siteKey
} from './outbound-href-sanitization';

const SRC_ROOT = join(__dirname, '../../src');

/**
 * Outbound links whose value is safe for a reason a scan cannot see.
 *
 * Two legitimate kinds live here, and nothing else may:
 *
 * - **This app composed the URL**, so its scheme is a literal in our own source
 *   (a `wa.me` intent, a Google Maps query, our own admin origin).
 * - **The sanitizer ran in another file**, so the value arrives already
 *   filtered. These name that file, so the claim can be followed.
 *
 * An entry is NOT a way to skip the helper for a value a stranger typed. If the
 * reason you would write is "it is probably fine", migrate the call site
 * instead.
 */
const SAFE_OUTBOUND_HREFS: Readonly<Record<string, string>> = Object.freeze({
    'components/ImageGallery.client.tsx#{current.credit.url}':
        '`PhotoCreditParts.url`, produced by `formatPhotoCredit`, which calls the sanitizer itself',
    'components/shared/ImageAttribution.astro#{credit.url}':
        'same `formatPhotoCredit` output as the lightbox above',
    'components/MapPlaceholder.astro#{mapsUrl}':
        'composed here as `https://maps.google.com/?q=` + an encoded address — the scheme is our literal',
    'components/ShareButtons.client.tsx#{link.href}':
        'share intents composed in this file from literal provider bases (wa.me, facebook.com/sharer, t.me)',
    'components/accommodation/ExternalReviews.client.tsx#{GOOGLE_ATTRIBUTION_HREF}':
        "module constant 'https://www.google.com/maps', required by the Google Places display policy",
    'components/accommodation/WhatsAppContact.client.tsx#{waUrl}':
        '`buildWhatsAppLink` composes `https://wa.me/<digits>`; a non-dialable number yields null, not a URL',
    'components/experience/ExperienceContactCTA.astro#{waUrl}':
        'same `buildWhatsAppLink` output as the accommodation CTA',
    'components/account/ProfileCompletionConsentFields.tsx#{`/${locale}/legal/terminos/`}':
        'an internal path literal; it carries `rel="noopener"` only because it opens in a new tab',
    'components/account/SubscriptionDashboard.client.tsx#{adminUrl}':
        '`getAdminUrl()` — our own admin panel origin, from validated env',
    'components/shared/navigation/MobileMenu.client.tsx#{adminPanelItem.href}':
        '`buildAdminPanelItem` over the same admin origin',
    'components/shared/navigation/UserMenu.client.tsx#{adminPanelItem.href}':
        '`buildAdminPanelItem` over the same admin origin',
    'components/host/PropertyCard.astro#{viewOnSiteUrl}':
        '`buildUrl` — an internal accommodation page opened in a new tab',
    'components/host/host-trades/TradeCard.tsx#{contactHref}':
        '`resolveContactHref` in this same file: it asks the sanitizer first and degrades everything else to `tel:`',
    'components/destination/DestinationPOIFilter.client.tsx#{href}':
        'an internal POI facet URL from `buildMultiToggleParamHref`; outbound only because HOS-524 puts `rel="nofollow"` on facet chips',
    'components/destination/DestinationPOIFilter.client.tsx#{clearChip.href}':
        'the same internal facet URL, for the "clear" chip',
    'components/destination/DestinationPOIFilter.client.tsx#clearChip.href':
        'not a link at all — the same value passed to `shouldNofollowFacetHref({ href })` one line below the chip',
    'components/newsletter/WhatsAppCTA.astro#{channelUrl}':
        'PUBLIC_HOSPEDA_WHATSAPP_CHANNEL_URL — our own channel, set by us in the deployment env',
    'components/shared/SocialLinks.astro#profile.url':
        "SOCIAL_PROFILES in `lib/constants` — Hospeda's own accounts, hardcoded",
    'components/shared/SocialLinks.astro#{href}':
        'the same SOCIAL_PROFILES list, destructured one line later',
    'lib/partner-logo-link.ts#buildUrl({ locale':
        "the GOLD branch, an internal `/partners/<slug>/` link; it reads as outbound only because the sibling website branch's `target: '_blank'` is inside the object window",
    'pages/[lang]/autores/[slug]/index.astro#{url}':
        '`resolveAuthorSocialLinks` (lib/authors/author-social-links.ts) runs the sanitizer per network',
    'pages/[lang]/partners/[slug].astro#{link.href}':
        "the `socialLinks` builder in this same file's frontmatter drops every value the sanitizer refuses",
    'pages/[lang]/contacto/index.astro#{channel.href}':
        'mailto:/tel:/wa.me composed in this file from i18n copy — our own contact details',
    'pages/[lang]/contacto/index.astro#{href}':
        "this file's literal instagram.com/facebook.com URLs plus the same wa.me link",
    'pages/[lang]/destinos/index.astro#{badgeHref}':
        'an internal facet URL from `buildBadgeHref`; outbound only because HOS-524 puts `rel="nofollow"` on facet chips',
    'pages/[lang]/preguntas-frecuentes/index.astro#{whatsappHref}':
        "module constant 'https://wa.me/543442453797'"
});

/**
 * Field names that carry a URL somebody outside Hospeda authored.
 *
 * Drawn from what actually reached an `href` in this codebase — a partner's and
 * a sponsor's `websiteUrl`, an event organizer's `website`, a commerce owner's
 * `menuUrl`, a photo's `sourceUrl`, and the two fields the external-reputation
 * payload carries from Google.
 */
const THIRD_PARTY_URL_FIELDS: readonly string[] = [
    'websiteUrl',
    'website',
    'menuUrl',
    'sourceUrl',
    'deepLink',
    'authorUrl',
    'socialNetworks',
    'externalUrl'
];

/**
 * A line that decides something by URL scheme.
 *
 * Two shapes, because a scheme check is written one of two ways: a regex
 * literal naming a scheme and then TESTED (`/^https?:\/\//i.test(x)`), or a
 * `startsWith('http')`. Requiring the `.test(`/`.match(` is what separates a
 * decision from the display-only `.replace(/^https?:\/\//, '')` that two
 * contact blocks use to trim a scheme off a label — the first draft of this
 * predicate matched the trims and, worse, matched neither shape of the real
 * thing, so the mutation walked straight past it.
 */
const SCHEME_PREDICATES: readonly RegExp[] = [
    /\/\^?[^\n]*?(https\?|javascript|vbscript)[^\n]*?\/[gimsuy]*\s*\.\s*(test|match)\s*\(/,
    /\.\s*startsWith\(\s*['"`]https?:/
];

/**
 * The one place other than the helper allowed to branch on a URL scheme.
 *
 * `composeSocialUrl` is a WRITE-side form helper: it decides whether a typed
 * value is already a full URL or a bare handle that needs `https://<domain>`
 * prefixed. It gates no `href` and grants nothing — the value it builds is
 * still sanitized on the read side before it is ever linked.
 */
const SCHEME_PREDICATE_EXEMPTIONS: Readonly<Record<string, string>> = Object.freeze({
    'components/host/editor/SocialNetworksSection.client.tsx':
        'composeSocialUrl — a write-side handle/URL discriminator, not a link gate'
});

describe('outbound hrefs — every link off this site goes through the allow-list', () => {
    it('has no outbound href that neither calls the sanitizer nor carries a written exemption', () => {
        const unproven = findUnprovenOutboundSites(SRC_ROOT).filter(
            (site) => !(siteKey(site) in SAFE_OUTBOUND_HREFS)
        );

        expect(
            unproven.map((site) => `${site.file}:${site.line} -> href=${site.expression}`),
            `An href pointing off this site must be fed by ${SANITIZER}() — the scheme allow-list in ` +
                'src/lib/safe-external-url.ts. `z.string().url()` accepts `javascript:`, `data:` and ' +
                '`vbscript:`, so a schema-validated URL is still a stored-XSS sink the moment it is ' +
                'rendered raw (HOS-592 / F-02). Either call the helper and drop the link when it ' +
                'returns undefined, or — if this URL is composed by our own code — add it to ' +
                'SAFE_OUTBOUND_HREFS with the reason.'
        ).toEqual([]);
    });

    it('keeps every exemption pointing at a link site that still exists', () => {
        // An exemption for a site that has been deleted or renamed silently
        // widens the allow-list: it stops describing anything, and the next
        // reader has no way to tell a live claim from a dead one.
        const live = new Set(findUnprovenOutboundSites(SRC_ROOT).map(siteKey));
        const stale = Object.keys(SAFE_OUTBOUND_HREFS).filter((key) => !live.has(key));

        expect(
            stale,
            'These SAFE_OUTBOUND_HREFS entries no longer match any unproven outbound href. ' +
                'If the call site was migrated to the sanitizer, delete the entry.'
        ).toEqual([]);
    });

    it('gives every exemption a non-empty reason', () => {
        const blank = Object.entries(SAFE_OUTBOUND_HREFS)
            .filter(([, reason]) => reason.trim().length === 0)
            .map(([key]) => key);

        expect(blank, 'An exemption without a reason is an assumption.').toEqual([]);
    });
});

describe('outbound hrefs — third-party URL fields never reach an href raw', () => {
    it('sanitizes every href that reads a field authored outside Hospeda', () => {
        // The escape hatch for the prong above: a link that forgets both
        // `target="_blank"` and `rel` is not "outbound" to the scanner, but a
        // `websiteUrl` in its href is still a payload waiting to be clicked.
        const field = new RegExp(`\\b(${THIRD_PARTY_URL_FIELDS.join('|')})\\b`);
        const offenders: string[] = [];

        for (const absolute of collectSourceFiles(SRC_ROOT)) {
            const source = readFileSync(absolute, 'utf8');
            const file = relative(SRC_ROOT, absolute).split(sep).join('/');
            for (const site of findLinkSites(source, file)) {
                if (field.test(site.expression) && !isSanitized(site, source)) {
                    offenders.push(`${site.file}:${site.line} -> href=${site.expression}`);
                }
            }
        }

        expect(
            offenders,
            `These hrefs read a third-party URL field without ${SANITIZER}(). Wrap the value, ` +
                'or read an already-sanitized binding instead of the raw field.'
        ).toEqual([]);
    });
});

describe('outbound hrefs — one scheme allow-list, not four', () => {
    it('has no second implementation of the scheme check', () => {
        const offenders: string[] = [];

        for (const absolute of collectSourceFiles(SRC_ROOT)) {
            const file = relative(SRC_ROOT, absolute).split(sep).join('/');
            if (file === 'lib/safe-external-url.ts' || file in SCHEME_PREDICATE_EXEMPTIONS) {
                continue;
            }
            const lines = readFileSync(absolute, 'utf8').split('\n');
            for (let i = 0; i < lines.length; i += 1) {
                if (SCHEME_PREDICATES.some((pattern) => pattern.test(lines[i]))) {
                    offenders.push(`${file}:${i + 1}  ${lines[i].trim()}`);
                }
            }
        }

        expect(
            offenders,
            'A local `^https?:` test is a second copy of the rule that decides which schemes may be ' +
                `linked, and copies drift — that is exactly what author-social-links.ts did. Call ${SANITIZER}() ` +
                'instead, or add a SCHEME_PREDICATE_EXEMPTIONS entry saying why this one gates no href.'
        ).toEqual([]);
    });
});

describe('outbound hrefs — the scanner itself', () => {
    // A guard nobody has watched fail is a guard nobody knows works. These
    // exercise the classifier on the exact shapes the first sketch of it missed.
    const shapes: readonly { readonly label: string; readonly source: string }[] = [
        { label: 'member expression', source: '<a href={p.websiteUrl} target="_blank">x</a>' },
        { label: 'bare identifier', source: '<a href={url} target="_blank">x</a>' },
        {
            label: 'template literal',
            // Assembled rather than written inline: a literal `${` inside a
            // plain string trips biome's noTemplateCurlyInString.
            source: `<a href={\`\${'$'}{base}/x\`} rel="noopener" target="_blank">x</a>`
        },
        { label: 'quoted attribute', source: '<a href="http://x" target="_blank">x</a>' },
        { label: 'object property', source: "const l = { href: p.url, target: '_blank' };" },
        {
            label: 'rel-only, no target',
            source: '<a href={p.url} rel="sponsored nofollow noopener">x</a>'
        },
        {
            label: 'multi-line attributes',
            source: '<a\n  href={p.url}\n  className={s.x}\n  target="_blank"\n>x</a>'
        }
    ];

    for (const { label, source } of shapes) {
        it(`sees an unsanitized outbound href written as a ${label}`, () => {
            const [site] = findLinkSites(source, 'probe.tsx');
            expect(site, `no href found in: ${source}`).toBeDefined();
            expect(isOutbound(site)).toBe(true);
            expect(isSanitized(site, source)).toBe(false);
        });
    }

    it('accepts an inline sanitizer call as proof', () => {
        const source = `<a href={${SANITIZER}(p.websiteUrl)} target="_blank">x</a>`;
        const [site] = findLinkSites(source, 'probe.tsx');
        expect(isSanitized(site, source)).toBe(true);
    });

    it('accepts a binding to the sanitizer as proof', () => {
        // Note the binding line itself is NOT a link site: `\bhref` does not
        // match inside `websiteHref`, which is what keeps the scan on
        // attributes and properties rather than on every identifier that
        // happens to end in "Href".
        const source = `const websiteHref = ${SANITIZER}(p.websiteUrl);\n<a href={websiteHref} target="_blank">x</a>`;
        const sites = findLinkSites(source, 'probe.tsx');
        expect(sites).toHaveLength(1);
        expect(sites[0].expression).toBe('{websiteHref}');
        expect(isSanitized(sites[0], source)).toBe(true);
    });

    it('does not accept a lookalike binding as proof', () => {
        // `websiteHref` bound to the RAW field must not pass just because the
        // file mentions the sanitizer somewhere else.
        const source = `const other = ${SANITIZER}(a);\nconst websiteHref = p.websiteUrl;\n<a href={websiteHref} target="_blank">x</a>`;
        const site = findLinkSites(source, 'probe.tsx').at(-1);
        expect(site).toBeDefined();
        expect(isSanitized(site as never, source)).toBe(false);
    });

    it('does not call an internal link outbound', () => {
        const source = '<a href={buildUrl({ locale, path: "x" })}>x</a>';
        const [site] = findLinkSites(source, 'probe.tsx');
        expect(isOutbound(site)).toBe(false);
    });

    it('does not read an href comparison as a link', () => {
        // `next.href === 'x'` matched the anchor before the `=(?!=)` guard.
        expect(findLinkSites("if (next.href === 'x') return;", 'probe.ts')).toEqual([]);
    });

    it('does not read an interface field as a link', () => {
        expect(findLinkSites('interface P { readonly href: string | null; }', 'probe.ts')).toEqual(
            []
        );
    });
});
