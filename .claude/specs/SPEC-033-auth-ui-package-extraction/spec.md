---
spec-id: SPEC-033
title: "Auth UI Package Extraction"
type: refactor
complexity: high
status: approved
created: 2026-03-06T00:00:00Z
approved: 2026-03-06T00:00:00Z
---

# SPEC-033: Auth UI Package Extraction

## Part 1 -- Functional Specification

### 1. Overview & Goals

#### Goal

Rebuild the `@repo/auth-ui` package from scratch as a collection of **pure React UI components** for authentication flows. The package provides form components, a user button, password strength indicator, theming system, and i18n support. It does NOT include AuthProvider, AuthContext, session management, or permission hooks -- those remain in each consuming app.

#### Motivation

- The current `@repo/auth-ui` package has inconsistent i18n (mix of hardcoded Spanish/English), no theming support, limited OAuth configurability, and no password strength validation
- `apps/admin` has a superior `ChangePasswordForm` with strength indicator that should be shared
- `apps/web-old` has components that duplicate/wrap auth-ui poorly
- Both apps need a unified, well-tested, themeable auth UI layer

#### Success Metrics

- All 8 components render correctly in both admin and web apps
- 90%+ test coverage with a11y validation
- Theming works via CSS variables, className overrides, and optional AuthThemeProvider
- All user-facing text goes through i18n with Spanish fallback
- OAuth providers are fully configurable
- Zero breaking changes in consuming apps (or minimal, documented migration)

#### Target Users

- **Direct consumers**: `apps/admin` (TanStack Start) and `apps/web` / `apps/web-old` (Astro + React islands)
- **End users**: Tourists and accommodation owners authenticating on the platform

### 2. User Stories & Acceptance Criteria

#### US-01: Sign In Form

**As a** developer consuming `@repo/auth-ui`
**I want** a `SignInForm` component that handles email/password login and configurable OAuth
**So that** I can embed a complete sign-in experience anywhere in my app

**Acceptance Criteria:**

```gherkin
Given the SignInForm is rendered with onSignIn and providers props
When the user fills email and password and clicks submit
Then onSignIn is called with { email, password }
And a loading spinner is shown during the request
And on success, onSuccess callback is called (if provided)

Given providers=[{ id: 'google', name: 'Google' }]
When the user clicks the Google OAuth button
Then onOAuthSignIn is called with { provider: 'google', callbackURL }

Given the onSignIn call returns an error
When the error is received
Then the error message is displayed inline with role="alert"
And the form remains filled (no data loss)

Given no providers prop is passed
When the form renders
Then no OAuth buttons are shown
And no divider ("or") is shown

Given classNames={{ button: "custom-btn" }} is passed
When the form renders
Then the submit button has the "custom-btn" class applied

Given the component is server-side rendered
When it hydrates on the client
Then no hydration mismatch occurs
```

#### US-02: Sign Up Form

**As a** developer consuming `@repo/auth-ui`
**I want** a `SignUpForm` component that handles name/email/password registration with optional OAuth
**So that** I can embed a complete registration experience

**Acceptance Criteria:**

```gherkin
Given the SignUpForm is rendered with onSignUp prop
When the user fills name, email, password and submits
Then onSignUp is called with { name, email, password }
And loading state is shown during the request

Given password is less than 8 characters
When the user tries to submit
Then client-side validation prevents submission
And an error message is shown

Given providers are configured
When the form renders
Then OAuth buttons are shown above/below the form with a divider

Given onSignUp returns an error with code "USER_ALREADY_EXISTS"
When the error is received
Then a user-friendly message is displayed (via i18n)
```

#### US-03: Forgot Password Form

**As a** developer consuming `@repo/auth-ui`
**I want** a `ForgotPasswordForm` that lets users request a password reset email
**So that** users can recover their accounts

**Acceptance Criteria:**

