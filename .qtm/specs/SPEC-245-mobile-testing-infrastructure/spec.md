---
spec-id: SPEC-245
title: "Mobile Testing Infrastructure"
type: spec-full
complexity: high
status: draft
created: 2026-06-17T00:00:00Z
tags: [mobile, testing, react-native, vitest, rntl, android-emulator, maestro, detox, ci, expo]
---

# SPEC-245 — Mobile Testing Infrastructure

## Overview

**Goal.** Build a complete, layered testing system for `apps/mobile` so that every
future sub-spec of SPEC-243 ships with repeatable, automated coverage — component
rendering, Android emulator smoke flows, and E2E critical-path flows.

**The gap.** Sub-0 (foundation), Sub-3 (host/management), and Sub-4 (account/profile)
of SPEC-243 are all merged to staging as of 2026-06-17. Every bit of that verification
was done headless only. The app has never run on a device or simulator under any
automated test. The 23 unit/hook tests that exist today (`vitest 3.2.6`,
`environment: node`) cover logic, Zod schemas, and custom hooks — they cannot exercise
a single React Native component render, a navigation transition, or a session-persist
round-trip across an app kill. This spec closes that gap before Sub-1 (tourist
discovery) and Sub-2 (Tarjeta Hospeda) add significantly more surface area.

**Structure.** Four layers, each independent enough to be adopted incrementally:

1. **Component / render tests** — React Native Testing Library (RNTL) on vitest or a
   scoped jest-expo setup; runs in CI on every PR, no device required.
2. **Android emulator environment** — scripted, documented AVD provisioning for the
   Linux dev machine; reusable for local smoke runs and emulator-in-CI jobs.
3. **E2E mobile flows** — Maestro (preferred) or Detox against a running dev build;
   covers auth, host management, profile, and i18n flows.
4. **CI integration** — fast layers (logic + RNTL) on every PR; slow layers (emulator
   E2E) behind a label or nightly schedule.

---

## Locked design decisions

- **Vitest stays the vitest standard** for logic/unit tests. `apps/mobile` must not
  introduce Jest as a peer runner for the same logic-test scope.
- **RNTL-on-vitest is the preferred path** for component/render tests (keeps one test
  runner; avoids jest+vitest coexistence). A scoped jest-expo setup is the fallback if
  the vitest RN environment proves unworkable (see Open Questions §1).
- **Android-first for emulator and E2E** on the Linux dev machine. iOS simulator
  requires macOS; it is a constraint, not a failure — document how to add it later
  once a macOS CI runner or dev machine is available.
- **Maestro is the preferred E2E tool** (see Open Questions §3 for the vs-Detox
  analysis). It ships as a separate CLI, not a node package, and does not conflict
  with the vitest/biome stack.
- **No new app features** are implemented by this spec. All screens, hooks, and API
  integrations remain as delivered by Sub-0/3/4.
- **EAS build / `eas init`** is a prerequisite for EAS-based CI builds (the projectId
  is currently missing). That gate is an owner operational step, not a task in this
  spec. The CI skeleton for EAS is added as a gated, skipped job until the owner
  unblocks it.

---

## Baseline (verified current state)

**What exists today in `apps/mobile`:**

- `vitest 3.2.6` with `environment: node` — logic/unit tests only.
- 23 test files across Sub-0/3/4: hooks (`use-host-dashboard`, `use-own-accommodations`,
  `use-patch-accommodation`, `use-owner-conversations`, `use-conversation-thread`,
  `use-reply-conversation`, `use-patch-user`, `use-self-profile`,
  `use-accommodation-view-stats`), API client (`client.test.ts`, `use-api-query.test.ts`,
  plus `-topup` variants), push (`push-notifications.test.ts`, `use-push-registration.test.ts`,
  `push-notifications-topup.test.ts`), auth (`roles.test.ts`, `auth-form-schemas.test.ts`,
  `auth-errors.test.ts`), i18n (`i18n.test.ts`, `locale-context.test.ts`), design
  (`design.test.ts`), logger (`logger.test.ts`). Approximately 379 assertions total
  (exact count varies by run; the vitest comment in `vitest.config.ts` references
  "T-013 scope" as the deferred RNTL work — this spec is that scope).
- `vitest.config.ts` comment explicitly marks component/render tests as deferred.
- **NOT installed**: `@testing-library/react-native`, `jest-expo`, `react-test-renderer`,
  `jsdom`, `detox`, `maestro` (Maestro is a standalone CLI, not a node dep).
- **No mobile job** in `.github/workflows/ci.yml` as of Sub-3 merge. The Turbo pipeline
  runs `turbo run test` across all packages but `apps/mobile` uses
  `--passWithNoTests` to avoid failing when the shard lands on an empty file set.
