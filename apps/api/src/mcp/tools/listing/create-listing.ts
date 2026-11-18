/**
 * @file create-listing.ts
 * @description `create_listing` (HOS-2329, spec HOS-2335 §6.4): creates a DRAFT
 * listing for the connected user, in two steps (P1, owner decision D-2).
 *
 * **Preview** (no `confirmationToken`): validates the input with the vertical's
 * portal schema (`create-listing-input.ts`), checks the destination, runs the
 * create route's listing-access step as a dry run, resolves `mapsUrl` under the
 * SSRF guard (§5.5), reads the publish quota (informational) and the duplicate
 * address rule (a warning), and answers exactly what will be created plus a
 * token. NOTHING is written.
 *
 * **Commit** (same input + token): consumes the token, which is bound to
 * `(user, client, 'create_listing', vertical, payload)` and to the point the
 * preview resolved (the token's stash, `confirmation-token-store.ts`). Any
 * change to the payload (name, `mapsUrl`, street, number...) burns the token
 * and writes nothing; consumption is a Redis GETDEL, so two racing commits
 * create one listing. The link is NOT resolved again: the commit writes the
 * previewed point. Then the access step runs for real and the single write
 * goes through the portal route's own create function
 * (`create-listing-steps.ts`). No path publishes: the row is born `DRAFT`,
 * no trial starts (it starts on the first publish).
 *
 * **Out-of-band confirmation (HOS-2247).** On a client that declares, on the
 * request, that it renders confirmation forms, the preview issues NO token: it
 * binds the same payload and the same resolved point to an opaque state and
 * asks the client to show the human the listing and the point
 * (`elicitation-confirmation.ts`). Only the human's `confirm` commits, once,
 * writing exactly the stashed point (AC-C64). A token from such a client is
 * refused (D-17).
 */

import { ServiceErrorCode } from '@repo/schemas';
import { z } from 'zod';
import { consumeConfirmationToken, issueConfirmationToken } from '../confirmation-token-store';
import {
    confirmationAuditDetails,
    confirmationTokenRefused,
    ELICITATION_REASON_MESSAGES,
    type ElicitationBinding,
    elicitationStateInvalid,
    issueConfirmationState,
    needsConfirmation,
    planConfirmation,
    settleConfirmationAnswer
} from '../elicitation-confirmation';
import { defineTool, type ToolHandlerOutput, type ToolHandlerResult } from '../tool-definition';
import { UNTRUSTED_DATA_NOTICE, wrapUntrustedText } from '../untrusted-data';
import {
    bindingPayloadOf,
    type CreateListingInput,
    CreateListingInputSchema
} from './create-listing-input';
import {
    type CreateListingNextStep,
    listingPortalUrl,
    nextStepsFor,
    refusalActionFor
} from './create-listing-links';
import {
    createListingConfirmationMessage,
    previewInstructions,
    previewListing
} from './create-listing-preview';
import {
    authorizeOwnerCreate,
    bodyHasLocation,
    buildCreateBody,
    hasDuplicateAddress,
    validateCreateBody,
    writeOwnerCreate
} from './create-listing-steps';
import {
    MAPS_LINK_FAILURE_MESSAGES,
    type MapsPoint,
    type ResolveGoogleMapsLinkDeps,
    resolveGoogleMapsLink
} from './google-maps-link';
import {
    findCreationDestination,
    type PublishQuotaNote,
    readPublishQuotaNote
} from './listing-creation-catalog';
import type { ListingToolVertical } from './listing-services';

/** Tool name, also the token's `tool` binding. */
export const CREATE_LISTING_TOOL_NAME = 'create_listing';

/** Reason of the error a token that cannot be used answers with. */
export const CREATE_CONFIRMATION_INVALID_REASON = 'CONFIRMATION_INVALID';
/** Reason of the error answered when the token store is down. */
export const CREATE_CONFIRMATION_UNAVAILABLE_REASON = 'CONFIRMATION_UNAVAILABLE';

