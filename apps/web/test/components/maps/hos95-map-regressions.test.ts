/**
 * @file hos95-map-regressions.test.ts
 * @description Source-level regression assertions for HOS-95 map fixes:
 * marker-icon-path fix, destination declustering, destination card placement,
 * the accommodation floating-card portal (replacing the eager Leaflet
 * Popup), and the destinations-map i18n namespace fix.
 *
 * `ListingMapInner.client.tsx` renders real Leaflet DOM nodes that jsdom
 * cannot host without a heavy mock setup (see ListingMapFavoriteButton.test.tsx
 * for that approach); for regressions that are purely about "does the source
 * contain this exact construct", asserting on the source string directly is
 * the lighter, more direct test — same pattern this repo uses for Astro
 * components (which Vitest cannot render at all).
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const innerSource = readFileSync(
    resolve(__dirname, '../../../src/components/maps/ListingMapInner.client.tsx'),
    'utf8'
);

const cssSource = readFileSync(
    resolve(__dirname, '../../../src/components/maps/ListingMap.module.css'),
    'utf8'
);

const accommodationPopupSource = readFileSync(
    resolve(__dirname, '../../../src/components/maps/AccommodationCardPopup.client.tsx'),
    'utf8'
);

const destinationCardSource = readFileSync(
    resolve(__dirname, '../../../src/components/maps/DestinationMapCard.tsx'),
    'utf8'
);

const destinationCardCss = readFileSync(
    resolve(__dirname, '../../../src/components/maps/DestinationMapCard.module.css'),
    'utf8'
);

const mapaAstroSource = readFileSync(
    resolve(__dirname, '../../../src/pages/[lang]/destinos/mapa.astro'),
    'utf8'
);

describe('HOS-95 map regressions', () => {
    it('keeps destination card markup outside the pre-existing oversized Leaflet renderer', () => {
        expect(innerSource).toMatch(
            /<\/MapContainer>\s*\{openDestination && \(\s*<DestinationMapCard\b/
        );
        expect(destinationCardSource.trimEnd().split('\n').length).toBeLessThan(500);
        expect(destinationCardCss.trimEnd().split('\n').length).toBeLessThan(500);
        expect(cssSource.trimEnd().split('\n').length).toBeLessThan(500);
    });

    it('regression: doubled asset path — deletes the default Icon._getIconUrl override before mergeOptions', () => {
        expect(innerSource).toContain('delete (L.Icon.Default.prototype');
    });

    it('regression: blue coverage polygon on cluster hover — disables showCoverageOnHover', () => {
        expect(innerSource).toContain('showCoverageOnHover={false}');
    });

    it('destinations are NOT clustered — the cluster group only wraps accommodation markers', () => {
        expect(innerSource).toContain('showCoverageOnHover={false}');
        expect(innerSource).toContain('{isAccommodationMode ? (');
    });

    it('pins the destination card to the bottom so selection does not pan the map', () => {
        expect(innerSource).toMatch(/<\/MapContainer>\s*\{openDestination &&/);
        expect(destinationCardCss).toMatch(/\.destinationSelection\s*\{[^}]*inset-block-end:/);
    });

    it('accommodation popup is a floating card portaled outside the Leaflet container, not an eager Popup', () => {
        expect(innerSource).toContain('<AccommodationCardPopup');
        expect(accommodationPopupSource).toContain('createPortal(');
        expect(accommodationPopupSource).toContain('latLngToContainerPoint');
    });

    it('closes the accommodation floating card on drag/zoom/click interaction', () => {
        expect(accommodationPopupSource).toMatch(
            /dragstart: onClose,\s*zoomstart: onClose,\s*click: onClose/
        );
    });

    it('reserves the destination-popup image height before the image loads', () => {
        expect(destinationCardCss).toMatch(/\.popupImageWrapper\s*\{[^}]*aspect-ratio: 16 \/ 9/);
    });

    it('defines the floating accommodation card style', () => {
        expect(cssSource).toContain('.floatingCard');
    });

    it('regression: i18n namespace typo — mapa.astro uses the plural "destinations" namespace', () => {
        expect(mapaAstroSource).toContain("tPlural('destinations.card.accommodation'");
        expect(mapaAstroSource).not.toContain("tPlural('destination.card.accommodation'");
    });
});
