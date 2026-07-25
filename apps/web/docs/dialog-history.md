# Back-button integration for modal surfaces (HOS-310)

How `src/lib/dialog-history.ts` and `src/hooks/useDialogHistoryBack.ts` make the
system back button close a modal instead of leaving the page, without letting
Astro's `<ClientRouter />` swap the document out from under it.

On mobile, pressing the system back button while a modal is open must close the
modal. The web platform only exposes that gesture through the History API, so
every modal that opts in takes ownership of one history entry: opening claims an
entry, the back gesture pops it (and we close the modal), and closing through the
UI unwinds the entry so no junk is left behind.

## Why the entry carries a URL fragment

Astro's ClientRouter `popstate` handler (`astro/dist/transitions/router.js` →
`onPopState`) reacts to a history traversal by refetching the target URL and
swapping the whole document — which would destroy every island on the page,
including whatever the user had typed into a form. That is the exact loss
HOS-310 is about, so a naive `pushState` + `history.back()` would trade one bug
for a worse one.

The router does have a cheap path that skips the swap, in `transition()`:

```js
if (samePage(from, to) && !options.formData) {
  if (direction !== "back" && to.hash || direction === "back" && from.hash) {
    moveToLocation(...); return;   // no fetch, no swap
  }
}
```

Reaching it in BOTH directions is why the entry gets a `#hospeda-dialog-N`
fragment *and* why it is claimed through the router's own `navigate()`:

- Going **forward** onto the entry, `to.hash` is the fragment. Any push would
  satisfy this.
- Going **back** off the entry, the fragment has to be on `from`, which is the
  router's module-private `originalLocation`. Only `navigate()` updates it. A
  hand-rolled `pushState` leaves `originalLocation` hash-less, the condition
  fails, and the router swaps the document on every back press.

An earlier revision instead parked the previous entry's state as `null` to hit
the router's `if (ev.state === null) return;` early return. That works going back
and fails going forward — the pushed entry has to carry a state, so the forward
traversal re-enters `transition()` and swaps.

## Why claiming is conditional

That cheap path is also gated on `samePage(originalLocation, to)`, which compares
pathname AND search. `originalLocation` only advances through the router — and
this app moves its own URL with raw `pushState`/`replaceState` in several places:

| Site | What it does |
| --- | --- |
| `layouts/ListingLayout.astro` | `pushState` on every filter apply (partial swap) |
| `components/destination/DestinationPOIFilter.client.tsx` | `pushState` on POI facet toggle/clear |
| `pages/[lang]/destinos/index.astro` | `pushState` on facet toggle |
| `components/host/editor/CalendarSyncPanel.client.tsx` | `replaceState` stripping `?calendarSync=` |
| `components/auth/SignIn.client.tsx` | `replaceState` stripping the query |
| `components/billing/strip-checkout-return-params.snippet.ts` | `replaceState` on the checkout return |

`layouts/BaseLayout.astro` also monkey-patches `history.pushState`/`replaceState`
for the feedback nav-history bootstrap. That one is benign here — it records
`pathname + search` only and dedupes identical consecutive entries, so a
hash-only claim is invisible to it — but it belongs in the list so the next
person auditing "who touches history on this page" knows it was considered.

After any of those the router's view is stale, `samePage` is false, and a
`navigate()` claim would fall all the way through to a full document swap —
while merely OPENING a modal.

So the module tracks the last URL the router is known to agree with
(`routerAgreesOn`) and refuses to claim when it cannot vouch for that. A skipped
claim costs the back gesture on that surface, which is exactly the behaviour that
shipped before this feature — never a swap. **Fail-safe, not fail-broken.**

`routerAgreesOn` is re-synced at module evaluation and on `astro:page-load`, but
only when gated by a preceding `astro:before-swap`. `ListingLayout`'s partial
swap hand-dispatches `astro:after-swap` and `astro:page-load` without ever
running the router; `before-swap` is the event it does not forge, and unlike
`before-preparation` it cannot fire for a navigation that then aborts.

## Known limitations

- Claiming truncates the browser's forward history, as any `pushState` does.
- When the user navigates away *from inside* an open modal, the entry can no
  longer be unwound: the swap has already destroyed the React tree that owned it.
  The page keeps one extra entry, so returning to it costs one inert back press.
  Racing `history.go()` against an in-flight ClientRouter navigation is the
  alternative, and that corrupts the history stack.
