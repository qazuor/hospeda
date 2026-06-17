# EAS Build — Setup Skeleton (SPEC-243 T-012)

`apps/mobile` uses **EAS Build** (ADR-034 decision 7) for native compilation and
store distribution. This document covers the build-profile skeleton committed in
`apps/mobile/eas.json` and the owner action items required before the first real build.

## Build profiles (`eas.json`)

| Profile | Distribution | Channel | `EXPO_PUBLIC_APP_ENV` | `EXPO_PUBLIC_API_URL` |
|---------|--------------|---------|-----------------------|-----------------------|
| `development` | `internal` (dev client) | `development` | `development` | owner-provided (LAN/tunnel) |
| `preview` | `internal` | `preview` | `staging` | `https://staging-api.hospeda.com.ar` |
| `production` | store | `production` | `production` | `https://api.hospeda.com.ar` |

- `cli.appVersionSource: "remote"` — EAS owns the build/version numbers (no manual
  bumps in `app.json`); `production.autoIncrement` raises the build number per build.
- `EXPO_PUBLIC_*` values are inlined into the JS bundle at build time and are **not
  secret** (public hostnames), so the staging/production API URLs live directly in
  `eas.json` rather than in EAS Secrets. The `development` API URL is per-developer
  (each machine's LAN IP or an `expo` tunnel), so it is left out — set it in
  `.env.local` for local runs, or override per build with `eas build --profile
  development -e EXPO_PUBLIC_API_URL=...`.

## App identifiers (`app.json`)

- iOS `bundleIdentifier`: `com.hospeda.app`
- Android `package`: `com.hospeda.app`

These are placeholders aligned to the brand. Confirm/replace before submitting to the
stores if a different identifier is desired.

## Owner action items (NOT done by this task — require an EAS account / device)

1. **Link the project to EAS**: run `eas init` from `apps/mobile` to create the EAS
   project and write `expo.extra.eas.projectId` into `app.json`. (Not fabricated here —
   it requires an authenticated `eas login`.)
2. **Add `expo-dev-client`** before the first `development` build
   (`npx expo install expo-dev-client`) — the `development` profile sets
   `developmentClient: true`, which needs that dependency.
3. **Verify the API URLs** in `eas.json` (`preview` → staging, `production` → prod) match
   the deployed Hono API hostnames; adjust if the infra hostnames change.
4. **Set the `development` API URL** for whoever runs dev-client builds (see above).
5. **Store credentials**: `eas credentials` (or let EAS manage them on first build) for
   the Apple Developer + Google Play signing keys when distribution is needed.

## CI

`apps/mobile` is already covered by the repository CI (`.github/workflows/ci.yml`) — the
`lint`, `typecheck`, `build`, and `test-unit` jobs run `pnpm <task>`, which is Turborepo
over the whole workspace and schedules `mobile#lint`, `mobile#typecheck`, `mobile#build`
(`expo export`, native platforms only — see `app.json` `platforms`) and `mobile#test`
by glob. No mobile-specific CI job is needed (same pattern as `web`/`admin`/`api`).
Native compilation (EAS Build) is intentionally out of the PR CI loop and runs on the
EAS service on demand.
