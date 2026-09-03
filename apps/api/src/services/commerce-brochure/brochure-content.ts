/**
 * Turns a commerce listing's PUBLIC projection into printable brochure content
 * (HOS-1058).
 *
 * ---
 * THE RULE THIS MODULE EXISTS TO ENFORCE
 *
 * **The brochure is a rendering of the public ficha, never of the row.**
 *
 * Every field below is read off `GastronomyPublicSchema` /
 * `ExperiencePublicSchema` — the same projections the anonymous detail
 * endpoints answer with. That is not a convenience: a printed PDF is the one
 * artifact that leaves the platform entirely, gets photocopied and left on a
 * counter, and can never be unpublished. So it may not carry a single fact the
 * ficha itself does not already show, and the way to guarantee that is to build
 * it from the same projection rather than to re-decide field by field.
 *
 * Two consequences are worth stating because they read as omissions:
 *
 * - **A gastronomy brochure carries no phone and no e-mail.**
 *   `GastronomyPublicSchema` does not pick `contactInfo` at all (the comment
 *   there calls it "restaurant contact info at owner discretion", published
 *   through `socialNetworks`), so a phone number in the PDF would be a field
 *   the public page does not show. The experience projection DOES publish a
 *   narrow `contactInfo` — work e-mail, work phone, mobile, website — and the
 *   brochure prints exactly those four, never `whatsapp`, which HOS-19 gates
 *   behind a separate authenticated endpoint.
 * - **Whatever gate the ficha grows, the brochure inherits.** Today neither
 *   vertical strips `richDescription` by plan (the gate described in the access
 *   schemas is implemented for accommodation only), so the brochure prints the
 *   plain `description` and does not reach for the rich variant — a printed
 *   page cannot render markdown anyway, and reaching for the gated field would
 *   be the one place the PDF could outrun the ficha.
 *
 * @module services/commerce-brochure/brochure-content
 */

import type { Locale } from '@repo/i18n';
import { trans } from '@repo/i18n';
import { ModerationStatusEnum } from '@repo/schemas';
import type { ExperienceBrochureSource, GastronomyBrochureSource } from './brochure-source.js';

/** The two commerce verticals a brochure can be built for. */
export type BrochureVertical = 'gastronomy' | 'experience';

/** One titled block of the printed page. */
export interface BrochureSection {
    readonly heading: string;
    readonly lines: readonly string[];
}

/** Everything the renderer needs. No entity types leak past this boundary. */
export interface BrochureContent {
    /** Listing name, as the ficha shows it in this locale. */
    readonly title: string;
    /** Type and destination, e.g. `Parrilla · Concepción del Uruguay`. */
    readonly subtitle: string | null;
    /** Summary or description paragraph. */
    readonly intro: string | null;
    /** One-line price statement, when the ficha publishes one. */
    readonly price: string | null;
    /** Titled blocks, in print order. */
    readonly sections: readonly BrochureSection[];
    /** Absolute URL of the public ficha. Printed AND encoded in the QR. */
    readonly url: string;
    /** Cover photo URL, already filtered for moderation state. */
    readonly coverImageUrl: string | null;
    /** Sentence printed beside the QR. */
    readonly qrHint: string;
    /** Attribution line at the foot of the page. */
    readonly footer: string;
}

/** Locale-resolution order when a listing's i18n object is partly filled. */
const LOCALE_FALLBACK: readonly Locale[] = ['es', 'en', 'pt'];

/** Day keys in print order, with the i18n suffix each resolves to. */
const DAYS: readonly { readonly key: string; readonly label: string }[] = [
    { key: 'mon', label: 'monday' },
    { key: 'tue', label: 'tuesday' },
    { key: 'wed', label: 'wednesday' },
    { key: 'thu', label: 'thursday' },
    { key: 'fri', label: 'friday' },
    { key: 'sat', label: 'saturday' },
    { key: 'sun', label: 'sunday' }
];

/**
 * URL path segment of each vertical's public detail page.
 *
 * The segments are identical in all three locales — mirrors
 * `apps/web/src/lib/seo/entity-public-urls.ts`, which is the web-side source of
 * truth. Duplicated rather than imported because that file lives in the Astro
 * app and this one runs in the API; a divergence would send every printed QR to
 * a 404, which is why the route test asserts the built URL literally.
 */
