---
spec-id: "SPEC-254"
type: "feature"
complexity: high
status: completed
created: "2026-06-20T00:00:00Z"
completed: "2026-06-23T00:00:00Z"
---

# SPEC-254: Social Automation Backend

## Part 1: Functional Specification

### Overview & Goals

Replace the external Airtable-based social media automation with a first-party backend that owns the full social content lifecycle: from Custom GPT draft ingestion through admin editorial review to automated publishing via Make.com, with Cloudinary-hosted media. The backend is the single source of truth for every social post, approval state, and publish result.

- **Goal**: Eliminate Airtable as the intermediary; give the Hospeda team a fully owned, auditable, permission-gated editorial pipeline for Instagram, Facebook, and X (Twitter) content.
- **Motivation**: Airtable provides no permission model, no typed state machine, no audit log, no retry logic, and no direct integration path with Hospeda's existing auth/billing/permission infrastructure. Every social post is an untracked external artifact today.
- **Success metrics**:
  - Zero social drafts stored in Airtable (all new drafts arrive via the GPT endpoint).
  - Admin team can approve, schedule, and monitor every post without leaving the Hospeda admin panel.
  - Make.com receives properly typed dispatch payloads and reports results back; zero manual status updates.
  - 100% of state transitions are audited in `social_audit_log` with actor + old/new values.
  - Dispatch cron retries failed targets up to 3 times before marking FAILED for manual review.
- **Target users**: Internal Hospeda admins (content team, ops) and the Custom GPT acting as a draft-creation agent.

---

### User Stories & Acceptance Criteria

#### US-1: GPT Catalog Access

**As a** Custom GPT operator, **I want** to fetch the full active content catalog (hashtags, hashtag sets, footers, campaigns, batches, audiences, platform formats, and system defaults) in a single authenticated call, **so that** the GPT can make well-informed draft suggestions without needing hard-coded data.

**Acceptance Criteria:**

- **Given** a valid `x-hospeda-ai-key` header (the catalog endpoint requires ONLY the API key — no `operator_pin`; the PIN gate applies only to `POST /drafts`, see US-2), **When** `GET /api/v1/ai/social/catalog` is called, **Then** the response is `{ success: true, data: { hashtags: [...], hashtagSets: [...], footers: [...], platformFormats: [...], campaigns: [...], batches: [...], audiences: [...], defaults: { timezone, campaignSlug, batchSlug, maxHashtagsPerPlatform } } }` with HTTP 200.
- **Given** an absent or invalid `x-hospeda-ai-key`, **When** the endpoint is called, **Then** the response is `{ success: false, error: { code: "UNAUTHORIZED", message: "Invalid or missing API key" } }` with HTTP 401, and the mismatch is logged as WARN. The key comparison uses `timingSafeEqual` to prevent timing attacks.
- **Given** the key is valid, **When** the endpoint is called, **Then** only records with `active = true` are returned (soft-deleted records are excluded).
- **Given** the endpoint is called repeatedly within a short window, **When** the per-route rate limit is exceeded, **Then** the response is HTTP 429 with the standard error envelope.

---

#### US-2: GPT Draft Submission

**As a** Custom GPT operator, **I want** to submit a structured social post draft with caption, hashtags, media references, and targeting metadata, **so that** the draft is stored in Postgres under admin review and no post goes live without human approval.

**Acceptance Criteria:**

- **Given** a valid `x-hospeda-ai-key` + correct `operator_pin` and a well-formed draft payload, **When** `POST /api/v1/ai/social/drafts` is called, **Then** the response is `{ success: true, data: { draftId, status: "NEEDS_REVIEW", approvalStatus: "PENDING", warnings: [...] } }` with HTTP 201.
- **Given** the payload includes `status` set to `APPROVED`, `SCHEDULED`, `READY_TO_PUBLISH`, or `PUBLISHED`, **When** the draft is saved, **Then** the backend silently overrides `status` to `NEEDS_REVIEW` and `approvalStatus` to `PENDING`. The response still returns HTTP 201 but includes `warnings: [{ field: "status", message: "GPT cannot set approval states; overridden to NEEDS_REVIEW" }]`.
- **Given** the payload includes `paused: true`, **When** the draft is saved, **Then** the backend sets `paused = false`. The `paused` field is admin-only.
- **Given** the payload includes a `draft_id` that already exists in `social_posts`, **When** the POST is called, **Then** the response is `{ success: false, error: { code: "CONFLICT", message: "Draft with this ID already exists" } }` with HTTP 409.
- **Given** the payload includes `image.mode = "public_url"` with a reachable URL, **When** the draft is saved, **Then** the backend downloads the image and re-uploads to Cloudinary via `getMediaProvider().upload()`, then stores `{ cloudinaryUrl, cloudinaryPublicId, width, height }` in `social_assets`. The original URL is kept in `original_url`.
- **Given** the payload includes `image.mode = "openai_file_refs"` (an array of `{ fileId, downloadUrl }`), **When** the draft is saved, **Then** the backend extracts the `downloadUrl` from each ref, downloads it, uploads to Cloudinary, and stores results in `social_assets`. The `openai_file_ref` column stores the original ref string.
- **Given** an image download or Cloudinary upload fails, **When** the draft is being saved, **Then** the draft is still created (status NEEDS_REVIEW) but the `social_assets` entry has `cloudinary_url = null` and the response includes `warnings: [{ field: "image", message: "Media upload failed; manual upload required" }]`.
- **Given** the payload includes `curatedHashtags` (array of hashtag strings from the catalog), **When** the draft is saved, **Then** each string is looked up in `social_hashtags` by `normalized_hashtag`. Valid ones create rows in `social_post_hashtags`. Invalid ones are silently ignored but returned in `warnings: [{ field: "curatedHashtags", message: "Unknown hashtags ignored: [#foo, #bar]" }]`.
- **Given** the payload includes `customHashtagSuggestions` (novel hashtags not in the catalog), **When** the draft is saved, **Then** they are stored verbatim in `social_posts.gpt_hashtag_payload_json` and are NEVER added to `social_post_hashtags` or `final_hashtags_text` automatically.
- **Given** a platform-format combination in `targets` that does not have an active `social_platform_formats` row, **When** the draft is saved, **Then** the target is rejected and returned in `warnings: [{ field: "targets[n]", message: "Platform/format INSTAGRAM/REEL not enabled" }]`. At least one valid target is required; if all targets fail validation the draft is rejected with HTTP 422.
- **Given** the payload is syntactically invalid (missing required fields, wrong types), **When** the POST is called, **Then** the response is `{ success: false, error: { code: "VALIDATION_ERROR", message: "...", details: [...] } }` with HTTP 422.

---

#### US-3: Hashtag Promotion

**As an** admin with the `SOCIAL_HASHTAG_MANAGE` permission, **I want** to promote a custom hashtag suggestion from a draft into the official hashtag catalog, **so that** vetted hashtags discovered by the GPT become reusable across future posts.

**Acceptance Criteria:**

- **Given** an admin holds `SOCIAL_HASHTAG_MANAGE` and the post has at least one entry in `gpt_hashtag_payload_json`, **When** `POST /api/v1/admin/social/posts/:id/promote-hashtag` is called with `{ hashtag, category, platform?, audienceId?, priority? }`, **Then** a new `social_hashtags` row is created (normalized_hashtag = lowercase with `#` prefix, unique), a new `social_post_hashtags` row is added linking the post to the new hashtag, and `social_audit_log` records event `HASHTAG_PROMOTED`. The response is `{ success: true, data: { hashtagId, hashtag } }` with HTTP 201.
- **Given** the promoted hashtag already exists in `social_hashtags` (by `normalized_hashtag`), **When** the promotion is called, **Then** the existing hashtag is used (no duplicate insert) and a `social_post_hashtags` row is created only if it does not already exist. Response is HTTP 200 (not 201) with the existing hashtagId.
- **Given** the admin lacks `SOCIAL_HASHTAG_MANAGE`, **When** the endpoint is called, **Then** HTTP 403 with `{ success: false, error: { code: "FORBIDDEN" } }`.
- **Given** the `hashtag` value does not start with `#`, **When** the endpoint is called, **Then** the backend auto-prepends `#` before normalizing, and the response includes `warnings: [{ field: "hashtag", message: "# prefix auto-added" }]`.

---

#### US-4: Admin Post Review

**As an** admin with `SOCIAL_POST_VIEW`, **I want** to browse the social post list and see each post's status, approval state, assigned targets, and media thumbnail, **so that** I can quickly identify drafts that need my attention.

**Acceptance Criteria:**

- **Given** an admin holds `SOCIAL_POST_VIEW`, **When** `GET /api/v1/admin/social/posts` is called, **Then** the response is `{ success: true, data: { items: [...], pagination: { page, pageSize, total } } }` with HTTP 200. Each item contains: `{ id, title, slug, status, approvalStatus, paused, platform (targets), thumbnailUrl, scheduledAt, createdAt }`.
- **Given** filters `?status=NEEDS_REVIEW&approvalStatus=PENDING` are passed, **When** the list is fetched, **Then** only posts matching both filters are returned.
- **Given** the list is called without filters, **When** soft-deleted posts exist, **Then** they are excluded unless `?includeDeleted=true` is also passed AND the caller holds `SOCIAL_POST_HARD_DELETE`.
- **Given** an admin lacks `SOCIAL_POST_VIEW`, **When** the endpoint is called, **Then** HTTP 403.
- **Given** the admin calls `GET /api/v1/admin/social/posts/:id`, **Then** the full post detail is returned, including `caption_base`, `final_caption`, `final_hashtags_text`, `gpt_hashtag_payload_json`, all `social_post_targets`, all `social_post_hashtags` (with resolved hashtag text), all `social_post_media` (with Cloudinary URLs), `notes`, `internal_notes`, and the last 10 `social_publish_logs` for this post.

---

#### US-5: Admin Post Approval

**As an** admin with `SOCIAL_POST_APPROVE`, **I want** to approve a social post that is in `NEEDS_REVIEW` / `PENDING` state, **so that** it enters the publish pipeline and can be dispatched to Make.com.

**Acceptance Criteria:**

