# SPEC-085: Guest-Owner Messaging System (In-Platform)

> **Status**: in-progress
> **Priority**: P1
> **Complexity**: High
> **Origin**: Product requirement — eliminate reliance on direct contact exposure (phone/email on listing pages)
> **Depends on**: SPEC-086 (tag system refactor, additive follow-up only — tags are explicitly out of scope for this spec)
> **Created**: 2026-04-17
> **Revision**: 5 (2026-04-19)
> **Type**: new-feature
> **Breaking change**: No (net new tables, routes, and UI. No existing schema or API changes.)

---

## Problem Statement

Hospeda currently exposes owner contact details (email, phone) directly on accommodation listing pages. This creates two concrete problems:

1. **No privacy shield.** Owners receive spam and unsolicited contact from sources outside the platform, because their contact details are public.
2. **No conversation record.** There is no platform-level log of guest-owner communication, making dispute resolution, moderation, and analytics impossible.

The chosen solution is an in-platform messaging system that proxies all guest-owner communication: guests initiate contact via a form on the accommodation detail page, owners manage an inbox in the admin panel, and the platform sends email notifications without ever exposing raw contact details to the other party.

---

## Goals and Non-Goals

### Goals

- Provide a private 1:1 messaging channel between guests and owners, fully within the platform.
- Support both anonymous (non-registered) guests and authenticated users, with distinct verification flows.
- Give owners a unified global inbox across all their accommodations.
- Send timely email notifications to both parties without exposing raw contact details.
- Prevent abuse via rate limiting and a configurable content moderation layer.
- Store enough metrics to enable future analytics without building dashboards now.

### Non-Goals (Out of Scope)

- Group chats or multi-participant conversations.
- File or image attachments.
- Sender-side message deletion or editing.
- Multi-owner collaborative conversation assignment.
- Owner-initiated conversation creation.
- WebSocket or real-time push notifications (polling only in MVP).
- Metrics dashboards (data is stored but not visualized in this spec).
- Tagging of conversations — this is explicitly deferred to **SPEC-086**.
- GDPR data retention or purge jobs (soft-delete via admin only in MVP).
- Message search within an inbox (future spec).
- CSV export of conversations.
- Co-owner scenarios (single `ownerId` per accommodation; owner does not change).

---

## Overview and Success Metrics

### Overview

This spec introduces four new database tables (`conversations`, `messages`, `conversation_access_tokens`, `conversation_notification_schedules`), a new service layer under `packages/service-core/src/services/conversation/`, new API routes across all three tiers (public, protected, admin), a new React island on the accommodation detail page (`ContactHost`), a guest messages section in `apps/web`, an owner inbox in `apps/admin`, three cron jobs, five email templates, a new i18n namespace `conversations`, and an extension to the existing rate-limit middleware to support email-based limits.

### Success Metrics

- Anonymous guest can initiate a conversation without a platform account and receive a secure token link within 30 seconds of email verification.
- Authenticated guest can initiate or resume a conversation from any accommodation page without re-verification.
- Owner reads all received messages from a single inbox page; no per-accommodation navigation required.
- Email notification is dispatched within 35 minutes (5-min cron window + 30-min delay) of an unread message being created.
- Zero raw owner email addresses are exposed to guests or to anonymous guests at any point.
- Blocked-word and blocked-domain checks reject abusive content before it is persisted.

---

## Actors

- **Anonymous guest**: Non-authenticated visitor who initiates contact from an accommodation page using name, email (required), and phone (optional).
- **Authenticated guest**: Registered platform user who contacts an owner. May also be a user who registered after contacting as anonymous.
- **Owner**: Platform user with at least one accommodation. Manages conversations via the admin panel inbox.
- **Platform admin / super-admin**: Has elevated permissions to view all conversations, block conversations, or delete them.
- **System (cron, event hooks)**: Sends notifications, expires tokens, and links anonymous conversations to newly registered users.

---

## User Stories

### US-001: Anonymous guest initiates contact with an owner

As an anonymous guest viewing an accommodation detail page,
I want to send a message to the owner without creating an account,
so that I can ask questions or express booking interest without friction.

**Priority**: Must-have

#### AC-001-01: Initiation form is visible on the accommodation detail page

Given an accommodation detail page with `lifecycleState = ACTIVE`,
When an unauthenticated user views the page,
Then a "Contact the host" section is visible with fields: name (required), email (required), phone (optional), message (required).

#### AC-001-02: Submission creates a PENDING_VERIFICATION conversation

Given a valid form submission (name, email, message all provided, message <= 5000 chars),
When the anonymous guest submits the form,
Then a conversation is created with `status = PENDING_VERIFICATION`,
And a verification email is sent to the provided email address,
And the owner is NOT notified yet.

#### AC-001-03: Duplicate anonymous initiation for the same email + accommodation is rejected

Given an anonymous guest whose verified email is already linked to a conversation with this accommodation,
When they try to initiate a new conversation via the same accommodation's form,
Then the API returns a conflict response,
And no new conversation is created.

#### AC-001-04: Unverified duplicate initiation resets the verification email

Given an anonymous guest who submitted the form but has not yet clicked the verification link,
When they submit the same form again (same email, same accommodation),
Then a new verification email is sent (re-send),
And the existing PENDING_VERIFICATION conversation is retained (not duplicated).

#### AC-001-05: Email verification activates the conversation

Given a PENDING_VERIFICATION conversation and a valid verification link,
When the anonymous guest clicks the link,
Then the conversation transitions to `PENDING_OWNER`,
And a secure guest access token is generated and stored in `conversation_access_tokens`,
And the guest is redirected to `/guest/messages/[token]` where they can see the thread,
And the owner is notified via email about the new message.

#### AC-001-06: Expired verification link is rejected gracefully

Given a verification link whose JWT has expired (24-hour TTL) or has already been consumed,
When the guest clicks the link,
Then the API returns a clear error message,
And the guest is shown a page explaining what happened and how to request a new link.

---

### US-002: Authenticated guest initiates or resumes contact with an owner

As an authenticated guest,
I want to contact an owner from the accommodation detail page and have all my conversations accessible in one place,
so that I can track my inquiries without managing tokens or links.

**Priority**: Must-have

#### AC-002-01: First contact creates a conversation

Given an authenticated user viewing an accommodation detail page with no existing conversation for this (user, accommodation) pair,
When they submit a message via the "Contact the host" form,
Then a conversation is created with `status = PENDING_OWNER`,
And the user is redirected to `/mi-cuenta/messages/[conversationId]`,
And the owner is notified by email.

#### AC-002-02: Returning contact reuses the existing conversation

Given an authenticated user who already has a conversation with an owner for a given accommodation,
When they view the accommodation detail page,
Then the "Contact the host" section shows a "View your existing conversation" prompt,
And submitting a new message from that page appends to the existing conversation.

#### AC-002-03: Authenticated guest can list all their conversations

Given an authenticated user with at least one conversation,
When they navigate to `/mi-cuenta/messages`,
Then they see a paginated list of all their conversations, sorted by last activity descending,
And each row shows accommodation name, last message excerpt, unread count, and timestamp.

#### AC-002-04: Authenticated guest can read and reply in a conversation

Given an authenticated user navigating to `/mi-cuenta/messages/[conversationId]`,
When the page loads,
Then the most recent 50 messages are loaded first (last page). Messages display in ascending chronological order (oldest at top, newest at bottom). Scrolling up loads older pages via cursor-based pagination using `created_at < :oldestLoadedTimestamp`,
And a reply form is shown if the conversation is not CLOSED or BLOCKED.

#### AC-002-05: Authenticated guest can archive a conversation

Given an authenticated user viewing their inbox,
When they archive a conversation,
Then `archivedByGuest = true` is set on the conversation,
And the conversation no longer appears in their default inbox view,
And the archive action is reversible.

---

### US-003: Owner manages conversations in the admin panel inbox

As an owner,
I want a single inbox in the admin panel that aggregates messages from all my accommodations,
so that I do not need to navigate per-accommodation to stay on top of inquiries.

**Priority**: Must-have

#### AC-003-01: Owner inbox lists all conversations across all accommodations

Given an owner with at least one accommodation,
When they navigate to the admin conversations inbox,
Then they see all conversations linked to their accommodations,
And each row shows guest identity, accommodation name, status, unread count, and last activity timestamp.

#### AC-003-02: Owner inbox shows unread count badge

