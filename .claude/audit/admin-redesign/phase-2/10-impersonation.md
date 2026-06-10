---
audit: impersonation
status: complete
date: 2026-05-21
agent: Explore
---

# Impersonation Feature Audit

## Executive Summary

The Hospeda admin panel implements a user impersonation feature via Better Auth's admin plugin. The feature allows administrators with the `USER_IMPERSONATE` permission to assume another user's identity, experiencing the platform from their perspective. While the implementation is structurally sound with clear visual indicators and session isolation, there are notable safety and audit gaps.

## End-to-End Flow

### 1. Frontend Components

**ImpersonateButton** (`apps/admin/src/features/users/components/ImpersonateButton.tsx`)
- Gated behind `PermissionEnum.USER_IMPERSONATE` permission check via `<PermissionGate>`
- Located on `/access/users/$id` detail page (full variant) and users table (icon variant)
- Shows confirmation dialog before proceeding
- Calls `authClient.admin.impersonateUser({ userId })`
- Clears session storage cache on success to force fresh permission fetch
- Redirects to `/dashboard` to start impersonating from the target user's home view

**ImpersonationBanner** (`apps/admin/src/components/auth/ImpersonationBanner.tsx`)
- Sticky banner at top of layout when `impersonatedBy` is set in auth context
- Styled with amber warning colors (amber-50 background, amber-300 border, amber-900 text)
- Shows icon, message ("Impersonating {userName}"), and "Stop" button
- Displays target user's displayName or email
- Calls `authClient.admin.stopImpersonating()` on stop
- Clears session storage and redirects to `/access/users` list

### 2. Auth Context Integration

**AuthContext** (`apps/admin/src/contexts/auth-context.tsx`)
- Exposes `impersonatedBy` property extracted from Better Auth session: `(session?.session as { impersonatedBy?: string | undefined } | undefined)?.impersonatedBy`
- Passes `impersonatedBy` to context value for consumption by banner
- Session is stored in sessionStorage with 5-minute TTL for caching
- On refresh, re-fetches user session from `/api/v1/public/auth/me` API endpoint

### 3. Better Auth Configuration

**Auth Server** (`apps/api/src/lib/auth.ts`)
- Better Auth admin plugin with `impersonate` statement enabled for `fullAdminRole`
- Admin access control: `SUPER_ADMIN` and `ADMIN` roles have full admin privileges including `impersonate`
- `USER`, `GUEST`, `SPONSOR`, `HOST`, `EDITOR`, `CLIENT_MANAGER` roles have `noAdminRole` (no admin access)
- Session cookie-based with 7-day expiry, 1-day update threshold
- Cross-subdomain cookies enabled for SSO (scoped to `hospeda.com.ar` in production)

### 4. Database Schema

**Session Table** (`packages/db/src/schemas/user/session.dbschema.ts`)
- Column: `impersonatedBy: text('impersonated_by')` — stores admin's user ID when impersonating
- Managed entirely by Better Auth; not meant for manual updates

### 5. Permission Model

**Permission Enum** (`packages/schemas/src/enums/permission.enum.ts`)
- `USER_IMPERSONATE = 'user.impersonate'` — permission required to start impersonation
- **No separation between start and stop permissions** — same permission grants both actions
- **Seeded only for SUPER_ADMIN role** (`packages/seed/src/required/rolePermissions.seed.ts`)
- ADMIN role does NOT have USER_IMPERSONATE in the seed (only SUPER_ADMIN)

## Critical Audit Findings

### 1. Permission Gates & Privilege Escalation Risk

**Gap Identified**: No privilege escalation prevention
- ImpersonateButton only checks `USER_IMPERSONATE` permission
- **NO check prevents a SUPER_ADMIN from impersonating another SUPER_ADMIN**
- **NO check prevents impersonating users with equal or higher roles**
- A SUPER_ADMIN could impersonate another SUPER_ADMIN to hide audit trail (see below)

**Safety Rail Status**: MISSING

### 2. Audit Logging

**Gap Identified**: No explicit impersonation audit log
- The `session.impersonatedBy` field tracks the relationship in the database
- **No dedicated audit log table or entries for who impersonated whom, when, and for how long**
- No timestamp on impersonation start/stop actions
- No audit trail of actions taken during impersonation
- Better Auth's session hooks do not trigger audit logging on impersonate/stopImpersonating

