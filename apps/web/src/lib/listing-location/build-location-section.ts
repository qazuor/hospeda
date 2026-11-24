/**
 * @file build-location-section.ts
 * @description Pure builders of the shared location block (HOS-2579 §6.5):
 * `buildAccommodationLocation`, `buildVenueLocation` and
 * `buildExperienceLocation` map each vertical's public data to the props of
 * `listing/location/LocationSection.astro`.
 *
 * They replace the data half of `accommodation/LocationSection.astro` (moved),
 * `VenueAddress.astro` and `ExperienceMeetingPoint.astro` (deleted), and keep
 * their rules:
 *
 * - **A map is never drawn without coordinates.** `map: null` leaves the text
 *   and the destination link only.
 * - **Accommodation: approximate circle** (SPEC-097), never the exact point.
 * - **Venue: exact pin.** A venue is a public business address (HOS-2189), so
 *   the pin is exact and the «Ver en el mapa» link is counted as `MAP_CLICK`
 *   (HOS-2256). The `venue-address` anchor id moves to the section root.
 * - **Experience: the map and the directions are the paid half** (HOS-1049).
 *   Both hang off `meetingPointDirectionsEnabled`, which the API resolves from
 *   the provider's current plan. The coordinates ship on every tier, so they
 *   are NOT the condition: `lat && long` would draw the paid map for a basic
 *   listing. The meeting-point text is free and always renders (HOS-1048).
 * - Coordinates are checked with `typeof === 'number'`, never truthiness: 0 is
 *   a real coordinate.
 *
 * Every value here is public listing data, so the cached page stays
 * session-blind.
 */

import type { AccommodationDetailData, ExperienceDetailData, VenueDetailData } from '@/data/types';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { resolveHeaderLocation } from '@/lib/listing-header/build-listing-header';
import {
    buildVenueMapUrl,
    formatVenueStreetLine,
    resolveVenueCoordinates
} from '@/lib/venue/venue-address';

/** The map a location block draws, or `null` for none. */
export type LocationSectionMap =
    | {
          readonly mode: 'approximate';
          readonly lat: number;
          readonly lng: number;
          readonly radiusMeters: number;
          readonly ariaLabel: string;
      }
    | {
          readonly mode: 'exact';
          readonly lat: number;
          readonly lng: number;
          readonly zoom: number;
          readonly label: string;
          readonly ariaLabel: string;
      };

/** Props of `LocationSection.astro`, as the builders produce them. */
export interface LocationSectionModel {
    readonly locale: SupportedLocale;
    /** Vertical-specific title, from i18n. */
    readonly heading: string;
    /** Visible address text, one entry per line. May be empty. */
    readonly addressLines: readonly string[];
    /** The listing's destination, linked when its slug is known. */
    readonly destination: { readonly name: string; readonly href: string | null } | null;
    readonly map: LocationSectionMap | null;
    /** Outbound full-map link (venue). Composed by this app, never owner-typed. */
    readonly externalMapHref?: string;
    readonly externalMapLabel?: string;
    /** How to get there, one instruction per line (experience, paid). */
    readonly directions?: readonly string[];
    readonly directionsHeading?: string;
    /** `data-*` of the outbound map link (keys without the `data-` prefix). */
    readonly trackingData?: Readonly<Record<string, string>>;
    /** Anchor id of the section root. */
    readonly id?: string;
}

/**
 * Location block of an accommodation: the destination and the approximate
 * circle (SPEC-097) when the API supplies `approximateLocation`.
 *
 * @param input - The accommodation and the locale.
 * @returns The block props (an accommodation always has a destination).
 */
export function buildAccommodationLocation(input: {
    readonly accommodation: Pick<AccommodationDetailData, 'destination' | 'approximateLocation'>;
    readonly locale: SupportedLocale;
}): LocationSectionModel {
    const { accommodation, locale } = input;
    const { t } = createTranslations(locale);
    const approximate = accommodation.approximateLocation;
    const { location } = resolveHeaderLocation({
        name: accommodation.destination.name,
        slug: accommodation.destination.slug,
        locale
    });

    return {
        locale,
        heading: t('accommodations.detail.locationDetail.title'),
        addressLines: [],
        destination: location,
        map: approximate
            ? {
                  mode: 'approximate',
                  lat: approximate.lat,
                  lng: approximate.lng,
                  radiusMeters: approximate.radiusMeters,
                  ariaLabel: t('maps.ariaLabelAccommodation')
              }
            : null
    };
}

