/**
 * The register of support's content edits on somebody else's listing
 * (ACC:15, HOS-1493, piece V8a).
 *
 * Action 15 lets an administrator create a draft in an owner's name, correct
 * it and restore its content — without publishing, featuring or deleting it.
 * The act is auditable (NUCLEO/08 §1.1, criterion 3: an administrator acting on
 * somebody else's account) and the owner is told, because they are not
 * watching (NUCLEO/07 §6, "contenido de tu ficha editado por soporte").
 *
 * So every such write records, in the SAME transaction as the edit:
 *
 * - one `listing.created` / `listing.edited` event with `actor_type = 'admin'`,
 *   the admin as actor (never the owner), the reason when there is one, and
 *   the same "what changed" list as an owner act — content fields carry their
 *   NAME only (DEC-DATA-005 📌1);
 * - one email to the owner, queued in `email_outbox`, deduplicated per request
 *   (its correlation) so one request sends one email.
 *
 * The retention clock never counts these events: every reader of the owner's
 * acts filters `actor_type = 'owner'`.
 *
 * @module services/listing/listing-support-edit
 */

import {
    buildEmailDedupKey,
    buildEventOccurrence,
    type DomainEventChange,
    domainEventModel,
    emailOutboxModel,
    eq,
    users
} from '@repo/db';
import { createLogger } from '@repo/logger';
import { PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import { type Actor, type ServiceContext, ServiceError } from '../../types';
import { resolveServiceActionReason } from '../../utils/action-reason';
import { resolveServiceCorrelationId } from '../../utils/correlation';
import { hasPermission } from '../../utils/permission';
import {
    LISTING_NON_CONTENT_FIELDS,
    type ListingOwnerActEntityType,
    type ListingOwnerActEventType
} from './listing-owner-act';

const logger = createLogger('listing-support-edit');

/** Template identifier of the "content of your listing edited by support" email. */
export const LISTING_CONTENT_EDITED_BY_SUPPORT_TEMPLATE =
    'verticals.listing-content-edited-by-support';

/** The closed list of listing parts the support-edit email and notice name. */
export type SupportEditPart = 'texts' | 'photos' | 'faq' | 'hours' | 'other';

/** Stable display order of the parts. */
const PART_ORDER: readonly SupportEditPart[] = ['texts', 'photos', 'faq', 'hours', 'other'];

/**
 * Field name → part. A field missing here is `other`: the classification
 * fails toward a vague part, never toward hiding that something changed.
 */
const FIELD_PART: Readonly<Record<string, SupportEditPart>> = {
    name: 'texts',
    summary: 'texts',
    description: 'texts',
    richDescription: 'texts',
    seo: 'texts',
    media: 'photos',
    featuredImage: 'photos',
    gallery: 'photos',
    faqs: 'faq',
    openingHours: 'hours',
    schedule: 'hours'
};

/**
 * Derives the parts of a listing a support edit touched from its changes.
 *
 * Non-content fields (state, plan, dates) are not a part; duplicates collapse;
 * the order is fixed by {@link PART_ORDER}.
 *
 * @param input.changes - The "what changed" list of the edit.
 * @returns `{ parts }`.
 */
export function buildSupportEditParts(input: { readonly changes: readonly DomainEventChange[] }): {
    readonly parts: readonly SupportEditPart[];
} {
    const nonContent = new Set<string>(LISTING_NON_CONTENT_FIELDS);
    const seen = new Set<SupportEditPart>();
    for (const change of input.changes) {
        if (nonContent.has(change.field)) continue;
        seen.add(FIELD_PART[change.field] ?? 'other');
    }
    return { parts: PART_ORDER.filter((part) => seen.has(part)) };
}

/**
 * Whether a write is action 15: an actor who is NOT the listing's owner and
 * holds action 15's own permission. Decided by PERMISSION, never by role.
 *
 * @param input.actor - The actor of the write.
 * @param input.ownerId - The listing's owner, if known.
 * @returns `true` only for a foreign content edit by a holder of the permission.
 */
export function isForeignContentEdit(input: {
    readonly actor: Actor;
    readonly ownerId?: string | null;
}): boolean {
    const { actor, ownerId } = input;
    if (!ownerId || actor.id === ownerId) return false;
    return hasPermission(actor, PermissionEnum.LISTING_FOREIGN_CONTENT_EDIT);
}

/** Input of {@link recordListingSupportEdit}. */
export interface RecordListingSupportEditInput {
    readonly eventType: ListingOwnerActEventType;
    readonly entityType: ListingOwnerActEntityType;
    /** The listing the act is about. */
    readonly listing: {
        readonly id: string;
        readonly ownerId?: string | null;
        readonly name?: string | null;
    };
    readonly actor: Actor;
    /** The service context of the write; its `tx` is mandatory for action 15. */
    readonly ctx?: ServiceContext;
    readonly changes: readonly DomainEventChange[];
}

/**
 * Records one action-15 write: the auditable event and the owner's email, both
 * inside `ctx.tx`.
 *
 * A no-op unless {@link isForeignContentEdit} holds. Without a transaction it
 * throws: the event and the email must commit or roll back with the edit.
 *
 * @param input - The act, the listing, the actor, the context and the changes.
 * @returns `{ recorded }`, `false` when the write is not action 15.
 * @throws ServiceError `INTERNAL_ERROR` when called for action 15 without `ctx.tx`.
 */
export async function recordListingSupportEdit(
    input: RecordListingSupportEditInput
): Promise<{ readonly recorded: boolean }> {
    const { listing, actor, ctx } = input;
    if (!isForeignContentEdit({ actor, ownerId: listing.ownerId })) {
        return { recorded: false };
    }
    const tx = ctx?.tx;
    const ownerId = listing.ownerId;
    if (!tx || !ownerId) {
        throw new ServiceError(
            ServiceErrorCode.INTERNAL_ERROR,
            'A support content edit (ACC:15) requires an active transaction; call it from within withServiceTransaction'
        );
    }

    const { correlationId } = resolveServiceCorrelationId({ ctx });
    const { reason } = resolveServiceActionReason({ ctx });
    await domainEventModel.insert({
        eventType: input.eventType,
        entityType: input.entityType,
        entityId: listing.id,
        actorId: actor.id,
        actorType: 'admin',
        reason,
        correlationId,
        changes: input.changes,
        tx
    });

    const [ownerRow] = await tx
        .select({ email: users.email })
        .from(users)
        .where(eq(users.id, ownerId))
        .limit(1);
    if (!ownerRow?.email) {
        logger.warn({ listingId: listing.id }, 'No owner email for support content-edit notice');
        return { recorded: true };
    }

    const template = LISTING_CONTENT_EDITED_BY_SUPPORT_TEMPLATE;
    const { parts } = buildSupportEditParts({ changes: input.changes });
    await emailOutboxModel.enqueue(
        {
            recipientUserId: ownerId,
            recipientEmail: ownerRow.email,
            template,
            payload: {
                vertical: input.entityType,
                listingId: listing.id,
                listingName: listing.name ?? null,
                editedAt: new Date().toISOString(),
                parts
            },
            dedupKey: buildEmailDedupKey({
                recipient: ownerId,
                template,
                occurrence: buildEventOccurrence({ eventId: correlationId })
            })
        },
        tx
    );
    return { recorded: true };
}