- Screens implemented by Sub-3/4 (all `.tsx`, no render tests):
  - `app/(auth)/sign-in.tsx`, `sign-up.tsx`
  - `app/(host)/index.tsx` (dashboard), `metrics.tsx`, `profile.tsx`
  - `app/(host)/accommodations/index.tsx`, `[id].tsx`
  - `app/(host)/conversations/index.tsx`, `[id].tsx`
  - `app/(tourist)/index.tsx`, `profile.tsx`
  - `src/components/auth/AuthButton.tsx`, `TextField.tsx`
  - `src/components/profile/ProfileScreen.tsx`
  - `src/lib/locale-context.tsx`
- Dev machine: Linux, KVM available (hardware-accelerated emulator), 62 GB RAM,
  Android SDK not yet installed. No macOS available on dev machine — iOS simulator
  is not feasible locally.
- **Repo standard**: vitest + biome. Jest would be an exception requiring explicit
  justification (see Open Questions §1).

---

## Architecture

### Layer 1 — Component / Render Tests (RNTL)

React Native Testing Library (`@testing-library/react-native`) provides a DOM-like
`render()` API for RN components without a device. The component under test runs in
a simulated RN JS environment.

**Two candidate setups:**

**Option A — RNTL on vitest (preferred).** Install `@testing-library/react-native`
plus a vitest-compatible RN environment (`vitest-environment-jsdom` adapted for RN, or
a community preset such as `vitest-react-native`). Configure `vitest.config.ts` with a
separate project entry that sets `environment: 'react-native'` (or a custom environment)
for `**/*.test.tsx` files while keeping `environment: 'node'` for existing `.test.ts`
logic tests. Expo module mocks (for `expo-router`, `expo-secure-store`,
`expo-notifications`, `expo-constants`) are added as manual mocks in
`apps/mobile/src/__mocks__/`. This is the path that keeps one test runner and one
`test` script, consistent with the repo standard.

**Option B — jest-expo (fallback).** Install `jest-expo` + `@testing-library/react-native`
and configure a `jest.config.js` alongside the existing `vitest.config.ts`. The two
runners coexist but cover different file globs (`.test.tsx` for jest-expo, `.test.ts`
for vitest). This is the officially documented RN testing path and is less likely to
have compatibility surprises, but it introduces a second test runner and requires
`package.json` `"jest"` config block alongside `vitest`. Biome still lints both; no
ESLint is added.

The viability of Option A must be validated in T-001 before any component tests are
written. If the environment does not work reliably with Expo SDK 56 and React 19,
Option B is adopted instead.

**Component test scope (both options):** render tests for the Sub-3/4 screens and
shared components listed in the baseline above. Mock pattern: native modules (SecureStore,
Notifications, Router) mocked at the module boundary; API calls mocked via
`vi.mock()` (or `jest.mock()`); TanStack Query `QueryClientProvider` wrapped around
renders via a test helper.

### Layer 2 — Android Emulator Environment

A scripted, documented AVD provisioning sequence for the Linux dev machine. The output
is:

1. A shell script (`scripts/setup-android-emulator.sh`) that installs Android SDK
   command-line tools, `platform-tools`, a system image, and creates an AVD. The script
   is idempotent (skips steps if already present).
2. A developer guide (`apps/mobile/docs/android-emulator-setup.md`) covering: KVM group
   membership, `ANDROID_HOME` / `ANDROID_SDK_ROOT` env var setup, PATH additions,
   running `emulator -avd HospedaAVD` + `adb wait-for-device`, and the
   `10.0.2.2`-vs-`localhost` networking note (from the emulator, the host machine is
   reachable at `10.0.2.2`, not `localhost`).
3. Integration with the existing `pnpm cli` interactive menu (a new `mobile:emu:start`
   entry that starts the AVD) — or a documented alias, whichever fits the CLI tooling
   pattern used elsewhere in the repo.

The AVD is used for local Maestro runs and, optionally, for the emulator-in-CI job
(Layer 4).

### Layer 3 — E2E Mobile (Maestro)

Maestro is a standalone CLI tool (not a Node package) that drives a running Expo dev
build (or a production APK) via Accessibility IDs (`testID` props on RN components).
YAML flow files live in `apps/mobile/e2e/` and are run with `maestro test`.

**Critical flows to cover in v1:**

| Flow | File | Description |
|---|---|---|
| Auth — sign-in | `e2e/auth/sign-in.yaml` | Enter credentials, assert home screen renders |
| Auth — session persist | `e2e/auth/session-persist.yaml` | Kill and relaunch app, assert no sign-in screen |
| Auth — sign-out | `e2e/auth/sign-out.yaml` | Sign out, assert sign-in screen |
| Host — ficha list | `e2e/host/ficha-list.yaml` | Navigate to fichas, assert at least one card renders |
| Host — ficha edit | `e2e/host/ficha-edit.yaml` | Open a ficha, edit a field, save, assert success |
| Host — consulta reply | `e2e/host/consulta-reply.yaml` | Open a thread, send a reply, assert message appears |
| Profile — edit | `e2e/profile/profile-edit.yaml` | Edit display name, save, assert updated value |
| i18n — language switch | `e2e/settings/language-switch.yaml` | Switch language to EN, assert a known string changes |

