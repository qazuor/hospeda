/**
 * Listing-access declarations shared by the venue promotion routes (HOS-2270).
 *
 * The pipeline gates writes with the `promotions` catalog section (entitlement
 * `create_promotions`) and with the `max_active_promotions` limit, both read in
 * the `venue` vertical. What an owner already loaded is never taken away, so the
 * gate distinguishes three kinds of call:
 *
 * - **read** (`GET .../promotions`): `read` intent, no entitlement, no limit.
 * - **pause or delete**: `delete` intent. The resolver skips the section key for it
 *   and these calls request no limit, so an owner who downgraded to a covered plan
 *   without the key can still put their promotions away (AC-6). An owner whose
 *   coverage fully lapsed gets NO_COVERAGE (step 5) on these calls, as on every EDIT.
 * - **create, edit, re-activate**: `write` intent. Needs the key, and the limit when
 *   the promotion ends up active.
 *
 * @module routes/venue/protected/promotion-access
 */

import { ownerPromotionModel } from '@repo/db';
import { LifecycleStatusEnum, OwnerPromotionEntityTypeEnum } from '@repo/schemas';

/** The limit every promotion route reads. */
export const MAX_ACTIVE_PROMOTIONS_KEY = 'max_active_promotions';

/** The section every promotion route declares. */
export const PROMOTIONS_SECTION_ID = 'promotions';

/**
 * Whether a body is exactly "pause this promotion": only `lifecycleState`, and not ACTIVE.
 *
 * @param args.body - The validated request body.
 */
export function isPauseBody({
    body
}: {
    readonly body: Record<string, unknown> | undefined;
}): boolean {
    if (!body) return false;
    const keys = Object.keys(body);
    return (
        keys.length === 1 &&
        keys[0] === 'lifecycleState' &&
        body.lifecycleState !== LifecycleStatusEnum.ACTIVE
    );
}

/**
 * The section intent of an edit (PUT or PATCH): a pause is a `delete`, anything else
 * is a `write`.
 *
 * @param args.body - The validated request body.
 */
export function promotionEditIntent({
    body
}: {
    readonly body: Record<string, unknown> | undefined;
}): 'write' | 'delete' {
    return isPauseBody({ body }) ? 'delete' : 'write';
}

/**
 * The limit a create requests: one more than the venue promotions the owner holds.
 * The count is the OWNER's venue promotions only, so it never spends the
 * accommodation quota (AC-4).
 */
export async function promotionCreateLimit({
    subjectId
}: {
    readonly subjectId: string;
}): Promise<{ readonly key: string; readonly requested: number }> {
    const held = await ownerPromotionModel.countActiveForVenueOwner({ ownerId: subjectId });
    return { key: MAX_ACTIVE_PROMOTIONS_KEY, requested: held + 1 };
}

/**
 * The limit an edit requests, or `undefined` when it requests none.
 *
 * An edit asks for a slot only if the promotion ends up active: a pause or a draft
 * edit asks for nothing. When it does, the request is what the owner holds now, plus
 * one if this promotion is not already holding a slot (re-activating, or reviving an
 * expired one). A promotion that is not the venue's (or does not exist) requests
 * nothing: the handler answers its 404.
 */
export async function promotionEditLimit({
    promotionId,
    venueId,
    subjectId,
    body
}: {
    readonly promotionId: string | undefined;
    readonly venueId: string;
    readonly subjectId: string;
    readonly body: Record<string, unknown> | undefined;
}): Promise<{ readonly key: string; readonly requested: number } | undefined> {
    if (!promotionId) return undefined;
    const existing = await ownerPromotionModel.findOneOfVenue({ promotionId, venueId });
    if (!existing || existing.entityType !== OwnerPromotionEntityTypeEnum.VENUE) return undefined;
    const resultingState = (body?.lifecycleState as string | undefined) ?? existing.lifecycleState;
    if (resultingState !== LifecycleStatusEnum.ACTIVE) return undefined;
    const held = await ownerPromotionModel.countActiveForVenueOwner({ ownerId: subjectId });
    const holdsSlot =
        existing.lifecycleState === LifecycleStatusEnum.ACTIVE &&
        (!existing.validUntil || new Date(existing.validUntil).getTime() >= Date.now());
    return { key: MAX_ACTIVE_PROMOTIONS_KEY, requested: holdsSlot ? held : held + 1 };
}
