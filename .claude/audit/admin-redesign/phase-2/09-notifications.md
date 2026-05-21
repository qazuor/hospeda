---
audit: notifications
status: complete
date: 2026-05-21
agent: Explore
---

# Notifications System End-to-End Audit

## Executive Summary

The Hospeda notifications system is **partially implemented**: Email delivery is fully functional and production-ready with transactional + reminder categories, retry mechanisms, and DB logging. However, **the in-app notification center is completely stubbed**—the `/notifications` route uses localStorage-only fake notifications, the header dropdown shows only a hardcoded "No new notifications" fallback, and no API endpoints exist to fetch real in-app notifications. This creates a visible gap between a sophisticated backend and a disconnected frontend.

---

## 1. Frontend Status

### Header Notification Dropdown
**File:** `/apps/admin/src/components/layout/header/Header.tsx:114-157`

**Status:** STUBBED (hardcoded placeholder)

- Renders a bell icon dropdown button
- Shows **hardcoded text**: "No new notifications" with no API integration
- Links to `/notifications` route
- Zero integration with backend APIs
- No unread count fetching
- State managed locally with `showNotifications` boolean only

**What Works:** UI renders, dropdown toggles, link navigates  
**What's Missing:** Real notification data, API calls, unread badges

### `/notifications` Page Route
**File:** `/apps/admin/src/routes/_authed/notifications.tsx`

**Status:** STUBBED (localStorage-only demo)

- Renders a full notifications page with UI for:
  - List view with badges (success/warning/error/info)
  - Mark as read button
  - Clear all button
  - Empty state
- **Data source**: Only reads/writes from `localStorage` (key: `hospeda-admin-notifications`)
- No database integration
- No API calls
- Notification structure: `{ id, type, message, timestamp, read }`

**What Works:** UI, mark-as-read, clear-all (all localStorage-only)  
**What's Missing:** Real notifications from backend, persistence, multi-tab sync, API integration

---

## 2. Backend API Status

### Admin Notification Logs API
**File:** `/apps/api/src/routes/billing/admin/notifications.ts`

**Endpoint:** `GET /api/v1/admin/billing/notifications`

**Status:** IMPLEMENTED (read-only admin diagnostics)

- Lists `billing_notification_log` table entries (email delivery logs only)
- Query filters: `type`, `status`, `startDate`, `endDate`
- Pagination: `limit`, `offset`
- Response includes: `id`, `type`, `channel`, `recipient`, `subject`, `status`, `sentAt`, `errorMessage`, `metadata`
- Requires permission: `BILLING_READ_ALL`
- Purpose: Admin auditing of **sent emails**, not user-facing notifications

**What Works:** Filtering, pagination, delivery logs  
**What's Missing:** This is for email logs, not in-app notifications. No user-facing API to fetch in-app notifications.

### User Notification Endpoints
**Status:** NOT IMPLEMENTED

No endpoints exist for:
- `GET /api/v1/protected/notifications` (fetch user in-app notifications)
- `POST /api/v1/protected/notifications/:id/read` (mark as read)
- `POST /api/v1/protected/notifications/:id/delete` (dismiss)
- `DELETE /api/v1/protected/notifications` (clear all)

---

## 3. Database Schema

### billing_notification_log Table
**File:** `/packages/db/src/schemas/billing/billing_notification_log.dbschema.ts`

**Purpose:** Email delivery audit log (NOT in-app notifications)

**Columns:**
- `id` (UUID, PK)
- `customerId` (UUID, FK → billing_customers)
- `type` (varchar, e.g., "payment_success", "trial_expired")
- `channel` ('email' always)
- `recipient` (email address)
- `subject` (email subject line)
- `templateId` (notification type identifier)
- `status` ('sent' | 'failed' | 'skipped')
- `sentAt` (timestamp)
- `errorMessage` (text)
- `metadata` (JSONB: userId, recipientName, messageId, category, idempotencyKey)
- `createdAt`, `expiredAt`

**Indexes:** 6 indexes for fast filtering (type, status, customerId, created_at, etc.)

**What Works:** Email delivery tracking with retention policy (purge old entries)  
**What's Missing:** No table for in-app notifications (separate from email logs)

---

## 4. Notification Service (@repo/notifications)

