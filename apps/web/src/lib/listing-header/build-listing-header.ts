/**
 * @file build-listing-header.ts
 * @description Pure builders that map each vertical's detail data to the props
 * of the shared `ListingHeader.astro` (HOS-2579 §6.3).
 *
 * The three detail pages used to carry three parallel headers that drifted
 * apart (a text heart on accommodation, hand-drawn stars on venue and
 * experience, a destination link on one vertical only). The frame is now one
 * component, and the only per-vertical knowledge left is here: which badges a
 * vertical shows, where its back button goes and whether it can be compared.
 *
 * Rules every builder keeps:
 * - A rating with zero reviews is no rating (`null`).
 * - The location line links to `/{lang}/destinos/{slug}/` only when the data
 *   carries the destination slug. Without it the line is plain text: a builder
 *   never invents a URL.
 * - Compare is accommodation-only (NG-6).
 * - «Nuevo» means created in the last 30 days, measured against `now`.
 */

import type { ShareCampaign } from '@repo/analytics';
import type {
    ListingHeaderBadge,
    ListingHeaderLocation,
    ListingHeaderProps,
    ListingHeaderRating
} from '@/components/listing/header/listing-header.types';
import type {
    AccommodationDetailData,
    ExperienceDetailData,
    VenueDetailData,
    VenueOpeningHoursEntry
} from '@/data/types';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';

/** A listing younger than this shows the «Nuevo» badge. */
const NEW_LISTING_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

/** Inputs every builder shares. */
interface BaseHeaderInput {
    readonly locale: SupportedLocale;
    /** Canonical absolute URL of the page (shared without UTMs). */
    readonly shareUrl: string;
    /** Public bookmark count; `undefined` renders no counter. */
    readonly bookmarkCount?: number;
    readonly hasMobileGalleryControls: boolean;
    /** Clock for the «Nuevo» badge. Defaults to the current time. */
    readonly now?: number;
}

/** Input of {@link buildAccommodationHeader}. */
export interface BuildAccommodationHeaderInput extends BaseHeaderInput {
    readonly accommodation: AccommodationDetailData;
}

/** Input of {@link buildVenueHeader}. */
export interface BuildVenueHeaderInput extends BaseHeaderInput {
    readonly venue: VenueDetailData;
}

/** Input of {@link buildExperienceHeader}. */
export interface BuildExperienceHeaderInput extends BaseHeaderInput {
    readonly experience: ExperienceDetailData;
}

/**
 * Whether a listing created at `createdAt` is still «new» at `now`.
 *
 * @param input - `createdAt` (ISO string, nullable) and `now` (epoch ms).
 * @returns `{ isNew }`, `false` for a missing or unparseable date.
 */
export function resolveIsNewListing(input: {
    readonly createdAt: string | null | undefined;
    readonly now: number;
}): { readonly isNew: boolean } {
    if (!input.createdAt) return { isNew: false };
    const created = new Date(input.createdAt).getTime();
    if (Number.isNaN(created)) return { isNew: false };
    return { isNew: input.now - created < NEW_LISTING_WINDOW_MS };
}

/**
 * The rating summary, or `null` when there is nothing to show.
 *
 * @param input - Average rating and review count of the listing.
 * @returns `{ rating }`, `null` for a zero count or a non-positive average.
 */
export function resolveHeaderRating(input: { readonly average: number; readonly count: number }): {
    readonly rating: ListingHeaderRating | null;
} {
    if (input.count <= 0 || input.average <= 0) return { rating: null };
    return { rating: { average: input.average, count: input.count } };
}

/**
 * The location line: the destination name, linked to its page only when the
 * slug is known.
 *
 * @param input - Destination name, optional slug and the page locale.
 * @returns `{ location }`, `null` when there is no destination name.
 */
export function resolveHeaderLocation(input: {
    readonly name: string | null | undefined;
    readonly slug: string | null | undefined;
    readonly locale: SupportedLocale;
}): { readonly location: ListingHeaderLocation | null } {
    const name = input.name?.trim();
    if (!name) return { location: null };
    const slug = input.slug?.trim();
    return {
        location: { name, href: slug ? `/${input.locale}/destinos/${slug}/` : null }
    };
}

/** Shared tail of the three builders. */
function assemble(input: {
    readonly base: BaseHeaderInput;
    readonly vertical: ListingHeaderProps['vertical'];
    readonly entityId: string;
    readonly title: string;
    readonly backPath: string;
    readonly badges: readonly ListingHeaderBadge[];
    readonly rating: ListingHeaderRating | null;
    readonly location: ListingHeaderLocation | null;
    readonly campaign: ShareCampaign;
    readonly compare: ListingHeaderProps['compare'];
}): ListingHeaderProps {
    const { base } = input;
    return {
        vertical: input.vertical,
        locale: base.locale,
        entityId: input.entityId,
        title: input.title,
        backHref: `/${base.locale}/${input.backPath}/`,
        badges: input.badges,
        rating: input.rating,
        location: input.location,
        share: { url: base.shareUrl, title: input.title, campaign: input.campaign },
        compare: input.compare,
        ...(base.bookmarkCount === undefined ? {} : { bookmarkCount: base.bookmarkCount }),
        hasMobileGalleryControls: base.hasMobileGalleryControls
    };
}

