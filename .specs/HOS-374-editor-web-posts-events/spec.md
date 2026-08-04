---
title: Editors author posts and events from /mi-cuenta, without admin panel access
linear: HOS-374
statusSource: linear
created: 2026-08-03
type: feature
areas:
  - auth
  - api
  - db
  - web
---

# Editors author posts and events from `/mi-cuenta`, without admin panel access

## 1. Summary

Today an approved external collaborator receives the `EDITOR` role and authors
content **inside the admin panel**. This spec moves that work to `/mi-cuenta`
and removes the panel from their reach.

The visible deliverable is a posts/events editor in `apps/web`. The load-bearing
deliverable is the authorization work underneath it, because the protected write
path this editor would consume is **not currently safe to hand to an external
collaborator**. Four independent defects were verified in the code (§2), two of
which are live production bugs unrelated to this feature's UI.

Delivered in three phases, in this order:

- **Phase 1 — Close the write path.** Publication gate, `authorId` forced
  server-side, author-scoped ownership, plus the two production bugs that make
  the protected event and media routes unusable today.
- **Phase 2 — The editor in `/mi-cuenta`.** Post and event editors built from
  the accommodation editor mold, first consumer of `protected/posts` and
  `protected/events` from `apps/web`.
- **Phase 3 — Cut panel access.** Seed edit + data migration stripping
  `ACCESS_PANEL_ADMIN`/`ACCESS_API_ADMIN` from `EDITOR` and `CLIENT_MANAGER`,
  and the `discovery-doors` flip.

**Phase 3 must ship in the same release as Phase 2, never before it.** Cutting
panel access first leaves every active editor with no tool at all. Only Phase
3's PR carries `Closes HOS-374`.

## 2. Problem

Every claim below was verified against the code on 2026-08-03. File:line
citations are exact.

### 2.1 Nothing gates publication — content is public the instant it is created

`posts` and `events` both carry a `moderationState` column
(`packages/db/src/schemas/post/post.dbschema.ts:81`,
`packages/db/src/schemas/event/event.dbschema.ts:68`), typed
`PENDING | APPROVED | REJECTED`
(`packages/schemas/src/enums/moderation-status.enum.ts:1-5`), with an index on
events (`event.dbschema.ts:86`).

It gates nothing. The generic utility that would branch on it,
`getEntityPermission()` (`packages/service-core/src/utils/permission.ts:30-236`),
has **zero non-test call sites** in the entire repo. The functions actually wired
into the services — `checkCanViewPost`
(`packages/service-core/src/services/post/post.permissions.ts:72-101`) and
`checkCanViewEvent`
(`packages/service-core/src/services/event/event.permissions.ts:59-97`) — never
reference `moderationState` at all.

Meanwhile both HTTP create mappers hardcode the content public:

```ts
// packages/schemas/src/entities/event/event.http.schema.ts:316-317
visibility: VisibilityEnum.PUBLIC,
moderationState: ModerationStatusEnum.PENDING
```

```ts
// packages/schemas/src/entities/post/post.http.schema.ts:349-350
visibility: VisibilityEnum.PUBLIC,
moderationState: ModerationStatusEnum.PENDING,
```

These are literal constants, not conditionals. `visibility` is absent from
`PostCreateHttpSchema`/`EventCreateHttpSchema` entirely, and equally absent from
the Update/Patch schemas (deliberately — see the comment at
`post.http.schema.ts:385-386`).

**Worse than the issue described.** The public read path does not filter on
`visibility` either, on the list endpoint. `PostService._executeSearch`
(`packages/service-core/src/services/post/post.service.ts:776-840`) and
`EventService._executeSearch` (`event.service.ts:704-800`) build their WHERE
clause purely from client filter params; neither injects a visibility or
moderation condition, neither service overrides `_beforeSearch`, and
`PostSearchSchema`/`EventSearchSchema` do not even define a `visibility` field.
Only the single-item reads (`getById`/`getBySlug`) check `visibility`, via the
`_canView` hook.

So a post or event created through the HTTP layer is `PUBLIC` + `PENDING`, and
`PENDING` means nothing to any reader. **Building this gate is the single most
important item in this spec**: without it, granting an external collaborator the
ability to create content is granting them the ability to publish it.

For contrast, the pattern already exists elsewhere: accommodation and
destination reviews force `lifecycleState='ACTIVE' AND moderationState='APPROVED'`
on every public read (documented in `packages/service-core/CLAUDE.md`). Posts and
events simply never got it.

