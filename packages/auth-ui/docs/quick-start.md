# Quick Start

## Installation

Add the package to your app's `package.json`:

```json
{
  "dependencies": {
    "@repo/auth-ui": "workspace:*"
  }
}
```

Then install:

```bash
pnpm install
```

## Prerequisites

1. **Better Auth** must be configured in your app with valid credentials.
2. **Tailwind CSS** must be processing the auth-ui package source files (see [Customization](./guides/customization.md)).
3. **React 19+** is required as a peer dependency.

## Basic Setup

### 1. Create your auth client

Each app creates its own Better Auth client instance:

```ts
// src/lib/auth-client.ts
import { createAuthClient } from 'better-auth/react';

export const authClient = createAuthClient({
  baseURL: import.meta.env.PUBLIC_API_URL
});
```

### 2. Add a sign-in page

```tsx
import { SignInForm } from '@repo/auth-ui';
import { authClient } from '../lib/auth-client';

export function SignInPage() {
  return (
    <div className="max-w-md mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Sign In</h1>
      <SignInForm
        signIn={authClient.signIn}
        redirectTo="/dashboard"
        onSuccess={() => {
          console.log('Signed in successfully');
        }}
      />
    </div>
  );
}
```

### 3. Add a sign-up page

```tsx
import { SignUpForm } from '@repo/auth-ui';
import { authClient } from '../lib/auth-client';

export function SignUpPage() {
  return (
    <div className="max-w-md mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Create Account</h1>
      <SignUpForm
        signUp={authClient.signUp}
        signIn={authClient.signIn}
        redirectTo="/onboarding"
      />
    </div>
  );
}
```

### 4. Add a user menu

```tsx
import { UserMenu } from '@repo/auth-ui';
import { authClient } from '../lib/auth-client';

export function AppHeader() {
  const session = authClient.useSession();

  return (
    <header className="flex items-center justify-between p-4 border-b">
      <div>Logo</div>
      <UserMenu
        session={session.data}
        isPending={session.isPending}
        onSignOut={() => authClient.signOut()}
        dashboardUrl="/dashboard/"
        profileUrl="/profile/"
      />
    </header>
  );
}
```

## Available Components

| Component | Purpose |
|-----------|---------|
| `SignInForm` | Email/password + OAuth login |
| `SignUpForm` | Registration with email/password + OAuth |
| `SignOutButton` | Sign-out trigger |
| `ForgotPasswordForm` | Password reset email request |
| `ResetPasswordForm` | New password form (token-based) |
| `VerifyEmail` | Email verification handler |
| `UserMenu` | Dropdown menu with avatar |
| `SimpleUserMenu` | Inline user info with sign-out |

## Available Hooks

| Hook | Purpose |
|------|---------|
| `useAuthTranslations` | i18n translations with Spanish fallbacks |

## Next Steps

- [Component Reference](./guides/components.md) .. Detailed props and usage for each component
- [Customization](./guides/customization.md) .. Styling, theming, and dark mode support
