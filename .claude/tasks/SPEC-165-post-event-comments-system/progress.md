# SPEC-165 — Post and Event Comments System — Progress

## Status: pending (0/18 tasks completed)

## Task Summary

| ID | Title | Phase | Complexity | Status | Blocked By |
|----|-------|-------|-----------|--------|-----------|
| T-001 | Add entity_comments Drizzle schema + migration + trigger | core | 3 | pending | — |
| T-002 | Implement EntityCommentModel extending BaseModel | core | 3 | pending | T-001 |
| T-003 | Add POST/EVENT _COMMENT_VIEW/MODERATE to PermissionEnum | core | 2 | pending | — |
| T-004 | Reconcile role seed grants + seed unit tests | core | 3 | pending | T-003 |
| T-005 | Create entity-comment Zod schemas (6 files) | core | 3 | pending | T-001, T-003 |
| T-006 | EntityCommentService — create + softDeleteOwn + counter | core | 4 | pending | T-002, T-005 |
| T-007 | EntityCommentService — list + moderate + hardDelete + restore | core | 4 | pending | T-006 |
| T-008 | Public API endpoints — GET comments for post + event | integration | 3 | pending | T-005, T-006, T-007, T-004 |
| T-009 | Protected API endpoints — POST comments + DELETE own | integration | 4 | pending | T-005, T-006, T-007 |
| T-010 | Admin API endpoints — recent feed + list + getById | integration | 3 | pending | T-005, T-006, T-007 |
| T-011 | Admin API endpoints — moderation + soft/hard delete + restore | integration | 3 | pending | T-010 |
| T-012 | Integration tests — all endpoint groups (AC-37) | testing | 4 | pending | T-008, T-009, T-010, T-011 |
| T-013 | i18n comments.* translation keys (es, en, pt) | integration | 2 | pending | T-005 |
| T-014 | Web comment thread component — post detail page | integration | 4 | pending | T-008, T-009, T-013 |
| T-015 | Web comment thread — event detail page (reuse) | integration | 2 | pending | T-014 |
| T-016 | Admin EDITOR card H upgrade (SPEC-155 deferred placeholder) | integration | 3 | pending | T-010, T-013 |
| T-017 | Admin moderation queue page (/admin/comments) | integration | 4 | pending | T-011, T-013 |
| T-018 | Admin comment detail page (/admin/comments/:id) | integration | 3 | pending | T-010, T-011, T-013 |

## Parallel Tracks

```
Track A (DB + Service — critical path):
  T-001 → T-002 → T-006 → T-007
                            ↓
Track B (Permissions + Seed):       → T-008, T-009, T-010 → T-011 → T-012
  T-003 → T-004

Track C (Schemas):
  T-001 + T-003 → T-005 (feeds T-006, T-007, T-008, T-009, T-010)

Track D (i18n — can start after T-005):
  T-005 → T-013 (feeds T-014, T-016, T-017, T-018)

Track E (Web — after API):
  T-008 + T-009 + T-013 → T-014 → T-015

Track F (Admin UI — after admin API):
  T-010 + T-013 → T-016
  T-011 + T-013 → T-017
  T-010 + T-011 + T-013 → T-018
```

## Critical Path

T-001 → T-002 → T-006 → T-007 → T-009 → T-014 → T-015

## Layer Distribution

| Layer | Tasks | IDs |
|-------|-------|-----|
| Layer 0-1 — DB Schema + Model | 2 | T-001, T-002 |
| Layer 1 — Permissions + Seed | 2 | T-003, T-004 |
| Layer 2 — Schemas (Zod) | 1 | T-005 |
| Layer 3 — Service Core | 2 | T-006, T-007 |
| Layer 4 — API | 5 | T-008, T-009, T-010, T-011, T-012 |
| Layer 5 — Web | 2 | T-014, T-015 |
| Layer 6 — Admin | 3 | T-016, T-017, T-018 |
| Layer 7 — i18n | 1 | T-013 |

## Session Log

| Date | Note |
|------|------|
| 2026-05-30 | Tasks generated from spec.md §12 sketch; 17 sketch tasks expanded to 18 atomic tasks (T-006 and T-007 split from original T-006; original T-009 split into T-010+T-011). |
