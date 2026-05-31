---
specId: SPEC-165
title: Post and Event Comments System
status: draft
complexity: high
owner: qazuor
created: 2026-05-27
related:
  - SPEC-155 (admin-dashboards-v1 — origin; feeds EDITOR card H)
---

# SPEC-165 — Post and Event Comments System

> **Status**: DRAFT — phase-2 stub. Extracted from SPEC-155 Phase-1 scout 2026-05-27. Requires a full spec before implementation can begin.

## 1. Origin

Extracted from SPEC-155 Phase-1 scout on 2026-05-27.

**Concrete finding**: SPEC-155 assumed a 🟡 route (T-009 — recent-comments listing endpoint) that could be built without DB changes. The scout found this to be 🔴: no `post_comments` or `event_comments` table exists in the schema. The `posts` table has only an integer `comments` counter field (no per-comment storage). The `events` table has no comment-related field at all. No `POST_COMMENT_VIEW` or `EVENT_COMMENT_VIEW` permission entries exist in `PermissionEnum`.

As a result, T-009 was tombstoned in SPEC-155, EDITOR dashboard card H ("Comentarios") renders a deferred placeholder pointing to this spec, and the full comments system is scoped here for scheduling as a separate phase-2 feature.

## 2. Goal

Design and implement a comment system for posts and events so that:

- Readers/tourists can leave comments on blog posts and events.
- EDITOR role users can view and moderate comments from the admin dashboard (EDITOR card H).
- ADMIN/SUPER_ADMIN roles can also moderate comments.
- Comments are stored in a queryable store, not just aggregated as a counter.

Once SPEC-165 ships, EDITOR dashboard card H will automatically upgrade from the deferred placeholder to a live feed of recent comments.

## 3. Scope sketch

The following are starting-point scope boundaries. A full spec must define details before implementation.

**Storage**:
- New `post_comments` table: `id`, `postId` (FK → posts), `authorId` (FK → users), `content`, `moderationState` (PENDING/APPROVED/REJECTED), `createdAt`, `updatedAt`, `deletedAt`.
- New `event_comments` table: same shape with `eventId` (FK → events) instead of `postId`.
- Consider a unified `entity_comments` table (polymorphic) vs. two tables — this is an open question for the full spec.

**Permissions**:
- `POST_COMMENT_VIEW` — read post comments.
- `POST_COMMENT_WRITE` — leave a comment on a post.
- `POST_COMMENT_MODERATE` — approve/reject post comments.
- `EVENT_COMMENT_VIEW` — read event comments.
- `EVENT_COMMENT_WRITE` — leave a comment on an event.
- `EVENT_COMMENT_MODERATE` — approve/reject event comments.

**Endpoints required to feed SPEC-155 EDITOR card H**:
- `GET /api/v1/admin/comments/recent` — returns recent comments across posts and events, sorted by `createdAt` desc, `pageSize=10`. Requires `POST_COMMENT_VIEW` AND `EVENT_COMMENT_VIEW`. Response shape: `[{ id, entityType: 'post'|'event', entityId, content, authorName, moderationState, createdAt }]`.

**Web frontend (public)**:
- Comment thread component on post detail pages.
- Comment thread component on event detail pages.
- Submit comment form (requires authenticated user).

**Admin UI**:
- Comment moderation queue in admin panel.
- EDITOR card H live feed (replaces deferred placeholder when this spec ships).

## 4. Open questions

These must be resolved during full spec authoring:

1. **Unified table vs. two tables**: a single `entity_comments` table with a polymorphic `(entityType, entityId)` pair is simpler to query across types; two separate tables are type-safe and easier to FK-constrain. Which approach matches the project's existing pattern (check `entity_bookmarks` for precedent)?
2. **Comment nesting**: flat (one level) or threaded (parent/child replies)? Threaded adds schema complexity.
3. **Moderation default**: should new comments be PENDING by default (requiring approval before display) or APPROVED by default (displayed immediately, moderated retroactively)?
4. **Anonymous comments**: are guest (unauthenticated) comments allowed, or must the commenter be registered?
5. **Rate limiting**: how many comments per user per entity per time window?
6. **Notification**: does the EDITOR receive a notification when a new comment awaits moderation?
7. **Web UX placement**: where does the comment thread appear relative to the post/event content? Does it replace or supplement the existing integer counter?
8. **Counter field reconciliation**: the existing `posts.comments` integer counter — is it kept in sync, deprecated, or removed once this spec ships?
