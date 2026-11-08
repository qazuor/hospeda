/**
 * listing-policies-write.ts
 *
 * Server-side write rules for the `policies` jsonb of the three listing
 * verticals (HOS-2060). One pure place, called from the create and update
 * hooks of `AccommodationService` and `BaseListingService`:
 *
 * 1. **Create default.** A new listing always stores at least
 *    `paymentMethods: ['cash']` ({@link DEFAULT_LISTING_POLICIES}); a body that
 *    declares its own `paymentMethods` replaces the default.
 * 2. **Shallow merge on update.** A body that sends `policies` sends a PATCH of
 *    it: a key it omits keeps its stored value, a key set to `null` is removed,
 *    and `policies: null` clears the whole object
 *    ({@link mergeListingPolicies}). Without this, editing one rule from one
 *    form would silently erase the rules another form owns.
 * 3. **Re-validation after the merge.** The merged object is parsed again with
 *    the vertical's schema, because two individually valid halves can combine
 *    into an invalid whole (a new `minNights` above a stored `maxNights`). An
 *    invalid result is a 400 `VALIDATION_ERROR`, never a persisted row.
 *
 * Read-only over its inputs: no I/O, no clock.
 */

import {
    AccommodationPoliciesSchema,
    DEFAULT_LISTING_POLICIES,
    ExperiencePoliciesSchema,
    mergeListingPolicies,
    ServiceErrorCode,
    VenuePoliciesSchema
} from '@repo/schemas';
import type { z } from 'zod';
import { ServiceError } from '../../types';

/** The verticals that carry a `policies` column. */
export type PoliciesVertical = 'accommodation' | 'venue' | 'experience';

/** The policies schema of each vertical. */
const POLICIES_SCHEMA: Readonly<Record<PoliciesVertical, z.ZodType>> = {
    accommodation: AccommodationPoliciesSchema,
    venue: VenuePoliciesSchema,
    experience: ExperiencePoliciesSchema
};

/**
 * Whether `value` names a vertical that carries `policies`. The listing base
 * class also serves test doubles with other entity names, which store none.
 *
 * @param value - An entity name.
 * @returns True for `accommodation`, `venue` and `experience`.
 */
export function isPoliciesVertical(value: string): value is PoliciesVertical {
    return Object.hasOwn(POLICIES_SCHEMA, value);
}

/** Parses `value` with the vertical schema, or throws a 400. */
function validatePolicies({
    vertical,
    value
}: {
    readonly vertical: PoliciesVertical;
    readonly value: Record<string, unknown>;
}): Record<string, unknown> {
    const parsed = POLICIES_SCHEMA[vertical].safeParse(value);
    if (!parsed.success) {
        throw new ServiceError(ServiceErrorCode.VALIDATION_ERROR, 'Invalid policies', {
            field: 'policies',
            issues: parsed.error.issues.map((issue) => ({
                path: ['policies', ...issue.path.map(String)].join('.'),
                message: issue.message
            }))
        });
    }
    return parsed.data as Record<string, unknown>;
}

/**
 * Resolves the `policies` value a CREATE persists.
 *
 * @param args.vertical - The listing vertical.
 * @param args.payload - The validated create body.
 * @returns `{ policies }`, the default merged under whatever the body sent.
 * @throws {ServiceError} `VALIDATION_ERROR` when the result is invalid.
 */
export function resolveCreatePolicies({
    vertical,
    payload
}: {
    readonly vertical: PoliciesVertical;
    readonly payload: Readonly<Record<string, unknown>>;
}): { readonly policies: Record<string, unknown> } {
    const sent = payload.policies as Record<string, unknown> | null | undefined;
    const { policies } = mergeListingPolicies<Record<string, unknown>>({
        stored: { ...DEFAULT_LISTING_POLICIES },
        patch: sent ?? {}
    });
    return { policies: validatePolicies({ vertical, value: policies ?? {} }) };
}

/**
 * Resolves the `policies` value an UPDATE persists.
 *
 * @param args.vertical - The listing vertical.
 * @param args.payload - The validated update body.
 * @param args.current - The stored `policies` (null for an empty column).
 * @returns `{}` when the body does not mention `policies` (nothing to write),
 *   otherwise `{ policies }` with the merged, re-validated value (`null` when
 *   the body cleared it, or every key was removed).
 * @throws {ServiceError} `VALIDATION_ERROR` when the merged result is invalid.
 */
export function resolveUpdatePolicies({
    vertical,
    payload,
    current
}: {
    readonly vertical: PoliciesVertical;
    readonly payload: Readonly<Record<string, unknown>>;
    readonly current: Readonly<Record<string, unknown>> | null | undefined;
}): { readonly policies?: Record<string, unknown> | null } {
    if (!Object.hasOwn(payload, 'policies') || payload.policies === undefined) return {};
    const { policies } = mergeListingPolicies<Record<string, unknown>>({
        stored: current ? { ...current } : null,
        patch: payload.policies as Record<string, unknown> | null
    });
    if (!policies || Object.keys(policies).length === 0) return { policies: null };
    return { policies: validatePolicies({ vertical, value: policies }) };
}