```gherkin
Given the ForgotPasswordForm is rendered with onForgotPassword prop
When the user enters their email and submits
Then onForgotPassword is called with { email, redirectTo }
And a success state is shown ("check your email" message)

Given the form is in success state
When the user sees the success message
Then a "Back to sign in" link is shown pointing to signInUrl

Given the email field is empty
When the user tries to submit
Then client-side validation prevents submission

Given all text in the component
When rendered with i18n configured
Then all text uses translation keys
And falls back to Spanish when no translation exists
```

#### US-04: Reset Password Form

**As a** developer consuming `@repo/auth-ui`
**I want** a `ResetPasswordForm` that lets users set a new password using a token
**So that** the password recovery flow is complete

**Acceptance Criteria:**

```gherkin
Given the ResetPasswordForm is rendered with token and onResetPassword props
When the user enters new password and confirmation and submits
Then onResetPassword is called with { newPassword, token }

Given the new password and confirmation do not match
When the user tries to submit
Then a validation error is shown
And the form is not submitted

Given the password is less than 8 characters
When the user tries to submit
Then a validation error is shown

Given the PasswordStrengthIndicator is integrated
When the user types a password
Then the strength indicator updates in real-time

Given the token is expired or invalid
When onResetPassword returns an error
Then the error is displayed with a suggestion to request a new reset link

Given the reset is successful
When the success state is shown
Then a "Sign in" link points to signInUrl
```

#### US-05: Change Password Form

**As a** developer consuming `@repo/auth-ui`
**I want** a `ChangePasswordForm` for authenticated users to change their password with strength validation
**So that** users can update their password securely

**Acceptance Criteria:**

```gherkin
Given the ChangePasswordForm is rendered with onChangePassword prop
When requireCurrentPassword is true (default)
Then a "Current password" field is shown

Given requireCurrentPassword is false
When the form renders
Then only "New password" and "Confirm password" fields are shown

Given the user types a new password
When each character is entered
Then the PasswordStrengthIndicator updates in real-time
And individual rule checkboxes show pass/fail status

Given the new password strength is "very weak" or "weak"
When the user tries to submit
Then submission is prevented with an appropriate error

Given the passwords match and strength is sufficient
When the user submits
Then onChangePassword is called with { currentPassword?, newPassword }

Given the API returns an error (e.g., wrong current password)
When the error is received
Then the error is displayed inline
```

#### US-06: Verify Email

**As a** developer consuming `@repo/auth-ui`
**I want** a `VerifyEmail` component that auto-verifies on mount and shows status
**So that** email verification is seamless

**Acceptance Criteria:**

```gherkin
Given the VerifyEmail is rendered with token and onVerifyEmail props
When the component mounts
Then onVerifyEmail is called with { token }
And a loading state ("Verifying...") is shown

Given verification succeeds
When the success state is shown
Then a success message and checkmark icon are displayed
And auto-redirect happens after redirectDelay ms (default 3000)

Given verification fails
When the error state is shown
Then an error message is displayed
And a suggestion to request a new verification email is shown
And no redirect occurs
```

#### US-07: Password Strength Indicator

**As a** developer consuming `@repo/auth-ui`
**I want** a standalone `PasswordStrengthIndicator` component
**So that** I can use it in any password field across the app

**Acceptance Criteria:**

```gherkin
Given a password string is passed to PasswordStrengthIndicator
When the password changes
Then the strength level updates (very-weak, weak, fair, strong, very-strong)
And the visual bar reflects the level with appropriate color
And individual rule checks are displayed:
  - Minimum length (configurable, default 8)
  - Contains uppercase letter
  - Contains lowercase letter
  - Contains number
  - Contains special character

Given the password is empty
When the indicator renders
Then all rules show as unchecked
And the strength bar is empty/gray

Given classNames.indicator is passed
When the indicator renders
Then custom classes are applied to the container
```

#### US-08: User Button

**As a** developer consuming `@repo/auth-ui`
**I want** a `UserButton` that shows sign-in link when unauthenticated or a user dropdown when authenticated
**So that** I have a single component for the auth state in my header

