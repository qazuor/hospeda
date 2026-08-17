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
 * @module utils/refined-body
 */

import { ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '@repo/service-core/types';
import type { ZodTypeAny, z } from 'zod';

/**
 * Re-parses a request body with its full schema, refinements included.
 *
 * @param params.schema - The schema as declared on the route, refinement intact
 * @param params.body - The body the route factory handed to the handler
 * @returns The parsed body
 * @throws `ServiceError(VALIDATION_ERROR)` when the schema rejects it — mapped
 *   to HTTP 400 by both error formatters
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
        const first = parsed.error.issues[0];
        const path = first?.path.join('.') ?? '<root>';
        throw new ServiceError(
            ServiceErrorCode.VALIDATION_ERROR,
            first?.message ?? `Invalid request body at ${path}`
        );
    }

    return parsed.data as z.infer<TSchema>;
};
