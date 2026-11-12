---
title: Chat answer polish after the model sweep
linear: HOS-2100
statusSource: linear
created: 2026-11-09
type: fix
areas:
  - api
  - ai
---

# Chat answer polish after the model sweep

## 1. Summary

Follow-ups left by HOS-2095 (the chat model sweep, round 3: 280 blind-graded
answers, gpt-5.4-nano/none 4.40, mini/none 4.61). None blocked HOS-2095's close.
This spec fixes the answer defects the blind grading kept finding, puts the
amenities of venues and experiences into the chat context, splits two files that
are over the 500-line limit, tightens the sweep's rubric regexes, and makes the
`ai_usage` rows of the listing chat follow HOS-2095's model on every write path.

## 2. Problem

Answer defects found in the round 3 grading (each one is a grade-3 pattern):

| Defect | Example |
|---|---|
| Group questions | «somos 8, ¿entramos?» → «entran sin problema», with no split by units or beds and no «confirmalo con el lugar». The most frequent grade-3 cause. |
| Mixed language | A Portuguese answer carried «así que te conviene confirmar» and the Spanish field value «pileta». |
| Grammar | «lo mejor es que lo chequear»; «voses 8» as a plural of «vos». |
| Pet quantity | «acepta mascotas» stretched to «sí, 2 perros». |
| Re-asking | The bot asks how many they are when the visitor already said it. |

Context gap: the venue and experience assemblers never read `r_venue_amenity` /
`r_experience_amenity`, so the model cannot answer «¿tiene estacionamiento?» on
those verticals.

Technical debt:

- `apps/api/src/routes/ai/protected/chat.ts` (554 lines) and
  `packages/ai-core/src/engine/default-prompts.ts` (594 lines) exceed 500 lines.
- Sweep rubric regexes are loose: monogris capacity `\b(2|dos)\b` matches any
  «2»; ruca capacities `3[\s\S]*4[\s\S]*6` matches any three numbers;
  casa-booking «seña/descuento» trips on negations («no figuran descuentos»);
  the owner-voice check misses «Nos encontramos en el muelle».
- The consumer-quota count keeps a permanent fallback for legacy rows
  (`consumer_user_id IS NULL`). Nothing stops a future `chat*` writer from
  omitting `consumerUserId` and silently landing in that fallback.
- `quota_exceeded` rows written by the quota gate for the chat put the tourist in
  `user_id` and leave `consumer_user_id` empty, which is the pre-HOS-2095 shape.

## 3. Owner decision (final, 09/11/2026)

For group questions the bot gives the total capacity and, when the listing has it,
the split by units or beds («2 deptos de 2 y 2 de 4», «8 camas»). It always closes
with «depende de cómo se repartan y de la disponibilidad: confirmalo con el lugar».
It never says «entran sin problema».

## 4. Scope

### 4.1 Rules (DB-backed, need a data-migration)

`LISTING_CHAT_ANSWER_RULES` (shared by `chat`, `chat_venue`, `chat_experience`):

1. Replace the capacity sentence with the owner's group rule (§3), plus: use the
   group size the visitor already gave in any message; ask only when it was never
   given; never invent a split the context does not state.
2. Pets: when the visitor asks about a number or size of pets, say whether pets
   are accepted and that the listing does not detail how many or which size; never
   answer «sí» to the quantity.

The legal minimum-age notice and the `chat_venue` age clauses are not touched
(HOS-2098 owns the venue age scope). Rules must stay compact.

Dual-write (HOS-25): a new seed data-migration rewrites `rules` only where the row
still holds the exact text 0160 wrote, with `before` taken byte-for-byte from
`origin/staging` and `after` equal to `DEFAULT_RULES`, plus its equivalence test.

### 4.2 Language and grammar (code only, no migration)

- The explicit reply-language lines (`REPLY_LANGUAGE_INSTRUCTIONS`, ai-core) for
  `en`/`pt` tell the model to write the whole answer in that language, translating
  Spanish values from the listing («pileta» → «piscina»/«pool»), proper names
  excepted. The `es` line adds a short grammar reminder (conjugated verb after
  «que», «ustedes» as the plural of «vos»).
- `CHAT_LANGUAGE_RULE` (apps/api) states that every word of the answer is in the
  reply language, field values included.

### 4.3 Context

Venue and experience assemblers load their amenities (`r_venue_amenity`,
`r_experience_amenity` joined to `amenities`), ordered by the catalog curation
(featured first, then `displayWeight`), capped, labelled through
`accommodations.amenityNames.<slug>`, under `### Comodidades`. Graceful: a failed
read is an empty list with a warning. The sweep inputs gain amenities for the
synthetic venue/experience entities that should have them, and the contexts are
regenerated.

### 4.4 File split (behaviour-preserving)

- `default-prompts.ts` → brand-voice fragments and the listing-chat rule builder
  move to their own modules; `DEFAULT_PROMPTS` / `DEFAULT_RULES` keep their
  exports and their exact strings (`default-rules-equivalence.test.ts` is the
  proof).
- `chat.ts` → helpers (output cap, analytics capture, engine message mapping) and
  the post-stream finalization (metering + persistence) move to sibling modules;
  the route keeps the flow.

### 4.5 Sweep rubric

Tighten the four regexes in §2; add to the group cases a `mustInclude` for the
«confirm with the place / availability» close and a `mustNotClaim` for
«entran sin problema / entran todos».

### 4.6 Metering

- **Guard:** a static test that inventories every `recordAiUsage(` /
  `meterAiUsage(` call site in production code. A site that can write a `chat*`
  feature must pass `consumerUserId`; a site not in the inventory fails.
- **`quota_exceeded` rows:** `enforceAiQuota` accepts an optional usage
  attribution (`{ userId, consumerUserId }`) for the rejected-attempt row. The
  chat passes `{ userId: ownerId, consumerUserId: actor.id }` to both its gates
  (owner and consumer), so every chat row has the HOS-2095 shape. No schema
  change: `quota_exceeded` rows are excluded from every quota count by status, so
  moving them does not change any quota; they cost 0.

## 5. Out of scope

- `chat_venue` minimum-age scoping (HOS-2098).
- The AI questions panel (HOS-2101).
- `accommodation-ai-context.ts` length (656 lines; not named by HOS-2100).

## 6. Acceptance criteria

- AC-1: the shared rules carry the group rule (§3) and the pet-quantity rule;
  rules tests anchor both; mutation-checked.
- AC-2: a data-migration moves `rules` from staging's text to the new
  `DEFAULT_RULES`; its test proves the chain (`before` == 0160 `after`) and no
  drift (`after` == `DEFAULT_RULES`).
- AC-3: venue/experience context blocks list amenities when the listing has them;
  unit tests on the pure builders.
- AC-4: `chat.ts` and `default-prompts.ts` are ≤ 500 lines and the composed rules
  are byte-identical to before for the parts not changed by AC-1.
- AC-5: the metering guard fails on a `chat*` writer without `consumerUserId`
  (mutation-checked); chat `quota_exceeded` rows carry owner + consumer.
- AC-6: blind re-measure with `sweep.config.round2.json` (nano/none and mini/none,
  2 reps): no regression versus round 3 overall and on the legal/minor and
  prompt-injection cases; report quality, count ≤ 2, latency and cost.
