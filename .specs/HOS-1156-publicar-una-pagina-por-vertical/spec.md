---
title: One publish page per vertical — the navbar "Publicar" button leads to publishing, not selling
linear: HOS-1156
statusSource: linear
created: 2026-09-04
type: feature
areas:
  - web
  - api
  - billing
---

# One publish page per vertical

## 1. Summary

The header's "Publicar" dropdown sends two of its three verticals to a **sales**
page instead of a publish flow. This spec replaces the split funnel/form pair
with **one page per vertical** that merges both, and extends BETA-197's
publish precheck — today an accommodation-only guard — to gastronomy and
experiences.

Three pages ship:

```
/{lang}/publicar/                 → accommodation (absorbs /publicar/ + /publicar/nueva/)
/{lang}/publicar/gastronomia/     → gastronomy
/{lang}/publicar/experiencias/    → experiences
```

Each carries its own copy. They share the visual mould and nothing else.

## 2. Problem

### 2.1 What the menu does today

`PUBLISH_CTA_OPTIONS` (`apps/web/src/config/discovery-doors.ts`) routes each
vertical somewhere different:

| Option | Destination on `origin/staging` | What that is |
| -- | -- | -- |
| Alojamiento | `publicar` | Publish funnel |
| Gastronomía | `planes/gastronomia` | **Sales** page |
| Experiencias | `planes/experiencias` | **Sales** page |

Clicks to reach a form, measured against `https://staging.hospeda.com.ar`:
accommodation **2**, gastronomy **3**. Production still serves the three old
landings at 200 and 404s `/es/planes/*`, so none of this is visible to users yet.

### 2.2 How it got here

Not billing/trial residue. HOS-1032 (H7), PR #3195, commit `4d7e448ea`
*"repoint every link that now aimed at a redirect"*: `/publicar-restaurante/`
and `/publicar-experiencia/` became 301s, so the commit repointed all 18 call
sites at the 301's target. One of those call sites was the menu, and the
target was a sales page. The repoint was mechanically correct and produced a
"Publicar" button that no longer leads to publishing.

Same commit emptied `publicar-restaurante/index.astro` and
`publicar-experiencia/index.astro` (714 and 719 lines → a single
`Astro.redirect(…, 301)`). **Commerce lost its publish funnel entirely**; only
the sales page remains.

|  | Funnel | Form | Sales |
| -- | -- | -- | -- |
| Accommodation | `/publicar/` (SSR, reads session) | `/publicar/nueva/` | `/planes/anfitriones/` |
| Gastronomy | **none** | `/mi-cuenta/comercio/nuevo/gastronomy/` | `/planes/gastronomia/` |
| Experiences | **none** | `/mi-cuenta/comercio/nuevo/experience/` | `/planes/experiencias/` |

### 2.3 What the precheck costs today

BETA-197's precheck exists only for accommodation. Without it in commerce, an
owner at their listing cap **fills the whole form** and eats a 403
`LIMIT_REACHED` on submit; an owner with a half-finished listing starts a
second one from scratch with no warning.

## 3. Findings that amend the issue

Measured against this worktree at `36b821e0a` on 2026-09-04. Each of these
contradicts or materially qualifies a statement in the Linear issue, and each
changes the work.

### F-1 · Commerce drafts are NOT readable from the existing endpoint

The issue states that "a half-finished listing is a query, not a new concept",
citing `apps/web/src/lib/commerce/owner-listings.ts`. The row does carry
`lifecycleState: DRAFT`, but **`CommerceOwnerListingSummarySchema`
(`packages/schemas/src/common/commerce-owner-listing.schema.ts`) does not expose
it**. The summary returned by `GET /{vertical}/mine` carries `id`, `vertical`,
`name`, `slug`, `type` and `isPublic` — and nothing else.

`isPublic: false` is **not** equivalent to `DRAFT`. A complete listing awaiting
checkout is also non-public. Deriving "half-finished" from the web would take
`fetchOwnerCommerceListingsWithState`, which costs one extra detail fetch per
listing.

**Consequence**: the commerce precheck resolves **server-side**, exactly as
`precheck.ts` already does for accommodation (it queries `AccommodationService`
directly rather than reading a public projection). This is not a deviation from
the issue's plan — it is what "the new route that crosses them" has to mean.

