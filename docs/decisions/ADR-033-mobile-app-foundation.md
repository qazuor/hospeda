# ADR-033: Mobile App Foundation (Expo / React Native)

## Status

Accepted (2026-06-15)

## Context

SPEC-243 introduces a native mobile application (`apps/mobile`) built with Expo /
React Native, added to the existing TurboRepo monorepo. The app is a first-class
client of the Hono API (public + protected tiers) serving both tourists and hosts
from a single role-gated binary. It introduces a stack the monorepo does not yet
have (React Native), so the Sub-0 (Foundation) sub-spec must lock a set of
architecture decisions before any UI work starts. Deferring these decisions until
after screens exist means rewriting those screens.

The locked high-level decisions (from the spec) are:

- New pnpm workspace app `apps/mobile`, Expo **managed** workflow, Expo Router (file-based).
- Single binary, role-gated navigation from the Better Auth session.
- Only `/api/v1/public/*` and `/api/v1/protected/*` are called — never the admin tier.
- UI rebuilt from scratch in RN. Only the data/contract layer is reused:
  `@repo/schemas` (Zod), `@repo/i18n` (locales), TypeScript types, and the Hono API.
- `@repo/icons` (DOM phosphor SVG) is **never** imported in `apps/mobile`.

This ADR records the seven Sub-0 micro-decisions that the spec left open.

## Decision

| # | Decision | Choice |
|---|----------|--------|
| 1 | Styling | **`StyleSheet.create`** (RN standard). Not NativeWind. |
| 2 | Icons | **`phosphor-react-native`** (visual parity with the web). |
| 3 | API client transport | **Deferred to the Better Auth Expo spike (T-003).** |
| 4 | Map library | **Out of Sub-0 scope** — decided in Sub-1 (T-026). |
| 5 | Locale loading in Metro | **Eager** import of `es/en/pt`; validate bundle size in T-002. |
| 6 | Push notification channels | **Single channel** in v1; per-category prefs in Sub-4. |
| 7 | Builds | **EAS Build** for CI and distribution. |

## Rationale

1. **Styling — `StyleSheet.create`.** RN standard, zero extra build-plugin risk, full
   control. NativeWind would bring Tailwind DX (familiar from `apps/admin`) but adds a
   Babel plugin and has historically lagged behind new Expo SDK releases. For a
   greenfield v1 where build stability on SDK upgrades matters more than maximum UI
   velocity, the lower-risk option wins. A mobile design system
   (`apps/mobile/src/design/`) of JS token objects mitigates the verbosity cost.
2. **Icons — `phosphor-react-native`.** Same icon family as the web (`@repo/icons`
   wraps `@phosphor-icons/react`), so visual parity is preserved while staying
   RN-compatible. `@expo/vector-icons` is larger and less branded.
3. **Transport — deferred.** The transport choice is downstream of the auth spike: if
   `better-auth/expo` requires `@better-fetch/fetch`, the decision is already made.
   Committing to native `fetch` before the spike risks a rework. Default remains native
   `fetch` (Expo SDK 49+ global) unless the spike proves otherwise.
4. **Map library — Sub-1.** Geolocation/map is a Sub-1 deliverable (nearby discovery).
   It also carries a billing implication (`react-native-maps` via Google Maps vs.
   MapLibre open tiles) that should be decided with Sub-1 context, not in Foundation.
5. **Locales — eager.** Three locale JSONs are small; eager import is the simplest
   correct option. Metro does not tree-shake like esbuild, so T-002 must measure the
   real bundle contribution and fall back to lazy-by-locale only if the size is
   unacceptable. This is a measurement, not a preference.
6. **Push channels — single.** One notification channel in v1 keeps the push setup
   (T-011) minimal. Per-category preferences are a Sub-4 deliverable (notification
   prefs screen), layered on top later without reworking the channel model.
7. **Builds — EAS.** EAS Build is the standard path for native compilation,
   environment-secret injection, and store distribution in the Expo managed workflow.
   Local bare builds are a fallback only if EAS has blocking issues.

