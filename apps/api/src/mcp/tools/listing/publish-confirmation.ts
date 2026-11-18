/**
 * HOS-2247, owner decision D-19 — the confirmation step of publishing through
 * `set_listing_publication`.
 *
 * Publishing makes a listing public and fires `listing_published`, which can
 * start the trial, so a `resume` that would PUBLISH is two steps, like the other
 * token-confirmed writes: a preview that writes nothing, then a commit proven
 * by a single-use token (clients without the capability) or by the human's
 * answer to the client's own form (`elicitation-confirmation.ts`). `pause`, and
 * a `resume` that only reactivates an archived listing to draft or changes
 * nothing, stay one step: they are private and reversible (R-21).
 *
 * The proof is bound to `(user, client, 'set_listing_publication', listing id,
 * { vertical, id, action: 'resume', step: 'PUBLISH' })`.
 *
 * @module mcp/tools/listing/publish-confirmation
 */

import { PublicationStatusEnum, ServiceErrorCode } from '@repo/schemas';
import { z } from 'zod';
import { quoteForConfirmation } from '../confirmation-text';
import { consumeConfirmationToken, issueConfirmationToken } from '../confirmation-token-store';
import {
    type ConfirmationPlan,
    confirmationAuditDetails,
    ELICITATION_REASON_MESSAGES,
    type ElicitationBinding,
    issueConfirmationState,
    needsConfirmation,
    settleConfirmationAnswer
} from '../elicitation-confirmation';
import type {
    ToolAuditDetails,
    ToolContext,
    ToolHandlerOutput,
    ToolHandlerResult
} from '../tool-definition';
import { VERTICAL_LABELS } from './create-listing-preview';
import type { OwnListingRow } from './get-listing';
import { findCreationDestination, listingTypeLabel } from './listing-creation-catalog';
import type { ListingToolVertical } from './listing-services';

/** Tool name, also the binding's `tool`. */
export const SET_LISTING_PUBLICATION_TOOL_NAME = 'set_listing_publication';

/** Reason of the refusal of a token that cannot be used. */
export const PUBLISH_CONFIRMATION_INVALID_REASON = 'CONFIRMATION_INVALID';
/** Reason of the refusal answered when the confirmation store is down. */
export const PUBLISH_CONFIRMATION_UNAVAILABLE_REASON = 'CONFIRMATION_UNAVAILABLE';
/** Reason of the refusal of a confirmation on a call that does not publish. */
export const PUBLISH_CONFIRMATION_NOT_NEEDED_REASON = 'CONFIRMATION_NOT_NEEDED';

/** Spanish messages of every confirmation refusal the publish step can answer. */
export const PUBLISH_CONFIRMATION_REASON_MESSAGES: Readonly<Record<string, string>> = {
    ...ELICITATION_REASON_MESSAGES,
    [PUBLISH_CONFIRMATION_INVALID_REASON]:
        'La confirmación no es válida: venció, ya se usó o algún dato cambió. No se publicó nada. Volvé a llamar a set_listing_publication SIN confirmationToken para generar una nueva vista previa y pedile al usuario que la confirme.',
    [PUBLISH_CONFIRMATION_UNAVAILABLE_REASON]:
        'El servicio no está disponible en este momento, probá más tarde. No se publicó nada.',
    [PUBLISH_CONFIRMATION_NOT_NEEDED_REASON]:
        'Esta acción ya no publica la publicación (su estado cambió o no corresponde), así que la confirmación no aplica. No se hizo ningún cambio. Consultá el estado con get_listing y volvé a llamar SIN confirmationToken.'
};

/** What the publish preview answers (token flow). Nothing was published. */
export interface ListingPublicationPreview {
    /** Discriminator. */
    readonly status: 'confirmation_required';
    /** Listing id. */
    readonly id: string;
    /** Listing vertical. */
    readonly vertical: ListingToolVertical;
    /** Public name. */
    readonly name: string;
    /** Type label (`Cabaña`, `Bar`...), or `null` when unknown. */
    readonly typeLabel: string | null;
    /** City, or `null` when unknown. */
    readonly city: string | null;
    /** Always `resume`: only publishing is two steps. */
    readonly action: 'resume';
    /** State now. */
    readonly previousStatus: PublicationStatusEnum;
    /** State once confirmed. */
    readonly publicationStatusAfter: typeof PublicationStatusEnum.PUBLISHED;
    /** Single-use token for the second call. */
    readonly confirmationToken: string;
    /** Seconds the token stays valid. */
    readonly expiresInSeconds: number;
    /** What the model must do next. */
    readonly instructions: string;
}

/**
 * The binding of a publish confirmation.
 *
 * @param args - User, OAuth client and the listing
 * @returns The binding, identical at preview and commit for the same listing
 */
