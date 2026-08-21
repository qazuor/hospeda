/**
 * Second-line validation for request bodies whose schema carries a refinement.
 *
 * ## Why this exists
 *
 * `createCRUDRoute` rebuilds the declared `requestBody` through
 * `createOpenAPISchema()` so the schema can be rendered as OpenAPI, and that
 * rebuild DROPS `.refine()` / `.superRefine()` checks. The factory tries to
 * skip the rebuild for refined schemas by testing
 * `_def.typeName === 'ZodEffects'` — a Zod 3 marker that is never true under
 * Zod 4 (measured: 0 of 12 refined schemas match). What actually preserves a
 * schema is the second escape hatch, `hasHttpCoercionFields()`: a schema with
 * any `z.coerce.*` field passes through whole. So whether a cross-field rule
 * survives depends on whether the schema happens to coerce something — not on
 * the rule itself (H-54).
 *
 * Of the 10 schemas the factory discards, 8 already re-apply their rule
 * downstream (their service re-parses with the same schema). This helper is the
 * same defence for the two that did not.
 *
 * ## Why not fix the factory instead
 *
 * Because the repo's Schema Compatibility Policy forbids hardening an existing
 * schema, and repairing the factory would do exactly that to two live routes at
 * once. Applying the rule where the route already runs keeps the fix behind the
 * same contract those endpoints have today. The dead `ZodEffects` guard stays
 * in the factory, harmless, until it is removed on its own terms.
 *
 * ## Same rejection, same shape (HOS-607)
 *
 * A plain `ServiceError(VALIDATION_ERROR, rawMessage)` would have been
 * formatted by `handleRouteError` as a flat `{code, message}` body carrying
 * the raw, untranslated `zodError.*` key as `message` — a different, poorer
 * shape than the `{details, summary, userFriendlyMessage}` body the SAME route
 * already returns when an ordinary field-level rule (one the OpenAPI request
 * validator still sees) rejects the body. {@link RefinedBodyValidationError}
 * carries the full `transformZodError` output instead, so `handleRouteError`
 * (and, for parity, `createErrorHandler`) can render the identical rich shape
 * regardless of which of the two validation passes rejected the request.
 *
 * @module utils/refined-body
 */

import { ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '@repo/service-core/types';
import type { ZodTypeAny, z } from 'zod';
import { transformZodError, type ValidationErrorResponse } from './zod-error-transformer';

/**
 * Thrown by {@link parseRefinedBody} when the schema's cross-field refinement
 * rejects the body. Extends `ServiceError` (still `code === VALIDATION_ERROR`,
 * still caught by every existing `instanceof ServiceError` check) but carries
 * the full {@link ValidationErrorResponse} produced by `transformZodError` so
 * callers that know about it can render the same rich shape as an ordinary
 * field-level rejection — see "Same rejection, same shape" above.
 */
export class RefinedBodyValidationError extends ServiceError {
    constructor(public readonly validation: ValidationErrorResponse) {
        super(ServiceErrorCode.VALIDATION_ERROR, validation.userFriendlyMessage);
        this.name = 'RefinedBodyValidationError';
    }
}

/**
 * Re-parses a request body with its full schema, refinements included.
 *
 * @param params.schema - The schema as declared on the route, refinement intact
 * @param params.body - The body the route factory handed to the handler
 * @returns The parsed body
 * @throws {@link RefinedBodyValidationError} when the schema rejects it — a
 *   `ServiceError(VALIDATION_ERROR)` subtype mapped to HTTP 400 by both error
 *   formatters, rendered in the rich `{details, summary, userFriendlyMessage}`
 *   shape (HOS-607)
 *
 * @example
 * const input = parseRefinedBody({ schema: CreateBillingPlanSchema, body });
 */
export const parseRefinedBody = <TSchema extends ZodTypeAny>({
    schema,
    body
}: {
    readonly schema: TSchema;
    readonly body: unknown;
}): z.infer<TSchema> => {
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
        throw new RefinedBodyValidationError(transformZodError(parsed.error));
    }

    return parsed.data as z.infer<TSchema>;
};
