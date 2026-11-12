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
 * 3. **Cross-key rules after the merge** ({@link POST_MERGE_RULES}). A venue
 *    never keeps a minimum-age scope without a minimum age (HOS-2098):
 *    clearing the age clears the scope, and a body that SETS a scope while the
 *    merged result has no age is a 400. An accommodation never keeps event
 *    details unless events are allowed (HOS-2122), by the same rule.
 * 4. **Re-validation after the merge.** The merged object is parsed again with
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

/** A cross-key rule over the merged policies; may drop keys or throw a 400. */
type PostMergeRule = (args: {
    readonly merged: Record<string, unknown>;
    readonly patch: Readonly<Record<string, unknown>> | null;
}) => Record<string, unknown>;

/**
 * HOS-2098: a minimum-age scope means nothing without a minimum age.
 *
 * With no age in the merged result, a scope the body SENT is rejected (400 on
 * `policies.minAgeScope`) and a stored scope is dropped — so clearing the age
 * clears its scope in the same write.
 *
 * @param args.merged - The merged policies.
 * @param args.patch - The `policies` the body sent (null when it cleared them).
 * @returns The merged policies, without an orphan scope.
 * @throws {ServiceError} `VALIDATION_ERROR` when the body sets a scope with no age.
 */
export function enforceVenueAgeScope({
    merged,
    patch
}: {
    readonly merged: Record<string, unknown>;
    readonly patch: Readonly<Record<string, unknown>> | null;
}): Record<string, unknown> {
    if (merged.minAge !== undefined && merged.minAge !== null) return merged;
    const sentScope = patch?.minAgeScope;
    if (sentScope !== undefined && sentScope !== null) {
        throw new ServiceError(ServiceErrorCode.VALIDATION_ERROR, 'Invalid policies', {
            field: 'policies',
            issues: [
                {
                    path: 'policies.minAgeScope',
                    message: 'zodError.venue.minAgeScope.requiresMinAge'
                }
            ]
        });
    }
    const { minAgeScope: _orphan, ...rest } = merged;
    return rest;
}

/**
 * HOS-2122: event details (guests, sound, hours, surcharge) describe an event
 * that is allowed; without `eventsAllowed === true` they are an orphan the
 * public page must never show.
 *
 * With events not allowed in the merged result (`false` or absent), details the
 * body SENT are rejected (400 on `policies.eventsDetails`) and stored details
 * are dropped — so switching events to "no" or "not informed" clears them in
 * the same write, whoever sends it (owner editor or admin form).
 *
 * @param args.merged - The merged policies.
 * @param args.patch - The `policies` the body sent (null when it cleared them).
 * @returns The merged policies, without orphan event details.
 * @throws {ServiceError} `VALIDATION_ERROR` when the body sets details while
 *   events are not allowed.
 */
export function enforceAccommodationEventsDetails({
    merged,
    patch
}: {
    readonly merged: Record<string, unknown>;
    readonly patch: Readonly<Record<string, unknown>> | null;
}): Record<string, unknown> {
    if (merged.eventsAllowed === true) return merged;
    const sentDetails = patch?.eventsDetails;
    if (sentDetails !== undefined && sentDetails !== null) {
        throw new ServiceError(ServiceErrorCode.VALIDATION_ERROR, 'Invalid policies', {
            field: 'policies',
            issues: [
                {
                    path: 'policies.eventsDetails',
                    message: 'zodError.listingPolicies.eventsDetails.requiresEventsAllowed'
                }
            ]
        });
    }
    const { eventsDetails: _orphan, ...rest } = merged;
    return rest;
}

/** Cross-key rules per vertical, applied to the merged policies before validation. */
const POST_MERGE_RULES: Readonly<Partial<Record<PoliciesVertical, PostMergeRule>>> = {
    venue: enforceVenueAgeScope,
    accommodation: enforceAccommodationEventsDetails
};

/** Applies the vertical's {@link POST_MERGE_RULES}, when it has any. */
function applyPostMergeRules({
    vertical,
    merged,
    patch
}: {
    readonly vertical: PoliciesVertical;
    readonly merged: Record<string, unknown>;
    readonly patch: Readonly<Record<string, unknown>> | null;
}): Record<string, unknown> {
    const rule = POST_MERGE_RULES[vertical];
    return rule ? rule({ merged, patch }) : merged;
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
    const merged = applyPostMergeRules({ vertical, merged: policies ?? {}, patch: sent ?? null });
    return { policies: validatePolicies({ vertical, value: merged }) };
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
    const merged = applyPostMergeRules({
        vertical,
        merged: policies,
        patch: payload.policies as Record<string, unknown> | null
    });
    if (Object.keys(merged).length === 0) return { policies: null };
    return { policies: validatePolicies({ vertical, value: merged }) };
}