Given an owner with unread messages across their conversations,
When they view the admin panel (any page),
Then a badge on the inbox navigation item shows the total unread count,
And the count refreshes via polling every 30 seconds (implemented via TanStack Query's `refetchInterval: 30_000` on the unread-count query hook).

#### AC-003-03: Owner can read a conversation thread

Given an owner opening a conversation,
When the page loads,
Then the most recent 50 messages are loaded first (last page), displayed in ascending chronological order (oldest at top, newest at bottom). Scrolling up loads older pages via cursor-based pagination using `created_at < :oldestLoadedTimestamp`,
And messages sent by the guest are visually distinguished from owner replies,
And the read timestamp `lastReadAtByOwner` is updated.

#### AC-003-04: Owner can reply to a conversation

Given an owner viewing an OPEN or PENDING_OWNER conversation,
When they submit a reply,
Then the message is appended to the thread,
And the conversation status transitions to `PENDING_GUEST`,
And the guest is scheduled for notification.

#### AC-003-05: Owner can close a conversation

Given an owner viewing any non-BLOCKED conversation,
When they click "Close conversation",
Then the conversation status transitions to `CLOSED`,
And a SYSTEM message ("Conversation closed by owner") is appended automatically,
And no email notification is sent for the SYSTEM message.

#### AC-003-06: Closed conversation auto-reopens on new valid guest message

Given a CLOSED conversation,
When the guest sends a new message,
Then the conversation status transitions to `PENDING_OWNER`,
And the owner is scheduled for notification.

#### AC-003-07: Owner can block a conversation

Given an owner viewing any non-BLOCKED conversation,
When they click "Block conversation" and optionally provide a block reason,
Then `status = BLOCKED` and the optional `blockReason` are stored,
And the guest's next POST attempt receives a friendly error (not an abusive message).

#### AC-003-08: Blocked conversation never auto-reopens

Given a BLOCKED conversation,
When the guest sends a new message,
Then the API rejects the request with an informative error,
And the conversation status remains BLOCKED.

#### AC-003-09: Owner can archive a conversation from their view

Given an owner viewing their inbox,
When they archive a conversation,
Then `archivedByOwner = true` is set,
And the conversation is hidden from their default inbox view,
And the archive action is reversible and does not affect the guest's view.

---

### US-004: Anonymous guest accesses their conversation thread via a token link

As an anonymous guest with a valid access token,
I want to view and reply to my conversation at `/guest/messages/[token]`,
so that I can participate without creating an account.

**Priority**: Must-have

#### AC-004-01: Valid token grants access to the conversation

Given a valid, non-expired guest access token,
When the anonymous guest navigates to `/guest/messages/[token]`,
Then the full conversation thread is displayed,
And a reply form is shown if the conversation is not CLOSED or BLOCKED.

#### AC-004-02: Expired token shows a clear expiry notice

Given an expired guest access token (past 30-day TTL),
When the anonymous guest navigates to `/guest/messages/[token]`,
Then they see a notice explaining the link has expired,
And they are presented with a "Request a new link" action.

#### AC-004-03: Anonymous guest can request a new access token

Given an anonymous guest whose token has expired,
When they submit their email on the `/public/conversations/request-access` endpoint,
Then if the email matches a verified conversation, a new magic link email is sent,
And the response is identical whether or not the email matches (no enumeration of emails).

#### AC-004-04: Re-verification is required for cross-device access

Given an anonymous guest with a verified email linked to a conversation,
When they try to view the conversation from a new device (no token cookie),
Then they must submit their email to receive a fresh magic link before accessing the thread,
And anyone who knows the email does not gain automatic access.

---

### US-005: Anonymous guest account is linked when they register

As a platform user who previously contacted an owner as an anonymous guest,
I want my past conversations to be linked to my new account automatically upon registration,
so that I do not lose conversation history.

**Priority**: Should-have

#### AC-005-01: Conversations are linked when registration email matches

Given an anonymous guest with verified email X who has one or more conversations,
When a new user registers with email X,
Then all conversations where `anonymousEmail = X` and `anonymousEmailVerified = true` are linked by setting `userId` to the new user's ID,
And `anonymousEmail` is cleared or retained as a historical reference (implementation detail).

#### AC-005-02: Conversations with mismatched email are NOT linked

Given an anonymous guest with verified email X,
When a new user registers with email Y (different),
Then no conversation migration occurs,
And the anonymous conversations remain accessible only via their original token links.

#### AC-005-03: Already-linked conversations are not double-linked

Given a conversation already linked to a user ID,
When the user.create hook runs again (e.g., re-registration attempt),
Then the conversation's `userId` is not overwritten.

---

### US-006: Owner receives email notifications about unread messages

As an owner,
I want to receive email notifications when a guest sends me a message,
so that I can respond promptly without checking the inbox manually.

**Priority**: Must-have

#### AC-006-01: First unread message triggers a notification schedule

Given a conversation where the owner has no unread messages,
When a guest sends a new message,
Then a notification schedule entry is created (or updated) with `pendingNotificationAt = now() + 30 minutes` for the owner side,
And the notification streak counter is set to 1 for this unread streak.

#### AC-006-02: Notification is not sent if owner reads before the scheduled time

Given a scheduled notification for the owner,
When the owner reads the conversation before `pendingNotificationAt`,
Then the pending notification entry is cancelled (deleted or marked cancelled),
And no email is sent.

#### AC-006-03: A reply from the owner cancels the notification for the owner and may trigger one for the guest

Given a notification scheduled for the owner,
When the owner replies,
Then the owner's pending notification is cancelled,
And if the guest has unread messages, a new notification schedule is created for the guest side.

#### AC-006-04: Multiple unread messages are grouped into a single notification

Given three unread messages from a guest to an owner,
When the scheduled notification fires,
Then the owner receives a single email summarizing all unread messages,
And the email includes: accommodation reference, guest identity, message excerpts (not full dump), and a CTA link.

#### AC-006-05: At most 3 notifications per unread streak

Given an owner who has not read a conversation and has already received 2 notifications for this streak,
When the third scheduled notification fires,
Then the third email is sent,
And no further notifications are sent for this streak until new activity arrives.

#### AC-006-06: New activity resets the notification streak

Given an owner who has exhausted 3 notifications for a streak,
When the guest sends another new message,
Then the streak counter resets to 1 and a new 30-minute pending notification is scheduled.

---

### US-007: Anonymous guest receives token-expiry reminder emails

As an anonymous guest with an expiring access token,
I want to receive reminder emails before my link expires,
so that I have time to create an account or request a renewal before losing access.

**Priority**: Should-have

#### AC-007-01: Reminder sent on day 15

Given an anonymous guest access token created 15 days ago that has not expired,
When the token reminder cron job runs,
Then a reminder email is sent suggesting account creation and offering a link to renew access.

#### AC-007-02: Reminder sent on day 25

Given an anonymous guest access token created 25 days ago that has not expired,
When the token reminder cron job runs,
Then a second reminder email is sent with stronger urgency messaging.

#### AC-007-03: No reminder sent after token is consumed or revoked

Given an access token that has been revoked or marked consumed,
When the cron job runs,
Then no reminder email is sent for that token.

---

### US-008: Platform admin oversees all conversations

As a platform super-admin,
I want to view, block, and delete any conversation on the platform,
so that I can moderate content and resolve disputes.

**Priority**: Must-have

#### AC-008-01: Super-admin can list all platform conversations

Given a super-admin,
When they access the admin conversation list with `CONVERSATION_VIEW_ALL` permission,
Then they see all conversations regardless of owner,
And they can filter by status, accommodation, owner, or guest identity.

#### AC-008-02: Admin can delete a conversation

Given an admin with `CONVERSATION_DELETE_ANY` permission,
When they delete a conversation,
Then the conversation and all its messages are soft-deleted,
And associated tokens and notification schedules are revoked/cancelled.

#### AC-008-03: Soft-deleted accommodation freezes linked conversations

Given an accommodation that is soft-deleted,
When the system detects the deletion (hook or service call),
Then all conversations linked to that accommodation are set to `CLOSED`,
And no new messages are accepted from either party,
And historical threads remain readable by both owner and admin.

---

## UX / Navigation Model and Flows

### Navigation

| Actor | Entry Point | Path |
|-------|-------------|------|
| Anonymous guest (token) | Token link in email | `/[lang]/guest/messages/[token]` |
| Authenticated guest (list) | "My Messages" in user nav | `/[lang]/mi-cuenta/messages` |
| Authenticated guest (thread) | From list or CTA | `/[lang]/mi-cuenta/messages/[conversationId]` |
| Owner (inbox) | Admin panel sidebar | `/admin/conversations` |
| Owner (thread) | From inbox | `/admin/conversations/[conversationId]` |
| Super-admin | Same as owner + "all conversations" toggle | `/admin/conversations?view=all` |

### Flow 1: Anonymous Guest — Initiation and Verification

1. Guest lands on accommodation detail page (`apps/web`).
2. Guest sees the "Contact the host" React island (`ContactHost`).
3. Guest fills in name, email (required), phone (optional), message.
4. Guest submits the form.
5. API (`POST /api/v1/public/conversations/initiate`) validates input, checks rate limits (IP + email), checks for duplicate (same email + accommodation).
   - If duplicate unverified: resend verification email, return 200 with "Check your email" message.
   - If duplicate verified: return 409 Conflict, prompt guest to use their existing token link.
6. New conversation created with `status = PENDING_VERIFICATION`. No owner notification.
7. Verification email sent (React Email template `conversation-verify.tsx`) with a link containing a signed JWT token. The JWT payload is `{ conversationId, email, exp }`, signed with `HOSPEDA_BETTER_AUTH_SECRET`, with a 24-hour TTL. No DB storage is needed for this token.
8. Guest clicks the verification link (GET `/api/v1/public/conversations/verify/[verificationToken]`).
9. API validates the JWT, transitions conversation to `PENDING_OWNER`, generates a 30-day guest access token, stores it in `conversation_access_tokens`.
10. Guest is redirected to `/guest/messages/[accessToken]`.
11. Owner notification is scheduled (30 minutes).
12. Guest sees the conversation thread with their initial message and a reply form.

### Flow 2: Authenticated Guest — Initiation and Reply

1. Authenticated user lands on accommodation detail page.
2. API checks for an existing conversation for (userId, accommodationId).
   - If exists: `ContactHost` island shows "View your conversation" link instead of the form.
   - If none: the standard form is shown.
3. User submits message.
4. API (`POST /api/v1/protected/conversations/initiate`) creates conversation (`PENDING_OWNER`) or appends message to existing conversation.
5. User is redirected to `/mi-cuenta/messages/[conversationId]`.
6. Owner notification is scheduled.
7. User can navigate to `/mi-cuenta/messages` at any time to see all their conversations.

### Flow 3: Owner — Reading and Replying

1. Owner logs into admin panel, sees unread badge on "Conversations" nav item.
2. Owner navigates to `/admin/conversations`.
3. Inbox lists conversations sorted by last activity (most recent first), with unread count per row.
4. Owner opens a conversation.
5. Thread loads with cursor-based infinite scroll (50 messages/page, most recent page first, ascending chronological display, scroll up for older).
6. `lastReadAtByOwner` is updated on open.
7. Owner types a reply, submits.
8. New message appended. Conversation status → `PENDING_GUEST`. Guest notification scheduled.
9. Owner can close or block the conversation via action buttons.

### Flow 4: Anonymous Guest — Token Renewal

1. Guest receives a day-15 or day-25 reminder email.
2. Guest clicks "Request a new link" or navigates to the token renewal page.
3. Guest submits their email.
4. API (`POST /api/v1/public/conversations/request-access`) checks if email has a verified conversation.
5. If yes: sends a new magic link email. Previous token is not immediately revoked (still valid until its own expiry or explicit revocation).
6. Guest clicks the new link; a new access token is generated.
7. Guest is redirected to `/guest/messages/[newToken]`.

### Flow 5: Anonymous → Registered User Linking

1. A user registers on the platform.
2. The `user.create` hook (custom, registered in the Better Auth configuration) fires.
3. Hook queries `conversations` where `anonymousEmail = newUser.email` AND `anonymousEmailVerified = true` AND `userId IS NULL`.
4. For each matched conversation: `userId` is set to the new user ID.
5. The user can now see those conversations at `/mi-cuenta/messages` in addition to the token-based URL.

### UX Edge Cases

- **Empty inbox (owner)**: Show copy "No conversations yet. When guests contact you, their messages will appear here." with an illustration.
- **Empty inbox (guest)**: Show copy "You have no active conversations. Contact a host from any accommodation page to get started." with an illustration.
- **BLOCKED — guest sends message**: API returns 403 with friendly copy "This conversation has been closed by the host. Contact us if you believe this is an error."
- **CLOSED — owner inbox**: Row shows "Closed" badge. Reply form is hidden. Owner can reopen via an explicit "Reopen" action button (which sets status to `OPEN`, no system message appended). Reply form becomes visible only after reopening.
- **Read receipts**: Both sides see "Read by [party] at [time]" below the last message they sent, derived from `lastReadAtByOwner` / `lastReadAtByGuest`.
- **Long message (> 5000 chars)**: Form shows a character counter; submit is disabled and a validation error is shown inline when limit is exceeded.
- **Blocked word/domain in message**: API returns 422 with copy "Your message contains content that is not allowed. Please revise and resubmit."
- **Rate limit hit**: API returns 429 with a Retry-After header. UI shows "Too many requests. Please wait before trying again."
- **Accommodation soft-deleted while viewing**: If the user is in the thread when the accommodation is deleted, the next action (reply, refresh) returns a 410 Gone response. The thread is still readable.

### Accessibility

- All form fields have associated `<label>` elements and ARIA descriptions.
- Character counter for message field announces remaining characters to screen readers.
- Unread badge on nav item uses `aria-label="X unread messages"`.
- Conversation status changes produce an `aria-live` announcement.
- Keyboard navigation: full keyboard support for send, close, block, archive actions.

---

## Domain Model

### Enums

#### `ConversationStatusEnum`

```
OPEN                  -- Active, both sides can send
PENDING_OWNER         -- Guest sent last; owner has not replied yet
PENDING_GUEST         -- Owner replied last; guest has not replied yet
CLOSED                -- Owner or system closed it; auto-reopens on guest message
BLOCKED               -- Owner blocked; never auto-reopens; guest cannot POST
PENDING_VERIFICATION  -- Anonymous initiation before email verified; owner NOT notified
```

State machine transitions are defined in the "Conversation State Machine" section below.

#### `MessageStatusEnum`

```
VISIBLE   -- Standard user-generated message
SYSTEM    -- Auto-generated system event (e.g., "Conversation closed"). No email notification.
```

#### `MessageSenderTypeEnum`

```
GUEST    -- Message sent by the guest (anonymous or authenticated)
OWNER    -- Message sent by the accommodation owner
SYSTEM   -- Auto-generated system event message
```

#### `NotificationRecipientSideEnum`

```
GUEST    -- Notification directed to the guest
OWNER    -- Notification directed to the owner
```

### Table: `conversations`

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| `id` | `uuid` | NOT NULL | Primary key, default `gen_random_uuid()` |
| `accommodation_id` | `uuid FK -> accommodations.id` | NOT NULL | onDelete: RESTRICT |
| `user_id` | `uuid FK -> users.id` | NULL | NULL for anonymous guests until registration. onDelete: SET NULL |
| `anonymous_name` | `varchar(255)` | NULL | Only for anonymous conversations |
| `anonymous_email` | `varchar(255)` | NULL | Normalized to lowercase |
| `anonymous_email_verified` | `boolean` | NOT NULL DEFAULT false | True after email verification link is clicked |
| `anonymous_phone` | `varchar(50)` | NULL | Optional phone from initiation form |
| `status` | `ConversationStatusPgEnum` | NOT NULL DEFAULT 'PENDING_VERIFICATION' | |
| `block_reason` | `text` | NULL | Captured when owner blocks |
| `locale` | `varchar(10)` | NOT NULL DEFAULT 'es' | Locale at conversation creation; used for email templates |
| `archived_by_guest` | `boolean` | NOT NULL DEFAULT false | |
| `archived_by_owner` | `boolean` | NOT NULL DEFAULT false | |
| `last_read_at_by_guest` | `timestamp with time zone` | NULL | |
| `last_read_at_by_owner` | `timestamp with time zone` | NULL | |
| `first_guest_message_at` | `timestamp with time zone` | NULL | Metrics |
| `first_owner_reply_at` | `timestamp with time zone` | NULL | Metrics |
| `last_activity_at` | `timestamp with time zone` | NULL | Metrics — updated on every message |
| `last_guest_message_at` | `timestamp with time zone` | NULL | Metrics |
| `last_owner_message_at` | `timestamp with time zone` | NULL | Metrics |
| `closed_at` | `timestamp with time zone` | NULL | Metrics |
| `blocked_at` | `timestamp with time zone` | NULL | Metrics |
| `guest_message_count` | `integer` | NOT NULL DEFAULT 0 | Metrics counter |
| `owner_message_count` | `integer` | NOT NULL DEFAULT 0 | Metrics counter |
| `created_at` | `timestamp with time zone` | NOT NULL DEFAULT now() | Audit |
| `updated_at` | `timestamp with time zone` | NOT NULL DEFAULT now() | Audit |
| `deleted_at` | `timestamp with time zone` | NULL | Soft delete |
| `created_by_id` | `uuid FK -> users.id` | NULL | Audit — nullable (anon initiation). onDelete: SET NULL |
| `updated_by_id` | `uuid FK -> users.id` | NULL | Audit. onDelete: SET NULL |
| `deleted_by_id` | `uuid FK -> users.id` | NULL | Audit. onDelete: SET NULL |

**Indexes:**

| Name | Columns | Partial Condition | Purpose |
|------|---------|-------------------|---------|
| `conversations_userId_accommodationId_unique` | `(user_id, accommodation_id)` | `WHERE user_id IS NOT NULL AND deleted_at IS NULL` | Enforce 1 conversation per auth user + accommodation |
| `conversations_anonymousEmail_accommodationId_unique` | `(anonymous_email, accommodation_id)` | `WHERE anonymous_email IS NOT NULL AND anonymous_email_verified = true AND deleted_at IS NULL` | Enforce 1 verified anon conversation per email + accommodation |
| `conversations_accommodationId_idx` | `(accommodation_id)` | | Owner inbox query |
| `conversations_userId_idx` | `(user_id)` | `WHERE user_id IS NOT NULL` | Guest `/mi-cuenta/messages` list |
| `conversations_status_idx` | `(status)` | | Admin filtering |
| `conversations_lastActivityAt_idx` | `(last_activity_at DESC)` | | Default sort |
| `conversations_anonymousEmail_idx` | `(anonymous_email)` | `WHERE anonymous_email IS NOT NULL AND anonymous_email_verified = true` | user.create linking hook |

### Table: `messages`

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| `id` | `uuid` | NOT NULL | Primary key |
| `conversation_id` | `uuid FK -> conversations.id` | NOT NULL | onDelete: CASCADE |
| `sender_type` | `MessageSenderTypePgEnum` | NOT NULL | Values: `GUEST`, `OWNER`, `SYSTEM`. Defined as PG enum via `pgEnum('message_sender_type_enum', ...)` |
| `user_id` | `uuid FK -> users.id` | NULL | NULL for anonymous guest messages and system messages. onDelete: SET NULL |
| `body` | `text` | NOT NULL | Max 5000 chars, enforced by Zod and DB CHECK |
| `status` | `MessageStatusPgEnum` | NOT NULL DEFAULT 'VISIBLE' | |
| `created_at` | `timestamp with time zone` | NOT NULL DEFAULT now() | Audit |
| `updated_at` | `timestamp with time zone` | NOT NULL DEFAULT now() | Audit |
| `deleted_at` | `timestamp with time zone` | NULL | Soft delete (admin-only) |
| `created_by_id` | `uuid FK -> users.id` | NULL | Audit. onDelete: SET NULL |
| `updated_by_id` | `uuid FK -> users.id` | NULL | Audit. onDelete: SET NULL |
| `deleted_by_id` | `uuid FK -> users.id` | NULL | Audit. onDelete: SET NULL |

**Indexes:**

| Name | Columns | Purpose |
|------|---------|---------|
| `messages_conversationId_idx` | `(conversation_id, created_at ASC)` | Thread load (chronological) |
| `messages_conversationId_status_idx` | `(conversation_id, status)` | Filter SYSTEM messages |

**DB CHECK constraint:**

```sql
CONSTRAINT messages_body_length CHECK (char_length(body) <= 5000)
```

### Table: `conversation_access_tokens`

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| `id` | `uuid` | NOT NULL | Primary key |
| `conversation_id` | `uuid FK -> conversations.id` | NOT NULL | onDelete: CASCADE |
| `token_hash` | `varchar(64)` | NOT NULL | SHA-256 hex hash of the raw token. Unique. Raw token never stored. |
| `expires_at` | `timestamp with time zone` | NOT NULL | Created_at + 30 days |
| `revoked_at` | `timestamp with time zone` | NULL | Set on explicit admin revocation or conversation deletion |
| `day15_reminder_sent_at` | `timestamp with time zone` | NULL | Set when day-15 reminder email is sent. Prevents re-sending. |
| `day25_reminder_sent_at` | `timestamp with time zone` | NULL | Set when day-25 reminder email is sent. Prevents re-sending. |
| `created_at` | `timestamp with time zone` | NOT NULL DEFAULT now() | |

**Indexes:**

| Name | Columns | Purpose |
|------|---------|---------|
| `conversation_access_tokens_tokenHash_unique` | `(token_hash)` | Token hash lookup (unique) |
| `conversation_access_tokens_conversationId_idx` | `(conversation_id)` | Revoke on deletion |
| `conversation_access_tokens_expiresAt_idx` | `(expires_at)` | Token expiry cron query |

### Table: `conversation_notification_schedules`

Tracks the pending notification for each (conversation, recipient side) pair during an unread streak.

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| `id` | `uuid` | NOT NULL | Primary key |
| `conversation_id` | `uuid FK -> conversations.id` | NOT NULL | onDelete: CASCADE |
| `recipient_side` | `NotificationRecipientSidePgEnum` | NOT NULL | Values: `GUEST`, `OWNER`. Defined as PG enum via `pgEnum('notification_recipient_side_enum', ...)` |
| `pending_notification_at` | `timestamp with time zone` | NOT NULL | Next scheduled send time. Indexed. |
| `streak_count` | `integer` | NOT NULL DEFAULT 1 | How many notifications sent in this unread streak (max 3) |
| `streak_started_at` | `timestamp with time zone` | NOT NULL | Timestamp of the first unread message in the current streak |
| `cancelled_at` | `timestamp with time zone` | NULL | Cancelled when recipient reads or replies |
| `created_at` | `timestamp with time zone` | NOT NULL DEFAULT now() | |
| `updated_at` | `timestamp with time zone` | NOT NULL DEFAULT now() | |

**Indexes:**

| Name | Columns | Partial Condition | Purpose |
|------|---------|-------------------|---------|
| `conv_notif_schedules_pending_idx` | `(pending_notification_at ASC)` | `WHERE cancelled_at IS NULL` | Cron query: find all due notifications |
| `conv_notif_schedules_conversation_recipient_unique` | `(conversation_id, recipient_side)` | `WHERE cancelled_at IS NULL` | One active schedule per (conversation, side) |

### Relationships

```
accommodations 1──n conversations 1──n messages
conversations 1──n conversation_access_tokens
conversations 1──n conversation_notification_schedules
users 1──n conversations (nullable, via user_id)
users 1──n messages (nullable, via user_id)
```

---

## Conversation State Machine

### States

| State | Description |
|-------|-------------|
| `PENDING_VERIFICATION` | Anonymous initiation before email verified. Owner not notified. |
| `OPEN` | Active. No constraint on who sends next. |
| `PENDING_OWNER` | Guest sent last; owner has not replied. |
| `PENDING_GUEST` | Owner sent last; guest has not replied. |
| `CLOSED` | Owner or system closed it. Auto-reopens on valid guest message. |
| `BLOCKED` | Owner blocked. Never auto-reopens. Guest POST is rejected. |

### Transition Rules

| Trigger | From | To | System message? | Owner notified? | Guest notified? |
|---------|------|----|-----------------|-----------------|-----------------|
| Guest email verification | `PENDING_VERIFICATION` | `PENDING_OWNER` | No | Yes (scheduled) | No |
| Guest sends message (first) | `OPEN` | `PENDING_OWNER` | No | Yes (scheduled) | No |
| Guest sends message | `PENDING_GUEST` | `PENDING_OWNER` | No | Yes (scheduled) | No |
| Guest sends message | `CLOSED` | `PENDING_OWNER` | No | Yes (scheduled) | No |
| Guest sends message | `BLOCKED` | — (rejected) | No | No | No |
| Owner sends message | `OPEN` | `PENDING_GUEST` | No | No | Yes (scheduled) |
| Owner sends message | `PENDING_OWNER` | `PENDING_GUEST` | No | No | Yes (scheduled) |
| Owner sends message | `PENDING_GUEST` | `PENDING_GUEST` | No | No | Yes (if new unread) |
| Owner closes | any non-BLOCKED | `CLOSED` | Yes ("Conversation closed") | No | No |
| Owner reopens | `CLOSED` | `OPEN` | No | No | No |
| Owner blocks | any non-BLOCKED | `BLOCKED` | No | No | No |
| Accommodation soft-deleted | any (including `PENDING_VERIFICATION`) | `CLOSED` | No | No | No |

**Side effects on block:** When a conversation transitions to `BLOCKED`, all active notification schedules for that conversation (both sides) are cancelled (`cancelled_at = now()`).

**Side effects on accommodation soft-delete:** `PENDING_VERIFICATION` conversations are also closed. Since the owner was never notified, no notification is needed. The guest's unverified verification link will fail with `ACCOMMODATION_DELETED` error.

**CLOSED state is NOT uniform.** Two distinct sub-cases exist and they behave differently:

| CLOSED cause | Guest sends new message | Owner reply allowed |
|--------------|-------------------------|---------------------|
| CLOSED by owner action | Auto-reopens to `PENDING_OWNER` (see state machine above) | Yes (after owner reopens) |
| CLOSED due to accommodation soft-delete | REJECTED with HTTP 410 Gone, `reason: "ACCOMMODATION_DELETED"`. Does NOT auto-reopen. | No |

The discriminator is `accommodations.deleted_at IS NOT NULL`. `MessageService` MUST check this before inserting any message and reject with 410 if the accommodation is soft-deleted, regardless of conversation status. This check overrides the standard `CLOSED → PENDING_OWNER` state transition.

Note: `BLOCKED → OPEN` or `BLOCKED → CLOSED` transitions are only possible by an admin with `CONVERSATION_UPDATE_STATUS_ANY` permission.

---

## API Surface

All routes are under `/api/v1`. The three-tier architecture applies exactly:

| Tier | Prefix | Auth | Route Factory |
|------|--------|------|---------------|
| Public | `/api/v1/public/conversations` | None (anonymous guests) | `createPublicRoute` from `route-factory-tiered.ts` |
| Protected | `/api/v1/protected/conversations` | User session (authenticated guests) | `createProtectedRoute` from `route-factory-tiered.ts` |
| Admin | `/api/v1/admin/conversations` | Admin session + permission | `createAdminRoute` / `createAdminListRoute` from `route-factory-tiered.ts` |

### Public Routes (anonymous guest + verification)

| Method | Path | Description | Rate limit |
|--------|------|-------------|------------|
| `POST` | `/public/conversations/initiate` | Create conversation or resend verification | IP tight + email tight |
| `GET` | `/public/conversations/verify/:verificationToken` | Verify email, activate conversation | IP tight |
| `POST` | `/public/conversations/request-access` | Request a new magic link by email | IP tight + email tight |
| `GET` | `/public/conversations/guest/:token` | Load conversation thread (anon view) | IP loose |
| `POST` | `/public/conversations/guest/:token/messages` | Send message as anonymous guest | IP tight |

### Protected Routes (authenticated guest)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/protected/conversations/initiate` | Create or reuse conversation |
| `GET` | `/protected/conversations` | List own conversations |
| `GET` | `/protected/conversations/:id` | Get conversation thread |
| `POST` | `/protected/conversations/:id/messages` | Send message |
| `PATCH` | `/protected/conversations/:id/archive` | Toggle `archivedByGuest` |
| `GET` | `/protected/conversations/unread-count` | Total unread count for badge |

### Admin Routes (owner + super-admin)

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| `GET` | `/admin/conversations` | `CONVERSATION_VIEW_OWN` or `CONVERSATION_VIEW_ALL` | List conversations (scoped to own accommodations or all) |
| `GET` | `/admin/conversations/:id` | `CONVERSATION_VIEW_OWN` or `CONVERSATION_VIEW_ANY` | Get conversation thread |
| `POST` | `/admin/conversations/:id/messages` | `CONVERSATION_REPLY_OWN` or `CONVERSATION_REPLY_ANY` | Owner reply |
| `PATCH` | `/admin/conversations/:id/status` | Conditional (see note below) | Change status (close, block, reopen) |
| `PATCH` | `/admin/conversations/:id/archive` | `CONVERSATION_UPDATE_STATUS_OWN` | Toggle `archivedByOwner` (reuses UPDATE_STATUS for pragmatic reasons.. archive is a low-risk action) |
| `DELETE` | `/admin/conversations/:id` | `CONVERSATION_DELETE_ANY` | Soft-delete conversation + messages + tokens |
| `GET` | `/admin/conversations/unread-count` | `CONVERSATION_VIEW_OWN` | Total unread across own accommodations |

**PATCH `/admin/conversations/:id/status` permission logic:** This single endpoint checks permissions conditionally based on the target status in the request body:
- Target status `CLOSED` or `OPEN` (close/reopen): requires `CONVERSATION_UPDATE_STATUS_OWN` or `CONVERSATION_UPDATE_STATUS_ANY`
- Target status `BLOCKED` (block): requires `CONVERSATION_BLOCK_OWN` or `CONVERSATION_BLOCK_ANY`
- Unblocking (from `BLOCKED` to `OPEN`/`CLOSED`): requires `CONVERSATION_UPDATE_STATUS_ANY` only (admin-level action)

### Request / Response Shapes (high level)

**POST `/public/conversations/initiate`**

Request body:
```
{
  accommodationId: uuid,
  guestName: string (required, max 100),
  guestEmail: string (email format),
  guestPhone: string (optional, max 50),
  message: string (required, 1..5000 chars),
  locale: string (optional, defaults to 'es')
}
```
Response: `{ status: 'pending_verification' | 'resent' | 'conflict', conversationId?: uuid }`

**POST `/protected/conversations/initiate`**

Request body:
```
{
  accommodationId: uuid,
  message: string (required, 1..5000 chars),
  locale: string (optional, defaults to actor's locale preference or URL lang prefix, finally 'es')
}
```
Response: `{ conversationId: uuid, isNew: boolean, messageId: uuid }` — `messageId` is always present, pointing to the newly created message on both create (`isNew = true`) and append (`isNew = false`).

**Locale resolution order for protected initiate:** (1) `body.locale` if provided, (2) `actor.settings.locale` from user record, (3) `lang` path prefix from the request URL, (4) default `'es'`. The resolved locale is persisted on the new conversation (first contact only) and used for all email templates dispatched to the guest.

**GET `/protected/conversations/:id`** (authenticated guest thread) and **GET `/admin/conversations/:id`** (owner thread)

Query parameters (cursor-based pagination for messages):
```
cursor:  string (optional, ISO-8601 timestamp) — if omitted, returns the most recent page
limit:   integer (optional, 1..100, default 50)
```

Semantics:
- No `cursor` → return the most recent `limit` messages, ordered by `created_at ASC`, plus a `nextCursor` (the `created_at` of the oldest message in the page) if more older messages exist.
- `cursor` provided → return up to `limit` messages with `created_at < cursor`, ordered by `created_at ASC`, plus `nextCursor` if more older messages exist.
- Response shape: `{ conversation: {...}, messages: [...], nextCursor: string | null }`.
- On each GET, the `last_read_at_by_guest` (protected) or `last_read_at_by_owner` (admin) timestamp is updated to `now()` server-side. See "Read Receipt Update" in Implementation Notes.

**PATCH `/protected/conversations/:id/archive`**

Request body: `{ archived: boolean }`
Response: updated conversation object with `archivedByGuest` reflecting the new value.

**PATCH `/admin/conversations/:id/archive`**

Request body: `{ archived: boolean }`
Response: updated conversation object with `archivedByOwner` reflecting the new value.

**POST `/admin/conversations/:id/messages`**

Request body: `{ body: string (required, 1..5000 chars) }`
Response: full message object

**PATCH `/admin/conversations/:id/status`**

Request body: `{ status: ConversationStatusEnum, blockReason?: string }`
Response: updated conversation object

Full Zod schema definitions land in the schema design phase, not in this spec.

---

## Permissions

The following new values must be added to `PermissionEnum` in `packages/schemas/src/enums/permission.enum.ts`:

```
CONVERSATION_VIEW_OWN            = 'conversation.view.own'           -- View conversations for own accommodations
CONVERSATION_VIEW_ANY            = 'conversation.view.any'           -- View any conversation (super-admin)
CONVERSATION_VIEW_ALL            = 'conversation.viewAll'            -- List all platform conversations (super-admin)
CONVERSATION_REPLY_OWN           = 'conversation.reply.own'          -- Reply in conversations for own accommodations
CONVERSATION_REPLY_ANY           = 'conversation.reply.any'          -- Reply in any conversation (super-admin)
CONVERSATION_UPDATE_STATUS_OWN   = 'conversation.updateStatus.own'   -- Close/reopen/archive own accommodation conversations
CONVERSATION_UPDATE_STATUS_ANY   = 'conversation.updateStatus.any'   -- Change status of any conversation (including unblock)
CONVERSATION_BLOCK_OWN           = 'conversation.block.own'          -- Block a conversation (own accommodations)
CONVERSATION_BLOCK_ANY           = 'conversation.block.any'          -- Block any conversation
CONVERSATION_DELETE_ANY          = 'conversation.delete.any'         -- Soft-delete any conversation (no _OWN variant)
```

**Naming convention (confirmed against `packages/schemas/src/enums/permission.enum.ts`):**

- **Enum keys** (identifiers) are `UPPER_SNAKE_CASE` following the `{ENTITY}_{ACTION}_{SCOPE}` pattern.
- **Enum values** are dotted lowercase (e.g. `'conversation.view.own'`, `'conversation.viewAll'`). Compare with the existing `ACCOMMODATION_CREATE = 'accommodation.create'`, `ACCOMMODATION_VIEW_ALL = 'accommodation.viewAll'`, `HOST_MESSAGE_SEND = 'host.message.send'`. The `_ALL` variant uses `viewAll` (camelCase, single segment), the `_OWN`/`_ANY` scopes use an extra dotted segment.

Additionally, `CONVERSATION = 'CONVERSATION'` must be added to `PermissionCategoryEnum` in the same file.

### Role → Permission Mapping (must be added to `packages/seed/src/required/rolePermissions.seed.ts`)

| Role | CONVERSATION_VIEW_OWN | CONVERSATION_VIEW_ANY | CONVERSATION_VIEW_ALL | CONVERSATION_REPLY_OWN | CONVERSATION_REPLY_ANY | CONVERSATION_UPDATE_STATUS_OWN | CONVERSATION_UPDATE_STATUS_ANY | CONVERSATION_BLOCK_OWN | CONVERSATION_BLOCK_ANY | CONVERSATION_DELETE_ANY |
|------|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| `SUPER_ADMIN` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `ADMIN` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| `HOST` | ✓ | — | — | ✓ | — | ✓ | — | ✓ | — | — |
| `EDITOR`, `CLIENT_MANAGER`, `SPONSOR`, `USER`, `GUEST` | — | — | — | — | — | — | — | — | — | — |

**Rationale:**

- `USER` and `GUEST` authenticated-guest actions on their own conversations (view own, reply own, archive own) are gated by **session ownership (`conversations.user_id = actor.userId`)**, not by `PermissionEnum`. The three protected routes (`GET /protected/conversations`, `GET /protected/conversations/:id`, `POST /protected/conversations/:id/messages`, `PATCH /protected/conversations/:id/archive`, `GET /protected/conversations/unread-count`) check authentication + ownership inline. No new permission is required for authenticated guests.
- `EDITOR` and `CLIENT_MANAGER` do not receive any CONVERSATION_* permissions. Content editing is not the same responsibility as inbox management.
- `SPONSOR` does not receive any CONVERSATION_* permissions. Sponsorship roles are orthogonal to hosting.
- `CONVERSATION_DELETE_ANY` is reserved for `SUPER_ADMIN` only — soft-delete of a conversation plus cascade of messages/tokens/schedules is a moderation action, not an owner action.

**Relationship with existing `HOST_MESSAGE_SEND` permission:** The existing `HOST_MESSAGE_SEND = 'host.message.send'` permission (used by 5 roles) is a separate concern controlling the "direct contact" feature. The new `CONVERSATION_*` permissions control the in-platform messaging system. Both coexist.

**Where permissions are checked:**

- All admin route handlers check permissions via the project's standard `requirePermission()` middleware.
- The `GET /admin/conversations` handler inspects whether the caller has `CONVERSATION_VIEW_ALL` and, if not, scopes the query to `accommodation_id IN (owner's accommodations)`.
- `CONVERSATION_DELETE_ANY` has no `_OWN` variant by design. Owners cannot hard-delete conversations; only super-admins can.
- Tag-related permissions are NOT part of this spec (see SPEC-086).

---

## Notifications

### Dispatcher Architecture

A cron job (`apps/api/src/cron/jobs/conversation-notification.job.ts`) runs every 5 minutes.

1. Query `conversation_notification_schedules` where `pending_notification_at <= now()` and `cancelled_at IS NULL`, ordered by `pending_notification_at ASC`, `LIMIT 100`.
2. For each schedule row:
   a. Load the conversation and its unread messages (messages created after the relevant `lastReadAt` timestamp for the `recipient_side`).
   b. If no unread messages remain (recipient read before cron ran): mark schedule `cancelled_at = now()`. Skip.
   c. If `streak_count >= 3`: mark `cancelled_at = now()`. No email. Skip.
   d. Resolve the recipient email address:
      - `recipient_side = 'owner'` → JOIN `accommodations.owner_id` → `users.email`.
      - `recipient_side = 'guest'` and `conversations.user_id IS NOT NULL` → `users.email` of the linked user.
      - `recipient_side = 'guest'` and `conversations.user_id IS NULL` → `conversations.anonymous_email` (required to be non-null and `anonymous_email_verified = true` at this point, otherwise a `PENDING_VERIFICATION` conversation was never activated and no schedule row should exist).
   e. Send the grouped notification email (see "Email Dispatch" in Implementation Notes).
   f. Increment `streak_count`. Calculate next `pending_notification_at`:
      - Streak 1 → sent; next would be 24h from `streak_started_at`.
      - Streak 2 → sent; next would be 72h from `streak_started_at`.
      - After streak 3 → cancel.
   g. Update the schedule row (increment `streak_count`, set new `pending_notification_at`, or cancel).
3. Use Redis idempotency key `conv:notif:[schedule_id]` with TTL 10 minutes to prevent double-fire on overlapping cron runs.
4. Use `pg_try_advisory_xact_lock(43020)` inside a `withTransaction` callback to prevent overlapping executions (advisory lock registry must be updated). Transaction-level locks are mandatory due to Neon connection pooling.

### Notification Email Content Requirements

The email must include:
- Accommodation name and a thumbnail if available.
- Guest identity: for anonymous, name + email; for authenticated, display name.
- Up to 3 message excerpts (truncated to 200 chars each) with timestamps.
- A primary CTA button: for anonymous recipients, the token-based URL; for authenticated, the protected URL.
- Copy suggesting account creation (anonymous only).

### Notification Schedule Logic (service layer)

When a new message is created:
1. Determine `recipient_side`: if `sender_type = 'guest'`, recipient is `'owner'`; if `sender_type = 'owner'`, recipient is `'guest'`.
2. Check if a non-cancelled schedule exists for (conversationId, recipientSide).
   - If yes and `streak_count < 3`: update `pending_notification_at = now() + 30 minutes`, `streak_started_at = now()`, reset `streak_count = 1`. (New activity resets the streak.)
   - If yes and `streak_count >= 3`: same reset (new activity resets exhausted streak).
   - If none: insert new schedule with `pending_notification_at = now() + 30 minutes`, `streak_count = 1`.
3. Cancel the opposing side's schedule if any (since that side just replied, their unread streak is cleared). Mark it `cancelled_at = now()`.

When a message is read (`lastReadAt` updated):
- Service checks for an active schedule for (conversationId, recipientSide) and sets `cancelled_at = now()`.

SYSTEM messages do NOT trigger notification schedules.

**Housekeeping note:** Cancelled notification schedule rows (`cancelled_at IS NOT NULL`) accumulate over time but do not affect query performance (queries filter on `WHERE cancelled_at IS NULL`). A future housekeeping cron may purge stale records older than 90 days. This is not in scope for MVP.

---

## Anti-Abuse and Security

### Rate Limiting

The existing rate-limit middleware (`apps/api/src/middlewares/rate-limit.ts`) is IP-only: `createPerRouteRateLimitMiddleware({ requests, windowMs })` builds a Redis-backed (in-memory fallback) limiter keyed on `clientIp`. It does NOT currently support custom key extractors. For this feature, a **new additive factory** must be introduced alongside the existing one:

```ts
// apps/api/src/middlewares/rate-limit.ts
export function createKeyedRateLimitMiddleware(options: {
  requests: number;
  windowMs: number;
  keyPrefix: string;                                // e.g. 'email:initiate'
  keyExtractor: (c: Context) => Promise<string | null> | string | null;
}): (c: Context, next: Next) => Promise<Response | void>;
```

Contract:

- `keyExtractor` inspects the request and returns the raw key material (e.g. the email from the validated body) or `null`.
- If `keyExtractor` returns `null` or throws, the middleware **skips** email-keyed limiting for that request (the IP-based limiter is expected to be chained in front and catches unauthenticated floods).
- When a key is returned, the middleware hashes it with SHA-256 (`crypto.createHash('sha256').update(raw).digest('hex')`) before using it in the Redis key `ratelimit:[keyPrefix]:[sha256(raw)]`.
- The Redis store, TTL, and in-memory fallback behavior are the SAME as `createPerRouteRateLimitMiddleware` (share the helpers `createRedisStore()` / `inMemoryStore`).
- On limit exceeded: respond with HTTP 429, `Retry-After` header, and `error.reason = 'RATE_LIMIT_EXCEEDED'`.

Endpoints chain IP and email limiters where both are required:

| Endpoint | IP limiter | Email limiter |
|----------|------------|---------------|
| `POST /public/conversations/initiate` | 10 req / 10 min | 5 req / hour, `keyPrefix: 'conv:initiate:email'`, extractor reads `body.guestEmail` (lowercased) |
| `POST /public/conversations/request-access` | 10 req / 10 min | 3 req / hour, `keyPrefix: 'conv:request-access:email'`, extractor reads `body.email` (lowercased) |
| `GET /public/conversations/verify/:token` | 20 req / 10 min | — |

**Middleware execution order (resolves open question R3):**

1. Body parsing (Hono built-in).
2. Zod validation of the body via `@hono/zod-openapi` (extracts the email as a valid string).
3. IP rate limiter runs first (pre-validation floods are caught by IP).
4. Email rate limiter runs after validation (only well-formed emails consume an email-keyed slot).

The email extractor depends on body validation, so it MUST run after `zValidator`. This is achievable by registering the email limiter as a route-level middleware in the handler options after `requestBody` is declared.

### Content Moderation (Blocklist)

Applied at message creation in the service layer (`ConversationService._validateMessageContent()`), before persistence.

**Environment variables:**
- `HOSPEDA_MESSAGING_BLOCKED_WORDS`: comma-separated list of blocked words (case-insensitive substring match).
- `HOSPEDA_MESSAGING_BLOCKED_DOMAINS`: comma-separated list of blocked domains (checked against any URL in the message body using a URL-extraction regex).

**Parsing rules (apply to both env vars):**
- Split by comma (`,`).
- Trim leading/trailing whitespace from each entry.
- Skip empty entries (so trailing/duplicate commas are tolerated: `"spam, ,buy now,"` → `["spam", "buy now"]`).
- Lower-case the resulting list once at process startup (compile the list into a frozen array; do not re-parse on every request).

**Behavior on match:** Reject with HTTP 422. The user sees a validation error. The message is NOT persisted silently.

**Empty env vars:** If the env vars are absent or empty (or contain only empty entries after parsing), moderation is a no-op (no words or domains blocked). The validator MUST NOT throw if the vars are not set or resolve to empty arrays.

**Render-time sanitization:** On the frontend, message bodies are rendered as plain text content via React JSX (text nodes, not innerHTML). URLs are autolinked via a URL-detection regex that wraps matches in `<a>` tags. No HTML sanitization library is required since no HTML or Markdown input is accepted in MVP. React's default JSX escaping prevents XSS.

### Guest Access Token Security

- Tokens are cryptographically random (128-bit minimum, hex-encoded, URL-safe).
- Tokens are stored hashed in the DB (SHA-256); the raw token is only in the URL and email.

  **Decision (resolved):** Access tokens are stored **hashed (SHA-256)** in the DB. The `token_hash` column contains the hex-encoded SHA-256 hash. The raw token is only present in the email URL and the redirect response. Lookup query: `WHERE token_hash = sha256(:rawInput)`. This ensures that a DB leak does not compromise guest access.

- Token URLs are one-time links in the sense that they expire; they are not single-use.
- Token revocation is immediate: setting `revoked_at` prevents further use.

---

## Token Lifecycle and Renewal

### Creation

On conversation activation (email verification success):
1. Generate a cryptographically random 128-bit token using `crypto.randomBytes(16).toString('hex')` from Node's `node:crypto` module. This produces a 32-character hex string that is URL-safe without encoding. Do NOT use `crypto.randomUUID()` because UUID v4 only has 122 bits of randomness and contains dashes.
2. Compute the SHA-256 hash of the raw token using `crypto.createHash('sha256').update(rawToken).digest('hex')` (64-character hex string).
3. Insert a row in `conversation_access_tokens` with `token_hash = <sha256 hex>`, `expires_at = now() + 30 days`.
4. Return the raw token in the redirect URL (never store the raw token server-side after this point).

**Verification re-entry (idempotent re-verification):**

The `GET /public/conversations/verify/:verificationToken` endpoint MUST be idempotent against the conversation status:

- If the conversation is `PENDING_VERIFICATION` and the JWT is valid → standard flow (transition to `PENDING_OWNER`, generate and insert a new access token, redirect).
- If the conversation is already in a post-verification status (`PENDING_OWNER`, `OPEN`, `PENDING_GUEST`, `CLOSED`, `BLOCKED`) and the JWT is valid → DO NOT create a duplicate access token. Generate a fresh 30-day access token (same as the renewal flow), insert it, and redirect the guest to `/guest/messages/[newToken]`. This prevents duplicate rows when two clicks of the same verification link race.
- If the conversation is `BLOCKED` or tied to a soft-deleted accommodation → return HTTP 410 Gone with `reason: "ACCOMMODATION_DELETED"` or `reason: "CONVERSATION_BLOCKED"`.

### Reminder Cron Job

`apps/api/src/cron/jobs/conversation-token-reminder.job.ts` runs daily.

Query: tokens where `expires_at BETWEEN now() + 5 days AND now() + 16 days` (day 15 window) OR `expires_at BETWEEN now() + 5 days AND now() + 6 days` (day 25 window). More precisely:

- Day-15 reminder: `expires_at` is in the range `[now() + 14 days, now() + 16 days)` AND `day15_reminder_sent_at IS NULL`. After sending, set `day15_reminder_sent_at = now()`.
- Day-25 reminder: `expires_at` in `[now() + 4 days, now() + 6 days)` AND `day25_reminder_sent_at IS NULL`. After sending, set `day25_reminder_sent_at = now()`.

The reminder tracking is handled by `day15_reminder_sent_at` and `day25_reminder_sent_at` nullable timestamp columns on `conversation_access_tokens`. Exactly two reminders are sent per token and not more.

### Expiry Cleanup Cron Job

`apps/api/src/cron/jobs/conversation-token-cleanup.job.ts` runs daily.

Soft-deletes (sets `revoked_at = now()`) all tokens where `expires_at < now()` and `revoked_at IS NULL`. Does not delete the token rows (audit trail).

### Renewal Flow

See Flow 4 above. On renewal:
- A new token row is inserted (does not replace the old one).
- The old token remains valid until it expires naturally (users may still have the old link in their email client).
- If explicit revocation is needed (e.g., admin abuse response), `revoked_at` is set on all tokens for that conversation.

---

## Anonymous to Authenticated Linking

### Mechanism

Better Auth v1.4.18 provides `databaseHooks.user.create.after` which is already used in the codebase (`apps/api/src/lib/auth.ts:422-476`) for billing sync and trial creation. The conversation linking logic is added to this existing hook.

### Hook Logic

```
on user.create:
  query conversations
    WHERE anonymous_email = newUser.email (normalized, lowercase)
      AND anonymous_email_verified = true
      AND user_id IS NULL
      AND deleted_at IS NULL
  for each found conversation:
    UPDATE conversations SET user_id = newUser.id, updated_at = now()
    WHERE id = conversation.id
      AND user_id IS NULL  -- guard against race condition
```

### Considerations

- The hook runs synchronously during registration. If many conversations need linking, this could slow registration. Mitigation: query is indexed on `anonymous_email`; typical users have 0–3 conversations.
- If the hook fails, the user account is still created. Linking failure is logged but not fatal to registration.
- After linking, the conversations appear in `/mi-cuenta/messages` for the authenticated user. The token-based URLs remain functional until the token expires.

---

## Accommodation Lifecycle Interactions

When an accommodation is soft-deleted:

1. The accommodation service (or a domain event handler in `ConversationService`) detects the deletion.
2. All non-BLOCKED, non-already-CLOSED conversations for that `accommodation_id` are set to `CLOSED`.
3. All active notification schedules for those conversations are cancelled (`cancelled_at = now()`).
4. No further messages are accepted: the message creation service checks `accommodation.deleted_at IS NULL` before inserting.
5. Historical threads remain readable by both owner (admin panel) and authenticated guests (`/mi-cuenta/messages`), and anonymous guests (via token, until expiry).
6. No SYSTEM message is appended for accommodation deletion (distinguished from owner-initiated close).

**Implementation note:** The trigger point is not yet decided. Options: (a) a hook in `AccommodationService._afterSoftDelete()`, or (b) the `ConversationService` checking accommodation status on every message creation. Option (a) is preferred for correctness. The tech design phase decides the exact integration point.

---

## Metrics

The following metrics are stored on the `conversations` table. No dashboard is built in this spec. They are updated by service hooks (not DB triggers).

| Metric column | Updated when |
|---------------|-------------|
| `first_guest_message_at` | First message with `sender_type = 'guest'` in the conversation |
| `first_owner_reply_at` | First message with `sender_type = 'owner'` in the conversation |
| `last_activity_at` | Every message creation |
| `last_guest_message_at` | Every message with `sender_type = 'guest'` |
| `last_owner_message_at` | Every message with `sender_type = 'owner'` |
| `closed_at` | When status transitions to `CLOSED` |
| `blocked_at` | When status transitions to `BLOCKED` |
| `guest_message_count` | Incremented on every guest message |
| `owner_message_count` | Incremented on every owner message |

SYSTEM messages do NOT increment message counters or update `last_guest_message_at` / `last_owner_message_at`.

---

## i18n

### Namespace

A new file `conversations.json` is created in each locale:
- `packages/i18n/src/locales/es/conversations.json` (primary)
- `packages/i18n/src/locales/en/conversations.json`
- `packages/i18n/src/locales/pt/conversations.json`

### Key Naming Conventions

Keys follow the existing project convention of `section.element` or `section.state.element`.

Suggested top-level sections:
```
conversations.form.*           -- ContactHost form labels and placeholders
conversations.status.*         -- Status display strings (open, closed, blocked, etc.)
conversations.inbox.*          -- Inbox list labels (guest and owner sides)
conversations.thread.*         -- Thread view labels (read receipt, system message, etc.)
conversations.errors.*         -- Error messages (rate limit, blocked, expired token, etc.)
conversations.email.*          -- Email template subject lines (referenced by template code)
conversations.empty.*          -- Empty state copy (guest inbox, owner inbox)
conversations.actions.*        -- Button labels (reply, close, block, archive, request-access)
conversations.notifications.*  -- Toast/alert copy
```

All user-visible strings in the feature must use i18n keys. Hard-coded strings in components are not allowed.

---

## Service Layer

Code lives in `packages/service-core/src/services/conversation/` following the existing monorepo pattern. All services extend `BaseCrudService`. All DB models live in `packages/db/src/models/conversation/` and extend `BaseModelImpl` (from `packages/db/src/base/base.model.ts`).

### Services

| Service | Responsibility |
|---------|---------------|
| `ConversationService` | CRUD for conversations, status transitions, archive toggles, metrics updates |
| `MessageService` | Create messages, enforce 5000-char limit, run blocklist check, update conversation metrics |
| `AccessTokenService` | Generate, validate, revoke tokens; TTL enforcement |
| `NotificationScheduleService` | Create/cancel/update notification schedules; called by `MessageService` hooks |

### Export

All services are exported from `packages/service-core/src/services/index.ts` (the service-core barrel export), following the same pattern as existing services like `AccommodationService` and `EventService`.

---

## Email Templates

New React Email templates in `packages/notifications/src/templates/conversation/` (following the established pattern where business notification templates live in the notifications package, organized by category):

| Template file | Trigger | Recipient |
|---------------|---------|-----------|
| `conversation-verify.tsx` | Anonymous initiation | Anonymous guest — verifies email |
| `conversation-new-message.tsx` | Notification cron (grouped) | Owner or authenticated guest |
| `conversation-new-message-anon.tsx` | Notification cron (grouped, token-based CTA) | Anonymous guest |
| `conversation-token-expiring-day15.tsx` | Token reminder cron (day 15) | Anonymous guest |
| `conversation-token-expiring-day25.tsx` | Token reminder cron (day 25) | Anonymous guest |

---

## Cron Jobs

Three new cron jobs in `apps/api/src/cron/jobs/`:

| File | Schedule | Advisory Lock ID (xact) | Description |
|------|----------|-----------------|-------------|
| `conversation-notification.job.ts` | `*/5 * * * *` (every 5 min) | 43020 | Dispatch grouped email notifications |
| `conversation-token-reminder.job.ts` | `0 9 * * *` (daily at 9 AM) | 43021 | Send day-15 and day-25 token expiry reminders |
| `conversation-token-cleanup.job.ts` | `0 3 * * *` (daily at 3 AM) | 43022 | Expire/revoke stale tokens |

Advisory lock IDs 43020, 43021, 43022 must be registered in `packages/db/docs/advisory-locks.md`. Confirmed free at time of writing (max existing ID is 43010, owned by `archive-expired-promotions.job.ts`; other existing is 43001 owned by `addon-expiry.job.ts`).

All jobs follow the `CronJobDefinition` type and the pattern established in `addon-expiry.job.ts`.

---

## Implementation Notes

### Verification Token Mechanism

The anonymous guest email verification uses a **signed JWT** (not a DB-stored token), created via the `jose` library (`SignJWT` / `jwtVerify`). The JWT payload is:

```json
{ "conversationId": "uuid", "email": "normalized@example.com", "iat": 1234567890, "exp": 1234567890 }
```

- Library: `jose` (add to `apps/api/package.json`). Import: `import { SignJWT, jwtVerify } from 'jose';`
- Signing: `new SignJWT(payload).setProtectedHeader({ alg: 'HS256' }).setExpirationTime('24h').sign(secret)` where `secret = new TextEncoder().encode(env.HOSPEDA_BETTER_AUTH_SECRET)`.
- Verification: `jwtVerify(token, secret)` — returns the payload or throws on invalid/expired.
- TTL: 24 hours from issuance.
- Stateless: no DB storage required. Validation is signature + expiry check + conversation status check.
- The JWT is distinct from the 30-day guest access token generated AFTER verification.

### Unread Count Calculation

The unread count for a given side (guest or owner) is:

```sql
SELECT COUNT(*) FROM messages
WHERE conversation_id = :conversationId
  AND sender_type != :mySenderType
  AND created_at > COALESCE(:myLastReadAt, '1970-01-01'::timestamptz)
  AND deleted_at IS NULL
```

For the owner inbox total: sum unread counts across all conversations where `accommodation_id IN (owner's accommodations)`.

### Read Receipt Update

`last_read_at_by_owner` and `last_read_at_by_guest` are updated automatically when the conversation thread is loaded via the GET endpoint (no explicit PATCH needed). The GET handler sets the timestamp to `now()` for the requesting side.

**Polling and read receipts interaction:** In MVP, only the admin panel polls for the unread count (`TanStack Query refetchInterval: 30_000` on the unread-count query). Guest thread views (authenticated `/mi-cuenta/messages/[conversationId]` and anonymous `/guest/messages/[token]`) do NOT poll in MVP. New messages arriving while a guest has the thread open appear only on navigation/refresh. This is a deliberate MVP simplification; WebSocket/SSE is listed as a Non-Goal. Consequently, `lastReadAtByGuest` is only bumped on full GET thread loads, not on silent refetches.

### Soft-Delete Cascade

The FK `onDelete` behaviors (`CASCADE` on `messages`, `conversation_access_tokens`, `conversation_notification_schedules`) apply **only to hard deletes**. Because this feature uses soft-delete (setting `deleted_at`), CASCADE is not triggered automatically.

When a conversation is soft-deleted (e.g., via `DELETE /admin/conversations/:id`):

1. Set `conversations.deleted_at = now()` and `deleted_by_id = actor.id`.
2. Set `messages.deleted_at = now()` and `deleted_by_id = actor.id` for all messages with `conversation_id = :id AND deleted_at IS NULL`.
3. Set `conversation_access_tokens.revoked_at = now()` for all tokens with `conversation_id = :id AND revoked_at IS NULL`.
4. Set `conversation_notification_schedules.cancelled_at = now()` for all active schedules with `conversation_id = :id AND cancelled_at IS NULL`.

All four operations must execute in a single transaction via `withTransaction()`. `ConversationService.softDelete()` orchestrates these steps (it is NOT the base `BaseCrudService.softDelete()` default).

If a hard delete ever occurs (future admin tool), the FK CASCADE will remove `messages`, `conversation_access_tokens`, and `conversation_notification_schedules` automatically.

### Email Dispatch Mechanism

Conversation emails bypass the `packages/notifications` `NotificationService` (which is billing-specific in its current shape) and are sent **directly via `sendEmail()` from `packages/email/src/send.ts`**. Rationale:

- The conversation notification cron already owns scheduling (`conversation_notification_schedules`) and idempotency (Redis `conv:notif:[schedule_id]` keys).
- Users cannot opt out of conversation notifications in MVP (see "Notification Preferences" below), so the preference/category machinery in `NotificationService` is not needed.
- Delivery retries are handled by the next cron tick — if a send fails, `streak_count` is not incremented and the same schedule row will be picked up again.

**Important implementation notes confirmed against the codebase:**

- `sendEmail` accepts a **React element**, not pre-rendered HTML. Resend renders the React component internally. The project does NOT use `@react-email/render` in production code — it is only a devDependency of `packages/email` used in unit tests (see `SPEC-040` §922).
- `sendEmail` requires a dependency-injected `client: Resend`. The Resend client singleton is obtained via `getResendClient()` from `packages/email/src/client.ts`, which reads `HOSPEDA_RESEND_API_KEY` from env.
- `from` defaults to `'Hospeda <noreply@hospeda.com.ar>'` and does not need to be specified.

Dispatch flow (inside the cron handler and the `ConversationService.sendVerificationEmail()` helper):

1. Obtain the Resend client: `const client = getResendClient();`
2. Import the React Email template from `@repo/notifications` (e.g. `import { ConversationVerifyTemplate } from '@repo/notifications';`).
3. Resolve the subject via `getTranslations(conversation.locale)('conversations.email.verify.subject', { ... })` (or the locale-aware helper the project provides in `@repo/i18n`).
4. Call:
   ```ts
   await sendEmail({
     client,
     to: recipientEmail,
     subject,
     react: ConversationVerifyTemplate({ accommodationName, verificationUrl, ... }),
   });
   ```
5. `sendEmail` returns `{ success, messageId?, error? }`. It is **non-blocking**: it never throws, only logs on failure. The cron handler MUST inspect `result.success`. If `false`, do NOT increment `streak_count` and do NOT advance `pending_notification_at` — leave the schedule row untouched so the next tick retries.
6. No write to `billing_notification_log` is performed (that table stays billing-scoped). A follow-up spec may introduce a `conversation_notification_log` if audit/analytics needs arise.

**Template props:** Each of the five templates (`conversation-verify`, `conversation-new-message`, `conversation-new-message-anon`, `conversation-token-expiring-day15`, `conversation-token-expiring-day25`) must define a TypeScript `*Props` interface and extend `BaseLayout` from `@repo/email/templates/base-layout` (for consistent Hospeda branding). The full props contract for each template is part of the schema-design phase, but at minimum each needs: `accommodationName`, `ctaUrl`, and a locale-resolved greeting/body.

### Notification Preferences

Conversation notifications are **always-sent (non-opt-out) in MVP**. The rationale: a guest cannot "unsubscribe" from an owner's reply they explicitly solicited, and an owner cannot reasonably opt out of inquiries on listings they published. This matches the `TRANSACTIONAL` semantics of the existing billing notification category but does NOT add new values to `NotificationType` / `NotificationCategory` enums. A future spec may introduce preference controls if product requirements evolve.

### Cron Authentication

The three new cron endpoints (`/api/v1/cron/conversation-notification`, `/api/v1/cron/conversation-token-reminder`, `/api/v1/cron/conversation-token-cleanup`) MUST use the existing cron auth middleware (`apps/api/src/cron/middleware.ts`), which requires `HOSPEDA_CRON_SECRET` via `Authorization: Bearer <secret>` or `X-Cron-Secret: <secret>` headers and uses constant-time comparison. No new env var is introduced.

### AccountLayout for Authenticated Guest Pages

The new authenticated guest pages (`/[lang]/mi-cuenta/messages/index.astro` and `/[lang]/mi-cuenta/messages/[conversationId].astro`) MUST use `AccountLayout.astro` (the same layout used by `mi-cuenta/favoritos`, `mi-cuenta/resenas`, etc.) for visual and navigational consistency. The anonymous guest pages under `/[lang]/guest/messages/` use a simpler `BaseLayout.astro` (no account sidebar, since anonymous visitors have no account nav).

### Owner Inbox Query Pattern

The `conversations` table has no `owner_id` column. To query "all conversations for owner X," the service must JOIN through accommodations:

```sql
SELECT c.* FROM conversations c
JOIN accommodations a ON c.accommodation_id = a.id
WHERE a.owner_id = :userId AND c.deleted_at IS NULL
ORDER BY c.last_activity_at DESC
```

The index `conversations_accommodationId_idx` supports this join.

### pgEnum Centralization Pattern

All pgEnums in this project are centralized in `packages/db/src/schemas/enums.dbschema.ts`. They are derived from TypeScript enums in `@repo/schemas` using the `enumToTuple()` helper from `packages/db/src/utils/enum-utils.ts`.

**Required steps for each new enum:**

1. Create the TypeScript enum in `packages/schemas/src/enums/` (e.g., `conversation-status.enum.ts`)
2. Re-export from `packages/schemas/src/enums/index.ts`
3. Import and create the pgEnum in `packages/db/src/schemas/enums.dbschema.ts`:
   ```ts
   import { ConversationStatusEnum } from '@repo/schemas';
   export const ConversationStatusPgEnum = pgEnum('conversation_status_enum', enumToTuple(ConversationStatusEnum));
   ```
4. Use the pgEnum in the table definition.

### Drizzle Relations Exports

Every Drizzle schema file in this project exports BOTH the table definition AND a relations object. For example:

```ts
// conversation.dbschema.ts
export const conversations = pgTable('conversations', { ... });
export const conversationsRelations = relations(conversations, ({ one, many }) => ({
    accommodation: one(accommodations, { ... }),
    messages: many(messages),
    accessTokens: many(conversationAccessTokens),
    notificationSchedules: many(conversationNotificationSchedules),
}));
```

Each schema directory must have an `index.ts` barrel re-exporting all tables and relations.

### DB Constraints via apply-postgres-extras.sh

The following cannot be declared by Drizzle ORM and must go in `packages/db/src/migrations/manual/`:

1. **Partial unique indexes**: `conversations_userId_accommodationId_unique` and `conversations_anonymousEmail_accommodationId_unique`
2. **CHECK constraint**: `messages_body_length CHECK (char_length(body) <= 5000)`
3. **`set_updated_at` trigger**: Applied automatically to new tables by the existing trigger migration (dynamic attachment via `0005_set_updated_at_trigger.sql`)

After any `drizzle-kit push`, run `packages/db/scripts/apply-postgres-extras.sh`.

### Environment Variable Registration

New env vars must be registered in `packages/config/src/env-registry.hospeda.ts` under category `messaging`:

- `HOSPEDA_MESSAGING_BLOCKED_WORDS` (string, optional, no default)
- `HOSPEDA_MESSAGING_BLOCKED_DOMAINS` (string, optional, no default)

### Admin UI Extensions

- **Admin section**: Conversations belong to the **Content** section in the admin panel header navigation. A new sidebar group ("Conversations") is added to `apps/admin/src/config/sections/content.section.tsx`, alongside Accommodations, Destinations, Posts, Events. The route patterns `/conversations` and `/conversations/**` must be added to the section's `routes` array, and `CONVERSATION_VIEW_OWN` added to the section's `permissions` array.
- The sidebar badge requires changes in two files:
  1. `SidebarItem` **interface** in `apps/admin/src/lib/sections/types.ts` — add `badge?: { count: number }` property.
  2. `SidebarItem` **component** in `apps/admin/src/components/layout/sidebar/SidebarItem.tsx` — render the badge count.
- Admin list routes use `AdminSearchBaseSchema` (page + pageSize, NOT limit).
- Admin routes live under `apps/admin/src/routes/_authed/` (all admin routes are wrapped by the `_authed` layout).
- Admin route file naming convention: `index.tsx` (list), `$id.tsx` (view), `$id_.edit.tsx` (edit), `new.tsx` (create).

### ContactHost Island

`ContactHost` (`apps/web/src/components/accommodation/ContactHost.client.tsx`) replaces the existing `OwnerContact` React island (`apps/web/src/components/accommodation/OwnerContact.client.tsx`). The old component and its CSS module (`OwnerContact.module.css`) should be deleted.

The new component must handle:

- **Anonymous visitors**: Full contact form (name, email, phone, message)
- **Authenticated users without existing conversation**: Same form minus name/email (taken from session)
- **Authenticated users with existing conversation**: "View your existing conversation" link (uses `buildUrl()` from `apps/web/src/lib/urls.ts`)

The contact form is only shown when `accommodation.lifecycleState === 'ACTIVE'` AND `accommodation.deletedAt === null`.

The accommodation detail page (`apps/web/src/pages/[lang]/alojamientos/[slug].astro`) must update its import from `OwnerContact` to `ContactHost` and use `client:idle` directive (same as current `OwnerContact`).

### Protected/Admin Rate Limits

Protected and admin conversation endpoints use the global rate limit middleware defaults (no per-route overrides in MVP). Only public endpoints have custom per-route limits.

### Error Responses and Response-Level Reason Codes

The project's `ServiceErrorCode` enum (`packages/service-core/src/types/index.ts`) is intentionally generic (`NOT_FOUND`, `FORBIDDEN`, `VALIDATION_ERROR`, `UNAUTHORIZED`, `INTERNAL_ERROR`, `DATABASE_ERROR`). This spec does NOT add entity-specific values to that enum.

Instead, conversation services throw standard `ServiceError` instances with the appropriate generic `ServiceErrorCode` **plus a dedicated `reason?: string` field** so that route handlers can propagate a domain-specific reason code to the client. The response shape produced by `createErrorResponse()` gains the same optional field:

```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "reason": "TOKEN_EXPIRED",
    "message": "Your access link has expired."
  },
  "metadata": { "timestamp": "...", "requestId": "..." }
}
```

`error.code` is always a `ServiceErrorCode` enum value. `error.reason` is a free-form `UPPER_SNAKE_CASE` string scoped to this feature. Clients SHOULD switch on `error.reason` when they need to present different UI for sub-cases; they MAY fall back to `error.code` otherwise.

**Required code changes (not optional, do NOT leave "to be finalized"):**

1. `ServiceError` at `packages/service-core/src/types/index.ts`: add a public readonly `reason?: string` field. Constructor signature becomes:
   ```ts
   constructor(
     public readonly code: ServiceErrorCode,
     message: string,
     public readonly details?: unknown,
     public readonly reason?: string
   )
   ```
   Existing call sites are not broken (the new positional argument is optional and at the end). Services throw e.g. `throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Conversation not found', undefined, 'CONVERSATION_NOT_FOUND')`.

2. `createErrorResponse` at `apps/api/src/utils/response-helpers.ts`: extend the `error` parameter to accept `reason?: string`:
   ```ts
   error: { code: string; message: string; details?: unknown; reason?: string }
   ```
   and include `reason` in the emitted JSON payload whenever present. `reason` is ALWAYS propagated regardless of `HOSPEDA_API_DEBUG_ERRORS` (it is a client-facing contract, not a debug field).

3. `handleRouteError` at `apps/api/src/utils/response-helpers.ts`: when mapping a `ServiceError` to an HTTP response, pass `reason: error.reason` through to `createErrorResponse`.

4. The shared `errorResponseSchema` at `apps/api/src/schemas/*` must be updated to include the optional `reason` field so OpenAPI docs stay accurate.

Route handlers for 410 (ACCOMMODATION_DELETED) and the rate-limit middleware set `reason` directly when no `ServiceError` is involved.

| HTTP Status | `error.code` (generic) | `error.reason` (domain) | When |
|-------------|------------------------|-------------------------|------|
| 404 | `NOT_FOUND` | `CONVERSATION_NOT_FOUND` | Conversation does not exist or caller has no access |
| 403 | `FORBIDDEN` | `CONVERSATION_BLOCKED` | Guest tries to send message to BLOCKED conversation |
| 409 | `VALIDATION_ERROR` | `CONVERSATION_DUPLICATE` | Anonymous guest tries to create duplicate verified conversation |
| 422 | `VALIDATION_ERROR` | `MESSAGE_CONTENT_BLOCKED` | Message fails blocklist validation |
| 422 | `VALIDATION_ERROR` | `MESSAGE_TOO_LONG` | Message exceeds 5000 chars |
| 401 | `UNAUTHORIZED` | `TOKEN_EXPIRED` | Guest access token has expired |
| 401 | `UNAUTHORIZED` | `TOKEN_REVOKED` | Guest access token has been revoked |
| 401 | `UNAUTHORIZED` | `VERIFICATION_TOKEN_EXPIRED` | JWT verification token has expired (24h) |
| 401 | `UNAUTHORIZED` | `VERIFICATION_TOKEN_INVALID` | JWT signature invalid or payload malformed |
| 410 | `VALIDATION_ERROR` | `ACCOMMODATION_DELETED` | Accommodation was soft-deleted; no new messages (mapped to 410 by the route handler, not by the service) |
| 429 | `VALIDATION_ERROR` | `RATE_LIMIT_EXCEEDED` | Too many requests (IP or email). The rate-limit middleware produces this response directly; `ServiceError` is not involved. |

**How services produce these:** The service throws e.g. `new ServiceError(ServiceErrorCode.NOT_FOUND, 'Conversation not found', undefined, 'CONVERSATION_NOT_FOUND')`. The route handler maps the service error to HTTP via `handleRouteError` (`apps/api/src/utils/response-helpers.ts`), which in turn delegates to `createErrorResponse` and propagates `error.reason` as a first-class field. For the 410 and 429 cases the route/middleware calls `createErrorResponse` directly with an explicit `reason`.

### Cron Idempotency

The notification cron uses Redis keys (not DB-based idempotency). Pattern: `conv:notif:[schedule_id]` with 10-minute TTL. This is defense-in-depth; the `pg_try_advisory_xact_lock` is the primary guard against overlapping executions. This differs from the addon-expiry cron which uses a DB notification log, but is justified by the simpler fire-and-forget nature of conversation notifications.

### `updated_at` Column

The `updated_at` column auto-updates via the `set_updated_at` DB trigger (applied to all tables via `packages/db/src/migrations/manual/`). Service code does not need to set this field explicitly.

---

## Phased Implementation Outline

This is a high-level grouping for planning. Atomic tasks are generated separately.

| Phase | Deliverable |
|-------|------------|
| 1 | DB schema: enums, tables, indexes (`conversations`, `messages`, `conversation_access_tokens`, `conversation_notification_schedules`) |
| 2 | Zod schemas in `@repo/schemas`: base, CRUD, access, query, HTTP schemas for conversations and messages |
| 3 | Service layer: `ConversationService`, `MessageService`, `AccessTokenService`, `NotificationScheduleService` |
| 4 | API routes: public (initiate, verify, request-access, guest thread, guest reply), protected (list, thread, reply, archive, unread-count), admin (list, thread, reply, status, archive, delete, unread-count) |
| 5 | Email templates: `conversation-verify`, `conversation-new-message`, `conversation-new-message-anon`, `conversation-token-expiring-day15`, `conversation-token-expiring-day25` |
| 6 | Cron jobs: notification dispatcher, token reminder, token cleanup |
| 7 | Rate limit extension: email-based limiter middleware |
| 8 | Content moderation middleware: blocklist validation in `MessageService` |
| 9 | Anonymous → authenticated user.create hook |
| 10 | Web UI: `ContactHost` React island on accommodation detail page + `/mi-cuenta/messages` list + `/mi-cuenta/messages/[id]` thread + `/guest/messages/[token]` anonymous view |
| 11 | Admin UI: `/admin/conversations` global inbox + `/admin/conversations/[id]` thread + status/block/archive controls + unread count badge + polling |
| 12 | Tests: unit (services, validators, state machine), integration (routes, cron), e2e (initiate → verify → reply → notify flow) |
| 13 | i18n: all keys in `conversations.json` for es, en, pt |

---

## Dependencies

| Dependency | Type | Blocking? | Notes |
|------------|------|-----------|-------|
| `packages/notifications` (Resend + React Email) | Internal | Yes | Email templates live in `packages/notifications/src/templates/conversation/` |
| `jose` (JWT library) | External (new) | Yes | Required for email verification token signing (HS256). Add to `apps/api/package.json` with range `^6.1.0` (currently resolves to 6.1.3 via `better-auth@1.4.18` transitive dependency; 6.2.x is the latest and is backwards-compatible within 6.x). Web Crypto API based, zero runtime deps, edge-compatible. |
| Better Auth user.create hook | Internal | Yes | Confirmed: `databaseHooks.user.create.after` at `apps/api/src/lib/auth.ts:443-476` |
| Redis (rate limit + cron idempotency) | Infrastructure | Yes | Required for email-based rate limiter and cron idempotency keys |
| SPEC-086 (tag system refactor) | Downstream | No | Tags are additive after this spec. This spec must NOT model or reserve tag-related fields. |
| `packages/db/docs/advisory-locks.md` | Documentation | No | Must be updated to register lock IDs 43020–43022 |

---

## Risks and Open Questions

| ID | Risk / Question | Likelihood | Impact | Status |
|----|-----------------|------------|--------|--------|
| R1 | Better Auth does not expose a `user.create` hook in its current version. | ~~Medium~~ | ~~High~~ | **Resolved** — Better Auth v1.4.18 provides `databaseHooks.user.create.after`, already in use at `apps/api/src/lib/auth.ts:422-476`. |
| R2 | Token storage strategy (raw vs. hashed in DB). | ~~Low~~ | ~~Medium~~ | **Resolved** — SHA-256 hashing chosen. Lookup via `WHERE token_hash = sha256(input)`. |
| R3 | Email-based rate limiting requires extracting the email from a not-yet-validated body. If validation fails, the limiter must still count the attempt (IP-only fallback) to avoid an evasion path. Middleware ordering matters. | ~~Medium~~ | ~~Medium~~ | **Resolved** — a new `createKeyedRateLimitMiddleware` factory is introduced. IP limiter runs pre-validation, email limiter runs post-`zValidator`. See "Rate Limiting" section. |
| R4 | The accommodation lifecycle interaction (freezing conversations on soft-delete) has no confirmed integration point. Service hook vs. domain event handler pattern is undecided. | Medium | Medium | **Open** — tech design phase. Preferred option remains `AccommodationService._afterSoftDelete()` hook (service layer), with `ConversationService.closeAllForAccommodation(accommodationId, tx)` invoked in the same transaction. |
| R5 | Token reminder tracking (how to know whether a day-15 reminder has already been sent for a given token) may require additional columns on `conversation_access_tokens` or a separate reminder log table. | ~~Low~~ | ~~Low~~ | **Resolved** — `day15_reminder_sent_at` and `day25_reminder_sent_at` nullable timestamp columns added to the `conversation_access_tokens` table definition. |
| R6 | Message body moderation via substring match on `HOSPEDA_MESSAGING_BLOCKED_WORDS` is naive (evasion via spacing, unicode, etc.). Accepted as MVP trade-off; a proper moderation service can be integrated later. | High | Low (MVP) | **Accepted** — documented limitation. |
| R7 | Infinite scroll (50 messages/page) and 30-second polling both require careful performance testing for accommodations with very active conversations. | Low | Medium | **Open** — confirm pagination indexes are sufficient before launch. |
| R8 | The partial unique indexes cannot be declared via Drizzle ORM. Raw SQL migration files are required. | Medium | High | **Confirmed** — Both partial unique indexes must go in `packages/db/src/migrations/manual/` and be applied via `apply-postgres-extras.sh`. |
| R9 | Anonymous guest access tokens are in the URL path, making them visible in server logs and browser history. Accepting as MVP trade-off (common pattern). Consider moving to a query parameter or cookie-based flow in a future spec. | Medium | Low | **Accepted** — documented limitation. |

---

## Acceptance Criteria

### Feature-level BDD criteria

#### Anon initiation and verification

Given a valid anonymous guest form submission,
When the submission is processed,
Then a conversation exists in `PENDING_VERIFICATION` status,
And a verification email is dispatched within 60 seconds,
And no owner notification has been sent.

Given the anonymous guest clicks a valid verification link,
When the link is processed,
Then the conversation status is `PENDING_OWNER`,
And a guest access token exists in `conversation_access_tokens` with `expires_at = now + 30 days`,
And the guest is redirected to `/guest/messages/[token]`,
And an owner notification is scheduled for 30 minutes from now.

#### Authenticated initiation

Given an authenticated user's first contact with an accommodation,
When they submit the contact form,
Then a conversation is created with `status = PENDING_OWNER`,
And the user is redirected to `/mi-cuenta/messages/[conversationId]`,
And the conversation appears in the user's `/mi-cuenta/messages` list.

Given an authenticated user who already has a conversation with an accommodation,
When they view the accommodation detail page,
Then the contact form is replaced by a "View existing conversation" prompt,
And no duplicate conversation is created.

#### State machine

Given a `CLOSED` conversation,
When the guest sends a new message,
Then the conversation status transitions to `PENDING_OWNER`,
And an owner notification is scheduled.

Given a `BLOCKED` conversation,
When the guest attempts to send a message,
Then the API returns 403,
And the conversation status remains `BLOCKED`.

#### Notifications

Given a new guest message in an `OPEN` or `PENDING_OWNER` conversation,
When 30 minutes elapse with no owner read or reply,
Then the owner receives a grouped notification email containing the message excerpt and a CTA link.

Given an owner who reads the conversation before the scheduled notification fires,
When the notification cron runs,
Then no email is sent for that notification entry.

Given a conversation where 3 notifications have already been sent in the current streak,
When the cron runs again,
Then no additional notification is sent,
And the streak resets only when a new message arrives.

#### Token expiry

Given a guest access token created 15 days ago,
When the token reminder cron runs,
Then the anonymous guest receives a day-15 reminder email.

Given an expired guest access token (past 30 days),
When the anonymous guest navigates to `/guest/messages/[token]`,
Then they see an expiry notice with an option to request a new link.

#### Linking

Given an anonymous guest with verified email X and one conversation,
When a user registers with email X,
Then the conversation's `user_id` is set to the new user's ID,
And the conversation appears in the user's authenticated inbox.

#### Content moderation

Given `HOSPEDA_MESSAGING_BLOCKED_WORDS = "spam,buy now"` and a message body containing "spam",
When the message creation endpoint is called,
Then the API returns 422 with a validation error,
And no message row is inserted.

#### Accommodation deletion

Given a soft-deleted accommodation with 2 active conversations,
When the deletion is processed,
Then both conversations transition to `CLOSED`,
And no new messages can be added to either conversation.

---

## Affected Files (Expected)

This list is indicative. The tech analysis phase produces the definitive inventory.

### New files

**DB schemas:**
- `packages/db/src/schemas/conversation/conversations.dbschema.ts` (table + relations)
- `packages/db/src/schemas/conversation/messages.dbschema.ts` (table + relations)
- `packages/db/src/schemas/conversation/conversation_access_tokens.dbschema.ts` (table + relations)
- `packages/db/src/schemas/conversation/conversation_notification_schedules.dbschema.ts` (table + relations)
- `packages/db/src/schemas/conversation/index.ts` (barrel re-export)
- `packages/db/src/migrations/manual/0015_conversation_partial_indexes.sql` — MUST include all partial unique indexes for this feature:
  - `conversations_userId_accommodationId_unique` (on `conversations`)
  - `conversations_anonymousEmail_accommodationId_unique` (on `conversations`)
  - `conv_notif_schedules_conversation_recipient_unique` (on `conversation_notification_schedules`)
- `packages/db/src/migrations/manual/0016_messages_body_length_check.sql` (CHECK constraint `messages_body_length CHECK (char_length(body) <= 5000)`)

  Numbering: the `manual/` directory currently goes up to `0014_*`. If another spec lands a `0015_*` before this one, bump these to the next available pair. The `apply-postgres-extras.sh` script is idempotent (`IF NOT EXISTS` / `CREATE OR REPLACE`) and applies all files in the directory in lexicographic order.

**TypeScript enums (must be created BEFORE pgEnums):**
- `packages/schemas/src/enums/conversation-status.enum.ts`
- `packages/schemas/src/enums/message-status.enum.ts`
- `packages/schemas/src/enums/message-sender-type.enum.ts`
- `packages/schemas/src/enums/notification-recipient-side.enum.ts`

**Zod schemas** (follows the existing split used by e.g. `packages/schemas/src/entities/accommodation/`):
- `packages/schemas/src/entities/conversation/conversation.schema.ts` (base entity schema)
- `packages/schemas/src/entities/conversation/message.schema.ts` (base entity schema)
- `packages/schemas/src/entities/conversation/conversation.crud.schema.ts` (create/update/patch/delete)
- `packages/schemas/src/entities/conversation/conversation.access.schema.ts` (access-token related shapes)
- `packages/schemas/src/entities/conversation/conversation.http.schema.ts` (HTTP input/output DTOs, including the `error.reason` discriminators)
- `packages/schemas/src/entities/conversation/conversation.admin-search.schema.ts` (extends `AdminSearchBaseSchema` from `common/admin-search.schema.ts`)
- `packages/schemas/src/entities/conversation/conversation.query.schema.ts` (public/protected list query shapes — cursor + limit for threads, filters for inbox)
- `packages/schemas/src/entities/conversation/conversation.relations.schema.ts` (shapes for returning conversation with joined accommodation/user/messages)
- `packages/schemas/src/entities/conversation/index.ts` (barrel re-export)

**DB models (extend `BaseModelImpl` from `packages/db/src/base/base.model.ts`):**
- `packages/db/src/models/conversation/conversation.model.ts`
- `packages/db/src/models/conversation/message.model.ts`
- `packages/db/src/models/conversation/conversationAccessToken.model.ts`
- `packages/db/src/models/conversation/conversationNotificationSchedule.model.ts`
- `packages/db/src/models/conversation/index.ts` (barrel re-export)

**Service layer:**
- `packages/service-core/src/services/conversation/conversation.service.ts`
- `packages/service-core/src/services/conversation/conversation.permissions.ts` (checkCan* permission functions)
- `packages/service-core/src/services/conversation/message.service.ts`
- `packages/service-core/src/services/conversation/access-token.service.ts`
- `packages/service-core/src/services/conversation/notification-schedule.service.ts`
- `packages/service-core/src/services/conversation/index.ts` (barrel re-export)

**API routes:**
- `apps/api/src/routes/conversations/index.ts` (barrel re-export)
- `apps/api/src/routes/conversations/public/` (initiate, verify, request-access, guest-thread, guest-reply)
- `apps/api/src/routes/conversations/protected/` (list, thread, reply, archive, unread-count)
- `apps/api/src/routes/conversations/admin/` (list, thread, reply, status, archive, delete, unread-count)

**Cron jobs:**
- `apps/api/src/cron/jobs/conversation-notification.job.ts`
- `apps/api/src/cron/jobs/conversation-token-reminder.job.ts`
- `apps/api/src/cron/jobs/conversation-token-cleanup.job.ts`

**Email templates:**
- `packages/notifications/src/templates/conversation/conversation-verify.tsx`
- `packages/notifications/src/templates/conversation/conversation-new-message.tsx`
- `packages/notifications/src/templates/conversation/conversation-new-message-anon.tsx`
- `packages/notifications/src/templates/conversation/conversation-token-expiring-day15.tsx`
- `packages/notifications/src/templates/conversation/conversation-token-expiring-day25.tsx`
- `packages/notifications/src/templates/conversation/index.ts` (barrel re-export)

**i18n:**
- `packages/i18n/src/locales/es/conversations.json`
- `packages/i18n/src/locales/en/conversations.json`
- `packages/i18n/src/locales/pt/conversations.json`

**Web UI:**
- `apps/web/src/components/accommodation/ContactHost.client.tsx` (React island, `client:idle`)
- `apps/web/src/pages/[lang]/mi-cuenta/messages/index.astro`
- `apps/web/src/pages/[lang]/mi-cuenta/messages/[conversationId].astro`
- `apps/web/src/pages/[lang]/guest/messages/[token].astro`
- `apps/web/src/pages/[lang]/guest/messages/request-access.astro` (email form to request new magic link)
- `apps/web/src/pages/[lang]/guest/messages/verify-expired.astro` (error page for expired/invalid verification links)

**Admin UI:**
- `apps/admin/src/routes/_authed/conversations/index.tsx` (list/inbox page)
- `apps/admin/src/routes/_authed/conversations/$id.tsx` (thread view page)
- `apps/admin/src/features/conversations/` — follow the full structure used by `apps/admin/src/features/accommodations/`:
  - `hooks/` — TanStack Query hooks (`useConversations`, `useConversation`, `useUnreadCount`, `useReplyMutation`, `useUpdateStatusMutation`, `useArchiveMutation`)
  - `components/` — presentational + container components (`InboxList`, `ThreadView`, `MessageBubble`, `ReplyForm`, `StatusBadge`, `UnreadBadge`, `ArchiveToggle`, `BlockDialog`, `DeleteDialog`)
  - `types/` — feature-local types that are NOT in `@repo/schemas`
  - `config/` — column definitions for `@tanstack/react-table`, filter configs, sort presets
  - `schemas/` — feature-level zod schemas for forms (block-with-reason, reply, etc.)
  - `utils/` — helpers (timestamp formatters, excerpt truncation, sender-type to label mapping)
  - `server/` — server-side loader helpers if `beforeLoad` needs prefetch. Only if a route requires prefetch; otherwise this directory can be omitted.

### Deleted files

- `apps/web/src/components/accommodation/OwnerContact.client.tsx` — replaced by `ContactHost.client.tsx`
- `apps/web/src/components/accommodation/OwnerContact.module.css` — associated CSS module

### Modified files

- `packages/schemas/src/enums/permission.enum.ts` — add 10 new `CONVERSATION_*` permission values + `CONVERSATION` to `PermissionCategoryEnum`
- `packages/schemas/src/enums/index.ts` — re-export 4 new enums
- `packages/db/src/schemas/enums.dbschema.ts` — add 4 new pgEnums using `enumToTuple()`
- `packages/db/src/schemas/index.ts` — re-export conversation schemas
- `apps/api/src/middlewares/rate-limit.ts` — add the new `createKeyedRateLimitMiddleware({ requests, windowMs, keyPrefix, keyExtractor })` factory alongside the existing `createPerRouteRateLimitMiddleware`. Share `createRedisStore()` / `inMemoryStore` helpers
- `packages/service-core/src/types/index.ts` — add optional 4th constructor arg `reason?: string` to `ServiceError`; expose as public readonly field
- `apps/api/src/utils/response-helpers.ts` — extend `createErrorResponse` to accept `reason?: string` on the error payload; update `handleRouteError` to propagate `ServiceError.reason` into the response. Propagation is unconditional (not gated by `HOSPEDA_API_DEBUG_ERRORS`)
- `apps/api/src/schemas/` (or wherever `errorResponseSchema` lives) — add optional `reason: z.string().optional()` to the error response schema so OpenAPI docs reflect the new field
- `packages/seed/src/required/rolePermissions.seed.ts` — add the 10 new `CONVERSATION_*` permissions to the roles per the Role → Permission Mapping table (`SUPER_ADMIN` gets all 10, `ADMIN` gets 9, `HOST` gets 4 `_OWN`; others get none)
- `apps/api/src/cron/registry.ts` — register 3 new cron jobs
- `apps/api/src/cron/jobs/index.ts` — export 3 new jobs from barrel
- `apps/api/src/routes/index.ts` — register conversation routes
- `packages/db/docs/advisory-locks.md` — register lock IDs 43020–43022
- `apps/api/src/lib/auth.ts` — extend `user.create.after` hook (lines 443–476) with conversation linking logic
- `apps/api/package.json` — add `jose` dependency
- `packages/config/src/env-registry.hospeda.ts` — register `HOSPEDA_MESSAGING_BLOCKED_WORDS` and `HOSPEDA_MESSAGING_BLOCKED_DOMAINS`
- `packages/service-core/src/services/index.ts` — re-export conversation services
- `packages/db/src/models/index.ts` — add `export * from './conversation/index.ts'` barrel re-export
- `packages/notifications/src/templates/index.ts` — add `export * from './conversation/index.js'` barrel re-export
- `apps/admin/src/lib/sections/types.ts` — extend `SidebarItem` **interface** with `badge?: { count: number }`
- `apps/admin/src/components/layout/sidebar/SidebarItem.tsx` — render badge count
- `apps/admin/src/config/sections/content.section.tsx` — add "Conversations" sidebar group with route patterns `/conversations`, `/conversations/**` and `CONVERSATION_VIEW_OWN` permission
- `apps/web/src/pages/[lang]/alojamientos/[slug].astro` — replace `OwnerContact` import with `ContactHost`; remove the `{userId && (...)}` conditional wrapper around the island so `ContactHost` renders for BOTH anonymous and authenticated visitors. `ContactHost` decides its own rendering mode based on session state.
- `apps/web/src/components/accommodation/OwnerCard.astro` — remove the "Register to Contact" CTA shown to unauthenticated users and remove the `{userId && ...}` guard around the island slot. The `ContactHost` island now unconditionally occupies the contact slot and handles the anonymous-visitor UX internally (form with name/email/phone/message fields). If `OwnerCard` no longer has any conditional logic around the slot, it becomes a plain passthrough of the slotted component.
- `apps/web/src/lib/routes.ts` — add `'guest'` to `SESSION_OPTIONAL_SEGMENTS` so the web middleware does NOT redirect anonymous visitors of `/[lang]/guest/messages/[token]` to the auth sign-in page. `mi-cuenta` is already in `PROTECTED_SEGMENTS`, so no change is needed for `/mi-cuenta/messages/*`.
- `apps/api/vercel.json` — register the three new cron jobs so Vercel actually invokes them in production. Add entries:
  - `{ "path": "/api/v1/cron/conversation-notification", "schedule": "*/5 * * * *" }`
  - `{ "path": "/api/v1/cron/conversation-token-reminder", "schedule": "0 9 * * *" }`
  - `{ "path": "/api/v1/cron/conversation-token-cleanup", "schedule": "0 3 * * *" }`

---

## Revision History

### Revision 1 (2026-04-18) — Exhaustive Audit Pass

**Auditor**: Claude (automated codebase verification + external service validation)

**Summary**: 30 corrections applied across 13 critical, 12 medium, and 5 minor findings. 5 design decisions resolved with user.

**Critical fixes:**
- C1: Advisory lock `pg_try_advisory_lock` -> `pg_try_advisory_xact_lock` (Neon compat)
- C2: Risk R1 marked RESOLVED (Better Auth `databaseHooks.user.create.after` confirmed at auth.ts:422)
- C3: Added JWT verification token mechanism (24h TTL, stateless, no new table)
- C4: Fixed service export barrel typo
- C5: Fixed relationship diagram (n-n -> 1-n for conversations-messages)
- C6: Email templates moved from `packages/email/` to `packages/notifications/src/templates/conversation/`
- C7: State machine: removed owner-send-from-CLOSED, added explicit "Owner reopens" transition
- C8: Post-verification and post-creation status changed from OPEN to PENDING_OWNER
- C9: `sender_type` and `recipient_side` changed from varchar to PG enums
- C10: Added dotted permission values (e.g., `'conversation.view.own'`)
- C11: Added CONVERSATION to PermissionCategoryEnum requirement
- C12: Documented HOST_MESSAGE_SEND coexistence with CONVERSATION_* permissions
- C13: Added locale prefix to all web app routes (`/[lang]/messages/...`)

**Medium fixes:**
- M1: Documented Redis cron idempotency as deliberate deviation from DB pattern
- M2: Added onDelete FK behaviors (RESTRICT, SET NULL, CASCADE)
- M3: Added explicit unread count calculation formula
- M4: Replaced DOMPurify claim with plain-text JSX rendering (no sanitizer needed)
- M5: Specified lastReadAt auto-update on GET thread
- M6: Documented owner inbox JOIN through accommodations
- M7: Noted CHECK constraint requires apply-postgres-extras.sh
- M8: Noted env var registration in packages/config
- M9: Noted SidebarItem badge extension required
- M10: Noted admin pagination uses page+pageSize via AdminSearchBaseSchema
- M11: Documented ContactHost replacing OwnerContact with anon+auth dual mode
- M12: Confirmed R8 (partial indexes need raw SQL migration)

**Design decisions resolved:**
- Q1: CLOSED -> explicit reopen required (no direct reply)
- Q2: Access tokens stored SHA-256 hashed
- Q3: Verification via signed JWT (stateless, 24h)
- Q4: `consumed_at` column removed
- Q5: Cron idempotency via Redis keys

**External service verification:**
- Better Auth hooks: claim was WRONG, hook exists and is in production use
- DOMPurify: claim was WRONG, not a project dependency; plain text needs no sanitizer
- Resend, React Email, Redis (ioredis): all verified correct

### Revision 2 (2026-04-19) — Second Exhaustive Audit Pass

**Auditor**: Claude (automated codebase verification + external service validation)

**Summary**: 20 corrections applied across 6 critical, 11 medium, and 3 minor findings. 2 design decisions resolved with user.

**Critical fixes:**
- C2-01: `ContactHost` file path fixed from `apps/web/src/islands/ContactHost.tsx` to `apps/web/src/components/accommodation/ContactHost.client.tsx` (no `islands/` directory exists; islands use `*.client.tsx`)
- C2-02: Added pgEnum centralization pattern section — all pgEnums must go in `packages/db/src/schemas/enums.dbschema.ts` using `enumToTuple()` helper
- C2-03: Admin route paths fixed from `apps/admin/src/routes/conversations/` to `apps/admin/src/routes/_authed/conversations/`
- C2-04: Added 4 missing TypeScript enum files in `@repo/schemas/src/enums/` (required BEFORE pgEnums can be created)
- C2-05: Specified `jose` library for JWT verification tokens (no JWT library existed in project). Added import examples and signing/verification patterns.
- C2-06: Added `apps/api/src/cron/jobs/index.ts` to modified files (barrel export for new cron jobs)

**Medium fixes:**
- M2-01: Added route factory references (`createPublicRoute`, `createProtectedRoute`, `createAdminRoute`, `createAdminListRoute` from `route-factory-tiered.ts`) to API Surface table
- M2-02: Fixed admin route file naming from `$conversationId.tsx` to `$id.tsx` (project convention)
- M2-03: Documented SidebarItem type location in `apps/admin/src/lib/sections/types.ts` (in addition to component file)
- M2-04: Added `enumToTuple()` helper reference from `packages/db/src/utils/enum-utils.ts`
- M2-05: Added Drizzle relations exports section — every schema file must export `*Relations` alongside table definitions
- M2-06: Fixed `streak_count` DEFAULT typo (trailing single quote removed)
- M2-07: Specified `client:idle` directive for ContactHost island
- M2-08: Fixed dependencies table from `packages/email` to `packages/notifications`
- M2-09: Changed authenticated guest routes from `/[lang]/messages/*` to `/[lang]/mi-cuenta/messages/*` for consistency with existing auth-protected route convention
- M2-10: Added `OwnerContact.client.tsx` and `OwnerContact.module.css` to "Deleted files" section
- M2-11: Added `apps/web/src/pages/[lang]/alojamientos/[slug].astro` to modified files

**Minor fixes:**
- S2-01: Added `buildUrl()` helper reference for URL construction in ContactHost
- S2-02: Added barrel export files (`index.ts`) for conversation schemas, DB schemas, and service directories
- S2-03: Added admin-search schema file to new files list

**Design decisions resolved:**
- D2-01: JWT library — `jose` chosen over `jsonwebtoken` and custom HMAC. Rationale: lightweight, Web Crypto API, edge-compatible.
- D2-02: Authenticated messages route — `/[lang]/mi-cuenta/messages/*` chosen over `/[lang]/messages/*`. Rationale: consistency with existing auth-protected route convention (`/mi-cuenta/favoritos`, `/mi-cuenta/resenas`, etc.).

**External service verification:**
- `jose` library: Web Crypto API based, HS256 signing confirmed compatible
- Better Auth `databaseHooks.user.create.after`: re-confirmed at `apps/api/src/lib/auth.ts:443-476` (billing sync + trial)
- No JWT library in project: confirmed via grep across all imports
- Advisory lock IDs 43020-43022: confirmed free (max existing is 43010)
- `notification-schedule.job.ts`: confirmed to be billing-specific (lock ID 1002), no name collision with proposed `conversation-notification.job.ts`
- Rate limit middleware: confirmed IP-only, Redis+in-memory fallback pattern verified

### Revision 3 (2026-04-19) — Third Exhaustive Audit Pass

**Auditor**: Claude (automated codebase verification + external service validation)

**Summary**: 23 corrections applied across 6 critical, 12 medium, and 5 minor findings. 3 design decisions resolved with user.

**Critical fixes:**
- C3-01: Fixed `SidebarItemType` → `SidebarItem` interface naming error (SidebarItemType is a type alias, not an interface)
- C3-02: Added entire DB model layer to affected files. 5 new model files in `packages/db/src/models/conversation/` extending `BaseModelImpl` were completely missing
- C3-03: Added `conversation.permissions.ts` with `checkCan*` permission functions to service layer files (codebase pattern)
- C3-04: Fixed `token` → `token_hash` column name inconsistency in implementation note (line 933)
- C3-05: Added conditional permission check documentation for PATCH /status endpoint. Close/reopen uses `UPDATE_STATUS_*`, block uses `BLOCK_*`, unblock uses `UPDATE_STATUS_ANY` only
- C3-06: Specified Conversations belongs to **Content** section in admin panel sidebar. Added `content.section.tsx` to modified files

**Medium fixes:**
- M3-01: Added notification schedule cancellation on block. All active schedules for blocked conversation are cancelled
- M3-02: Clarified PENDING_VERIFICATION behavior on accommodation soft-delete. These are also closed; guest's unverified link returns ACCOMMODATION_DELETED
- M3-03: Clarified thread pagination direction. Initial load shows most recent 50 messages (last page), ascending chronological display, cursor-based scroll-up for older pages
- M3-04: Added archive PATCH request body specification: `{ archived: boolean }`
- M3-05: Clarified protected initiate response shape on append: `{ conversationId, isNew: false, messageId }`
- M3-06: Added notification template barrel export (`packages/notifications/src/templates/index.ts`) to modified files
- M3-07: Added models barrel export (`packages/db/src/models/index.ts`) to modified files
- M3-08: Added `day15_reminder_sent_at` and `day25_reminder_sent_at` columns to `conversation_access_tokens` table definition. Closed R5 as resolved
- M3-09: Added request-access page (`apps/web/src/pages/[lang]/guest/messages/request-access.astro`) to new files
- M3-10: Added verify-expired page (`apps/web/src/pages/[lang]/guest/messages/verify-expired.astro`) to new files
- M3-11: Added `apps/admin/src/config/sections/content.section.tsx` to modified files
- M3-12: Added pragmatic note that admin archive reuses `UPDATE_STATUS_OWN` permission (no separate archive permission warranted)

**Minor fixes:**
- S3-01: Added note that `jose` is already a transitive dependency via `better-auth` but should be added explicitly for version control
- S3-02: Fixed "all models extend BaseModel" → "extend `BaseModelImpl`" for precision
- S3-04: Added housekeeping note about stale notification schedule cleanup (not in MVP scope)
- S3-05: Specified polling mechanism for unread count badge: `TanStack Query refetchInterval: 30_000`

**Design decisions resolved:**
- D3-01: Admin section — Conversations goes in **Content** section (alongside Accommodations, Destinations, Posts, Events)
- D3-02: Token renewal page — standalone at `/[lang]/guest/messages/request-access` (not inline in error page)
- D3-03: Block permissions — single PATCH /status endpoint with conditional permission checks based on target status

**External service verification:**
- `jose` library API: `SignJWT`, `jwtVerify`, `setProtectedHeader`, `setExpirationTime` confirmed correct (web search)
- `jose` transitive availability: confirmed at `node_modules/jose@6.1.3` via `better-auth` dependency chain
- `SidebarItemType`: confirmed as type alias `'link' | 'action' | 'separator' | 'group'`, NOT an interface
- `SidebarItem`: confirmed as the correct interface at `apps/admin/src/lib/sections/types.ts:23`
- `BaseModelImpl`: confirmed as the model base class at `packages/db/src/base/base.model.ts:60`
- `packages/db/src/models/`: confirmed as the model layer location (41 files across 11 entity directories)
- `feature.permissions.ts`: confirmed as codebase pattern for permission check functions in service-core
- Content section: confirmed at `apps/admin/src/config/sections/content.section.tsx` with 7 sidebar groups
- `accommodations.ownerId`: confirmed at `packages/db/src/schemas/accommodation/accommodation.dbschema.ts:51` (FK to users.id)

### Revision 4 (2026-04-19) — Fourth Exhaustive Audit Pass

**Auditor**: Claude (automated codebase verification via 8 parallel subagents + external library documentation validation)

**Summary**: 21 corrections applied across 3 user-resolved design decisions, 3 critical production-readiness gaps, 9 medium clarifications, and 6 minor precision fixes. Pass count: **4 total audit passes**.

**Design decisions resolved (user-confirmed):**
- D4-01: **Error codes pattern** — Reframe as **response-level reason codes** alongside HTTP status. Do NOT add entity-specific values to `ServiceErrorCode`. Responses include an `error.reason` string (e.g., `"TOKEN_EXPIRED"`) alongside the generic `error.code` (`"UNAUTHORIZED"`).
- D4-02: **Email dispatch mechanism** — Conversation emails bypass `NotificationService` and use the Resend client from `packages/email/src/send.ts` directly. The cron job already owns scheduling and idempotency; the notification preferences machinery is unnecessary for always-sent conversation emails.
- D4-03: **`messageId` in protected initiate response** — Changed from optional (`messageId?: uuid`) to required (`messageId: uuid`). The field is always present on both create and append paths.

**Critical production-readiness gaps:**
- C4-01: Added `apps/api/vercel.json` to modified files with explicit cron entries for `conversation-notification`, `conversation-token-reminder`, and `conversation-token-cleanup`. Without this, production would silently never run the cron jobs.
- C4-02: Added `apps/web/src/components/accommodation/OwnerCard.astro` to modified files. Current code wraps `OwnerContact` in `{userId && (...)}` and shows a "Register to Contact" CTA for anonymous users. `ContactHost` must render for ALL visitors, so the conditional must be removed and the CTA replaced.
- C4-03: Added `apps/web/src/lib/routes.ts` to modified files. The `/guest/` path is not in `SESSION_OPTIONAL_SEGMENTS`, so the web middleware would otherwise block anonymous token access. `mi-cuenta` is already protected, which is correct.

**Medium clarifications:**
- M4-01: Added thread pagination query parameters (`cursor` ISO-8601 + `limit` 1..100) and response shape (`nextCursor`) for `GET /protected/conversations/:id` and `GET /admin/conversations/:id`.
- M4-02: Added `locale` field to protected initiate body and documented the 4-step locale resolution order.
- M4-03: Added a CLOSED-state disambiguation table: CLOSED-by-owner auto-reopens on guest message, CLOSED-by-accommodation-soft-delete rejects with 410. The `accommodations.deleted_at` check at `MessageService` overrides the state transition.
- M4-04: Added the exact token generation recipe: `crypto.randomBytes(16).toString('hex')` (128 bits, URL-safe hex). Documented why `crypto.randomUUID()` is insufficient.
- M4-05: Added parsing rules for `HOSPEDA_MESSAGING_BLOCKED_WORDS` / `_DOMAINS` (trim, skip empty, lower-case once at startup) and the requirement that empty/absent env vars must not throw.
- M4-06: Documented the notification cron's recipient-email resolution: owner via `accommodations.owner_id → users.email`, authenticated guest via `users.email`, anonymous guest via `conversations.anonymous_email`.
- M4-07: Added a Soft-Delete Cascade section specifying the four-step transactional cascade `ConversationService.softDelete()` must perform, because `onDelete: CASCADE` only fires on hard deletes.
- M4-08: Added idempotency requirements for the verification endpoint: re-entries after the conversation has already moved past `PENDING_VERIFICATION` must generate a fresh access token and redirect (no duplicate rows, no error for the user).
- M4-09: Added explicit polling scope: only the admin panel polls (unread-count, 30s). Guest thread views do not poll in MVP (WebSocket is a Non-Goal).

**Minor precision fixes:**
- S4-01: Tightened `jose` dependency note: version `^6.1.0` range, currently pinned to 6.1.3 via `better-auth@1.4.18` transitive, 6.2.x compatible.
- S4-02: Added Email Dispatch Mechanism section spelling out `@react-email/render` + `packages/email/src/send.ts` + i18n subject lines.
- S4-03: Added Notification Preferences section confirming always-sent semantics in MVP (no new `NotificationType`/`NotificationCategory` values required).
- S4-04: Added Cron Authentication section confirming reuse of existing `HOSPEDA_CRON_SECRET` middleware.
- S4-05: Added AccountLayout usage requirement for `/mi-cuenta/messages/*` pages; `BaseLayout` for anonymous `/guest/messages/*` pages.
- S4-06: Consolidated partial unique indexes into a single manual migration SQL file, including the previously-missing `conv_notif_schedules_conversation_recipient_unique`.

**External service verification (new/re-confirmed this pass):**
- `jose` HS256 signing API re-confirmed via documentation fetch: `new SignJWT(payload).setProtectedHeader({ alg: 'HS256' }).setExpirationTime('24h').sign(secret)` is the correct chain.
- `jose` secret encoding: `new TextEncoder().encode(secretString)` (produces `Uint8Array`) confirmed as the canonical pattern.
- Rate-limit middleware at `apps/api/src/middlewares/rate-limit.ts`: confirmed IP-only, Redis + in-memory fallback, no email-keyed path currently present. Extension required by R3 is non-trivial but well-scoped.
- Cron infrastructure at `apps/api/src/cron/`: confirmed advisory lock pattern (`pg_try_advisory_xact_lock` inside `withTransaction`), confirmed lock IDs 43020-43022 are unused (max existing is 43010), confirmed `HOSPEDA_CRON_SECRET` auth middleware.
- Better Auth `databaseHooks.user.create.after`: re-confirmed at `apps/api/src/lib/auth.ts:443-476`; adding conversation-linking logic is low-complexity (constructor-injected service pattern).
- `OwnerContact.client.tsx` + `OwnerContact.module.css`: confirmed present and in use by `OwnerCard.astro` (with `userId` gate) and `[slug].astro` (with `{userId && ...}` gate). Both gates must be removed when replaced by `ContactHost`.
- `AccountLayout.astro`: confirmed as the layout used by existing `/mi-cuenta/*` pages (favoritos, resenas, suscripcion, preferencias, editar).
- `SESSION_OPTIONAL_SEGMENTS` in `apps/web/src/lib/routes.ts`: confirmed as the middleware control for "session-parsed but not required" path segments.

### Revision 5 (2026-04-19) — Fifth Exhaustive Audit Pass

**Auditor**: Claude (codebase verification via 3 parallel Explore subagents + targeted direct reads of response-helpers, send.ts, rolePermissions seed, advisory-locks doc, and permission enum)

**Summary**: 14 corrections applied — 4 critical (spec claims contradicted by production code), 6 medium (clarifications that remove developer ambiguity), 4 minor precision fixes. 3 design decisions resolved with the user. Pass count: **5 total audit passes**.

**Design decisions resolved (user-confirmed):**

- D5-01: **Role → Permission mapping.** `SUPER_ADMIN` receives all 10 CONVERSATION_* permissions. `ADMIN` receives all 9 except `CONVERSATION_DELETE_ANY` (delete is a moderation-only action). `HOST` receives the 4 `_OWN` permissions. `EDITOR`, `CLIENT_MANAGER`, `SPONSOR`, `USER`, `GUEST` receive none. USER/GUEST ownership of their own conversations is enforced inline in the protected-route handlers via `conversations.user_id = actor.userId`, NOT via a permission check.
- D5-02: **`error.reason` propagation mechanism.** `ServiceError` gains a 4th optional constructor argument `reason?: string`, and the shared response types (`ErrorResponse`, `errorResponseSchema`) gain a matching optional `reason?: string` field. `createErrorResponse` and `handleRouteError` propagate `reason` ALWAYS (independent of `HOSPEDA_API_DEBUG_ERRORS`). Chosen over the `details.reason` alternative because it is type-safe and explicit.
- D5-03: **Email rate-limit factory.** Introduce a NEW `createKeyedRateLimitMiddleware({ requests, windowMs, keyPrefix, keyExtractor })` factory alongside the existing `createPerRouteRateLimitMiddleware`. The email extractor hashes with SHA-256 before use in the Redis key. Endpoints chain both limiters. Chosen over extending the existing factory because it keeps contracts orthogonal and does not couple the two modes.

**Critical fixes (spec was incorrect — verified against code):**

- C5-01: **`sendEmail` signature was wrong in spec.** Spec said `sendEmail({ to, subject, html })` using `@react-email/render` to pre-render HTML. Actual `packages/email/src/send.ts` signature is `sendEmail({ client, to, subject, react, from?, replyTo? })` where `react: ReactElement`. Resend renders the React component internally. `@react-email/render` is only a devDependency of `packages/email` for unit tests; it is NOT used in production. Section "Email Dispatch Mechanism" fully rewritten with the correct flow, including `getResendClient()` and the non-blocking error-handling contract (`{ success, messageId?, error? }`).
- C5-02: **`ResponseFactory.error()` does not exist as a callable.** Spec referenced `ResponseFactory.error()` for emitting error responses. In reality, `ResponseFactory` (`apps/api/src/utils/response-factory.ts`) is a schema generator for OpenAPI only. Runtime error responses are emitted via `createErrorResponse()` in `apps/api/src/utils/response-helpers.ts`, and `handleRouteError()` is the standard ServiceError-to-HTTP mapper. Both references replaced.
- C5-03: **`ServiceError` has no `details.reason` contract.** Spec proposed reading `reason` from `ServiceError.details`, but `createErrorResponse` only propagates `details` when `HOSPEDA_API_DEBUG_ERRORS` is set. Without a first-class change, `reason` would never reach the client in production. Resolved by D5-02 with explicit code changes listed in the "Error Responses and Response-Level Reason Codes" section (ServiceError constructor, createErrorResponse, handleRouteError, errorResponseSchema).
- C5-04: **Role-permission mapping was missing entirely.** New section "Role → Permission Mapping" added under "Permissions" with an explicit per-role matrix and the pointer to `packages/seed/src/required/rolePermissions.seed.ts` where the mapping lives.

**Medium clarifications:**

- M5-01: **Permission enum naming precision.** The original spec text said "UPPER_CASE" without disambiguating keys vs. values. Confirmed against `permission.enum.ts`: keys are `UPPER_SNAKE_CASE`, values are dotted lowercase (e.g. `ACCOMMODATION_VIEW_ALL = 'accommodation.viewAll'`). Clarified in the Permissions section.
- M5-02: **Rate-limit middleware ordering resolved (closes R3).** IP limiter runs pre-validation, email limiter runs post-`zValidator`. Risk R3 moved to Resolved.
- M5-03: **Manual migration numbering made concrete.** Files are now `0015_conversation_partial_indexes.sql` and `0016_messages_body_length_check.sql` (current max in `packages/db/src/migrations/manual/` is `0014_*`). Idempotency and lexicographic ordering of `apply-postgres-extras.sh` documented.
- M5-04: **Schema file split completed.** Added `conversation.query.schema.ts` and `conversation.relations.schema.ts` to the new-files list to match the accommodation entity's 7-file split (was 5 files, now 7 + barrel).
- M5-05: **Admin feature directory structure completed.** Replaced the inline `(hooks, components, types, config)` abbreviation with the full layout used by `apps/admin/src/features/accommodations/` (adds `schemas/`, `utils/`, optional `server/`), with concrete hook and component names.
- M5-06: **Advisory locks registry context added.** Existing lock IDs (43001 addon-expiry, 43010 archive-expired-promotions) explicitly listed so the developer confirms 43020-43022 are free without consulting another file.

**Minor precision fixes:**

- S5-01: Email template implementation notes added — each of the 5 templates must extend `BaseLayout` from `@repo/email/templates/base-layout` for consistent Hospeda branding, and each must define a typed `*Props` interface.
- S5-02: The `sendEmail` non-blocking contract made explicit: the cron handler must inspect `result.success` and NOT advance `streak_count` / `pending_notification_at` on failure so the next tick retries.
- S5-03: R4 (accommodation lifecycle integration point) updated with the preferred direction: `AccommodationService._afterSoftDelete()` invoking `ConversationService.closeAllForAccommodation(accommodationId, tx)` in the same transaction. Still flagged Open for the tech design phase to confirm exact signature but no longer undecided in direction.
- S5-04: `getResendClient()` from `packages/email/src/client.ts` explicitly named as the singleton source for the Resend client. `HOSPEDA_RESEND_API_KEY` env var is the key source (already registered, no new registration needed).

**External service verification (new / re-confirmed this pass):**

- `sendEmail` signature verified against `packages/email/src/send.ts` (lines 10-122): `client: Resend`, `to: string | readonly string[]`, `subject: string`, `react: ReactElement`, `from?: string`, `replyTo?: string`.
- `@react-email/render` v2.0.4 confirmed as devDependency of `packages/email` only (`package.json` line 35). Production dispatch path does NOT pre-render.
- `ResponseFactory` confirmed at `apps/api/src/utils/response-factory.ts` as OpenAPI schema generator (`createCRUDResponses`, `createListResponses`). Runtime helpers live in `response-helpers.ts` (`createResponse`, `createErrorResponse`, `createPaginatedResponse`, `handleRouteError`, `createBulkResponse`, `createAcceptedResponse`, `createNoContentResponse`). The `apps/api/CLAUDE.md` currently documents a `ResponseFactory.success/error/paginated/validationError` pattern that does NOT exist in code — this is a doc drift to be flagged to the team but is not within this spec's scope.
- `ServiceError` constructor at `packages/service-core/src/types/index.ts:168-175`: `(code, message, details?)`. No `reason` field at present — this spec adds it.
- `handleRouteError` at `response-helpers.ts:135-239` confirmed as the standard ServiceError-to-HTTP mapper. Only propagates `details` when `HOSPEDA_API_DEBUG_ERRORS=true`.
- `createKeyedRateLimitMiddleware` does NOT yet exist. `createPerRouteRateLimitMiddleware` at `rate-limit.ts:288-351` accepts only `requests` and `windowMs`. New factory is additive.
- `addon-expiry.job.ts` confirmed as the pattern reference for the new crons. Uses `pg_try_advisory_xact_lock(43001)` inside `withTransaction`. Lock ID matches the advisory-locks registry.
- `packages/seed/src/required/rolePermissions.seed.ts` is the correct file for the new role-permission mappings. `HOST_MESSAGE_SEND` currently lives in 5 roles (SUPER_ADMIN, ADMIN, EDITOR, HOST, USER) and confirms CONVERSATION_* permissions follow the same granularity but with a different role selection per D5-01.
- Permission enum keys/values dichotomy re-confirmed: keys `UPPER_SNAKE_CASE`, values dotted lowercase (`accommodation.create`, `accommodation.viewAll`, `host.message.send`).