### 2.2 `authorId` comes from the request body

`authorId: z.string().uuid()` is a **required** field on both create schemas
(`post.http.schema.ts:209`, `event.http.schema.ts:189`), and the mappers pass it
straight through (`post.http.schema.ts:334`, `event.http.schema.ts:311`):

```ts
authorId: httpData.authorId,
```

The route handlers fetch the actor and never use it for this
(`apps/api/src/routes/post/protected/create.ts:38-41`, and the event twin):

```ts
const actor = getActorFromContext(ctx);
const domainInput = httpToDomainPostCreate(body as PostCreateHttp);
const result = await postService.create(actor, domainInput);
```

Any caller holding `POST_CREATE`/`EVENT_CREATE` can attribute content to an
arbitrary user UUID. The update/patch mappers pass `authorId` through as well
(`post.http.schema.ts:372`, `event.http.schema.ts:345`), so authorship can also
be **reassigned** on existing content.

### 2.3 `EDITOR` is a shared editorial team, not an author

`checkCanUpdateEvent` (`event.permissions.ts:26-31`) does not merely skip the
ownership comparison — **its signature never receives the event**:

```ts
export function checkCanUpdateEvent(actor: Actor): void {
    if (!actor) throw ...
    if (!actor.permissions?.includes(PermissionEnum.EVENT_UPDATE)) throw ...
}
```

There is no `EVENT_UPDATE_OWN`/`EVENT_UPDATE_ANY` split in the permission enum —
`EVENT_UPDATE` is flat.

`checkCanUpdatePost` (`post.permissions.ts:30-37`) *does* receive the post and
compare `actor.id === post.authorId`, but only as an **OR fallback** after an
unconditional `POST_UPDATE` branch. Since `EDITOR` holds flat `POST_UPDATE`, the
first branch always short-circuits and ownership is never consulted.

Net effect is identical for both entities: **any editor can edit any other
editor's content.** The issue's framing is correct — "only sees and edits their
own" is a *new and stricter* model, not a bug fix.

`EDITOR` also holds `POST_VIEW_ALL` and `EVENT_VIEW_ALL`
(`packages/seed/src/required/rolePermissions.seed.ts:828,849`). These are
**deliberate**, with inline comments citing a SPEC-169 audit verdict: "EDITOR
sees ALL editorial content (posts + events, including private) by design"
(`rolePermissions.seed.ts:822-828, 843-849`). Narrowing them reverses a previous
explicit decision — see OQ-2.

### 2.4 Two live production bugs on the routes this feature depends on

Both are shipped today and independent of this feature's UI.

**(a) Every protected event write returns 500.** `PUT`/`PATCH`/`DELETE
/api/v1/protected/events/:id` are configured with
`ownership: { entityType: 'event', ownershipFields: ['createdById'],
bypassPermission: EVENT_UPDATE }`
(`apps/api/src/routes/event/protected/update.ts:36-40`, and the patch/softDelete
twins). But `registerEntityFetcher` is called for `'accommodation'` **only**
(`apps/api/src/utils/entity-fetchers.ts:18` — verified as the sole call site in
`apps/api/src`). With no fetcher registered, the middleware throws before any
permission logic runs (`apps/api/src/middlewares/ownership.ts:158-165`):

```ts
const fetcher = entityFetchers.get(entityType);
if (!fetcher) {
    apiLogger.error(`No entity fetcher registered for: ${entityType}`);
    throw new HTTPException(500, { message: 'Internal server error: Entity type not configured' });
}
```

No test in the repo exercises this path. Note also that the ownership field
configured is `createdById`, **not** `authorId` — see OQ-4.

**(b) Every protected media upload for a post or event returns 403.**
`apps/api/src/routes/media/protected/upload-entity.ts:249-250` casts every
entity to `{ ownerId?: string | null }` and rejects on falsy `ownerId`:

```ts
const entity = entityResult.data as { ownerId?: string | null };
if (!entity.ownerId || entity.ownerId !== actor.id) { ... 403 ... }
```

`ownerId` does not exist on either entity — verified: zero occurrences in
`post.dbschema.ts` and `event.dbschema.ts`, which carry `authorId`
(`post.dbschema.ts:43`, `event.dbschema.ts:41`). So `!entity.ownerId` is always
true and the route 403s for everyone, including the true author and
`SUPER_ADMIN`.

