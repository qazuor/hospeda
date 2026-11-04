/**
 * @file hos95-map-regressions.test.ts
 * @description Source-level regression assertions for HOS-95 map fixes:
 * marker-icon-path fix, destination declustering, destination popup autoPan,
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

const mapaAstroSource = readFileSync(
    resolve(__dirname, '../../../src/pages/[lang]/destinos/mapa.astro'),
    'utf8'
);

describe('HOS-95 map regressions', () => {
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

    it('destination popup auto-pans so an edge-pin popup is never clipped by the map frame', () => {
        expect(innerSource).toContain('autoPan={true}');
        expect(innerSource).toContain('autoPanPadding={[24, 24]}');
    });

    it('accommodation popup is a floating card portaled outside the Leaflet container, not an eager Popup', () => {
        expect(innerSource).toContain('createPortal(');
        expect(innerSource).toContain('AccommodationCardPopup');
        expect(innerSource).toContain('latLngToContainerPoint');
    });

    it('closes any open popup on drag/zoom/click interaction', () => {
        expect(innerSource).toContain('ClosePopupOnInteract');
    });

    it('reserves the destination-popup image height before the image loads', () => {
        expect(cssSource).toContain('.popupImageWrapper');
        expect(cssSource).toContain('aspect-ratio: 16 / 9');
    });

    it('defines the floating accommodation card style', () => {
        expect(cssSource).toContain('.floatingCard');
    });

    it('regression: i18n namespace typo — mapa.astro uses the plural "destinations" namespace', () => {
        expect(mapaAstroSource).toContain("tPlural('destinations.card.accommodation'");
        expect(mapaAstroSource).not.toContain("tPlural('destination.card.accommodation'");
    });
});
