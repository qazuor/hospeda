/**
 * @fileoverview
 * The shape of an entity-change event, as reported by the ~40 service call
 * sites that schedule cache revalidation.
 *
 * Split out of the deleted `entity-path-mapper.ts` (HOS-369 W1-1 / D-6): the
 * TYPE is consumed across `apps/api` and `@repo/service-core`, but the
 * entity→URL mapping that used to live beside it is gone — purge addresses
 * cache tags now, not paths (spec §5.11).
 *
 * Every variant carries only the context needed to name the affected tags
 * precisely, so a write invalidates what it changed and not the whole zone.
 */

/**
 * Discriminated union describing an entity change event.
 *
 * Note that most variants make the identifying key OPTIONAL. That is not
 * sloppiness — several real call sites genuinely do not have one (a tag or
 * amenity write has no per-entity page; the plan-remediation paths fall back to
 * an id-only event when the slug lookup fails). Those degrade to collection
 * tags rather than being dropped.
 */
export type EntityChangeData =
    | {
          /** Accommodation entity changed */
          readonly entityType: 'accommodation';
          /** Slug of the changed accommodation — addresses its detail page */
          readonly slug?: string;
          /**
           * Stable UUID of the changed accommodation.
           * Written to `revalidation_log.entity_id` for audit querying, and
           * emitted as a second tag so a call site holding only the id can
           * still purge the entity (see `buildEntityCacheTags`).
           */
          readonly id?: string;
          /** Slug of the parent destination — its page lists this accommodation */
          readonly destinationSlug?: string;
      }
    | {
          /** Destination entity changed */
          readonly entityType: 'destination';
          /** Slug of the changed destination */
          readonly slug?: string;
          /** Stable UUID of the changed destination */
          readonly id?: string;
      }
    | {
          /** Event entity changed */
          readonly entityType: 'event';
          /** Slug of the changed event */
          readonly slug?: string;
          /** Stable UUID of the changed event */
          readonly id?: string;
          /** Destination slug when the event is tied to one */
          readonly destinationSlug?: string;
      }
    | {
          /** Post/article entity changed */
          readonly entityType: 'post';
          /** Slug of the changed post */
          readonly slug?: string;
          /** Stable UUID of the changed post */
          readonly id?: string;
      }
    | {
          /** Accommodation review changed — affects the parent accommodation */
          readonly entityType: 'accommodation_review';
          /** Slug of the parent accommodation */
          readonly accommodationSlug?: string;
      }
    | {
          /** Destination review changed — affects the parent destination */
          readonly entityType: 'destination_review';
          /** Slug of the parent destination */
          readonly destinationSlug?: string;
      }
    | {
          /** Tag entity changed — tags are accommodation filters */
          readonly entityType: 'tag';
      }
    | {
          /** Amenity entity changed — amenities are shown on accommodation listings */
          readonly entityType: 'amenity';
      };