`testID` props must be added to the relevant RN elements in the screens during this
spec's implementation — this is required for Maestro to locate elements by ID.

A Maestro workspace configuration (`apps/mobile/e2e/.maestro/config.yaml`) sets the
app bundle ID and default device/port so individual flow files need no repeated setup.

### Layer 4 — CI Integration

**Fast lane (every PR):** The existing `turbo run test` in `.github/workflows/ci.yml`
is extended with a dedicated `mobile-test` job that runs logic tests + RNTL component
tests. No emulator or device required. Runs on `ubuntu-latest`. Separated from the
existing 4-way sharded unit test job so mobile failures are reported discretely and
the shard job does not pick up RNTL test files that require the RN environment.

**Slow lane (emulator + E2E):** A new `.github/workflows/mobile-e2e.yml` workflow
triggered on the `mobile-e2e` label applied to a PR, or on a nightly schedule
(`0 2 * * *`). It:

1. Starts an Android emulator using `reactivecircus/android-emulator-runner@v2`
   GitHub Action (standard action for emulator-in-CI).
2. Installs the Maestro CLI.
3. Builds an Expo dev client APK (or uses a pre-built APK from EAS if `eas init`
   is done by the time this runs).
4. Installs the APK on the emulator and runs `maestro test apps/mobile/e2e/`.

The emulator-in-CI job is expected to take 15-25 minutes and costs GitHub Actions
minutes. It is deliberately not run on every PR to contain cost and avoid flakiness
blocking routine work.

**EAS Build skeleton (gated):** A job stub in `mobile-e2e.yml` that calls
`eas build --platform android --profile preview` is added but gated behind
`if: false` (or a separate `mobile-eas-build` label) until the owner runs `eas init`
and sets the EAS projectId and secrets. The skeleton documents the required secrets
(`EXPO_TOKEN`, `EXPO_PUBLIC_API_URL`, etc.) in comments.

---

## Reuse boundary

### Reused as-is

| Existing asset | Role in this spec |
|---|---|
| `vitest 3.2.6` | Logic tests continue unchanged; optionally extended with RN environment |
| `@biomejs/biome` | Lints new test files, E2E YAML files excluded from biome |
| `apps/mobile/src/__mocks__/` pattern (if already present) | Extended with Expo module mocks |
| `.github/workflows/ci.yml` sharded test job | Unchanged; new `mobile-test` job added alongside |
| `apps/e2e/` Playwright E2E for web | Unchanged; mobile E2E is a separate directory |

### New

| New asset | Purpose |
|---|---|
| `@testing-library/react-native` | Component render test API |
| Vitest RN environment (Option A) or `jest-expo` (Option B) | Test runner for `.test.tsx` files |
| `apps/mobile/src/__mocks__/` manual mocks | Expo module stubs for RNTL |
| `scripts/setup-android-emulator.sh` | Idempotent AVD provisioning for Linux |
| `apps/mobile/docs/android-emulator-setup.md` | Developer guide for emulator env |
| Maestro CLI (installed standalone) | E2E flow runner |
| `apps/mobile/e2e/` | Maestro YAML flows + workspace config |
| `.github/workflows/mobile-e2e.yml` | Slow-lane E2E CI workflow |
| `testID` props on RN elements | Required for Maestro element targeting |

---

## User Stories & Acceptance Criteria

### Layer 1 — Component / Render Tests

**US-R1** — A developer can render any Sub-3/4 screen in a test and assert on its
output without running a device or emulator.

- AC-R1.1: `pnpm --filter=mobile test` runs RNTL component tests alongside existing
  logic tests. Both pass in a single run (or in their respective runners if Option B
  is adopted). The test command exits `0` when all pass.
- AC-R1.2: A component test for `AuthButton` renders the component, finds the button
  by text or `testID`, and asserts the `onPress` handler is called when pressed. This
  test passes without a device.
- AC-R1.3: A component test for `ProfileScreen` renders the screen inside a
  `QueryClientProvider` wrapper, stubs the `useQuery` response, and asserts that the
  user's display name appears on screen.
- AC-R1.4: A component test for the host dashboard (`app/(host)/index.tsx`) stubs the
  dashboard data hook response and asserts the consultation count and active fichas
  count are displayed.
- AC-R1.5: Expo native modules (`expo-secure-store`, `expo-notifications`,
  `expo-router`, `expo-constants`) are mocked at the module boundary. A test that
  imports a component using those modules does NOT throw "module not found" or native
  bridge errors.
- AC-R1.6: The `locale-context.tsx` locale provider is wrappable in tests. A component
  test that renders a translated string can assert its Spanish (`es`) value without a
  running app.

**US-R2** — A developer can add a new RNTL test for a new screen following a single
documented pattern (no guessing about setup, mocks, or providers).

