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
 * | pause | `PUBLISHED` | `unpublish` (PB6 → `DRAFT`) | `EDIT` |
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
 *
 * **Publishing is two steps (HOS-2247, owner decision D-19).** A `resume` that
 * would run `publish` first answers a preview and writes nothing: after the
 * dry run of the publish access step it issues a single-use token, or, on a
 * client that renders confirmation forms, asks the human through that form.
 * Only the second call, proven by the token or by the human's `confirm`, runs
 * steps 2 to 4 above (`publish-confirmation.ts`). `pause`, and a `resume` that
 * only reactivates or changes nothing, stay one step.
 */

import { PublicationStatusEnum, ServiceErrorCode, VerticalEnum } from '@repo/schemas';
import { type Actor, entityNotFoundError, ServiceError } from '@repo/service-core';
import { z } from 'zod';
import {
    decideListingAccess,
    type ListingAccessWithSections,
    throwListingAccessRefusal
} from '../../../middlewares/listing-access';
import { captureAccommodationPublished } from '../../../services/listing-publication/accommodation-published-analytics';
import { ListingPublicationService } from '../../../services/listing-publication/listing-publication.service';
import { confirmationTokenRefused, planConfirmation } from '../elicitation-confirmation';
import { defineTool, type ToolHandlerOutput, type ToolHandlerResult } from '../tool-definition';
import {
    type ListingDetail,
    readOwnListingDetail,
    readOwnListingDetailWithRow
} from './get-listing';
import { listingRefusalLink, readListingRef } from './listing-refusal-actions';
import { type ListingToolVertical, ListingToolVerticalSchema } from './listing-services';
import { LISTING_MODERATED_REASON, publicationRefusalLink } from './publication-refusal-link';
import {
    confirmPublishCommit,
    issuePublishPreview,
    type ListingPublicationPreview,
    publicationAuditDetails,
    publishBinding,
    readPublishListingFacts,
    refuseUnneededConfirmation,
    SET_LISTING_PUBLICATION_TOOL_NAME
} from './publish-confirmation';
import {
    publicationRefusalReason,
    SET_LISTING_PUBLICATION_REASON_MESSAGES,
    toRefusal
} from './set-listing-publication-refusals';

export type { ListingPublicationPreview };
export {
    LISTING_MODERATED_REASON,
    publicationRefusalReason,
    SET_LISTING_PUBLICATION_REASON_MESSAGES
};

/** What the owner asks for. */
export const LISTING_PUBLICATION_ACTIONS = ['pause', 'resume'] as const;

/** One of {@link LISTING_PUBLICATION_ACTIONS}. */
export type ListingPublicationAction = (typeof LISTING_PUBLICATION_ACTIONS)[number];

/** The owner publication route a call runs. */
export type ListingPublicationStep = 'UNPUBLISH' | 'PUBLISH' | 'REACTIVATE';

/**
 * Per step, the `listingAccess.operation` its three routes declare
 * (`unpublish.ts` → `EDIT`, `publish.ts` → `PUBLISH`, `reactivate.ts` →
 * `REACTIVATE`; identical across verticals).
 */
export const PUBLICATION_STEP_OPERATION = {
    UNPUBLISH: 'EDIT',
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
            ),
        confirmationToken: z
            .string()
            .min(1)
            .optional()
            .describe(
                'Only to publish. Omit on the first call. Pass the confirmationToken returned by the preview ONLY after the user explicitly approved publishing, repeating the same vertical, id and action.'
            )
    })
    .strict();

/** Validated input of `set_listing_publication`. */
export type SetListingPublicationInput = z.output<typeof SetListingPublicationInputSchema>;

/** Result of a `set_listing_publication` call that changed (or kept) the state. */
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

/** What `set_listing_publication` answers: a publish preview, or the state after the call. */
export type SetListingPublicationResult = ListingPublicationResult | ListingPublicationPreview;

