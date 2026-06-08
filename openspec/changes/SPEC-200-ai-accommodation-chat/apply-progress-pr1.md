# Apply Progress — SPEC-200 PR 1 (backend slice)

## Change

- **Change**: `SPEC-200-ai-accommodation-chat`
- **Slice**: PR 1 — backend
- **Mode**: Strict TDD
- **Workload mode**: chained PR slice (`stacked-to-main` strategy recorded in tasks artifact)
- **Status**: T-001..T-005 complete, T-006 pending manual staging smoke

## Completed Tasks

- [x] T-001 — `AiChatRequestSchema` + SSE final-meta schema in `@repo/schemas`
- [x] T-002 — `assembleAccommodationContext` service + unit tests
- [x] T-003 — `persistChatTurn` helper + unit tests
- [x] T-004 — `POST /api/v1/protected/ai/chat` SSE route + integration tests + PostHog hooks
- [x] T-005 — protected-AI barrel wiring for `/chat`

## TDD Cycle Evidence

| Task | RED | GREEN | REFACTOR | Evidence |
|------|-----|-------|----------|----------|
| T-001 | ✅ | ✅ | ✅ | `packages/schemas/src/entities/ai/__tests__/ai-chat.schema.test.ts` — 31/31 pass |
| T-002 | ✅ | ✅ | ✅ | `apps/api/test/services/accommodation-ai-context.test.ts` — 17/17 pass |
| T-003 | ✅ | ✅ | ✅ | `apps/api/test/services/ai-chat-persistence.test.ts` — 5/5 pass |
| T-004 | ✅ | ✅ | ✅ | `apps/api/test/integration/ai/chat-route.test.ts` — 14/14 pass |
| T-005 | ✅ | ✅ | ✅ | Barrel slot verified before wiring; chat integration suite still green after mount |

## Files Changed

| File | Action | Notes |
|------|--------|-------|
| `packages/schemas/src/entities/ai/ai-chat.schema.ts` | Created | Request/body + done-meta schema for chat |
| `packages/schemas/src/entities/ai/__tests__/ai-chat.schema.test.ts` | Created | T-001 schema coverage |
| `packages/schemas/src/entities/ai/index.ts` | Modified | Re-exported chat schema |
| `apps/api/src/services/accommodation-ai-context.ts` | Created | Context assembly + system prompt builder |
| `apps/api/test/services/accommodation-ai-context.test.ts` | Created | T-002 unit coverage |
| `apps/api/src/services/ai-chat-persistence.ts` | Created | Conversation/message persistence helper |
| `apps/api/test/services/ai-chat-persistence.test.ts` | Created | T-003 unit coverage |
| `apps/api/src/routes/ai/protected/chat.ts` | Created | Protected SSE chat endpoint |
| `apps/api/test/integration/ai/chat-route.test.ts` | Created | T-004 integration coverage |
| `apps/api/src/routes/ai/protected/index.ts` | Modified | Wired `/chat` slot |
| `openspec/changes/SPEC-200-ai-accommodation-chat/tasks.md` | Modified | Marked backend tasks complete |

## Verification Notes

- `pnpm --filter hospeda-api exec vitest run --config vitest.config.e2e.ts test/integration/ai/chat-route.test.ts` ✅
- `pnpm --filter hospeda-api test -- test/services/accommodation-ai-context.test.ts` ✅
- `pnpm --filter hospeda-api test -- test/services/ai-chat-persistence.test.ts` ✅
- `pnpm exec biome check ...` on all touched backend files ✅
- Global repo verification still blocked by pre-existing local workspace issue: `@repo/billing` is unresolved in `pnpm --filter hospeda-api typecheck` until package deps are built in this worktree, and additional pre-existing billing type errors remain outside SPEC-200 scope.

## Deviations from Design

- None in production behavior.
- Test seam deviation only: T-004 integration uses controlled stubs for `assembleAccommodationContext`, `persistChatTurn`, `createConfiguredAiService`, and PostHog so the route contract is verified without unrelated DB/provider setup. Middleware stack and SSE factory behavior remain real.

## Remaining Tasks

- [ ] T-006 — staging smoke + checklist sign-off

## Commits

- `017dc97c8` — feat(schemas): add AI accommodation chat request and SSE meta schemas (SPEC-200 T-001)
- `d21d30054` — test(schemas): add unit tests + re-export for AI accommodation chat schemas (SPEC-200 T-001)
- `469a4f9ec` — feat(api): add accommodation-AI context assembler (SPEC-200 T-002)
- `d7314e0b0` — test(api): add unit tests for accommodation-AI context assembler (SPEC-200 T-002)
- `b6d3c8cbf` — feat(api): add AI chat persistence helper (SPEC-200 T-003)
- `174c4d16b` — test(api): add unit tests for AI chat persistence helper (SPEC-200 T-003)
- `49efbe202` — feat(api): add protected AI accommodation chat SSE route (SPEC-200 T-004)
- `725b2181a` — test(api): add integration coverage for protected AI chat route (SPEC-200 T-004)
- `788864eef` — chore(api): wire protected AI chat route in barrel (SPEC-200 T-005)