- AC-R2.1: `apps/mobile/docs/testing-guide.md` exists and documents: (a) which
  packages are installed and why, (b) the `renderScreen(component, options)` test
  helper that wraps renders with all required providers, (c) the mock directory
  structure and how to add a new Expo module mock, (d) how to run only component
  tests, (e) one complete annotated example.
- AC-R2.2: The `renderScreen` test helper is exported from
  `apps/mobile/src/test-utils/render.tsx` (or equivalent path). Its signature accepts
  a React element and optional `queryClientOptions`. It returns the RNTL `RenderResult`
  so callers can use `getByText`, `getByTestId`, `fireEvent`, etc. directly.
- AC-R2.3: A junior developer reading `testing-guide.md` can write a passing test for
  a new screen without consulting anyone. The guide answers: "Where do I put the
  file?", "How do I mock the API call?", "How do I simulate a button tap?", and "How
  do I assert navigation?".

**US-R3** — The CI pipeline reports RNTL test failures distinctly from logic test
failures, and does not block on emulator availability.

- AC-R3.1: The GitHub Actions `mobile-test` job (or equivalent job name) appears in
  the PR status checks. It runs on `ubuntu-latest` with no Android SDK or emulator
  installed.
- AC-R3.2: If one RNTL test fails, the `mobile-test` job fails and the PR is blocked
  (CI-pass gate fails). The failure output includes the component name and assertion
  message, not a cryptic environment error.
- AC-R3.3: The existing 4-way sharded `test-unit` job is NOT modified to include RN
  environment setup. Mobile RNTL tests run in the dedicated `mobile-test` job only.

### Layer 2 — Android Emulator Environment

**US-E1** — A developer can provision an Android emulator on the Linux dev machine
by running one script, without manual Android Studio installation.

- AC-E1.1: Running `bash scripts/setup-android-emulator.sh` from the repo root on a
  clean Linux machine (with KVM available and no Android SDK) installs SDK
  command-line tools to `$ANDROID_HOME` (default: `~/Android/Sdk`), downloads a
  system image (`google_apis` x86_64, API level 34), and creates an AVD named
  `HospedaAVD`.
- AC-E1.2: The script is idempotent: running it a second time on a machine that
  already has the SDK and AVD prints "already installed / already exists" for those
  steps and exits `0` without re-downloading.
- AC-E1.3: After the script completes, `emulator -avd HospedaAVD -no-snapshot-save`
  starts the emulator and it reaches the Android home screen within 3 minutes on the
  target machine (62 GB RAM, KVM).
- AC-E1.4: `adb devices` lists the running emulator as `online` (not `offline`).
- AC-E1.5: Running `expo start --android` from `apps/mobile/` with the emulator
  running successfully installs and opens the Expo dev client on the emulator.
- AC-E1.6: The developer guide (`apps/mobile/docs/android-emulator-setup.md`)
  documents the KVM group membership step (`sudo usermod -aG kvm $USER` + re-login),
  required env var exports (`ANDROID_HOME`, `ANDROID_SDK_ROOT`, PATH additions), and
  the `10.0.2.2`-vs-`localhost` networking note.

**US-E2** — A developer understands why `localhost` does not work from the emulator
and knows the correct API URL to use.

- AC-E2.1: `apps/mobile/docs/android-emulator-setup.md` explicitly states: "The
  emulator's loopback (`localhost` / `127.0.0.1`) resolves to the emulator itself,
  not the host machine. Use `10.0.2.2` as the host IP from inside the emulator."
- AC-E2.2: The same document explains how to set `EXPO_PUBLIC_API_URL` to
  `http://10.0.2.2:3001` for local dev builds targeting the dev API running on the
  host machine.
- AC-E2.3: A "common problems" section covers: emulator window does not appear
  (headless mode flag `- -no-window`), KVM permission denied (re-login after group
  add), emulator too slow (hardware acceleration verification with `emulator -accel-check`).

### Layer 3 — E2E Mobile (Maestro)

**US-X1** — A developer can run the full E2E flow suite against a locally running
Expo app on the Android emulator with one command.

- AC-X1.1: With the emulator running and the Expo dev client open,
  `maestro test apps/mobile/e2e/` executes all flows in `apps/mobile/e2e/` and
  prints a pass/fail summary per flow.
- AC-X1.2: Each of the 8 critical flows listed in the Architecture section (sign-in,
  session-persist, sign-out, ficha-list, ficha-edit, consulta-reply, profile-edit,
  language-switch) has a corresponding YAML file and passes against a locally seeded
  dev instance (`pnpm db:fresh-dev` data).
- AC-X1.3: Flows that require authentication use a dedicated E2E test user
  (e.g., `e2e-host@local.test` with a known password) whose credentials are read from
  a `.env.e2e` file in `apps/mobile/` (gitignored, documented in `.env.e2e.example`).
  The flow files reference environment variables, not hardcoded credentials.