### F-2 · The precheck panel is accommodation-bound in five places

`PublishPrecheckPanel.astro` is a good mould, not a reusable component. It is
tied to accommodation at:

1. `resolvePrecheckPanelContent` (`apps/web/src/lib/host/publish-precheck-panel-content.ts`)
   resolves the add-on offer from a hardcoded `max_accommodations` — **by
   design**: its JSDoc states the caller "must not get to decide WHICH add-on
   this panel points at".
2. i18n keys under `host.pages.nueva.precheck.*` and `host.properties.card.*`.
3. `accountPropertiesUrl` — "Mis propiedades".
4. The delete action soft-deletes an accommodation via the host `DeleteButton`.
5. `OnboardingPrecheckDraftSchema` types its id with `AccommodationIdSchema`.

Point 1 is the load-bearing one: the panel deliberately refuses to take the
limit key from its caller. Generalising it means changing that contract on
purpose, not passing one more prop.

### F-3 · Editing `PUBLISH_CTA_OPTIONS` moves three surfaces, not one

`PUBLISH_CTA_OPTIONS` is a live view of the `listing` door inside
`ACCOUNT_DISCOVERY_DOORS`. Changing an option's `href` changes:

- the header dropdown (`PublishMenu.client.tsx`),
- the mobile menu (`MobileMenu.cta.test.tsx` asserts on it),
- the authenticated hub `/mi-cuenta/publica`, which iterates the same door.

For the hub the new destination is also correct (it leads to the form), so no
branch is needed — but the change must be verified on all three, and the
`manageHref` / `acquiredPermission` fields stay untouched.

### F-4 · The commerce form has more entry points than the issue lists

Beyond the menu: `mi-cuenta/comercio/nuevo/index.astro` (a vertical picker),
`mi-cuenta/comercio/index.astro:116` (`createUrl`), and
`buildCommerceStartUrl` (`apps/web/src/lib/commerce/start-url.ts`), which is
also what `resolveSafeReturnPath` carries through sign-in.

### F-5 · `/publicar/` already makes two SSR fetches

Owned-accommodation count (for the D-3 redirect) and trial status. Adding the
precheck makes three on one request. Two of them answer overlapping questions —
the precheck already returns `currentCount`.

## 4. Scope

**In scope**: the three pages; the precheck extended to all three verticals
(one API route, one shared panel); `PUBLISH_CTA_OPTIONS` repointed; the
commerce form moved out of `AccountLayout`; the signed-out CTA (D-1); removal
of the `/publicar/` existing-host redirect (D-3).

**Out of scope**: the sales pages themselves (`/planes/*`), pricing copy,
checkout, and the commerce tier picker (HOS-1119). This spec links to those
pages; it does not change them.

## 5. Decisions already taken (owner, 2026-09-04)

**D-1 · A signed-out visitor sees the whole page.** In the form's place, a
"Creá tu cuenta y publicá" CTA linking to signup with a `returnUrl` back to
this same page. **Never** a redirect to login: this is a public navbar button,
and both form pages today call `buildLoginRedirect` in their frontmatter, which
would drop a cold visitor onto a login screen before they read anything.

**D-2 · The commerce form leaves `AccountLayout`.** It moves to
`MarketingLayout`, the layout accommodation already uses, so the three pages
look alike. The island does not depend on the layout.

**D-3 · The `/publicar/` → `/mi-cuenta/propiedades/` redirect is removed.**
With the form on `/publicar/`, that redirect would block creating a second
property from the menu. BETA-197's precheck covers the case better.

**D-4 · The precheck applies to all three verticals**, with one matrix:

|  | Has quota | At cap |
| -- | -- | -- |
| No drafts | `create_direct` → the form | `upgrade_only` |
| One draft | `resume_or_create` | `resume_delete_or_upgrade` |
| Several drafts | `pick_draft_or_create` | `pick_draft_delete_or_upgrade` |

**D-5 · The fail-open is preserved verbatim.** On any precheck failure the
decision falls back to `create_direct` and the form renders — the real cap is
enforced by the create endpoint server-side. A transient failure never lets
anyone past the limit; it only shows a form where a dialog would have been
kinder.