/** `ListingPublicationService` as the publication routes build it, once per process. */
const listingPublicationService = new ListingPublicationService();

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
 *
 * The name is a literal because the help-coverage guard (b4) reads it from this
 * file's source; `satisfies` keeps it equal to the shared constant.
 */
export const setListingPublicationTool = defineTool({
    name: 'set_listing_publication' satisfies typeof SET_LISTING_PUBLICATION_TOOL_NAME,
    title: 'Pausar o reanudar una publicación',
    description:
        "Pauses or resumes one listing the connected Hospeda user owns. pause hides a published listing from the public site (it becomes a draft); pausing a listing that is not online changes nothing. resume puts a draft listing, or one paused for lack of payment, back online; resuming a listing that is already online changes nothing. Putting a listing online is two steps: the first resume publishes nothing and answers a preview with a confirmationToken; tell the user it will become public and, only after they explicitly approve, call again with the same vertical, id and action plus the confirmationToken (some apps instead show the user their own confirmation form: then there is no token, and it goes online only if the user confirms there). Never confirm on the user's behalf. pause runs in one step. An archived listing returns to draft on the first resume (one step) and goes online on a second one. Going online needs an active plan or the free trial and a free slot in the plan; when Hospeda refuses, the answer explains why. A listing that does not exist or belongs to someone else is reported as not found. Take vertical and id from list_my_listings. Answers with the state before and after and the public URL when the listing is online.",
    inputSchema: SetListingPublicationInputSchema,
    isWrite: true,
    hints: { destructiveHint: true, idempotentHint: false },
    confirmation: { elicitation: true },
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
    auditDetails: ({ input, context, data }) => publicationAuditDetails({ input, context, data }),
    handler: async ({
        actor,
        input,
        context
    }): Promise<ToolHandlerOutput<SetListingPublicationResult>> => {
        const { vertical, id, action, confirmationToken } = input;

        const read = await readOwnListingDetailWithRow({ actor, vertical, id });
        if (read.error) {
            return read;
        }
        const before = read.data.detail;
        const previousStatus = before.publicationStatus;
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

        const publishes = plan.kind === 'run' && plan.step === 'PUBLISH';
        if (publishes || confirmationToken !== undefined || context.confirmation?.answer) {
            // The proof is bound to the OAuth client; without one there is nothing to bind.
            const { clientId } = context;
            if (clientId === undefined) {
                return {
                    error: {
                        code: ServiceErrorCode.UNAUTHORIZED,
                        message:
                            'set_listing_publication needs an identified OAuth client to publish'
                    }
                };
            }
            const binding = publishBinding({ userId: actor.id, clientId, vertical, id });
            if (!publishes) {
                return refuseUnneededConfirmation({ binding, confirmationToken, context });
            }
            const confirmation = planConfirmation({
                tool: SET_LISTING_PUBLICATION_TOOL_NAME,
                confirmationToken,
                context
            });
            if (confirmation.step === 'token_refused') {
                return confirmationTokenRefused();
            }
            if (confirmation.step === 'preview') {
                // Dry run of the publish access step: a refusal shows now,
                // before the user is asked to confirm. Nothing is written.
                try {
                    const refused = await authorizeStep({ actor, vertical, id, step: 'PUBLISH' });
                    if (refused) {
                        return refused;
                    }
                } catch (error) {
                    if (error instanceof ServiceError) {
                        return toRefusal(error);
                    }
                    throw error;
                }
                return issuePublishPreview({
                    binding,
                    mode: confirmation.mode,
                    listing: {
                        id,
                        vertical,
                        name: before.name,
                        previousStatus,
                        ...(await readPublishListingFacts({ vertical, row: read.data.row }))
                    }
                });
            }
            const refused = await confirmPublishCommit({ binding, plan: confirmation });
            if (refused) {
                return refused;
            }
        }

        let current: ListingDetail = before;
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
