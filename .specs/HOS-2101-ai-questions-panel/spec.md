---
title: AI questions panel for hosts
linear: HOS-2101
statusSource: linear
created: 2026-11-09
type: feature
areas:
  - web
  - api
  - db
---

# AI questions panel for hosts

## 1. Summary

The listing owner sees, inside each listing editor, the questions tourists asked
that listing's AI chat. Questions the bot could not answer (the fact is not in
the listing) are highlighted on top, with a one-click path to turn them into a
FAQ. A weekly email summarises the week's unanswered questions.

Owner decisions are recorded on the Linear issue (09/11/2026) and are final.

## 2. Problem

`persistChatTurn` (`apps/api/src/services/ai-chat-persistence.ts`) stores every
chat turn in `ai_conversations` / `ai_messages`, but the listing lives only
inside the free-text `context_note` JSON. Nothing can list questions per
listing, and nobody — owner, admin or tourist — sees them. The questions the bot
could not answer are the most valuable signal a host can get about what is
missing from the listing, and today it is lost.

## 3. Goals

- G-1 Owner lists the questions asked about one of their listings, last 12
  months, newest first, anonymously.
- G-2 Unanswered questions are detected cheaply and asynchronously, and shown
  first with a counter and an «Agregar como pregunta frecuente» button.
- G-3 Questions older than 12 months are deleted automatically.
- G-4 Weekly email digest of the week's unanswered questions, es/en/pt, with
  opt-out, never sent when there are none.
- G-5 Accommodation, venue and experience (all three already have chat).

## 4. Non-goals

- NG-1 Showing the tourist's name or contact (decision left open by the owner;
  the data needed — `ai_conversations.user_id` — is kept, but never exposed).
- NG-2 An admin view or a tourist-facing history.
- NG-3 A new entitlement: every plan that has chat gets the tab.
- NG-4 Registering empty answers (HOS-2095) as unanswered — those are model
  failures, not missing facts, and they are not persisted today.
- NG-5 One-click tokenised unsubscribe. The email links to the account
  preferences page, where the toggle lives.

## 5. Current baseline

- Chat route: `apps/api/src/routes/ai/protected/chat.ts`. After the stream, the
  `meta.then` callback records usage and races `persistChatTurn` against 1500 ms.
  Each request persists exactly one pair: the visitor's last user turn and the
  accumulated assistant answer.
- `ai_conversations`: `user_id`, `feature`, `context_note` (text JSON
  `{ entityType, entityId, accommodationId? }` since HOS-400), no listing index.
- `ai_messages`: `conversation_id`, `role`, `content`, `provider`, `tokens`.
- AI engine: `createConfiguredAiService()` → `generateText` (feature-scoped
  config, cost ceiling, moderation). Quota counts `ai_usage` rows with status
  `success|fallback`, one row per chat request (HOS-2095).
- Editors: accommodation registry `apps/web/src/lib/editor/accommodation-editor-sections.ts`;
  venue/experience registry built from the domain catalog
  (`packages/schemas/src/catalog/listing-sections.ts`) plus
  `listing-section-presentation.ts`.
- FAQ editors: `FaqSection.client.tsx` (accommodation) and
  `ListingFaqManager.client.tsx` (venue/experience).
- Notifications: `packages/notifications` (Spanish-only templates, no
  `@repo/i18n`), `trySendNotification` in `apps/api/src/utils/notification-helper.ts`.

## 6. Proposed design

### 6.1 Persistence (structured listing reference)

- `ai_conversations` gains `listing_entity_type varchar(20)` and
  `listing_entity_id uuid`, both nullable, plus index
  `aiConversations_listing_idx (listing_entity_type, listing_entity_id)`.
  No FK: the reference is polymorphic over three tables.
- `ai_messages` gains `answer_status varchar(20)` nullable: `answered` |
  `unanswered` on assistant rows once classified; `NULL` = not classified (or not
  an assistant chat row).
- `persistChatTurn` writes the two listing columns on the first turn and returns
  the ids of both inserted messages. `context_note` keeps being written
  (compatibility).
- Migration is expand-only and backfills the listing columns of existing chat
  conversations from `context_note` (rows whose JSON is not parseable are left
  NULL).

### 6.2 Classification

- After a successful persistence, the route fires (never awaits)
  `classifyChatAnswer`. It calls `generateText` on the vertical's chat feature
  (`chat` / `chat_venue` / `chat_experience`, i.e. the configured model) with a
  short fixed instruction and `maxTokens` 5, asking for `ANSWERED` or
  `UNANSWERED`. Budget ≈ US$0.0002 per question.
- It never blocks or slows the stream: it runs after `done` metadata is
  resolved, detached, with its own try/catch. Any failure (provider, ceiling,
  unparseable output, empty output) leaves `answer_status` NULL and logs a warn.
