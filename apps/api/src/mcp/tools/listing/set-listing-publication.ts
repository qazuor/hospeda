/**
 * @file set-listing-publication.ts
 * @description Tool `set_listing_publication` (HOS-2184 T-018, spec §6.5, AC-6,
 * AC-7, AC-12): the owner pauses or resumes one of their listings.
 *
 * It is a thin adapter over the owner publication routes of each vertical
 * (`routes/{accommodation,venue,experience}/protected/{unpublish,publish,reactivate}.ts`).
 * Those routes do not choose between themselves: the caller does. This tool
 * chooses from the listing's current state, then runs exactly the route it
 * picked:
 *
 * | action | current state | runs | route's listing access |
 * |---|---|---|---|
 * | pause | `PUBLISHED` | `unpublish` (PB6 → `DRAFT`) | `UNPUBLISH` |
 * | pause | any other | nothing (already not public) | — |
 * | resume | `DRAFT`, `UNPUBLISHED_BY_BILLING` | `publish` (PB1 → `PUBLISHED`) | `PUBLISH` |
 * | resume | `ARCHIVED` | `reactivate` (PB8 → `DRAFT`) | `REACTIVATE` |
 * | resume | `PUBLISHED` | nothing (already public) | — |
 * | resume | `MODERATED` | refused: only Hospeda lifts a moderation | — |
 *
 * `reactivate` leaves the listing in `DRAFT`, not public, exactly like its
 * route: the answer says so and a second `resume` publishes it. The two steps
 * are never chained, so one call is always one route and a billing refusal of
 * the publish never leaves a half-done change behind it.
 *
 * Steps per call:
 * 1. **Ownership and state.** `readOwnListingDetail` (the `get_listing`
 *    reader): a missing, foreign or purged listing is the uniform not found.
 * 2. **Listing access.** `decideListingAccess` with the picked route's
 *    declaration, owner-only (`ownerOnly`), so a foreign listing is not found
 *    even for staff. Steps 5 (coverage), 6 (capability) and 7 run as for the
 *    route.
 * 3. **The service call** the route makes: `ListingPublicationService`
 *    `unpublish` / `publish` / `reactivate`. Trial start, the limit check, the
 *    paid-signups freeze, cache invalidation and public-page revalidation all
 *    live there, so they run exactly as for the route. An accommodation
 *    publish also emits the route's `accommodationPublished` event.
 * 4. **The answer**: the state before and after, and the public URL when the
 *    listing ended up published (re-read with the `get_listing` reader).
 *
 * Billing and publication refusals keep the route's codes; each one gets a
 * `reason` (see {@link publicationRefusalReason}) so the user reads a Spanish
 * explanation of what blocked it instead of a generic message.
 */

import {
    DUPLICATE_LOCATION_REASON,
    NO_PLANS_AVAILABLE_MESSAGE,
    PUBLISH_REQUIREMENTS_MISSING_REASON_PREFIX,
    PublicationStatusEnum,
    ServiceErrorCode,
    VerticalEnum
} from '@repo/schemas';
import {
    type Actor,
    entityNotFoundError,
    FIRST_PUBLISH_PAUSED_REASON,
    ServiceError
} from '@repo/service-core';
import { z } from 'zod';
import {
    decideListingAccess,
    type ListingAccessWithSections,
    throwListingAccessRefusal
} from '../../../middlewares/listing-access';
import { captureAccommodationPublished } from '../../../services/listing-publication/accommodation-published-analytics';
import { ListingPublicationService } from '../../../services/listing-publication/listing-publication.service';
import { defineTool, type ToolErrorPayload, type ToolHandlerResult } from '../tool-definition';
import { type ListingDetail, readOwnListingDetail } from './get-listing';
import { listingRefusalLink, readListingRef } from './listing-refusal-actions';
import { type ListingToolVertical, ListingToolVerticalSchema } from './listing-services';
import {
    LISTING_INCOMPLETE_MESSAGE_PREFIX,
    LISTING_INCOMPLETE_REASON,
    LISTING_MODERATED_REASON,
    missingRequirementsOf,
    publicationRefusalLink
} from './publication-refusal-link';