- AC-X1.4: A flow failure prints the failed step, the element it tried to interact
  with (by `testID` or text), and a screenshot of the emulator at the time of failure
  (Maestro captures screenshots automatically on failure).

**US-X2** — The E2E flows are resilient to minor UI text changes: they locate elements
by `testID`, not by visible text, wherever possible.

- AC-X2.1: Every interactive element exercised by a Maestro flow has a `testID` prop
  set on the corresponding RN component (e.g., `testID="sign-in-email-input"`,
  `testID="sign-in-submit-button"`).
- AC-X2.2: The Maestro flows use `tapOn: { id: "sign-in-submit-button" }` (ID-based
  targeting) for all tap interactions. Text-based matching (`tapOn: "Iniciar sesión"`)
  is used only for non-interactive assertions where no `testID` is present.
- AC-X2.3: The developer guide documents the `testID` naming convention:
  `<screen-slug>-<element-role>` (e.g., `dashboard-consultations-count`,
  `ficha-edit-save-button`).

**US-X3** — A developer can add a new E2E flow for a new screen following a documented
pattern.

- AC-X3.1: `apps/mobile/docs/testing-guide.md` includes an E2E section that documents:
  (a) Maestro installation (`curl -Ls "https://get.maestro.mobile.dev" | bash`),
  (b) running a single flow (`maestro test apps/mobile/e2e/auth/sign-in.yaml`),
  (c) the workspace config (`e2e/.maestro/config.yaml`) and what bundle ID to set,
  (d) the `testID` naming convention, (e) one annotated example flow file.
- AC-X3.2: The guide specifies that `.env.e2e` holds `E2E_HOST_EMAIL`,
  `E2E_HOST_PASSWORD`, `E2E_TOURIST_EMAIL`, `E2E_TOURIST_PASSWORD`. Flow files
  reference these via Maestro's `${E2E_HOST_EMAIL}` variable syntax.
- AC-X3.3: The auth-session-persist flow (`e2e/auth/session-persist.yaml`) uses
  Maestro's `stopApp` + `launchApp` commands to simulate an app kill and cold relaunch.
  After relaunch, the flow asserts the home screen (not the sign-in screen) is
  displayed.

### Layer 4 — CI Integration

**US-C1** — Every PR to `staging` runs logic + RNTL tests in CI without a device.

- AC-C1.1: `.github/workflows/ci.yml` contains a `mobile-test` job that runs
  `pnpm --filter=mobile test` (or equivalent) on `ubuntu-latest`. This job is listed
  in the `ci-pass` gate job's `needs` array so a failing `mobile-test` blocks merge.
- AC-C1.2: The `mobile-test` job runs after the `build` job (needs the built
  `@repo/schemas` and `@repo/i18n` packages). It downloads the `build-outputs`
  artifact the same way other test jobs do.
- AC-C1.3: The `mobile-test` job does NOT install Android SDK, emulator, or Maestro.
  It only installs Node deps and runs vitest (+ jest-expo if Option B is chosen).
- AC-C1.4: A PR where one RNTL test fails shows the `mobile-test` check as failing
  in the GitHub PR status. The check name clearly identifies it as mobile (e.g.,
  "Mobile Tests").

**US-C2** — The slow E2E lane (emulator + Maestro) runs on a label or nightly
schedule, not on every PR.

- AC-C2.1: `.github/workflows/mobile-e2e.yml` is triggered by:
  (a) a PR label named `mobile-e2e` (applied manually by the author when E2E
  validation is specifically needed), OR
  (b) a `schedule` trigger at `cron: '0 2 * * *'` (nightly at 02:00 UTC).
- AC-C2.2: The `mobile-e2e.yml` workflow uses the
  `reactivecircus/android-emulator-runner@v2` GitHub Action to start an emulator
  (API 34, x86_64, no-window mode). The emulator boot step has a timeout of 5 minutes.
- AC-C2.3: After the emulator is running, the workflow installs Maestro CLI and runs
  `maestro test apps/mobile/e2e/` against the emulator. E2E credentials are read from
  GitHub Actions secrets (`E2E_HOST_EMAIL`, `E2E_HOST_PASSWORD`, etc.).
- AC-C2.4: The `mobile-e2e.yml` workflow does NOT appear in the `ci-pass` gate. A
  failure in the nightly E2E run creates a GitHub Actions run failure (visible in the
  Actions tab) but does NOT block PR merges.
- AC-C2.5: A comment at the top of `mobile-e2e.yml` explains the cost/flakiness
  tradeoff: "Emulator-in-CI adds ~20 min and introduces flakiness unrelated to code
  changes. Gate this behind a label or nightly run; do not add it to the PR fast lane."

**US-C3** — The EAS Build CI skeleton is present and documented, and can be activated
without a code change once the owner runs `eas init`.

- AC-C3.1: `mobile-e2e.yml` contains an `eas-build` job that is unconditionally
  skipped (`if: false`) until the `eas init` prerequisite is met. The job body
  contains commented-out steps for `eas build --platform android --profile preview`.
