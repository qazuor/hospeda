/**
 * One-address rule schemas (HOS-1810): the 409 reason, the admin exception body
 * and the repeated-address report.
 *
 * The rule applies to accommodation and venue only; experiences are out.
 */
import { z } from 'zod';

/**
 * Machine-readable reason of the 409 `ALREADY_EXISTS` answered when a listing is
 * published (or its address moved) onto a place another listing of the SAME
 * owner already occupies. `handleRouteError` gates the public `details` on it.
 */
export const DUPLICATE_LOCATION_REASON = 'DUPLICATE_LOCATION' as const;

/**
 * Names of the partial UNIQUE indexes that back the rule at the database
 * (one PUBLISHED, live, non-excepted listing per owner and place key). A
 * `23505` on either one is a concurrent publish that the service pre-check
 * could not see, and is answered as `DUPLICATE_LOCATION`.
 */
export const LOCATION_KEY_UNIQUE_INDEXES: readonly string[] = [
    'accommodations_ownerId_locationKey_published_uniq',
    'venues_ownerId_locationKey_published_uniq'
];

/** Minimum length of an exception reason: it is an audit record, not a flag. */
export const LOCATION_EXCEPTION_REASON_MIN = 10;

/** Body of `POST .../location-exception`. */
export const LocationExceptionInputSchema = z.object({
    reason: z
        .string({ message: 'zodError.locationException.reason.required' })
        .trim()
        .min(LOCATION_EXCEPTION_REASON_MIN, { message: 'zodError.locationException.reason.min' })
        .max(500, { message: 'zodError.locationException.reason.max' })
});
export type LocationExceptionInput = z.infer<typeof LocationExceptionInputSchema>;

/** Response of the exception routes. */
export const LocationExceptionResultSchema = z.object({
    id: z.string().uuid(),
    hasException: z.boolean()
});
export type LocationExceptionResult = z.infer<typeof LocationExceptionResultSchema>;

/** Query of `GET .../location-duplicates` (`page` + `pageSize`, never `limit`). */
export const LocationDuplicatesQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20)
});
export type LocationDuplicatesQuery = z.infer<typeof LocationDuplicatesQuerySchema>;

/** One group of published listings that share a place key. */
export const LocationDuplicateGroupSchema = z.object({
    locationKey: z.string(),
    listings: z.array(z.object({ id: z.string().uuid(), ownerId: z.string().uuid() })),
    ownerCount: z.number().int(),
    sameOwner: z.boolean()
});
export type LocationDuplicateGroupOutput = z.infer<typeof LocationDuplicateGroupSchema>;

/** Response of `GET .../location-duplicates`. */
export const LocationDuplicatesResponseSchema = z.object({
    items: z.array(LocationDuplicateGroupSchema),
    total: z.number().int(),
    page: z.number().int(),
    pageSize: z.number().int()
});
export type LocationDuplicatesResponse = z.infer<typeof LocationDuplicatesResponseSchema>;

// ---------------------------------------------------------------------------
// Owner-requested exceptions (HOS-2192)
// ---------------------------------------------------------------------------

/** Lifecycle of an owner's request for a location exception. */
export const LOCATION_EXCEPTION_REQUEST_STATUSES = [
    'PENDING',
    'APPROVED',
    'REJECTED',
    'SUPERSEDED'
] as const;
export const LocationExceptionRequestStatusSchema = z.enum(LOCATION_EXCEPTION_REQUEST_STATUSES);
export type LocationExceptionRequestStatus = z.infer<typeof LocationExceptionRequestStatusSchema>;

/** The six audited actions on a location exception (SUPERSEDED: a request that stopped applying). */
export const LOCATION_EXCEPTION_EVENT_ACTIONS = [
    'REQUESTED',
    'APPROVED',
    'REJECTED',
    'GRANTED',
    'REVOKED',
    'SUPERSEDED'
] as const;
export const LocationExceptionEventActionSchema = z.enum(LOCATION_EXCEPTION_EVENT_ACTIONS);
export type LocationExceptionEventAction = z.infer<typeof LocationExceptionEventActionSchema>;

/** `details.reason` values of the 409s the request flow answers (state conflicts). */
export const LOCATION_EXCEPTION_REASONS = {
    NEEDS_KEY: 'LOCATION_EXCEPTION_NEEDS_KEY',
    REQUEST_PENDING: 'LOCATION_EXCEPTION_REQUEST_PENDING',
    ALREADY_GRANTED: 'LOCATION_EXCEPTION_ALREADY_GRANTED',
    NOT_NEEDED: 'LOCATION_EXCEPTION_NOT_NEEDED',
    REQUEST_NOT_PENDING: 'LOCATION_EXCEPTION_REQUEST_NOT_PENDING',
    REQUEST_STALE: 'LOCATION_EXCEPTION_REQUEST_STALE',
    REVOKE_CONFLICT: 'LOCATION_EXCEPTION_REVOKE_CONFLICT'
} as const;
export type LocationExceptionReason =
    (typeof LOCATION_EXCEPTION_REASONS)[keyof typeof LOCATION_EXCEPTION_REASONS];

/** Maximum length of any exception reason (owner or admin). */
export const LOCATION_EXCEPTION_REASON_MAX = 500;