**File:** `/packages/notifications/src/services/notification.service.ts`

**Purpose:** Email notification orchestrator (transactional + reminders)

### Supported Notification Types

**Transactional (always sent, cannot opt-out):**
- `subscription_purchase` → React Email template, logged to DB
- `payment_success` → React Email template, logged to DB
- `payment_failure` → React Email template, logged to DB
- `plan_change_confirmation`
- `addon_renewal_confirmation`

**Reminders (can opt-out via preferences):**
- `renewal_reminder`
- `addon_expiration_warning`
- `addon_expired`
- `trial_ending_reminder`
- `trial_expired`
- `payment_retry_warning`

**Admin (sent to HOSPEDA_ADMIN_NOTIFICATION_EMAILS list):**
- `admin_payment_failure`
- `admin_system_event`

**Other:**
- `feedback_report`
- `contact_submission`
- `subscription_cancelled`, `subscription_paused`, `subscription_reactivated`
- `addon_cancellation`, `plan_downgrade_limit_warning`

### Architecture

- **Email Transport:** Resend API (uses ResendEmailTransport)
- **Retry Mechanism:** Redis-backed exponential backoff (1m → 5m → 25m, 3 max retries)
- **Preference Service:** Checks user opt-outs before sending
- **DB Logging:** Inserts delivery record into `billing_notification_log`
- **Batch Sending:** `sendBatch()` method for sequential processing

### Trigger Points (Where Notifications Are Sent)

**File:** `/apps/api/src/routes/webhooks/mercadopago/notifications.ts`

1. **MercadoPago Webhook** → `sendPaymentSuccessNotification()`
   - Triggered on approved payment
   - Sends `PAYMENT_SUCCESS` email

2. **MercadoPago Webhook** → `sendPaymentFailureNotifications()`
   - Triggered on rejected payment
   - Sends `PAYMENT_FAILURE` to user + `ADMIN_PAYMENT_FAILURE` to admin list
   - Sanitizes error message before sending

3. **Cron Job**: Scheduled renewal/trial/addon expiry checks
   - Sends reminder emails 3/7 days before events
   - Respects user preferences

4. **Subscription Events** (from QZPay middleware)
   - Cancellation, pause, reactivation notifications
   - Plan change confirmations

**What Works:** Email delivery pipeline is solid  
**What's Missing:** In-app notification creation/storage; only email is sent

---

## 5. packages/notifications Package

**Type:** Shared email template + service library

**Dependencies:**
- `@react-email/components` (templates)
- `@react-email/render` (JSX to HTML)
- `ioredis` (retry queue)
- `@repo/db`, `@repo/logger`, `@repo/config`, `@repo/utils`

**Exports:** NotificationService, NotificationType enum, PreferenceService, RetryService, email templates

**What It Does:**
- Compiles React JSX email templates
- Maps notification types → template components
- Handles user preference checks (opt-out categories)
- Logs delivery status to database
- Manages retry queue via Redis

**What It Doesn't Do:**
- In-app notifications (push, SMS, webhooks)
- Multi-channel orchestration beyond email
- User-facing notification center

---

## 6. Integration Checklist

| Component | Status | Works? | Gaps |
|-----------|--------|--------|------|
| Email service (Resend) | ✓ IMPLEMENTED | YES | None |
| DB logging (billing_notification_log) | ✓ IMPLEMENTED | YES | In-app table missing |
| User preferences (opt-out) | ✓ IMPLEMENTED | YES | Only for email |
| Retry mechanism (Redis) | ✓ IMPLEMENTED | YES | N/A |
| Frontend route (/notifications) | ⚠ STUBBED | NO (localStorage only) | API integration, real data |
| Header dropdown | ⚠ STUBBED | NO (hardcoded text) | API integration |
| Admin log viewer | ✓ IMPLEMENTED | YES (email logs) | Confusing with in-app |
| Notification triggers (webhooks) | ✓ IMPLEMENTED | YES (emails only) | In-app create missing |
| Package.json/exports | ✓ IMPLEMENTED | YES | N/A |

---

## 7. End-to-End Status Map

### ✓ WORKS: Email Channel
- Payment events → webhook → NotificationService → Resend API → user email
- Transactional + reminder categories with preference checks
- Retry on failure with exponential backoff
- Full audit trail in `billing_notification_log`

