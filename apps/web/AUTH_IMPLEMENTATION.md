# Authentication Implementation - Astro Portal

## 🎯 Overview

This document describes the authentication system implementation for the Astro portal (`apps/web`) using `@repo/auth-ui` and Clerk.

## 🏗️ Architecture

### Components Used

1. **`@repo/auth-ui`** - Shared authentication UI components
2. **`@clerk/astro`** - Astro integration for Clerk
3. **`@clerk/clerk-react`** - React components for client-side auth

### Integration Points

- **Server-side**: Clerk middleware in `src/middleware.ts`
- **Client-side**: React islands with `client:load` directive
- **API Integration**: Sync with backend API at `/api/v1/public/auth/sync`

## 📁 File Structure

```
apps/web/src/
├── components/auth/
│   ├── AuthProvider.tsx     # Global Clerk provider
│   ├── ClerkRoot.tsx        # Alternative provider
│   └── UserNav.tsx          # Navigation auth controls
├── pages/auth/
│   ├── signin.astro         # Sign-in page
│   ├── signup.astro         # Sign-up page
│   └── callback.astro       # OAuth callback handler
├── pages/
│   ├── dashboard.astro      # Protected dashboard
│   └── profile.astro        # User profile page
└── middleware.ts            # Clerk server middleware
```

## 🔧 Configuration

### Environment Variables

```bash
# Required for Clerk integration
PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# API integration
PUBLIC_API_BASE_URL=http://localhost:3002
```

### Astro Config

```javascript
// astro.config.mjs
import clerk from '@clerk/astro';

export default defineConfig({
  integrations: [
    clerk(), // Clerk integration
    react(), // Required for auth components
    // ... other integrations
  ],
  vite: {
    resolve: {
      alias: {
        '@repo/auth-ui': new URL('../../packages/auth-ui/src', import.meta.url).pathname,
        // ... other aliases
      }
    }
  }
});
```

## 🎨 Components

### SignInForm

```astro
---
import { SignInForm } from '@repo/auth-ui';
---

<SignInForm 
  client:load
  apiBaseUrl={import.meta.env.PUBLIC_API_BASE_URL}
  redirectTo="/"
/>
```

**Features:**
- OAuth (Google, Facebook)
- Email/password authentication
- API sync after successful auth
- Automatic redirection

### SignUpForm

```astro
---
import { SignUpForm } from '@repo/auth-ui';
---

<SignUpForm 
  client:load
  apiBaseUrl={import.meta.env.PUBLIC_API_BASE_URL}
  redirectTo="/"
/>
```

**Features:**
- OAuth (Google, Facebook)
- Email/password registration
- Email verification flow
- API sync after successful registration

### UserNav

```astro
---
import { UserNav } from '../components/auth/UserNav';
---

<UserNav client:load />
```

**Features:**
- Shows sign-in/sign-up buttons when not authenticated
- Shows user avatar/menu when authenticated
- Responsive design
- Graceful fallback without Clerk keys

### UserMenu

```astro
---
import { UserMenu } from '@repo/auth-ui';
---

<UserMenu 
  client:load
  apiBaseUrl={import.meta.env.PUBLIC_API_BASE_URL}
/>
```

**Features:**
- User avatar and info display
- Dropdown menu with navigation
- Dashboard and profile links
- Sign-out functionality

### SignOutButton

```astro
---
import { SignOutButton } from '@repo/auth-ui';
---

<SignOutButton 
  client:load
  apiBaseUrl={import.meta.env.PUBLIC_API_BASE_URL}
  redirectTo="/"
/>
```

**Features:**
- API signout sync
- Clerk session cleanup
- Automatic redirection
- Error handling

## 🔒 Protected Routes

### Server-side Protection

```astro
---
// dashboard.astro
const { auth } = Astro.locals;
const { userId } = auth();

if (!userId) {
    return Astro.redirect('/auth/signin/');
}
---
```

### Client-side State

```tsx
// React components can use Clerk hooks
import { useUser } from '@clerk/clerk-react';

const { isSignedIn, user } = useUser();
```