**Acceptance Criteria:**

```gherkin
Given session is null or undefined
When the UserButton renders
Then a "Sign in" link/button is shown pointing to signInUrl

Given session contains a valid user
When the UserButton renders
Then a user avatar is shown (image or initials fallback)
And clicking the avatar opens a dropdown menu

Given the dropdown is open
When the user sees the menu
Then menuItems are rendered as links
And a "Sign out" button is shown at the bottom

Given the dropdown is open
When the user clicks outside or presses Escape
Then the dropdown closes

Given the user clicks "Sign out"
When the action is triggered
Then onSignOut is called
And the dropdown closes

Given menuItems=[{ label: "My Account", href: "/account", icon: <Icon/> }]
When the dropdown renders
Then items show label, optional icon, and link to href

Given classNames={{ avatar: "custom-avatar", dropdown: "custom-dd" }}
When the component renders
Then custom classes are applied to the appropriate slots
```

#### US-09: Theming

**As a** developer consuming `@repo/auth-ui`
**I want** to customize the visual appearance of all auth components
**So that** they match my app's design system

**Acceptance Criteria:**

```gherkin
Given CSS variables are set on :root
When auth components render
Then they use the CSS variable values for colors, radius, fonts

Given an AuthThemeProvider wraps the components
When theme={{ primaryColor: '#6366f1', radius: '0.75rem' }} is passed
Then CSS variables are injected and components use them

Given neither CSS variables nor AuthThemeProvider are set
When components render
Then default theme (cyan-to-emerald gradient) is applied

Given classNames prop is passed to any component
When the component renders
Then classNames override/extend the default classes per slot

Given darkMode is active (via .dark class or prefers-color-scheme)
When components render
Then dark mode colors are applied
```

#### US-10: i18n

**As a** developer consuming `@repo/auth-ui`
**I want** all auth UI text to be translatable
**So that** the components work in Spanish, English, and Portuguese

**Acceptance Criteria:**

```gherkin
Given @repo/i18n is configured in the app
When auth components render
Then all text uses translation keys from the "auth" namespace

Given @repo/i18n is NOT configured
When auth components render
Then all text falls back to Spanish defaults

Given a translation key with parameters (e.g., "welcome {name}")
When the translation is resolved
Then parameters are interpolated correctly

Given the locale is "en"
When auth components render
Then all text appears in English

Given the locale is "pt"
When auth components render
Then all text appears in Portuguese
```

### 3. UX Considerations

#### User Flows

**Sign In Flow:**
1. User sees email + password fields + optional OAuth buttons
2. User fills fields and submits (or clicks OAuth)
3. Loading state shown on button
4. Success: callback fires, app handles redirect
5. Error: inline error message, form state preserved

**Password Recovery Flow:**
1. User clicks "Forgot password?" link (rendered by consuming app or via `forgotPasswordUrl` prop)
2. ForgotPasswordForm: enter email -> success state ("check your email")
3. User clicks email link -> lands on page with ResetPasswordForm
4. ResetPasswordForm: new password + confirm + strength indicator -> success
5. Link to sign in page

**Change Password Flow (authenticated):**
1. ChangePasswordForm: current password (optional) + new password + confirm
2. Real-time strength indicator with 5 levels and individual rule feedback
3. Submit only if strength >= "fair"
4. Success/error inline

#### Edge Cases

- **Double submit**: Disable button during loading, prevent duplicate calls
- **OAuth popup blocked**: Show helpful error message
- **Token expired**: Show clear error with "request new link" guidance
- **Network timeout**: Show generic error with retry option
- **Password paste**: Allow paste in all password fields (never disable)
- **Autofill**: Ensure browser autofill works correctly with proper `name` and `autoComplete` attributes

#### Error States

All errors are shown inline within the form, never as alerts/modals. Error messages use `role="alert"` for screen readers. Errors clear when the user starts typing again.