- **Given** a post has `status = NEEDS_REVIEW` and `approvalStatus = PENDING` and the admin holds `SOCIAL_POST_APPROVE`, **When** `POST /api/v1/admin/social/posts/:id/approve` is called, **Then** `status` becomes `APPROVED`, `approvalStatus` becomes `APPROVED`, `approved_by_id` is set to the acting admin's user ID, `approved_at` is set to `now()`, and `social_audit_log` records `POST_APPROVED` with old/new state JSON. Response is `{ success: true, data: { id, status, approvalStatus } }` with HTTP 200.
- **Given** the post is NOT in `NEEDS_REVIEW`, **When** approve is called, **Then** HTTP 422 with `{ success: false, error: { code: "INVALID_STATE", message: "Post must be in NEEDS_REVIEW to approve" } }`.
- **Given** the post has no media AND at least one target requires media (`requires_media = true` on its `social_platform_formats` row), **When** approve is called, **Then** HTTP 422 with `{ success: false, error: { code: "MISSING_MEDIA", message: "Post has no media but targets require it" } }`.
- **Given** the admin lacks `SOCIAL_POST_APPROVE`, **When** the endpoint is called, **Then** HTTP 403.

---

#### US-6: Admin Post Rejection / Request Changes

**As an** admin with `SOCIAL_POST_APPROVE`, **I want** to reject a post or request changes, **so that** the GPT or content team knows the draft needs revision.

**Acceptance Criteria:**

- **Given** a post is in `NEEDS_REVIEW` / `PENDING` and the admin holds `SOCIAL_POST_APPROVE`, **When** `POST /api/v1/admin/social/posts/:id/reject` is called with `{ reason }`, **Then** `status` stays `NEEDS_REVIEW` (post is not deleted), `approvalStatus` becomes `REJECTED`, and `social_posts.notes` is appended with the reason. Audit event `POST_REJECTED` is logged. Response HTTP 200.
- **Given** the admin calls `POST /api/v1/admin/social/posts/:id/request-changes` with `{ feedback }`, **Then** `approvalStatus` becomes `CHANGES_REQUESTED`, `social_posts.notes` is appended with the feedback text. Audit event `POST_CHANGES_REQUESTED` is logged. Response HTTP 200.
- **Given** `reason` or `feedback` is blank, **When** the endpoint is called, **Then** HTTP 422 with `{ success: false, error: { code: "VALIDATION_ERROR", message: "reason is required" } }`.

---

#### US-7: Scheduling a Post

**As an** admin with `SOCIAL_POST_SCHEDULE`, **I want** to set a specific publish date-time for an approved post, **so that** the dispatch cron publishes it at the right moment.

**Acceptance Criteria:**

- **Given** a post is `APPROVED` and the admin holds `SOCIAL_POST_SCHEDULE`, **When** `POST /api/v1/admin/social/posts/:id/schedule` is called with `{ scheduledAt, timezone }`, **Then** `status` becomes `SCHEDULED`, `scheduled_at` is set, `timezone` is updated, `next_run_at` is set equal to `scheduled_at`, and `social_audit_log` records `POST_SCHEDULED`. Response HTTP 200.
- **Given** `scheduledAt` is in the past, **When** schedule is called, **Then** HTTP 422 with `{ success: false, error: { code: "VALIDATION_ERROR", message: "scheduledAt must be in the future" } }`.
- **Given** a post is `SCHEDULED` and the admin calls schedule again with a new `scheduledAt`, **Then** the existing scheduled time is replaced, the audit log records `POST_RESCHEDULED` with old/new values. Response HTTP 200.
- **Given** the admin calls `POST /api/v1/admin/social/posts/:id/mark-ready` on an `APPROVED` post, **Then** `status` becomes `READY_TO_PUBLISH`, `next_run_at` is set to `now()`, and audit event `POST_MARKED_READY` is logged. The dispatch cron will pick it up on the next run.

---

#### US-8: Pause and Unpause

**As an** admin with `SOCIAL_POST_PAUSE`, **I want** to pause and unpause a post that is `APPROVED`, `SCHEDULED`, or `READY_TO_PUBLISH`, **so that** I can hold a post temporarily without deleting it.

**Acceptance Criteria:**

- **Given** a post has `paused = false` and `status` in (`APPROVED`, `SCHEDULED`, `READY_TO_PUBLISH`) and the admin holds `SOCIAL_POST_PAUSE`, **When** `POST /api/v1/admin/social/posts/:id/pause` is called, **Then** `paused` becomes `true`, audit event `POST_PAUSED` is logged. Response HTTP 200.
- **Given** a post has `paused = true`, **When** `POST /api/v1/admin/social/posts/:id/unpause` is called with `SOCIAL_POST_PAUSE`, **Then** `paused` becomes `false`, audit event `POST_UNPAUSED` is logged. Response HTTP 200.
- **Given** the dispatch cron runs while `paused = true`, **Then** the post is skipped (never dispatched to Make).
- **Given** a post with `status = PUBLISHED` or `status = FAILED`, **When** pause is called, **Then** HTTP 422 with `{ success: false, error: { code: "INVALID_STATE", message: "Cannot pause a post in PUBLISHED or FAILED state" } }`.

---

#### US-9: Post Archive

**As an** admin with `SOCIAL_POST_ARCHIVE`, **I want** to archive a post that is no longer relevant, **so that** it is hidden from active queues without being hard-deleted.

**Acceptance Criteria:**

- **Given** the admin holds `SOCIAL_POST_ARCHIVE`, **When** `POST /api/v1/admin/social/posts/:id/archive` is called, **Then** `status` becomes `ARCHIVED` and `deleted_at` is set (soft-delete). Audit event `POST_ARCHIVED` is logged. Response HTTP 200.
- **Given** the post is `PUBLISHING` (dispatch in progress), **When** archive is called, **Then** HTTP 422 with `{ success: false, error: { code: "INVALID_STATE", message: "Cannot archive a post that is currently being published" } }`.
- **Given** the admin calls `GET /api/v1/admin/social/posts` without `?includeDeleted=true`, **Then** archived posts do not appear.

---

#### US-10: Quick Approval Queue

**As an** admin with `SOCIAL_POST_APPROVE`, **I want** a dashboard widget that shows only posts in `NEEDS_REVIEW` / `PENDING` state with a one-click approve button, **so that** I can process the review queue efficiently without opening each post individually.

**Acceptance Criteria:**

- **Given** the admin navigates to the social dashboard in the admin panel, **When** the page loads, **Then** the "Pending Review" section lists up to 10 posts (sorted by `created_at ASC`) with: thumbnail, title, platform icons (from targets), `created_at` relative timestamp, and an "Approve" button.
- **Given** the admin clicks "Approve" on a queued item, **When** the action is sent, **Then** the post transitions to `APPROVED` / `APPROVED` state and is removed from the quick-approval list immediately (optimistic update confirmed by server). If the server returns an error the item is restored in the list with an error badge.
- **Given** all pending posts are approved, **When** the section renders, **Then** an empty-state message "No posts pending review" is shown.

---

#### US-11: Make.com Dispatch (Cron-Driven Push)

**As a** system operator, **I want** the backend to automatically push ready-to-publish post targets to Make.com on a schedule, **so that** social content is published without manual intervention.

**Acceptance Criteria:**

- **Given** the `social-publish-dispatch` cron job fires (configurable schedule), **When** it runs, **Then** it queries `social_post_targets` where: the parent `social_posts.approval_status = APPROVED` AND (`social_posts.status = READY_TO_PUBLISH` OR (`social_posts.status = SCHEDULED` AND `social_posts.next_run_at <= now()`)) AND `social_posts.paused = false` AND `social_post_targets.status` is not in (`PUBLISHED`, `FAILED`, `PUBLISHING`) AND the parent post has at least one `social_post_media` row (non-empty media).
- **Given** a qualifying target is found, **When** the cron dispatches it, **Then** the target `status` is set to `PUBLISHING` (optimistic lock), and a POST request is made to the Make webhook URL (read from `social_settings` key `make_webhook_url`) with the payload: `{ targetId, postId, platform, publishFormat, makeChannelKey, captionFinal, hashtagsFinal, footerFinal, mediaUrls: [...], scheduledAt, timezone, callbackClaimUrl, callbackResultUrl }`. The outbound request includes the header `x-make-apikey` (from env var `HOSPEDA_MAKE_API_KEY`).
- **Given** the Make webhook call succeeds (HTTP 2xx), **When** the dispatch completes, **Then** a `social_publish_logs` row is inserted with `status = RETRYING` (waiting for Make callback). The post-level `status` is set to `PUBLISHING` if not already.
- **Given** the Make webhook call fails (non-2xx or network error), **When** `retry_count < 3`, **Then** `retry_count` is incremented, the target `status` is reset to `APPROVED` (to be picked up on the next cron run). A `social_publish_logs` row is inserted with `status = FAILED` and the error message.
- **Given** `retry_count >= 3` when a failure occurs, **When** the cron processes this target, **Then** the target `status` is set to `FAILED`, a `social_publish_logs` row is inserted with `status = FAILED`, and the post-level `status` is set to `FAILED` (if all other targets are also FAILED or PUBLISHED). Audit event `TARGET_DISPATCH_FAILED_EXHAUSTED` is logged.

---

#### US-12: Make.com Claim Callback

**As a** Make.com scenario, **I want** to claim a dispatch job when I start processing it, **so that** the Hospeda backend knows the target is being actively published and can prevent duplicate dispatches.

**Acceptance Criteria:**

- **Given** a valid `x-hospeda-make-key` header, **When** `POST /api/v1/integrations/make/social/jobs/:targetId/claim` is called with `{ makeRunId }`, **Then** `social_post_targets.status` is set to `PUBLISHING`, `make_last_run_id` is set to `makeRunId`, and `make_payload_json` is updated. Response is `{ success: true, data: { targetId, status: "PUBLISHING" } }` with HTTP 200.
- **Given** the target is already `PUBLISHED`, **When** claim is called, **Then** HTTP 409 with `{ success: false, error: { code: "ALREADY_PUBLISHED", message: "Target already published" } }`.
- **Given** an absent or invalid `x-hospeda-make-key`, **When** the endpoint is called, **Then** HTTP 401 with the standard error envelope. Comparison uses `timingSafeEqual`.
- **Given** the `targetId` does not exist, **When** the endpoint is called, **Then** HTTP 404 with standard error envelope.