export { LISTING_MODERATED_REASON };

/** What the owner asks for. */
export const LISTING_PUBLICATION_ACTIONS = ['pause', 'resume'] as const;

/** One of {@link LISTING_PUBLICATION_ACTIONS}. */
export type ListingPublicationAction = (typeof LISTING_PUBLICATION_ACTIONS)[number];

/** The owner publication route a call runs. */
export type ListingPublicationStep = 'UNPUBLISH' | 'PUBLISH' | 'REACTIVATE';

/**
 * Per step, the `listingAccess.operation` its three routes declare
 * (`unpublish.ts` → `UNPUBLISH`, `publish.ts` → `PUBLISH`, `reactivate.ts` →
 * `REACTIVATE`; identical across verticals).
 */
export const PUBLICATION_STEP_OPERATION = {
    UNPUBLISH: 'UNPUBLISH',
    PUBLISH: 'PUBLISH',
    REACTIVATE: 'REACTIVATE'
} as const satisfies Record<ListingPublicationStep, ListingAccessWithSections['operation']>;

/** What a call does, decided from the action and the listing's current state. */
export type ListingPublicationPlan =
    | { readonly kind: 'run'; readonly step: ListingPublicationStep }
    | { readonly kind: 'noop' }
    | { readonly kind: 'refuse'; readonly reason: typeof LISTING_MODERATED_REASON };

/**
 * Picks the route for an action on a listing in a given state (see the table
 * in the file header).
 *
 * @param args - The action and the listing's current publication state
 * @returns The step to run, a no-op, or a refusal
 */
export function planListingPublication(args: {
    readonly action: ListingPublicationAction;
    readonly status: PublicationStatusEnum;
}): ListingPublicationPlan {
    const { action, status } = args;
    if (action === 'pause') {
        return status === PublicationStatusEnum.PUBLISHED
            ? { kind: 'run', step: 'UNPUBLISH' }
            : { kind: 'noop' };
    }
    switch (status) {
        case PublicationStatusEnum.DRAFT:
        case PublicationStatusEnum.UNPUBLISHED_BY_BILLING:
            return { kind: 'run', step: 'PUBLISH' };
        case PublicationStatusEnum.ARCHIVED:
            return { kind: 'run', step: 'REACTIVATE' };
        case PublicationStatusEnum.MODERATED:
            return { kind: 'refuse', reason: LISTING_MODERATED_REASON };
        default:
            // PUBLISHED; PURGED never gets here (the reader answers not found).
            return { kind: 'noop' };
    }
}

/** Input schema: one flat object (MCP clients reject a top-level `oneOf`). */
export const SetListingPublicationInputSchema = z
    .object({
        vertical: ListingToolVerticalSchema.describe(
            'The vertical returned by list_my_listings for this listing.'
        ),
        id: z.uuid().describe('The listing id returned by list_my_listings.'),
        action: z
            .enum(LISTING_PUBLICATION_ACTIONS)
            .describe(
                'pause: hide the listing from the public site (it stays as a draft). resume: put it back online; an archived listing first returns to draft and needs a second resume.'
            )
    })
    .strict();

/** Validated input of `set_listing_publication`. */
export type SetListingPublicationInput = z.output<typeof SetListingPublicationInputSchema>;

/** Result of `set_listing_publication`. */
export interface ListingPublicationResult {
    /** Listing id. */
    readonly id: string;
    /** Listing vertical. */
    readonly vertical: ListingToolVertical;
    /** Public name. */
    readonly name: string;
    /** The action asked for. */
    readonly action: ListingPublicationAction;
    /** Whether the state changed. `false` when it already was where asked. */
    readonly changed: boolean;
    /** State before the call. */
    readonly previousStatus: PublicationStatusEnum;
    /** State after the call. */
    readonly publicationStatus: PublicationStatusEnum;
    /** Absolute public URL when the listing is `PUBLISHED`, otherwise `null`. */
    readonly publicUrl: string | null;
    /** Spanish one-line summary for the user. */
    readonly summary: string;
}