/**
 * Header props of an accommodation detail page.
 *
 * @param input - The accommodation detail data plus the shared header inputs.
 * @returns The `ListingHeader` props: type, featured, verified and new badges,
 * a destination link and the compare control.
 */
export function buildAccommodationHeader(input: BuildAccommodationHeaderInput): ListingHeaderProps {
    const { accommodation, locale } = input;
    const { t } = createTranslations(locale);
    const { isNew } = resolveIsNewListing({
        createdAt: accommodation.createdAt,
        now: input.now ?? Date.now()
    });

    const badges: ListingHeaderBadge[] = [
        { kind: 'type', label: accommodation.type, accommodationType: accommodation.type }
    ];
    if (accommodation.isFeatured) {
        badges.push({ kind: 'featured', label: t('accommodations.detail.badges.featured') });
    }
    if (accommodation.isVerified) {
        badges.push({ kind: 'verified', label: t('accommodations.detail.badges.verified') });
    }
    if (isNew) {
        badges.push({ kind: 'new', label: t('accommodations.detail.badges.new') });
    }

    return assemble({
        base: input,
        vertical: 'accommodation',
        entityId: accommodation.id,
        title: accommodation.name,
        backPath: 'alojamientos',
        badges,
        rating: resolveHeaderRating({
            average: accommodation.averageRating,
            count: accommodation.reviewsCount
        }).rating,
        location: resolveHeaderLocation({
            name: accommodation.destination.name,
            slug: accommodation.destination.slug,
            locale
        }).location,
        campaign: 'accommodation',
        compare: { thumbnailUrl: accommodation.featuredImage || undefined }
    });
}

/**
 * Header props of a venue detail page.
 *
 * The price range is NOT a header badge any more: it moved to `VenueSummary`
 * (slot 2), so the header frame is the same for the three verticals.
 *
 * @param input - The venue detail data plus the shared header inputs.
 * @returns The `ListingHeader` props: type, featured, new and open-now badges,
 * the destination line and no compare control.
 */
export function buildVenueHeader(input: BuildVenueHeaderInput): ListingHeaderProps {
    const { venue, locale } = input;
    const { t } = createTranslations(locale);
    const { isNew } = resolveIsNewListing({
        createdAt: venue.createdAt,
        now: input.now ?? Date.now()
    });

    const badges: ListingHeaderBadge[] = [
        { kind: 'type', label: t(`venue.types.${venue.type}`, venue.type) }
    ];
    if (venue.isFeatured) {
        badges.push({ kind: 'featured', label: t('venue.card.featured', 'Destacado') });
    }
    if (isNew) {
        badges.push({ kind: 'new', label: t('home.accommodations.badge.new', 'Nuevo') });
    }
    // HOS-2257: last in the row, so the late-hydrating pill shifts no sibling.
    if (venue.openingHours && Object.keys(venue.openingHours).length > 0) {
        badges.push({
            kind: 'openNow',
            openingHours: venue.openingHours as Record<string, VenueOpeningHoursEntry>
        });
    }

    return assemble({
        base: input,
        vertical: 'venue',
        entityId: venue.id,
        title: venue.name,
        backPath: 'comer-y-salir',
        badges,
        rating: resolveHeaderRating({ average: venue.averageRating, count: venue.reviewsCount })
            .rating,
        location: resolveHeaderLocation({
            name: venue.destinationName,
            slug: venue.destinationSlug,
            locale
        }).location,
        campaign: 'venue',
        compare: null
    });
}

/**
 * Header props of an experience detail page.
 *
 * The price and the duration are NOT in the header any more: they moved to
 * `ExperienceSummary` (slot 2).
 *
 * @param input - The experience detail data plus the shared header inputs.
 * @returns The `ListingHeader` props: type, featured and new badges, the
 * destination line and no compare control.
 */
export function buildExperienceHeader(input: BuildExperienceHeaderInput): ListingHeaderProps {
    const { experience, locale } = input;
    const { t } = createTranslations(locale);
    const { isNew } = resolveIsNewListing({
        createdAt: experience.createdAt,
        now: input.now ?? Date.now()
    });

    const badges: ListingHeaderBadge[] = [
        { kind: 'type', label: t(`experience.type.${experience.type}`, experience.type) }
    ];
    if (experience.isFeatured) {
        badges.push({ kind: 'featured', label: t('experience.card.featured', 'Destacada') });
    }
    if (isNew) {
        badges.push({ kind: 'new', label: t('home.accommodations.badge.new', 'Nuevo') });
    }

    return assemble({
        base: input,
        vertical: 'experience',
        entityId: experience.id,
        title: experience.name,
        backPath: 'experiencias',
        badges,
        rating: resolveHeaderRating({
            average: experience.averageRating,
            count: experience.reviewsCount
        }).rating,
        location: resolveHeaderLocation({
            name: experience.destinationName,
            slug: experience.destinationSlug,
            locale
        }).location,
        campaign: 'experience',
        compare: null
    });
}