- AC-C3.2: A comment on the `eas-build` job specifies the required GitHub Actions
  secrets: `EXPO_TOKEN` (EAS authentication), `EXPO_PUBLIC_API_URL` (staging API
  URL), and any signing-related secrets.
- AC-C3.3: `apps/mobile/docs/android-emulator-setup.md` or a separate
  `apps/mobile/docs/eas-build-setup.md` documents the owner-step: "Run `eas init` from
  `apps/mobile/`, commit the `projectId` added to `app.json`, set the secrets listed
  in `mobile-e2e.yml`, then change `if: false` to `if: true` on the `eas-build` job."

---

## Suggested Tasks

### Phase 0 — Viability Spike

| ID | Title | Complexity | Depends on |
|---|---|---|---|
| T-001 | Spike: validate RNTL on vitest with Expo SDK 56 + React 19 (Option A) — render one component in a test, confirm no native-bridge errors; time-box to 4h; document result and adopt Option A or fallback to jest-expo (Option B) | 3 | — |

### Phase 1 — Component Test Foundation

| ID | Title | Complexity | Depends on |
|---|---|---|---|
| T-002 | Install and configure RNTL environment: `@testing-library/react-native` + vitest RN environment (Option A) OR `jest-expo` + RNTL (Option B) per T-001 outcome; update `vitest.config.ts` (or add `jest.config.js`); confirm `pnpm --filter=mobile test` passes | 2 | T-001 |
| T-003 | Add Expo module mocks to `apps/mobile/src/__mocks__/`: `expo-secure-store`, `expo-notifications`, `expo-router`, `expo-constants`, `expo-linking` — each mock exports the same function signatures as the real module, returning sensible stubs | 2 | T-002 |
| T-004 | Build `renderScreen` test utility (`src/test-utils/render.tsx`): wraps render with `QueryClientProvider` (isolated `QueryClient` per test), locale provider, and safe-area-context mock; export `renderScreen` and re-export RNTL utilities | 1 | T-003 |
| T-005 | Write RNTL tests for auth components: `AuthButton` (press handler, disabled state, loading indicator), `TextField` (value change, error message display) | 2 | T-004 |
| T-006 | Write RNTL tests for `ProfileScreen`: stubs `useSelfProfile` hook response, asserts display name, phone, and location render; asserts edit form appears on edit button press | 2 | T-004 |
| T-007 | Write RNTL tests for host dashboard (`app/(host)/index.tsx`): stubs `useHostDashboard` response, asserts consultation count and active fichas count render | 2 | T-004 |
| T-008 | Write RNTL tests for accommodation list (`app/(host)/accommodations/index.tsx`): stubs `useOwnAccommodations` response with 2 items, asserts both accommodation names render | 2 | T-004 |
| T-009 | Write RNTL tests for conversation list (`app/(host)/conversations/index.tsx`): stubs `useOwnerConversations` response, asserts unread badge renders when unread count > 0 | 2 | T-004 |
| T-010 | Write RNTL tests for `locale-context.tsx`: confirms locale switches update rendered text; no device required | 1 | T-004 |

### Phase 2 — Developer Guide

| ID | Title | Complexity | Depends on |
|---|---|---|---|
| T-011 | Write `apps/mobile/docs/testing-guide.md`: covers packages installed and why, `renderScreen` usage, mock directory structure, how to add a new Expo module mock, running only component tests, one complete annotated example; covers E2E section (Maestro install, run single flow, `testID` convention, workspace config, annotated example flow, `.env.e2e` variable pattern) | 2 | T-004, T-005 |

### Phase 3 — Android Emulator Environment

| ID | Title | Complexity | Depends on |
|---|---|---|---|
| T-012 | Write `scripts/setup-android-emulator.sh`: install cmdline-tools, platform-tools, `system-images;android-34;google_apis;x86_64`, create `HospedaAVD`; script is idempotent (checks existence before each step); tested by running on a clean machine or a `chroot`/container | 3 | — |
| T-013 | Write `apps/mobile/docs/android-emulator-setup.md`: KVM group step, `ANDROID_HOME`/PATH setup, starting the emulator, `adb wait-for-device`, `10.0.2.2` networking note, `EXPO_PUBLIC_API_URL` for emulator dev builds, EAS build setup stub pointer, common problems section | 1 | T-012 |

### Phase 4 — E2E Flows (Maestro)