---

#### US-13: Make.com Result Callback

**As a** Make.com scenario, **I want** to report the publish result (success or failure) back to Hospeda, **so that** the backend can update the target state, log the result, and cascade post completion.

**Acceptance Criteria:**

- **Given** a valid `x-hospeda-make-key` and a result body `{ status: "SUCCESS", externalPostId, externalPostUrl, makeRunId }`, **When** `POST /api/v1/integrations/make/social/jobs/:targetId/result` is called, **Then**: `social_post_targets.status` becomes `PUBLISHED`, `published_at` is set to `now()`, `external_post_id` and `external_post_url` are stored, a `social_publish_logs` row is inserted with `status = SUCCESS`, and audit event `TARGET_PUBLISHED` is logged. Response HTTP 200.
- **Given** all targets of the parent post are now in a terminal state (`PUBLISHED` or `FAILED` or `SKIPPED`), **When** the last result callback processes, **Then** `social_posts.status` is set to `PUBLISHED` (if at least one target is PUBLISHED) or `FAILED` (if all are FAILED/SKIPPED). `social_posts.next_run_at` is recomputed: if `recurrence_type = ONCE` → `null`; if `WEEKLY` → `now() + 7 days` (adjusted to the configured weekday); if `BIWEEKLY` → `now() + 14 days`; if `MONTHLY` → same day next month. When `next_run_at` is set, `status` is reset to `APPROVED` and `approval_status` stays `APPROVED` (recurrence auto-reuses the approval).
- **Given** a result body with `status: "FAILED"` and `{ errorMessage }`, **When** the result callback is called, **Then** `social_post_targets.status` becomes `FAILED`, `last_error_message` is stored, a `social_publish_logs` row is inserted with `status = FAILED`. If `retry_count < 3`, the target is reset to its pre-PUBLISHING state (`READY_TO_PUBLISH` or `APPROVED`) for the next cron cycle. If `retry_count >= 3`, target stays `FAILED`. Audit event `TARGET_PUBLISH_FAILED` is logged.

---

#### US-14: Recurrence

**As an** admin with `SOCIAL_POST_SCHEDULE`, **I want** to configure a post to recur weekly, bi-weekly, or monthly, **so that** evergreen content is automatically re-dispatched without creating duplicate drafts.

**Acceptance Criteria:**

- **Given** a post has `recurrence_type = WEEKLY` and `recurrence_params_json = { weekday: "MONDAY" }` and all targets complete successfully, **When** the result cascade runs, **Then** `next_run_at` is set to the next Monday at or after `now()` using the post's `timezone` field, and `status` is reset to `APPROVED`.
- **Given** a post has `recurrence_type = ONCE`, **When** all targets complete, **Then** `next_run_at` is set to `null`. The post stays `PUBLISHED` (no reset).
- **Given** `next_run_at` is set and `next_run_at <= now()` at cron fire time, **When** the cron queries candidates, **Then** this post's targets appear in the dispatch set (targets are reset to their initial `APPROVED` status as part of the recurrence rearm step).
- **Given** an admin sets `recurrence_type` during scheduling, **When** `recurrence_params_json` is required (e.g., `WEEKLY` needs `weekday`), **Then** the API validates the field is present and the weekday value is a valid enum member; otherwise HTTP 422.

---

#### US-15: Admin Catalog Management (Hashtags, Hashtag Sets, Footers, Campaigns, Batches, Audiences)

**As an** admin with the respective manage permission, **I want** to create, read, update, and soft-delete catalog entities (hashtags, hashtag sets, footers, campaigns, batches, audiences), **so that** GPT always has an up-to-date reference set to draw from.

**Acceptance Criteria:**

- **Given** the admin holds `SOCIAL_HASHTAG_MANAGE`, **When** `POST /api/v1/admin/social/hashtags` is called with `{ hashtag, category, platform?, audienceId?, priority, active }`, **Then** the backend normalizes `hashtag` to lowercase with `#` prefix, checks uniqueness of `normalized_hashtag`, creates the row, and returns `{ success: true, data: { id, normalizedHashtag, ... } }` HTTP 201.
- **Given** a `hashtag` value whose `normalized_hashtag` already exists, **When** the create is called, **Then** HTTP 409 with `{ success: false, error: { code: "CONFLICT", message: "Hashtag already exists" } }`.
- **Given** the admin calls `PATCH /api/v1/admin/social/hashtags/:id` with `{ active: false }`, **Then** the hashtag is deactivated. Existing `social_post_hashtags` rows referencing this hashtag are NOT removed (historical data preserved).
- **Given** the admin calls `DELETE /api/v1/admin/social/hashtags/:id`, **Then** a soft-delete is performed (`deleted_at` set). Hard-delete is blocked with HTTP 405.
- **Given** similar CRUD patterns, **When** applied to hashtag sets, footers, campaigns, batches, and audiences, **Then** the same conventions hold (soft-delete, permission gate, validation, standard response envelope). Each entity's specific required fields are documented in the API Design section.
- **Given** a list endpoint is called with search parameters (e.g., `?search=playa&platform=INSTAGRAM`), **When** the query runs, **Then** `safeIlike()` is used for text matching and results are paginated with `page` + `pageSize`.

---

#### US-16: Platform and Platform-Format Configuration

**As an** admin with `SOCIAL_PLATFORM_MANAGE`, **I want** to enable/disable platforms and update platform-format settings (caption limits, make_channel_key, mvp_enabled flag), **so that** the GPT and dispatch logic always use current configuration.

**Acceptance Criteria:**

- **Given** the admin holds `SOCIAL_PLATFORM_MANAGE`, **When** `PATCH /api/v1/admin/social/platform-formats/:id` is called with `{ maxCaptionLength: 2200, makeChannelKey: "instagram-feed" }`, **Then** the `social_platform_formats` row is updated and the response is `{ success: true, data: { id, platform, publishFormat, ... } }` HTTP 200. Audit event `PLATFORM_FORMAT_UPDATED` is logged.
- **Given** the admin calls `GET /api/v1/admin/social/platform-formats`, **Then** all rows (active and inactive) are returned, ordered by `platform ASC, publish_format ASC`.
- **Given** the admin sets `enabled = false` on a platform-format row, **When** the GPT catalog endpoint is called, **Then** that platform-format is excluded from the catalog response.
- **Given** the admin sets `enabled = false` on a platform-format row that is referenced by active `social_post_targets`, **When** the update is called, **Then** it succeeds (existing targets are preserved), but the response includes `warnings: [{ message: "N existing targets reference this format" }]`.

---

#### US-17: Settings Management

**As a** super-admin with `SOCIAL_SETTINGS_MANAGE`, **I want** to read and update social automation settings (make webhook URL, default timezone, max hashtags per platform, etc.), **so that** the publishing pipeline can be configured without a code deploy.

**Acceptance Criteria:**

- **Given** the super-admin holds `SOCIAL_SETTINGS_MANAGE`, **When** `GET /api/v1/admin/social/settings` is called, **Then** all `social_settings` rows are returned as `{ success: true, data: [{ key, value, type, description, active }] }` HTTP 200. Secret values (type = `secret`) are masked as `"***"` in the response.
- **Given** the super-admin calls `PATCH /api/v1/admin/social/settings/:key` with `{ value }`, **Then** the setting is updated, audit event `SETTING_UPDATED` is logged with `old_value_json = { value: "<old>" }` and `new_value_json = { value: "<new>" }` (secrets are redacted in the log). Response HTTP 200.
- **Given** `key = "make_webhook_url"` is updated, **When** the dispatch cron fires next, **Then** it reads the fresh value from `social_settings` (not a cached env var). The cron must query this setting at job start, not at app boot.
- **Given** an unknown `key` is passed to the PATCH endpoint, **When** the call is made, **Then** HTTP 404 with `{ success: false, error: { code: "NOT_FOUND", message: "Setting key not found" } }`.

---

#### US-18: Publish Logs and Audit Log Queries

**As an** admin with `SOCIAL_PUBLISH_LOG_VIEW` and `SOCIAL_AUDIT_LOG_VIEW`, **I want** to query publish history and the full semantic audit trail, **so that** I can diagnose failures and maintain accountability.

**Acceptance Criteria:**

- **Given** the admin holds `SOCIAL_PUBLISH_LOG_VIEW`, **When** `GET /api/v1/admin/social/publish-logs?postId=<id>&status=FAILED` is called, **Then** all matching `social_publish_logs` rows are returned (paginated), ordered by `created_at DESC`.
- **Given** the admin holds `SOCIAL_AUDIT_LOG_VIEW`, **When** `GET /api/v1/admin/social/audit-log?entityType=social_post&entityId=<id>` is called, **Then** all matching `social_audit_log` rows are returned (paginated), ordered by `created_at DESC`. Each row includes `actorId`, `eventType`, `oldValueJson`, `newValueJson`, `metadata`, `createdAt`.
- **Given** the admin calls without the required permission, **Then** HTTP 403 with standard envelope.

---

#### US-19: OpenAPI Schema Export for the Custom GPT

**As an** admin with `SOCIAL_SETTINGS_MANAGE`, **I want** a production-safe admin endpoint that returns the OpenAPI JSON schema for the two GPT-facing operations (catalog + draft submission), **so that** I can copy-paste the schema into the Custom GPT configuration without exposing the full API docs.

**Acceptance Criteria:**

- **Given** the admin holds `SOCIAL_SETTINGS_MANAGE`, **When** `GET /api/v1/admin/social/gpt-action-schema` is called, **Then** the response is an OpenAPI 3.1 JSON document containing exactly two paths: `GET /api/v1/ai/social/catalog` (operationId `getSocialCatalog`) and `POST /api/v1/ai/social/drafts` (operationId `saveSocialDraft`), with accurate request/response schemas derived from the live Zod schemas. Response is `application/json`, HTTP 200.
- **Given** the endpoint is called in production (NODE_ENV = production), **Then** it succeeds (it is a scoped admin endpoint, not the global `/docs/openapi.json` which is disabled in prod).
- **Given** the Zod schemas for the GPT endpoints change, **When** the schema export is called, **Then** the returned JSON reflects the current schema without requiring a manual update (schemas are derived programmatically, not hand-authored).

---

### UX Considerations

