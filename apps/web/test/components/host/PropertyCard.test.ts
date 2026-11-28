/**
 * @file PropertyCard.test.ts
 * @description Integration tests for PropertyCard.astro — verifies admin-only
 * edit links were removed (SPEC-205 Phase 4), that web-native edit link
 * was added (SPEC-208 PR2), and that the thumbnail is requested through the
 * Cloudinary transform pipeline rather than the original upload (HOS-637).
 *
 * `.astro` files cannot be rendered by vitest in this repo (no Astro vite
 * plugin in the test pipeline), so the HOS-637 assertions read the SOURCE —
 * same documented pattern as `PartnerMentionsSection.test.ts`. To keep the
 * source check from being vacuous (`toContain('getMediaUrl')` alone would
 * survive a mutation that calls `getMediaUrl` on the WRONG variable), it is
 * paired with a real call to `getMediaUrl` using the exact preset/options
 * this component applies, proving those options actually shrink a
 * representative Cloudinary URL instead of merely being present in the file.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { getMediaUrl } from '@repo/media';
import { describe, expect, it } from 'vitest';

const propertyCardSource = readFileSync(
    resolve(__dirname, '../../../src/components/account/OwnerListingCard.astro'),
    'utf8'
);

describe('PropertyCard.astro — SPEC-205 Phase 4 + SPEC-208 PR2', () => {
    it('should NOT contain an admin-only edit link', () => {
        // The old edit link pointed to admin: /accommodations/{id}/edit
        // SPEC-208 PR2 replaced it with a web editor link using buildUrl
        // publishUrl still uses adminBase, but editUrl must use buildUrl
        expect(propertyCardSource).not.toMatch(/editUrl.*adminBase/);
    });

    it('should contain a web editor link using buildUrl', () => {
        // SPEC-208 PR2: edit link routes to the web editor page
        expect(propertyCardSource).toContain('editUrl');
        expect(propertyCardSource).toContain('mi-cuenta/propiedades/');
        expect(propertyCardSource).toContain('/editar');
    });

    it('should render an "Editar" action button', () => {
        // The edit button text should appear in the template actions section
        expect(propertyCardSource).toContain('host.properties.card.actions.edit');
    });

    it('should still contain the publish action for DRAFT properties', () => {
        // HOS-110: the dead `?action=publish` admin link was replaced by a
        // guided web-native PublishButton island with trial confirmation copy.
        expect(propertyCardSource).toContain('PublishButton');
        expect(propertyCardSource).toContain('host.properties.card.actions.publish');
    });

    it('should still contain the view-on-site link for ACTIVE properties', () => {
        expect(propertyCardSource).toContain('viewOnSiteUrl');
        expect(propertyCardSource).toContain('host.properties.card.actions.viewOnSite');
    });

    it('should still contain the unpublish link for ACTIVE properties', () => {
        // SPEC-208 PR2: unpublish uses a React island (UnpublishButton) rather than a plain anchor.
        // The component conditionally renders UnpublishButton only for ACTIVE properties and
        // passes the unpublish i18n label + the accommodationId prop.
        // HOS-2483: Despublicar lives in the card menu, which mounts the
        // UnpublishButton island on its confirmation step.
        expect(propertyCardSource).toContain('<PropertyCardMenu');
        expect(propertyCardSource).toContain('host.properties.card.actions.unpublish');
    });
});

describe('PropertyCard.astro — HOS-637 thumbnail transform', () => {
    it('imports getMediaUrl and applies it to the raw thumbnail before rendering it', () => {
        expect(propertyCardSource).toContain("import { getMediaUrl } from '@repo/media'");
        // The raw gallery/featuredImage/placeholder fallback chain must feed
        // getMediaUrl, not the <img> directly — this is what a regression
        // (dropping the getMediaUrl call, or re-inlining the raw chain into
        // thumbnailUrl) would break.
        expect(propertyCardSource).toContain(
            "? getMediaUrl(rawThumbnailUrl, { preset: 'card', height: 220 })"
        );
        expect(propertyCardSource).toContain('{ src: thumbnailUrl, alt: thumbnailAlt }');
        // Guard against the exact regression this issue reported: the <img>
        // binding directly to the untransformed chain.
        expect(propertyCardSource).not.toContain('src={rawThumbnailUrl}');
    });

    it('the chosen preset+options actually shrink a representative original photo URL', () => {
        // Mirrors the real 4000x2252 photo from the F-38 smoke finding: a bare
        // Cloudinary upload URL with no transform segment.
        const originalUrl =
            'https://res.cloudinary.com/hospeda/image/upload/v1699999999/hospeda/prod/accommodation-x/original.jpg';

        const transformedUrl = getMediaUrl(originalUrl, { preset: 'card', height: 220 });

        expect(transformedUrl).not.toBe(originalUrl);
        expect(transformedUrl).toContain('/upload/w_400,h_220,c_fill');
        expect(transformedUrl).toContain('q_auto');
        expect(transformedUrl).toContain('f_auto');
        expect(transformedUrl).toContain('dpr_auto');
    });
});

/**
 * HOS-2688 — the QR left the card. The «⋯» menu carries a «Código QR» entry that
 * leads to the listing's own QR page, for every vertical.
 *
 * `.astro` files cannot be rendered by vitest in this repo, so these read the
 * SOURCE, the same documented pattern the HOS-637 block above uses. Each
 * assertion isolates the ONE expression it is about. The menu item itself is
 * rendered for real in `test/components/host/PropertyCardMenu.test.tsx`, the
 * page in `test/pages/listing-qr-page.test.ts`.
 */
