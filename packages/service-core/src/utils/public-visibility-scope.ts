/**
 * @file public-visibility-scope.ts
 * @description Forces the public read paths of content entities to return only
 * genuinely published rows, for EVERY caller.
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
 * Every caller of these read methods is a public-tier route. Putting the rule in
 * the service means the next caller cannot forget it, which is exactly how the
 * first ones did.
 *
 * ## Where it is applied — the enumerated list
 *
 * This section is an ENUMERATION, not a coverage claim. An earlier revision
 * closed with "Every OTHER public read on `EventService`/`PostService` is
 * covered", and that sentence was FALSE the day it was written: `getNews`,
 * `getFeatured`, `getByRelatedAccommodation`, `getByRelatedDestination` and
 * `getByRelatedEvent` all still carried the dead `!actor.id` guard at the time.
 * A confident universal is exactly how the `getByCategory` defect survived a
 * review, so do not restore one — extend the table below with what you actually
 * checked, method by method.
 *
 * | Service | Method | Route |
 * |---|---|---|
 * | `EventService` | `_executeSearch`, `_executeCount` | `event/public/list`, events block of `destination/public/list` |
 * | `EventService` | `getByAuthor` | `event/public/getByAuthor` |
 * | `EventService` | `getByLocation` | `event/public/getByLocation` |
 * | `EventService` | `getByOrganizer` | `event/public/getByOrganizer` |
 * | `EventService` | `getUpcoming` | `event/public/getUpcoming` |
 * | `PostService` | `_executeSearch`, `_executeCount` | `post/public/list` |
 * | `PostService` | `getByCategory` | `post/public/getByCategory` |
 * | `PostService` | `getNews` | `post/public/getNews` |
 * | `PostService` | `getFeatured` | `post/public/getFeatured` |
 * | `PostService` | `getByRelatedAccommodation` | `post/public/getByRelatedAccommodation` |
 * | `PostService` | `getByRelatedDestination` | `post/public/getByRelatedDestination` |
 * | `PostService` | `getByRelatedEvent` | `post/public/getByRelatedEvent` |
 *
 * Every one of those routes declares a `cacheTTL` and sits under a
 * `PUBLIC_CACHE_ENDPOINTS` prefix (`apps/api/src/middlewares/cache.constants.ts`),
 * so every one of them is actor-blind by construction.
 *
 * ## What is NOT covered, and why
 *
 * **Unrouted, still actor-dependent — fix before wiring.**
 * `EventService.getByCategory` and `EventService.getFreeEvents` still branch on
 * `EVENT_SOFT_DELETE_VIEW` to decide `visibility`, and neither constrains
 * `lifecycleState`. They are NOT routed: no HTTP route in `apps/api` calls
 * either one (verified by reference search — note that `PostService`'s
 * identically-named `getByCategory` IS routed and IS covered above, which is
 * why a search by symbol name alone is not enough). Neither can poison a cache
 * or serve a `DRAFT` to a visitor today. **If you wire a route to either, route
 * its filters through this helper first** — the pattern they still hold is the
 * exact one this file exists to delete.
 *
 * **Out of scope by construction — a different mechanism, not an omission.**
 * `PostService.getSummary` / `getStats` and `EventService.getSummary` also back
 * public cached routes, but they are SINGLE-row reads: they `findOne` by
 * id/slug and then gate the row through `_canView(actor, entity)`. There is no
 * filter object to narrow, so this helper does not apply to them and their
 * absence from the table above is not a gap this helper can close. Whether a
 * row-level `_canView` is the right gate for an actorless cached response is a
 * separate question this file does NOT answer — do not read this paragraph as a
 * clean bill of health for those three.
 *
 * ## Why it is UNCONDITIONAL — no permission escape hatch
 *
 * The first version of this helper skipped the filter for an actor holding
 * `*_VIEW_PRIVATE` / `*_VIEW_DRAFT`, so an editor previewing their own
 * unpublished work would still see it through the public endpoint. That is a
 * cache-poisoning bug, not a feature:
 *
 * - `cacheMiddleware` (`apps/api/src/utils/create-app.ts`) wraps `authMiddleware`,
 *   so it runs BEFORE the session is resolved and stores the response under a key
 *   built by `generateCacheKey` (`apps/api/src/middlewares/cache.ts`).
 * - For a `PUBLIC_CACHE_ENDPOINTS` prefix that key is `public:${path}${suffix}`
 *   — it carries NO actor component at all.
 * - So one authenticated editor's request populates the SHARED anonymous entry
 *   with `PRIVATE`/`DRAFT` rows, which are then served to every subsequent
 *   visitor for the whole TTL. The same reasoning already governs
 *   `getPublicProfileBySlug`, the accommodation public reads (HOS-353), and the
 *   amenity/feature catalogs: **a public route is actor-blind by design.**
 *
 * Privileged preview belongs on the admin/protected tier, where the response is
 * not shared. Do not reintroduce an actor-dependent branch here — the `actor`
 * parameter is accepted precisely so that invariant stays expressible in a test,
 * and it is deliberately never read.
 *
 * A caller-supplied filter still wins when present: the admin-tier search paths
 * do not go through this helper at all, and the public HTTP schemas cannot
 * express `visibility=PRIVATE`, so the only thing an explicit filter can do here
 * is narrow the scope further (e.g. `lifecycleState=ARCHIVED` on a public route
 * returns nothing).
 */

import { LifecycleStatusEnum, VisibilityEnum } from '@repo/schemas';
import type { Actor } from '../types';

/**
 * Narrow a public read's filters to published content, for every caller.
 *
 * Adds `visibility: PUBLIC` and `lifecycleState: ACTIVE` unless the caller
 * already supplied that filter — this only fills a gap, it never overwrites.
 *
 * MUST be applied to the COUNT path as well as the item path. Applying it to
 * only one makes `total` describe a different set than `items`, which is a
 * quieter bug than the one it fixes.
 *
 * @param params - The filters about to reach the model.
 * @param params.filters - Caller-supplied filters, untouched where present.
 * @param params.actor - The requesting actor. **Accepted and deliberately
 *   ignored** — see the file docstring: these responses are stored under an
 *   actorless cache key, so the scope cannot depend on who is asking. Kept in
 *   the signature so the actor-blindness invariant is directly testable and so
 *   every call site records that the actor was considered, not overlooked.
 * @returns A new filter object; the input is not mutated.
 *
 * @example
 * applyPublicVisibilityScope({ filters: { category: 'CULTURE' }, actor });
 * // { category: 'CULTURE', visibility: 'PUBLIC', lifecycleState: 'ACTIVE' }
 */
export function applyPublicVisibilityScope({
    filters,
    actor: _actor
}: {
    readonly filters: Record<string, unknown>;
    readonly actor: Actor | undefined;
}): Record<string, unknown> {
    const scoped: Record<string, unknown> = { ...filters };

    if (scoped.visibility === undefined) {
        scoped.visibility = VisibilityEnum.PUBLIC;
    }

    if (scoped.lifecycleState === undefined) {
        scoped.lifecycleState = LifecycleStatusEnum.ACTIVE;
    }

    return scoped;
}