This is the exact route `/mi-cuenta` uploads call
(`apps/web/src/lib/media/upload-entity.ts:117`). The parallel **admin** upload
route already handles post/event correctly, via flat `EVENT_UPDATE`/`POST_UPDATE`
with no `ownerId` dependency (`apps/api/src/routes/media/admin/permissions.ts:30-42`).
So the fix is not "add `ownerId` to posts/events" — it is to authorize by
author + permission on the protected route, mirroring the admin route's shape.

### 2.5 The admin surface grows on its own

`ACCESS_PANEL_ADMIN` is the sole permission gate on the admin UI shell
(`apps/admin/src/lib/authed-guard.ts:143`). Four roles hold it today, verified:
`SUPER_ADMIN` (`rolePermissions.seed.ts:214`), `ADMIN` (`:608`),
`CLIENT_MANAGER` (`:796`), `EDITOR` (`:885`). `HOST` and `COMMERCE_OWNER`
correctly do not — HOS-152 removed them, and the seed comments explain why
(`:1009-1011`, `:1092-1094`).

Constraining a surface that large by permissions means every new feature added
there is one more thing someone must remember to block for an external
collaborator. That risk grows by itself. Authoring from the web means an editor
sees only their own content **by construction**.

**A second gate exists and the issue does not mention it.** The API's admin tier
accepts either permission, not just the panel one
(`apps/api/src/middlewares/authorization.ts:22-25`):

```ts
const ADMIN_ACCESS_PERMISSIONS: PermissionEnum[] = [
    PermissionEnum.ACCESS_PANEL_ADMIN,
    PermissionEnum.ACCESS_API_ADMIN
];
```

Stripping only `ACCESS_PANEL_ADMIN` would block the admin **UI** while leaving
`EDITOR` able to call every `/api/v1/admin/*` route directly. Both must go — see
§4, D-1.

## 3. Scope

### 3.1 In scope

- A publication gate for posts and events, honored on **every** public read path
  (list/search included, not only single-item reads).
- A per-user "trusted editor" flag that makes an editor's content born approved.
- `authorId` forced to `actor.id` server-side and removed from the create schema.
- Author-scoped ownership for posts and events on the protected write path.
- Fixing both production bugs in §2.4 — they block Phase 2 outright.
- Post and event editors under `/mi-cuenta`, plus their list pages.
- Removing `ACCESS_PANEL_ADMIN` + `ACCESS_API_ADMIN` from `EDITOR` and
  `CLIENT_MANAGER`, in seed **and** a numbered data migration.
- `discovery-doors.ts` flip, including the `manageHref` the option currently
  lacks.

### 3.2 Out of scope (non-goals)

- **NG-1 — A moderation queue UI in the admin panel.** The gate must be
  enforceable and an admin must be able to approve, but building a dedicated
  review inbox is follow-up work. The existing admin `PATCH` route already
  writes `moderationState` (`apps/api/src/routes/post/admin/patch.ts:25`,
  `event/admin/patch.ts:30`).
- **NG-2 — Reworking media into a relational table for posts/events.** They stay
  on the JSONB `media` column (§5.3.4). Porting them to the relational model is
  a separate spec, comparable to HOS-372 for commerce.
- **NG-3 — Activating `CLIENT_MANAGER`.** Its panel access is removed only
  because the role is unused today (the seed itself says so at
  `rolePermissions.seed.ts:751-757`). If it is activated later and needs the
  panel, it gets it back then.
- **NG-4 — Reusing `PhotoSection`, `PlanEntitlementGate`, `AiTextImprovePanel`.**
  The first is structurally incompatible (§5.3.4); the latter two are billing
  surfaces that do not apply to `EDITOR`.
- **NG-5 — A general fix for the enforced-server-side `*_MODERATION_CHANGE`
  permissions.** `POST_MODERATION_CHANGE`/`EVENT_MODERATION_CHANGE` exist
  (`packages/schemas/src/enums/permission.enum.ts:215,240`) but are consumed
  only by an admin UI column gate
  (`apps/admin/src/features/posts/config/posts.columns.ts:260`), never enforced
  server-side. Wiring them properly is noted as a follow-up, not done here.

## 4. Decisions already made (owner, 2026-08-02)

