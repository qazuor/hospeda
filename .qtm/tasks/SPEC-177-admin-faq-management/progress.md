# SPEC-177 — Progress

## T-032 — Cleanup: full verification + close spec ✅ (2026-06-02)

**Executor:** close-out session (local isolated env, worktree `close-out-spec-158-165-177`).

Environment was set up WITHOUT `db:fresh-dev` (that script runs `docker compose down -v`,
which would wipe the shared `hospeda-postgres:5436` container used by other active
worktrees). Instead: a per-worktree DB cloned from template, recreated empty + `drizzle-kit
migrate` (versioned carril per SPEC-178) + `db:apply-extras` + `db:seed` + `db:seed:test-users`,
all scoped to the worktree DB. `hospeda_dev` verified untouched (26 destinations before/after).

### Browser smoke (admin UI) + API smoke

| Check | Result |
|-------|--------|
| Admin FAQ list renders (destinations) | ✅ after fix (see below) |
| Add FAQ via UI → appears in list | ✅ |
| Reorder UI (drag handles present) + `PATCH /reorder` endpoint | ✅ (endpoint persists for destinations + accommodations) |
| Per-row edit/delete UI | ✅ present |
| Public order reflects `display_order` ASC | ✅ (`GET /public/destinations/slug/:slug` embeds ordered FAQs) |
| Host-scope: non-owner HOST → admin FAQs of foreign accommodation | ✅ 404 NOT_FOUND (per SPEC-169 VIEW_OWN) |

### Bug found and fixed during T-032

The smoke caught a runtime crash CI could not: the admin FAQ page threw
`TypeError: faqs is not iterable`. Root cause: `useFaqs.ts` read the response
`body.data` directly, but the API returns nested envelopes (`{ data: { faqs: [...] } }`
for the list, `{ data: { faq: {...} } }` for create/update). The whole FAQ admin
feature shipped broken in #1366; CI was green because the component tests mocked the
hook output and never exercised the real parse.

Fixed in commit on `fix/SPEC-177-faq-hook-envelope`: `useFaqList`/`useFaqCreate`/
`useFaqUpdate` now unwrap the inner `faqs`/`faq` key, plus a regression test that
exercises the real envelope shape (`useFaqs.test.ts`, 4/4 green).

### Suites

- Admin regression test (`useFaqs.test.ts`): 4/4 ✅
- API e2e (FAQs in public detail, `detail-includes-faqs`): 3/3 ✅ (shared with SPEC-158)
- Admin typecheck: 0 errors; biome: clean.

**Conclusion:** all T-032 acceptance criteria met. SPEC-177 closed (32/32).
