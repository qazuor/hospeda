/**
 * The register of a third party's business-line change on somebody else's
 * listing (ACC:27, HOS-1875, DEC-FAC-034).
 *
 * Action 15 edits content and rejects `businessLines`, so a support or admin
 * edit of a listing's classification runs through its own route and opens this
 * scope instead. Every accepted write records, in the SAME transaction as the
 * edit:
 *
 * - one `listing.edited` event with `actor_type = 'admin'`, the admin as actor,
 *   the reason when there is one, and the `businessLines` change with its old
 *   and new values (it is a non-content field, DEC-FAC-074);
 * - one email to the owner naming the lines and the sections that appear or
 *   stop being visible. The labels are built here, translated in the owner's
 *   web locale, so the template carries no business-line literal.
 *
 * The register never writes anything but the classification: an `ACC_27` scope
 * refuses every other field through {@link assertBusinessLinesChangeOnly}.
 *
 * @module services/listing/listing-business-lines-change
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
import { trans } from '@repo/i18n';
import { createLogger } from '@repo/logger';
import { type BusinessLine, ServiceErrorCode, type VenueOrExperience } from '@repo/schemas';
import { resolveBusinessLinesChange } from '@repo/verticals';
import { type Actor, type ServiceContext, ServiceError } from '../../types';
import { resolveServiceActionReason } from '../../utils/action-reason';
import { resolveAdministrativeAuthorization } from '../../utils/administrative-authorization';
import { resolveServiceCorrelationId } from '../../utils/correlation';
import { hasListingPermission } from './listing.permissions';
import type { ListingOwnerActEventType } from './listing-owner-act';

const logger = createLogger('listing-business-lines-change');

/** Template identifier of the "business lines of your listing changed" email. */
export const LISTING_BUSINESS_LINES_CHANGED_TEMPLATE = 'verticals.listing-business-lines-changed';

const isBusinessLinesChangeScope = (): boolean =>
    resolveAdministrativeAuthorization().authorization?.action === 'ACC_27';

/**
 * Whether the current write is action 27 on a listing of `ownerId`: an
 * authorized ACC_27 scope bound to that owner, an actor who is NOT the owner,
 * and the actor holding the vertical's `editAll` permission (defense in depth).
 * Never inferred from the permission alone, never decided by role.
 *
 * @param input.actor - The actor of the write.
 * @param input.ownerId - The owner of the listing written.
 * @param input.vertical - The listing's vertical, which selects the permission family.
 * @returns `true` only when all three hold.
 */
export function isBusinessLinesChangeAuthorizedFor(input: {
    readonly actor: Actor;
    readonly ownerId?: string | null;
    readonly vertical: VenueOrExperience;
}): boolean {
    const { actor, ownerId, vertical } = input;
    if (!ownerId || actor.id === ownerId) return false;
    const { authorization } = resolveAdministrativeAuthorization();
    if (authorization?.action !== 'ACC_27' || authorization.subjectId !== ownerId) return false;
    return hasListingPermission(actor, 'editAll', vertical);
}

/**
 * Rejects an action-27 update that writes anything but `businessLines`
 * (HOS-1875: "cambia la clasificación de la ficha y nada más"). A no-op outside
 * an authorized action-27 scope.
 *
 * @param input.data - The update payload as validated by the service schema.
 * @returns `{ rejectedFields }`, empty when the payload is accepted.
 * @throws ServiceError `FORBIDDEN` naming the refused fields, inside an ACC_27 scope.
 */
export function assertBusinessLinesChangeOnly(input: {
    readonly data: Readonly<Record<string, unknown>>;
}): { readonly rejectedFields: readonly string[] } {
    if (!isBusinessLinesChangeScope()) return { rejectedFields: [] };
    const rejectedFields = Object.entries(input.data)
        .filter(([field, value]) => value !== undefined && field !== 'businessLines')
        .map(([field]) => field)
        .sort();
    if (rejectedFields.length > 0) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            `Action 27 changes business lines only; not allowed: ${rejectedFields.join(', ')}`
        );
    }
    return { rejectedFields };
}

