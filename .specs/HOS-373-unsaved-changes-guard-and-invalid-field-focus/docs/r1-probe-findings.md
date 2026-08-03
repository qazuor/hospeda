# R-1 probe — can `astro:before-preparation` block a navigation?

Run 2026-08-03 against this worktree's dev server (`localhost:4433`), Astro
7.0.9, Chromium driven by Playwright. Nothing was written to `apps/web`; every
probe was injected at runtime via `page.evaluate`.

**Question.** The Linear issue and the spec's first draft both assumed that
cancelling `astro:before-preparation` prevents a soft navigation, so a guard
could hook it to ask "you have unsaved changes, leave anyway?". Astro's docs
never actually claim the event is cancelable. Is it, and does cancelling work?

**Answer.** The event *is* cancelable (`{ cancelable: true }`, confirmed in the
installed source at `astro/dist/transitions/events.js:41` and again at runtime).
**Cancelling it does not stop the navigation.** It only stops *Astro* from
handling it.

---

## Test 0 — baseline: soft navigation works, event shapes

Observe-only listeners on all five lifecycle events, then an internal link click
from `/es/eventos/` to `/es/publicaciones/`. The `window` marker survived, so
this was a genuine soft navigation.

| event | navigationType | cancelable |
|---|---|---|
| `astro:before-preparation` | `push` | **true** |
| `astro:after-preparation` | — | false |
| `astro:before-swap` | `push` | **false** |
| `astro:after-swap` | — | false |
| `astro:page-load` | — | false |

`before-swap` being non-cancelable matches the documented "calling
`preventDefault()` is a no-op".

## Test A — cancel a `push` (link click)

Listener calls `preventDefault()` unconditionally. State kept in `sessionStorage`
so it survives a reload; a `window` marker distinguishes soft nav from reload.
Clicked from `/es/publicaciones/` to `/es/contacto/`.

```json
{
  "cancelled": 1,
  "unloadFired": true,
  "lastNavType": "push",
  "lastTo": "/es/contacto/",
  "unloadAtUrl": "/es/publicaciones/",
  "probeSurvived": false,
  "finalUrl": "/es/contacto/"
}
```

- `cancelled: 1` — the listener ran and cancelled.
- `unloadFired: true` + `probeSurvived: false` — a **native** full page load
  happened instead.
- `finalUrl` — the user left anyway.

**Cancelling downgraded a soft navigation into a hard one.** Strictly worse than
not listening at all: same departure, plus a full reload.

## Test B — cancel a `traverse` (back button)

First attempt was contaminated: the previous page had arrived via the native
reload from Test A, so the router's history was already hybrid and the event
never fired (`cancelled: 0`). Re-run from a clean stack built entirely by the
router (`/es/` → `/es/destinos/` → `/es/eventos/`, all soft), then `history.back()`:

```json
{
  "navType": "traverse",
  "urlAtDispatch": "/es/destinos/",
  "to": "/es/destinos/",
  "cancelled": 1,
  "unloadFired": true,
  "events": ["before-preparation:traverse", "popstate@/es/destinos/"],
  "finalUrl": "/es/destinos/",
  "finalTitle": "Destinos Turísticos | Hospeda"
}
```

The decisive field is **`urlAtDispatch`**. The page was `/es/eventos/`, but at
the moment the event fired `location.pathname` already read `/es/destinos/` —
the browser had committed the history entry *before* Astro dispatched. In Test A
the same field still held the origin page.

So on back/forward: the URL moves first, a listener cannot see it coming, and
cancelling does not restore it.

---

## Consequences for the spec

1. `astro:before-preparation` is an interception point for *modifying* a
   navigation (`loader`, `direction`), not for preventing one. Do not use it as a
   guard. It reads plausible and the docs do not contradict it — which is exactly
   why this needed measuring.
2. Internal links must be guarded by a **capture-phase `click` listener on
   `document`**, which runs before the router and can genuinely `preventDefault()`.
   That also removes the synchronous constraint, since nothing has started yet.
3. Back/forward has no clean hook. Only a history trap covers it. See the spec's
   OQ-1.
4. Any test for this must assert the `window` object survived, not just the URL.
   Test A's failure mode produces a *correct-looking URL* — from the address bar
   alone it is indistinguishable from success.
