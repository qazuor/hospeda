# T-001 — client:* island SSR↔hydration audit (US-2)

Date: 2026-07-09. Scope: every `client:*` React island in `apps/web/src` that could
show **critical indexable content** (prices, ratings, counts, availability, badges,
live data). Method: enumerate `client:*` directives in `.astro`, read the mounted
`.client.tsx`, compare the SSR first render vs the hydrated state. Islands on
`noindex` pages and purely-interactive islands (dropdowns, modals, action buttons,
maps) are out of the SEO/AEO criterion.

## Verdict: 2 offending, rest compliant

The `useState(initialLiteral)`-instead-of-`useState(prop)` anti-pattern appears in
**two independent components**, both on public indexable pages. Everything else
seeds state from SSR-fetched props or renders directly from props.

### OFFENDING

| Component | Mount site | Directive | Missing in SSR | Fix |
|---|---|---|---|---|
| `AnimatedCounter` | `StatsSection.astro:73` (home stats) | `client:visible` | `AnimatedCounter.client.tsx:94` `useState(0)` → visible `<span>` text renders "0" until IntersectionObserver + RAF animation runs. `aria-label` uses the real `value`, but the *indexed text* shows 0. | `useState(value)` (or start from `value` and animate visually only). SSR must emit the final number as text; hydration animates, never reveals. Drop the now-unneeded `aria-hidden`. |
| `DestinationWeatherIsland` | `DestinationClimateCard.astro:148` (destination detail) | `client:idle` | `DestinationWeatherIsland.client.tsx:86` `useState({status:'loading'})` → SSR emits only an `aria-busy` skeleton. Current temp/condition/humidity/wind + 16-day forecast are 100% client-fetched via `useEffect`. Page has **no `noindex`**. | Fetch current weather server-side in `DestinationClimateCard.astro` and seed `useState({status:'ready', data:initialWeather})`. Client re-fetch only to refresh. NOTE: **owner decision** — live weather is not canonical SEO content (changes hourly); the seasonal-average block is already SSR'd. Deciding whether the SSR fetch (adds latency to every destination render, interacts with Wave 4 CWV) is worth it. |

### Minor note (not offending)

- `HostLandingCta` (`publicar/index.astro:249`, `client:only="react"`): the main CTA
  `<a>` has no `href` in SSR HTML until hydration. It's an interactive CTA, not a
  price/rating/count, so out of the offending criterion — but a `<noscript>`/SSR
  fallback `<a>` to sign-in would be cleaner. Low priority.

### COMPLIANT (spot list — pattern is correct)

Reviews (`CommentThreadIsland.client.tsx:117`, `ExperienceReviews.client.tsx:98` seed
`useState(initialReviews)`), prices (`PlanPurchaseButton` computes from props
synchronously), favorite counts (`FavoriteButton` reads `count` from props),
featured destinations, testimonials carousel, external-review snippets,
`AccommodationCard` (Astro-pure price/rating/badges). All `client:only` maps +
comparator are on `noindex` pages (`mapa.astro`, `comparar/index.astro`,
`AccountLayout` for `mi-cuenta/*`).

## Consequence for the spec

- **T-004** fixes `AnimatedCounter` (agreed, clear).
- **T-005** now has a concrete second target (`DestinationWeatherIsland`) — pending
  the owner tradeoff decision above — plus documenting the principle in
  `apps/web/CLAUDE.md`.
- Recommended CI guard (T-018): fail if a `client:*` island receives a value via
  props but initializes `useState` with a differing literal (`0`/`null`/`[]`/`'loading'`)
  instead of seeding from the prop.
