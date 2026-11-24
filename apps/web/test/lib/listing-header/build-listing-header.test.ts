/**
 * @file build-listing-header.test.ts
 * @description Unit tests of the pure header builders (HOS-2579 §6.3, AC-9,
 * AC-10, AC-11). The builders are the only per-vertical knowledge left after
 * the three headers became `ListingHeader.astro`.
 */

import { describe, expect, it } from 'vitest';
import type { AccommodationDetailData, ExperienceDetailData, VenueDetailData } from '@/data/types';
import {
    buildAccommodationHeader,
    buildExperienceHeader,
    buildVenueHeader,
    resolveHeaderLocation,
    resolveHeaderRating,
    resolveIsNewListing
} from '@/lib/listing-header/build-listing-header';

const NOW = Date.parse('2026-11-24T12:00:00Z');
const OLD = '2025-01-01T00:00:00Z';
const RECENT = '2026-11-20T00:00:00Z';
const SHARE_URL = 'https://hospeda.com.ar/es/x/';

const accommodation = (over: Partial<AccommodationDetailData> = {}): AccommodationDetailData =>
    ({
        id: 'acc-1',
        name: 'Cabaña del Río',
        type: 'CABIN',
        isFeatured: false,
        isVerified: false,
        createdAt: OLD,
        averageRating: 0,
        reviewsCount: 0,
        featuredImage: 'https://img/cover.jpg',
        destination: { id: 'd1', slug: 'colon', name: 'Colón' },
        ...over
    }) as unknown as AccommodationDetailData;

const venue = (over: Partial<VenueDetailData> = {}): VenueDetailData =>
    ({
        id: 'ven-1',
        name: 'Bar Central',
        type: 'BAR',
        isFeatured: false,
        createdAt: OLD,
        averageRating: 0,
        reviewsCount: 0,
        destinationName: 'Concepción del Uruguay',
        openingHours: null,
        ...over
    }) as unknown as VenueDetailData;

const experience = (over: Partial<ExperienceDetailData> = {}): ExperienceDetailData =>
    ({
        id: 'exp-1',
        name: 'Paseo en kayak',
        type: 'TOUR',
        isFeatured: false,
        createdAt: OLD,
        averageRating: 0,
        reviewsCount: 0,
        destinationName: 'Gualeguaychú',
        ...over
    }) as unknown as ExperienceDetailData;

const base = {
    locale: 'es' as const,
    shareUrl: SHARE_URL,
    hasMobileGalleryControls: true,
    now: NOW
};

describe('resolveHeaderLocation (AC-9)', () => {
    it('links to the destination page when the slug is known', () => {
        // Arrange / Act
        const { location } = resolveHeaderLocation({ name: 'Colón', slug: 'colon', locale: 'en' });
        // Assert
        expect(location).toEqual({ name: 'Colón', href: '/en/destinos/colon/' });
    });

    it('returns plain text (href null) without a slug, never an invented URL', () => {
        expect(resolveHeaderLocation({ name: 'Colón', slug: null, locale: 'es' }).location).toEqual(
            {
                name: 'Colón',
                href: null
            }
        );
        expect(
            resolveHeaderLocation({ name: 'Colón', slug: '  ', locale: 'es' }).location?.href
        ).toBeNull();
    });

    it('returns null without a destination name', () => {
        expect(
            resolveHeaderLocation({ name: '', slug: 'colon', locale: 'es' }).location
        ).toBeNull();
    });
});

describe('resolveHeaderRating (AC-10)', () => {
    it('keeps a 4.6 rating with 12 reviews', () => {
        expect(resolveHeaderRating({ average: 4.6, count: 12 }).rating).toEqual({
            average: 4.6,
            count: 12
        });
    });

    it('drops a rating with zero reviews', () => {
        expect(resolveHeaderRating({ average: 4.6, count: 0 }).rating).toBeNull();
        expect(resolveHeaderRating({ average: 0, count: 3 }).rating).toBeNull();
    });
});

