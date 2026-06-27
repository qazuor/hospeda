# Feature Flags Cleanup Policy

## Overview

Feature flags are powerful tools for dark launching and kill switch functionality, but they can accumulate technical debt if not properly managed. This document outlines the cleanup policy for orphaned feature flags.

## When to Create a Feature Flag

Create a feature flag when:

1. **Dark Launch**: Developing a feature that needs to be deployed to production but kept hidden until ready.
2. **Kill Switch**: Need an emergency off-switch for a feature that might cause issues in production.
3. **Gradual Rollout**: Testing a feature with specific users or roles before general availability.
4. **A/B Testing**: Comparing different implementations (requires additional analytics setup).

## When to Remove a Feature Flag

Remove a feature flag when:

1. **Feature is GA (Generally Available)**: The feature is enabled for all users and the flag is no longer needed.
2. **Feature is Abandoned**: The feature will never be released and code has been removed.
3. **Flag is Orphaned**: The code that references the flag has been removed, but the flag remains in the database.

## Cleanup Process

### 1. Identify Orphaned Flags

Run the following query to find flags that haven't been toggled in the last 90 days:

```sql
SELECT key, description, created_at, updated_at
FROM feature_flags
WHERE updated_at < NOW() - INTERVAL '90 days'
  AND deleted_at IS NULL
ORDER BY created_at ASC;
```

### 2. Verify Code References

Before deleting a flag, search the codebase for references:

```bash
# Search for flag key usage
grep -r "isEnabled\(['\"]flag_key['\"]" apps/ packages/
grep -r "evaluateFlag\(['\"]flag_key['\"]" apps/ packages/
```

### 3. Check Audit Log

Review the audit log to understand the flag's history:

```bash
# Via API
GET /api/v1/admin/feature-flags/{id}/audit
```

### 4. Delete the Flag

Use the admin panel or API to soft-delete the flag:

```bash
DELETE /api/v1/admin/feature-flags/{id}
```

## Best Practices

### Naming Conventions

- Use lowercase letters, numbers, hyphens, and underscores only
- Be descriptive: `calendar_feature` not `cf1`
- Include domain context: `blog_ai_summary` not just `ai_summary`

### Documentation

Always include a description when creating a flag:

- What feature does it control?
- When should it be removed?
- Who requested it?

### Lifecycle Tracking

Add a comment in code when using a flag:

```typescript
// FLAG: calendar_feature - SPEC-272
// TODO: Remove this flag once calendar is GA (target: Q3 2026)
const isCalendarEnabled = await featureFlagService.isEnabled('calendar_feature', context);
```

### Regular Audits

Schedule quarterly audits to:

1. Review all flags older than 6 months
2. Identify flags without recent audit activity
3. Coordinate with feature owners on removal timeline

## Flag States

| State | Description | Action |
|-------|-------------|--------|
| **Active** | `isActive=true`, `enabled=true` | Monitor usage |
| **Disabled** | `isActive=true`, `enabled=false` | Dark launch mode |
| **Killed** | `isActive=false` | Emergency off - investigate why |
| **Orphaned** | No code references | Schedule for deletion |
| **Deleted** | `deleted_at` is set | Retained for audit history |

## Retention Policy

- **Active flags**: Keep indefinitely while feature is in use
- **Deleted flags**: Retain audit log for 12 months, then hard delete
- **Orphaned flags**: Delete after 30 days of being identified as orphaned

## Responsibilities

| Role | Responsibility |
|------|----------------|
| **Developers** | Add TODO comments, flag creation date, removal criteria |
| **Tech Leads** | Quarterly audits, coordinate flag removal |
| **Product Owners** | Approve flag removal when feature is GA |
| **Admins** | Execute deletion via admin panel |

## Related Documentation

- [SPEC-276](../../.qtm/specs/SPEC-276-feature-flag-system/spec.md) - Feature Flag System Specification
- [API Documentation](../../apps/api/docs/route-architecture.md) - Admin API Routes
- [Admin Panel Guide](../../apps/admin/docs/development/creating-pages.md) - Managing Flags via UI