/** Spanish messages for the reasons this tool can answer with. */
export const CREATE_LISTING_REASON_MESSAGES: Readonly<Record<string, string>> = {
    ...ELICITATION_REASON_MESSAGES,
    [CREATE_CONFIRMATION_INVALID_REASON]:
        'La confirmación no es válida: venció, ya se usó o algún dato cambió. No se creó nada. Volvé a llamar a create_listing SIN confirmationToken para generar una nueva vista previa y pedile al usuario que la confirme.',
    [CREATE_CONFIRMATION_UNAVAILABLE_REASON]:
        'El servicio no está disponible en este momento, probá más tarde. No se creó nada.',
    NO_COVERAGE:
        'Para crear esta publicación necesitás un plan activo o la prueba gratuita de esta categoría. No se creó nada.',
    SECTION_ABSENT:
        'Las líneas de negocio elegidas no admiten alguno de los datos enviados. No se creó nada.'
};

/** The stash the preview keeps with the token: the point it showed the user. */
const PreviewStashSchema = z
    .object({
        point: z.object({ lat: z.number(), lng: z.number() }).strict().nullable()
    })
    .strict();

/** The slice of a commit result the audit row targets. */
const CreatedAuditSchema = z.looseObject({
    status: z.literal('created'),
    vertical: z.string(),
    id: z.string()
});

export type { CreateListingNextStep };

/** What the preview answers. */
export interface CreateListingPreview {
    readonly status: 'confirmation_required';
    readonly vertical: ListingToolVertical;
    readonly listing: Readonly<Record<string, unknown>>;
    readonly location: {
        readonly coordinates: MapsPoint | null;
        readonly mapCheckUrl?: string;
        readonly addressHint?: string;
        readonly street?: string;
        readonly number?: string;
        readonly duplicateAddressWarning?: string;
    } | null;
    readonly publishQuota: PublishQuotaNote;
    readonly confirmationToken: string;
    readonly expiresInSeconds: number;
    readonly instructions: string;
}

/** What the commit answers. */
export interface CreateListingCreated {
    readonly status: 'created';
    readonly id: string;
    readonly vertical: ListingToolVertical;
    readonly publicationStatus: 'DRAFT';
    readonly editorUrl: string;
    readonly nextSteps: readonly CreateListingNextStep[];
}

/** Result of a call. */
export type CreateListingResult = CreateListingPreview | CreateListingCreated;

/** The error answered when the token store cannot be used. Nothing was written. */
function storeUnavailable(): ToolHandlerResult<never> {
    return {
        error: {
            code: ServiceErrorCode.SERVICE_UNAVAILABLE,
            message: 'Confirmation token store unavailable',
            reason: CREATE_CONFIRMATION_UNAVAILABLE_REASON
        }
    };
}

/** The error a token that cannot be used answers with. Nothing was written. */
function tokenInvalid(): ToolHandlerResult<never> {
    return {
        error: {
            code: ServiceErrorCode.VALIDATION_ERROR,
            message: 'Confirmation token missing, expired, used or mismatched',
            reason: CREATE_CONFIRMATION_INVALID_REASON
        }
    };
}

/** A field error, in the shape `formatValidationMessage` names fields from. */
function fieldError(field: string, message: string): ToolHandlerResult<never> {
    return {
        error: {
            code: ServiceErrorCode.VALIDATION_ERROR,
            message: `${field}: ${message}`,
            details: [{ path: [field], message }]
        }
    };
}

/** The Google Maps link that shows a point, for the user to check it. */
function mapCheckUrl(point: MapsPoint): string {
    return `https://www.google.com/maps?q=${point.lat},${point.lng}`;
}

/** Optional injection points (tests inject the Maps fetcher; never the network). */
export interface CreateListingDeps extends ResolveGoogleMapsLinkDeps {}

/**
 * Builds the `create_listing` definition. The registry uses
 * {@link createListingTool}; tests build one with a stubbed Maps fetcher.
 *
 * @param deps - Optional Maps fetcher
 * @returns The tool definition
 */
