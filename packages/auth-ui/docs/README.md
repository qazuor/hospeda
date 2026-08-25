# @repo/auth-ui Documentation

## Overview

`@repo/auth-ui` provides pre-built authentication UI components for React, built on top of Better Auth. It delivers ready-to-use sign-in, password reset, email verification, and user menu components with consistent styling and behavior across the Hospeda platform.

## Purpose

The package solves two problems:

1. **Consistency** .. All apps in the monorepo (admin, web) share the same authentication UI, ensuring a uniform look and feel.
2. **Decoupling** .. Components accept auth client methods as props rather than importing the auth client directly. This makes them testable and reusable across different Better Auth configurations.

## Package Structure

```
packages/auth-ui/
├── src/
│   ├── index.ts                 # Public exports
│   ├── types.ts                 # Shared TypeScript interfaces
│   ├── logger.ts                # Auth-specific logger
│   ├── sign-in-form.tsx         # Email/password + OAuth sign-in
│   ├── sign-out-button.tsx      # Sign-out button
│   ├── forgot-password-form.tsx # Password reset request
│   ├── reset-password-form.tsx  # New password form (token-based)
│   ├── verify-email.tsx         # Email verification handler
│   ├── simple-user-menu.tsx     # Compact user info + sign-out
│   ├── user-menu.tsx            # Dropdown user menu
│   └── hooks/
│       └── use-auth-translations.ts # i18n hook with fallbacks
└── docs/
    ├── README.md                # This file
    ├── quick-start.md           # Getting started guide
    └── guides/
        ├── components.md        # Component reference
        └── customization.md     # Theming and styling
```

## Key Concepts

### Prop-Based Auth Client Injection

Components do **not** import Better Auth directly. Instead, the consuming app passes auth methods as props:

```tsx
import { SignInForm } from '@repo/auth-ui';
import { authClient } from './auth-client'; // App-specific

<SignInForm signIn={authClient.signIn} redirectTo="/dashboard" />
```

This design allows each app to configure Better Auth independently while reusing the same UI.

### Translation Fallbacks

The `useAuthTranslations` hook wraps `@repo/i18n` with built-in Spanish fallbacks. If i18n is not configured in the consuming app, components still render correctly with hardcoded Spanish strings.

### Session Types

All components use shared types (`AuthSession`, `SessionUser`, `AuthResult`) defined in `types.ts`, ensuring type safety across the auth flow.

## Documentation Index

| Document | Description |
|----------|-------------|
| [Quick Start](./quick-start.md) | Installation and first usage |
| [Components](./guides/components.md) | Full component API reference |
| [Customization](./guides/customization.md) | Styling, theming, and dark mode |

## Related Resources

- [Authentication Guide](../../../docs/security/authentication.md)
- [@repo/i18n](../../i18n/docs/README.md) .. Translations used by auth components
- [Better Auth Documentation](https://www.better-auth.com/docs)