#### Loading States

- Submit buttons show a spinner + disabled state
- OAuth buttons show loading state independently
- VerifyEmail shows a full-component loading state

#### Accessibility

- All form inputs have associated `<label>` elements
- Error messages use `role="alert"` and `aria-live="assertive"`
- Password visibility toggle with proper `aria-label`
- Focus management: first input auto-focused, error focuses first invalid field
- All interactive elements are keyboard accessible
- Color contrast meets WCAG 2.1 AA
- Password strength communicated via `aria-valuenow` and `aria-valuetext`

### 4. Out of Scope

- **AuthProvider / AuthContext / session management** -- each app manages its own
- **Permission hooks** (`useHasPermission`, `useUserPermissions`) -- stay in each app
- **Route guards** (`PermissionGate`, `RoutePermissionGuard`) -- app-specific
- **ImpersonationBanner** -- admin-specific
- **Server-side auth** (`fetchAuthSession`, middleware, `Astro.locals`)
- **auth-client.ts** configuration -- each app configures Better Auth independently
- **Astro components** (`.astro` files like `AuthSection.astro`)
- **Full app migration** -- only adapt imports in consuming apps to verify integration
- **Email templates** for password reset/verification
- **OAuth provider management** (adding/removing providers is app config, not UI)
- **Two-factor authentication** UI
- **Social account linking** UI

---

## Part 2 -- Technical Analysis

### 1. Architecture

#### Pattern

Pure React component library with prop-based dependency injection. Components receive auth methods as props and never import Better Auth or any auth client directly. This makes the package framework-agnostic within React (works in Astro islands, TanStack Start, Next.js, etc.).

#### Components

```
@repo/auth-ui
├── Components (8)
│   ├── SignInForm          -- email/password + configurable OAuth
│   ├── SignUpForm          -- name/email/password + OAuth
│   ├── ForgotPasswordForm  -- email input -> success state
│   ├── ResetPasswordForm   -- new password + confirm + strength
│   ├── ChangePasswordForm  -- current + new + confirm + strength
│   ├── VerifyEmail         -- auto-verify on mount
│   ├── PasswordStrengthIndicator -- standalone strength display
│   └── UserButton          -- sign-in link OR user dropdown
├── Sub-components (internal)
│   └── OAuthButtons        -- configurable OAuth button group
├── Hooks (2)
│   ├── useAuthTranslations -- i18n with Spanish fallback
│   └── usePasswordStrength -- password validation logic
├── Utilities (2)
│   ├── getInitials         -- extract initials from name
│   └── getDisplayName      -- fallback chain for display name
├── Theming
│   ├── styles.css          -- CSS variables defaults + dark mode
│   ├── theme.ts            -- AuthTheme type + defaults + CSS var mapping
│   └── AuthThemeProvider   -- optional React context for JS-based theming
├── Types
│   └── types.ts            -- all exported TypeScript interfaces
└── Icons (internal)
    ├── GoogleIcon
    ├── FacebookIcon
    └── GitHubIcon
```

#### Integration Points

- **`@repo/i18n`**: Translation function via `useAuthTranslations` hook
- **`@repo/schemas`**: `PermissionEnum` type import only (not runtime)
- **Consuming apps**: Import components + pass auth client methods as props
- **Tailwind CSS**: Components use Tailwind classes, themed via CSS variables

#### Data Flow

```
App auth-client.ts
    │
    ├── signIn.email(credentials)  ──┐
    ├── signIn.social(provider)    ──┤
    ├── signUp.email(data)         ──┤  Props injected
    ├── forgetPassword(data)       ──┤  into components
    ├── resetPassword(data)        ──┤
    ├── verifyEmail(data)          ──┤
    └── signOut()                  ──┘
                                     │
                              @repo/auth-ui
                              ┌──────┴──────┐
                              │  Component   │
                              │  (pure UI)   │
                              │              │
                              │  state:      │
                              │  - loading   │
                              │  - error     │
                              │  - success   │
                              │              │
                              │  calls prop  │
                              │  on submit   │
                              └──────────────┘
```