describe('OwnerListingCard.astro — HOS-2688 QR entry instead of the QR block', () => {
    const qrEntry = /const qrCodeEntry = [\s\S]*?: undefined;/.exec(propertyCardSource)?.[0] ?? '';

    it('no longer renders the QR-sheet island or any footer block', () => {
        expect(propertyCardSource).not.toContain('<ListingQrSheet');
        expect(propertyCardSource).not.toContain('ListingQrSheet.client');
        expect(propertyCardSource).not.toContain('slot="footer"');
    });

    it("builds the entry from the QR-page path of the card's own vertical", () => {
        expect(propertyCardSource).toContain(
            'const qrPageUrl = buildUrl({ locale, path: buildListingQrPagePath({ vertical, listingId: entity.id }) });'
        );
        expect(qrEntry).toContain('actions.qrCodeEntry');
        expect(qrEntry).toContain('href: qrPageUrl');
    });

    it('disables it with the reason until the listing is PUBLISHED (HOS-1641 rule)', () => {
        expect(qrEntry).toContain('disabled: !actions.canPrintQrSheet');
        expect(qrEntry).toMatch(
            /actions\.canPrintQrSheet\s*\?\s*t\('listing\.owner\.qrPage\.menuItem'\)\s*:\s*t\('listing\.owner\.qrPage\.menuItemUnpublished'\)/
        );
        expect(propertyCardSource).not.toContain('property.visibility');
        expect(propertyCardSource).not.toContain('VisibilityEnum');
    });

    it('hands it to the accommodation menu', () => {
        const menuElement =
            /<PropertyCardMenu\b[\s\S]*?\/>\s*\)\}/.exec(propertyCardSource)?.[0] ?? '';
        expect(menuElement).toContain('qrCode={qrCodeEntry}');
    });

    it('gives venue/experience a menu for it even without the edit entry', () => {
        expect(propertyCardSource).toContain(
            "...(qrCodeEntry ? [{ id: 'qr-code', ...qrCodeEntry }] : [])"
        );
        expect(propertyCardSource).toMatch(
            /\{listing && listingMenuItems\.length > 0 && \(\s*<Menu[\s\S]*?items=\{listingMenuItems\}/
        );
    });

    it('passes the one-time notice to a first publish only, never to a republish', () => {
        expect(propertyCardSource).toMatch(/const qrNotice = actions\.republish\s*\?\s*undefined/);
        expect(propertyCardSource).toContain('qrNotice={qrNotice}');
    });
});

/**
 * HOS-1641 (Coord-351 F4, H11) — the card reads `publicationStatus` and a
 * `PURGED` listing renders no action. The table itself is pure and tested in
 * `test/lib/host/property-card-actions.test.ts`; these pin that the template
 * gates EVERY action on it, so no element can render outside its flag.
 */
