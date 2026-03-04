# Component Reference

All components are named exports from `@repo/auth-ui`. They accept auth client methods as props and use Tailwind CSS for styling.

## SignInForm

Email/password sign-in with optional OAuth (Google, Facebook) buttons.

### Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `signIn` | `SignInMethods` | Yes | - | Auth client sign-in methods (`email`, `social`) |
| `redirectTo` | `string` | No | - | URL to redirect after success |
| `onSuccess` | `() => void` | No | - | Callback after successful sign-in |
| `showOAuth` | `boolean` | No | `true` | Show Google/Facebook OAuth buttons |

### SignInMethods Interface

```ts
interface SignInMethods {
  email: (params: { email: string; password: string }) => Promise<AuthResult>;
  social: (params: { provider: string; callbackURL: string }) => Promise<unknown>;
}
```

### Usage

```tsx
import { SignInForm } from '@repo/auth-ui';

<SignInForm
  signIn={authClient.signIn}
  redirectTo="/dashboard"
  onSuccess={() => console.log('Done')}
  showOAuth={true}
/>
```

### Features

- Email/password authentication with validation
- Google and Facebook OAuth buttons
- Loading spinner during authentication
- Inline error display with `role="alert"`
- Hydration-safe rendering (SSR compatible)
- Translations via `useAuthTranslations`

---

## SignUpForm

Registration form with email, password, name fields, and optional OAuth.

### Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `signUp` | `SignUpMethods` | Yes | - | Auth client sign-up methods |
| `signIn` | `Pick<SignInMethods, 'social'>` | Yes | - | OAuth methods (shared with sign-in) |
| `redirectTo` | `string` | No | - | URL to redirect after success |
| `onSuccess` | `() => void` | No | - | Callback after successful registration |
| `showOAuth` | `boolean` | No | `true` | Show OAuth buttons |

### SignUpMethods Interface

```ts
interface SignUpMethods {
  email: (params: {
    email: string;
    password: string;
    name: string;
  }) => Promise<AuthResult>;
}
```

### Usage

```tsx
import { SignUpForm } from '@repo/auth-ui';

<SignUpForm
  signUp={authClient.signUp}
  signIn={authClient.signIn}
  redirectTo="/onboarding"
/>
```

---

## SignOutButton

Simple button that triggers sign-out with optional redirect.

### Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `isAuthenticated` | `boolean` | Yes | - | Current auth state (renders nothing if false) |
| `onSignOut` | `() => Promise<void>` | Yes | - | Sign-out handler |
| `onComplete` | `() => void` | No | - | Callback after sign-out completes |
| `className` | `string` | No | Default red button styles | Custom CSS classes |
| `redirectTo` | `string` | No | - | URL to redirect after sign-out |

### Usage

```tsx
import { SignOutButton } from '@repo/auth-ui';

<SignOutButton
  isAuthenticated={!!session}
  onSignOut={() => authClient.signOut()}
  redirectTo="/"
  className="text-sm text-red-600 hover:text-red-700"
/>
```

---

## ForgotPasswordForm

Email input that triggers a password reset email.

### Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `onForgotPassword` | `(params: { email: string; redirectTo: string }) => Promise<...>` | Yes | - | Password reset request handler |
| `redirectTo` | `string` | No | - | Reset page URL included in the email |
| `signInUrl` | `string` | No | - | Link back to sign-in page |

### Usage

```tsx
import { ForgotPasswordForm } from '@repo/auth-ui';

<ForgotPasswordForm
  onForgotPassword={authClient.forgetPassword}
  redirectTo="/auth/reset-password"
  signInUrl="/auth/signin"
/>
```

### Behavior

- Shows email input form initially
- After successful submission, displays a success message
- Provides a link back to the sign-in page

---

## ResetPasswordForm

New password form that requires a token from the reset email.

### Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `token` | `string` | Yes | - | Token from the password reset URL |
| `onResetPassword` | `(params: { newPassword: string; token: string }) => Promise<...>` | Yes | - | Reset handler |
| `signInUrl` | `string` | No | - | Link to sign-in after reset |
| `onSuccess` | `() => void` | No | - | Callback after successful reset |

