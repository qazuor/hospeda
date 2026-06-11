# SPEC-216 Part 0 — Entitlement catalog audit verdict

**Signed off by user 2026-06-11.** The catalog had 44 entitlements / 12 limits / 9 plans
(the CLAUDE.md "48" was stale). Before owner plans inherit the tourist-VIP set, the catalog
is pruned of entitlements describing services Hospeda (an accommodation-listings + reviews +
favorites platform) does not actually deliver.

## REMOVE (8) — user-approved

| Entitlement | Granted by (pre-prune) | Reason |
|-------------|------------------------|--------|
| `airport_transfers` | tourist-vip | Physical logistics; not deliverable |
| `concierge_service` | tourist-vip | Human concierge; does not exist |
| `white_label` | complex-premium | Multi-tenant/custom-domain infra; not built |
| `multi_channel_integration` | complex-premium | OTA channel sync; not built |
| `social_media_integration` | owner-premium, complex-premium | "Automatic publishing to social media"; not built |
| `early_access_events` | tourist-plus, tourist-vip | Event-ticket access; out of platform scope |
| `dedicated_manager` | owner-premium, complex-premium | No CS account managers (user confirmed) |
| `api_access` | owner-premium, complex-premium | API is internal-only, no public/partner surface (user confirmed) |

## KEEP (explicitly considered, retained)

- `vip_support` — priority support is deliverable via support tooling.
- `exclusive_deals` — maps to real owner promotions (`vip_promotions_access` / `create_promotions`).
- All core entitlements (favorites, reviews, stats, calendar, whatsapp, ai_*, etc.).

## Notable consequences of removal

- **Phantom gate removed:** `gateEarlyEventAccess` in `apps/api/src/middlewares/tourist-entitlements.ts`
  (a placeholder gate not wired to a live route) is deleted with `early_access_events`.
- **Social-link fields ungated:** `facebookUrl` / `instagramUrl` / `twitterUrl` in the admin
  accommodation form were gated behind `SOCIAL_MEDIA_INTEGRATION` (a mis-gate — the entitlement
  was about *automatic publishing*, the fields are just contact links). With the entitlement
  removed, these fields become ungated (available to all owners). This is the intended
  resolution; social links are basic contact info, not a premium feature.
- `ai_support` + `max_ai_support_per_month` remain orphan (granted by no plan, pending SPEC-200) — left as-is.

## Files touched by the prune (21)

billing core (`entitlement.types.ts`, `entitlements.config.ts`, `plans.config.ts` + billing
tests + new `entitlement-prune.test.ts`); i18n (`{es,en,pt}/billing.json` + regenerated
`types.ts`); admin (`plan-entitlement-groups.ts`, `host.ts`, `contact-info.consolidated.ts`,
test mocks); api (`tourist-entitlements.ts` + 4 test files); service-core test fixture;
`docs/billing/endpoint-gate-matrix.md`.

After the prune, the kept `tourist-vip` entitlements become `TOURIST_VIP_ENTITLEMENTS`
(the set owner/complex plans inherit in Phase B).