const PUBLIC_PATH_SEGMENT: Readonly<Record<BrochureVertical, string>> = {
    gastronomy: 'gastronomia',
    experience: 'experiencias'
};

/** i18n namespace each vertical's detail copy lives in. */
const DETAIL_NS: Readonly<Record<BrochureVertical, string>> = {
    gastronomy: 'gastronomy.detail',
    experience: 'experience.detail'
};

/**
 * Looks a key up, falling back to Spanish and then to a caller-supplied
 * default.
 *
 * A brochure must never print `[MISSING: …]` on paper, so an absent key
 * degrades to the Spanish string and, failing that, to whatever the call site
 * can offer — usually a humanised slug.
 */
function t(input: { locale: Locale; key: string; fallback?: string }): string {
    const { locale, key } = input;
    return trans[locale]?.[key] ?? trans.es?.[key] ?? input.fallback ?? '';
}

/** Resolves an `{ es, en, pt }` object for a locale; empty string when absent. */
function i18nText(input: {
    value: { es?: string | null; en?: string | null; pt?: string | null } | null | undefined;
    locale: Locale;
}): string {
    const { value, locale } = input;
    if (!value) return '';
    const direct = value[locale];
    if (direct) return direct;
    for (const fallback of LOCALE_FALLBACK) {
        const candidate = value[fallback];
        if (candidate) return candidate;
    }
    return '';
}

