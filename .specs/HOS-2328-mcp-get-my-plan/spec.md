---
linear: HOS-2328
statusSource: linear
title: "MCP: get_my_plan, the owner's plan and subscription (read)"
type: feature
areas: [api, billing]
parent: HOS-2335
---

# HOS-2328 — `get_my_plan`

The owner asks the assistant "what plan do I have, what does it include, when does it renew or expire". The assistant gets one answer per vertical.

This spec is a delta on **HOS-2335 §6.3**, which already designs the tool. The criteria AC-C13, C14, C15 and C15b are copied below. Decision D-5 (owner) settled the open question in the issue: it is a **separate tool**, and its reader is reused by HOS-2184 AC-16 and by the owner summary. It is not folded into AC-16.

## What changed since §6.3

- **Gate.** §6.3 waited for HOS-2066. The owner lifted that on 2026-11-19 (relayed by epica-billing). The six HOS-2066 leaves do not change how plan state is read:
  - HOS-1512, HOS-1640 and HOS-1883 are a watch battery, admin work and analytics.
  - HOS-1749 and HOS-1761 are merged.
  - HOS-1715 (now HOS-2116) writes `addon_instance.ends_at` for recurring add-ons. Until it lands, a recurring add-on has no end date, so the tool shows such add-ons as "renews with the subscription" and never invents a date.
- **AC-C33 is in scope.** It was moved here from HOS-2331, which means `get_owner_summary` gains its `subscription` block in this issue.

## Tool

- **Name and kind.** `get_my_plan`: read only, `emailUnverifiedOperation: 'READ_OWN'`.
- **Permission.** It requires `BILLING_VIEW_OWN`, like `GET /protected/billing-subscription/`. Without that permission the tool refuses with the standard denial and records no data.
- **Input.** `{ vertical?: 'accommodation' | 'venue' | 'experience' | 'tourist' | 'partner' }`.
- **Output.** One item for each vertical where the owner holds a live title or a trial:
  - `vertical`;
  - `plan { slug, name, version }`, where `name` is the catalog row's name with the `billing.plan.<slug>.name` label when one exists. It never comes from a code map (HOS-1967);
  - `status`: the subscription status, `COURTESY` or `PERMANENT_GRANT` (AC-C16), or `TRIAL` with the trial state, plus an owner-facing label (`account.json` `subscription.mine.status.*`);
  - `nextChargeAt`, `serviceEndsAt`, `graceEndsAt`, `trialDaysLeft` and `coverageEndsAt` (when a courtesy ends), each null when it does not apply;
  - `includes`:
    - entitlements as labels (`billing.json` `entitlement.<key>`);
    - limits as `{ label, value }` (`billing.json` `comparison.limitLabel.<key>`);
    - no raw key reaches the model when a label exists;
  - `addons[]`: `{ name, status, endsAt | null }`, plus `listingGone: true` on a listing add-on whose listing no longer exists or is no longer the owner's (it may still be charged until billing cancels it, so it is never hidden). Such an add-on goes to its product's only compatible vertical; when the product fits several, it goes to a top-level `unattributedAddons` with `addonsUrl`, never to every vertical. A held add-on whose verticals have no item (the title lapsed) also goes to `unattributedAddons`, once;
  - `actionUrl`: the portal `subscription` destination. When add-ons are held it also carries `addonsUrl` (the portal `addons` destination).
- **No title.** The result is an empty list with the `plans` link (AC-C15). It is not an error.

## Source (C-6, thin adapters)

1. **Extract the reader.** Move `readOwnSubscriptions` and `readOwnDeferredCourtesies` out of `apps/api/src/routes/billing-subscription/` into one service-level reader, `readOwnPlanState`. The route `read-mine.ts` then calls that reader, and its responses stay byte-identical.
2. **Trial.** The trial comes from `readTrialSummary`, the service behind `GET /protected/publish/trial-summary/{vertical}`.
3. **Includes.** They come from `getListingAccessPorts().effectiveSet` plus `toEffectiveSetView`: the cached effective set, per user and vertical.
4. **Add-ons.** They come from the reader behind `GET /billing-addon/instances`.
5. **Courtesy and permanent grant (AC-C16).** They come from billing's own `coverage(user, vertical)` (`getListingAccessPorts().billing.coverage`, contract §2): its `COURTESY` and `GRANT` sources. The plan is the catalog row of the plan version the source points at (`readPlanOfVersion`). `includes` still come from the effective set.

The tool never reads raw tables.

## Precedence (AC-C16)

One item per vertical, never two. The first that applies wins:

1. **A live principal subscription**, unless a courtesy is what pauses it. The owner pays for it, and its status says what is happening.
2. **A permanent grant.** It never ends, and its anchor is the floor the effective set resolves from. A grant also cancels the owner's subscriptions and closes their courtesies when it is given (S13), so it rarely meets them.
3. **A courtesy.** It is the reason the subscription is paused, and it ends on a date (`coverageEndsAt`).
4. **A running trial.** It is free and short. Anything above covers the owner more durably.
5. **A courtesy-paused subscription whose courtesy billing no longer reports.** It is shown as the `PAUSED` subscription it is, rather than dropped.

## Wiring a new tool

These files must change:

- the registry;
- `MCP_TOOL_NAMES`;
- `account.json` `tools.get_my_plan` (es, en, pt), the label shown in the history;
- `admin-filters.json`;
- `NO_RESOURCE_INPUT_TOOLS`, with a reason;
- `apps/api/docs/mcp-server.md`.

## Acceptance criteria

- **AC-C13:** Given an owner with an active accommodation subscription and a venue trial, then both verticals are returned with status, dates, trial days left and catalog-sourced includes.
- **AC-C14:** Changing a plan version's entitlement rows in the catalog changes `includes` with no code change. The test edits the catalog fixture.
- **AC-C15:** Given an owner with no title, the result is empty with a link to plans. It is not an error.
- **AC-C15b:** The `get_owner_summary` subscription block calls the same reader as `get_my_plan`, and a test asserts that both import the same function. HOS-2184 AC-16 has to import the same reader when it is built; the shared reader is the export it imports.
- **AC-C33:** In `get_owner_summary`, the `subscription` block for each vertical equals the `get_my_plan` output.
- **AC-P1 (new):** `GET /protected/billing-subscription/` answers exactly as before the reader extraction. A snapshot test covers it.
- **AC-P2 (new):** A recurring add-on with no `ends_at` is shown as renewing with the subscription, with no invented date. Only a live (`ACTIVE`) one renews; one still in `PENDING_AUTHORIZATION` does not.
- **AC-C16 (new, owner decision 2026-11-19):** An owner covered only by a permanent grant or a courtesy has a plan. The vertical's item shows the plan of the version the grant or courtesy points at, with the status «Acceso permanente» (`PERMANENT_GRANT`) or «Cortesía» (`COURTESY`), labelled in es, en and pt. `coverageEndsAt` is the courtesy's end, and null for a grant, which never ends. A live subscription in the same vertical wins, and there is one item per vertical (see Precedence). AC-C33 still holds.

## Out of scope

- Changing a plan or buying an add-on from the chat (NG-5). The tool links to the page instead.
- HOS-2184 phase B (AC-16 itself, and plan links in refusals).

## Smoke

`status-needs-smoke-staging`, together with AC-C33. Follow `docs/billing/smoke-checklist.md` (staging), because the tool reads billing. Run it with a real assistant (Claude.ai) as `host-basico` and as an account that has a trial.