### 2. Data Model Changes

**None.** This is a pure UI package with no database interaction.

### 3. API Design

This is not an API -- it's a component library. The "API" is the component props interface.

#### Core Types

```typescript
/** Result from any auth operation */
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

/** OAuth provider configuration */
interface OAuthProvider {
  id: string;
  name: string;
  icon?: React.ReactNode;  // Falls back to built-in icon if id matches google|facebook|github
}

/** Sign-in methods injected from app's auth client */
interface SignInMethods {
  email: (params: { email: string; password: string }) => Promise<AuthResult>;
  social: (params: { provider: string; callbackURL: string }) => Promise<unknown>;
}

/** Sign-up methods injected from app's auth client */
interface SignUpMethods {
  email: (params: {
    email: string;
    password: string;
    name: string;
  }) => Promise<AuthResult>;
}

/** Forgot password method */
type ForgotPasswordMethod = (params: {
  email: string;
  redirectTo: string;
}) => Promise<{
  data?: unknown;
  error?: { message?: string; code?: string } | null;
}>;

/** Reset password method */
type ResetPasswordMethod = (params: {
  newPassword: string;
  token: string;
}) => Promise<{
  data?: unknown;
  error?: { message?: string; code?: string } | null;
}>;

/** Change password method */
type ChangePasswordMethod = (params: {
  currentPassword?: string;
  newPassword: string;
}) => Promise<{
  data?: unknown;
  error?: { message?: string; code?: string } | null;
}>;

/** Verify email method */
type VerifyEmailMethod = (params: {
  token: string;
}) => Promise<{
  data?: unknown;
  error?: { message?: string; code?: string } | null;
}>;

/** Session data for UserButton */
interface AuthSession {
  user: SessionUser;
}

interface SessionUser {
  id: string;
  name?: string | null;
  email: string;
  image?: string | null;
}

/** Menu item for UserButton dropdown */
interface UserMenuItem {
  label: string;
  href: string;
  icon?: React.ReactNode;
}

/** Password strength levels */
type PasswordStrengthLevel =
  | 'very-weak'
  | 'weak'
  | 'fair'
  | 'strong'
  | 'very-strong';

/** Password strength result from usePasswordStrength hook */
interface PasswordStrengthResult {
  level: PasswordStrengthLevel;
  score: number;              // 0-5
  rules: {
    minLength: boolean;
    hasUppercase: boolean;
    hasLowercase: boolean;
    hasNumber: boolean;
    hasSpecialChar: boolean;
  };
}
```

#### Theming Types

```typescript
/** Theme configuration */
interface AuthTheme {
  primaryColor?: string;
  primaryHoverColor?: string;
  errorColor?: string;
  successColor?: string;
  textColor?: string;
  textMutedColor?: string;
  backgroundColor?: string;
  inputBorderColor?: string;
  inputFocusColor?: string;
  radius?: string;
  fontFamily?: string;
}

/** CSS variable mapping (all prefixed with --auth-) */
// --auth-primary, --auth-primary-hover, --auth-error, --auth-success,
// --auth-text, --auth-text-muted, --auth-bg, --auth-input-border,
// --auth-input-focus, --auth-radius, --auth-font-family

/** Per-component className slots */
interface SignInFormClassNames {
  root?: string;
  form?: string;
  input?: string;
  label?: string;
  button?: string;
  oauthButton?: string;
  divider?: string;
  error?: string;
  link?: string;
}

// Similar ClassNames interfaces for each component
```

#### Component Props Summary

