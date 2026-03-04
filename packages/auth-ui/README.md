# @repo/auth-ui

Pre-built authentication UI components for React using Better Auth. Provides ready-to-use sign-in, sign-up, and user menu components with consistent styling and behavior across the Hospeda platform.

## Installation

This package is part of the Hospeda monorepo workspace. Add it as a dependency in your `package.json`:

```json
{
  "dependencies": {
    "@repo/auth-ui": "workspace:*"
  }
}
```

Then run:

```bash
pnpm install
```

## Prerequisites

This package requires Better Auth to be configured in your application:

1. **Better Auth Account**: Sign up at [better-auth.com](https://better-auth.com)
2. **API Keys**: Set up environment variables:

```bash
# .env or .env.local
HOSPEDA_BETTER_AUTH_URL=pk_test_...
HOSPEDA_BETTER_AUTH_SECRET=sk_test_...
```

3. **Better Auth Provider**: Wrap your app with `Better AuthProvider`:

```tsx
import { Better AuthProvider } from '@repo/auth-ui';

export function App() {
  return (
    <Better AuthProvider publishableKey={import.meta.env.HOSPEDA_BETTER_AUTH_URL}>
      {/* Your app */}
    </Better AuthProvider>
  );
}
```

For detailed setup, see [Better Auth React Documentation](https://better-auth.com/docs/quickstarts/react).

## What's Included

### Components

- **SignInForm** - Email/password sign-in form with Better Auth integration
- **SignUpForm** - User registration form with validation
- **SignOutButton** - Sign-out button with callback support
- **SimpleUserMenu** - Basic user menu (name/avatar only)
- **UserMenu** - Full dropdown user menu with settings/sign-out

### Hooks

- **useAuthTranslations** - Translations for auth UI components

## Usage

### SignInForm

Complete sign-in form with email and password:

```tsx
import { SignInForm } from '@repo/auth-ui';

export function LoginPage() {
  return (
    <div className="max-w-md mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Sign In</h1>
      <SignInForm
        onSynced={(dbUserId) => {
          console.log('User synced to database:', dbUserId);
        }}
        apiBaseUrl="http://localhost:3000"
        redirectTo="/dashboard"
        refreshAuthContext={async () => {
          // Optional: Refresh your app's auth context
          await refetchUserData();
        }}
      />
    </div>
  );
}
```

**Props:**

- `onSynced?: (dbUserId: string) => void` - Callback when user is synced to database
- `apiBaseUrl?: string` - API base URL (defaults to `window.location.origin`)
- `redirectTo?: string` - Path to redirect after successful sign-in
- `refreshAuthContext?: () => Promise<void>` - Function to refresh auth context

**Features:**

- Email and password authentication
- OAuth providers (Google, etc.)
- Loading states and error handling
- Automatic database sync
- Form validation
- Internationalization support

### SignUpForm

User registration form with validation:

```tsx
import { SignUpForm } from '@repo/auth-ui';

export function RegisterPage() {
  return (
    <div className="max-w-md mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Create Account</h1>
      <SignUpForm
        onSynced={(dbUserId) => {
          console.log('New user created:', dbUserId);
        }}
        apiBaseUrl="http://localhost:3000"
        redirectTo="/onboarding"
      />
    </div>
  );
}
```

**Props:**

- `onSynced?: (dbUserId: string) => void` - Callback when user is created in database
- `apiBaseUrl?: string` - API base URL
- `redirectTo?: string` - Path to redirect after successful sign-up

**Features:**

- Email, password, and name fields
- Password strength validation
- OAuth provider options
- Email verification
- Automatic database user creation

### SignOutButton

Simple sign-out button:

```tsx
import { SignOutButton } from '@repo/auth-ui';

export function Header() {
  return (
    <nav>
      <SignOutButton
        onSignOut={() => {
          console.log('User signed out');
        }}
        redirectTo="/"
        className="text-sm text-red-600 hover:text-red-700"
      >
        Sign Out
      </SignOutButton>
    </nav>
  );
}
```

**Props:**

- `onSignOut?: () => void` - Callback when sign-out completes
- `redirectTo?: string` - Path to redirect after sign-out
- `className?: string` - Custom CSS classes
- `children?: React.ReactNode` - Button content

### SimpleUserMenu

Basic user menu with name and avatar:

```tsx
import { SimpleUserMenu } from '@repo/auth-ui';

export function Navbar() {
  return (
    <nav className="flex items-center justify-between p-4">
      <div>Logo</div>
      <SimpleUserMenu />
    </nav>
  );
}
```

**Features:**

- User avatar (from Better Auth)
- User name display
- Loading state
- Minimal UI

### UserMenu

Full dropdown menu with user options:

```tsx
import { UserMenu } from '@repo/auth-ui';

export function AppHeader() {
  return (
    <header className="border-b">
      <div className="flex items-center justify-between p-4">
        <div>Logo</div>
        <UserMenu apiBaseUrl="http://localhost:3000" />
      </div>
    </header>
  );
}
```

**Props:**

- `apiBaseUrl?: string` - API base URL for sign-out endpoint

**Features:**

- Dropdown menu
- User avatar and name
- Settings link (Better Auth user profile)
- Sign-out action
- Smooth animations

## Styling

All components use Tailwind CSS classes and are designed to work with the Hospeda design system.

### Customizing Appearance

#### Option 1: Override Tailwind Classes

```tsx
<SignInForm className="custom-class" />
```

#### Option 2: Wrap With Custom Container

```tsx
<div className="bg-white p-8 rounded-lg shadow-lg">
  <SignInForm />
</div>
```

#### Option 3: Use CSS Modules

```tsx
import styles from './auth.module.css';

<div className={styles.authContainer}>
  <SignInForm />
</div>
```

### Dark Mode Support

Components automatically support dark mode when using Tailwind's dark mode:

```tsx
// In your Tailwind config
module.exports = {
  darkMode: 'class',
  // ...
};
```

```tsx
// In your app
<div className="dark">
  <SignInForm />
</div>
```

## Common Patterns

### Protected Routes

```tsx
import { useAuth } from '@repo/auth-ui';
import { Navigate } from 'react-router-dom';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isSignedIn, isLoaded } = useAuth();

  if (!isLoaded) {
    return <div>Loading...</div>;
  }

  if (!isSignedIn) {
    return <Navigate to="/auth/signin" replace />;
  }

  return <>{children}</>;
}
```

### Authentication Flow

```tsx
import { SignInForm, SignUpForm } from '@repo/auth-ui';
import { useState } from 'react';

export function AuthPage() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');

  return (
    <div className="max-w-md mx-auto p-6">
      <div className="flex gap-4 mb-6">
        <button
          onClick={() => setMode('signin')}
          className={mode === 'signin' ? 'font-bold' : ''}
        >
          Sign In
        </button>
        <button
          onClick={() => setMode('signup')}
          className={mode === 'signup' ? 'font-bold' : ''}
        >
          Sign Up
        </button>
      </div>

      {mode === 'signin' ? (
        <SignInForm redirectTo="/dashboard" />
      ) : (
        <SignUpForm redirectTo="/onboarding" />
      )}
    </div>
  );
}
```

### Database User Sync

```tsx
import { SignUpForm } from '@repo/auth-ui';
import { useNavigate } from 'react-router-dom';

export function RegisterPage() {
  const navigate = useNavigate();

  return (
    <SignUpForm
      onSynced={async (dbUserId) => {
        // User is now in your database
        console.log('Database user ID:', dbUserId);

        // Fetch additional user data if needed
        const userData = await fetch(`/api/users/${dbUserId}`).then(r => r.json());

        // Update local state
        updateUserContext(userData);

        // Navigate to next step
        navigate('/onboarding');
      }}
    />
  );
}
```

### Using Better Auth Hooks

```tsx
import { useAuth, useUser } from '@repo/auth-ui';
import { UserMenu } from '@repo/auth-ui';

export function Dashboard() {
  const { isSignedIn, userId } = useAuth();
  const { user, isLoaded } = useUser();

  if (!isLoaded) return <div>Loading...</div>;
  if (!isSignedIn) return <div>Please sign in</div>;

  return (
    <div>
      <header className="flex items-center justify-between">
        <h1>Welcome, {user?.firstName}!</h1>
        <UserMenu />
      </header>

      <main>
        {/* Your dashboard content */}
      </main>
    </div>
  );
}
```

### Handling Auth State

```tsx
import { useAuth } from '@repo/auth-ui';
import { SignInForm } from '@repo/auth-ui';

export function ConditionalAuth() {
  const { isSignedIn, isLoaded } = useAuth();

  // Loading state
  if (!isLoaded) {
    return <div>Loading authentication...</div>;
  }

  // Signed in state
  if (isSignedIn) {
    return <div>You are signed in!</div>;
  }

  // Not signed in state
  return <SignInForm redirectTo="/dashboard" />;
}
```

## Internationalization

Components use `@repo/i18n` for translations. Currently supports Spanish (es).

### Translation Keys

Auth UI components use the `auth-ui` namespace:

```json
{
  "auth-ui": {
    "signIn": {
      "title": "Sign In",
      "email": "Email",
      "password": "Password",
      "submit": "Sign In",
      "or": "or",
      "error": "Invalid email or password"
    },
    "signUp": {
      "title": "Create Account",
      "name": "Full Name",
      "email": "Email",
      "password": "Password",
      "submit": "Create Account"
    },
    "common": {
      "loading": "Loading..."
    }
  }
}
```

### Changing Locale

```tsx
import { useTranslations } from '@repo/i18n';

export function LanguageSwitcher() {
  const { locale, setLocale } = useTranslations();

  return (
    <select value={locale} onChange={(e) => setLocale(e.target.value)}>
      <option value="es">Español</option>
      <option value="en">English</option>
    </select>
  );
}
```

## API Integration

Components expect these API endpoints:

### POST /api/v1/public/auth/signin

Syncs Better Auth user to database on sign-in.

**Request:**

```json
{
  "authUserId": "user_abc123"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "usr_xyz789",
    "authUserId": "user_abc123",
    "email": "user@example.com"
  }
}
```

### POST /api/v1/public/auth/signup

Creates database user on sign-up.

**Request:**

```json
{
  "authUserId": "user_abc123",
  "email": "user@example.com",
  "firstName": "Juan",
  "lastName": "Pérez"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "usr_xyz789",
    "authUserId": "user_abc123",
    "email": "user@example.com"
  }
}
```

### POST /api/v1/public/auth/signout

Cleans up server-side session.

**Request:** Empty body

**Response:**

```json
{
  "success": true
}
```

## Error Handling

Components handle errors gracefully:

```tsx
// Error states are shown inline
<SignInForm />
// Shows "Invalid email or password" if auth fails
```

### Custom Error Handling

```tsx
import { SignInForm } from '@repo/auth-ui';
import { toast } from 'sonner';

export function LoginWithToast() {
  return (
    <SignInForm
      onSynced={() => {
        toast.success('Welcome back!');
      }}
    />
  );
}
```

## Testing

### Mocking Better Auth in Tests

```tsx
import { render, screen } from '@testing-library/react';
import { SignInForm } from '@repo/auth-ui';

// Mock Better Auth hooks
vi.mock('@repo/auth-ui', () => ({
  useAuth: () => ({ isSignedIn: false, isLoaded: true }),
  useSignIn: () => ({
    isLoaded: true,
    signIn: vi.fn(),
    setActive: vi.fn()
  })
}));

test('renders sign in form', () => {
  render(<SignInForm />);
  expect(screen.getByLabelText('Email')).toBeInTheDocument();
});
```

## Dependencies

- **@repo/auth-ui** (^5.40.0+) - Authentication provider
- **react** (^19.0.0) - UI framework
- **@repo/i18n** - Internationalization
- **lucide-react** - Icons

## Related Packages

- [@repo/i18n](../i18n) - Internationalization
- [@repo/auth-ui](https://better-auth.com/docs/references/react/overview) - Better Auth React SDK

## Related Documentation

- [Authentication Guide](../../docs/guides/authentication.md)
- [ADR-002: Better Auth over Clerk](../../docs/decisions/ADR-002-better-auth-over-clerk.md)

## Troubleshooting

### "Better Auth is not loaded"

Make sure `Better AuthProvider` wraps your app:

```tsx
<Better AuthProvider publishableKey={process.env.HOSPEDA_BETTER_AUTH_URL}>
  <App />
</Better AuthProvider>
```

### "User not synced to database"

Check that your API endpoints are working:

```bash
curl -X POST http://localhost:3000/api/v1/public/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"authUserId":"user_123","email":"test@example.com"}'
```

### "Components not styled"

Ensure Tailwind CSS is configured and processing the auth-ui package:

```js
// tailwind.config.js
module.exports = {
  content: [
    './src/**/*.{ts,tsx}',
    '../../packages/auth-ui/src/**/*.{ts,tsx}'
  ]
};
```

## License

MIT