/** `ListingPublicationService` as the publication routes build it, once per process. */
const listingPublicationService = new ListingPublicationService();

/**
 * The message both sides of the publish contract use for "a plan is needed"
 * (`mapListingPublishDenial` and `throwListingAccessRefusal`).
 */
const SUBSCRIPTION_REQUIRED_MESSAGE = 'subscription_required';

/** The message `ListingPublicationService` uses when PB1/PB6/PB8 lost a race. */
const STATE_CHANGED_MESSAGE = 'Listing state changed';

/** Reads `details.reason` of a service error, when it carries one. */
function detailsReason(details: unknown): unknown {
    return typeof details === 'object' && details !== null && 'reason' in details
        ? details.reason
        : undefined;
}

/**
 * The `reason` a publication refusal is shown with. The routes signal most
 * refusals through their code and message, not `ServiceError.reason`, so the
 * tool names them here; each name has a Spanish entry in
 * {@link SET_LISTING_PUBLICATION_REASON_MESSAGES}. `undefined` keeps the
 * code's default message.
 *
 * @param error - A refusal from listing access or `ListingPublicationService`
 * @returns The reason to show it with
 */
export function publicationRefusalReason(error: ServiceError): string | undefined {
    switch (error.code) {
        case ServiceErrorCode.ENTITLEMENT_REQUIRED:
            return detailsReason(error.details) === 'NO_COVERAGE' ? 'NO_COVERAGE' : 'NO_CAPABILITY';
        case ServiceErrorCode.FORBIDDEN:
            if (error.message === NO_PLANS_AVAILABLE_MESSAGE) return 'NO_PLANS_AVAILABLE';
            if (error.message === SUBSCRIPTION_REQUIRED_MESSAGE) return 'SUBSCRIPTION_REQUIRED';
            return undefined;
        case ServiceErrorCode.LIMIT_REACHED:
            return 'LISTING_LIMIT_REACHED';
        case ServiceErrorCode.NEW_PAID_SIGNUPS_FROZEN:
            return FIRST_PUBLISH_PAUSED_REASON;
        case ServiceErrorCode.VALIDATION_ERROR:
            return error.reason?.startsWith(PUBLISH_REQUIREMENTS_MISSING_REASON_PREFIX) ||
                error.message.startsWith(LISTING_INCOMPLETE_MESSAGE_PREFIX)
                ? LISTING_INCOMPLETE_REASON
                : undefined;
        case ServiceErrorCode.ALREADY_EXISTS:
            if (error.reason === DUPLICATE_LOCATION_REASON) return DUPLICATE_LOCATION_REASON;
            return error.message === STATE_CHANGED_MESSAGE
                ? 'PUBLICATION_STATE_CHANGED'
                : undefined;
        default:
            return undefined;
    }
}

/**
 * Converts a refusal into the tool error, with its reason when it has one. A
 * completeness refusal also carries the unmet requirements in `details`: the
 * named reason replaces the service's own, which is where an accommodation
 * keeps them, and `refusalAction` needs them to pick the editor section.
 */
function toRefusal(error: ServiceError): ToolHandlerResult<never> {
    const reason = publicationRefusalReason(error) ?? error.reason;
    const details =
        reason === LISTING_INCOMPLETE_REASON
            ? { missing: missingRequirementsOf({ reason: error.reason, message: error.message }) }
            : error.details;
    const payload: ToolErrorPayload = {
        code: error.code,
        message: error.message,
        details,
        ...(reason === undefined ? {} : { reason }),
        // An incomplete listing is a refusal by Hospeda the owner can fix, not bad
        // data from the assistant (HOS-2375): the audit row says `denied`.
        ...(reason === LISTING_INCOMPLETE_REASON ? { kind: 'denied' as const } : {})
    };
    return { error: payload };
}

