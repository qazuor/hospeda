import { z } from 'zod';
import {
    BaseAdminFields,
    BaseAuditFields,
    BaseLifecycleFields,
    EventLocationIdSchema
} from '../../common/index.js';
import {
    EventLocationAddressReadFields,
    EventLocationAddressSchema
} from './eventLocation.address.schema.js';

/**
 * Event Location schema definition using Zod for validation.
 *
 * Represents the venue of an event. Geographic context (city, state, country)
 * is derived from the `destinationId` FK to a destination of type CITY — this
 * schema only carries the postal address of the venue plus its identifying
 * `placeName` (e.g. "Teatro Municipal").
 *
 * @see SPEC-095 — destination relationship cleanup.
 */
export const EventLocationSchema = z.object({
    // Base fields
    id: EventLocationIdSchema,
    slug: z
        .string({
            message: 'zodError.eventLocation.slug.required'
        })
        .min(2, { message: 'zodError.eventLocation.slug.min' })
        .max(100, { message: 'zodError.eventLocation.slug.max' })
        .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
            message: 'zodError.eventLocation.slug.format'
        }),
    ...BaseAuditFields,
    ...BaseLifecycleFields,
    ...BaseAdminFields,
    // Postal address + destinationId FK (SPEC-095)
    ...EventLocationAddressSchema.shape
});

export type EventLocation = z.infer<typeof EventLocationSchema>;

/**
 * READ-side variant of {@link EventLocationSchema} (HOS-300).
 *
 * Identical shape, with the postal-address length bounds dropped. Every read
 * schema for this entity — both the access family (public/protected/admin,
 * consumed by the API) and the query family (list item/summary, consumed by
 * the admin client) — MUST derive from this, not from `EventLocationSchema`.
 * Deriving a read schema from the strict base is what caused HOS-300: a
 * persisted row that no write path could have produced took down a whole
 * fail-closed paginated response.
 *
 * Write schemas (create/update/patch) keep deriving from `EventLocationSchema`
 * so the bounds stay enforced on the way in.
 */
export const EventLocationReadSchema = EventLocationSchema.extend({
    ...EventLocationAddressReadFields
});

/** Inferred type for the read-side event location. */
export type EventLocationRead = z.infer<typeof EventLocationReadSchema>;
