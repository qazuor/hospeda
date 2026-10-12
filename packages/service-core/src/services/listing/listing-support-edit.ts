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
import { ServiceErrorCode, type SupportEditPart } from '@repo/schemas';
import { type Actor, type ServiceContext, ServiceError } from '../../types';
import { resolveServiceActionReason } from '../../utils/action-reason';
import {
    isAction15AuthorizedFor,
    resolveAdministrativeAuthorization
} from '../../utils/administrative-authorization';
import { resolveServiceCorrelationId } from '../../utils/correlation';
import {
    LISTING_NON_CONTENT_FIELDS,
    type ListingOwnerActEntityType,
    type ListingOwnerActEventType
} from './listing-owner-act';

const logger = createLogger('listing-support-edit');

/** Template identifier of the "content of your listing edited by support" email. */
export const LISTING_CONTENT_EDITED_BY_SUPPORT_TEMPLATE =
    'verticals.listing-content-edited-by-support';

/**
 * The closed list of listing parts the support-edit email and notice name.
 * Derived from `SupportEditPartSchema` (`@repo/schemas`): one source for the
 * register, the email and the row-26 read.
 */
export type { SupportEditPart };

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
 * Whether a write is action 15: an actor who is NOT the listing's owner,
 * inside a scope where a route's listing-access chain authorized action 15 for
 * that owner, still holding action 15's own permission. Never inferred from the
 * permission alone, never decided by role.
 *
 * @param input.actor - The actor of the write.
 * @param input.ownerId - The listing's owner, if known.
 * @returns `true` only for an authorized foreign content edit.
 */
export function isForeignContentEdit(input: {
    readonly actor: Actor;
    readonly ownerId?: string | null;
}): boolean {
    return isAction15AuthorizedFor(input);
}

/**
 * The listing ROW fields action 15 may write (ACC:15, HOS-1493): content and
 * nothing else. Content is what NUCLEO/08 §1.2 names — "textos, fotos, FAQ,
 * horarios, la misma lista que el día 180 borra (`V/02` §4.1)"
 * (`spec-consolidada/02-nucleo-auditoria.md:61`) — and PB12 is the code that
 * erases that list (`packages/db/src/models/listing/listing-purge.model.ts`).
 *
 * Every field is cited. `[BLANK]` = blanked by `BLANK_CONTENT` (`:83`);
 * `[TABLE]` = rows deleted by `CONTENT_TABLES` (`:46`) or the media purge
 * (`MEDIA_FKS`, `:40`); `[§1.2]` = named by the spec line above. The list is
 * kept by hand because `BLANK_CONTENT` is SQL text in `@repo/db` with no
 * exported field list (deriving it would mean changing that model, which is
 * V6.5's).
 *
 * NOT here, on purpose: `slug` and `refreshSlugFromName` (the public URL is
 * not content — moving it breaks links and could hijack a slug), state,
 * owner, visibility, moderation, featuring, verification, and any bookkeeping
 * flag without a content citation.
 */
export const LISTING_SUPPORT_EDIT_CONTENT_FIELDS = [
    // §1.2 "textos": the name is the listing's title; it is NOT blanked
    // because the purged row keeps it, but it is text the spec names. [§1.2]
    'name',
    'summary', // [BLANK]
    'description', // [BLANK]
    'richDescription', // [BLANK]
    'nameI18n', // [BLANK]
    'summaryI18n', // [BLANK]
    'descriptionI18n', // [BLANK]
    'richDescriptionI18n', // [BLANK]
    'translationMeta', // [BLANK] accommodation
    'seo', // [BLANK] (SeoSchema: title, description only)
    'contactInfo', // [BLANK] (ContactInfoSchema: emails, phones, website only)
    'socialNetworks', // [BLANK] (SocialNetworkSchema: profile links only)
    'media', // [TABLE] media rows + [§1.2] "fotos"; nested moderation is refused below
    'videos', // [BLANK] accommodation, experience; nested moderation is refused below
    'amenityIds', // [TABLE] r_<vertical>_amenity
    'featureIds', // [TABLE] r_<vertical>_feature
    'faqs', // [TABLE] <vertical>_faqs + [§1.2] "FAQ"
    'price', // [BLANK] accommodation
    'location', // [BLANK] accommodation
    'extraInfo', // [BLANK] accommodation
    'menuUrl', // [BLANK] gastronomy
    'menuFileUrl', // [BLANK] gastronomy
    'menuFilePublicId', // [BLANK] gastronomy
    'menuFileKind', // [BLANK] gastronomy
    'openingHours', // [BLANK] gastronomy, experience + [§1.2] "horarios"
    'priceRange', // [BLANK] gastronomy
    'priceFrom', // [BLANK] experience
    'priceUnit', // [BLANK] experience
    'isPriceOnRequest', // [BLANK] experience
    'meetingPoint', // [BLANK] experience
    'meetingPointLat', // [BLANK] experience
    'meetingPointLong', // [BLANK] experience
    'meetingPointDirections', // [BLANK] experience
    'durationMinutes', // [BLANK] experience
    'whatToBring', // [BLANK] experience
    'requirements', // [BLANK] experience
    'cancellationPolicy', // [BLANK] experience
    'acceptsPrivateGroups' // [BLANK] experience
] as const;

