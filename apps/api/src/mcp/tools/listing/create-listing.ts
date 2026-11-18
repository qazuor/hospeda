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
 */

import { ServiceErrorCode, VerticalEnum } from '@repo/schemas';
import { z } from 'zod';
import { env } from '../../../utils/env';
import { buildPortalUrl } from '../../portal/build-portal-url';
import type { PortalDestination, PortalSectionId } from '../../portal/portal-routes';
import { consumeConfirmationToken, issueConfirmationToken } from '../confirmation-token-store';
import { defineTool, type ToolHandlerResult, type ToolRefusalLink } from '../tool-definition';
import { UNTRUSTED_DATA_NOTICE, wrapUntrustedText } from '../untrusted-data';
import {
    bindingPayloadOf,
    type CreateListingInput,
    CreateListingInputSchema
} from './create-listing-input';
import {
    authorizeOwnerCreate,
    bodyHasLocation,
    buildCreateBody,
    hasDuplicateAddress,
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
    listingTypeLabel,
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

/** Editor sections the next steps link to, per vertical. */
const NEXT_STEP_SECTIONS: Readonly<
    Record<
        ListingToolVertical,
        {
            readonly location: PortalSectionId;
            readonly media: PortalSectionId;
            readonly amenities: PortalSectionId;
        }
    >
> = {
    [VerticalEnum.ACCOMMODATION]: { location: 'location', media: 'photos', amenities: 'amenities' },
    [VerticalEnum.VENUE]: { location: 'location', media: 'media', amenities: 'amenities' },
    [VerticalEnum.EXPERIENCE]: { location: 'meetingPoint', media: 'media', amenities: 'amenities' }
};

/** One thing left to do after the draft exists. */
export interface CreateListingNextStep {
    readonly step: 'amenities' | 'photos' | 'location' | 'publish';
    readonly label: string;
    readonly url: string;
    readonly tool?: string;
}

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

/** Builds a portal URL from the configured site URL. */
function portalUrl(destination: PortalDestination): string {
    return buildPortalUrl({ destination, siteUrl: env.HOSPEDA_SITE_URL });
}

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

/** The steps left once the draft exists (§6.4, AC-C23c). */
function nextStepsFor(args: {
    readonly vertical: ListingToolVertical;
    readonly id: string;
    readonly hasLocation: boolean;
}): readonly CreateListingNextStep[] {
    const { vertical, id, hasLocation } = args;
    const sections = NEXT_STEP_SECTIONS[vertical];
    const editor = (section?: PortalSectionId) =>
        portalUrl({
            kind: 'listingEditor',
            vertical,
            id,
            ...(section === undefined ? {} : { section })
        });
    return [
        {
            step: 'amenities',
            label: 'Cargar servicios y comodidades',
            url: editor(sections.amenities),
            tool: 'update_listing_amenities'
        },
        { step: 'photos', label: 'Subir fotos', url: editor(sections.media) },
        ...(hasLocation
            ? []
            : [
                  {
                      step: 'location' as const,
                      label: 'Marcar la ubicación en el mapa',
                      url: editor(sections.location)
                  }
              ]),
        {
            step: 'publish',
            label: 'Publicar cuando esté lista',
            url: editor(),
            tool: 'set_listing_publication'
        }
    ];
}

/** Builds the preview's instruction to the model. */
function previewInstructions({ expiresInSeconds }: { readonly expiresInSeconds: number }): string {
    const minutes = Math.round(expiresInSeconds / 60);
    return `Todavía NO se creó nada. Mostrale al usuario los datos de "listing" y de "location" (si hay coordenadas, pasale "mapCheckUrl" para que verifique el punto) y preguntale si lo confirma. Solo si responde que sí de forma explícita, volvé a llamar a create_listing con EXACTAMENTE los mismos datos y este confirmationToken. Si quiere cambiar algo, empezá de nuevo sin confirmationToken. El token es de un solo uso y vence en ${minutes} minutos. Se crea como borrador: no se publica.`;
}

/** The listing as the user will see it in the preview. */
function previewListing(args: {
    readonly input: CreateListingInput;
    readonly destinationName: string;
}): Readonly<Record<string, unknown>> {
    const { input, destinationName } = args;
    const {
        vertical,
        mapsUrl: _maps,
        street: _street,
        number: _number,
        confirmationToken: _t,
        ...rest
    } = input;
    return {
        ...Object.fromEntries(Object.entries(rest).filter(([, value]) => value !== undefined)),
        typeLabel: listingTypeLabel({ vertical, type: input.type }),
        destinationName
    };
}

/** Where a refusal of this tool should point. */
function refusalActionFor(args: {
    readonly error: { readonly code: string; readonly reason?: string };
    readonly input: unknown;
}): ToolRefusalLink | undefined {
    const parsed = z.looseObject({ vertical: z.enum(VerticalEnum) }).safeParse(args.input);
    const vertical = parsed.success ? parsed.data.vertical : undefined;
    if (
        vertical !== VerticalEnum.ACCOMMODATION &&
        vertical !== VerticalEnum.VENUE &&
        vertical !== VerticalEnum.EXPERIENCE
    ) {
        return undefined;
    }
    switch (args.error.code) {
        case ServiceErrorCode.ENTITLEMENT_REQUIRED:
            return { destination: { kind: 'plans', vertical } };
        case ServiceErrorCode.LIMIT_REACHED:
            return { destination: { kind: 'subscription' } };
        case ServiceErrorCode.FORBIDDEN:
        case ServiceErrorCode.ALREADY_EXISTS:
            return { destination: { kind: 'createListing', vertical } };
        default:
            return undefined;
    }
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
        description: `Creates a DRAFT listing (accommodation, venue or experience) for the connected Hospeda user, in two steps. First call get_listing_creation_guide and collect the fields step by step with the user, in their own words. Step 1: call without confirmationToken. Nothing is created; you get a preview and a confirmationToken. Show the user the preview and ask for confirmation. Step 2: only after the user explicitly approves it, call again with exactly the same fields and the confirmationToken. For the location, ask the user to paste a Google Maps link to the place (mapsUrl) and to confirm the street and number; never invent coordinates, links or addresses. If the link cannot be read, ask for another one or go on without it: the location can be set later in the editor. A field that fails validation is reported by name: re-ask only that field. Nothing is published: publishing is a separate step (set_listing_publication). ${UNTRUSTED_DATA_NOTICE}`,
        inputSchema: CreateListingInputSchema,
        isWrite: true,
        hints: { destructiveHint: false, idempotentHint: false, openWorldHint: true },
        reasonMessages: CREATE_LISTING_REASON_MESSAGES,
        refusalAction: refusalActionFor,
        auditResultTarget: ({ data }) => {
            const created = CreatedAuditSchema.safeParse(data);
            return created.success
                ? { type: created.data.vertical, id: created.data.id }
                : undefined;
        },
        auditDetails: ({ input }) => ({
            step: input.confirmationToken === undefined ? 'preview' : 'commit',
            vertical: input.vertical
        }),
        handler: async ({
            actor,
            input,
            context
        }): Promise<ToolHandlerResult<CreateListingResult>> => {
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
                return fieldError('destinationId', 'no es un destino de Hospeda');
            }
            const binding = {
                userId: actor.id,
                clientId,
                tool: CREATE_LISTING_TOOL_NAME,
                subjectId: input.vertical,
                payload: bindingPayloadOf({ input })
            };

            if (input.confirmationToken === undefined) {
                return preview({ actor, input, destinationName: destination.name, binding, deps });
            }

            const consumed = await consumeConfirmationToken({
                ...binding,
                token: input.confirmationToken
            });
            if (!consumed.ok) {
                return consumed.reason === 'UNAVAILABLE' ? storeUnavailable() : tokenInvalid();
            }
            const stash = PreviewStashSchema.safeParse(consumed.stash);
            if (!stash.success) {
                return tokenInvalid();
            }
            const body = buildCreateBody({ input, point: stash.data.point });
            await authorizeOwnerCreate({ actor, vertical: input.vertical, body });
            const created = await writeOwnerCreate({ actor, vertical: input.vertical, body });
            if (created.error) {
                return { error: created.error };
            }
            return {
                data: {
                    status: 'created',
                    id: created.data.id,
                    vertical: input.vertical,
                    publicationStatus: 'DRAFT',
                    editorUrl: portalUrl({
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

/** The preview step: validates, dry-runs access, resolves the link, issues the token. */
async function preview(args: {
    readonly actor: Parameters<typeof authorizeOwnerCreate>[0]['actor'];
    readonly input: CreateListingInput;
    readonly destinationName: string;
    readonly binding: Omit<Parameters<typeof issueConfirmationToken>[0], 'stash'>;
    readonly deps: CreateListingDeps;
}): Promise<ToolHandlerResult<CreateListingPreview>> {
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
    // Dry run of the route's access step: refusals are thrown and mapped.
    await authorizeOwnerCreate({ actor, vertical: input.vertical, body });
    const [publishQuota, duplicate] = await Promise.all([
        readPublishQuotaNote({ actor, vertical: input.vertical }),
        hasDuplicateAddress({ actor, vertical: input.vertical, body })
    ]);
    const issued = await issueConfirmationToken({
        ...binding,
        stash: { point: point ? { lat: point.lat, lng: point.lng } : null }
    });
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
                      ...(duplicate
                          ? {
                                duplicateAddressWarning:
                                    'Ya tenés otra publicación activa en esta misma dirección: el borrador se puede crear, pero no vas a poder publicarlo con la misma dirección.'
                            }
                          : {})
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