### ⚠ STUBBED: In-App Channel
- No in-app notifications table
- No API to fetch notifications
- No backend logic to create in-app records
- Frontend shows only localStorage demo
- Zero integration from triggers to UI

### ⚠ CONFUSING: Admin Interface
- `GET /api/v1/admin/billing/notifications` shows **email delivery logs**, not actionable alerts
- Admins cannot distinguish between failed emails and other issues
- No alert system for critical events (just logged to email_notification_log)

---

## 8. Minimal Unit of Work to Make In-App Notifications Real

### Phase 0: Schema
1. Create `user_notifications` table:
   ```sql
   CREATE TABLE user_notifications (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     user_id UUID NOT NULL,
     type VARCHAR(100) NOT NULL,
     title VARCHAR(255),
     message TEXT,
     data JSONB,
     read_at TIMESTAMP,
     dismissed_at TIMESTAMP,
     created_at TIMESTAMP DEFAULT NOW(),
     FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
   );
   CREATE INDEX idx_user_notifications_user_id_created_at ON user_notifications(user_id, created_at DESC);
   ```

### Phase 1: API Endpoints
1. `GET /api/v1/protected/notifications`
   - Fetch user's in-app notifications (paginated, sorted by recency)
   - Query params: `read`, `type`, `limit`, `offset`
   - Response: `[{ id, type, title, message, data, read_at, created_at }, ...]`

2. `PATCH /api/v1/protected/notifications/:id`
   - Mark as read: `PATCH /api/v1/protected/notifications/:id` with body `{ read: true }`

3. `DELETE /api/v1/protected/notifications/:id`
   - Dismiss/delete a notification

### Phase 2: Service Layer
1. Add `createInAppNotification(userId, type, title, message, data)` to notification service
2. Update trigger points to call this alongside email:
   ```ts
   await notificationService.send(emailPayload); // email
   await createInAppNotification(userId, type, title, message, data); // in-app
   ```

### Phase 3: Frontend Integration
1. Update `/notifications` route to fetch from `GET /api/v1/protected/notifications`
2. Replace localStorage with API state management
3. Update header dropdown to show unread count + latest 5 notifications
4. Add real-time WebSocket or polling for new notifications

### Effort Estimate
- Phase 0 (schema): 1 PR (migration)
- Phase 1 (API): 1 PR (3–4 endpoints, ~400 LOC)
- Phase 2 (service): 1 PR (call site updates, ~200 LOC)
- Phase 3 (frontend): 1–2 PRs (route + dropdown, ~300 LOC)
- **Total: 4–5 PRs, ~900 LOC backend + 300 LOC frontend, 2–3 days**

---

## 9. Known Issues & Recommendations

1. **Notification Type Enum Mismatch**
   - Frontend uses `'success' | 'warning' | 'error' | 'info'`
   - Backend uses full notification type names ('payment_success', 'trial_expired', etc.)
   - Need a mapping layer

2. **Admin Notification Logs Confusion**
   - `GET /api/v1/admin/billing/notifications` shows email delivery history
   - Should either rename endpoint or create a separate admin notifications (system alerts) endpoint
   - Currently no way to fetch in-app admin alerts

3. **Missing In-App Dismissal**
   - Notifications can be marked as read, but frontend doesn't respect read status
   - No soft-delete (dismissal) concept

4. **No Multi-Channel Coordination**
   - Email goes out immediately
   - In-app would be created only if we add Phase 1+2
   - Consider: should both channels fire for critical events, or in-app only for user-initiated?

5. **Preferences Not Synced**
   - User email preferences live in the billing system (QZPay)
   - In-app preferences would need separate table or unified preferences service
   - Currently only email respects opt-outs

---

## Conclusion

**The email notification system is production-ready and fully integrated.** However, the UI shows only a hardcoded placeholder, with in-app notifications completely missing from the architecture. Adding in-app support requires:
- A new `user_notifications` table
- 3–4 API endpoints
- Service layer integration (1–2 lines per trigger point)
- Frontend integration (localStorage → API)

This is a **2–3 day effort** but represents the smallest meaningful unit of work to move from "demo" to "real notification center."

