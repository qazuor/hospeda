import { LifecycleStatusEnum, ModerationStatusEnum, VisibilityEnum } from '@repo/schemas';

/**
 * The three column values a piece of content must hold, together, to be
 * readable by the public (HOS-374 §7.6.1).
 *
 * They are deliberately orthogonal: `moderationState` is the platform's
 * verdict, `visibility` is the author's switch, and `lifecycleState` is the
 * archival state. Public ⟺ all three at once.
 */
export const PUBLIC_READ_FLOOR = {
    moderationState: ModerationStatusEnum.APPROVED,
    visibility: VisibilityEnum.PUBLIC,
    lifecycleState: LifecycleStatusEnum.ACTIVE
} as const;

/**
 * The state fields {@link applyPublicReadFloor} pins. Exported so tests and the
 * static guard assert against one list instead of restating it.
 */
export const PUBLIC_READ_FLOOR_FIELDS = Object.keys(PUBLIC_READ_FLOOR) as ReadonlyArray<
    keyof typeof PUBLIC_READ_FLOOR
>;

/**
 * Force the public read floor onto a filter object.
 *
 * Applied **after** the caller's filters so no HTTP query parameter can widen
 * the result set: a request asking for `moderationState=PENDING` or
 * `visibility=PRIVATE` on a public endpoint gets the floor regardless. This
 * mirrors the review-moderation precedent in `accommodationReview.service.ts`.
 *
 * Admin read paths must NOT call this — admins query every state by design.
 *
 * @param filters - The caller-derived filter object. Not mutated.
 * @returns A new filter object with the three floor fields pinned.
 */
export const applyPublicReadFloor = <T extends Record<string, unknown>>(
    filters: T
): T & typeof PUBLIC_READ_FLOOR => ({
    ...filters,
    ...PUBLIC_READ_FLOOR
});

/**
 * Input for {@link isContentStateApproved}.
 */
export interface ContentStateApprovalInput {
    readonly moderationState?: ModerationStatusEnum | null;
    readonly lifecycleState?: LifecycleStatusEnum | null;
}

/**
 * Whether an already-loaded row clears the platform-side half of the public
 * read floor: approved by moderation and not archived.
 *
 * Used by the single-entity read paths (`getById` / `getBySlug` and everything
 * built on them), which resolve the row before authorizing it and therefore
 * cannot express the floor as a filter.
 *
 * `visibility` is deliberately NOT part of this predicate. The entity
 * permission helpers (`checkCanViewPost` / `checkCanViewEvent`) already resolve
 * visibility with their own author and `*_VIEW_PRIVATE` exceptions; restating
 * it here would give two answers to one question. Soft deletion is likewise
 * left to those helpers, which own the GONE/NOT_FOUND distinction.
 *
 * @param state - The row's moderation and lifecycle columns.
 * @returns `true` when the platform considers the content servable.
 */
export const isContentStateApproved = ({
    moderationState,
    lifecycleState
}: ContentStateApprovalInput): boolean =>
    moderationState === PUBLIC_READ_FLOOR.moderationState &&
    lifecycleState === PUBLIC_READ_FLOOR.lifecycleState;