## Consequences

- (+) All Sub-0 UI and tooling work proceeds against a fixed set of choices — no
  churn from late styling/icon switches.
- (+) Lower build-fragility risk on Expo SDK upgrades (no NativeWind, managed workflow).
- (+) Data-contract reuse (`@repo/schemas`, `@repo/i18n`) keeps the mobile client in
  lockstep with the API without duplicating types.
- (-) `StyleSheet.create` is more verbose than utility classes; partially offset by the
  mobile design-system token layer.
- (-) Two decisions remain genuinely open (transport, map) — tracked explicitly against
  T-003 and T-026 respectively, not silently assumed.
- (~) `@repo/icons` is banned in `apps/mobile`; a lint guard (T-008) enforces this since
  importing the DOM phosphor build crashes in RN.

## Implementation notes (T-001 scaffold)

- **Expo SDK 56** is the scaffolded version: `expo ~56.0.2`, `react-native 0.85.3`,
  `react 19.2.3`, `expo-router ~56.2.11` (Expo libraries now track the SDK number).
  All `expo-*` deps must be installed via `expo install` / `expo install --fix`, never
  hand-pinned — a hand-typed mix of SDK-52 and SDK-56 versions passes `tsc` on a
  placeholder but breaks at runtime.
- **React override bumped monorepo-wide**: root `pnpm.overrides` `react`/`react-dom`
  `19.1.1 → 19.2.3` and `@types/react` `19.1.10 → 19.2.17` (required by SDK 56).
  Verified safe: `apps/admin` and `apps/web` typecheck clean (React 19.2.x is a
  backward-compatible patch).
- **TypeScript 6.0.3 in `apps/mobile` only** (accepted 2026-06-15): Expo SDK 56 pulls
  TS 6.0.3 via `expo install --fix`; the rest of the monorepo stays on 5.7.2, isolated
  per workspace. `apps/mobile/tsconfig.json` needs `"ignoreDeprecations": "6.0"` because
  TS 6.0 deprecated `baseUrl`. **Follow-up**: align the whole monorepo to a single TS
  major in a dedicated chore (out of SPEC-243 scope) so mobile stops diverging.

## T-002 verification (Metro resolution + locale bundle)

- **Metro resolution**: `@repo/i18n` exposes `main: ./src/index.ts` and resolves from
  source (Metro's `babel-preset-expo` embeds `babel-plugin-module-resolver`, which DOES
  read tsconfig `paths`). `@repo/schemas` exposes `dist/index.js` (its `src` uses `.js`
  ESM import specifiers Metro can't resolve from source), so it must be BUILT
  (`turbo build --filter=@repo/schemas`) and `@repo/schemas` was removed from the mobile
  tsconfig `paths` so Metro uses `main` resolution. `metro.config.js` stays minimal — SDK
  56 auto-configures monorepo watchFolders/nodeModulesPaths; no manual config needed.
- **Eager locale bundle (decision #5 resolved)**: `expo export --platform ios` bundles
  1316 modules → **4.9 MB** Hermes bytecode with all three locales (es/en/pt) loaded
  eagerly. That is within the normal 4–8 MB RN range, so **eager loading stays** (no
  lazy-by-locale needed). Future optimization (not now): excluding ~20 admin-only i18n
  namespaces (`admin-*`, `tags`, `revalidation`, …) mobile never uses would save
  ~350–500 KB without adding lazy-load complexity.

## Alternatives Considered

- **NativeWind for styling** — rejected for v1 due to Babel-plugin + SDK-lag risk on a
  greenfield app; reconsider once the app is stable and the team wants Tailwind DX.
- **`@expo/vector-icons`** — rejected for weaker brand/web parity.
- **Committing transport to `fetch` now** — rejected; the auth spike must inform it.
- **Lazy locale loading by default** — rejected as premature optimization; gated on the
  T-002 bundle-size measurement instead.