describe('resolveIsNewListing', () => {
    it('is new inside 30 days and old after, false for a missing or bad date', () => {
        expect(resolveIsNewListing({ createdAt: RECENT, now: NOW }).isNew).toBe(true);
        expect(resolveIsNewListing({ createdAt: OLD, now: NOW }).isNew).toBe(false);
        expect(resolveIsNewListing({ createdAt: null, now: NOW }).isNew).toBe(false);
        expect(resolveIsNewListing({ createdAt: 'not-a-date', now: NOW }).isNew).toBe(false);
    });
});

describe('buildAccommodationHeader', () => {
    it('maps the accommodation to the shared frame with compare and a destination link', () => {
        // Arrange
        const data = accommodation({
            isFeatured: true,
            isVerified: true,
            createdAt: RECENT,
            averageRating: 4.6,
            reviewsCount: 12
        });
        // Act
        const props = buildAccommodationHeader({ ...base, accommodation: data, bookmarkCount: 3 });
        // Assert
        expect(props.vertical).toBe('accommodation');
        expect(props.backHref).toBe('/es/alojamientos/');
        expect(props.badges.map((b) => b.kind)).toEqual(['type', 'featured', 'verified', 'new']);
        expect(props.badges[0]).toMatchObject({ kind: 'type', accommodationType: 'CABIN' });
        expect(props.rating).toEqual({ average: 4.6, count: 12 });
        expect(props.location).toEqual({ name: 'Colón', href: '/es/destinos/colon/' });
        expect(props.compare).toEqual({ thumbnailUrl: 'https://img/cover.jpg' });
        expect(props.share).toEqual({
            url: SHARE_URL,
            title: 'Cabaña del Río',
            campaign: 'accommodation'
        });
        expect(props.bookmarkCount).toBe(3);
        expect(props.hasMobileGalleryControls).toBe(true);
    });

    it('omits the bookmark count when the page did not fetch one', () => {
        const props = buildAccommodationHeader({ ...base, accommodation: accommodation() });
        expect('bookmarkCount' in props).toBe(false);
        expect(props.rating).toBeNull();
    });
});

describe('buildVenueHeader', () => {
    it('links the location line when the payload carries the destination slug (AC-9)', () => {
        const props = buildVenueHeader({
            ...base,
            venue: venue({ destinationSlug: 'concepcion-del-uruguay' })
        });
        expect(props.location).toEqual({
            name: 'Concepción del Uruguay',
            href: '/es/destinos/concepcion-del-uruguay/'
        });
    });

    it('renders the location as text without a slug (AC-9)', () => {
        expect(buildVenueHeader({ ...base, venue: venue() }).location?.href).toBeNull();
    });

    it('never offers compare and puts open-now last in the badge row (AC-11, HOS-2257)', () => {
        const props = buildVenueHeader({
            ...base,
            venue: venue({
                isFeatured: true,
                createdAt: RECENT,
                openingHours: {
                    monday: { open: '09:00', close: '18:00' }
                } as unknown as VenueDetailData['openingHours']
            })
        });
        expect(props.compare).toBeNull();
        expect(props.backHref).toBe('/es/comer-y-salir/');
        expect(props.share.campaign).toBe('venue');
        expect(props.badges.map((b) => b.kind)).toEqual(['type', 'featured', 'new', 'openNow']);
    });

    it('has no open-now badge without opening hours', () => {
        const props = buildVenueHeader({ ...base, venue: venue({ openingHours: {} }) });
        expect(props.badges.some((b) => b.kind === 'openNow')).toBe(false);
    });
});

describe('buildExperienceHeader', () => {
    it('maps the experience without compare, price or duration', () => {
        const props = buildExperienceHeader({
            ...base,
            experience: experience({
                destinationSlug: 'gualeguaychu',
                averageRating: 4.4,
                reviewsCount: 5
            })
        });
        expect(props.compare).toBeNull();
        expect(props.backHref).toBe('/es/experiencias/');
        expect(props.location).toEqual({
            name: 'Gualeguaychú',
            href: '/es/destinos/gualeguaychu/'
        });
        expect(props.rating).toEqual({ average: 4.4, count: 5 });
        expect(props.share.campaign).toBe('experience');
        expect(Object.keys(props)).not.toContain('price');
    });

    it('renders the location as text without a slug (AC-9)', () => {
        expect(buildExperienceHeader({ ...base, experience: experience() }).location).toEqual({
            name: 'Gualeguaychú',
            href: null
        });
    });
});
