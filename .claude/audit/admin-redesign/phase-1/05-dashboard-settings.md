---
audit: dashboard-settings
status: complete
date: 2026-05-21
agent: Explore
---

# 05 — Dashboard + user/platform settings

## 1. Dashboard route

**Route:** `apps/admin/src/routes/_authed/dashboard.tsx` + `dashboard.lazy.tsx` (1-169).

**Default authenticated landing.** Currently renders:

- **6 KPI cards** in a grid: accommodations, destinations, events, posts, attractions, users — real-time counts via `useDashboardStats()` (hook at `useDashboardStats.ts:41-48`)
- **Traffic Chart** — marked "Coming Soon" (placeholder via `ComingSoon` component)
- **Recent Activity Feed** — marked "Coming Soon" (placeholder)
- **Refresh Button** — manual cache invalidation via `queryClient.invalidateQueries({ queryKey: ['dashboard'] })`

**Data sources:** each KPI fetches `/api/v1/admin/{entity}?page=1&pageSize=1` and reads `pagination.total`. Queries stale after 5 min. Fetched in parallel via `useQueries()`.

**Role-aware?** No. **ONE-SIZE-FITS-ALL.** No permission-based filtering, no ownership scoping. All users see global counts regardless of permissions.

⚠️ **Bug for HOST-like users:** a user with `accommodation.view.own` only is shown the GLOBAL accommodation count, not their own. The dashboard misleads them.

## 2. Dashboard widget inventory

| Widget | Shows | Data source | Status |
|--------|-------|-------------|--------|
| Accommodations KPI | Total count | `/api/v1/admin/accommodations` | Real |
| Destinations KPI | Total count | `/api/v1/admin/destinations` | Real |
| Events KPI | Total count | `/api/v1/admin/events` | Real |
| Posts KPI | Total count | `/api/v1/admin/posts` | Real |
| Attractions KPI | Total count | `/api/v1/admin/attractions` | Real |
| Users KPI | Total count | `/api/v1/admin/users` | Real |
| Traffic Chart | Visits over time | — | **Placeholder (Coming Soon)** |
| Recent Activity | Audit/admin actions | — | **Placeholder (Coming Soon)** |

## 3. User settings/profile inventory

### Routes
- `/me/profile` — editable personal info (`apps/admin/src/routes/_authed/me/profile.tsx`)
- `/me/settings` — theme, language, notifications (`me/settings.tsx`)
- `/me/change-password` — password change (`me/change-password.tsx`)
- `/me/accommodations` — owner-only view of owned properties
- `/me/tags` — user tag manager

### Editable fields by area

**Personal Info (`/me/profile`):**
- Display Name (required)
- First Name (required)
- Last Name (required)
- Phone (optional, tel format)
- Avatar URL (optional, URL format)
- Bio (optional, textarea)

**Contact Info (read-only):**
- Email (with verification badge)
- Role (display-only badge)

**Web Preferences (`/me/settings`):**
- Theme: system / light / dark (radio)
- Language: es / en / pt (buttons)

**Admin Preferences (`/me/settings`):**
- Theme: system / light / dark
- Language: es / en / pt
- Timezone: auto-detected, read-only badge

**Notifications (`/me/settings`):**
- Enable Notifications (master toggle)
- Allow Email Notifications (child — disabled if master off)
- Allow SMS Notifications (child)
- Allow Push Notifications (child)

**Security (read-only info):**
- Auth Provider info ("Managed via Better Auth")
- Security tip callout

**Password Management (`/me/change-password`):**
- Current Password (required)
- New Password (required, live strength indicator)
- Confirm Password (required, match validation)
- Rules: 8+ chars, upper, lower, number, special

**Owner-only:** `/me/accommodations` lists user's accommodations (`ownerId: [user.id]`) with View/Edit links.

## 4. Platform settings (admin-only)

⚠️ **Fragmented across 3 routes, storage is inconsistent.**

### `/settings/critical`
- Maintenance Mode toggle — **localStorage**
- Global Announcements (display only) — read from localStorage
- Cache Management button → `POST /api/v1/admin/metrics/reset`
- Danger Zone (dev-only stub)

### `/billing/settings`
- **Trial:** duration (days), auto-block on expiry (toggle)
- **Payment:** grace period (days), retry attempts (1-10), retry interval (hours), default currency (ARS)
- **Webhook (read-only):** URL, secret, last received timestamp
- **Notifications:** payment reminders toggle, reminder days before due, receipt on payment toggle
- **Data source:** `useBillingSettingsQuery()` + `useUpdateBillingSettingsMutation()` → `PATCH /api/v1/admin/billing/settings`

### `/settings/seo`
- Meta defaults (title template, default description, default OG image)
- Advanced (sitemap badge enabled, robots.txt badge configured)
- **Storage:** localStorage key `hospeda-admin-seo-settings` — **no backend sync**

### Env-driven (not in UI)
Feature flags, API endpoints, auth URLs, DB config — all via `.env` only.

## 5. What's missing from dashboard

1. **Revenue widget** — no MRR, ARR, revenue trend.
2. **Recent activity feed** — Coming Soon; no audit log of admin actions visible.
3. **Traffic/analytics chart** — Coming Soon; no visitor trends.
4. **Pending approvals widget** — no moderation queue.
5. **System health/status** — no API uptime, DB status, cache hit ratio, error rate.
6. **User registration trend** — no signups over time.
7. **Top performing properties** — no ranking by bookings / reviews / revenue.
8. **Alerts/notifications panel** — no unread / flagged items.
9. **Roles/permissions breakdown** — no visualization of users by role.
10. **Search analytics** — no trending search terms.

## 6. What's missing from user settings

1. **2FA** — no TOTP/SMS, backup codes, device management.
2. **Email/content language preference** — only theme-level language toggles, no email locale.
3. **Manual timezone selection** — auto-detect read-only only.
4. **Global dark mode toggle** — only per-surface (`themeWeb` / `themeAdmin`).
5. **Active sessions / device management** — no session list, no "sign out other devices".
6. **Data export (GDPR)** — none.
7. **Account deletion / deactivation** — none.
8. **Newsletter subscription UI** — `settings.newsletter` boolean exists but no toggle.
9. **Connected apps / OAuth integrations** — none.
10. **Login history** — none.

## Summary

Dashboard is a lightweight KPI overview, NOT permission-aware (shows global counts to everyone). Two of its main spaces are unfinished ("Coming Soon"). User settings cover the basics (theme, language, notifications, password) but lack standard security/privacy controls. Platform settings are scattered across 3 routes with mixed storage (API, localStorage, none). No unified config center.
