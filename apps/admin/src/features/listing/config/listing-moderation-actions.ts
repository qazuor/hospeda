/**
 * @file listing-moderation-actions.ts
 * Administrative listing actions derived from publication and fix-request state.
 *
 * Since HOS-1475 `POST /api/v1/admin/{plural}/{id}/moderate` takes one ACTION
 * with its reason (`REQUEST_FIX`, `TAKE_DOWN`, `LIFT`, `CLOSE_FIX_REQUEST`).
 * The API decides; this module only mirrors its guards so the panel does not
 * offer a button that can only answer 409:
 *
 * - `REQUEST_FIX` — every state but `PURGED` (`fix-request.ts:44-55`);
 * - `TAKE_DOWN` — `DRAFT`, `PUBLISHED`, `UNPUBLISHED_BY_BILLING`, `ARCHIVED`
 *   (`moderate-listing.ts:55-62`);
 * - `LIFT` — only `MODERATED` (`lift-moderation.ts:63-64`);
 * - `CLOSE_FIX_REQUEST` — every state but `PURGED` and `MODERATED`, and only
 *   with an open fix request (`fix-request.ts:114-123`).
 *
 * Pure: no React, no I/O.
 */

import type { TranslationKey } from '@repo/i18n';
import { type ListingModerationAction, PublicationStatusEnum } from '@repo/schemas';
import { isApiError } from '@/lib/errors';

/** One of the four moderation actions the `/moderate` route accepts. */
export type ListingModerationActionKind = ListingModerationAction['action'];

/** Actions of the four states that are neither moderated nor purged. */
export const LISTING_PURGE_ON_REQUEST_STATES = [
    PublicationStatusEnum.DRAFT,
    PublicationStatusEnum.PUBLISHED,
    PublicationStatusEnum.UNPUBLISHED_BY_BILLING,
    PublicationStatusEnum.ARCHIVED,
    PublicationStatusEnum.MODERATED
] as const;
export const LISTING_EDIT_STATES = [
    PublicationStatusEnum.DRAFT,
    PublicationStatusEnum.PUBLISHED,
    PublicationStatusEnum.UNPUBLISHED_BY_BILLING,
    PublicationStatusEnum.MODERATED
] as const;

/**
 * Buttons offered per `publicationStatus`, in display order. A `Record` over
 * the enum, so a seventh state does not compile until its actions are decided.
 */
const LISTING_MODERATION_ACTIONS_BY_STATUS: Readonly<
    Record<PublicationStatusEnum, readonly ListingModerationActionKind[]>
> = {
    [PublicationStatusEnum.DRAFT]: ['TAKE_DOWN'],
    [PublicationStatusEnum.PUBLISHED]: ['TAKE_DOWN'],
    [PublicationStatusEnum.UNPUBLISHED_BY_BILLING]: ['TAKE_DOWN'],
    [PublicationStatusEnum.ARCHIVED]: ['TAKE_DOWN'],
    [PublicationStatusEnum.MODERATED]: ['LIFT'],
    [PublicationStatusEnum.PURGED]: []
};

/**
 * The moderation actions the panel offers for a listing in a given state.
 *
 * @param args.publicationStatus - The listing's state; unknown while loading.
 * @param args.fixRequestOpen - Whether a fix request is open; unknown while loading.
 * @returns The actions in display order; empty while loading and for `PURGED`.
 */
export function getAvailableModerationActions({
    publicationStatus,
    fixRequestOpen
}: {
    readonly publicationStatus: PublicationStatusEnum | null | undefined;
    readonly fixRequestOpen: boolean | null | undefined;
}): readonly ListingModerationActionKind[] {
    if (!publicationStatus || fixRequestOpen == null) return [];
    const base = LISTING_MODERATION_ACTIONS_BY_STATUS[publicationStatus];
    if (publicationStatus === PublicationStatusEnum.PURGED) return [];
    if (publicationStatus === PublicationStatusEnum.MODERATED)
        return fixRequestOpen ? base : [...base, 'REQUEST_FIX'];
    return fixRequestOpen ? [...base, 'CLOSE_FIX_REQUEST'] : ['REQUEST_FIX', ...base];
}

export function canPurgeListingOnRequest({
    publicationStatus
}: {
    readonly publicationStatus: PublicationStatusEnum | null | undefined;
}): boolean {
    return (
        publicationStatus != null &&
        (LISTING_PURGE_ON_REQUEST_STATES as readonly PublicationStatusEnum[]).includes(
            publicationStatus
        )
    );
}

export function canEditListing({
    publicationStatus
}: {
    readonly publicationStatus: PublicationStatusEnum | null | undefined;
}): boolean {
    return (
        publicationStatus != null &&
        (LISTING_EDIT_STATES as readonly PublicationStatusEnum[]).includes(publicationStatus)
    );
}

/**
 * Text of a 409 per action. Every 409 of `/moderate` arrives as
 * `ALREADY_EXISTS`, so the action — not the message — tells them apart.
 */
const CONFLICT_MESSAGE_BY_ACTION: Readonly<Record<ListingModerationActionKind, TranslationKey>> = {
    REQUEST_FIX: 'admin-entities.listingModeration.errors.conflict.requestFix',
    TAKE_DOWN: 'admin-entities.listingModeration.errors.conflict.takeDown',
    LIFT: 'admin-entities.listingModeration.errors.conflict.lift',
    CLOSE_FIX_REQUEST: 'admin-entities.listingModeration.errors.conflict.closeFixRequest'
};

/** Typed refusals of `/moderate` other than 409, by HTTP status. */
const ERROR_MESSAGE_BY_STATUS: Readonly<Record<number, TranslationKey>> = {
    400: 'admin-entities.listingModeration.errors.invalid',
    403: 'admin-entities.listingModeration.errors.forbidden',
    404: 'admin-entities.listingModeration.errors.notFound'
};

/** HTTP status of a refusal by state (`INVALID_FROM`, `ALREADY_OPEN`, `NO_OPEN_FIX_REQUEST`). */
const CONFLICT_STATUS = 409;

/** How a refused moderation action reads in the panel. */
export interface ModerationErrorDescription {
    /** i18n key of the toast message. */
    readonly messageKey: TranslationKey;
    /** `warning` for a changed state (nothing broke), `error` otherwise. */
    readonly variant: 'warning' | 'error';
}

/**
 * Maps a rejected moderation action to its toast. Decides by
 * `ApiError.status` and the action, NEVER by parsing `error.message`.
 *
 * @param args.action - The action that was refused.
 * @param args.error - What the mutation rejected with.
 * @returns The message key and the toast variant; `generic` for anything else.
 */
export function describeModerationError({
    action,
    error
}: {
    readonly action: ListingModerationActionKind;
    readonly error: unknown;
}): ModerationErrorDescription {
    if (!isApiError(error)) {
        return { messageKey: 'admin-entities.listingModeration.errors.generic', variant: 'error' };
    }
    if (error.status === CONFLICT_STATUS) {
        return { messageKey: CONFLICT_MESSAGE_BY_ACTION[action], variant: 'warning' };
    }
    return {
        messageKey:
            ERROR_MESSAGE_BY_STATUS[error.status] ??
            'admin-entities.listingModeration.errors.generic',
        variant: 'error'
    };
}
