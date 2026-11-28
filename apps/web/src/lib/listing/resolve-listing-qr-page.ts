/**
 * @file resolve-listing-qr-page.ts
 * @description Front-door for the per-listing QR pages (HOS-2688).
 *
 * Both pages — `mi-cuenta/propiedades/{id}/codigo-qr` and
 * `mi-cuenta/comercio/{vertical}/{id}/codigo-qr` — need the same things the
 * editor pages need before they can render: a signed-in user, an id in the
 * route, the listing loaded, and the in-layout 404 when it is missing or not
 * the viewer's. They reuse the editors' own loaders and the editors' own
 * ownership rules, so "whose listing is this" has one answer across a
 * listing's pages:
 *
 * - accommodation: `loadAccommodationEditorData`, whose protected read refuses
 *   somebody else's listing (HOS-2556);
 * - venue / experience: `fetchOwnerListingDetail` plus the explicit owner check
 *   `resolveListingEditorPage` makes (that protected read does not enforce
 *   ownership by itself), with the same staff bypass.
 *
 * A missing listing and somebody else's listing answer the SAME 404: a
 * distinguishable refusal would confirm which ids exist
 * (`apps/api/docs/error-contract.md`). The page never reaches the QR
 * endpoints for a listing it did not resolve; those endpoints 404 on their own
 * anyway.
 *
 * The publisher-area gate is NOT here: each page calls its guard first, in its
 * own frontmatter, as `test/pages/publisher-access.guard.test.ts` requires.
 *
 * @module lib/listing/resolve-listing-qr-page
 */

import { PermissionEnum, PublicationStatusEnum } from '@repo/schemas';
import type { AstroGlobal } from 'astro';
import { buildAccountNotFoundTarget } from '@/lib/account-not-found';
import { loadAccommodationEditorData } from '@/lib/api/accommodation-editor-data';
import { isListingEditorVertical } from '@/lib/editor/listing-editor-sections';
import type { SupportedLocale } from '@/lib/i18n';
import type { ListingQrVertical } from '@/lib/listing/listing-qr-page';
import { fetchOwnerListingDetail, type VenueOrExperience } from '@/lib/listing/owner-listings';
import { buildLoginRedirect } from '@/lib/middleware-helpers';

/** The listing a QR page renders. */
export interface ListingQrPageListing<TVertical extends ListingQrVertical> {
    readonly vertical: TVertical;
    readonly id: string;
    readonly name: string;
    readonly slug: string;
    /** Only `PUBLISHED` has a public page — the QR routes' own rule. */
    readonly isPublished: boolean;
}

/** What a QR page gets back: a response to return, or the listing to render. */
export type ListingQrPageResolution<TVertical extends ListingQrVertical> =
    | { readonly response: Response; readonly listing?: undefined }
    | {
          readonly response?: undefined;
          readonly locale: SupportedLocale;
          readonly listing: ListingQrPageListing<TVertical>;
      };

/** Staff permission that may open another owner's venue/experience pages. */
const EDIT_ALL_PERMISSION = {
    venue: PermissionEnum.VENUE_EDIT_ALL,
    experience: PermissionEnum.EXPERIENCE_EDIT_ALL
} as const;

/** The checks both pages share: a session and an id, or the response to return. */
async function admit(input: {
    readonly astro: AstroGlobal;
    readonly back: 'properties' | 'listings';
}): Promise<
    | { readonly response: Response }
    | {
          readonly response?: undefined;
          readonly locale: SupportedLocale;
          readonly user: NonNullable<AstroGlobal['locals']['user']>;
          readonly listingId: string;
          readonly cookieHeader: string | undefined;
          readonly notFound: () => Promise<Response>;
      }
> {
    const { astro, back } = input;
    const locale = astro.locals.locale as SupportedLocale;
    const user = astro.locals.user;
    if (!user) {
        return {
            response: astro.redirect(
                buildLoginRedirect({ locale, currentUrl: astro.url.pathname + astro.url.search })
            )
        };
    }
    const notFound = async (): Promise<Response> =>
        astro.rewrite(buildAccountNotFoundTarget({ locale, back }));
    const listingId = astro.params.id;
    if (!listingId) return { response: await notFound() };
    return {
        locale,
        user,
        listingId,
        cookieHeader: astro.request.headers.get('cookie') ?? undefined,
        notFound
    };
}

/**
 * Resolves the accommodation `propiedades/{id}/codigo-qr` shows.
 *
 * @param input - Input parameters.
 * @param input.astro - The page's Astro global.
 * @returns The listing, or a login redirect / in-layout 404 to return.
 */
export async function resolveAccommodationQrPage(input: {
    readonly astro: AstroGlobal;
}): Promise<ListingQrPageResolution<'accommodation'>> {
    const admitted = await admit({ astro: input.astro, back: 'properties' });
    if (admitted.response) return { response: admitted.response };

    const result = await loadAccommodationEditorData({
        accommodationId: admitted.listingId,
        cookieHeader: admitted.cookieHeader
    });
    if (result.status !== 'ok') return { response: await admitted.notFound() };

    const accommodation = result.data.accommodation;
    return {
        locale: admitted.locale,
        listing: {
            vertical: 'accommodation',
            id: accommodation.id,
            name: accommodation.name,
            slug: accommodation.slug,
            isPublished: accommodation.publicationStatus === PublicationStatusEnum.PUBLISHED
        }
    };
}

/**
 * Resolves the venue or experience `comercio/{vertical}/{id}/codigo-qr` shows.
 *
 * @param input - Input parameters.
 * @param input.astro - The page's Astro global.
 * @returns The listing, or a login redirect / in-layout 404 to return.
 */
export async function resolveComercioQrPage(input: {
    readonly astro: AstroGlobal;
}): Promise<ListingQrPageResolution<VenueOrExperience>> {
    const admitted = await admit({ astro: input.astro, back: 'listings' });
    if (admitted.response) return { response: admitted.response };

    const vertical = input.astro.params.vertical;
    if (!isListingEditorVertical(vertical)) return { response: await admitted.notFound() };

    const detail = await fetchOwnerListingDetail({
        vertical,
        id: admitted.listingId,
        cookieHeader: admitted.cookieHeader
    });
    const isStaff = admitted.user.permissions.includes(EDIT_ALL_PERMISSION[vertical]);
    if (!detail || (detail.ownerId !== admitted.user.id && !isStaff)) {
        return { response: await admitted.notFound() };
    }

    return {
        locale: admitted.locale,
        listing: {
            vertical,
            id: detail.id,
            name: detail.name,
            slug: detail.slug,
            isPublished: detail.publicationStatus === PublicationStatusEnum.PUBLISHED
        }
    };
}
