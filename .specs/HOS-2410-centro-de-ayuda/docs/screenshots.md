# HOS-2410: screenshots (D-H10)

The owner decided on 2026-11-20 that articles carry screenshots to help owners tell
things apart and understand them. Screenshots go stale faster than text, so they
are generated and guarded rather than taken by hand (D-H10, option 2).

**Status:** design approved, including the storage location (in the repo, §6).

## 1. Declaring a shot (frontmatter)

```yaml
shots:
  - id: carta-bloqueada          # unique within the article; kebab-case
    page: section:venue.carta    # an Anchor (data-model.md §2.2), page: or section:
    user: host-venue             # a seeded test user slug (<slug>@local.test)
    fixture: venue-menu-locked   # a named state fixture (§3); optional
    viewport: desktop            # desktop | mobile; default desktop
    callouts:                    # ordered; rendered as numbered markers 1..n
      - section:venue.carta#save-disabled
      - section:venue.carta#clear
    alt: Carta con candado, con el botón Guardar deshabilitado
```

- `alt` is required. It is the text that the MCP, screen readers and the public renderer
  use. Guard (d) applies to it, so it may contain no literal values.
- A shot is placed in the body with `{{shot:<id>}}`. Guard (a) fails on a token whose
  id the article does not declare, and on a declared shot that no token places.
- Callout targets are anchors with an optional `#element` suffix. They resolve to a
  `data-help` attribute (§2).

## 2. `data-help` attributes

The UI marks the elements that help points at:
`data-help="section:venue.carta"` on the section root, and
`data-help="section:venue.carta#save-disabled"` on a specific control.

- The values reuse the anchor grammar, so the same string links an article to the
  code, the screen and the image.
- Attributes are added only where a shot or a «?» button needs them. They are not
  added across the whole UI.
- **Dependency on epic HOS-2409 (Mi Cuenta redesign).** The owner approved on
  2026-11-20 that the epic applies this convention as an acceptance criterion. It
  covers the kit (phase 2, HOS-2413), the pages (phase 3, HOS-2414) and the
  editors with their per-vertical fusions (phase 4, HOS-2415: HOS-2499, HOS-2497,
  HOS-2496). The convention belongs to this spec; the epic only applies it.
  Screens the epic rebuilds therefore arrive already marked, and PR-15 marks only
  what the epic does not touch. If a fusion changes a section slug, the epic
  reports it on its issue.
- A web unit test lists every `data-help` value in `apps/web/src` and checks that its
  anchor part resolves (the same resolver guard (a) uses).

## 3. State fixtures

Many shots need a state the default seed does not have. Examples: a locked
section, a subscription in `GRACE_PERIOD`, an archived listing, a pending benefit
usage. Since HOS-1416 the dev test users have no billing state.

- Fixtures live in `packages/help/shots/fixtures/<name>.ts`. Each one exports
  `apply({ db, userSlug })` and `revert(...)`. They run against the worktree's own
  DB, never a shared one. CLAUDE.md warns against shared DBs ("NUNCA corras
  db:fresh-dev dentro de un worktree", and the API integration DB has a fixed name).
- Billing states are written directly to the singular tables (`subscription`,
  `trial`, …) with the test clock. They never go through MercadoPago or the fake
  server.
- A fixture that cannot be built is a blocker for that shot. The article ships
  without the shot, and the shot stays listed in the exemption file with
  `reason: pending-fixture`. That exemption counts toward the guard (b) ratchet.

## 4. `pnpm help:shots`

```
pnpm help:shots                    # all shots, es/en/pt
pnpm help:shots <articleId>        # one article
pnpm help:shots --stale            # only shots guard (e) reports as stale
```

1. Requires `hops servers-up` to be running in the current worktree. If the servers
   are not up, the script exits non-zero with that message. It never starts them
   itself.
2. For each shot it logs in as the user, applies the fixture, opens the anchor's
   route through `@repo/portal-routes`, and waits for the `data-help` root.
3. It draws the callouts as an overlay injected into the page before capture
   (numbered circles plus an outline). They are never painted on the image
   afterwards. This keeps the markers aligned with the real layout in every locale.
4. It writes WebP files, one per locale, as `<articleId>--<shotId>.<locale>.webp`,
   at 1280 px wide for desktop and 390 px for mobile.
5. It records an entry in `help-shots.lock.json`:
   `{ id, locales, sourceHash, capturedAt }`. `sourceHash` hashes the same
   anchor files that guard (c) hashes (`docs/guards.md` §4.2) plus the fixture
   file.
6. It reverts the fixture.

The script reuses the Playwright setup from `apps/e2e` (auth helper, base URLs)
and does not run inside the e2e suite.

## 5. Guard (e) `check:help-shots`

Fail-closed. It runs in the CI `Guards` job and in `pnpm check:guards`.

| Predicate | Fails when |
|---|---|
| E-1 present | a declared shot has no file for a locale the article ships in |
| E-2 fresh | `sourceHash` in the lock differs from the current hash of the shot's anchor files or fixture |
| E-3 targets | a callout target has no matching `data-help` value in `apps/web/src` (a static search; CI does not render anything) |
| E-4 orphan | a file or lock entry exists for a shot that no article declares |
| E-5 alt | `alt` is empty or fails guard (d) |

The fix for E-2 is `pnpm help:shots --stale`, followed by committing the new
images and the lock. Mutation tests: delete one image (E-1), edit one anchored
page file (E-2), rename one `data-help` value (E-3), and remove a shot from the
frontmatter while keeping its file (E-4). Each must turn the guard red.

**What it cannot see.** Guard (e) checks that each shot exists, that it is fresh
against its sources, and that its markers are still wired. It does not check that
the image looks right. A visual review of the PR diff stays a human task. The
guard's header must say so.

## 6. Storage: in the repo (owner, 2026-11-20)

Images are committed as WebP under `packages/help/shots/out/`. The visual review of
the PR diff is the only check that an image is right (§5), so the images must show
up in the PR. Repo storage needs no credentials and no external service.

- **Volume.** About 90 articles × about 2 shots × 3 locales, at roughly 60 KB each,
  is about 30 MB for a full regeneration. To limit history growth, routine runs use
  `--stale`. A full regeneration is reserved for deliberate redesigns.
- **Serving.** The web build copies `out/` into its static assets under
  `/ayuda-shots/`. `get_help` and the export return absolute URLs on the site origin.
- **Rejected:** Cloudinary through `@repo/media`. The PR would show only lock-file
  hashes, so the visual review would turn into opening links, and the upload step
  would need credentials.

## 7. Consumers

- **Web:** a `<figure>` with a lazy `<img>` in the current locale and the `alt`. The
  callout numbers match the ordered list the text refers to.
- **MCP `get_help`:** returns `shots: [{ url, alt }]`, so an agent can show or
  describe the screen.
- **Export (PR-13):** includes the image URLs, for flyers.
