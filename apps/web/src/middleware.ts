import { clerkMiddleware } from '@clerk/astro/server';

/**
 * Astro middleware that initializes Clerk authentication for every request.
 *
 * This injects `auth()` and `user()` helpers into `Astro.locals`, enabling
 * server-side aware components like `SignedIn` / `SignedOut` and UI widgets
 * such as `SignInButton` and `UserButton` to work correctly during SSR.
 *
 * Ensure the following environment variables are configured:
 * - PUBLIC_CLERK_PUBLISHABLE_KEY (client-side)
 * - CLERK_SECRET_KEY (server-side)
 */
export const onRequest = clerkMiddleware();
