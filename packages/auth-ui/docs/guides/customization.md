# Customization

## Tailwind CSS Configuration

All auth-ui components use Tailwind CSS classes. The consuming app must include the package source in its Tailwind content configuration so that classes are not purged.

### Tailwind v4 (CSS-based config)

```css
/* In your app's main CSS file */
@import 'tailwindcss';
@source "../../packages/auth-ui/src/**/*.{ts,tsx}";
```

### Tailwind v3 (JS-based config)

```js
// tailwind.config.js
module.exports = {
  content: [
    './src/**/*.{ts,tsx}',
    '../../packages/auth-ui/src/**/*.{ts,tsx}'
  ]
};
```

## Styling Approaches

### Container Wrapping

The simplest way to customize appearance is wrapping components in a styled container:

```tsx
import { SignInForm } from '@repo/auth-ui';

<div className="bg-white p-8 rounded-lg shadow-lg max-w-md mx-auto">
  <SignInForm signIn={authClient.signIn} redirectTo="/dashboard" />
</div>
```

### className Prop

The `SignOutButton` component accepts a `className` prop for direct style override:

```tsx
import { SignOutButton } from '@repo/auth-ui';

<SignOutButton
  isAuthenticated={true}
  onSignOut={() => authClient.signOut()}
  className="px-3 py-1 text-sm text-gray-600 hover:text-red-600 transition-colors"
/>
```

### Page-Level Layout

For sign-in/sign-up pages, control the surrounding layout:

```tsx
export function AuthPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-cyan-50 to-emerald-50">
      <div className="w-full max-w-md p-8 bg-white rounded-2xl shadow-xl">
        <div className="text-center mb-8">
          <img src="/logo.svg" alt="Hospeda" className="h-12 mx-auto" />
          <h1 className="text-xl font-semibold mt-4">Welcome Back</h1>
        </div>
        <SignInForm signIn={authClient.signIn} redirectTo="/dashboard" />
      </div>
    </div>
  );
}
```

## Dark Mode

Components use Tailwind utility classes that respond to dark mode. The exact behavior depends on your app's dark mode configuration.

### Using Tailwind dark mode

```css
/* The Hospeda web app uses data-theme attribute */
[data-theme="dark"] {
  /* Components will pick up dark mode variables */
}
```

### Manual dark wrapper

```tsx
<div className="dark">
  <SignInForm signIn={authClient.signIn} />
</div>
```

Components use colors like `bg-white`, `text-gray-700`, `border-gray-300` which can be overridden by dark mode variants in your Tailwind theme.

## Component Colors

The sign-in and sign-up forms use a cyan-to-emerald gradient for the submit button:

```
background: linear-gradient(to right, #0891b2, #059669)
```

This matches the Hospeda brand. The gradient is applied via inline styles, so overriding it requires wrapping the component or using CSS specificity.

### OAuth Button Styles

- **Google**: White background with gray border, Google brand colors
- **Facebook**: Blue background (`#1877F2`) per Facebook brand guidelines

These are intentionally hardcoded to comply with OAuth provider brand requirements.

## Translation Customization

Auth components use the `auth-ui` namespace from `@repo/i18n`. To customize labels:

1. Edit the translation files in `packages/i18n/src/locales/{locale}/auth-ui.json`
2. Keys are structured as `auth-ui.{section}.{key}`, for example:
   - `auth-ui.signIn.email`
   - `auth-ui.signUp.signUpButton`
   - `auth-ui.userMenu.signOut`

See [i18n documentation](../../../i18n/docs/guides/adding-translations.md) for details on adding or modifying translations.

## Hiding OAuth Buttons

Both `SignInForm` and `SignUpForm` accept a `showOAuth` prop:

```tsx
<SignInForm
  signIn={authClient.signIn}
  showOAuth={false}  // Only show email/password
/>
```

## Building Custom Auth Flows

You can compose auth-ui components into custom flows:

```tsx
import { useState } from 'react';
import { SignInForm, SignUpForm, ForgotPasswordForm } from '@repo/auth-ui';

type AuthMode = 'signin' | 'signup' | 'forgot';

export function AuthFlow() {
  const [mode, setMode] = useState<AuthMode>('signin');

  return (
    <div className="max-w-md mx-auto p-6">
      {mode === 'signin' && (
        <>
          <SignInForm signIn={authClient.signIn} redirectTo="/dashboard" />
          <div className="mt-4 text-center text-sm">
            <button onClick={() => setMode('forgot')} className="text-cyan-600">
              Forgot password?
            </button>
            <span className="mx-2">|</span>
            <button onClick={() => setMode('signup')} className="text-cyan-600">
              Create account
            </button>
          </div>
        </>
      )}

      {mode === 'signup' && (
        <>
          <SignUpForm
            signUp={authClient.signUp}
            signIn={authClient.signIn}
            redirectTo="/onboarding"
          />
          <button onClick={() => setMode('signin')} className="mt-4 text-sm text-cyan-600">
            Already have an account?
          </button>
        </>
      )}

      {mode === 'forgot' && (
        <>
          <ForgotPasswordForm
            onForgotPassword={authClient.forgetPassword}
            redirectTo="/auth/reset-password"
          />
          <button onClick={() => setMode('signin')} className="mt-4 text-sm text-cyan-600">
            Back to sign in
          </button>
        </>
      )}
    </div>
  );
}
```

## Testing with Mocked Auth

For testing, pass mock functions instead of real auth methods:

```tsx
import { SignInForm } from '@repo/auth-ui';

const mockSignIn = {
  email: vi.fn().mockResolvedValue({ data: { user: { id: '1', email: 'test@test.com' } } }),
  social: vi.fn()
};

render(<SignInForm signIn={mockSignIn} />);
```