| ID | Title | Complexity | Depends on |
|---|---|---|---|
| T-014 | Add `testID` props to all interactive elements exercised by E2E flows: auth screens (email input, password input, sign-in button, sign-up button), host dashboard (consultations count, fichas count), accommodation list (first card), accommodation edit (field input, save button), conversation list (first item), conversation thread (reply input, send button), profile edit (name input, save button), settings language selector | 3 | — |
| T-015 | Configure Maestro workspace: create `apps/mobile/e2e/.maestro/config.yaml` (bundle ID, default device), create `apps/mobile/.env.e2e.example` (E2E credential variables), add `.env.e2e` to `.gitignore` if not already present | 1 | T-014 |
| T-016 | Write auth E2E flows: `e2e/auth/sign-in.yaml`, `e2e/auth/session-persist.yaml` (stopApp + launchApp + assert home screen), `e2e/auth/sign-out.yaml` | 2 | T-015 |
| T-017 | Write host management E2E flows: `e2e/host/ficha-list.yaml`, `e2e/host/ficha-edit.yaml`, `e2e/host/consulta-reply.yaml` | 3 | T-015, T-016 |
| T-018 | Write profile and settings E2E flows: `e2e/profile/profile-edit.yaml`, `e2e/settings/language-switch.yaml` | 2 | T-015, T-016 |

### Phase 5 — CI Integration

| ID | Title | Complexity | Depends on |
|---|---|---|---|
| T-019 | Add `mobile-test` job to `.github/workflows/ci.yml`: runs on `ubuntu-latest` after `build`, downloads `build-outputs` artifact, runs `pnpm --filter=mobile test`; add `mobile-test` to `ci-pass` needs array | 2 | T-002 |
| T-020 | Create `.github/workflows/mobile-e2e.yml`: trigger on `mobile-e2e` label + nightly `cron: '0 2 * * *'`; `android-emulator-runner@v2` step (API 34, no-window); Maestro install; `maestro test apps/mobile/e2e/`; EAS build job stub with `if: false` and documented secrets; explanatory comment on cost/flakiness tradeoff | 3 | T-019, T-017, T-018 |

### Phase 6 — Cleanup and Docs

| ID | Title | Complexity | Depends on |
|---|---|---|---|
| T-021 | Update `apps/mobile/vitest.config.ts` comment to reflect resolved T-013 scope (RNTL now active); update root `CLAUDE.md` mobile testing note if applicable | 1 | T-002 |
| T-022 | Add "Mobile Testing" section to `apps/mobile/CLAUDE.md` (if that file exists) or create it: summarize the three layers, point to `docs/testing-guide.md`, list the `testID` naming convention | 1 | T-011 |

---

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| RNTL on vitest incompatible with Expo SDK 56 / React 19 (Option A fails) | Medium | Medium | T-001 time-boxes the spike to 4h; Option B (jest-expo) is the documented fallback; only the runner changes, not the test content |
| jest + vitest coexistence causes import confusion (Option B) | Low | Medium | Strictly separate file globs (`.test.tsx` for jest, `.test.ts` for vitest); biome lint catches cross-runner imports; document clearly in testing guide |
| Expo module mocks drift from actual module API as Expo SDK upgrades | Medium | Low | Mocks are explicit stubs with JSDoc referencing the Expo version they were written against; review in each Sub-spec that bumps Expo SDK |
| Emulator-in-CI flakiness (boot timeout, device-not-found, test timing) | High | Low | Slow lane is NOT in the `ci-pass` gate; flaky E2E run creates noise but does not block PRs; emulator boot timeout set to 5 minutes |
| Maestro flow fragility from UI text changes | Medium | Medium | `testID`-based targeting (US-X2) minimizes text-change fragility; text-based assertions used only for read-only content verification |
| iOS coverage unavailable (no macOS on dev machine or CI) | High (certain) | Medium | Documented as a constraint, not a failure. Note: add an `macos-latest` CI runner to the slow lane when an Apple Silicon GitHub Actions runner is available (priced separately) |
| `eas init` prerequisite blocks EAS-based APK builds in CI | High (currently blocked) | Low | EAS build CI job ships with `if: false`; local Expo dev build is sufficient for Maestro flows; owner unblocks when ready |
| `10.0.2.2` networking assumption breaks in non-standard emulator configs | Low | Low | Document the assumption and the override (`EXPO_PUBLIC_API_URL`) clearly; the env var is the escape hatch |

---

## Out of Scope

- Implementing any new app feature (screens, API calls, navigation routes). This spec
  only adds test infrastructure.
- iOS simulator setup or iOS E2E flows. macOS is required for the iOS simulator and
  is not available on the Linux dev machine. iOS coverage is tracked as a future
  enhancement.
- Running `eas init` or setting up Apple/Google developer accounts. Those are owner
  operational steps documented as prerequisites.
- Playwright web E2E (`apps/e2e/`). Web E2E is unchanged by this spec.
- Performance benchmarking or load testing of the mobile app.
- Visual regression testing (screenshot diffing). Out of scope for v1; can be added
  via Maestro's screenshot capture or a separate tool later.
- Sentry / PostHog integration for test failure reporting. Out of scope.
- Unit test coverage for Sub-1 (tourist/discovery) or Sub-2 (Tarjeta) screens — those
  do not exist yet. This spec establishes the patterns; Sub-1/2 apply them when
  implementing their screens.
- Changing the vitest shard strategy for the existing `test-unit` CI job.