const CONTENT_FIELDS = new Set<string>(LISTING_SUPPORT_EDIT_CONTENT_FIELDS);

/**
 * Paths of nested `moderationState` values that are not `PENDING`: content
 * written by action 15 never carries a moderation verdict (photos and videos
 * carry one per item), so support cannot approve its own upload.
 */
function findModerationVerdicts(value: unknown, path: string, out: string[]): void {
    if (Array.isArray(value)) {
        for (const [index, item] of value.entries()) {
            findModerationVerdicts(item, `${path}[${index}]`, out);
        }
        return;
    }
    if (value === null || typeof value !== 'object') return;
    for (const [key, nested] of Object.entries(value)) {
        const nestedPath = path ? `${path}.${key}` : key;
        if (key === 'moderationState' && nested !== undefined && nested !== 'PENDING') {
            out.push(nestedPath);
        } else {
            findModerationVerdicts(nested, nestedPath, out);
        }
    }
}

const isAction15Scope = (): boolean =>
    resolveAdministrativeAuthorization().authorization?.action === 'ACC_15';

const refuse = (rejectedFields: readonly string[], what: string): never => {
    throw new ServiceError(
        ServiceErrorCode.FORBIDDEN,
        `Action 15 ${what}; not allowed: ${rejectedFields.join(', ')}`
    );
};

/**
 * Rejects a NON-content operation attempted inside an authorized action-15
 * scope (ACC:15: "edita contenido y nada más"). Admin metadata (`adminInfo`)
 * is not listing content, so a route that opened the scope around its content
 * call can never reach it — not even if the scope were opened too wide. A
 * no-op outside an action-15 scope.
 *
 * @param input.operation - The refused operation, named in the error.
 * @throws ServiceError `FORBIDDEN` inside an ACC_15 scope.
 */
export function assertOutsideAction15Scope(input: { readonly operation: string }): void {
    if (isAction15Scope()) refuse([input.operation], 'edits content only');
}

/**
 * Rejects an action-15 update that writes anything but content, or content
 * carrying a moderation verdict. A no-op outside an authorized action-15 scope
 * (the owner and staff keep their own rules).
 *
 * @param input.data - The update payload as validated by the service schema.
 * @returns `{ rejectedFields }`, empty when the payload is accepted.
 * @throws ServiceError `FORBIDDEN` naming the refused fields, inside an ACC_15 scope.
 */
export function assertSupportEditContentOnly(input: {
    readonly data: Readonly<Record<string, unknown>>;
}): { readonly rejectedFields: readonly string[] } {
    if (!isAction15Scope()) return { rejectedFields: [] };
    const rejectedFields = Object.entries(input.data)
        .filter(([field, value]) => value !== undefined && !CONTENT_FIELDS.has(field))
        .map(([field]) => field)
        .sort();
    findModerationVerdicts(input.data, '', rejectedFields);
    if (rejectedFields.length > 0) refuse(rejectedFields, 'edits content only');
    return { rejectedFields };
}

/**
 * Rejects an action-15 create that would be born anything but an unpublished,
 * unmoderated, unfeatured draft (ACC:15: "crearla en borrador a nombre de su
 * dueño ... sin publicar, sin destacar"). A no-op outside an action-15 scope.
 *
 * @param input.data - The create payload as validated by the service schema.
 * @returns `{ rejectedFields }`, empty when the payload is accepted.
 * @throws ServiceError `FORBIDDEN` naming the refused fields, inside an ACC_15 scope.
 */
export function assertSupportCreateIsDraft(input: {
    readonly data: Readonly<Record<string, unknown>>;
}): { readonly rejectedFields: readonly string[] } {
    if (!isAction15Scope()) return { rejectedFields: [] };
    const { data } = input;
    const allowed: Readonly<Record<string, (value: unknown) => boolean>> = {
        lifecycleState: (value) => value === 'DRAFT',
        visibility: (value) => value === 'PRIVATE',
        publicationStatus: (value) => value === 'DRAFT',
        isFeatured: (value) => value === false,
        featuredByEntitlement: (value) => value === false
    };
    const rejectedFields = Object.entries(allowed)
        .filter(([field, isDraft]) => data[field] !== undefined && !isDraft(data[field]))
        .map(([field]) => field);
    findModerationVerdicts(data, '', rejectedFields);
    if (rejectedFields.length > 0) refuse(rejectedFields, 'creates drafts only');
    return { rejectedFields };
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