**D-6 · Every superseded URL 301s to its new page (owner, 2026-09-04).** One
form, one URL. Four redirects:

| From | To | Note |
| -- | -- | -- |
| `/{lang}/publicar-restaurante/` | `/{lang}/publicar/gastronomia/` | Repointed off the sales page |
| `/{lang}/publicar-experiencia/` | `/{lang}/publicar/experiencias/` | Repointed off the sales page |
| `/{lang}/mi-cuenta/comercio/nuevo/` | `/{lang}/publicar/` | The vertical picker; the new pages are the picker |
| `/{lang}/mi-cuenta/comercio/nuevo/{vertical}/` | `/{lang}/publicar/{vertical}/` | Per-vertical form |
| `/{lang}/publicar/nueva/` | `/{lang}/publicar/` | Absorbed |

This **overrides HOS-941 D-8** for the first two. That decision reasoned that
"its successor by content is the sales page", which was correct while no
publish page existed for those verticals. One does now, and it carries the
argument *and* the form — a superset of what the sales page offers an arriving
visitor. The URL's own name said *publicar*; it finally leads there.

**D-7 · One vertical-parameterised precheck route**, not three. The matrix is
identical across verticals (D-4); only the limit key and the draft query
differ. The vertical is validated against a closed union, so a fourth vertical
is a compile error rather than an ungated form.

## 6. Page structure

Top to bottom, per vertical:

1. Short hero: tagline, title, one paragraph.
2. **The form** (form-first), or its substitute per visitor state.
3. "Cómo funciona" in 3 steps + condensed benefits.
4. Links to decide: `/planes/<audience>/` and `/planes/<audience>/precios/`.

The slot at (2) resolves in this order:

| Visitor state | What renders at (2) |
| -- | -- |
| No session | Signup CTA with `returnUrl` to this page (D-1) |
| Session, `create_direct` | The vertical's create form island |
| Session, any other decision | The precheck panel |

## 7. Acceptance criteria

### 7.1 Routing and the menu

- **AC-1** — `PUBLISH_CTA_OPTIONS` points accommodation at `publicar`,
  gastronomy at `publicar/gastronomia`, experiences at `publicar/experiencias`.
- **AC-2** — The three destinations answer **200** for a signed-out visitor in
  all three locales, verified with `curl` against a running server, not only by
  typecheck. No page in this spec may link to a route that does not serve.
- **AC-3** — The header dropdown, the mobile menu and `/mi-cuenta/publica` all
  render the new hrefs (F-3), and `manageHref` / `acquiredPermission` are
  unchanged on every option.

### 7.2 Redirects (D-6)

- **AC-17** — All five superseded URLs answer **301** to the destination in
  D-6's table, in all three locales, verified with `curl -I` against a running
  server. A redirect asserted only by reading the `.astro` source is not
  verified: a page can typecheck and still answer 500.
- **AC-18** — **No source file links to a superseded URL any more.** Every call
  site is repointed at the new page in this same change, including
  `buildCommerceStartUrl` (`apps/web/src/lib/commerce/start-url.ts`),
  `mi-cuenta/comercio/index.astro`'s `createUrl`, the `/publicar/nueva/`
  breadcrumb, `HostLandingCta`, and "Publicar otra" on
  `/mi-cuenta/propiedades/`. A static guard asserts the absence, so a sixth
  call site added later fails CI instead of silently riding a 301.
- **AC-19** — A visitor who signs up from a publish page lands back on that
  page, not on a redirect: `resolveSafeReturnPath` receives the new URL,
  asserted for both commerce verticals.

### 7.3 The pages

- **AC-4** — Each page renders all four sections of §6 for a signed-out
  visitor, including the links at (4).
- **AC-5** — Signed out, the form slot renders the signup CTA whose `returnUrl`
  resolves back to the same page, and the page returns 200 — never a 302 to
  login (D-1).
- **AC-6** — The two commerce pages render inside `MarketingLayout` with no
  account sidebar (D-2).
- **AC-7** — `/publicar/` no longer redirects an owner with ≥1 accommodation
  (D-3); it serves the page with the precheck applied.
- **AC-8** — All three pages declare `prerender = false` and are absent from
  every cacheable-route list, so reading the session stays legal
  (`cacheable-routes-parse-no-session.guard.test.ts` still passes).