### Usage

```tsx
import { ResetPasswordForm } from '@repo/auth-ui';

// Token extracted from URL query params
const token = new URLSearchParams(window.location.search).get('token');

<ResetPasswordForm
  token={token}
  onResetPassword={authClient.resetPassword}
  signInUrl="/auth/signin"
/>
```

---

## VerifyEmail

Email verification handler that auto-verifies on mount.

### Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `token` | `string` | Yes | - | Verification token from URL |
| `onVerifyEmail` | `(params: { token: string }) => Promise<...>` | Yes | - | Verification handler |
| `redirectTo` | `string` | No | - | URL to redirect after success |
| `redirectDelay` | `number` | No | - | Delay (ms) before auto-redirect (0 to disable) |
| `onSuccess` | `() => void` | No | - | Callback after verification |

### Usage

```tsx
import { VerifyEmail } from '@repo/auth-ui';

<VerifyEmail
  token={tokenFromUrl}
  onVerifyEmail={authClient.verifyEmail}
  redirectTo="/dashboard"
  redirectDelay={3000}
/>
```

### Behavior

- Calls `onVerifyEmail` automatically on mount
- Shows loading, success, or error states
- Auto-redirects after configurable delay on success

---

## UserMenu

Dropdown menu with user avatar, navigation links, and sign-out.

### Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `session` | `AuthSession \| null` | Yes | - | Current session data |
| `isPending` | `boolean` | No | `false` | Show loading skeleton |
| `onSignOut` | `() => Promise<void>` | Yes | - | Sign-out handler |
| `dashboardUrl` | `string` | No | `'/dashboard/'` | Dashboard link URL |
| `profileUrl` | `string` | No | `'/profile/'` | Profile link URL |

### Usage

```tsx
import { UserMenu } from '@repo/auth-ui';

<UserMenu
  session={session}
  isPending={isLoading}
  onSignOut={() => authClient.signOut()}
  dashboardUrl="/admin/dashboard"
  profileUrl="/admin/profile"
/>
```

### Features

- User avatar with initials fallback
- Dropdown with dashboard and profile links
- Sign-out action
- Loading skeleton while session loads
- Click-outside to close

---

## SimpleUserMenu

Compact inline display showing user info and sign-out.

### Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `session` | `AuthSession \| null` | Yes | - | Current session data |
| `isPending` | `boolean` | No | `false` | Show loading state |
| `onSignOut` | `() => Promise<void>` | Yes | - | Sign-out handler |
| `redirectTo` | `string` | No | `'/'` | URL to redirect after sign-out |

### Usage

```tsx
import { SimpleUserMenu } from '@repo/auth-ui';

<SimpleUserMenu
  session={session}
  onSignOut={() => authClient.signOut()}
  redirectTo="/"
/>
```

### Behavior

- When authenticated: shows user name/avatar and sign-out button inline
- When not authenticated: shows sign-in/sign-up links

---

## Shared Types

### AuthResult

```ts
interface AuthResult {
  data?: {
    session?: { id: string };
    user?: { id: string; name?: string; email: string };
  } | null;
  error?: {
    message?: string;
    code?: string;
    status?: number;
  } | null;
}
```

### AuthSession

```ts
interface AuthSession {
  user: SessionUser;
}
```

### SessionUser

```ts
interface SessionUser {
  id: string;
  name?: string | null;
  email: string;
  image?: string | null;
}
```

## useAuthTranslations Hook

Wraps `@repo/i18n` with fallback Spanish translations. Safe to use even when i18n is not configured.

```ts
import { useAuthTranslations } from '@repo/auth-ui';

const { t, isI18nAvailable } = useAuthTranslations();

t('auth-ui.signIn.email'); // "Correo electronico" (from i18n or fallback)
```

Translation keys are prefixed with `auth-ui.` and organized by section: `signIn`, `signUp`, `userMenu`, `signOut`, `common`.