- **Listing and destination-index pages re-push their URL on every filter or
  facet tap.** A modal opened after the first such tap gets no back gesture for
  the rest of that page's life. This is why the mobile filter drawer
  (`MobileDrawer.tsx`) is deliberately NOT wired — it would work once and then
  stop — and why `AiSearchEntry` and `MobileMenu` are effectively
  first-interaction-only on those pages.
- If something pushes a history entry on top of a live claim (the listing filter
  debounce can land after a modal opened), the claim is abandoned rather than
  unwound — walking back would take the user somewhere they did not ask for.
  Cost is one inert back press.
- Unwinding restores the URL as it was when the modal opened, so an island that
  scrubbed the query string in the meantime (`CalendarSyncPanel` strips
  `?calendarSync=`) sees it come back. Harmless for a status flag; do not move a
  *secret*-bearing strip out of an inline head script without revisiting this.
- A claim is refused while a router navigation is in flight, because
  `navigate()` begins by aborting the pending one. That window expires after
  `NAVIGATION_WINDOW_MS`, so a page fetch slower than that can still be aborted
  by a modal opened in the meantime.
- `moveToLocation` assigns `location.href = to.href` after its own push.
  Measured on Blink: `history.length` grows by exactly one, so the fragment
  assignment does not append a duplicate entry and one back press closes the
  modal. **Not yet measured on WebKit** — if it duplicates there, the first back
  press would land on the twin and appear dead.
- The synchronous push verification in `claim()` relies on Astro's hash fast path
  having no `await` before `moveToLocation`. `astro` floats minors, so an added
  await would make the verification run too early: the entry is disowned while
  the push still lands, leaving a stray fragment. The session stamp keeps that
  stray invisible to this module, so the cost is cosmetic plus one inert back
  press.
- The same verification depends on `navigate(href, { state })` **merging** the
  caller's state into `history.state` (Astro 7.0.9 `moveToLocation` does
  `pushState({ ...options.state, index, scrollX, scrollY })`). If a future minor
  stops merging it, every claim pushes an entry the module then disowns — one
  junk entry **per modal open**, cumulative, so eight opens cost eight back
  presses to leave the page. That failure is silent; a `~7.0.x` pin or a
  dev-mode warning on verification failure would make it detectable.

## Invariants worth re-checking after an Astro upgrade

- **A claim must not fire `astro:before-preparation`.** If it ever did,
  `navigationInFlight()` would be true for `NAVIGATION_WINDOW_MS` after every
  claim, so the second modal on a page — and every re-claim after a vetoed close
  — would be refused for ten seconds. Verified in Chrome by counting the three
  lifecycle events across open/back/forward/close: all stayed 0.
- **The baseline captured at module evaluation must precede any island's URL
  rewrite.** `markRouterAgrees()` at module load *asserts* agreement rather than
  observing it. That assertion holds today only because `MobileMenuIsland.astro`
  hydrates `client:load` on every page with a header, so this module evaluates at
  the earliest island hydration — before any of the rewrite sites above, which
  all run in React effects. **Downgrading that island to `client:idle` or
  `client:media` would invert the guard**: on a listing page the module could
  first evaluate after a filter push, record the filtered URL as agreed, and then
  claim into a full document swap. If that directive changes, this needs to
  change with it.

## Surfaces that are NOT covered

Wiring is opt-in per surface. These deliberately have no back-button handling:

- `components/shared/filters/components/MobileDrawer.tsx` — see above.
- `components/maps/MapCardsSidebar.client.tsx` — mobile results bottom sheet.
- The native `<dialog showModal>` review forms (`ReviewSidebarCard`,
  `DestinationReviewSidebarCard`, `GastronomyReviewForm`) — these are the highest
  value remaining targets, since they hold typed content.
- Anchored popovers (`AuthRequiredPopover`, `CompareUpsellPopover`,
  `CollectionPickerPopover`, `DateRangeFilter`, `SearchBar`) — hijacking the back
  gesture for a popover is worse than the problem it solves.
- `CookieConsentBanner` — making back dismiss a consent banner would be a trap.
