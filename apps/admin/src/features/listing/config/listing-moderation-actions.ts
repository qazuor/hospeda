/**
 * @file listing-moderation-actions.ts
 * Which administrative moderation actions the panel offers for a listing, and
 * how a refused action reads (HOS-1684).
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
 * Two deliberate narrowings (HOS-1684 notes H1/H2):
 * - over `MODERATED` only `LIFT` is offered, because "from take-down to fix
 *   request only" is `LIFT` with `keepFixRequest: true`, not a `REQUEST_FIX`;
 * - `CLOSE_FIX_REQUEST` is offered even though the panel cannot know whether a
 *   fix request is open (no admin GET exposes it); its 409 says so.
 *
 * Pure: no React, no I/O.
 */

import type { TranslationKey } from '@repo/i18n';
import { type ListingModerationAction, PublicationStatusEnum } from '@repo/schemas';
import { isApiError } from '@/lib/errors';

/** One of the four moderation actions the `/moderate` route accepts. */
export type ListingModerationActionKind = ListingModerationAction['action'];

/** Actions of the four states that are neither moderated nor purged. */
const ACTIVE_STATE_ACTIONS: readonly ListingModerationActionKind[] = [
    'REQUEST_FIX',
    'TAKE_DOWN',
    'CLOSE_FIX_REQUEST'
];

/**
 * Buttons offered per `publicationStatus`, in display order. A `Record` over
 * the enum, so a seventh state does not compile until its actions are decided.
 */
export const LISTING_MODERATION_ACTIONS_BY_STATUS: Readonly<
    Record<PublicationStatusEnum, readonly ListingModerationActionKind[]>
> = {
    [PublicationStatusEnum.DRAFT]: ACTIVE_STATE_ACTIONS,
    [PublicationStatusEnum.PUBLISHED]: ACTIVE_STATE_ACTIONS,
    [PublicationStatusEnum.UNPUBLISHED_BY_BILLING]: ACTIVE_STATE_ACTIONS,
    [PublicationStatusEnum.ARCHIVED]: ACTIVE_STATE_ACTIONS,
    [PublicationStatusEnum.MODERATED]: ['LIFT'],
    [PublicationStatusEnum.PURGED]: []
};

/**
 * The moderation actions the panel offers for a listing in a given state.
 *
 * @param args.publicationStatus - The listing's state; `null`/`undefined` while loading.
 * @returns The actions in display order; empty while loading and for `PURGED`.
 */
export function getAvailableModerationActions({
    publicationStatus
}: {
    readonly publicationStatus: PublicationStatusEnum | null | undefined;
}): readonly ListingModerationActionKind[] {
    if (!publicationStatus) return [];
    return LISTING_MODERATION_ACTIONS_BY_STATUS[publicationStatus];
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
