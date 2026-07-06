---
title: "G-1 — Wave Header Rework: Options & Tradeoffs (owner decision)"
linear: HOS-84
statusSource: linear
deliverable: G-1
status: decided
decision: "Opt-B band puro (both surfaces) + HYBRID 3-state compact+hide/reveal (detail) / static (listing); shared-component rework; dedicated --surface-header token; consolidate compact blocks preserving per-page override. NOTE: OQ-6 revised 2026-07-05 from Beh-2 puro — see spec.md §6.2"
created: 2026-07-04
---

# G-1 — Wave Header Rework: Options & Tradeoffs

> **Gating deliverable (AC-1).** This document turns the code-verified baseline in
> `spec.md` §5 into a concrete menu of options for the owner to choose from. It ends
> with a recommendation, but **the owner records the decision** — nothing is
> implemented until then (NG-4).
>
> A companion **visual mockup** (light + dark, all four aesthetic directions rendered
> side by side) accompanies this doc — see [§7](#7-visual-companion).

## 0. Decision recorded (2026-07-04) — AC-1 ✅

> **⚠️ OQ-6 revised 2026-07-05 (Phase 2 kickoff).** At implementation start the owner
> reversed OQ-6 from **Beh-2 puro** to a **hybrid 3-state model** (expanded / compact /
> hidden): compaction is **kept** (it carries per-page show/hide function), and
> hide/reveal is layered on top. Consequently OQ-4 becomes **consolidate** the compact
> blocks (preserving per-page override), **not delete** them, and the
> hysteresis + `overflow-anchor` fix is **retained**. The authoritative, updated design
> lives in `spec.md` §6.2 / §6.5. The table below is the original 2026-07-04 record.

The owner reviewed the four aesthetics and five scroll behaviors (interactive mockup with
the real Hospeda nav + full detail page) and chose:

| OQ | Decision |
|---|---|
| **OQ-2 — Aesthetic** | **Opt-B — solid / gradient band, "band puro" (no image in the header)**, applied to **both** detail and listing surfaces. The entity photo stays in the body gallery, not the header. |
| **OQ-6 — Behavior** | ~~Detail: Beh-2 — hide on scroll-down / reveal on scroll-up~~ **REVISED 2026-07-05 → hybrid 3-state (expanded/compact/hidden); compaction kept + hide/reveal layered on top** (see spec.md §6.2). **Listing: static band** (unchanged). |
| **OQ-1 — Scope** | **Rework the single shared component** — NO detail-only variant. Enabled by using Opt-B on both surfaces; keeps blast radius minimal. |
| **OQ-3 — Token** | **Dedicated `--surface-header` token** (light + dark), not a repo-wide `--surface-warm` rename. The band gradient is built from brand tokens. |
| **OQ-4 — De-dup** | **Yes** — fold the 6 duplicated compact-mode blocks into the shared component. With Beh-2 + static listing, most of that compact CSS is deleted rather than moved. |
| **OQ-5 — Content** | Recommended defaults (to confirm in implementation): **add a back button** (left of breadcrumb, composed from routing, NG-3-safe); **keep the favorite button** right-aligned in the header. |

**Behavioral consequence (AC-3):** the current scroll-compaction hysteresis
(`EXPAND_AT`/`COMPACT_AT`) and its `overflow-anchor:none` fix exist to solve trembling
*during compaction*. Beh-2 does not compact — it slides the whole header out/in by scroll
direction, so that compaction machinery can largely be **retired**. But Beh-2 introduces
its **own** jitter surface (rapid show/hide when the scroll direction flickers): it needs a
direction dead-zone / threshold, and the new model must be verified not to re-introduce
trembling before the fix is removed. Do not delete `overflow-anchor` handling blindly.

Phase 2 is now unblocked: `/startIssue HOS-84` → worktree + implementation.

---

## 1. What we're deciding

The wave header is the celeste band at the top of every public **detail** page — and,
because it is a single shared component, every **listing** page too. The owner isn't
convinced on three fronts: **behavior** (scroll/compact), **aesthetics** (shape, color,
premium feel), and **content hierarchy** (what's inside, in what order). This doc maps
each open question (OQ-1…OQ-6) to options, weighs them, and recommends a path.

The decision is gated by **OQ-2 (aesthetic direction)** — every other question resolves
differently depending on whether we keep the wave or replace it.

## 2. Code-verified baseline (the constraints that shape every option)

Re-verified first-hand on 2026-07-04 (not taken on faith from the spec):

| Fact | Evidence | Why it matters |
|---|---|---|
| **Single shared component** | `WaveHeader.astro` consumed by `DetailLayout.astro` (`paddingTop="detail"`) **and** `ListingLayout.astro` (`paddingTop="listing"`) | Any wave change hits listings too, unless we branch a variant (OQ-1). |
| **The "celeste" is a mislabeled token** | `colors.ts` → `warm: { l: 0.95, c: 0.03, h: 250 }` = a pale **blue**, not a warm/peach. Dark override → navy `oklch(0.255 0.035 258)`. | The color the owner dislikes is `--surface-warm`, a token whose name lies about its hue (OQ-3). |
| **Wave is a static SVG bezier** | `<path d="M0,64 C288,120 576,0 864,64 C1152,128 1440,32 1440,32 …" fill="var(--surface-warm)">` in `WaveHeader.astro` | Silhouette changes = editing the `d` string by hand. Not parametrized. |
| **Compact behavior is deliberately complex** | JS hysteresis `EXPAND_AT=8` / `COMPACT_AT=96` + `overflow-anchor:none` on `html:has(.wave-header)` | Documented root-cause fix for a real scroll-trembling bug. Must be preserved or explicitly re-derived, never naively dropped (R-2, AC-3). |
| **6 entity headers duplicate the compact CSS** | Each carries its own `:global(.wave-header--compact) .xxx-header__main {…}`: `DetailHeader`, `Destination`, `Event`, `Post`, `Gastronomy`, `ExperienceHero` | This is the real complexity/blast-radius driver (OQ-4, R-1). |
| **No back button anywhere** | grep `back\|BackIcon\|ArrowLeft` across all 6 headers = 0 matches | A back button would be net-new UI, composed from existing routing data only (OQ-5, NG-3). |
| **CSP constraint** | `data-wave-padding` → CSS var, no inline `style` (SPEC-046) | Any dynamic value must go through CSS vars/classes, never inline `style` (R-5). |

## 3. OQ-2 — Aesthetic direction (THE gating question)

Four directions, each scored against the six axes the spec demands: brand fit, premium
feel, dark-mode robustness, a11y/contrast, behavioral complexity, and blast radius.

### Opt-A — Keep & restyle the wave

Refine the bezier silhouette, fix the color token, tune the compact drop-shadow. Keep the
overhang technique.

- **Pros**: Lowest risk. Preserves the wave as an existing brand motif. No new data
  dependency. Behavioral model (§4) stays as-is — the hard part is already solved.
- **Cons**: If the wave *concept* itself reads dated (owner's words), polishing it only
  mitigates; you can restyle a wave and still have "a wave".
- **Scores**: brand ✅✅ · premium ◐ · dark ✅ · a11y ✅ · behavior-complexity ✅ (unchanged) · blast-radius ◐ (SVG + token, 6 headers untouched behaviorally).

### Opt-B — Solid / gradient band

Drop the wavy SVG for a flat or subtly-gradient surface with a clean straight (or
single soft-radius) bottom edge.

- **Pros**: Cheapest route to a modern/premium feel. Simplest possible behavior (no
  overhang geometry). Trivially dark-mode-safe (one token). Removes the SVG entirely.
- **Cons**: Loses the wave motif — the header stops being visually distinctive vs. a
  generic SaaS band. Doesn't add storytelling.
- **Scores**: brand ◐ (drops motif) · premium ✅ · dark ✅✅ · a11y ✅✅ · behavior-complexity ✅✅ · blast-radius ✅ (removes geometry).

### Opt-C — Image hero

Use the entity's own hero image as the header background with a legibility overlay
(scrim/gradient) behind the title.

- **Pros**: Highest premium ceiling. Strongest storytelling — the accommodation/event
  *is* the header. Aligns with how top travel products (Airbnb, Booking) lead.
- **Cons**: **Hidden data + a11y dependency (R-3)** — every entity must have a usable,
  high-res image, and text-over-image must pass WCAG AA contrast in every case (variable
  photos = variable contrast). Heaviest change. Listings have no single hero image, so
  this direction essentially **forces OQ-1 to "detail-only variant"**.
- **Scores**: brand ✅ · premium ✅✅ · dark ✅ (overlay handles it) · a11y ◐ (contrast risk, needs a guaranteed scrim) · behavior-complexity ◐ · blast-radius ❌ (biggest; forces variant + image guarantees).

### Opt-D — Hybrid (image/gradient band + retained wave accent)

An image or gradient band with a subtler wave edge kept as a thin accent at the bottom.

- **Pros**: Keeps a nod to the brand motif while modernizing. Premium ceiling near Opt-C
  without fully committing to it on listings (the wave accent degrades gracefully when
  there's no image).
- **Cons**: Most design/engineering nuance to get right — two systems (image + wave edge)
  interacting across light/dark and with/without an image. Easy to look busy.
- **Scores**: brand ✅ · premium ✅ · dark ◐ · a11y ◐ · behavior-complexity ◐ · blast-radius ❌ (touches both the SVG and the image path).

### Recommendation (OQ-2)

**Primary: Opt-B for listings + Opt-C-lite for detail, unified by a shared token and a
single behavioral core.** Concretely:

- On **detail pages**, move toward an **image-anchored header** (Opt-C) *but* with a
  mandatory gradient scrim so a11y/contrast is guaranteed regardless of the photo — this
  is the primary conversion surface and deserves the storytelling ceiling.
- On **listing pages**, use a **solid/gradient band** (Opt-B) — listings have no single
  hero image, and a clean band reads more premium than a decorative wave on a grid of
  cards.
- Retain a **subtle wave edge as an optional accent** (the Opt-D idea) only if the visual
  companion shows it still earns its place; otherwise drop it cleanly.

Why not pure Opt-A: the owner explicitly said they're open to replacing the concept, and
"a nicer wave is still a wave". Why not pure Opt-C everywhere: listings can't feed it, and
forcing it there re-introduces the blast radius we're trying to shrink.

This recommendation is **contingent on the owner's reaction to the visual companion
(§7)** — the mockups are the real decision surface, not this prose.

## 4. OQ-6 — Behavioral model (scroll/compact)

The current hysteresis + `overflow-anchor:none` fix (AC-3) is genuinely load-bearing —
it fixed a measured trembling bug (scrollY bouncing 10→55). Options:

1. **Keep compaction, keep the fix as-is** (recommended if any header keeps a tall
   expanded state). Lowest risk; the hard problem stays solved.
2. **Static header, no compaction** — simplest, and removes the trembling-bug surface
   entirely. Viable **only** if the expanded and scrolled states are visually identical
   (i.e. we stop growing/shrinking the bar). Attractive for Opt-B (a flat band doesn't
   need to compact).
3. **Compaction with a re-derived model** — only if the aesthetic direction changes the
   bar height dynamics enough that the current thresholds no longer apply; must be
   re-measured and verified, never assumed (AC-3, R-2).

**Recommendation**: pair the aesthetic choice with the behavior — if we go band/flat
(Opt-B), prefer **option 2 (static)** and retire the trembling surface; if we keep any
height change, **keep the existing fix verbatim**.

## 5. OQ-3 — Token treatment

- **Fix/rename `--surface-warm`**: it's used well beyond this header (section
  alternation, per web CLAUDE.md "alternate `--core-background` / `--surface-warm`"), so
  renaming is a **repo-wide rename**, higher blast radius, out of proportion for this
  spec.
- **Introduce a dedicated `--surface-header`** token (light + dark values) and repoint
  *only* the header to it. ✅ **Recommended** — decouples the header color from the
  section-alternation color, lets us change the header hue without disturbing every warm
  section, and sidesteps the repo-wide rename. The mislabel of `--surface-warm` can be
  noted as a separate cleanup, not blocking this spec.

## 6. OQ-1, OQ-4, OQ-5 — Scope, de-dup, content

- **OQ-1 (scope)**: **Introduce a detail-only variant** of the shared component (or a
  `variant` prop), rather than reworking the single shared component for both surfaces.
  The recommended aesthetic (image on detail, band on listing) *requires* divergence
  anyway. This contains blast radius (R-1) and lets listings stay calm.
- **OQ-4 (de-dup)**: **Yes — fold the 6 duplicated compact-mode blocks into the shared
  component** as part of the rework. They're the real complexity driver; leaving them
  guarantees future half-migrations. Do this **only alongside** the behavioral decision
  (if we go static, most of these blocks disappear rather than move).
- **OQ-5 (content hierarchy)**: propose a **canonical element set + priority**, shared
  across entity types, each entity contributing what it has:
  1. Breadcrumb / **back button** (new — compose from routing, NG-3-safe)
  2. Type/category badge + status pills (featured / verified / new / cancelled / past)
  3. **H1 title** (the anchor)
  4. Location / destination link
  5. Rating stars + review count
  6. Favorite button (right-aligned island)
  - **Back button**: recommend **adding it**, left-aligned in the breadcrumb row — cheap,
    high-usability on a deep detail page, no data dependency.
  - **Favorite button**: keep in the header (right-aligned) — it's a primary action and
    already an island there.

## 7. Visual companion

The four aesthetic directions are rendered side-by-side (light + dark) in an interactive
mockup so the owner can *see* the tradeoffs rather than read them. The mockup uses the
real tokens (`--surface-warm` pale blue, the actual bezier `d` path, the real compact
shadow) so Opt-A is faithful and the others are honest departures from it.

> Visual companion artifact: **shared separately in this session** (HTML, light/dark
> toggle, all four options). Owner picks a direction there; that pick is recorded on
> HOS-84 as the AC-1 decision.

## 8. Decision checklist (what the owner records on HOS-84)

- [ ] **OQ-2** — Aesthetic: Opt-A / B / C / D / the recommended B+C-lite hybrid?
- [ ] **OQ-1** — Scope: shared rework, or detail-only variant (recommended)?
- [ ] **OQ-6** — Behavior: keep compaction + fix, or go static?
- [ ] **OQ-3** — Token: dedicated `--surface-header` (recommended) vs. rename `--surface-warm`?
- [ ] **OQ-4** — De-dup the 6 compact blocks into the shared component? (recommended: yes)
- [ ] **OQ-5** — Add a back button? Keep favorite in header? Confirm element priority.

Once these are recorded, Phase 2 (implementation) is unblocked and a worktree gets created
per the standard flow — not before.