export function publishBinding(args: {
    readonly userId: string;
    readonly clientId: string;
    readonly vertical: ListingToolVertical;
    readonly id: string;
}): ElicitationBinding {
    return {
        userId: args.userId,
        clientId: args.clientId,
        tool: SET_LISTING_PUBLICATION_TOOL_NAME,
        subjectId: args.id,
        payload: { vertical: args.vertical, id: args.id, action: 'resume', step: 'PUBLISH' }
    };
}

/** What the publish form shows about the listing, beyond its name. */
export interface PublishListingFacts {
    /** Type label, or `null` when unknown. */
    readonly typeLabel: string | null;
    /** City, or `null` when unknown. */
    readonly city: string | null;
}

/**
 * The server facts the publish form shows (HOS-2247 L1): the type label and the
 * city of the listing, from the row the call already read. A missing or
 * unreadable fact is `null` (shown as unknown); it never blocks the preview.
 *
 * @param args - Vertical and the owned row
 * @returns The facts
 */
export async function readPublishListingFacts(args: {
    readonly vertical: ListingToolVertical;
    readonly row: OwnListingRow;
}): Promise<PublishListingFacts> {
    const { vertical, row } = args;
    const typeLabel =
        typeof row.type === 'string' ? listingTypeLabel({ vertical, type: row.type }) : null;
    let city: string | null = null;
    if (typeof row.destinationId === 'string') {
        try {
            city = (await findCreationDestination({ id: row.destinationId }))?.name ?? null;
        } catch {
            city = null;
        }
    }
    return { typeLabel, city };
}

/**
 * The text the client's confirmation form shows the human: the server facts
 * (vertical, type, city) first, then the owner-written name, quoted.
 *
 * @param args - Vertical, the listing's public name and its facts
 * @returns The Spanish form message
 */
export function publishConfirmationMessage({
    vertical,
    name,
    typeLabel,
    city
}: {
    readonly vertical: ListingToolVertical;
    readonly name: string;
} & PublishListingFacts): string {
    const unknown = 'sin dato';
    return [
        'Vas a publicar en Hospeda:',
        `Categoría: ${VERTICAL_LABELS[vertical]}`,
        `Tipo: ${typeLabel === null ? unknown : quoteForConfirmation({ text: typeLabel })}`,
        `Ciudad: ${city === null ? unknown : quoteForConfirmation({ text: city })}`,
        `Nombre: ${quoteForConfirmation({ text: name, maxLength: 100 })}`,
        'Va a quedar visible para cualquiera en el sitio público.',
        'Si todavía no usaste la prueba gratuita de esta categoría, publicar la inicia.',
        '¿Confirmás la publicación?'
    ].join('\n');
}

/** The preview's instruction to the model. */
function previewInstructions({ expiresInSeconds }: { readonly expiresInSeconds: number }): string {
    const minutes = Math.round(expiresInSeconds / 60);
    return `Todavía NO se publicó nada. Decile al usuario que la publicación "name" va a quedar visible en el sitio público de Hospeda (y que, si no usó la prueba gratuita de esta categoría, publicar la inicia) y preguntale si lo confirma. Solo si responde que sí de forma explícita, volvé a llamar a set_listing_publication con el mismo vertical, el mismo id, action "resume" y este confirmationToken. El token es de un solo uso y vence en ${minutes} minutos.`;
}

/** The refusal answered when the confirmation store is down. Nothing was written. */
function storeUnavailable(): ToolHandlerResult<never> {
    return {
        error: {
            code: ServiceErrorCode.SERVICE_UNAVAILABLE,
            message: 'Confirmation store unavailable',
            reason: PUBLISH_CONFIRMATION_UNAVAILABLE_REASON
        }
    };
}

/** The refusal of a token that cannot be used. Nothing was written. */
function tokenInvalid(): ToolHandlerResult<never> {
    return {
        error: {
            code: ServiceErrorCode.VALIDATION_ERROR,
            message: 'Confirmation token missing, expired, used or mismatched',
            reason: PUBLISH_CONFIRMATION_INVALID_REASON
        }
    };
}

/**
 * The publish preview, once the dry run of the publish access step passed:
 * a token (token flow) or a bound state plus the client's form (elicitation
 * flow). Writes nothing but the confirmation record.
 *
 * @param args - Binding, flow, and the listing as read before the call
 * @returns The preview, the confirmation request, or a store refusal
 */