## 🔄 Authentication Flow

### Sign-in Flow

1. User visits `/auth/signin/`
2. Chooses OAuth or email/password
3. Clerk handles authentication
4. OAuth redirects to `/auth/callback`
5. Frontend calls `/api/v1/public/auth/sync`
6. User redirected to intended destination

### Sign-up Flow

1. User visits `/auth/signup/`
2. Chooses OAuth or email/password
3. Email verification (if needed)
4. Clerk creates account
5. Frontend calls `/api/v1/public/auth/sync`
6. User redirected to dashboard

### Sign-out Flow

1. User clicks sign-out button
2. Frontend calls `/api/v1/public/auth/signout`
3. Clerk session cleared
4. User redirected to home

## 🎯 Features Implemented

### ✅ Core Authentication
- [x] Sign-in with OAuth (Google, Facebook)
- [x] Sign-in with email/password
- [x] Sign-up with OAuth
- [x] Sign-up with email/password
- [x] Sign-out functionality
- [x] Session management

### ✅ UI Components
- [x] Responsive sign-in form
- [x] Responsive sign-up form
- [x] User navigation controls
- [x] User dropdown menu
- [x] Sign-out button
- [x] Loading states

### ✅ Integration
- [x] API sync after authentication
- [x] Server-side route protection
- [x] Client-side state management
- [x] OAuth callback handling
- [x] Error handling

### ✅ Pages
- [x] Sign-in page (`/auth/signin/`)
- [x] Sign-up page (`/auth/signup/`)
- [x] OAuth callback page (`/auth/callback/`)
- [x] Protected dashboard (`/dashboard/`)
- [x] User profile page (`/profile/`)

## 🚀 Usage Examples

### Basic Authentication Check

```astro
---
const { auth } = Astro.locals;
const { userId } = auth();
const isAuthenticated = !!userId;
---

{isAuthenticated ? (
  <p>Welcome, user {userId}!</p>
) : (
  <a href="/auth/signin/">Sign in</a>
)}
```

### Protected Component

```tsx
import { useUser } from '@clerk/clerk-react';

export const ProtectedComponent = () => {
  const { isSignedIn, user } = useUser();
  
  if (!isSignedIn) {
    return <a href="/auth/signin/">Please sign in</a>;
  }
  
  return <div>Hello, {user.fullName}!</div>;
};
```

## 🔧 Customization

### Styling

All components use Tailwind CSS classes and can be customized by:

1. **Custom CSS classes**: Pass `className` prop
2. **Tailwind config**: Modify theme in `tailwind.config.ts`
3. **Component overrides**: Create custom components using Clerk hooks

### API Integration

Components accept `apiBaseUrl` prop for custom API endpoints:

```astro
<SignInForm 
  client:load
  apiBaseUrl="https://your-api.com"
  redirectTo="/custom-redirect"
/>
```

## 🐛 Troubleshooting

### Common Issues

1. **"Clerk not loaded"**: Ensure `PUBLIC_CLERK_PUBLISHABLE_KEY` is set
2. **OAuth redirect fails**: Check callback URL in Clerk dashboard
3. **API sync fails**: Verify `PUBLIC_API_BASE_URL` and API availability
4. **Hydration errors**: Ensure `client:load` directive is used

### Debug Mode

Enable debug logging in components:

```tsx
// Add to component for debugging
console.log('Auth state:', { isSignedIn, user, isLoaded });
```

## 🎉 Next Steps

### Potential Enhancements

1. **Email verification UI**: Custom verification flow
2. **Password reset**: Custom reset password flow
3. **Multi-factor authentication**: Add MFA support
4. **Social providers**: Add more OAuth providers
5. **User preferences**: Settings and preferences UI
6. **Admin panel**: Admin-specific authentication

### Performance Optimizations

1. **Code splitting**: Lazy load auth components
2. **Caching**: Implement user data caching
3. **Prefetching**: Prefetch user data on hover
4. **Bundle optimization**: Tree-shake unused Clerk features