/** Spanish messages for every refusal the publication path can return. */
export const SET_LISTING_PUBLICATION_REASON_MESSAGES: Readonly<Record<string, string>> = {
    NO_COVERAGE:
        'No tenés un plan activo ni una prueba gratis que cubra este tipo de publicación. Elegí un plan desde tu panel de Hospeda.',
    NO_CAPABILITY:
        'Tu plan actual no incluye esta acción sobre la publicación. Revisá o mejorá tu plan desde tu panel de Hospeda.',
    SUBSCRIPTION_REQUIRED:
        'Para publicar necesitás un plan activo: la prueba gratis ya se usó o no corresponde. Elegí un plan desde tu panel de Hospeda.',
    NO_PLANS_AVAILABLE:
        'Por ahora Hospeda no ofrece planes para este tipo de publicación, así que no se puede publicar. Probá más adelante.',
    LISTING_LIMIT_REACHED:
        'Llegaste a la cantidad máxima de publicaciones activas que permite tu plan. Pausá otra publicación o mejorá tu plan.',
    [FIRST_PUBLISH_PAUSED_REASON]:
        'Hospeda pausó por un tiempo las altas nuevas, así que ahora no se puede empezar la prueba gratis publicando. Probá más adelante.',
    LISTING_INCOMPLETE:
        'A la publicación le faltan datos obligatorios para salir online. Completala desde tu panel de Hospeda y volvé a intentar.',
    [DUPLICATE_LOCATION_REASON]:
        'Ya tenés otra publicación activa en la misma dirección. Pausá esa primero o pedile una excepción a Hospeda.',
    PUBLICATION_STATE_CHANGED:
        'El estado de la publicación cambió mientras se procesaba el pedido. Consultalo con get_listing y volvé a intentar.',
    [LISTING_MODERATED_REASON]:
        'Hospeda dio de baja esta publicación por moderación, así que no se puede reanudar desde acá. Revisá el pedido de corrección en tu panel.'
};

/** The uniform not-found error, whatever the vertical. */
function notFound(): ToolHandlerResult<never> {
    const error = entityNotFoundError({ entityName: 'listing' });
    return { error: { code: error.code, message: error.message } };
}

/**
 * Runs the picked route's listing-access step, owner-only. Resolves to
 * `undefined` when allowed and to the not-found error for a foreign or
 * missing listing; any other refusal is thrown as the route throws it.
 */
async function authorizeStep(input: {
    readonly actor: Actor;
    readonly vertical: ListingToolVertical;
    readonly id: string;
    readonly step: ListingPublicationStep;
}): Promise<ToolHandlerResult<never> | undefined> {
    const config: ListingAccessWithSections = {
        vertical: input.vertical,
        operation: PUBLICATION_STEP_OPERATION[input.step],
        idParam: 'id'
    };
    const decision = await decideListingAccess({
        actor: input.actor,
        listingId: input.id,
        config,
        tier: 'protected',
        ownerOnly: true
    });
    if (decision === null) {
        return notFound(); // never for these operations; fail closed
    }
    const { result, subjectId, ports } = decision;
    if (result.allowed) {
        return undefined;
    }
    if (result.reason === 'NOT_FOUND') {
        return notFound();
    }
    return throwListingAccessRefusal({ config, result, subjectId, ports });
}

/** Calls the `ListingPublicationService` method the picked route calls. */
async function runStep(input: {
    readonly actor: Actor;
    readonly vertical: ListingToolVertical;
    readonly id: string;
    readonly step: ListingPublicationStep;
}): Promise<void> {
    const { actor, vertical, id, step } = input;
    if (step === 'UNPUBLISH') {
        await listingPublicationService.unpublish({ actor, id, vertical });
        return;
    }
    if (step === 'REACTIVATE') {
        await listingPublicationService.reactivate({ actor, id, vertical });
        return;
    }
    const published = await listingPublicationService.publish({ actor, id, vertical });
    if (vertical === VerticalEnum.ACCOMMODATION) {
        captureAccommodationPublished({ actorId: actor.id, accommodation: published });
    }
}

