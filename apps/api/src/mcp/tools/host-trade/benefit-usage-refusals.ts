/**
 * @file benefit-usage-refusals.ts
 * @description What a refused benefit-usage tool call says, and where it points
 * (HOS-2332, spec HOS-2335 §5.1 and §6.7).
 *
 * A usage that is missing, someone else's or the caller's own declaration all
 * end at the usages page itself, never at one usage: a link around the asked id
 * would confirm that it exists. The portal page is the host's usages list; a
 * provider reaches their own from the provider panel, which the list tool links.
 */

import { ServiceErrorCode } from '@repo/schemas';
import { entityNotFoundError } from '@repo/service-core';
import type { ToolErrorPayload, ToolHandlerResult, ToolRefusalLink } from '../tool-definition';

/** Reason of the refusal for a usage that is no longer PENDING. */
export const BENEFIT_USAGE_NOT_PENDING_REASON = 'USAGE_NOT_PENDING';
/** Reason of the refusal for a token that cannot be used. */
export const BENEFIT_USAGE_CONFIRMATION_INVALID_REASON = 'CONFIRMATION_INVALID';
/** Reason of the refusal when the token store is down. */
export const BENEFIT_USAGE_CONFIRMATION_UNAVAILABLE_REASON = 'CONFIRMATION_UNAVAILABLE';

/** Spanish messages for the reasons the usage tools can answer with. */
export const BENEFIT_USAGE_REASON_MESSAGES: Readonly<Record<string, string>> = {
    [BENEFIT_USAGE_NOT_PENDING_REASON]:
        'Ese uso ya no está pendiente (ya se confirmó, se rechazó o venció), así que no se puede responder. No se cambió nada.',
    [BENEFIT_USAGE_CONFIRMATION_INVALID_REASON]:
        'La confirmación no es válida: venció, ya se usó o la nota cambió. No se cambió nada. Volvé a llamar SIN confirmationToken para generar una nueva vista previa y pedile al usuario que la confirme.',
    [BENEFIT_USAGE_CONFIRMATION_UNAVAILABLE_REASON]:
        'El servicio no está disponible en este momento, probá más tarde. No se cambió nada.'
};

/**
 * The link of a benefit-usage tool refusal.
 *
 * @param args - The refusal
 * @returns The usages page for a not-found or a no-longer-pending usage, otherwise none
 */
export function benefitUsageRefusalLink({
    error
}: {
    readonly error: ToolErrorPayload;
}): ToolRefusalLink | undefined {
    if (error.code === ServiceErrorCode.NOT_FOUND) {
        return { destination: { kind: 'benefitUsages' } };
    }
    if (error.reason === BENEFIT_USAGE_NOT_PENDING_REASON) {
        return { destination: { kind: 'benefitUsages' } };
    }
    return undefined;
}

/**
 * The uniform not-found of the usage tools: a foreign usage, the caller's own
 * declaration and a missing id look exactly the same (AC-C36).
 *
 * @returns The not-found error result
 */
export function benefitUsageNotFound(): ToolHandlerResult<never> {
    const error = entityNotFoundError({ entityName: 'hostTradeBenefitUsage' });
    return { error: { code: error.code, message: error.message } };
}

/**
 * Maps a usage-service refusal. NOT_FOUND and FORBIDDEN both collapse to
 * {@link benefitUsageNotFound}, so a usage tool can never answer FORBIDDEN
 * (which would confirm the id exists).
 *
 * @param result - A service output
 * @returns The mapped error result, or `undefined` when the service succeeded
 */
export function fromUsageService(result: {
    readonly error?: ToolErrorPayload;
}): ToolHandlerResult<never> | undefined {
    if (!result.error) {
        return undefined;
    }
    return result.error.code === ServiceErrorCode.NOT_FOUND ||
        result.error.code === ServiceErrorCode.FORBIDDEN
        ? benefitUsageNotFound()
        : { error: result.error };
}
