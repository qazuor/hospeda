# SPEC-301 — Feedback System Production Rework

**Status**: in-progress  
**Progress**: 1 / 13 tasks completed  
**Started**: 2026-06-28  
**Branch**: spec/SPEC-301-feedback-system-prod-rework  

---

## Task Summary

| ID | Title | Phase | Complexity | Status | Blocked By |
|----|-------|-------|-----------|--------|-----------|
| T-001 | Complete discovery phase and resolve open questions | setup | 1 | completed | — |
| T-002 | Add i18n keys for footer link label in @repo/i18n (es/en/pt) | core | 2 | pending | — |
| T-003 | Replace FeedbackFABClient mount with headless host in BaseLayout.astro | integration | 3 | pending | — |
| T-004 | Add 'Reportar un problema' footer link to web Footer component | integration | 2 | pending | T-002 |
| T-005 | Collapse two-step wizard into single step + collapsible expander in @repo/feedback | core | 4 | pending | — |
| T-006 | Verify and sync client feedback schema with API validation schema | core | 2 | pending | T-005 |
| T-007 | Register Turnstile env vars in @repo/config and add Zod validation to apps/web + apps/api | setup | 3 | pending | — |
| T-008 | Add invisible Cloudflare Turnstile widget to FeedbackForm client-side | integration | 3 | pending | T-005, T-007 |
| T-009 | Verify Cloudflare Turnstile token server-side in feedback submit handler | integration | 3 | pending | T-007 |
| T-010 | Remove default-on FeedbackFAB from admin __root.tsx and add equivalent entry point | integration | 2 | pending | — |
| T-011 | Write unit/component tests for slim form and schema parity | testing | 3 | pending | T-005, T-006 |
| T-012 | Write Turnstile server-verify unit tests — fail-closed path mandatory | testing | 2 | pending | T-009 |
| T-013 | Execute manual local smoke — end-to-end report to Linear with Turnstile test keys | testing | 1 | pending | T-003, T-004, T-008, T-009, T-010, T-011, T-012 |

---

## Parallel Tracks

```
Track A (Web entry point — footer):  T-002 → T-004 ──────────────────────┐
Track B (Web entry point — headless): T-003 ──────────────────────────────┤
Track C (Slim form):                  T-005 → T-006 → T-011 ─────────────┤→ T-013
Track D (Turnstile env):              T-007 → T-008 ─────────────────────┤
Track D (Turnstile server):           T-007 → T-009 → T-012 ─────────────┤
Track E (Admin alignment):            T-010 ──────────────────────────────┘
```

**Critical path**: T-005 → T-006 → T-011 → T-013 (4 tasks, highest cumulative complexity)

---

## Session Log

### 2026-06-28 — Discovery closed, tasks atomized

- Discovery phase complete. OQ-1/OQ-2/OQ-4/OQ-6 resolved, G-1..G-8 confirmed firm.
- 13 tasks generated (1 completed T-001, 12 pending).
- Key decisions locked:
  - Primary entry point: footer "Reportar un problema" link → /[lang]/feedback/
  - Slim form: type + title + description visible; Step 2 behind collapsible expander
  - Anti-spam: invisible Turnstile (server-verified, fail-closed) + existing rate limit + honeypot
  - Admin: remove default-on FAB, add equivalent entry point
  - 2 new env vars: PUBLIC_TURNSTILE_SITE_KEY (web) + HOSPEDA_TURNSTILE_SECRET_KEY (api)
  - No DB migration needed (Linear remains destination)

---

## Key Risks to Watch

- **R-2 Spam (Turnstile fail-closed)**: T-009 must reject on missing secret key. T-012 test case 3 enforces this. Non-negotiable.
- **R-4 Schema / API drift**: T-006 must run immediately after T-005 to catch any field mismatch before Turnstile token is wired in T-008.
- **Sentry correlation**: T-003 headless host must preserve the getSentryEventId / onSentryFeedback bridge — verify during implementation before T-013 smoke.
- **reporterEmail/reporterName server-required**: confirmed by spec.md §10 audit note — T-006 must NOT relax these to optional server-side.