/** The Spanish summary of a call's outcome. */
function summarize(input: {
    readonly action: ListingPublicationAction;
    readonly changed: boolean;
    readonly status: PublicationStatusEnum;
}): string {
    const { action, changed, status } = input;
    if (status === PublicationStatusEnum.PUBLISHED) {
        return changed
            ? 'La publicación quedó online en el sitio público.'
            : 'La publicación ya estaba online; no se cambió nada.';
    }
    if (action === 'resume' && changed && status === PublicationStatusEnum.DRAFT) {
        return 'La publicación salió del archivo y quedó como borrador, todavía no visible. Volvé a pedir reanudarla para ponerla online.';
    }
    return changed
        ? 'La publicación quedó pausada: ya no se ve en el sitio público.'
        : 'La publicación ya no estaba visible en el sitio público; no se cambió nada.';
}

/**
 * `set_listing_publication`: a write that can hide a listing (`pause`), so it
 * is destructive for the client. Not idempotent: `resume` on an archived
 * listing first returns it to draft, and repeating it then publishes it.
 */
export const setListingPublicationTool = defineTool({
    name: 'set_listing_publication',
    title: 'Pausar o reanudar una publicación',
    description:
        'Pauses or resumes one listing the connected Hospeda user owns. pause hides a published listing from the public site (it becomes a draft); pausing a listing that is not online changes nothing. resume puts a draft listing, or one paused for lack of payment, back online; resuming a listing that is already online changes nothing. An archived listing returns to draft on the first resume and goes online on a second one. Going online needs an active plan or the free trial and a free slot in the plan; when Hospeda refuses, the answer explains why. A listing that does not exist or belongs to someone else is reported as not found. Take vertical and id from list_my_listings. Answers with the state before and after and the public URL when the listing is online.',
    inputSchema: SetListingPublicationInputSchema,
    isWrite: true,
    hints: { destructiveHint: true, idempotentHint: false },
    reasonMessages: SET_LISTING_PUBLICATION_REASON_MESSAGES,
    refusalAction: ({ error, input }) => {
        const ref = readListingRef({ input });
        if (ref === undefined) {
            return undefined;
        }
        const destination = publicationRefusalLink({ error, ref });
        if (destination !== undefined) {
            return { destination };
        }
        // A refusal the tool names (no plans offered, paid signups paused, a
        // lost race) has no page that fixes it; only an unnamed one falls back.
        return error.reason === undefined ? listingRefusalLink({ error, ref }) : undefined;
    },
    auditTarget: ({ input }) => ({ type: input.vertical, id: input.id }),
    handler: async ({ actor, input }): Promise<ToolHandlerResult<ListingPublicationResult>> => {
        const { vertical, id, action } = input;

        const before = await readOwnListingDetail({ actor, vertical, id });
        if (before.error) {
            return before;
        }
        const previousStatus = before.data.publicationStatus;
        const plan = planListingPublication({ action, status: previousStatus });

        if (plan.kind === 'refuse') {
            return {
                error: {
                    code: ServiceErrorCode.FORBIDDEN,
                    message: 'Moderated listing cannot be resumed by its owner',
                    reason: plan.reason
                }
            };
        }

        let current: ListingDetail = before.data;
        if (plan.kind === 'run') {
            try {
                const refused = await authorizeStep({ actor, vertical, id, step: plan.step });
                if (refused) {
                    return refused;
                }
                await runStep({ actor, vertical, id, step: plan.step });
            } catch (error) {
                if (error instanceof ServiceError) {
                    return toRefusal(error);
                }
                throw error;
            }
            const after = await readOwnListingDetail({ actor, vertical, id });
            if (after.error) {
                return after;
            }
            current = after.data;
        }

        const { publicationStatus, publicUrl, name } = current;
        const changed = plan.kind === 'run';
        return {
            data: {
                id,
                vertical,
                name,
                action,
                changed,
                previousStatus,
                publicationStatus,
                publicUrl,
                summary: summarize({ action, changed, status: publicationStatus })
            }
        };
    }
});