describe('PropertyCard.astro — actions per publication state (HOS-1641)', () => {
    const menuElement = /<PropertyCardMenu\b[\s\S]*?\/>\s*\)\}/.exec(propertyCardSource)?.[0] ?? '';

    it('reads publicationStatus, never the old columns', () => {
        expect(propertyCardSource).toContain('const publicationStatus = entity.publicationStatus;');
        expect(propertyCardSource).toContain(
            'const actions = resolvePropertyCardActions({ publicationStatus });'
        );
        expect(propertyCardSource).not.toMatch(
            /property\.(lifecycleState|visibility|moderationState)/
        );
        expect(propertyCardSource).not.toContain('LifecycleStatusEnum');
    });

    it('omits the menu when no action applies (PURGED)', () => {
        expect(propertyCardSource).toContain(
            'const hasAnyAction = hasAnyPropertyCardAction({ actions });'
        );
        expect(propertyCardSource).toMatch(/\{property && hasAnyAction && \(\s*<PropertyCardMenu/);
    });

    it('HOS-2483: ONE primary action — Publish when offered, else Edit, else nothing', () => {
        expect(propertyCardSource).toMatch(
            /\{showPublish \? \(\s*<PublishButton\s+slot="primaryAction"[\s\S]*?\) : actions\.edit \? \(\s*<LinkButton slot="primaryAction" href=\{editUrl\}/
        );
        expect(propertyCardSource.match(/slot="primaryAction"/g)).toHaveLength(2);
    });

    it.each([
        ['edit', 'edit={showPublish && actions.edit ?'],
        ['viewOnSite', 'viewOnSite={actions.viewOnSite ?'],
        ['unpublish', 'unpublish={actions.unpublish ?'],
        ['delete', 'remove={actions.delete ?']
    ])('gates the %s menu entry on its own flag', (_flag, gate) => {
        expect(menuElement).toContain(gate);
    });

    it('HOS-1977: the single PublishButton is gated by showPublish, which is draft publish OR the republish offer', () => {
        expect(propertyCardSource).toContain(
            'const showRepublish = resolveRepublishOffer({ actions, affordance: publishAffordance });'
        );
        expect(propertyCardSource).toContain(': actions.publish || showRepublish;');
        // The copy switches on the republish flag and uses its own keys.
        expect(propertyCardSource).toContain('const publishCopy = actions.republish');
        expect(propertyCardSource).toContain('host.properties.card.actions.republish');
        // No other gate may lead to the island.
        expect(propertyCardSource).not.toContain('{actions.publish && (');
    });

    it('renders each action element exactly once in the whole card', () => {
        for (const element of ['<PropertyCardMenu', '<PublishButton']) {
            expect(propertyCardSource.split(element).length - 1, element).toBe(1);
        }
    });

    it.each([
        ['DRAFT', 'host.properties.card.status.DRAFT'],
        ['PUBLISHED', 'host.properties.card.status.PUBLISHED'],
        ['UNPUBLISHED_BY_BILLING', 'host.properties.card.status.UNPUBLISHED_BY_BILLING'],
        ['ARCHIVED', 'host.properties.card.status.ARCHIVED'],
        ['MODERATED', 'host.properties.card.status.MODERATED'],
        ['PURGED', 'host.properties.card.status.PURGED']
    ])('labels the %s badge with its own key', (status, key) => {
        const entry = new RegExp(
            `\\[PublicationStatusEnum\\.${status}\\]: \\{\\s*label: t\\('${key.replaceAll('.', '\\.')}'`
        );
        expect(propertyCardSource).toMatch(entry);
    });

    it('no longer names the retired INACTIVE/SUSPENDED labels', () => {
        expect(propertyCardSource).not.toContain('card.status.INACTIVE');
        expect(propertyCardSource).not.toContain('card.status.SUSPENDED');
    });
});

describe('PropertyCard.astro — the publish affordance fails closed (HOS-1668)', () => {
    // HOS-1668 C-2: a caller that did not resolve the decision gets the
    // fail-closed affordance, never a default that publishes.
    it('defaults the publish affordance to UNKNOWN_PUBLISH_AFFORDANCE', () => {
        expect(propertyCardSource).toContain('publishAffordance = UNKNOWN_PUBLISH_AFFORDANCE');
        expect(propertyCardSource).not.toMatch(/canPublish\s*=\s*true/);
        expect(propertyCardSource).not.toContain('firstPublishPaused');
    });

    // HOS-1668 C-1: the island receives the affordance itself and the
    // translated check-failed text.
    it('forwards the affordance and the check-failed text to PublishButton', () => {
        expect(propertyCardSource).toContain(
            'listingId={entity.id}\n            vertical={vertical}'
        );
        expect(propertyCardSource).toContain('affordance={publishAffordance}');
        expect(propertyCardSource).toContain(
            "checkFailedText={t('host.properties.card.publishCheckFailed')}"
        );
    });

    it('keeps the accommodation-specific unpublish prop unchanged', () => {
        expect(propertyCardSource).toContain('accommodationId: property.id,');
    });
});

describe('PropertyCard.astro — the listing notices and the unpublish lines (HOS-1492)', () => {
    it('TEST:V8a:5 / TEST:V8a:7 mounts the notices with this listing entry of the read', () => {
        expect(propertyCardSource).toContain(
            "import ListingNotices from '@/components/listing/ListingNotices.astro';"
        );
        expect(propertyCardSource).toContain(
            '<ListingNotices locale={locale} vertical={vertical} listingId={entity.id} item={notices} />'
        );
    });

    it('TEST:V8a:7 rows 2 and 25 reach the unpublish confirmation from the read, never derived here', () => {
        expect(propertyCardSource).toContain(
            'const unpublishNotes = buildUnpublishConfirmNotes({ locale, t, tPlural, trialRunning, item: notices });'
        );
        expect(propertyCardSource).toContain('trialNote: unpublishNotes.trialNote,');
        expect(propertyCardSource).toContain('recurringNote: unpublishNotes.recurringNote,');
        expect(propertyCardSource).toContain(
            'recurringAddonNames: unpublishNotes.recurringAddonNames,'
        );
        expect(propertyCardSource).toContain('withdrawHref: unpublishNotes.withdrawHref,');
    });

    it('an unknown trial defaults to null (no trial line), not to a running trial', () => {
        expect(propertyCardSource).toMatch(/trialRunning = null\n\} = Astro\.props;/);
    });
});