/** Input of {@link recordListingBusinessLinesChange}. */
export interface RecordListingBusinessLinesChangeInput {
    readonly eventType: ListingOwnerActEventType;
    readonly entityType: VenueOrExperience;
    /** The listing the act is about. */
    readonly listing: {
        readonly id: string;
        readonly ownerId?: string | null;
        readonly name?: string | null;
    };
    readonly actor: Actor;
    /** The service context of the write; its `tx` is mandatory for action 27. */
    readonly ctx?: ServiceContext;
    readonly changes: readonly DomainEventChange[];
}

/** The stored old/new values of the `businessLines` change, strings only. */
function storedValues(value: unknown): readonly string[] {
    return Array.isArray(value)
        ? value.filter((entry): entry is string => typeof entry === 'string')
        : [];
}

/**
 * Records one action-27 write: the auditable event and the owner's email, both
 * inside `ctx.tx`.
 *
 * A no-op unless {@link isBusinessLinesChangeAuthorizedFor} holds. Without a
 * transaction it throws: the event and the email must commit or roll back with
 * the edit. When the change list carries no `businessLines` entry (the
 * classification-only rule should prevent it) the event is still recorded and
 * no email is queued.
 *
 * @param input - The act, the listing, the actor, the context and the changes.
 * @returns `{ recorded }`, `false` when the write is not action 27.
 * @throws ServiceError `INTERNAL_ERROR` when called for action 27 without `ctx.tx`.
 */
export async function recordListingBusinessLinesChange(
    input: RecordListingBusinessLinesChangeInput
): Promise<{ readonly recorded: boolean }> {
    const { listing, actor, ctx, entityType } = input;
    if (
        !isBusinessLinesChangeAuthorizedFor({
            actor,
            ownerId: listing.ownerId,
            vertical: entityType
        })
    ) {
        return { recorded: false };
    }
    const tx = ctx?.tx;
    const ownerId = listing.ownerId;
    if (!tx || !ownerId) {
        throw new ServiceError(
            ServiceErrorCode.INTERNAL_ERROR,
            'A business-lines change (ACC:27) requires an active transaction; call it from within withServiceTransaction'
        );
    }

    const { correlationId } = resolveServiceCorrelationId({ ctx });
    const { reason } = resolveServiceActionReason({ ctx });
    await domainEventModel.insert({
        eventType: input.eventType,
        entityType,
        entityId: listing.id,
        actorId: actor.id,
        actorType: 'admin',
        reason,
        correlationId,
        changes: input.changes,
        tx
    });

    const businessLinesChange = input.changes.find((change) => change.field === 'businessLines');
    if (!businessLinesChange) {
        logger.warn(
            { listingId: listing.id },
            'A business-lines change (ACC:27) carried no businessLines change'
        );
        return { recorded: true };
    }

    const [ownerRow] = await tx
        .select({ email: users.email, settings: users.settings })
        .from(users)
        .where(eq(users.id, ownerId))
        .limit(1);
    if (!ownerRow?.email) {
        logger.warn({ listingId: listing.id }, 'No owner email for business-lines change notice');
        return { recorded: true };
    }

    const languageWeb = ownerRow.settings?.languageWeb;
    const locale = languageWeb === 'en' || languageWeb === 'pt' ? languageWeb : 'es';
    const label = (key: string, fallback: string): string =>
        trans[locale]?.[key] ?? trans.es?.[key] ?? fallback;

    const { addedLines, removedLines, shownSections, hiddenSections } = resolveBusinessLinesChange({
        vertical: entityType,
        before: storedValues(businessLinesChange.old),
        after: storedValues(businessLinesChange.new)
    });
    const lineLabel = (line: BusinessLine): string =>
        label(`${entityType}.owner.businessLines.${line}.label`, line);
    const sectionLabel = (sectionId: string): string =>
        label(`listing.owner.editor.sectionNav.${sectionId}`, sectionId);

    const template = LISTING_BUSINESS_LINES_CHANGED_TEMPLATE;
    await emailOutboxModel.enqueue(
        {
            recipientUserId: ownerId,
            recipientEmail: ownerRow.email,
            template,
            payload: {
                vertical: entityType,
                listingId: listing.id,
                listingName: listing.name ?? null,
                changedAt: new Date().toISOString(),
                addedLines: addedLines.map(lineLabel),
                removedLines: removedLines.map(lineLabel),
                shownSections: shownSections.map(sectionLabel),
                hiddenSections: hiddenSections.map(sectionLabel)
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
