/**
 * @file public-visibility-scope.ts
 * @description Forces the public search paths of content entities to return
 * only genuinely published rows.
 *
 * ## The bug this exists to close
 *
 * `PostService.search` and `EventService.search` passed the caller's filters
 * straight to the model. Neither the route nor the service ever constrained
 * `visibility` or `lifecycleState`, so `GET /api/v1/public/posts` and
 * `GET /api/v1/public/events` returned `PRIVATE` and `DRAFT` rows to anonymous
 * visitors. Reproduced against a real database (HOS-375 follow-up): inserting
 * one `PRIVATE` and one `DRAFT` post moved the public list's `total` from 40 to
 * 42, with both rows present in `items`.
 *
 * The HTTP schemas already reject `?visibility=PRIVATE`, so a caller could not
 * ASK for hidden content — but they did not have to, because the unfiltered
 * default already included it.
 *
 * ## Why the scope is applied here and not in the route
 *
 * Every caller of these two `search` methods is a public-tier route
 * (`post/public/list`, `event/public/list`, and the events block of
 * `destination/public/list`). Putting the rule in the service means a fourth
 * caller cannot forget it, which is exactly how the first three did.
 *
 * ## Why a permission gate rather than an unconditional filter
 *
 * `POST_VIEW_PRIVATE` / `POST_VIEW_DRAFT` (and their event twins) already exist
 * for precisely this distinction, so an editor previewing their own unpublished
 * work keeps working. It mirrors `EventService.getByAuthor`, which has forced
 * `visibility = PUBLIC` for unprivileged actors since it was written.
 *
 * The caller's own filter always wins when present: a privileged actor asking
 * for `visibility: PRIVATE` still gets private rows.
 */

import { LifecycleStatusEnum, type PermissionEnum, VisibilityEnum } from '@repo/schemas';
import type { Actor } from '../types';

/** The permissions that let an actor see past the public scope. */
export interface PublicVisibilityScopePermissions {
    /** Permission granting sight of `PRIVATE` rows, e.g. `POST_VIEW_PRIVATE`. */
    readonly viewPrivate: PermissionEnum;
    /** Permission granting sight of `DRAFT` rows, e.g. `POST_VIEW_DRAFT`. */
    readonly viewDraft: PermissionEnum;
}

/**
 * Narrow a public search's filters to published content.
 *
 * Adds `visibility: PUBLIC` unless the actor may see private rows, and
 * `lifecycleState: ACTIVE` unless the actor may see drafts. Filters the caller
 * already supplied are never overwritten — this only fills a gap.
 *
 * MUST be applied to the COUNT path as well as the item path. Applying it to
 * only one makes `total` describe a different set than `items`, which is a
 * quieter bug than the one it fixes.
 *
 * @param params - The filters about to reach the model.
 * @param params.filters - Caller-supplied filters, untouched where present.
 * @param params.actor - The requesting actor. A guest is expected and valid.
 * @param params.permissions - The entity's private/draft view permissions.
 * @returns A new filter object; the input is not mutated.
 *
 * @example
 * applyPublicVisibilityScope({
 *   filters: { category: 'CULTURE' },
 *   actor: guest,
 *   permissions: { viewPrivate: PermissionEnum.POST_VIEW_PRIVATE, viewDraft: PermissionEnum.POST_VIEW_DRAFT }
 * });
 * // { category: 'CULTURE', visibility: 'PUBLIC', lifecycleState: 'ACTIVE' }
 */
export function applyPublicVisibilityScope({
    filters,
    actor,
    permissions
}: {
    readonly filters: Record<string, unknown>;
    readonly actor: Actor | undefined;
    readonly permissions: PublicVisibilityScopePermissions;
}): Record<string, unknown> {
    const held = actor?.permissions ?? [];
    const scoped: Record<string, unknown> = { ...filters };

    if (scoped.visibility === undefined && !held.includes(permissions.viewPrivate)) {
        scoped.visibility = VisibilityEnum.PUBLIC;
    }

    if (scoped.lifecycleState === undefined && !held.includes(permissions.viewDraft)) {
        scoped.lifecycleState = LifecycleStatusEnum.ACTIVE;
    }

    return scoped;
}
