/**
 * HOS-2329 — the portal links of `create_listing`: the next steps once the
 * draft exists (§6.4, AC-C23c) and where a refusal points. Split out of
 * `create-listing.ts` to keep it under the file-size limit (HOS-2247).
 *
 * @module mcp/tools/listing/create-listing-links
 */

import { ServiceErrorCode, VerticalEnum } from '@repo/schemas';
import { z } from 'zod';
import { env } from '../../../utils/env';
import { buildPortalUrl } from '../../portal/build-portal-url';
import type { PortalDestination, PortalSectionId } from '../../portal/portal-routes';
import type { ToolRefusalLink } from '../tool-definition';
import type { ListingToolVertical } from './listing-services';

/** Editor sections the next steps link to, per vertical. */
const NEXT_STEP_SECTIONS: Readonly<
    Record<
        ListingToolVertical,
        {
            readonly location: PortalSectionId;
            readonly media: PortalSectionId;
            readonly amenities: PortalSectionId;
        }
    >
> = {
    [VerticalEnum.ACCOMMODATION]: { location: 'location', media: 'photos', amenities: 'amenities' },
    [VerticalEnum.VENUE]: { location: 'location', media: 'media', amenities: 'amenities' },
    [VerticalEnum.EXPERIENCE]: { location: 'meetingPoint', media: 'media', amenities: 'amenities' }
};

/** One thing left to do after the draft exists. */
export interface CreateListingNextStep {
    readonly step: 'amenities' | 'photos' | 'location' | 'publish';
    readonly label: string;
    readonly url: string;
    readonly tool?: string;
}

/**
 * Builds a portal URL from the configured site URL.
 *
 * @param destination - The portal page
 * @returns Its absolute URL
 */
export function listingPortalUrl(destination: PortalDestination): string {
    return buildPortalUrl({ destination, siteUrl: env.HOSPEDA_SITE_URL });
}

/**
 * The steps left once the draft exists (§6.4, AC-C23c).
 *
 * @param args - Vertical, new id and whether the draft already has a location
 * @returns The next steps, with editor links
 */
export function nextStepsFor(args: {
    readonly vertical: ListingToolVertical;
    readonly id: string;
    readonly hasLocation: boolean;
}): readonly CreateListingNextStep[] {
    const { vertical, id, hasLocation } = args;
    const sections = NEXT_STEP_SECTIONS[vertical];
    const editor = (section?: PortalSectionId) =>
        listingPortalUrl({
            kind: 'listingEditor',
            vertical,
            id,
            ...(section === undefined ? {} : { section })
        });
    return [
        {
            step: 'amenities',
            label: 'Cargar servicios y comodidades',
            url: editor(sections.amenities),
            tool: 'update_listing_amenities'
        },
        { step: 'photos', label: 'Subir fotos', url: editor(sections.media) },
        ...(hasLocation
            ? []
            : [
                  {
                      step: 'location' as const,
                      label: 'Marcar la ubicación en el mapa',
                      url: editor(sections.location)
                  }
              ]),
        {
            step: 'publish',
            label: 'Publicar cuando esté lista',
            url: editor(),
            tool: 'set_listing_publication'
        }
    ];
}

/**
 * Where a refusal of `create_listing` should point.
 *
 * @param args - The error and the raw input
 * @returns The portal link, or `undefined` when no page helps
 */
export function refusalActionFor(args: {
    readonly error: { readonly code: string; readonly reason?: string };
    readonly input: unknown;
}): ToolRefusalLink | undefined {
    const parsed = z.looseObject({ vertical: z.enum(VerticalEnum) }).safeParse(args.input);
    const vertical = parsed.success ? parsed.data.vertical : undefined;
    if (
        vertical !== VerticalEnum.ACCOMMODATION &&
        vertical !== VerticalEnum.VENUE &&
        vertical !== VerticalEnum.EXPERIENCE
    ) {
        return undefined;
    }
    switch (args.error.code) {
        case ServiceErrorCode.ENTITLEMENT_REQUIRED:
            return { destination: { kind: 'plans', vertical } };
        case ServiceErrorCode.LIMIT_REACHED:
            return { destination: { kind: 'subscription' } };
        case ServiceErrorCode.FORBIDDEN:
        case ServiceErrorCode.ALREADY_EXISTS:
            return { destination: { kind: 'createListing', vertical } };
        default:
            return undefined;
    }
}