/** Turns a catalog slug into readable text, for when no i18n label exists. */
function humaniseSlug(input: { slug: string }): string {
    const words = input.slug.replace(/[-_]+/g, ' ').trim();
    return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Drops empty strings and trims what survives. */
function compact(values: readonly (string | null | undefined)[]): string[] {
    return values.map((value) => value?.trim() ?? '').filter((value) => value.length > 0);
}

/**
 * The listing's cover photo, or `null`.
 *
 * Only an APPROVED image is eligible. The moderation state travels on the
 * public payload precisely so a consumer can make this decision, and print is
 * the consumer with no takedown: a photo that a moderator later rejects is
 * still on the counter.
 */
function pickCoverImage(input: {
    media:
        | {
              featuredImage?: { url: string; moderationState: string } | undefined;
              gallery?: readonly { url: string; moderationState: string }[] | undefined;
          }
        | null
        | undefined;
}): string | null {
    const media = input.media;
    if (!media) return null;
    const approved = (image?: { url: string; moderationState: string }): string | null =>
        image && image.moderationState === ModerationStatusEnum.APPROVED ? image.url : null;

    const featured = approved(media.featuredImage);
    if (featured) return featured;

    for (const image of media.gallery ?? []) {
        const url = approved(image);
        if (url) return url;
    }
    return null;
}

/** Shape of one day in an `OpeningHours` block, read defensively. */
interface DayScheduleLike {
    readonly closed?: boolean;
    readonly shifts?: readonly { readonly open?: string; readonly close?: string }[];
}

/**
 * Renders the weekly schedule as one line per day.
 *
 * A closed day prints as closed rather than being skipped: on paper, an absent
 * Monday reads as an oversight, and the reader is standing in front of the door
 * with no way to ask.
 */
function formatOpeningHours(input: {
    openingHours:
        | { days?: Readonly<Record<string, DayScheduleLike>> | null; notes?: string | null }
        | null
        | undefined;
    locale: Locale;
    ns: string;
}): string[] {
    const { openingHours, locale, ns } = input;
    const days = openingHours?.days;
    if (!days) return [];

    const closedLabel = t({ locale, key: `${ns}.openingHours.closed`, fallback: 'Cerrado' });
    const lines: string[] = [];

    for (const day of DAYS) {
        const schedule = days[day.key];
        if (!schedule) continue;
        const label = t({ locale, key: `${ns}.openingHours.${day.label}`, fallback: day.label });
        const shifts = compact(
            (schedule.shifts ?? []).map((shift) =>
                shift.open && shift.close ? `${shift.open} - ${shift.close}` : ''
            )
        );
        const value =
            schedule.closed === true || shifts.length === 0 ? closedLabel : shifts.join(' / ');
        lines.push(`${label}: ${value}`);
    }

    const notes = openingHours?.notes?.trim();
    if (notes) lines.push(notes);

    return lines;
}

/** Joins amenity and feature labels into one comma-separated line. */
function formatCatalog(input: {
    amenities: readonly { slug: string }[] | undefined;
    features: readonly { slug: string; hostReWriteName?: string | null }[] | undefined;
    locale: Locale;
}): string[] {
    const { locale } = input;
    const labels = [
        ...(input.amenities ?? []).map((amenity) =>
            t({
                locale,
                key: `accommodations.amenityNames.${amenity.slug}`,
                fallback: humaniseSlug({ slug: amenity.slug })
            })
        ),
        ...(input.features ?? []).map(
            (feature) =>
                feature.hostReWriteName?.trim() ||
                t({
                    locale,
                    key: `accommodations.featureNames.${feature.slug}`,
                    fallback: humaniseSlug({ slug: feature.slug })
                })
        )
    ];
    const unique = [...new Set(compact(labels))];
    return unique.length > 0 ? [unique.join(' · ')] : [];
}

/** Social profile URLs the public payload carries, in a stable order. */
function formatSocial(input: {
    socialNetworks: Readonly<Record<string, string | undefined>> | null | undefined;
}): string[] {
    const social = input.socialNetworks;
    if (!social) return [];
    return compact(
        ['instagram', 'facebook', 'twitter', 'tiktok', 'youtube', 'linkedIn'].map(
            (network) => social[network]
        )
    );
}

/** Absolute URL of a listing's public ficha. */
export function buildPublicListingUrl(input: {
    vertical: BrochureVertical;
    slug: string;
    locale: Locale;
    siteUrl: string;
}): string {
    const base = input.siteUrl.replace(/\/$/, '');
    return `${base}/${input.locale}/${PUBLIC_PATH_SEGMENT[input.vertical]}/${encodeURIComponent(input.slug)}/`;
}

/** The two lines that close every brochure, whatever the vertical. */
function commonFooterCopy(input: { locale: Locale }): { qrHint: string; footer: string } {
    return {
        qrHint: t({
            locale: input.locale,
            key: 'commerce.brochure.qrHint',
            fallback: 'Escaneá el código para ver la ficha completa.'
        }),
        footer: t({
            locale: input.locale,
            key: 'commerce.brochure.footer',
            fallback: 'hospeda.com.ar'
        })
    };
}

/**
 * Builds the brochure content of a gastronomy listing.
 *
 * @param input.listing - The listing, ALREADY projected through
 *   `GastronomyPublicSchema`. Passing a protected or admin projection here
 *   would defeat the whole point of the module — the route parses first.
 * @param input.locale - Locale to print in.
 * @param input.siteUrl - Public base URL of the web app.
 * @returns Printable content.
 */
export function buildGastronomyBrochureContent(input: {
    listing: GastronomyBrochureSource;
    locale: Locale;
    siteUrl: string;
}): BrochureContent {
    const { listing, locale } = input;
    const ns = DETAIL_NS.gastronomy;

    const title = i18nText({ value: listing.nameI18n, locale }) || listing.name;
    const typeLabel = t({ locale, key: `gastronomy.types.${listing.type}` });
    const destination = listing.destination?.name ?? '';
    const intro =
        i18nText({ value: listing.summaryI18n, locale }) ||
        listing.summary ||
        i18nText({ value: listing.descriptionI18n, locale }) ||
        listing.description ||
        '';

    const priceRange = listing.priceRange
        ? t({ locale, key: `gastronomy.card.priceRange.${listing.priceRange}` })
        : '';

    const sections: BrochureSection[] = [];

    const hours = formatOpeningHours({ openingHours: listing.openingHours, locale, ns });
    if (hours.length > 0) {
        sections.push({
            heading: t({ locale, key: `${ns}.openingHours.title`, fallback: 'Horarios' }),
            lines: hours
        });
    }

    const contactLines = compact([
        ...formatSocial({ socialNetworks: listing.socialNetworks }),
        listing.menuUrl
    ]);
    if (contactLines.length > 0) {
        sections.push({
            heading: t({ locale, key: `${ns}.social`, fallback: 'Contacto' }),
            lines: contactLines
        });
    }

    const catalog = formatCatalog({
        amenities: listing.amenities,
        features: listing.features,
        locale
    });
    if (catalog.length > 0) {
        sections.push({
            heading: t({ locale, key: `${ns}.amenities.title`, fallback: 'Servicios' }),
            lines: catalog
        });
    }

    return {
        title,
        subtitle: compact([typeLabel, destination]).join(' · ') || null,
        intro: intro || null,
        price: priceRange || null,
        sections,
        url: buildPublicListingUrl({
            vertical: 'gastronomy',
            slug: listing.slug,
            locale,
            siteUrl: input.siteUrl
        }),
        coverImageUrl: pickCoverImage({ media: listing.media }),
        ...commonFooterCopy({ locale })
    };
}

/**
 * Builds the brochure content of an experience listing.
 *
 * @param input.listing - The listing, ALREADY projected through
 *   `ExperiencePublicSchema`.
 * @param input.locale - Locale to print in.
 * @param input.siteUrl - Public base URL of the web app.
 * @returns Printable content.
 */
export function buildExperienceBrochureContent(input: {
    listing: ExperienceBrochureSource;
    locale: Locale;
    siteUrl: string;
}): BrochureContent {
    const { listing, locale } = input;
    const ns = DETAIL_NS.experience;

    const title = i18nText({ value: listing.nameI18n, locale }) || listing.name;
    const typeLabel = t({ locale, key: `experience.type.${listing.type}` });
    const destination = listing.destination?.name ?? '';
    const intro =
        i18nText({ value: listing.summaryI18n, locale }) ||
        listing.summary ||
        i18nText({ value: listing.descriptionI18n, locale }) ||
        listing.description ||
        '';

    let price = '';
    if (listing.isPriceOnRequest) {
        price = t({ locale, key: 'experience.priceOnRequest' });
    } else if (typeof listing.priceFrom === 'number') {
        const unit = listing.priceUnit
            ? t({ locale, key: `experience.priceUnit.${listing.priceUnit}` })
            : '';
        price = compact([
            t({ locale, key: 'experience.priceFrom' }),
            `$${listing.priceFrom}`,
            unit
        ]).join(' ');
    }

    const sections: BrochureSection[] = [];

    if (listing.meetingPoint?.trim()) {
        sections.push({
            heading: t({ locale, key: `${ns}.meetingPoint.title`, fallback: 'Punto de encuentro' }),
            lines: [listing.meetingPoint.trim()]
        });
    }

    const hours = formatOpeningHours({ openingHours: listing.openingHours, locale, ns });
    if (hours.length > 0) {
        sections.push({
            heading: t({ locale, key: `${ns}.openingHours.title`, fallback: 'Horarios' }),
            lines: hours
        });
    }

    // The four fields `ExperiencePublicContactInfoSchema` publishes, and no
    // others. `whatsapp` is deliberately absent: HOS-19 keeps it behind an
    // authenticated endpoint, so it is not on the ficha and cannot be on paper.
    const contactLines = compact([
        listing.contactInfo?.workPhone,
        listing.contactInfo?.mobilePhone,
        listing.contactInfo?.workEmail,
        listing.contactInfo?.website,
        ...formatSocial({ socialNetworks: listing.socialNetworks })
    ]);
    if (contactLines.length > 0) {
        sections.push({
            heading: t({ locale, key: `${ns}.contact`, fallback: 'Contacto' }),
            lines: contactLines
        });
    }

    const catalog = formatCatalog({
        amenities: listing.amenities,
        features: listing.features,
        locale
    });
    if (catalog.length > 0) {
        sections.push({
            heading: t({ locale, key: `${ns}.amenities.title`, fallback: 'Servicios' }),
            lines: catalog
        });
    }

    return {
        title,
        subtitle: compact([typeLabel, destination]).join(' · ') || null,
        intro: intro || null,
        price: price || null,
        sections,
        url: buildPublicListingUrl({
            vertical: 'experience',
            slug: listing.slug,
            locale,
            siteUrl: input.siteUrl
        }),
        coverImageUrl: pickCoverImage({ media: listing.media }),
        ...commonFooterCopy({ locale })
    };
}
