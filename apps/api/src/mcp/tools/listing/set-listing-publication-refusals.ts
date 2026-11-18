/**
 * HOS-2184 T-018 — how `set_listing_publication` names and explains the
 * refusals of the publication routes. Split out of `set-listing-publication.ts`
 * to keep it under the file-size limit when publishing became two steps
 * (HOS-2247).
 *
 * @module mcp/tools/listing/set-listing-publication-refusals
 */

import {
    DUPLICATE_LOCATION_REASON,
    NO_PLANS_AVAILABLE_MESSAGE,
    PUBLISH_REQUIREMENTS_MISSING_REASON_PREFIX,
    ServiceErrorCode
} from '@repo/schemas';
import { FIRST_PUBLISH_PAUSED_REASON, type ServiceError } from '@repo/service-core';
import type { ToolErrorPayload, ToolHandlerResult } from '../tool-definition';
import {
    LISTING_INCOMPLETE_MESSAGE_PREFIX,
    LISTING_INCOMPLETE_REASON,
    LISTING_MODERATED_REASON,
    missingRequirementsOf
} from './publication-refusal-link';
import { PUBLISH_CONFIRMATION_REASON_MESSAGES } from './publish-confirmation';

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
export function toRefusal(error: ServiceError): ToolHandlerResult<never> {
    const reason = publicationRefusalReason(error) ?? error.reason;
    const details =
        reason === LISTING_INCOMPLETE_REASON
            ? { missing: missingRequirementsOf({ reason: error.reason, message: error.message }) }
            : error.details;
    const payload: ToolErrorPayload = {
        code: error.code,
        message: error.message,
        details,
        ...(reason === undefined ? {} : { reason })
    };
    return { error: payload };
}

/** Spanish messages for every refusal the publication path can return. */
export const SET_LISTING_PUBLICATION_REASON_MESSAGES: Readonly<Record<string, string>> = {
    ...PUBLISH_CONFIRMATION_REASON_MESSAGES,
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