- **D-1 — Panel access ends at `SUPER_ADMIN` and `ADMIN`.** Removed from
  `EDITOR` and `CLIENT_MANAGER`. *Extended by this spec's findings:*
  `ACCESS_API_ADMIN` is removed alongside `ACCESS_PANEL_ADMIN`, because the API
  admin tier accepts either one (§2.5). Removing only the panel permission would
  leave the admin API wide open to those roles.
- **D-2 — `authorId` is forced to `actor.id` server-side and leaves the create
  schema.** Not "ignored if supplied" — no longer accepted. An editor cannot sign
  as someone else, by accident or on purpose.
- **D-3 — Phase 3 ships with Phase 2, never before.** An editor stripped of the
  panel before the web editor exists has no tool at all.
- **D-4 — The permission removal needs a data migration.** Editing the seed only
  fixes fresh databases; staging and prod need a numbered migration, per the
  dual-write rule.

## 5. Design

### 5.1 Phase 1 — Close the write path

#### 5.1.1 The publication gate

Two independent conditions decide whether content is publicly readable:
`visibility` and `moderationState`. Today neither is enforced on list/search.

- Public read paths (list/search **and** single-item) must exclude anything
  that is not `visibility = PUBLIC AND moderationState = APPROVED`, with the
  same force-override shape reviews already use — injected server-side, never a
  client-supplied filter.
- Enforcement belongs in the service layer (`_beforeSearch` / the `_canView`
  hook), not in the route handlers, so no future route can forget it.
- An actor holding the relevant `*_VIEW_ALL`/`*_VIEW_PRIVATE`/`*_VIEW_DRAFT`
  permission, or the content's own author, still sees their own non-approved
  content — otherwise an editor could not review their own draft.
- `httpToDomain*Create` stops hardcoding `visibility: PUBLIC`. New content is
  created non-public and `PENDING`, except as overridden by the trusted-editor
  flag (§5.1.2).

Because a static guard is cheaper than remembering, this phase adds a guard test
asserting that no public post/event read path can be reached without the
moderation predicate — the "N call sites forgot the gate" class of problem is
better solved by one guard than by N tests.

#### 5.1.2 The trusted-editor flag

A per-user flag that, when an admin enables it, makes that editor's content born
`APPROVED` and publicly visible immediately.

There is no precedent for a "trust" flag on users; the closest in shape is
`users.serviceSuspended`. Placement is **OQ-1** — it is the one design decision
in this phase that materially changes the data model.

Whatever the placement, the resolution happens **server-side at creation time**,
never client-supplied, in the same place `authorId` is forced.

#### 5.1.3 `authorId`

- Removed from `PostCreateHttpSchema` and `EventCreateHttpSchema`.
- Set to `actor.id` in the handler (or the mapper, given the actor), for both
  create and update.
- On update, `authorId` becomes non-assignable — the mappers stop passing it
  through, closing the reassignment path in §2.2.

#### 5.1.4 Author-scoped ownership

`checkCanUpdateEvent` must take the event, as its post twin already does, and
both must compare against the author. The flat `POST_UPDATE`/`EVENT_UPDATE`
bypass has to stop short-circuiting for `EDITOR` — see OQ-2 for whether that is
achieved by narrowing the role's permissions or by introducing `_OWN`/`_ANY`
variants.

Posts and events currently use **two different authorization patterns**: posts
gate on a flat permission at the route middleware with no ownership fallback,
events use `ownershipMiddleware`. That inconsistency must be resolved rather than
preserved, because an editor needs the same guarantees on both.

Note that `EDITOR` holds neither `POST_DELETE` nor `EVENT_DELETE` in the seed —
see OQ-3.

#### 5.1.5 The two production bugs

- **Event fetcher.** Register an `'event'` entity fetcher in
  `apps/api/src/utils/entity-fetchers.ts`, alongside the existing
  `'accommodation'` one. Add a regression test hitting a protected event write
  and asserting it is not a 500 — the current absence of any such test is why
  this shipped.
- **Media upload.** Replace the `ownerId` cast in
  `media/protected/upload-entity.ts` with per-entity-type authorization: author
  comparison for posts/events, existing `ownerId` behavior preserved for the
  entity types that actually have it. The admin route's mapping
  (`media/admin/permissions.ts:30-42`) is the reference.