**Audit Trail**: ABSENT
- Impersonation can only be reconstructed by querying session records and checking `impersonatedBy` field
- No metadata about why, when it started, or when it ended
- No correlation with API requests made during the impersonated session

### 3. Permissions During Impersonation

**Implementation**: During impersonation, the admin acts with the **target user's permissions**, not their own
- Session API calls `/api/v1/public/auth/me` which returns the impersonated user's permissions
- AuthContext stores and uses target user's permissions for all checks
- This is the correct behavior (must respect target user's privilege boundaries)

**Risk**: If a lower-privilege user gains `USER_IMPERSONATE` permission, they could impersonate higher-privilege users and see (but not act beyond) those users' data due to permission checks. However, they can explore the UI/API surface available to that user.

### 4. Session Isolation

**Positive**: Impersonation uses session-level isolation
- Stored in `session.impersonatedBy` field (per session, not per user)
- Separate sessions can run simultaneously (admin's real session vs. impersonated session)
- SessionStorage cache is cleared to force re-fetch of target user's permissions
- Redirect to dashboard ensures fresh page load under new permissions

**Risk**: No explicit session timeout on impersonation end. If a session is abandoned (browser tab closed), the impersonation remains in the database until the session naturally expires.

### 5. Visual Indicator Quality

**Good**: 
- Sticky amber banner with warning icon at top of layout
- Cannot be dismissed (no close-without-stopping option)
- Shows target user identifier (displayName or email)
- Clear "Stop" button with amber styling

**Risk**: 
- Banner only renders in admin panel
- If admin opens target user's public-facing pages (e.g., their host dashboard on `/web`), **no warning** that they're impersonating
- Could lead to confusion or accidental actions on behalf of target user

### 6. Impersonation Starting Point

**Issue**: No privilege-based restrictions on who can be impersonated
- ImpersonateButton appears on every user profile (gated only by USER_IMPERSONATE permission)
- No check: "Is the target user a SUPER_ADMIN? Deny impersonation from ADMIN."
- Consequence: Any admin can impersonate any other admin if they have USER_IMPERSONATE

## Permission Assignment

From seed data:
- **SUPER_ADMIN**: `USER_IMPERSONATE` ✓
- **ADMIN**: `USER_IMPERSONATE` ✗ (not in seed; must be manually granted)
- All other roles: No access to impersonation

## Best Practice Violations

1. **Privilege Hierarchy Not Enforced**: Should prevent lower-rank admins from impersonating higher-rank users
2. **No Audit Logging**: Impersonation actions should be logged with timestamps, actor, target, and outcome
3. **No Time Limits**: Impersonation can theoretically last until session expiry (7 days)
4. **Bi-directional Impersonation Possible**: A SUPER_ADMIN can impersonate another SUPER_ADMIN without escalation detection
5. **No Reason Capture**: Admins don't provide or record why they're impersonating a user

## Recommendations (Priority Order)

1. **Create Impersonation Audit Log**
   - Table: `impersonation_logs` with `admin_id`, `target_user_id`, `started_at`, `stopped_at`, `reason`, `actions_count`
   - Log start/stop events to capture timeline
   - Include optional `reason` field in impersonate dialog

2. **Add Privilege Escalation Guards**
   - Block impersonation if target user's role rank >= admin user's rank
   - Define role hierarchy: SUPER_ADMIN > ADMIN > others
   - Show user role on impersonate button

3. **Extend ImpersonationBanner to Web**
   - Render banner across all subdomains when `impersonatedBy` is set
   - Use shared auth context or session cookie to propagate state
   - Ensures admin always knows they're impersonating

4. **Add Impersonation Time Limits**
   - Enforce max duration (e.g., 2 hours) with countdown in banner
   - Auto-stop if admin logs out
   - Log time spent impersonating

5. **Enhance Session Cleanup**
   - On stopImpersonating, explicitly invalidate impersonated session
   - Currently relies on session expiry; should revoke immediately
   - Prevents session resurrection if cookie leaks

## Conclusion

The impersonation feature is functionally complete with good UI/UX for normal use. However, it lacks audit trail, privilege escalation protection, and time limits. The absence of an impersonation log is the most critical gap for compliance and forensic investigation. A malicious admin could impersonate others and cover their tracks since there's no record of when/what they accessed.

**Audit Status**: REQUIRES REMEDIATION before production compliance audit.
