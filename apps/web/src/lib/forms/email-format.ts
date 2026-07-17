/**
 * @file email-format.ts
 * @description Shared email format check for the hand-rolled auth islands
 * (HOS-190 slice 3: SignIn, SignUp, ForgotPassword).
 *
 * These forms talk to Better Auth directly (not a `@repo/schemas`-backed API
 * route), and every one of them renders `noValidate` on its `<form>` — which
 * disables the browser's native `required`/`type="email"` enforcement so
 * failed-submit focus/scroll behavior stays consistent across browsers. That
 * left email format entirely unvalidated client-side: any string reached
 * Better Auth and came back as either a generic credentials error (sign-in)
 * or a confusing server-side validation error (sign-up / forgot-password).
 *
 * No `EmailSchema` is exported from `@repo/schemas` today — every entity
 * schema inlines `z.string().email()` directly (see e.g.
 * `packages/schemas/src/contact/submit.ts`) — so this small shared constant
 * matches existing repo convention rather than introducing a new one there.
 */

import { z } from 'zod';

/** Validates that a (pre-trimmed) string is a syntactically valid email. */
export const EmailFormatSchema = z.string().email();