### 7.4 The precheck

- **AC-9** — A protected API route returns, for a given vertical, the same
  shape the accommodation precheck returns today: `currentCount`, `maxAllowed`,
  `hasQuota`, `draftCount`, `drafts[]`, `decision`.
- **AC-10** — Commerce quota resolves **per vertical**, through
  `LIMIT_KEY_BY_COMMERCE_VERTICAL`, never per account. An owner at their
  gastronomy cap with experience quota free gets `upgrade_only` for gastronomy
  and `create_direct` for experiences on the same request.
- **AC-11** — All six matrix cells of D-4 are reachable and asserted per
  vertical.
- **AC-12** — The fail-open holds: with the precheck route erroring, each page
  renders its form and the create endpoint still answers 403 `LIMIT_REACHED`
  for an owner at cap (D-5).
- **AC-13** — The panel's add-on offer resolves from the vertical's own limit
  key, and shows nothing when that limit is not sellable (the existing
  behaviour of `resolveLimitAddonOffer`, preserved per vertical — F-2).
- **AC-14** — The delete-draft action deletes a draft **of the vertical being
  published**, and after deletion the reloaded page derives `create_direct`.

### 7.5 Copy and i18n

- **AC-15** — Every user-facing string goes through `t()`. No page shares copy
  with another vertical except by deliberate key reuse.
- **AC-16** — Keys exist in `es`, `en` and `pt`. Note the standing caveat:
  the i18n guards check structure, never content — presence is not translation.

## 8. Open questions

All four opened by this spec were resolved by the owner on 2026-09-04 and moved
into §5 as **D-6** (the five redirects) and **D-7** (one parameterised precheck
route). None remain open.

Two consequences of D-6 that the acceptance criteria carry:

- Every inbound link to a superseded URL must be repointed in the same change,
  **not** left to ride the 301 — that is the exact failure mode that produced
  this issue (`4d7e448ea` repointed 18 call sites at a 301 whose target had
  changed meaning). A link to a redirect is a link whose destination someone
  else can move.
- `buildCommerceStartUrl` (`apps/web/src/lib/commerce/start-url.ts`) is one of
  those call sites, and it is also what `resolveSafeReturnPath` carries through
  sign-in. A stale value there sends a visitor who just created an account to a
  redirect instead of the form they asked for.

## 9. Risks

- **R-1 · Do not resolve this in the Header by computing the `href` from the
  session.** `PublishMenu.client.tsx`'s JSDoc records that the entitlements
  fetch was removed from the Header deliberately; a personalised href travels
  inside every cached page and is served to the next visitor.
  `cacheable-routes-parse-no-session.guard.test.ts` (HOS-690 AC-37) fails the
  build if this regresses. The new pages *may* read session — they are not
  cached.
- **R-2 · Generalising the panel touches a live accommodation flow.** BETA-197
  is in production for accommodation. Any change to
  `publish-precheck-panel-content.ts` must leave the accommodation path
  behaving identically, asserted by its existing tests before the commerce path
  is added.
- **R-3 · Three SSR fetches on `/publicar/`** (F-5). The precheck already
  returns `currentCount`; the owned-count fetch that fed the removed D-3
  redirect should go with it rather than being left as a third round trip.
- **R-4 · Frozen counts and inventories.** A new page under `src/pages` trips
  route inventories, the CSP verifier and the a11y sweep. Run the repo guards
  before opening the PR, not after CI.

## 10. Test plan

- **Unit** — the decision matrix per vertical (six cells × three verticals);
  the limit-key resolution; the panel content resolver for a commerce limit.
- **Component** — the form slot's three states (signed out / `create_direct` /
  panel) asserted on rendered output, not on the source string.
- **Static guards** — the three pages absent from the cacheable lists; every
  `PUBLISH_CTA_OPTIONS` href resolving to a route that exists.
- **Live** — `curl` each of the three pages, signed out, in `es`/`en`/`pt`
  (AC-2). A page that typechecks can still answer 500: `astro check` does not
  see frontmatter behind an early `return`.
- **Manual** — this touches the billing surface (limits, entitlements, the
  add-on offer), so the relevant sections of the staging smoke checklist apply
  before merge, and the issue carries the matching `status-needs-smoke-*` label.