export async function issuePublishPreview(args: {
    readonly binding: ElicitationBinding;
    readonly mode: ConfirmationPlan['mode'];
    readonly listing: {
        readonly id: string;
        readonly vertical: ListingToolVertical;
        readonly name: string;
        readonly previousStatus: PublicationStatusEnum;
    } & PublishListingFacts;
}): Promise<ToolHandlerOutput<ListingPublicationPreview>> {
    const { binding, mode, listing } = args;
    if (mode === 'elicitation') {
        const state = await issueConfirmationState({ binding });
        if (!state.ok) {
            return storeUnavailable();
        }
        return needsConfirmation({
            message: publishConfirmationMessage(listing),
            stateId: state.stateId
        });
    }
    const issued = await issueConfirmationToken(binding);
    if (!issued.ok) {
        return storeUnavailable();
    }
    return {
        data: {
            status: 'confirmation_required',
            id: listing.id,
            vertical: listing.vertical,
            name: listing.name,
            typeLabel: listing.typeLabel,
            city: listing.city,
            action: 'resume',
            previousStatus: listing.previousStatus,
            publicationStatusAfter: PublicationStatusEnum.PUBLISHED,
            confirmationToken: issued.token,
            expiresInSeconds: issued.expiresInSeconds,
            instructions: previewInstructions({ expiresInSeconds: issued.expiresInSeconds })
        }
    };
}

/**
 * Checks the commit's proof, consuming it once (burnt on any mismatch). A
 * decline or cancel is refused here, before anything is written.
 *
 * @param args - Binding and the commit plan (token or elicitation)
 * @returns `undefined` when the publish may proceed, otherwise the refusal
 */
export async function confirmPublishCommit(args: {
    readonly binding: ElicitationBinding;
    readonly plan: Extract<ConfirmationPlan, { readonly step: 'commit' | 'declined' }>;
}): Promise<ToolHandlerResult<never> | undefined> {
    const { binding, plan } = args;
    if (plan.mode === 'elicitation') {
        const settled = await settleConfirmationAnswer({ binding, plan });
        if (settled.kind === 'unavailable') {
            return storeUnavailable();
        }
        return settled.kind === 'refused' ? { error: settled.error } : undefined;
    }
    const consumed = await consumeConfirmationToken({ ...binding, token: plan.token });
    if (!consumed.ok) {
        return consumed.reason === 'UNAVAILABLE' ? storeUnavailable() : tokenInvalid();
    }
    return undefined;
}

/**
 * Refuses a confirmation carried by a call that does not publish (the listing
 * changed state since the preview, or the call pauses), burning the token or
 * state it carried so it can never authorize a later publish.
 *
 * @param args - The publish binding, the call's token and context
 * @returns The refusal; nothing was written
 */
export async function refuseUnneededConfirmation(args: {
    readonly binding: ElicitationBinding;
    readonly confirmationToken: string | undefined;
    readonly context: ToolContext;
}): Promise<ToolHandlerResult<never>> {
    const { binding, confirmationToken, context } = args;
    if (confirmationToken !== undefined) {
        await consumeConfirmationToken({ ...binding, token: confirmationToken });
    }
    const answer = context.confirmation?.answer;
    if (answer !== undefined) {
        await settleConfirmationAnswer({
            binding,
            plan: { mode: 'elicitation', step: 'commit', stateId: answer.stateId }
        });
    }
    return {
        error: {
            code: ServiceErrorCode.VALIDATION_ERROR,
            message: 'Confirmation sent for a call that does not publish',
            reason: PUBLISH_CONFIRMATION_NOT_NEEDED_REASON
        }
    };
}

/** A token preview result. */
const PreviewDataSchema = z.looseObject({ status: z.literal('confirmation_required') });
/** A one-step or committed result. */
const AppliedDataSchema = z.looseObject({ changed: z.boolean() });

/**
 * The audit facts of a `set_listing_publication` call (C-3): the action and, per
 * step, `apply` (one step: pause, reactivate, no change), `preview`, `commit` or
 * `declined`, plus `confirmation` on calls from a capable client.
 *
 * @param args - The validated input, the call's context and its success data
 * @returns The facts
 */
export function publicationAuditDetails(args: {
    readonly input: {
        readonly action: 'pause' | 'resume';
        readonly confirmationToken?: string;
    };
    readonly context: ToolContext | undefined;
    readonly data: unknown;
}): ToolAuditDetails {
    const { input, context, data } = args;
    if (input.action === 'pause') {
        return { action: 'pause', step: 'apply' };
    }
    const hasProof =
        input.confirmationToken !== undefined || context?.confirmation?.answer !== undefined;
    if (!hasProof && AppliedDataSchema.safeParse(data).success) {
        return { action: 'resume', step: 'apply' };
    }
    const confirmation = confirmationAuditDetails({
        tool: SET_LISTING_PUBLICATION_TOOL_NAME,
        confirmationToken: input.confirmationToken,
        context
    });
    if (confirmation !== undefined) {
        return { action: 'resume', ...confirmation };
    }
    if (PreviewDataSchema.safeParse(data).success) {
        return { action: 'resume', step: 'preview' };
    }
    return input.confirmationToken === undefined
        ? { action: 'resume' }
        : { action: 'resume', step: 'commit' };
}
