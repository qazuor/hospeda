# SPEC-092 — TODOs

## E2E from SPEC-096 (REQ-096-39, source: SPEC-096 T-070)

SPEC-092 does not currently have a `state.json` task tracker (no `.claude/tasks/SPEC-092-e2e-test-suite/` directory at the time SPEC-096 T-070 ran).

When tasks are generated for SPEC-092 (e.g., via `/task-master:task-from-spec`), the 10 E2E entries documented in `spec.md` under section **"E2E from SPEC-096"** MUST be appended as tasks. Suggested task IDs: `T-100` through `T-109` (or the next free range above the highest existing T-### at the time of generation).

### Task template (one per entry)

For each of E2E-1 through E2E-10:

```json
{
  "id": "T-1NN",
  "title": "E2E-N: <description from spec.md>",
  "description": "<detailed steps from spec.md / REQ-096-39>",
  "status": "pending",
  "complexity": 3,
  "tags": ["e2e", "from-spec-096"],
  "phase": "spec-096-e2e",
  "blockedBy": [],
  "qualityGate": { "lint": false, "typecheck": false, "test": false },
  "createdAt": "<ISO timestamp at generation time>",
  "updatedAt": "<ISO timestamp at generation time>"
}
```

### The 10 entries

1. **E2E-1**: Anonymous browse → search → results → entity detail → contact form.
2. **E2E-2**: Signup → onboarding → publish → `mi-cuenta/propiedades` visible.
3. **E2E-3**: Authenticated favorite toggle on accommodation → `/mi-cuenta/favoritos` shows it → remove → empty state.
4. **E2E-4**: Authenticated review submission → `/mi-cuenta/resenas` shows it → click entity → detail.
5. **E2E-5**: Profile edit on web → save → admin `/me/profile` reflects changes.
6. **E2E-6**: Profile edit on admin → save → web `/mi-cuenta/editar` reflects changes.
7. **E2E-7**: Theme toggle in web → admin `themeAdmin` unchanged.
8. **E2E-8**: Subscription cancel flow → status update → email sent.
9. **E2E-9**: 404 on broken link → 0 broken links exist (regression of audit).
10. **E2E-10**: Filter sub-route → ISR cache hit on second visit.

### Cross-reference

- Source spec: `.claude/specs/SPEC-096-web-beta-readiness/spec.md` (REQ-096-39)
- Source task: SPEC-096 T-070
- Target spec section: `.claude/specs/SPEC-092-e2e-test-suite/spec.md` → "E2E from SPEC-096"