```typescript
interface SignInFormProps {
  onSignIn: SignInMethods['email'];
  onOAuthSignIn?: SignInMethods['social'];
  providers?: OAuthProvider[];
  redirectTo?: string;
  signUpUrl?: string;
  forgotPasswordUrl?: string;
  onSuccess?: () => void;
  classNames?: SignInFormClassNames;
}

interface SignUpFormProps {
  onSignUp: SignUpMethods['email'];
  onOAuthSignIn?: SignInMethods['social'];
  providers?: OAuthProvider[];
  redirectTo?: string;
  signInUrl?: string;
  onSuccess?: () => void;
  classNames?: SignUpFormClassNames;
}

interface ForgotPasswordFormProps {
  onForgotPassword: ForgotPasswordMethod;
  redirectTo?: string;
  signInUrl?: string;
  classNames?: ForgotPasswordFormClassNames;
}

interface ResetPasswordFormProps {
  token: string;
  onResetPassword: ResetPasswordMethod;
  signInUrl?: string;
  onSuccess?: () => void;
  minPasswordLength?: number;
  classNames?: ResetPasswordFormClassNames;
}

interface ChangePasswordFormProps {
  onChangePassword: ChangePasswordMethod;
  requireCurrentPassword?: boolean;  // default: true
  minPasswordLength?: number;         // default: 8
  minStrengthLevel?: PasswordStrengthLevel;  // default: 'fair'
  onSuccess?: () => void;
  classNames?: ChangePasswordFormClassNames;
}

interface VerifyEmailProps {
  token: string;
  onVerifyEmail: VerifyEmailMethod;
  redirectTo?: string;
  redirectDelay?: number;  // default: 3000
  onSuccess?: () => void;
  classNames?: VerifyEmailClassNames;
}

interface PasswordStrengthIndicatorProps {
  password: string;
  minLength?: number;  // default: 8
  showRules?: boolean;  // default: true
  classNames?: PasswordStrengthIndicatorClassNames;
}

interface UserButtonProps {
  session?: AuthSession | null;
  isPending?: boolean;
  onSignOut: () => Promise<void> | void;
  signInUrl?: string;
  menuItems?: UserMenuItem[];
  classNames?: UserButtonClassNames;
}
```

### 4. Dependencies

#### Runtime Dependencies (workspace)

| Package | Purpose | Type |
|---|---|---|
| `@repo/i18n` | Translation function | dependency |
| React 18/19 | UI framework | peer dependency |
| React DOM 18/19 | DOM rendering | peer dependency |

#### Dev Dependencies

| Package | Purpose |
|---|---|
| `@repo/typescript-config` | Shared TS config |
| `@repo/biome-config` | Shared linter config |
| `@testing-library/react` | Component testing |
| `@testing-library/jest-dom` | DOM matchers |
| `vitest` | Test runner |
| `@vitest/coverage-v8` | Coverage |
| `axe-core` / `vitest-axe` | Accessibility testing |
| `jsdom` | DOM environment |

#### No New External Dependencies

The package uses only workspace packages and React as peer dependency. No new npm packages needed.

### 5. Risks & Mitigations

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Breaking imports in consuming apps | Medium | High | Export same names as current package. Provide migration guide. Keep old exports as re-exports if needed. |
| Theming CSS variables conflict with app styles | Low | Medium | Prefix all variables with `--auth-`. Document all variables. |
| i18n namespace collision | Low | Low | Use dedicated "auth" namespace in @repo/i18n |
| Tailwind class purging removes auth-ui classes | Medium | High | Document that consuming apps must include auth-ui in Tailwind content config. Consider providing a Tailwind plugin/preset. |
| OAuth icon licensing issues | Low | Low | Use simple, custom SVG icons (not brand assets) or reference brand guidelines |
| Dark mode inconsistency between apps | Medium | Medium | Document dark mode approach. Test in both apps. |

### 6. Performance Considerations

- **Bundle size**: Each component is tree-shakeable via named exports. Apps only bundle what they import.
- **No runtime CSS-in-JS**: Theming uses CSS variables (zero JS overhead) with optional provider for convenience.
- **Hydration**: All components are hydration-safe with `useEffect` guards.
- **Re-renders**: `usePasswordStrength` is memoized. UserButton dropdown state is local.
- **Icons**: Built-in OAuth icons are inline SVGs (small, no external requests).