#### Admin Panel Flows

Social Posts List (`/admin/social/posts`):

1. Admin lands on the list page. Columns: Thumbnail (small), Title, Status badge (color-coded), Approval Status badge, Platforms (icon row), Scheduled At, Created At, Actions (Approve / View / Archive).
2. Filter bar above the table: Status multi-select, Approval Status multi-select, Platform multi-select, search by title, date range for `created_at`.
3. Pagination at the bottom: `page` + `pageSize` selectors.
4. Clicking a row opens the post detail page.

Post Detail (`/admin/social/posts/:id`):

1. Header: Title, status badge, approval badge, paused toggle.
2. Tabs: Content (caption, hashtags, footer), Media (Cloudinary thumbnail grid), Targets (per-platform status), Logs (last 20 publish log entries), Audit (audit log entries for this post).
3. Action bar (sticky): buttons appear/disappear based on current status and admin permissions. Approve, Reject, Request Changes, Schedule, Mark Ready, Pause/Unpause, Archive. Each action opens a confirmation dialog (with optional free-text reason where applicable).
4. Promote Hashtag: a section under the Content tab lists `gpt_hashtag_payload_json` suggestions. Each suggestion has a "Promote" button that opens a modal to set category/platform/priority before saving.

Dashboard (`/admin/social`):

1. Top row KPIs: Total Posts, Pending Review count (badge), Scheduled count, Published (last 30 days), Failed (action needed).
2. Quick Approval Queue (card list, max 10 items, sorted oldest first, with one-click Approve).
3. Recent Failures table (last 5 FAILED targets with post title, platform, last error, retry count).
4. Publishing Activity chart (last 30 days, by platform).

#### Edge Cases

- A post with zero active targets cannot be approved (HTTP 422 with explicit message).
- Carousel posts (multiple `social_post_media` entries) display all media in an ordered grid in the detail page. The `position` column in `social_post_media` determines order.
- If `scheduled_at` arrives while the post is `PAUSED`, the dispatch cron skips it. When the admin unpauses, the post is NOT auto-dispatched immediately; `next_run_at` must still be <= now() at the next cron cycle.
- A recurrent post whose all targets fail will have `status = FAILED` and `next_run_at = null` (recurrence does NOT rearm on failure; the admin must manually reset).

#### Error States

- Network/Cloudinary failure during GPT draft ingestion: draft is created with `status = NEEDS_REVIEW` and the media `cloudinary_url = null`. The admin detail page shows a "Media pending upload" warning badge.
- Make webhook URL not configured (`social_settings` key `make_webhook_url` is empty/placeholder): the dispatch cron logs a WARN and skips dispatch entirely. The social dashboard shows a system alert "Make webhook URL is not configured".
- All 3 retries exhausted on a target: the target and post are set to `FAILED`. The dashboard's "Recent Failures" section highlights these with a "Max retries reached — manual action required" label.

#### Loading States

- Post list: skeleton rows shown while TanStack Query fetches.
- Approve/reject/schedule actions: the action button shows a spinner and is disabled while the mutation is in flight.
- Quick Approval Queue: individual item shows spinner when approve is clicked; removed from list on success, re-shown with error badge on failure.

#### Empty States

- No posts: "No social posts yet. Drafts submitted by the Custom GPT will appear here."
- No pending review posts: "No posts pending review."
- No publish logs for a post: "No publish history yet."
- No audit entries: "No audit events recorded for this post."

#### Accessibility

- Status badges use both color and text label (never color alone).
- Platform icons include `aria-label` with the platform name.
- All action buttons have descriptive `aria-label` (e.g., "Approve post: Trip to Colón").
- Keyboard navigation works through the list and quick-approval queue (Tab + Enter triggers approve).
- Error and warning messages are surfaced in ARIA live regions so screen readers announce them.

---

### Out of Scope

- **Airtable migration / data import**: Moving existing Airtable social post data into the new system is a separate migration spec. This spec builds the new system only; coexistence with Airtable during the transition is not addressed here.
- **Airtable decommission**: Formally deprecating and removing the Airtable integration (and updating the GPT system prompt to point only to the new backend) is a follow-up spec once this backend is stable.
- **Custom GPT embedded in Hospeda platform**: The research spike to determine whether the Custom GPT can be accessed from within the Hospeda admin panel (instead of ChatGPT.com) is a separate exploration spec. This spec assumes the GPT is an external ChatGPT Custom GPT calling our API.
- **Web-facing social feed**: Displaying published social posts on the public Hospeda website is out of scope.
- **Direct platform API integration**: This spec uses Make.com as the intermediary for platform API calls. Direct Instagram Graph API / Facebook API / X API integration is deferred.
- **Multi-image generation by GPT**: The GPT draft payload supports one image reference (single asset or openai_file_refs array). Full carousel generation from GPT (multiple ordered images) is a phase-5 enhancement.

---

## Part 2: Technical Analysis

### Architecture

- **Pattern**: Layered monorepo service — shared DB models + Zod schemas in packages, service business logic in `@repo/service-core`, thin Hono routes in `apps/api`, React admin UI in `apps/admin`. External integrations (Cloudinary, Make.com) are wrapped behind service calls.
- **Components (new)**:
  - 17 DB tables in `packages/db/src/schemas/social/` domain.
  - 9 new TS enums in `packages/schemas/src/enums/social-*.enum.ts`.
  - ~12 Zod schema entity directories in `packages/schemas/src/entities/social/`.
  - ~10 service modules in `packages/service-core/src/services/social/` (8 catalog CRUD services + 2 non-CRUD pipeline services: `SocialDraftIngestionService` and `SocialPublishDispatchService`).
  - 1 new inbound API-key middleware in `apps/api/src/middlewares/api-key.ts`.
  - 1 new `createApiKeyRoute` factory added to `apps/api/src/utils/route-factory-tiered.ts`.
  - ~25 route files across 3 route groups (`/ai/social/`, `/integrations/make/social/`, `/admin/social/`).
  - 1 new cron job `social-publish-dispatch.job.ts`.
  - Admin UI pages/components in `apps/admin/src/routes/social/`.
- **Integration points**:
  - `@repo/media` (CloudinaryProvider) for image upload.
  - `social_settings.make_webhook_url` → outbound Make.com webhook.
  - `x-make-apikey` from env `HOSPEDA_MAKE_API_KEY` for Make authentication.
  - Better Auth session for admin routes.
  - Existing `auditLog()` from `@repo/logger` (route-level mutations are auto-logged); `social_audit_log` is the semantic layer on top.
- **Data flow**:
  1. GPT → `POST /api/v1/ai/social/drafts` → `SocialDraftIngestionService` → (media download + Cloudinary upload) → `social_posts` + `social_post_media` + `social_post_hashtags` + `social_ai_requests`.
  2. Admin → approval/scheduling actions → `SocialPostService` → state transition → `social_audit_log`.
  3. Cron `social-publish-dispatch` → `SocialPublishDispatchService.dispatch()` → finds qualifying targets → POSTs to Make webhook → updates target/post status → `social_publish_logs`.
  4. Make → claim callback → updates target to PUBLISHING. Make → result callback → updates target + cascades post status + recomputes recurrence.

---

### Data Model Changes

All new tables land in the `social` domain directory. Every table has the global columns: `id UUID PK defaultRandom()`, `created_at timestamptz defaultNow()`, `updated_at timestamptz defaultNow()` (maintained by `set_updated_at` trigger via extras carril). Audit-FK tables also have `created_by_id UUID FK users(id) onDelete SET NULL`, `updated_by_id UUID FK users(id) onDelete SET NULL`, `deleted_at timestamptz nullable`, `deleted_by_id UUID FK users(id) onDelete SET NULL`. Append-only tables (social_publish_logs, social_ai_requests, social_audit_log) omit soft-delete and audit-FK columns.

| Table | Change | Description |
|---|---|---|
| `social_campaigns` | new | Content campaign grouping (name, slug UNIQUE, description, active, starts_at, ends_at) |
| `social_content_batches` | new | Publishing batch / sprint (name, slug UNIQUE, description, active, starts_at, ends_at) |
| `social_audiences` | new | Target audience descriptor (name, slug UNIQUE, description, active) |
| `social_platforms` | new | Per-platform config row (platform enum PK, label, enabled, notes) |
| `social_platform_formats` | new | Platform × format config (platform enum, publish_format enum, media_type enum, enabled, mvp_enabled, recommended_ratio, recommended_size, max_caption_length, requires_public_url, requires_media, make_channel_key, notes). Composite UNIQUE (platform, publish_format). |
| `social_hashtag_sets` | new | Named hashtag collections (name, slug, platform nullable, hashtags_text, priority, active, notes) |
| `social_hashtags` | new | Individual hashtag catalog entry (hashtag, normalized_hashtag UNIQUE, category, platform nullable, audience_id FK nullable, priority, active, notes) |
| `social_post_footers` | new | Reusable post footer templates (name, slug, content, platform nullable, active, is_default, priority, notes) |
| `social_assets` | new | Cloudinary-hosted media assets (source enum, cloudinary_url, cloudinary_public_id, original_url nullable, openai_file_ref nullable, mime_type nullable, media_type enum, width, height, duration_seconds, alt_text, caption, metadata_json) |
| `social_ai_requests` | new | Append-only GPT ingestion log (request_id UNIQUE, source enum, topic, user_idea, pillar, audience_id FK nullable, suggested_platforms_json, suggested_format, generated_caption_base, raw_request_json, raw_response_json, status, error_message) |
| `social_posts` | new | Master post record (draft_id UNIQUE, title, slug, source enum, pillar, campaign_id FK nullable, batch_id FK nullable, batch_position nullable, audience_id FK nullable, footer_id FK nullable, base_hashtag_set_id FK nullable, caption_base, final_caption, final_hashtags_text, status enum, approval_status enum, paused bool default false, retry_count int default 0, scheduled_at nullable, timezone, recurrence_type enum default ONCE, recurrence_params_json nullable, next_run_at nullable, notes, internal_notes, gpt_hashtag_payload_json, metadata_json, approved_by_id FK nullable, approved_at nullable) |
| `social_post_media` | new | Post ↔ asset join table (social_post_id FK, asset_id FK, position int). Composite UNIQUE (social_post_id, position). |
| `social_post_targets` | new | Per-platform publish target (social_post_id FK, platform enum, publish_format enum, media_type enum, platform_format_id FK, caption_override nullable, hashtags_override_text nullable, footer_override nullable, status enum, scheduled_at nullable, published_at nullable, external_post_id nullable, external_post_url nullable, make_scenario_key nullable, make_last_run_id nullable, make_payload_json nullable, last_error_message nullable) |
| `social_post_hashtags` | new | Post ↔ hashtag join table (social_post_id FK, hashtag_id FK, position int). Composite UNIQUE (social_post_id, hashtag_id). |
| `social_publish_logs` | new | Append-only publish event log (social_post_id FK, social_post_target_id FK nullable, platform enum nullable, publish_format enum nullable, status enum, message, request_payload_json, response_payload_json, external_post_id nullable, external_post_url nullable, make_run_id nullable) |
| `social_settings` | new | Key-value settings store (key UNIQUE, value text, type text, active bool, description) |
| `social_audit_log` | new | Append-only semantic audit trail (actor_id UUID nullable, event_type text, entity_type text, entity_id text, old_value_json jsonb nullable, new_value_json jsonb nullable, metadata_json jsonb nullable) |