- It records NO `ai_usage` row: that table is the quota axis and HOS-2095 fixed
  it to exactly one row per chat request. A classification row would burn the
  owner's chat quota.

### 6.3 Listing questions API

`GET /api/v1/protected/ai/listing-questions?entityType=<accommodation|venue|experience>&entityId=<uuid>`

Order of refusals per `apps/api/docs/error-contract.md`: no session 401 →
malformed query 400 → listing missing, deleted or owned by someone else 404.

Response (exact keys, no user data):

```json
{
  "items": [
    { "id": "<user message uuid>", "question": "...", "answer": "...",
      "askedAt": "<iso>", "answerStatus": "answered|unanswered|unclassified" }
  ],
  "total": 0,
  "unansweredCount": 0,
  "truncated": false
}
```

Newest first, last 12 months, at most 200 items (`truncated` tells the client
there were more). `total` and `unansweredCount` are exact counts over the 12
months.

### 6.4 Retention cron `ai-listing-questions-retention`

Daily. Hard-deletes `ai_messages` older than 12 months that belong to chat
conversations (listing reference set or `feature` in the chat family), then
deletes chat conversations left without messages. Registered in
`apps/api/src/cron/schedules.manifest.ts` and `registry.ts`.

### 6.5 Weekly digest cron `ai-questions-weekly-digest`

Monday 09:00 (Buenos Aires). Window: the previous 7 days. For each owner with at
least one unanswered question on a listing they still own: one email listing,
per listing, the unanswered count and up to 5 questions, each listing with a
link to its «Preguntas a la IA» tab.

- No unanswered questions → no email.
- Opt-out: `settings.aiQuestionsDigest === false` or
  `settings.notifications.allowEmails === false` → no email.
- Idempotent per owner and week: key `ai-questions-digest:<userId>:<weekStart>`
  checked against `notification_log` before sending.
- Locale: `resolveRecipientLocale`; template copy and subject in es/en/pt
  inside the template (the package does not use `@repo/i18n`).
- New `NotificationType.AI_QUESTIONS_WEEKLY_DIGEST`, category `REMINDER`.

### 6.6 Preference

`UserSettingsSchema.aiQuestionsDigest: boolean` (default true, stored additively
in the `settings` JSONB like `searchHistoryEnabled`), accepted by
`UserSettingsWebPatchSchema`, toggled from `PreferenceToggles` in
`/mi-cuenta/preferencias/`.

## 7. Data model / contracts

- Migration `00NN_hos_2101_ai_listing_questions.sql` (number re-checked against
  open PRs before merge).
- Schemas in `@repo/schemas`: `AiListingQuestionsQuerySchema`,
  `AiListingQuestionSchema`, `AiListingQuestionsResponseSchema`,
  `AiAnswerStatusSchema`.
- No new env var.

## 8. UX / UI behavior

- New editor tab «Preguntas a la IA» right after «Preguntas frecuentes», slug
  `preguntas-ia`, in the accommodation and venue/experience editors. The page is
  session-blind: the list is a client island that fetches the API.
- Top block «Sin responder (N)» with each question, the bot answer, the date and
  «Agregar como pregunta frecuente», which navigates to the FAQ tab with
  `?pregunta=<text>`; the FAQ editor opens its add form prefilled.
- Below, all questions newest first. Empty state when there are none.
- All strings through `@repo/i18n` (es/en/pt). CSS Modules.

## 9. Acceptance criteria

- AC-1 The owner sees the questions of their listing from the last 12 months,
  newest first, without any data identifying the tourist.
- AC-2 Unanswered questions appear first with a counter; «Agregar como pregunta
  frecuente» opens the FAQ editor with the question loaded.
- AC-3 Nobody sees questions of a listing that is not theirs: the API answers
  404, never 403.
- AC-4 Questions older than 12 months are deleted automatically.
- AC-5 The weekly digest is sent only when there were unanswered questions, and
  the owner can opt out.
- AC-6 Covers accommodation, venue and experience.

## 10. Risks

- R-1 Classifier quality depends on the configured chat model; a wrong verdict
  only moves a question between the two blocks.
- R-2 Detached classification can be lost on process restart; the row stays
  `unclassified`, never wrong.
- R-3 The weekly digest and the tab rely on `ai_messages` volume staying modest;
  queries are indexed by listing and bounded to 12 months / 200 rows.

## 11. Open questions

- OQ-1 (owner, out of scope) Whether and when to show the tourist's name.

## 12. Implementation notes

- Tests: list API (owner ok, foreign 404, guest 401, exact keys), classifier
  (answered / unanswered / failure), retention cron, digest selection (zero → no
  email, opted out → no email).
- `chat.ts` is touched minimally (one detached call) because HOS-2100 is
  splitting it in parallel.