---

## Implementation Approach

### Phase 1: Setup

1. Clean the existing package directory (remove all current files)
2. Set up package.json, tsconfig.json, vitest.config.ts, CLAUDE.md
3. Create directory structure (src/components, src/hooks, src/utils, src/icons, test)
4. Set up CSS variables stylesheet with defaults and dark mode
5. Define all TypeScript types in types.ts
6. Implement theming system (theme.ts + AuthThemeProvider)

### Phase 2: Core Utilities & Hooks

7. Implement `getInitials` utility
8. Implement `getDisplayName` utility
9. Implement `usePasswordStrength` hook with password validation logic
10. Implement `useAuthTranslations` hook (rewrite with full i18n support)
11. Add i18n translation keys to `@repo/i18n` for auth namespace (es/en/pt)

### Phase 3: Core Components

12. Implement `PasswordStrengthIndicator` component
13. Implement `OAuthButtons` internal component
14. Implement `SignInForm` component
15. Implement `SignUpForm` component
16. Implement `ForgotPasswordForm` component
17. Implement `ResetPasswordForm` component (with PasswordStrengthIndicator)
18. Implement `ChangePasswordForm` component (with PasswordStrengthIndicator)
19. Implement `VerifyEmail` component
20. Implement `UserButton` component
21. Set up index.ts exports

### Phase 4: Testing

22. Test setup (vitest config, test utils, axe setup)
23. Tests for utilities (getInitials, getDisplayName)
24. Tests for usePasswordStrength hook
25. Tests for useAuthTranslations hook
26. Tests for PasswordStrengthIndicator
27. Tests for SignInForm (render, submit, OAuth, errors, loading, a11y)
28. Tests for SignUpForm (render, submit, validation, errors, a11y)
29. Tests for ForgotPasswordForm (render, submit, success state, a11y)
30. Tests for ResetPasswordForm (render, submit, validation, token error, a11y)
31. Tests for ChangePasswordForm (render, strength validation, current password, a11y)
32. Tests for VerifyEmail (auto-verify, success, error, redirect, a11y)
33. Tests for UserButton (unauthenticated, authenticated, dropdown, sign out, a11y)
34. Tests for AuthThemeProvider (CSS variable injection, defaults)
35. Verify 90%+ coverage

### Phase 5: Integration

36. Update `apps/web-old` auth component imports
37. Update `apps/admin` auth component imports
38. Verify both apps build successfully
39. Manual smoke test in both apps

### Phase 6: Documentation

40. Write CLAUDE.md for the package
41. Update package README.md
42. Update root CLAUDE.md if needed (dependency table)

### Testing Strategy

#### Unit Tests (per component)

Each component test file covers:
- **Render**: Mounts without errors, shows expected elements
- **Interaction**: Form submission, button clicks, dropdown toggle
- **Validation**: Client-side validation (empty fields, password length, mismatch)
- **Error handling**: API error display, network error handling
- **Loading states**: Button disabled, spinner shown
- **Success states**: Callback called, UI updated
- **Props**: classNames applied, optional props work, defaults applied
- **a11y**: axe-core scan passes, labels present, roles correct, keyboard navigation

#### Hook Tests

- `usePasswordStrength`: All 5 levels, edge cases (empty, max complexity)
- `useAuthTranslations`: With i18n, without i18n (fallback), parameter interpolation

#### Utility Tests

- `getInitials`: Single name, two names, empty, null
- `getDisplayName`: Name present, email fallback, all null

#### Theming Tests

- `AuthThemeProvider`: CSS variables injected correctly
- Default theme applied when no provider
- classNames override defaults
- Dark mode variables applied

#### Coverage Target

90%+ line and branch coverage. All components must pass axe-core a11y checks.