export function buildCreateListingTool(deps: CreateListingDeps = {}) {
    return defineTool({
        name: CREATE_LISTING_TOOL_NAME,
        title: 'Crear publicación',
        description: `Creates a DRAFT listing (accommodation, venue or experience) for the connected Hospeda user, in two steps. First call get_listing_creation_guide and collect the fields step by step with the user, in their own words. Step 1: call without confirmationToken. Nothing is created; you get a preview and a confirmationToken (some apps instead show the user their own confirmation form: then there is no token, and the listing is created only if the user confirms there). Show the user the preview and ask for confirmation. Step 2: only after the user explicitly approves it, call again with exactly the same fields and the confirmationToken. For the location, ask the user to paste a Google Maps link to the place (mapsUrl) and to confirm the street and number; never invent coordinates, links or addresses. If the link cannot be read, ask for another one or go on without it: the location can be set later in the editor. A field that fails validation is reported by name: re-ask only that field. Nothing is published: publishing is a separate step (set_listing_publication). ${UNTRUSTED_DATA_NOTICE}`,
        inputSchema: CreateListingInputSchema,
        isWrite: true,
        hints: { destructiveHint: false, idempotentHint: false, openWorldHint: true },
        confirmation: { elicitation: true },
        reasonMessages: CREATE_LISTING_REASON_MESSAGES,
        refusalAction: refusalActionFor,
        auditResultTarget: ({ data }) => {
            const created = CreatedAuditSchema.safeParse(data);
            return created.success
                ? { type: created.data.vertical, id: created.data.id }
                : undefined;
        },
        auditDetails: ({ input, context }) => ({
            step: input.confirmationToken === undefined ? 'preview' : 'commit',
            vertical: input.vertical,
            ...confirmationAuditDetails({
                tool: CREATE_LISTING_TOOL_NAME,
                confirmationToken: input.confirmationToken,
                context
            })
        }),
        handler: async ({
            actor,
            input,
            context
        }): Promise<ToolHandlerOutput<CreateListingResult>> => {
            // The token is bound to the OAuth client; without one there is nothing to bind.
            const { clientId } = context;
            if (clientId === undefined) {
                return {
                    error: {
                        code: ServiceErrorCode.UNAUTHORIZED,
                        message: 'create_listing needs an identified OAuth client'
                    }
                };
            }
            const destination = await findCreationDestination({ id: input.destinationId });
            if (!destination) {
                return fieldError('destinationId', 'no es una ciudad de Hospeda');
            }
            const binding: ElicitationBinding = {
                userId: actor.id,
                clientId,
                tool: CREATE_LISTING_TOOL_NAME,
                subjectId: input.vertical,
                payload: bindingPayloadOf({ input })
            };
            const plan = planConfirmation({
                tool: CREATE_LISTING_TOOL_NAME,
                confirmationToken: input.confirmationToken,
                context
            });
            if (plan.step === 'token_refused') {
                return confirmationTokenRefused();
            }
            if (plan.step === 'preview') {
                return preview({
                    actor,
                    input,
                    destinationName: destination.name,
                    binding,
                    deps,
                    mode: plan.mode
                });
            }

            const confirmed = await confirmCommit({ binding, plan });
            if (!confirmed.ok) {
                return confirmed.error;
            }
            const stash = PreviewStashSchema.safeParse(confirmed.stash);
            if (!stash.success) {
                return plan.mode === 'elicitation' ? elicitationStateInvalid() : tokenInvalid();
            }
            const body = buildCreateBody({ input, point: stash.data.point });
            const validated = validateCreateBody({ actor, vertical: input.vertical, body });
            if (!validated.ok) {
                return validated.error;
            }
            await authorizeOwnerCreate({ actor, vertical: input.vertical, body });
            const created = await writeOwnerCreate({ actor, create: validated.value });
            if (created.error) {
                return { error: created.error };
            }
            return {
                data: {
                    status: 'created',
                    id: created.data.id,
                    vertical: input.vertical,
                    publicationStatus: 'DRAFT',
                    editorUrl: listingPortalUrl({
                        kind: 'listingEditor',
                        vertical: input.vertical,
                        id: created.data.id
                    }),
                    nextSteps: nextStepsFor({
                        vertical: input.vertical,
                        id: created.data.id,
                        hasLocation: bodyHasLocation({ vertical: input.vertical, body })
                    })
                }
            };
        }
    });
}

/**
 * The commit's proof: the token (token flow) or the human's answer bound to
 * the state (elicitation flow). Either is consumed once, and burnt on any
 * mismatch; a decline is refused here and writes nothing.
 */
async function confirmCommit(args: {
    readonly binding: ElicitationBinding;
    readonly plan: Extract<
        ReturnType<typeof planConfirmation>,
        { readonly step: 'commit' | 'declined' }
    >;
}): Promise<
    | { readonly ok: true; readonly stash: unknown }
    | { readonly ok: false; readonly error: ToolHandlerResult<never> }