- While here, check `delete-entity.ts:350`, whose admin bypass reads
  `ACCOMMODATION_UPDATE_ANY` — accommodation-specific, so it would never grant an
  editor a bypass for post/event deletes either. It surfaces as soon as upload
  is fixed.

Both bugs are pre-existing and independently shippable. They may go out as their
own PR ahead of the rest of Phase 1 (no magic word).

### 5.2 Phase 2 — The editor in `/mi-cuenta`

#### 5.2.1 Mold

Build from `apps/web/src/components/host/editor/` with
`apps/web/src/components/host/AccommodationEditor.client.tsx` as the
orchestrator reference. It is the only editor with a complete, working four-piece
wiring: `RichTextEditor`, `EditorSectionNav`, `ActionBar`, `useZodForm`.

`RichTextEditor` (TipTap) and `useZodForm` are fully generic and already proven
cross-domain — commerce imports `RichTextEditor` straight from `host/editor/`.
`EditorSectionNav` and `ActionBar` are generic but currently have **exactly one
consumer each** (the accommodation editor).

Borrow the *file layout* from `apps/web/src/components/commerce/editor/`
(HOS-258/HOS-371), which is newer and shows how to decompose into per-section
files. Do **not** copy commerce's omission of the nav and action bar: that gap is
a known blocker (`AccountSectionCard`'s `overflow: hidden` voids
`position: sticky` on a descendant nav), not an improvement.

#### 5.2.2 Pages

Following the existing convention
(`.../mi-cuenta/propiedades/index.astro`, `.../propiedades/[id]/editar.astro`):

- `apps/web/src/pages/[lang]/mi-cuenta/publicaciones/index.astro` + `[id]/editar.astro`
- `apps/web/src/pages/[lang]/mi-cuenta/eventos/index.astro` + `[id]/editar.astro`
- Create pages following the commerce `nuevo/` shape, redirecting to the editor
  on success (`CommerceCreateForm.client.tsx:187-192` is the pattern).

**No route-guard registration is needed.** `PROTECTED_SEGMENTS = ['mi-cuenta']`
(`apps/web/src/lib/routes.ts:13`) is matched on the whole second segment, so
everything under `/mi-cuenta/*` is already protected.
`SESSION_OPTIONAL_SEGMENTS` is unrelated — it lists public top-level segments.

The list pages must show **only the acting editor's own content**, which is a
server-side filter, not a UI concern.

#### 5.2.3 API calls

`apiClient.patch(...)` / `apiClient.postProtected(...)` from
`apps/web/src/lib/api/client.ts`, with endpoints added to
`endpoints-protected.ts` following `accommodationEditApi`
(`endpoints-protected.ts:2508-2519`). SSR reads forward the cookie header
explicitly; browser calls rely on `withCredentials`. Errors resolve to
`{ok:false, error}` and are surfaced with `handleApiError` + toast, as both
existing editors do.

This is `apps/web`'s **first** consumption of `protected/posts` and
`protected/events` — verified, no current call sites.

#### 5.2.4 Media

Posts and events keep media in a JSONB `media` column
(`post.dbschema.ts:42`, `event.dbschema.ts:38`) shaped
`{featuredImage?, gallery?, videos?, archivedGallery?}`
(`packages/schemas/src/common/media.schema.ts:104-129`). Accommodations use the
relational `accommodation_media` table.

`PhotoSection.client.tsx` cannot be reused. It is built entirely around the
relational model: it hydrates from `accommodationMediaApi.listMedia`, performs an
immediate API call per add/remove/feature rather than buffering into the form's
PATCH diff, addresses individual photos by server-issued row UUID, and relies on
a DB-enforced single-featured-row invariant.

None of those exist for a JSONB blob. The posts/events media section buffers into
form state and ships the whole `media` object on save, keying by array index or
`publicId` rather than a row id. Gallery caps already exist in code —
`post: 15`, `event: 10`
(`packages/schemas/src/common/media-upload.schema.ts:32-39`).

Media upload depends on §5.1.5(b) being fixed first.

### 5.3 Phase 3 — Cut panel access

#### 5.3.1 Seed

Remove `ACCESS_PANEL_ADMIN` and `ACCESS_API_ADMIN` from `EDITOR`
(`rolePermissions.seed.ts:885-886`) and `CLIENT_MANAGER` (`:796-797`).