**Migration strategy**:

- Carril 1 (structural): All 17 tables + all 9 pgEnums via `pnpm db:generate` → produces migration file `0022_social_automation.sql`. Run with `pnpm db:migrate`.
- Carril 2 (extras): `packages/db/src/migrations/extras/018-social-indexes.kind.sql` — adds: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_social_posts_status ON social_posts(status)`, `idx_social_posts_next_run_at ON social_posts(next_run_at) WHERE next_run_at IS NOT NULL`, `idx_social_post_targets_status ON social_post_targets(status)`, `idx_social_audit_log_entity ON social_audit_log(entity_type, entity_id)`, `idx_social_publish_logs_post ON social_publish_logs(social_post_id, created_at DESC)`. All idempotent.
- Extras `019-social-set-updated-at.trigger.sql`: registers the `set_updated_at` trigger for all new tables that have `updated_at` (i.e., all except the append-only trio).

**Enum files (9 new, one file each in `packages/schemas/src/enums/`):**

- `social-platform.enum.ts` → `SocialPlatform { INSTAGRAM, FACEBOOK, X }`
- `social-publish-format.enum.ts` → `SocialPublishFormat { FEED_POST, PHOTO_POST, TEXT_POST, IMAGE_POST, VIDEO_POST, REEL, STORY, CAROUSEL }`
- `social-media-type.enum.ts` → `SocialMediaType { IMAGE, VIDEO, NONE }`
- `social-post-status.enum.ts` → `SocialPostStatus { DRAFT, NEEDS_REVIEW, APPROVED, SCHEDULED, READY_TO_PUBLISH, PUBLISHING, PUBLISHED, FAILED, PAUSED, ARCHIVED }`
- `social-approval-status.enum.ts` → `SocialApprovalStatus { PENDING, APPROVED, REJECTED, CHANGES_REQUESTED }`
- `social-source.enum.ts` → `SocialSource { CHATGPT, ADMIN, IMPORT, SYSTEM }`
- `social-asset-source.enum.ts` → `SocialAssetSource { CHATGPT_FILE, CLOUDINARY, MANUAL_UPLOAD, EXTERNAL_URL }`
- `social-publish-result-status.enum.ts` → `SocialPublishResultStatus { SUCCESS, FAILED, SKIPPED, RETRYING }`
- `social-recurrence-type.enum.ts` → `SocialRecurrenceType { ONCE, WEEKLY, BIWEEKLY, MONTHLY }`
- Each file has a matching `social-<name>.schema.ts` with `z.nativeEnum(SocialXxx)`. All exported from `packages/schemas/src/enums/index.ts`.

**New PermissionCategoryEnum values (in `permission.enum.ts`):**
`SOCIAL_POST`, `SOCIAL_HASHTAG`, `SOCIAL_CAMPAIGN`, `SOCIAL_BATCH`, `SOCIAL_AUDIENCE`, `SOCIAL_PLATFORM`, `SOCIAL_FOOTER`, `SOCIAL_SETTINGS`, `SOCIAL_AUDIT`

**~25 new PermissionEnum values** (SCREAMING_SNAKE key, camelCase dot value):

```
SOCIAL_POST_VIEW            = 'socialPost.view'
SOCIAL_POST_CREATE          = 'socialPost.create'
SOCIAL_POST_UPDATE          = 'socialPost.update'
SOCIAL_POST_APPROVE         = 'socialPost.approve'
SOCIAL_POST_SCHEDULE        = 'socialPost.schedule'
SOCIAL_POST_PAUSE           = 'socialPost.pause'
SOCIAL_POST_ARCHIVE         = 'socialPost.archive'
SOCIAL_POST_HARD_DELETE     = 'socialPost.hardDelete'
SOCIAL_POST_VIEW_LOGS       = 'socialPost.viewLogs'
SOCIAL_HASHTAG_VIEW         = 'socialHashtag.view'
SOCIAL_HASHTAG_MANAGE       = 'socialHashtag.manage'
SOCIAL_HASHTAG_SET_MANAGE   = 'socialHashtagSet.manage'
SOCIAL_FOOTER_MANAGE        = 'socialFooter.manage'
SOCIAL_CAMPAIGN_MANAGE      = 'socialCampaign.manage'
SOCIAL_BATCH_MANAGE         = 'socialBatch.manage'
SOCIAL_AUDIENCE_MANAGE      = 'socialAudience.manage'
SOCIAL_PLATFORM_MANAGE      = 'socialPlatform.manage'
SOCIAL_PLATFORM_FORMAT_VIEW = 'socialPlatformFormat.view'
SOCIAL_ASSET_VIEW           = 'socialAsset.view'
SOCIAL_ASSET_MANAGE         = 'socialAsset.manage'
SOCIAL_SETTINGS_MANAGE      = 'socialSettings.manage'
SOCIAL_PUBLISH_LOG_VIEW     = 'socialPublishLog.view'
SOCIAL_AUDIT_LOG_VIEW       = 'socialAuditLog.view'
SOCIAL_DISPATCH_MANAGE      = 'socialDispatch.manage'
```

All 25 permissions are assigned to both `ADMIN` and `SUPER_ADMIN` in `packages/seed/src/required/rolePermissions.seed.ts`. No new roles are created.

---

### API Design

All endpoints use the standard `ResponseFactory` envelope: success → `{ success: true, data: <T>, metadata?: <M> }`, error → `{ success: false, error: { code: string, message: string, details?: [...] } }`.

---

#### GET /api/v1/ai/social/catalog

- **Auth**: Inbound API-key middleware — validates `x-hospeda-ai-key` against `HOSPEDA_AI_SOCIAL_KEY` env var using `timingSafeEqual`. The catalog endpoint requires ONLY the API key; `operator_pin` is NOT checked here (it gates `POST /drafts` only).
- **Request**: No body. Optional query `?locale=es` (default `es`).
- **Response**:

```json
{
  "success": true,
  "data": {
    "hashtags": [{ "id": "uuid", "hashtag": "#playa", "normalizedHashtag": "#playa", "category": "nature", "platform": null, "priority": 1 }],
    "hashtagSets": [{ "id": "uuid", "name": "Verano", "slug": "verano", "platform": "INSTAGRAM", "hashtagsText": "#playa #verano", "priority": 1 }],
    "footers": [{ "id": "uuid", "name": "Hospeda Default", "slug": "hospeda-default", "content": "Reservá en hospeda.com.ar 🏡", "platform": null }],
    "platformFormats": [{ "platform": "INSTAGRAM", "publishFormat": "FEED_POST", "mediaType": "IMAGE", "maxCaptionLength": 2200, "makeChannelKey": "instagram-feed", "requiresMedia": true }],
    "campaigns": [{ "id": "uuid", "name": "Institucional Hospeda", "slug": "institucional-hospeda" }],
    "batches": [{ "id": "uuid", "name": "Hospeda Launch 2026-06", "slug": "hospeda-launch-2026-06" }],
    "audiences": [{ "id": "uuid", "name": "Turistas", "slug": "turistas" }],
    "defaults": { "timezone": "America/Argentina/Buenos_Aires", "campaignSlug": "institucional-hospeda", "batchSlug": "hospeda-launch-2026-06", "maxHashtagsPerPlatform": { "INSTAGRAM": 30, "FACEBOOK": 10, "X": 5 } }
  }
}
```

- **Errors**: 401 invalid key, 429 rate limit exceeded.

---

#### POST /api/v1/ai/social/drafts

- **Auth**: Same inbound API-key middleware as catalog; `operator_pin` in request body.
- **Request body** (Zod schema `CreateSocialDraftSchema`):

```json
{
  "operatorPin": "1234",
  "draftId": "gpt-unique-id-abc123",
  "title": "Fin de semana en las termas",
  "pillar": "travel",
  "campaignSlug": "institucional-hospeda",
  "batchSlug": "hospeda-launch-2026-06",
  "audienceSlug": "turistas",
  "captionBase": "¿Buscás un escape relajante? ...",
  "baseHashtagSetSlug": "verano",
  "curatedHashtags": ["#playa", "#hospeda"],
  "customHashtagSuggestions": ["#termasCDU", "#litoral2026"],
  "footerSlug": "hospeda-default",
  "image": {
    "mode": "public_url",
    "url": "https://files.oaiusercontent.com/abc.jpg",
    "altText": "Termas de CDU",
    "mimeType": "image/jpeg"
  },
  "targets": [
    { "platform": "INSTAGRAM", "publishFormat": "FEED_POST" },
    { "platform": "FACEBOOK", "publishFormat": "PHOTO_POST" }
  ],
  "notes": "Agendar para lunes 9am"
}
```

- **Response** (HTTP 201):

```json
{
  "success": true,
  "data": {
    "postId": "uuid",
    "draftId": "gpt-unique-id-abc123",
    "status": "NEEDS_REVIEW",
    "approvalStatus": "PENDING",
    "targetsCreated": 2,
    "assetStatus": "uploaded",
    "warnings": []
  }
}
```

- **Errors**: 401 invalid key, 403 invalid pin, 409 duplicate draftId, 422 validation failure (zero valid targets, malformed body).

---

#### POST /api/v1/admin/social/posts/:id/approve

- **Auth**: Admin session (`adminAuthMiddleware`) + permission `SOCIAL_POST_APPROVE`.
- **Request**: No body required.
- **Response** (HTTP 200):

```json
{ "success": true, "data": { "id": "uuid", "status": "APPROVED", "approvalStatus": "APPROVED", "approvedAt": "2026-06-20T10:00:00Z" } }
```

- **Errors**: 403 missing permission, 404 post not found, 422 invalid state or missing media.

---

#### POST /api/v1/admin/social/posts/:id/reject

- **Auth**: Admin session + `SOCIAL_POST_APPROVE`.
- **Request**: `{ "reason": "Caption needs revision — too promotional" }`.
- **Response** (HTTP 200): `{ "success": true, "data": { "id": "uuid", "approvalStatus": "REJECTED" } }`.
- **Errors**: 403, 404, 422 (blank reason, invalid state).

---

#### POST /api/v1/admin/social/posts/:id/request-changes

- **Auth**: Admin session + `SOCIAL_POST_APPROVE`.
- **Request**: `{ "feedback": "Please shorten caption and remove last hashtag" }`.
- **Response** (HTTP 200): `{ "success": true, "data": { "id": "uuid", "approvalStatus": "CHANGES_REQUESTED" } }`.
- **Errors**: 403, 404, 422 (blank feedback, invalid state).

---

#### POST /api/v1/admin/social/posts/:id/schedule

- **Auth**: Admin session + `SOCIAL_POST_SCHEDULE`.
- **Request**: `{ "scheduledAt": "2026-06-23T09:00:00Z", "timezone": "America/Argentina/Buenos_Aires" }`.
- **Response** (HTTP 200): `{ "success": true, "data": { "id": "uuid", "status": "SCHEDULED", "scheduledAt": "2026-06-23T09:00:00Z", "nextRunAt": "2026-06-23T09:00:00Z" } }`.
- **Errors**: 403, 404, 422 (scheduledAt in past, invalid state).

---

#### POST /api/v1/admin/social/posts/:id/mark-ready

- **Auth**: Admin session + `SOCIAL_POST_SCHEDULE`.
- **Request**: No body.
- **Response** (HTTP 200): `{ "success": true, "data": { "id": "uuid", "status": "READY_TO_PUBLISH", "nextRunAt": "<now>" } }`.
- **Errors**: 403, 404, 422 (post not APPROVED).

---

#### POST /api/v1/admin/social/posts/:id/pause

- **Auth**: Admin session + `SOCIAL_POST_PAUSE`.
- **Request**: No body.
- **Response** (HTTP 200): `{ "success": true, "data": { "id": "uuid", "paused": true } }`.
- **Errors**: 403, 404, 422 (already paused or invalid state).

---

#### POST /api/v1/admin/social/posts/:id/unpause

- **Auth**: Admin session + `SOCIAL_POST_PAUSE`.
- **Request**: No body.
- **Response** (HTTP 200): `{ "success": true, "data": { "id": "uuid", "paused": false } }`.
- **Errors**: 403, 404, 422 (not paused).

---

#### POST /api/v1/admin/social/posts/:id/archive

- **Auth**: Admin session + `SOCIAL_POST_ARCHIVE`.
- **Request**: No body.
- **Response** (HTTP 200): `{ "success": true, "data": { "id": "uuid", "status": "ARCHIVED", "deletedAt": "<now>" } }`.
- **Errors**: 403, 404, 422 (post in PUBLISHING state).

---

#### POST /api/v1/admin/social/posts/:id/promote-hashtag

- **Auth**: Admin session + `SOCIAL_HASHTAG_MANAGE`.
- **Request**: `{ "hashtag": "#termasCDU", "category": "travel", "platform": "INSTAGRAM", "audienceId": null, "priority": 5 }`.
- **Response** (HTTP 201 or 200 if existing): `{ "success": true, "data": { "hashtagId": "uuid", "hashtag": "#termascdu", "isNew": true } }`.
- **Errors**: 403, 404 (post not found), 422 (invalid hashtag format).

---

#### GET /api/v1/admin/social/posts

- **Auth**: Admin session + `SOCIAL_POST_VIEW`.
- **Query params**: `page` (int, default 1), `pageSize` (int, default 20, max 100), `status` (SocialPostStatus enum), `approvalStatus` (SocialApprovalStatus enum), `platform` (SocialPlatform enum), `search` (string, matched against title using `safeIlike`), `createdAtFrom` (ISO date), `createdAtTo` (ISO date), `includeDeleted` (bool, default false).
- **Response** (HTTP 200): `{ "success": true, "data": { "items": [...], "pagination": { "page": 1, "pageSize": 20, "total": 142 } } }`.
- **Errors**: 403, 422 (invalid query param types).

---

#### GET /api/v1/admin/social/posts/:id

- **Auth**: Admin session + `SOCIAL_POST_VIEW`.
- **Response** (HTTP 200): Full post object with nested `targets`, `media` (with Cloudinary URLs), `hashtags` (resolved), last 10 `publishLogs`, `gptHashtagPayloadJson`.
- **Errors**: 403, 404.

---

#### PATCH /api/v1/admin/social/posts/:id

- **Auth**: Admin session + `SOCIAL_POST_UPDATE`.
- **Request**: Partial update of `title`, `captionBase`, `finalCaption`, `finalHashtagsText`, `notes`, `internalNotes`, `footerId`, `campaignId`, `batchId`, `audienceId`, `batchPosition`. State fields (`status`, `approvalStatus`, `paused`) are NOT updatable via this endpoint; use the dedicated action endpoints.
- **Response** (HTTP 200): `{ "success": true, "data": { ...updatedPost } }`.
- **Errors**: 403, 404, 422.

---

#### POST /api/v1/integrations/make/social/jobs/:targetId/claim

- **Auth**: Inbound API-key middleware — validates `x-hospeda-make-key` against `HOSPEDA_MAKE_INBOUND_KEY` env var using `timingSafeEqual`.
- **Request**: `{ "makeRunId": "make-run-abc123" }`.
- **Response** (HTTP 200): `{ "success": true, "data": { "targetId": "uuid", "status": "PUBLISHING", "makeRunId": "make-run-abc123" } }`.
- **Errors**: 401 invalid key, 404 target not found, 409 already published.

---

#### POST /api/v1/integrations/make/social/jobs/:targetId/result

- **Auth**: Inbound API-key middleware — same `x-hospeda-make-key` validation.
- **Request**:

```json
{
  "makeRunId": "make-run-abc123",
  "status": "SUCCESS",
  "externalPostId": "17853123456789",
  "externalPostUrl": "https://www.instagram.com/p/xyz/",
  "errorMessage": null
}
```

- **Response** (HTTP 200): `{ "success": true, "data": { "targetId": "uuid", "status": "PUBLISHED", "postStatus": "PUBLISHED", "nextRunAt": null } }`.
- **Errors**: 401 invalid key, 404 target not found, 422 invalid status value.

---

#### CRUD endpoints for catalog entities

Pattern is consistent across all catalog entities. Paths, permissions, and entity-specific fields:

| Entity | Base path | Create permission | Manage permission | Required fields on create |
|---|---|---|---|---|
| Hashtags | `/api/v1/admin/social/hashtags` | `SOCIAL_HASHTAG_MANAGE` | `SOCIAL_HASHTAG_MANAGE` | `hashtag`, `category` |
| Hashtag Sets | `/api/v1/admin/social/hashtag-sets` | `SOCIAL_HASHTAG_SET_MANAGE` | `SOCIAL_HASHTAG_SET_MANAGE` | `name`, `slug`, `hashtagsText` |
| Footers | `/api/v1/admin/social/footers` | `SOCIAL_FOOTER_MANAGE` | `SOCIAL_FOOTER_MANAGE` | `name`, `slug`, `content` |
| Campaigns | `/api/v1/admin/social/campaigns` | `SOCIAL_CAMPAIGN_MANAGE` | `SOCIAL_CAMPAIGN_MANAGE` | `name`, `slug` |
| Batches | `/api/v1/admin/social/batches` | `SOCIAL_BATCH_MANAGE` | `SOCIAL_BATCH_MANAGE` | `name`, `slug` |
| Audiences | `/api/v1/admin/social/audiences` | `SOCIAL_AUDIENCE_MANAGE` | `SOCIAL_AUDIENCE_MANAGE` | `name`, `slug` |

All list endpoints support `?search=`, `?page=`, `?pageSize=` and return paginated results. All PATCH endpoints accept partial updates of non-id/non-slug fields. All DELETE endpoints are soft-delete only. `GET /list` returns HTTP 200 with `{ success: true, data: { items: [...], pagination: {...} } }`. `POST` returns HTTP 201. `PATCH` and `DELETE` return HTTP 200.

---

#### GET /api/v1/admin/social/platform-formats

- **Auth**: Admin session + `SOCIAL_PLATFORM_FORMAT_VIEW`.
- **Response**: All 13 platform-format rows (from seed), ordered by `platform ASC, publish_format ASC`. Fields: `id`, `platform`, `publishFormat`, `mediaType`, `enabled`, `mvpEnabled`, `recommendedRatio`, `recommendedSize`, `maxCaptionLength`, `requiresPublicUrl`, `requiresMedia`, `makeChannelKey`, `notes`.

---

#### PATCH /api/v1/admin/social/platform-formats/:id

- **Auth**: Admin session + `SOCIAL_PLATFORM_MANAGE`.
- **Updatable fields**: `enabled`, `mvpEnabled`, `maxCaptionLength`, `makeChannelKey`, `notes`, `recommendedRatio`, `recommendedSize`.
- **Response** (HTTP 200): Updated row + warnings if active targets reference the format.

---

#### GET /api/v1/admin/social/settings

- **Auth**: Admin session + `SOCIAL_SETTINGS_MANAGE`.
- **Response**: Array of settings rows. `type = "secret"` values masked as `"***"`.

---

#### PATCH /api/v1/admin/social/settings/:key

- **Auth**: Admin session + `SOCIAL_SETTINGS_MANAGE`.
- **Request**: `{ "value": "<new-value>" }`.
- **Response** (HTTP 200): `{ "success": true, "data": { "key": "make_webhook_url", "value": "<new-value>" } }`. Secret settings: value is echoed back in full to the setter on the PATCH response (so they can confirm it was accepted), but masked in GET responses and audit logs.

---

#### GET /api/v1/admin/social/publish-logs

- **Auth**: Admin session + `SOCIAL_PUBLISH_LOG_VIEW`.
- **Query params**: `postId`, `targetId`, `status` (SocialPublishResultStatus), `platform`, `page`, `pageSize`.
- **Response**: Paginated list ordered `created_at DESC`.

---

#### GET /api/v1/admin/social/audit-log

- **Auth**: Admin session + `SOCIAL_AUDIT_LOG_VIEW`.
- **Query params**: `entityType`, `entityId`, `eventType`, `actorId`, `createdAtFrom`, `createdAtTo`, `page`, `pageSize`.
- **Response**: Paginated list ordered `created_at DESC`.

---

#### GET /api/v1/admin/social/gpt-action-schema

- **Auth**: Admin session + `SOCIAL_SETTINGS_MANAGE`.
- **Response**: `Content-Type: application/json`, OpenAPI 3.1 document with exactly 2 paths: `GET /api/v1/ai/social/catalog` (operationId `getSocialCatalog`) and `POST /api/v1/ai/social/drafts` (operationId `saveSocialDraft`). Schemas are generated programmatically from the Zod schemas `GetSocialCatalogResponseSchema` and `CreateSocialDraftSchema`.

---

#### GET /api/v1/admin/social/dashboard

- **Auth**: Admin session + `SOCIAL_POST_VIEW`.
- **Response**:

```json
{
  "success": true,
  "data": {
    "kpis": {
      "totalPosts": 148,
      "pendingReview": 5,
      "scheduled": 3,
      "publishedLast30Days": 42,
      "failedActionNeeded": 2
    },
    "quickApprovalQueue": [{ "id": "uuid", "title": "...", "status": "NEEDS_REVIEW", "platforms": ["INSTAGRAM"], "thumbnailUrl": "...", "createdAt": "..." }],
    "recentFailures": [{ "targetId": "uuid", "postTitle": "...", "platform": "FACEBOOK", "lastError": "...", "retryCount": 3, "failedAt": "..." }],
    "makeWebhookConfigured": true
  }
}
```

- **Errors**: 403.

---

### Dependencies

**External packages:**

| Package | Version | Purpose |
|---|---|---|
| `node:crypto` | built-in | `timingSafeEqual`, `createHmac` for inbound key validation |

No new npm packages are required. All functionality uses existing codebase dependencies.

**Internal packages affected:**

- `packages/schemas` — 9 new enum files, ~12 entity schema directories, new permission/category enum entries.
- `packages/db` — 17 new table schema files in `social/` domain, 2 new extras migration files, new migration file `0022`.
- `packages/service-core` — ~10 new service modules in `social/` subdirectory.
- `packages/seed` — new `social*.seed.ts` files registered in `runRequiredSeeds`.
- `packages/media` — minor extension: add `duration_seconds?: number` to `UploadResult` type (one-line addition).
- `apps/api` — new middleware `api-key.ts`, `createApiKeyRoute` factory, route files across 3 groups, 1 new cron job.
- `apps/admin` — new route files and components under `src/routes/social/`.
- `packages/i18n` — translation keys for all new UI strings (ES required, EN + PT optional for this phase).

---

### Risks & Mitigations

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Make webhook URL misconfigured in settings | M | H | Cron checks for empty/placeholder URL before dispatching; shows system alert on dashboard. Deployment checklist item. |
| Image download from OpenAI CDN fails (rate limit, expired URL) | M | M | Draft is created anyway with null cloudinary_url; warning returned in response; admin sees "Media pending upload" badge. |
| Cloudinary upload quota exceeded | L | H | `@repo/media` `healthCheck()` is called by the existing media-orphan-cleanup cron; add alert to dashboard if health fails. |
| Duplicate dispatch (cron fires while Make is already processing) | L | H | Optimistic lock: target is set to `PUBLISHING` before the outbound webhook call; cron query excludes PUBLISHING targets. Make claim callback is idempotent. |
| Concurrent approval + cron dispatch race | L | M | The dispatch cron reads `status` only after the target is `APPROVED`. The database transaction for approve sets status atomically. A post can be dispatched immediately after approval only if `next_run_at <= now()` — for newly approved posts without a schedule, this is not true until `mark-ready` is called. |
| Permission matrix grows too large for junior devs to navigate | M | M | Each permission is documented inline in `permission.enum.ts` with a JSDoc comment. A permissions reference table is added to `apps/api/docs/route-architecture.md`. |
| `social_audit_log` grows unbounded | L | M | Add `social-audit-log-purge.job.ts` cron (configurable retention, default 1 year) in a follow-up spec. The append-only table design supports this without schema changes. |
| Make.com returns inconsistent `makeRunId` across retries | L | M | The result callback is keyed on `targetId` (path param), not on `makeRunId`. The `makeRunId` is stored for debugging but is not the authoritative key. |

---

### Performance Considerations

- **Expected load**: The social pipeline is low-throughput compared to the accommodation/billing paths. Expected: 5-20 GPT draft submissions/day, 5-50 admin actions/day, 1-5 Make callbacks/day. The dispatch cron fires every 5 minutes (configurable).
- **Bottlenecks**:
  - Image download + Cloudinary upload in the GPT draft endpoint is the only latency-heavy operation (~1-5 seconds). This must be handled within the HTTP request timeout; if it exceeds 25 seconds, return the draft with a media-pending warning.
  - The dashboard KPI query aggregates across `social_posts` and `social_post_targets`. Must use the `idx_social_posts_status` index.
- **Optimization needs**:
  - `idx_social_posts_next_run_at` (partial index on non-null values) ensures the dispatch cron query is efficient even with thousands of posts.
  - TanStack Query on the admin UI caches post list and dashboard data for 30 seconds (stale-while-revalidate).
  - The quick-approval queue widget fetches a maximum of 10 items; no pagination needed.
- **Monitoring**:
  - Dispatch cron logs each run to `cron_runs` table (existing pattern) with `jobName = "social-publish-dispatch"`, `status`, and `itemsProcessed`.
  - Sentry: tag all social route errors with `feature: social-automation`.
  - Dashboard `makeWebhookConfigured` flag is a live check (not cached) on the settings value.

---

## Implementation Approach

### Phase 1: Data Model + Catalog

1. [ ] Add 9 new TS enums + Zod schemas to `packages/schemas/src/enums/social-*.enum.ts` (one file per enum).
2. [ ] Export all from `packages/schemas/src/enums/index.ts`.
3. [ ] Register all 9 pgEnums in `packages/db/src/schemas/enums.dbschema.ts` using `enumToTuple`.
4. [ ] Add ~25 new `PermissionEnum` values + 9 `PermissionCategoryEnum` values to `packages/schemas/src/enums/permission.enum.ts`.
5. [ ] Create the 17 table schema files in `packages/db/src/schemas/social/` (one file per table, with `relations()` block in each file).
6. [ ] Export all table schemas from `packages/db/src/schemas/index.ts`.
7. [ ] Run `pnpm db:generate` → verify generated migration file (expected next: `0022_social_automation.sql`).
8. [ ] Write extras `018-social-indexes.kind.sql` and `019-social-set-updated-at.trigger.sql` in `packages/db/src/migrations/extras/`.
9. [ ] Create DB model files in `packages/db/src/models/social/` (one per catalog entity, extending `BaseModelImpl`).
10. [ ] Create Zod entity schema dirs in `packages/schemas/src/entities/social/` for all 17 entities (`.schema.ts`, `.crud.schema.ts`, `.query.schema.ts`, `.http.schema.ts`, `.access.schema.ts`, `.admin-search.schema.ts`, `index.ts`).
11. [ ] Create 8 catalog CRUD services in `packages/service-core/src/services/social/` (hashtag, hashtag-set, footer, campaign, batch, audience, platform-format, settings). Each with `.service.ts`, `.permissions.ts`, `.normalizers.ts`, `.types.ts`.
12. [ ] Register ~25 permissions in `packages/seed/src/required/rolePermissions.seed.ts` for `ADMIN` + `SUPER_ADMIN`.
13. [ ] Write seed files for catalog entities (`social-platforms.seed.ts`, `social-platform-formats.seed.ts`, `social-campaigns.seed.ts`, `social-content-batches.seed.ts`, `social-audiences.seed.ts`, `social-hashtag-sets.seed.ts`, `social-hashtags.seed.ts`, `social-post-footers.seed.ts`, `social-settings.seed.ts`) using `createSeedFactory` + JSON fixtures in `src/data/social/`.
14. [ ] Register seed files in `runRequiredSeeds`.
15. [ ] Wire catalog CRUD admin routes: `GET/POST /admin/social/hashtags`, `GET/PATCH/DELETE /admin/social/hashtags/:id`, and equivalent for all 6 catalog types + platform-formats + settings.
16. [ ] Write unit tests for catalog services (hashtag normalization, slug uniqueness, platform-format enable/disable warnings, settings masking).
17. [ ] Build admin UI pages: `/admin/social/hashtags`, `/admin/social/footers`, `/admin/social/campaigns`, `/admin/social/batches`, `/admin/social/audiences`, `/admin/social/platform-formats`, `/admin/social/settings` (standard TanStack Start + TanStack Query + Shadcn DataTable pattern).

### Phase 2: GPT Ingestion

18. [ ] Add env vars `HOSPEDA_AI_SOCIAL_KEY` and `HOSPEDA_OPERATOR_PIN_HASH` to `apps/api/src/utils/env.ts` (Zod schema), `apps/api/.env.example`, and `packages/config/src/env-registry.*.ts`.
19. [ ] Create `apps/api/src/middlewares/api-key.ts` — the inbound API-key middleware factory. Accepts a config: `{ headerName: string, envVarKey: string, errorCode: string }`. Uses `timingSafeEqual`. Returns a standard Hono `MiddlewareHandler`. Injects synthetic actor `{ id: 'api-key', role: 'SYSTEM' }` into context so existing logging hooks work.
20. [ ] Add `createApiKeyRoute` factory to `apps/api/src/utils/route-factory-tiered.ts` — mirrors `createAdminRoute` but swaps `adminAuthMiddleware` for the api-key middleware instance. Accepts `apiKeyConfig` option.
21. [ ] Implement `GET /api/v1/ai/social/catalog` route + handler (read-only query across catalog tables, returns active rows only).
22. [ ] Create `SocialDraftIngestionService` in `packages/service-core/src/services/social/social-draft-ingestion.service.ts`. Responsibilities: validate draft payload, resolve slugs → IDs (campaign, batch, audience, footer, hashtag set), validate targets against `social_platform_formats`, enforce status override (NEEDS_REVIEW + PENDING + paused:false), store `social_posts` + `social_post_targets` + `social_post_hashtags`, store `social_ai_requests` log, trigger image pipeline.
23. [ ] Create image pipeline helper `packages/service-core/src/services/social/social-image-pipeline.service.ts`. Responsibilities: detect `mode` (`public_url` | `openai_file_refs`), extract download URL, download with `fetch()` (timeout 15s — see resolved decision #2), upload to Cloudinary via `getMediaProvider().upload()`, store `social_assets` rows, link via `social_post_media`.
24. [ ] Implement `POST /api/v1/ai/social/drafts` route + handler, calling `SocialDraftIngestionService`.
25. [ ] Add `duration_seconds?: number` to `UploadResult` type in `packages/media/src/types.ts` (one-line change).
26. [ ] Write unit tests: lenient hashtag validation (unknown hashtags → warnings, valid ones → linked), status override enforcement, duplicate `draft_id` → 409, image pipeline success/failure paths, operator_pin timingSafeEqual, missing api-key → 401.
27. [ ] Generate the GPT action schema endpoint `GET /api/v1/admin/social/gpt-action-schema` (programmatic OpenAPI 3.1 generation from Zod schemas).

### Phase 3: Editorial Review + Approval

28. [ ] Create `SocialPostService` in `packages/service-core/src/services/social/social-post.service.ts` as a non-CRUD custom service (does not extend `BaseCrudService`). Methods: `approve()`, `reject()`, `requestChanges()`, `schedule()`, `markReady()`, `pause()`, `unpause()`, `archive()`, `promoteHashtag()`, `listPosts()`, `getPostDetail()`, `updatePost()`.
29. [ ] Create `SocialAuditLogService` in `packages/service-core/src/services/social/social-audit-log.service.ts`. Single method: `log({ actorId, eventType, entityType, entityId, oldValue?, newValue?, metadata? })`. Writes to `social_audit_log` table. All state-transition methods in `SocialPostService` call this after their DB write.
30. [ ] Implement all state-transition routes under `/api/v1/admin/social/posts/:id/` (approve, reject, request-changes, schedule, mark-ready, pause, unpause, archive, promote-hashtag). Each uses `createAdminRoute` with the relevant `requiredPermissions`.
31. [ ] Implement `GET /api/v1/admin/social/posts` (list with filters), `GET /api/v1/admin/social/posts/:id` (detail with nested data), `PATCH /api/v1/admin/social/posts/:id` (partial update).
32. [ ] Implement `GET /api/v1/admin/social/dashboard`.
33. [ ] Implement `GET /api/v1/admin/social/publish-logs` and `GET /api/v1/admin/social/audit-log`.
34. [ ] Build admin UI pages: `apps/admin/src/routes/social/index.tsx` (dashboard), `apps/admin/src/routes/social/posts/index.tsx` (list), `apps/admin/src/routes/social/posts/$id.tsx` (detail). Include the quick-approval queue widget, status badge components, platform icon row, action buttons with permission guards, and the promote-hashtag modal.
35. [ ] Write unit tests: approve transitions, reject requires reason, schedule rejects past dates, pause/unpause state machine, archive blocks on PUBLISHING, promote-hashtag idempotency, post list pagination + filters.
36. [ ] Write integration tests: full draft → approve → schedule → mark-ready flow (in-memory DB or test DB), audit log rows verify at each step.

### Phase 4: Publishing (Make) + Recurrence

37. [ ] Add env vars `HOSPEDA_MAKE_API_KEY` (outbound to Make) and `HOSPEDA_MAKE_INBOUND_KEY` (Make → backend callback) to env schema, `.env.example`, and config registry.
38. [ ] Create `SocialPublishDispatchService` in `packages/service-core/src/services/social/social-publish-dispatch.service.ts`. Methods: `findEligibleTargets()`, `dispatchTarget(targetId)`, `buildMakePayload(target, post)`, `handleMakeCallbackClaim(targetId, makeRunId)`, `handleMakeCallbackResult(targetId, result)`, `cascadePostStatus(postId)`, `rearmRecurrence(post)`.
39. [ ] Register `apps/api/src/middlewares/api-key.ts` instance for the `x-hospeda-make-key` header (separate instance from the GPT key middleware).
40. [ ] Implement `POST /api/v1/integrations/make/social/jobs/:targetId/claim` using `createApiKeyRoute` with the Make key middleware. Calls `SocialPublishDispatchService.handleMakeCallbackClaim()`.
41. [ ] Implement `POST /api/v1/integrations/make/social/jobs/:targetId/result` using `createApiKeyRoute` with the Make key middleware. Calls `SocialPublishDispatchService.handleMakeCallbackResult()` then `cascadePostStatus()` then `rearmRecurrence()`.
42. [ ] Create `apps/api/src/cron/jobs/social-publish-dispatch.job.ts`. Schedule: every 5 minutes (configurable via `social_settings` key `dispatch_cron_interval_minutes`). At job start: read `make_webhook_url` from `social_settings` (fail fast if empty). Query eligible targets. Dispatch each via `SocialPublishDispatchService.dispatchTarget()`. Log to `cron_runs`.
43. [ ] Register the new cron job in `apps/api/src/cron/jobs/index.ts`.
44. [ ] Extend `apps/api/src/middlewares/rate-limit.ts` `getEndpointType()` to return `'ai-inbound'` for `/api/v1/ai/social/*` and `'make-callback'` for `/api/v1/integrations/make/social/*` (or use per-route `customRateLimit`).
45. [ ] Write unit tests: dispatch cron excludes paused posts, excludes posts with no media, retries up to 3 then FAILED, per-target dispatch, claim sets PUBLISHING, result SUCCESS cascades post to PUBLISHED, result FAILED with retry < 3 resets to APPROVED, recurrence ONCE → next_run_at null, recurrence WEEKLY → next Monday, recurrence MONTHLY → same day next month.
46. [ ] Write integration test: full end-to-end flow (GPT draft → admin approve → mark-ready → cron dispatch → Make claim → Make result → PUBLISHED + audit trail).

---

## Internal Review Notes

**Strengthened during review:**

1. The `operator_pin` validation was ambiguous ("hashed-compare"). Clarified to mean: env holds a pre-hashed value `HOSPEDA_OPERATOR_PIN_HASH = sha256(pin + secret_salt)`; the middleware hashes the incoming pin the same way and uses `timingSafeEqual` on the hex digests. The salt prevents rainbow-table attacks on a short PIN.
2. The "lenient hashtag validation" acceptance criterion now explicitly states what the warnings array looks like (field name, message format with specific unknown hashtag list). This makes it directly automatable as a test assertion.
3. The cascade logic for `social_posts.status` after all targets complete was under-specified in the prompt. Spec now states: PUBLISHED if ≥1 target is PUBLISHED; FAILED only if ALL are FAILED or SKIPPED. This edge case (some FAILED + some PUBLISHED) resolves to PUBLISHED with a flag in the admin UI.
4. Recurrence rearm on failure is explicitly blocked (spec states `next_run_at` is NOT recomputed on full failure; only on at least partial success). This was implicit in the prompt.
5. The "suppress recurrence on failure" + "rearm on partial success" distinction was added as a concrete rule rather than leaving it to implementer judgment.
6. The `createApiKeyRoute` factory was described as "mirroring" existing factories without enough detail. Spec now states it is added to `route-factory-tiered.ts` and accepts `apiKeyConfig` (headerName, envVarKey). The synthetic actor injection is required so that existing logging hooks (which expect `c.get('actor')`) do not crash.
7. The extras carril migration for `set_updated_at` triggers is split into a dedicated file `019-social-set-updated-at.trigger.sql` separate from the indexes file, following the pattern of existing extras files (each file = one concern).
8. The `social_platforms` table was listed with `platform(enum PK)` in the design input — this is non-standard for the codebase (all tables use UUID PK). Spec clarifies: `id UUID PK defaultRandom()` as always, plus `platform SocialPlatformPgEnum UNIQUE NOT NULL`. This aligns with the convention.
9. The post list `?includeDeleted=true` gate is explicitly tied to `SOCIAL_POST_HARD_DELETE` permission, not just any admin — ensuring archived post visibility is a privileged action.
10. The dashboard `makeWebhookConfigured` field is flagged as a live check (not cached) because the setting can be updated without a redeploy.

**Resolved decisions (owner, 2026-06-20):** The five open questions below were resolved with the owner. These are binding.

1. **Operator PIN delivery** → Out-of-band. The human operator TYPES the PIN into the GPT conversation at save time; it is NOT stored in the GPT system prompt (which lives in OpenAI's infra). The backend env holds ONLY the hash (`HOSPEDA_OPERATOR_PIN_HASH`); the raw PIN is never persisted.
2. **Image download timeout** → 15 seconds (not 20). On download/upload failure the draft is still created with `cloudinary_url = null` and a media-pending warning, so the request never blocks on slow media.
3. **Recurrence rearm of previously FAILED targets** → Clean slate. When a recurring post rearms for its next occurrence, ALL its targets are reset to `APPROVED` AND `retry_count = 0` — including targets that had exhausted retries in a prior cycle. Each occurrence is a fresh publish attempt.
4. **`social_platforms` is seed-only** → Platforms are created via seed and configured/enabled/disabled via `PATCH` only. There is NO `POST /admin/social/platforms` (create) endpoint. Adding a brand-new platform is a deliberate code change + Make scenario, not an admin action.
5. **AI request log retention** → Deferred. `social_ai_requests` stays append-only with full `raw_request_json` / `raw_response_json` payloads and no purge cron in this spec. Retention/truncation is revisited in a later spec if volume warrants it.
