/**
 * Listing access of `POST /api/v1/protected/media/upload-entity` (HOS-1682).
 *
 * The three verticals with a listing (accommodation, gastronomy, experience)
 * run the listing access chain (`enforceListingAccess`, operation EDIT) with
 * the vertical of the service branch: listing state, coverage, capability and
 * the plan limit apply to the upload as they do on the persisting `addMedia`
 * routes. Destination, event and post are not listings and do not run it.
 *
 * GUARD:G2 (b3) reads this file: it must hold one literal `listingAccess` site
 * per listing vertical and the `enforceListingAccess` call.
 */
import { VerticalEnum } from '@repo/schemas';
import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { enforceListingAccess } from '../../../middlewares/listing-access';
import type { ListingAccessConfig } from '../../../types/authorization';
import { accommodationGalleryPhotoLimit } from '../../../utils/listing-access/photo-limit';
import { mediaEntityNotFoundResponse } from '../entity-not-found';

/** Entity types the upload accepts (the validated `entityType`). */
export type UploadEntityType =
    | 'accommodation'
    | 'destination'
    | 'event'
    | 'post'
    | 'gastronomy'
    | 'experience';

/** Roles the upload accepts (the validated `role`). */
export type UploadEntityRole = 'featured' | 'gallery';

/** One listing access declaration, in the `listingAccess:` shape G2 scans. */
type UploadListingAccess = { readonly listingAccess: ListingAccessConfig };

/**
 * Listing access of the upload, per listing vertical and role (HOS-1682).
 *
 * Each entry mirrors the persisting route the uploaded asset ends up in: the
 * accommodation gallery takes `addMedia`'s plan photo limit, the accommodation
 * featured image takes `addFeaturedMedia`'s `requested: 1`, and gastronomy and
 * experience declare no limit, like their own `addMedia`/`addFeaturedMedia`.
 * The vertical is named literally per branch: it is the vertical of the table
 * the service branch reads the listing from, never a value of the request.
 */
export const UPLOAD_LISTING_ACCESS = {
    accommodationGallery: {
        listingAccess: {
            vertical: VerticalEnum.ACCOMMODATION,
            operation: 'EDIT',
            idParam: 'id',
            limit: accommodationGalleryPhotoLimit
        }
    },
    accommodationFeatured: {
        listingAccess: {
            vertical: VerticalEnum.ACCOMMODATION,
            operation: 'EDIT',
            idParam: 'id',
            limit: async () => ({ key: 'max_photos_per_accommodation', requested: 1 })
        }
    },
    gastronomy: {
        listingAccess: { vertical: VerticalEnum.GASTRONOMY, operation: 'EDIT', idParam: 'id' }
    },
    experience: {
        listingAccess: { vertical: VerticalEnum.EXPERIENCE, operation: 'EDIT', idParam: 'id' }
    }
} satisfies Record<string, UploadListingAccess>;

/**
 * Resolve the listing access the upload runs, or `null` when the entity type
 * is not a listing (destination, event, post).
 *
 * @param input.entityType - The validated entity type; the same branch picks the service.
 * @param input.role - The validated upload role.
 * @returns The listing access config of that branch, or `null`.
 */
export const resolveUploadListingAccess = ({
    entityType,
    role
}: {
    readonly entityType: UploadEntityType;
    readonly role: UploadEntityRole;
}): ListingAccessConfig | null => {
    switch (entityType) {
        case 'accommodation':
            return role === 'gallery'
                ? UPLOAD_LISTING_ACCESS.accommodationGallery.listingAccess
                : UPLOAD_LISTING_ACCESS.accommodationFeatured.listingAccess;
        case 'gastronomy':
            return UPLOAD_LISTING_ACCESS.gastronomy.listingAccess;
        case 'experience':
            return UPLOAD_LISTING_ACCESS.experience.listingAccess;
        case 'destination':
        case 'event':
        case 'post':
            return null;
        default: {
            const exhaustive: never = entityType;
            throw new Error(`Unhandled upload entity type: ${String(exhaustive)}`);
        }
    }
};

/**
 * Run the upload's listing access, after the ownership check and before the
 * gallery cap, the file read and the provider call.
 *
 * The chain's NOT_FOUND is answered with the SAME body as "no such entity"
 * (HOS-600); every other refusal is re-thrown as the ServiceError the route
 * factory maps (403 gates).
 *
 * @param input.ctx - The request context.
 * @param input.entityType - The validated entity type.
 * @param input.entityId - The validated entity id, which names the listing.
 * @param input.role - The validated upload role.
 * @returns The media 404 response when the chain answers NOT_FOUND, otherwise `null`.
 */
export const runUploadListingAccess = async ({
    ctx,
    entityType,
    entityId,
    role
}: {
    readonly ctx: Context;
    readonly entityType: UploadEntityType;
    readonly entityId: string;
    readonly role: UploadEntityRole;
}): Promise<Response | null> => {
    const listingAccess = resolveUploadListingAccess({ entityType, role });
    if (!listingAccess) return null;
    try {
        await enforceListingAccess({
            ctx,
            params: { id: entityId },
            config: listingAccess,
            tier: 'protected'
        });
    } catch (error) {
        if (error instanceof HTTPException && error.status === 404) {
            return mediaEntityNotFoundResponse({ ctx });
        }
        throw error;
    }
    return null;
};
