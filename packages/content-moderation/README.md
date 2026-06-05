# @repo/content-moderation

Shared content moderation package for the Hospeda platform. Evaluates text
content against objectionable-content criteria and returns a structured score
that consumers map to their own moderation actions.

> **Engine status**: the v1 implementation is a deterministic stub backed by
> environment-variable blocklists. The real scoring engine (graded categories,
> ML-based scoring, DB-backed editable word lists) will land in **SPEC-195**
> with **no changes to the public API described here**. The contract is stable;
> only the internals will be replaced.

---

## Quick Start

```ts
import { moderateText, moderateTextInputSchema } from '@repo/content-moderation';
import type { ModerationResult, ModerateTextInput } from '@repo/content-moderation';

// Validate input at a route/service boundary:
const input = moderateTextInputSchema.parse({ text: reviewBody, context: 'review' });

// Always await — the contract is async from day one:
const result = await moderateText(input);

if (result.score >= 0.5) {
  // Force the review into PENDING state
}
```

---

## Public Contract

All exported names listed here are **stable**. Internal implementation details
(how the stub works, the `_testResetBlocklists` escape hatch) are NOT part of
the public contract and may change.

### `moderateText(input: ModerateTextInput): Promise<ModerationResult>`

Evaluates text and returns a structured moderation result.

| Parameter | Type | Description |
|-----------|------|-------------|
| `input.text` | `string` (non-empty) | The text to evaluate. Leading/trailing whitespace is preserved as-is. |
| `input.context` | `'review' \| 'message' \| 'post' \| string` (optional) | Hint for which blocklist context to use. Open union so future contexts can be added without a breaking type change. |

**Throws** if `input` fails Zod validation (e.g. empty `text` string). Use
`moderateTextInputSchema.parse(input)` at route/service boundaries.

**Always `async`.** Even though the v1 stub runs synchronously internally, the
function signature returns `Promise<ModerationResult>` so call sites `await` it
from day one. When the real async engine (SPEC-195) replaces the stub the
call-site contract never changes.

### `ModerationResult` (type)

The value returned by `moderateText`. All fields are `readonly` — treat it as
an immutable value object.

```ts
type ModerationResult = {
  /** Overall severity in [0, 1]. 0.0 = clean. 1.0 = definite match. */
  readonly score: number;

  /**
   * Per-category severity in [0, 1].
   * v1 stub: only `categories.other` is non-zero on a match.
   * Real engine (SPEC-195): all categories will be populated.
   */
  readonly categories: Readonly<Record<ModerationCategory, number>>;

  /**
   * Terms or domain strings whose presence triggered score > 0.
   * Empty array when score === 0.
   * Used to populate audit logs or surface hints to human moderators.
   */
  readonly matchedTerms: readonly string[];
};
```

### Score semantics

| Score | Meaning |
|-------|---------|
| `0.0` | No objectionable content detected. |
| `1.0` | Definite match (blocked word or domain present in v1 stub). |
| `(0, 1)` | Graded result — produced by the real engine (SPEC-195); not emitted by the v1 stub. |

**Recommended consumer threshold**: `score >= 0.5` forces a review into
`PENDING`. This is the threshold used by `resolveInitialModerationState` in
`@repo/service-core` (constant `MODERATION_PENDING_THRESHOLD = 0.5`). The
stub's binary output (`0.0` or `1.0`) maps cleanly to this: a clean text
produces `0.0` (below threshold, use entity default), a blocked term produces
`1.0` (above threshold, force PENDING).

### `ModerationCategory` (type)

```ts
type ModerationCategory =
  | 'spam'
  | 'sexual'
  | 'violence'
  | 'hate'
  | 'harassment'
  | 'other';
```

The v1 stub populates only `other`. The real engine (SPEC-195) will distribute
scores across all categories.

### `ModerateTextInput` (type)

Input type accepted by `moderateText`. All fields are `readonly`.

### `moderateTextInputSchema` (Zod schema)

Zod schema for `ModerateTextInput`. Validates `text` (non-empty string) and
`context` (optional string, no enum constraint so future contexts work without a
schema update).

Use at route/service boundaries:

```ts
const parsed = moderateTextInputSchema.parse({ text: body, context: 'review' });
const result = await moderateText(parsed);
```

### `ModerateText` (function type)

```ts
type ModerateText = (input: ModerateTextInput) => Promise<ModerationResult>;
```

The function signature as a named type. Useful for dependency injection or
mocking in tests.

---

## Configuration (Environment Variables)

The v1 stub reads two environment variables **once at module load**. Changes
after process startup have no effect in production code.

| Variable | Format | Example | Description |
|----------|--------|---------|-------------|
| `HOSPEDA_MESSAGING_BLOCKED_WORDS` | CSV of substrings (case-insensitive) | `"spam,badword,forbidden"` | Matched via substring scan of the full text. |
| `HOSPEDA_MESSAGING_BLOCKED_DOMAINS` | CSV of domain names | `"spam.com,evil.org"` | Matched against hostname of any `http://` / `https://` URL in the text. Sub-domains are included (e.g. `sub.spam.com` matches `spam.com`). |

**Both variables are optional.** If absent the stub behaves as if the lists are
empty and returns `score: 0` for all inputs.

These variables are registered in `packages/config/src/env-registry.hospeda.ts`
and validated in `apps/api/src/utils/env.ts` (`ApiEnvBaseSchema`).

---

## v1 Stub Behavior

The v1 implementation runs synchronously and produces binary output:

- Any blocked word (case-insensitive substring match) in the text → `score: 1.0`,
  `categories.other: 1.0`, all other categories `0`, `matchedTerms` lists every
  matched word.
- Any blocked domain in a `http://`/`https://` URL in the text → same result,
  `matchedTerms` lists every matched domain.
- Multiple matches → all matched terms accumulated in `matchedTerms`.
- No match → `score: 0`, all categories `0`, `matchedTerms: []`.

**All returned objects are frozen** (`Object.freeze`) — mutation attempts are
silently ignored in non-strict mode and throw in strict mode.

---

## What Changes in SPEC-195

SPEC-195 (content-auto-moderation) will replace the stub internals with:

- A graded scoring engine (OpenAI Moderation API or equivalent).
- DB-backed editable word/domain lists (no redeploy needed to update them).
- Population of all `ModerationCategory` fields, not just `other`.

**No consumer-facing API changes.** The same `moderateText` import, the same
`ModerationResult` shape, the same `score` threshold logic — all unchanged.

---

## Testing

Tests live in `packages/content-moderation/test/`.

```bash
pnpm test            # run tests (from this package or repo root)
pnpm test:coverage   # coverage report
```

To override env vars in tests use `vi.stubEnv` followed by
`_testResetBlocklists()` (imported directly from `src/moderate-text.ts`).
This escape hatch is intentionally NOT re-exported from the package barrel
(`src/index.ts`) — only test files should access it.

```ts
// In a test file that imports from src/moderate-text.ts directly:
import { moderateText, _testResetBlocklists } from '../src/moderate-text.js';

vi.stubEnv('HOSPEDA_MESSAGING_BLOCKED_WORDS', 'badword');
_testResetBlocklists();
const result = await moderateText({ text: 'contains badword', context: 'review' });
expect(result.score).toBe(1.0);
```

---

## Related

- **SPEC-166** — Review Moderation State (introduced this package).
- **SPEC-195** — Content Auto-Moderation (will replace the stub engine).
- `packages/service-core/src/services/moderation/review-moderation.helpers.ts`
  — `resolveInitialModerationState` maps the score to `ModerationStatusEnum`.
- `docs/guides/review-moderation.md` — end-to-end review moderation flow.