const reasonField = (key: string) =>
    z
        .string({ message: `zodError.locationException.${key}.required` })
        .trim()
        .min(LOCATION_EXCEPTION_REASON_MIN, { message: `zodError.locationException.${key}.min` })
        .max(LOCATION_EXCEPTION_REASON_MAX, { message: `zodError.locationException.${key}.max` });

/** Body of the owner's `POST .../location-exception-request`. */
export const LocationExceptionRequestInputSchema = z.object({ reason: reasonField('reason') });
export type LocationExceptionRequestInput = z.infer<typeof LocationExceptionRequestInputSchema>;

/** Body of the admin's approve: the reason is optional (defaults to the owner's). */
export const LocationExceptionApproveInputSchema = z.object({
    reason: reasonField('reason').optional()
});
export type LocationExceptionApproveInput = z.infer<typeof LocationExceptionApproveInputSchema>;

/** Body of the admin's reject: the reason reaches the owner. */
export const LocationExceptionRejectInputSchema = z.object({ reason: reasonField('reason') });
export type LocationExceptionRejectInput = z.infer<typeof LocationExceptionRejectInputSchema>;

/** Optional body of the admin's revoke (`DELETE .../location-exception`). */
export const LocationExceptionRevokeInputSchema = z.object({
    reason: reasonField('reason').optional()
});
export type LocationExceptionRevokeInput = z.infer<typeof LocationExceptionRevokeInputSchema>;

/** What the owner sees of the latest request of a listing (never another listing's ids). */
export const LocationExceptionRequestViewSchema = z.object({
    id: z.string().uuid(),
    status: LocationExceptionRequestStatusSchema,
    reason: z.string(),
    decisionReason: z.string().nullable(),
    requestedAt: z.string(),
    decidedAt: z.string().nullable()
});
export type LocationExceptionRequestView = z.infer<typeof LocationExceptionRequestViewSchema>;

/** Owner-facing exception block of the protected listing projection. */
export const LocationExceptionOwnerViewSchema = z.object({
    hasException: z.boolean(),
    request: LocationExceptionRequestViewSchema.nullable()
});
export type LocationExceptionOwnerView = z.infer<typeof LocationExceptionOwnerViewSchema>;

/** Response of the owner's request creation. */
export const LocationExceptionRequestCreatedSchema = z.object({
    id: z.string().uuid(),
    status: LocationExceptionRequestStatusSchema,
    requestedAt: z.string()
});
export type LocationExceptionRequestCreated = z.infer<typeof LocationExceptionRequestCreatedSchema>;

/** Query of `GET .../location-exception-requests`. */
export const LocationExceptionRequestsQuerySchema = z.object({
    status: LocationExceptionRequestStatusSchema.default('PENDING'),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20)
});
export type LocationExceptionRequestsQuery = z.infer<typeof LocationExceptionRequestsQuerySchema>;

const namedRef = z.object({ id: z.string().uuid(), name: z.string() });

/** One row of the admin queue. */
export const LocationExceptionRequestRowSchema = z.object({
    requestId: z.string().uuid(),
    status: LocationExceptionRequestStatusSchema,
    listing: namedRef,
    owner: z.object({ id: z.string().uuid(), name: z.string(), email: z.string() }),
    address: z.object({
        street: z.string().nullable(),
        number: z.string().nullable(),
        floor: z.string().nullable(),
        apartment: z.string().nullable(),
        destinationId: z.string().nullable()
    }),
    collidingListings: z.array(namedRef),
    reason: z.string(),
    decisionReason: z.string().nullable(),
    requestedAt: z.string()
});
export type LocationExceptionRequestRow = z.infer<typeof LocationExceptionRequestRowSchema>;

/** Response of the admin queue. */
export const LocationExceptionRequestsResponseSchema = z.object({
    items: z.array(LocationExceptionRequestRowSchema),
    total: z.number().int(),
    page: z.number().int(),
    pageSize: z.number().int()
});
export type LocationExceptionRequestsResponse = z.infer<
    typeof LocationExceptionRequestsResponseSchema
>;

/** Response of approve/reject. */
export const LocationExceptionDecisionResultSchema = z.object({
    requestId: z.string().uuid(),
    status: LocationExceptionRequestStatusSchema
});
export type LocationExceptionDecisionResult = z.infer<typeof LocationExceptionDecisionResultSchema>;

/** One audited event of a listing's exception history. */
export const LocationExceptionEventSchema = z.object({
    id: z.string().uuid(),
    action: LocationExceptionEventActionSchema,
    actorId: z.string().uuid().nullable(),
    actorName: z.string().nullable(),
    reason: z.string().nullable(),
    requestId: z.string().uuid().nullable(),
    createdAt: z.string()
});
export type LocationExceptionEvent = z.infer<typeof LocationExceptionEventSchema>;

/** Response of the admin `GET .../:id/location-exception`. */
export const LocationExceptionStateSchema = z.object({
    id: z.string().uuid(),
    hasException: z.boolean(),
    by: z.string().uuid().nullable(),
    reason: z.string().nullable(),
    at: z.string().nullable(),
    events: z.array(LocationExceptionEventSchema)
});
export type LocationExceptionState = z.infer<typeof LocationExceptionStateSchema>;
