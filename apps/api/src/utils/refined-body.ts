/**
 * Second-line validation for request bodies whose schema carries a refinement.
 *
 * ## Why this existed — and what changed (HOS-425)
 *
 * `createCRUDRoute` rebuilds the declared `requestBody` through
 * `createOpenAPISchema()` so the schema can be rendered as OpenAPI, and that
 * rebuild USED TO DROP `.refine()` / `.superRefine()` checks. The factory tried
 * to skip the rebuild for refined schemas by testing
 * `_def.typeName === 'ZodEffects'` — a Zod 3 marker that is never true under
 * Zod 4 (measured: 0 of 12 refined schemas matched). Whether a cross-field rule
 * survived therefore depended on the unrelated second escape hatch,
 * `hasHttpCoercionFields()`: a schema with any `z.coerce.*` field passes
 * through whole (H-54).
 *
 * That root cause is FIXED. `createOpenAPISchema` now carries a schema's
 * object-level checks across the rebuild, so a declared refinement reaches the
 * request on every tier — see
 * `test/static-guards/refined-request-body-reaches-the-request.guard.test.ts`.
 *
 * ## Who still re-parses a body, and why
 *
 * FOUR routes carried a second-line parse, not two — and only two of them used
 * this helper, which is why grepping for `parseRefinedBody` undercounted them.
 * None of the survivors keeps its parse because the rule would otherwise go
 * unenforced:
 *
 * - `billing/admin/plans.ts` — uses this helper. Left untouched because the
 *   area is being rewritten by an epic in flight (HOS-1352 / HOS-1354), so it
 *   got the transversal factory fix and nothing else.
 * - `ai/social/drafts.ts` — used this helper; the call is GONE. Its stated
 *   reason was ordering ("after the PIN check, so validation messages cannot
 *   probe the schema"), and the PIN check has moved to a route middleware,
 *   which is the only place that can actually hold that order.
 * - `host-trade/admin/usages.ts` — a hand-rolled `safeParse`, kept because it
 *   is what narrows the body to the typed shape the handler reads.
 * - `commerce/protected/create.ts` — a hand-rolled `safeParse`, kept because
 *   it re-applies admin defaults after stamping owner/visibility fields.
 *
 * A fifth, `host-trade/protected/mine-usages.ts`, was removed with its cause.
 *
 * New routes do not need this helper: declare the refined schema as the
 * `requestBody` and the boundary enforces it.
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
