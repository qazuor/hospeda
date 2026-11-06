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

/** Locales an owner's `languageWeb` can resolve to for the notice labels. */
type NoticeLocale = 'es' | 'en' | 'pt';

/** Namespaces the notice reads: the shared listing copy plus the vertical's labels. */
type NoticeNamespace = 'listing' | VenueOrExperience;

/** A nested locale namespace, as shipped under `@repo/i18n/locales`. */
type NestedCopy = Readonly<Record<string, unknown>>;

/**
 * Literal `import()` paths, one per locale × namespace.
 *
 * `@repo/i18n` is loaded lazily and by subpath: a static import pulls the whole
 * locale index (every JSON without an import attribute) into the module graph,
 * and the Playwright e2e runner strips those attributes, crashing native Node
 * ESM before the first test. This is the same pattern as
 * `services/billing/plan-display-name.ts`. The paths stay literal because the
 * API is bundled with tsup/esbuild, which cannot resolve a computed specifier.
 */
const NAMESPACE_LOADERS = {
    es: {
        listing: () => import('@repo/i18n/locales/es/listing.json', { with: { type: 'json' } }),
        venue: () => import('@repo/i18n/locales/es/venue.json', { with: { type: 'json' } }),
        experience: () =>
            import('@repo/i18n/locales/es/experience.json', { with: { type: 'json' } })
    },
    en: {
        listing: () => import('@repo/i18n/locales/en/listing.json', { with: { type: 'json' } }),
        venue: () => import('@repo/i18n/locales/en/venue.json', { with: { type: 'json' } }),
        experience: () =>
            import('@repo/i18n/locales/en/experience.json', { with: { type: 'json' } })
    },
    pt: {
        listing: () => import('@repo/i18n/locales/pt/listing.json', { with: { type: 'json' } }),
        venue: () => import('@repo/i18n/locales/pt/venue.json', { with: { type: 'json' } }),
        experience: () =>
            import('@repo/i18n/locales/pt/experience.json', { with: { type: 'json' } })
    }
} as const;

/** One promise per locale × namespace, so a hot send path parses each file once. */
const namespaceCache = new Map<string, Promise<NestedCopy>>();

/**
 * Loads one locale namespace once. A failed load is logged and evicted from the
 * cache so a later call can retry; the caller always receives an empty map and
 * falls back to the stored/raw value, because a cosmetic label must never break
 * the edit transaction.
 */
function loadNamespace(locale: NoticeLocale, namespace: NoticeNamespace): Promise<NestedCopy> {
    const key = `${locale}:${namespace}`;
    const cached = namespaceCache.get(key);
    if (cached) return cached;
    const loading = NAMESPACE_LOADERS[locale]
        [namespace]()
        .then((module) => module.default as NestedCopy)
        .catch((error: unknown) => {
            namespaceCache.delete(key);
            logger.warn(
                {
                    locale,
                    namespace,
                    error: error instanceof Error ? error.message : String(error)
                },
                'Listing translation could not be loaded; falling back to the raw value'
            );
            return {} as NestedCopy;
        });
    namespaceCache.set(key, loading);
    return loading;
}

/** Reads a nested key path, returning `undefined` when it is absent or empty. */
function readPath(copy: NestedCopy, path: readonly string[]): string | undefined {
    let cursor: unknown = copy;
    for (const segment of path) {
        if (typeof cursor !== 'object' || cursor === null) return undefined;
        cursor = (cursor as Record<string, unknown>)[segment];
    }
    return typeof cursor === 'string' && cursor.trim() !== '' ? cursor : undefined;
}

/** Reads `path` in the owner locale, falling back to the Spanish default. */
async function translate(
    namespace: NoticeNamespace,
    path: readonly string[],
    locale: NoticeLocale
): Promise<string | undefined> {
    const primary = readPath(await loadNamespace(locale, namespace), path);
    if (primary !== undefined) return primary;
    if (locale === 'es') return undefined;
    return readPath(await loadNamespace('es', namespace), path);
}

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
    const locale: NoticeLocale = languageWeb === 'en' || languageWeb === 'pt' ? languageWeb : 'es';

    const { addedLines, removedLines, shownSections, hiddenSections } = resolveBusinessLinesChange({
        vertical: entityType,
        before: storedValues(businessLinesChange.old),
        after: storedValues(businessLinesChange.new)
    });
    const lineLabel = async (line: BusinessLine): Promise<string> =>
        (await translate(entityType, ['owner', 'businessLines', line, 'label'], locale)) ?? line;
    const sectionLabel = async (sectionId: string): Promise<string> =>
        (await translate('listing', ['owner', 'editor', 'sectionNav', sectionId], locale)) ??
        sectionId;
    const [addedLineLabels, removedLineLabels, shownSectionLabels, hiddenSectionLabels] =
        await Promise.all([
            Promise.all(addedLines.map(lineLabel)),
            Promise.all(removedLines.map(lineLabel)),
            Promise.all(shownSections.map(sectionLabel)),
            Promise.all(hiddenSections.map(sectionLabel))
        ]);

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
                addedLines: addedLineLabels,
                removedLines: removedLineLabels,
                shownSections: shownSectionLabels,
                hiddenSections: hiddenSectionLabels
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
