import { ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '../../../types';

/**
 * The `reason` of the typed rejection raised when cancelling an addon needs the listing it
 * targets and that listing no longer resolves (soft-deleted or missing; legacy data, the new
 * model has no soft-delete door). HTTP answers 409 `ALREADY_EXISTS` (HOS-2128, same criterion as
 * HOS-2069's `PERMANENT_GRANT_LISTING_SOFT_DELETED`).
 */
export const ADDON_LISTING_SOFT_DELETED = 'ADDON_LISTING_SOFT_DELETED' as const;

/** Whether the error is the verticals `ListingNotFoundError` (matched by name, as elsewhere). */
function isListingNotFound(error: unknown): boolean {
    return error instanceof Error && error.name === 'ListingNotFoundError';
}

/**
 * Whether the error is the typed rejection {@link ADDON_LISTING_SOFT_DELETED}.
 *
 * @param input.error - Anything thrown
 * @returns True when it is that rejection
 */
export function isAddonListingSoftDeleted(input: { readonly error: unknown }): boolean {
    return input.error instanceof ServiceError && input.error.reason === ADDON_LISTING_SOFT_DELETED;
}

/**
 * Runs `run` and turns a `ListingNotFoundError` into the typed rejection
 * {@link ADDON_LISTING_SOFT_DELETED}, so the caller's transaction rolls back with nothing
 * half-done (fail closed) and no HTTP path answers a 500. Any other error passes through.
 *
 * @param input.run - The work that resolves a listing
 * @returns What `run` returned
 * @throws ServiceError with reason {@link ADDON_LISTING_SOFT_DELETED}
 */
export async function failClosedOnDeletedListing<T>(input: {
    readonly run: () => Promise<T>;
}): Promise<T> {
    try {
        return await input.run();
    } catch (error) {
        if (!isListingNotFound(error)) throw error;
        throw new ServiceError(
            ServiceErrorCode.ALREADY_EXISTS,
            'An addon targets a deleted listing; nothing was cancelled',
            undefined,
            ADDON_LISTING_SOFT_DELETED
        );
    }
}
