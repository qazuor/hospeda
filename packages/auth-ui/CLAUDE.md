# CLAUDE.md - Auth UI Package

> Main docs: See [README.md](./README.md)
> Project docs: See [root CLAUDE.md](../../CLAUDE.md)

## Overview

Shared authentication UI components used by both the web (Astro) and admin (TanStack Start) applications. Built on top of the Better Auth client SDK, providing a consistent auth experience across all frontends.

## Key Files

```
src/
├── index.ts                  # Package entry point (named exports)
├── types.ts                  # Shared auth UI types
├── logger.ts                 # Auth-specific logger instance
├── hooks/                    # Auth hooks (useSession, etc.)
├── sign-in-form.tsx          # Sign-in form component
├── sign-up-form.tsx          # Sign-up form component
├── forgot-password-form.tsx  # Forgot password form
├── reset-password-form.tsx   # Reset password form
├── verify-email.tsx          # Email verification component
├── sign-out-button.tsx       # Sign-out button
├── user-menu.tsx             # Full user menu dropdown
└── simple-user-menu.tsx      # Simplified user menu variant
```

## Usage

```tsx
import { SignInForm, UserMenu, useSession } from '@repo/auth-ui';

// In a React island or TanStack component
export function AuthSection() {
  const { session, user } = useSession();

  if (!session) {
    return <SignInForm redirectUrl="/dashboard" />;
  }

  return <UserMenu user={user} />;
}
```

## Patterns

- All components are React.. they require a `client:*` directive when used in Astro
- Components use Better Auth client SDK for authentication flows
- Forms handle validation, error display, and loading states internally
- Named exports only.. no default exports
- Components must work in both Astro (islands) and TanStack Start contexts
- Use `@repo/i18n` for all user-facing text

## Related Documentation

- `docs/security/authentication.md` - Authentication architecture
- `packages/db/CLAUDE.md` - Database schema for auth tables