---

## Open Questions / Micro-Decisions

### OQ-1 — RNTL on vitest vs jest-expo (T-001 outcome gates everything)

The question: can a custom vitest environment simulate the React Native JS environment
reliably for RNTL with Expo SDK 56 and React 19?

*Option A — RNTL on vitest:* adds a community vitest environment (e.g.,
`vitest-react-native`) or a custom one. Pros: one test runner, consistent with the
repo standard, one `test` script per package. Cons: the community environment may lag
Expo SDK releases; less official support than jest-expo; failure modes may be
surprising.

*Option B — jest-expo + vitest coexist:* `jest-expo` is the officially supported RN
test preset from the Expo team. Pros: best-effort forward compatibility with Expo SDK,
well-documented. Cons: introduces Jest as a second test runner alongside vitest;
requires separate config and separate CI invocations; creates "which runner does this
test belong to?" ambiguity for future contributors.

**Decision gate:** T-001 must be completed first. If Option A renders a component
reliably and the mock setup is manageable within the 4h spike, adopt Option A. If
Option A fails (native-bridge errors, environment instability, or incompatibility with
Expo's module registry), adopt Option B. Document the outcome in the task progress
notes before opening a PR.

### OQ-2 — Emulator-in-CI: yes for nightly, but when to run on PRs?

The nightly schedule is the default slow lane. The `mobile-e2e` label gives PR authors
an opt-in. A third option is to run E2E on every PR targeting `main` (not `staging`) —
this would add ~20 min to every main-targeting PR but give stronger guarantees before
promotion. Recommendation: keep the label + nightly model for now; revisit if main
promotions frequently introduce E2E regressions.

### OQ-3 — Maestro vs Detox

*Maestro:* standalone CLI, YAML flows, no native build configuration, works on any
running app (dev client or release APK), minimal setup, good for BDD-style flows.
Cons: less mature API access (cannot call app internals), limited to black-box flows.

*Detox:* gray-box, deeply integrated with the React Native bridge, can intercept
network calls and seed state programmatically, synchronizes with JS event loop so
flows are less flaky. Cons: requires a dedicated "detox build" (separate from dev
client), significantly more complex setup (native build scripts, `detox init`,
`DetoxTest` infrastructure), heavier CI footprint, harder to onboard for contributors
unfamiliar with native build tooling.

**Recommendation: Maestro.** The Hospeda mobile app is early-stage (Sub-0/3/4
merged, Sub-1/2 not started). The critical flows (auth, host management, profile,
language switch) are all black-box testable. The Detox gray-box advantage (state
seeding via bridge) matters more for apps with complex local state that is hard to
set up through the UI — Hospeda mobile fetches all state from the API, which can be
seeded with `pnpm db:fresh-dev`. Adopt Maestro now; revisit Detox if flows become
too flaky or the app needs bridge-level test seeding.

### OQ-4 — iOS coverage strategy

No macOS on dev machine, no macOS GitHub Actions runner in the current CI config.
Options: (a) defer iOS entirely (current recommendation — document as constraint),
(b) add a `macos-latest` runner to the `mobile-e2e.yml` nightly job when budget
allows (GitHub-hosted macOS runners are priced at ~10x ubuntu), (c) use a physical
iOS device with Maestro's device-attach mode (requires macOS host for ADB-equivalent).
No decision needed now — iOS is out of scope for this spec.

---

## Dependencies

### Other Hospeda specs

| Spec | Relationship |
|---|---|
| SPEC-243 (Mobile App, Sub-0/3/4) | This spec builds test infrastructure for what Sub-0/3/4 delivered. No code changes to Sub-0/3/4 except adding `testID` props (T-014). |
| SPEC-243-Sub-1, Sub-2 | Consumers: Sub-1/2 apply the RNTL patterns from this spec when building tourist/Tarjeta screens. This spec must complete (or at least Phase 1-2) before Sub-1/2 can write component tests. |
| SPEC-244 (Test Suite Order Independence) | Orthogonal: SPEC-244 targets the existing vitest suite order-independence. SPEC-245 adds a new test category. No conflict, but both touch CI config — coordinate to avoid simultaneous `ci.yml` edits. |

### External dependencies

| Dependency | Purpose | Risk |
|---|---|---|
| `@testing-library/react-native` | RNTL render API | Low — stable, widely used |
| vitest RN environment (Option A) | Custom vitest environment for RN | Medium — community-maintained, may lag Expo SDK |
| `jest-expo` (Option B fallback) | Official Expo test preset | Low — maintained by Expo team |
| Maestro CLI | E2E flow runner | Low — standalone CLI, no npm dep |
| `reactivecircus/android-emulator-runner@v2` | GitHub Action for emulator-in-CI | Low — widely used in RN projects |
| Android SDK cmdline-tools (API 34) | Required for emulator | Low — standard Google toolchain |
| KVM on Linux dev machine | Hardware-accelerated emulator | Low — already confirmed present |