The seed's own regression test hardcodes the staff allow-list as
`['SUPER_ADMIN', 'ADMIN', 'EDITOR', 'CLIENT_MANAGER']`
(`packages/seed/test/required/rolePermissions.seed.test.ts:458-473`) and will
fail CI until updated — that is the test doing its job, and its update is part
of this phase.

#### 5.3.2 Data migration

`packages/seed/src/data-migrations/0035-<slug>.ts`, modeled directly on
`0010-remove-panel-admin-from-host-commerce-owner.ts` (HOS-152's equivalent):
JSDoc rationale block, `meta` with `destructive: true`, a constant listing the
roles and permissions to strip, and a `hardDelete` loop through
`RRolePermissionModel` with a `{ role, permission }` where-object (composite PK,
so `ctx.helpers.safeDelete` does not apply). Deleting zero matching rows returns
`0` without throwing, so it is idempotent.

Highest existing migration is `0034-hos-372-commerce-media-to-relational.ts`, so
`0035` is the next number — reconfirm at implementation time.

#### 5.3.3 Discovery doors

`apps/web/src/config/discovery-doors.ts:223-236` — the `editor` option inside the
`partner` door carries `managesInAdminPanel: true`, and its comment describes
exactly the state being reverted.

`DiscoveryDoorHub.astro:61-66` links `getAdminUrl()` when an acquired option has
that flag, and a locale-relative `manageHref ?? door.href` otherwise. The
`editor` option has **no `manageHref` today**, so removing the flag is not
sufficient — a `manageHref` must be added, pointing at the new list page (or a
small hub, if posts and events get separate entries — OQ-5).

## 6. Testing

- Unit: the moderation predicate, the `authorId` forcing, author-scoped
  ownership for both entities, trusted-flag resolution at creation.
- Regression, mandatory (both reproduce a shipped bug before its fix): a
  protected event write that must not 500, and a post/event media upload that
  must not 403 for the author.
- Guard: no public post/event read path reachable without the moderation
  predicate (§5.1.1).
- Seed: the staff allow-list test updated; a data-migration test asserting
  idempotency.
- E2E: an editor authors a post, sees it non-public, an admin approves it, it
  becomes public. And: an editor cannot see or edit another editor's content.
- Manual: `status-needs-smoke-local` at minimum. An editor's loss of panel access
  is a live-permissions change, so `status-needs-smoke-staging` is warranted for
  Phase 3.

## 7. Open questions (owner)

- **OQ-1 — Where does the trusted-editor flag live?** A boolean column on
  `users` (shaped like `users.serviceSuspended`), a dedicated permission, or a
  row in a settings table. Changes the data model and the admin UI needed to
  toggle it.
- **OQ-2 — What happens to `POST_VIEW_ALL` / `EVENT_VIEW_ALL` on `EDITOR`?**
  They were granted deliberately per SPEC-169 ("EDITOR sees ALL editorial
  content... by design"). "Only sees their own" contradicts that. Either narrow
  the role's permissions (reversing SPEC-169) or introduce `_OWN`/`_ANY`
  variants and keep viewing broad while scoping *writing*.
- **OQ-3 — Can an editor delete their own content?** `EDITOR` holds neither
  `POST_DELETE` nor `EVENT_DELETE` today. If yes, the permission must be granted
  in the same seed change and scoped to own content.
- **OQ-4 — `authorId` or `createdById` as the ownership field?** The event
  protected routes are configured on `createdById`
  (`event/protected/update.ts:38`); this spec's model is authorship. They
  coincide when the author creates their own content and diverge when staff
  creates on someone's behalf.
- **OQ-5 — One door entry or two?** Posts and events are folded into a single
  `editor` option today. Separate `manageHref` targets imply either two entries
  or a small hub page.

## 8. Risks

- **The publication gate changes public read behavior for all existing content.**
  Every post and event in staging/prod is currently `PENDING` (the create mapper
  has always written it). Enforcing `moderationState = APPROVED` on public reads
  would **hide the entire existing catalog** the moment it ships. A backfill
  marking existing content `APPROVED` is mandatory and must land in the same
  release — this is the highest-risk item in the spec and belongs in the same
  data migration as, or immediately adjacent to, the gate.
- Narrowing `EDITOR` (OQ-2) reverses a documented prior decision; if any current
  workflow depends on cross-editor editing, it breaks.
- Phase 3 shipping early strands active editors (mitigated by D-3).
- The two production bugs mean the protected surface has never been exercised;
  expect further defects once traffic actually reaches it.
