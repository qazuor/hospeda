import { z } from 'zod';
import {
    LifecycleStatusEnumSchema,
    ModerationStatusEnumSchema,
    VisibilityEnumSchema
} from '../enums/index.js';

/**
 * Input schemas for the dedicated content state-transition endpoints
 * (HOS-374 §7.6.4).
 *
 * Editorial content (posts, events) has three orthogonal state fields, each
 * owned by a different actor and gated by its own permission:
 *
 * | Field | Meaning | Endpoint | Permission |
 * |---|---|---|---|
 * | `moderationState` | the platform's verdict | `POST .../:id/moderate` | `*_MODERATION_CHANGE` |
 * | `visibility` | the author's switch | `POST .../:id/publish-state` | `*_PUBLISH_TOGGLE` (any) or `*_PUBLISH_OWN` (own) |
 * | `lifecycleState` | the content's own life | `POST .../:id/lifecycle-state` | `*_LIFECYCLE_CHANGE` |
 *
 * They travelled inside the generic update payload until now, which made every
 * one of those permissions bypassable by editing the field directly.
 *
 * Each body carries exactly the field it owns, named after the column, so a
 * caller cannot smuggle a second state change into a transition it is not
 * authorized for.
 */

/**
 * Body of the content moderation endpoint.
 *
 * Unlike reviews (`ReviewModerateInputSchema`, which accepts only
 * `APPROVED`/`REJECTED`), content moderation accepts the full enum: an admin
 * must be able to push an item back to `PENDING` for re-review, which the
 * admin panel already offers.
 */
export const ContentModerationChangeInputSchema = z.object({
    moderationState: ModerationStatusEnumSchema
});
export type ContentModerationChangeInput = z.infer<typeof ContentModerationChangeInputSchema>;

/**
 * Body of the publish-state endpoint.
 *
 * Takes the visibility value rather than a boolean: `RESTRICTED` is a real
 * option for events and is offered by the admin panel, so a boolean would
 * silently drop a state the system supports. A caller that thinks in
 * published/unpublished maps `true` to `PUBLIC` and `false` to `PRIVATE`.
 */
export const ContentPublishStateInputSchema = z.object({
    visibility: VisibilityEnumSchema
});
export type ContentPublishStateInput = z.infer<typeof ContentPublishStateInputSchema>;

/**
 * Body of the lifecycle-state endpoint.
 */
export const ContentLifecycleStateInputSchema = z.object({
    lifecycleState: LifecycleStatusEnumSchema
});
export type ContentLifecycleStateInput = z.infer<typeof ContentLifecycleStateInputSchema>;