> {
    const { binding, plan } = args;
    if (plan.mode === 'elicitation') {
        const settled = await settleConfirmationAnswer({ binding, plan });
        if (settled.kind === 'unavailable') {
            return { ok: false, error: storeUnavailable() };
        }
        if (settled.kind === 'refused') {
            return { ok: false, error: { error: settled.error } };
        }
        return { ok: true, stash: settled.stash };
    }
    const consumed = await consumeConfirmationToken({ ...binding, token: plan.token });
    if (!consumed.ok) {
        return {
            ok: false,
            error: consumed.reason === 'UNAVAILABLE' ? storeUnavailable() : tokenInvalid()
        };
    }
    return { ok: true, stash: consumed.stash };
}

/**
 * The preview step: validates, dry-runs access, resolves the link, then either
 * issues the token (token flow) or binds a state and asks the client to confirm
 * (elicitation flow). Both keep the resolved point as the stash.
 */
async function preview(args: {
    readonly actor: Parameters<typeof authorizeOwnerCreate>[0]['actor'];
    readonly input: CreateListingInput;
    readonly destinationName: string;
    readonly binding: ElicitationBinding;
    readonly deps: CreateListingDeps;
    readonly mode: 'token' | 'elicitation';
}): Promise<ToolHandlerOutput<CreateListingPreview>> {
    const { actor, input, destinationName, binding, deps } = args;
    let point: MapsPoint | null = null;
    let addressHint: string | undefined;
    if (input.mapsUrl !== undefined) {
        const resolved = await resolveGoogleMapsLink({
            url: input.mapsUrl,
            ...(deps.fetchHop ? { fetchHop: deps.fetchHop } : {})
        });
        if (!resolved.ok) {
            return fieldError('mapsUrl', MAPS_LINK_FAILURE_MESSAGES[resolved.reason]);
        }
        point = resolved.point;
        addressHint = resolved.addressHint;
    }
    const body = buildCreateBody({ input, point });
    // Dry run of the commit's own revalidation (L-6): what would fail at
    // commit fails here, before any token exists.
    const validated = validateCreateBody({ actor, vertical: input.vertical, body });
    if (!validated.ok) {
        return validated.error;
    }
    // Dry run of the route's access step: refusals are thrown and mapped.
    await authorizeOwnerCreate({ actor, vertical: input.vertical, body });
    const [publishQuota, duplicate] = await Promise.all([
        readPublishQuotaNote({ actor, vertical: input.vertical }),
        hasDuplicateAddress({ actor, vertical: input.vertical, body })
    ]);
    const stash = { point: point ? { lat: point.lat, lng: point.lng } : null };
    const duplicateAddressWarning = duplicate
        ? 'Ya tenés otra publicación activa en esta misma dirección: el borrador se puede crear, pero no vas a poder publicarlo con la misma dirección.'
        : undefined;
    if (args.mode === 'elicitation') {
        const state = await issueConfirmationState({ binding, stash });
        if (!state.ok) {
            return storeUnavailable();
        }
        return needsConfirmation({
            message: createListingConfirmationMessage({
                vertical: input.vertical,
                listing: previewListing({ input, destinationName }),
                point: stash.point,
                ...(input.street === undefined ? {} : { street: input.street }),
                ...(input.number === undefined ? {} : { number: input.number }),
                ...(duplicateAddressWarning === undefined ? {} : { duplicateAddressWarning })
            }),
            stateId: state.stateId
        });
    }
    const issued = await issueConfirmationToken({ ...binding, stash });
    if (!issued.ok) {
        return storeUnavailable();
    }
    const hasLocation = point !== null || input.street !== undefined || input.number !== undefined;
    return {
        data: {
            status: 'confirmation_required',
            vertical: input.vertical,
            listing: previewListing({ input, destinationName }),
            location: hasLocation
                ? {
                      coordinates: point,
                      ...(point ? { mapCheckUrl: mapCheckUrl(point) } : {}),
                      ...(addressHint
                          ? {
                                addressHint: wrapUntrustedText({
                                    text: addressHint,
                                    source: 'maps_link'
                                })
                            }
                          : {}),
                      ...(input.street === undefined ? {} : { street: input.street }),
                      ...(input.number === undefined ? {} : { number: input.number }),
                      ...(duplicateAddressWarning === undefined ? {} : { duplicateAddressWarning })
                  }
                : null,
            publishQuota,
            confirmationToken: issued.token,
            expiresInSeconds: issued.expiresInSeconds,
            instructions: previewInstructions({ expiresInSeconds: issued.expiresInSeconds })
        }
    };
}

/** `create_listing`, as registered. */
export const createListingTool = buildCreateListingTool();