/**
 * Location block of a venue: the street line, the city, the exact pin and the
 * counted «Ver en el mapa» link (HOS-2189, HOS-2256).
 *
 * @param input - The venue and the locale.
 * @returns The block props, or `null` when the venue has no street address.
 */
export function buildVenueLocation(input: {
    readonly venue: Pick<
        VenueDetailData,
        'name' | 'location' | 'destinationName' | 'destinationSlug'
    >;
    readonly locale: SupportedLocale;
}): LocationSectionModel | null {
    const { venue, locale } = input;
    const { t } = createTranslations(locale);
    const streetLine = formatVenueStreetLine({
        location: venue.location,
        floorLabel: t('venue.detail.address.floor', 'piso'),
        apartmentLabel: t('venue.detail.address.apartment', 'depto.')
    });
    if (streetLine === '') return null;

    const { coordinates } = resolveVenueCoordinates({ location: venue.location });
    const mapUrl = buildVenueMapUrl({ location: venue.location });
    const { location } = resolveHeaderLocation({
        name: venue.destinationName,
        slug: venue.destinationSlug ?? null,
        locale
    });

    return {
        locale,
        heading: t('venue.detail.address.title', 'Dónde encontrarnos'),
        addressLines: [streetLine],
        destination: location,
        map: coordinates
            ? {
                  mode: 'exact',
                  lat: coordinates.lat,
                  lng: coordinates.lng,
                  zoom: 16,
                  label: venue.name || t('maps.markerLabel'),
                  ariaLabel: t('maps.ariaLabelVenue')
              }
            : null,
        ...(mapUrl
            ? {
                  externalMapHref: mapUrl,
                  externalMapLabel: t('venue.detail.address.viewOnMap', 'Ver en el mapa'),
                  trackingData: { 'interaction-kind': 'MAP_CLICK' }
              }
            : {}),
        id: 'venue-address'
    };
}

/**
 * Location block of an experience: the meeting point (free) and, only when the
 * provider's plan grants it, the exact map and the directions (HOS-1048,
 * HOS-1049).
 *
 * @param input - The experience and the locale.
 * @returns The block props, or `null` when no meeting point was declared.
 */
export function buildExperienceLocation(input: {
    readonly experience: Pick<
        ExperienceDetailData,
        | 'meetingPoint'
        | 'meetingPointLat'
        | 'meetingPointLong'
        | 'meetingPointDirections'
        | 'meetingPointDirectionsEnabled'
        | 'destinationName'
        | 'destinationSlug'
    >;
    readonly locale: SupportedLocale;
}): LocationSectionModel | null {
    const { experience, locale } = input;
    if (!experience.meetingPoint) return null;
    const { t } = createTranslations(locale);

    const enabled = experience.meetingPointDirectionsEnabled === true;
    const lat = experience.meetingPointLat;
    const lng = experience.meetingPointLong;
    const hasCoordinates = typeof lat === 'number' && typeof lng === 'number';
    const directions = enabled ? experience.meetingPointDirections : [];
    const { location } = resolveHeaderLocation({
        name: experience.destinationName,
        slug: experience.destinationSlug ?? null,
        locale
    });

    return {
        locale,
        heading: t('experience.detail.meetingPoint.title', 'Punto de encuentro'),
        addressLines: [experience.meetingPoint],
        destination: location,
        map:
            enabled && hasCoordinates
                ? {
                      mode: 'exact',
                      lat,
                      lng,
                      zoom: 15,
                      label: experience.meetingPoint,
                      ariaLabel: t(
                          'experience.detail.meetingPoint.mapAriaLabel',
                          'Mapa del punto de encuentro'
                      )
                  }
                : null,
        ...(directions.length > 0
            ? {
                  directions,
                  directionsHeading: t(
                      'experience.detail.meetingPoint.howToGetThere',
                      'Cómo llegar'
                  )
              }
            : {})
    };
}
