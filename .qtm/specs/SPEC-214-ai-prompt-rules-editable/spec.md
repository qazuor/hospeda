---
spec-id: SPEC-214
title: Editable AI prompt rules (DB-backed, per feature)
type: feature
complexity: medium
status: draft
created: 2026-06-10T21:35:00Z
---

# SPEC-214 — Editable AI prompt rules (DB-backed, per feature)

## Overview

**Goal.** Promote the per-feature AI prompt "rules" from hardcoded prose embedded
inside each prompt's `content` string into a first-class, DB-backed, admin-editable
field, so platform admins can manage guardrails/rules independently of the
conversational prompt body.

**Motivation.** Today the "rules" (e.g. the `chat` feature's 9-item "You MUST NOT…"
block, the `search` feature's "Rules:" section) live inline inside
`DEFAULT_PROMPTS[feature]` in `packages/ai-core/src/engine/default-prompts.ts`. They
can only be changed by editing the entire `content` blob, with no separation between
"how the assistant talks" and "the hard rules it must obey". Admins need to edit
rules as a distinct field.

**Success criteria.** Each of the 4 AI features (`text_improve`, `chat`, `search`,
`support`) has a separately editable `rules` field, persisted in DB, composed into
the system prompt at runtime, with the existing default rules extracted out of the
prompt bodies. Existing behavior is preserved (same effective system prompt) when no
admin override exists.

**Locked design decisions (user, 2026-06-10).**

1. Storage: a `rules text` column on `ai_prompt_versions` (mirrors `content`, versioned together). KISS.
2. Scope: all 4 features get an editable `rules` field.
3. Backward-compat: migrate-and-clean — extract rules out of the code `DEFAULT_PROMPTS` into a parallel `DEFAULT_RULES`, and clean the rules out of the default `content`. (See Risks for the existing-DB-rows caveat.)

**Baseline.** All file refs verified against `origin/staging` @ 446aa9152 on 2026-06-10.

---

## User Stories & Acceptance Criteria

### US-1 — Admin edits rules independently of content

GIVEN an admin on the AI prompts editor (`/ai/prompts`),
WHEN they open a feature's prompt,
THEN they see two separate editable fields — `content` and `rules` — each seeded from
the active version,
AND saving creates a new version persisting both fields.

### US-2 — Rules are applied at runtime

GIVEN a feature whose active prompt version has a non-empty `rules` value,
WHEN the AI feature runs (chat / text improve / search / support),
THEN the effective system prompt includes both the `content` and the `rules`,
composed deterministically.

### US-3 — Fallback when no DB rules

GIVEN a feature with no DB prompt version, or a version whose `rules` is null,
WHEN the feature runs,
THEN the system falls back to `DEFAULT_RULES[feature]` (the extracted code defaults),
preserving the pre-migration effective prompt.

### US-4 — Existing behavior preserved

GIVEN the migration has run and no admin has edited anything,
WHEN any of the 4 features run,
THEN the composed system prompt is functionally equivalent to the pre-migration prompt
(content + rules together produce the same guardrails).

---

## Technical Approach

### Architecture / layer order (DB → schema → ai-core → API → admin)

**1. DB — `packages/db`**

- Add nullable `rules text` column to `ai_prompt_versions`.
- Structural change → `pnpm db:generate` + `pnpm db:migrate` (migrations carril, not extras).
- Existing table: `ai_prompt_versions(id, feature, version, content, is_active, created_by, timestamps)` (migration `0005_breezy_beast.sql`).

**2. Schemas — `packages/schemas/src/entities/ai/ai-prompt.schema.ts`**

- `AiPromptVersionSchema` (L27–55): add `rules: z.string().nullable()` (or optional).
- `CreateAiPromptVersionSchema` (L76–89): add optional `rules` input.

**3. ai-core storage — `packages/ai-core/src/storage/prompt.storage.ts`**

- `getActivePrompt` (~L67): select + return `rules`.
- `createPromptVersion` (~L161): accept + insert `rules`.

**4. ai-core defaults — `packages/ai-core/src/engine/default-prompts.ts`**

- Extract the rules prose out of each `DEFAULT_PROMPTS[feature]` into a new
  `DEFAULT_RULES: Readonly<Record<AiFeature, string>>`.
- Clean the extracted rules from the `DEFAULT_PROMPTS` bodies so content = conversational
  instructions only.
- Rules blocks to extract:
  - `chat`: the "You MUST NOT do any of the following…" 9-item block.
  - `search`: the "Rules:" 8-item section.
  - `text_improve`: the "Do not add amenities…/Refuse any request…" sentences.
  - `support`: the "Decline any request that asks you to act outside your support role…" sentence.

**5. ai-core resolution — `packages/ai-core/src/config/prompt-resolver.ts`**

- `ResolveSystemPromptResult` (~L100–110): add `rules: string`.
- `resolveSystemPrompt` (~L170–200): return `rules` from the DB row, or `DEFAULT_RULES[feature]` when the row is missing/blank. Keep the 5-min TTL cache covering both fields.

**6. Runtime composition (per feature)** — compose `content` + `rules` into the system prompt:

- `chat`: `apps/api/src/services/accommodation-ai-context.ts` `buildChatSystemMessage` (~L286) — insert `rules` into the composed message (after `content`, before the locale line).
- `search`: `apps/api/src/routes/ai/protected/search-intent.ts` `buildSearchIntentPrompt` (~L105).
- `text_improve`: the text-improve route/engine path.
- `support`: the support route/engine path.
- Composition rule: `content` + `"\n\n"` + `rules` (rules last, as the authoritative guardrail), preserving today's ordering where rules already come at/after the end.

**7. API — `apps/api/src/routes/ai/prompts/index.ts`**

- `POST /api/v1/admin/ai/prompts`: accept and persist `rules` via `CreateAiPromptVersionSchema`.

**8. Admin UI — `apps/admin/src/routes/_authed/ai/prompts.tsx`**

- `FeaturePromptEditor`: add a second `<Textarea>` for `rules`, seeded from `activePrompt.rules`; state becomes `{ content, rules }`; pass both in the create mutation.
- Types: `apps/admin/src/features/ai-settings/types.ts` — add `rules` to `AiPromptVersion` and `CreateAiPromptPayload`.
- Hooks: `apps/admin/src/features/ai-settings/hooks.ts` — `createAiPrompt` sends `rules`.

### Data migration (migrate-and-clean)

- **Code defaults**: deterministic — move the known rules blocks from `DEFAULT_PROMPTS` to `DEFAULT_RULES`, clean the bodies. Verified by an equivalence test (old composed prompt == new content+rules).
- **Existing DB `ai_prompt_versions` rows**: a one-time data step sets `rules = DEFAULT_RULES[feature]` for rows whose `rules` is null. The `content` of arbitrary admin-authored rows is NOT auto-parsed/stripped (unsafe); it is left intact. Where an admin row's content still contains the known default rules block verbatim, the step may strip it; otherwise it logs and leaves content untouched. (See Risks.)

### Patterns / constraints

- No `any`; `import type`; named exports; Zod as source of truth; RO-RO.
- Migrations two-carriles: structural column → `db:generate`/`db:migrate`; run `db:apply-extras` after.
- `db:generate` required before the PR (drift guard).

---

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| "Clean" of existing admin DB rows can't safely parse arbitrary prose | Medium | Only strip the exact known default block; otherwise leave content intact + log. Null `rules` → fallback to DEFAULT_RULES. Check row count first (likely 0 in prod). |
| Composed prompt diverges from pre-migration behavior | High | Equivalence test per feature: assert `oldDefaultPrompt == newContent + "\n\n" + newRules` (modulo whitespace) before merge |
| Rules duplicated (in both content and rules) for un-cleaned rows | Low | Harmless (redundant guardrail); logged; admin can fix by re-saving |
| Cache returns stale rules after admin edit | Low | Existing 5-min TTL cache already covers prompt resolution; invalidate/accept TTL as today |
| Migration on prod enum/column | Low | Additive nullable column; standard `db:migrate` flow; never `db:push` to VPS |

## Out of Scope

- Structured (array/jsonb) rules editing — explicitly rejected in favor of a `text` column.
- Reusable/shared rules across features (separate table) — rejected.
- Independent versioning of rules vs content — rules version with content on the same row.
- Per-rule toggling/UI beyond a textarea.

## Suggested Tasks (phased)

- **Setup/DB**: add `rules text` column + migration (`db:generate`/`db:migrate`).
- **Schema**: extend `AiPromptVersionSchema` + `CreateAiPromptVersionSchema`.
- **ai-core defaults**: extract `DEFAULT_RULES`, clean `DEFAULT_PROMPTS`, equivalence test.
- **ai-core storage**: read/write `rules` in `getActivePrompt` + `createPromptVersion`.
- **ai-core resolution**: add `rules` to result + `DEFAULT_RULES` fallback.
- **Runtime composition**: chat, search, text_improve, support compose content+rules (one task each + tests).
- **API**: accept/persist `rules` in the create endpoint (+ integration test).
- **Admin UI**: rules textarea in `FeaturePromptEditor`, types, hooks (+ component test).
- **Data migration**: backfill `rules` for existing rows (defaults + best-effort clean) (+ test).
- **Docs**: update AI prompts admin doc.

## Internal Review Notes

- **Verified on staging:** prompt model (`ai_prompt_versions`, only `content`), the 4
  `DEFAULT_PROMPTS` rules blocks, resolution/cache flow, the 9 touch-points for migration.
- **Open question for impl:** count of existing `ai_prompt_versions` rows in staging/prod —
  if 0, "migrate-and-clean" is trivial; if non-zero, apply the best-effort clean policy above.
- **Equivalence is the gate:** the per-feature equivalence test (old prompt == new content+rules)
  is the hard acceptance gate that guarantees US-4 (no behavior change).
