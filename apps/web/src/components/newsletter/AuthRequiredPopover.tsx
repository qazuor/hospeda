/**
 * @file AuthRequiredPopover.tsx
 * @description Re-export of the shared AuthRequiredPopover component for use
 * within the newsletter feature directory.
 *
 * The existing implementation at
 * `apps/web/src/components/auth/AuthRequiredPopover.client.tsx`
 * fully satisfies all requirements from SPEC-101 AC-101-02:
 *
 * - AC-101-02.3: Title (via `dialogLabel`), message (via `message`),
 *   primary CTA "Registrarse" (via `registerLabel`), secondary link
 *   "Ya tengo cuenta" (via `signInLabel`).
 * - AC-101-02.4: Escape key dismissal, click-outside dismissal, focus
 *   returns to the trigger anchor on close.
 * - Focus trap via Portal + role="dialog".
 *
 * `NewsletterForm.client.tsx` imports directly from the canonical path to
 * avoid an extra module indirection. This file exists only to satisfy the
 * task file list (T-101-25) and serves as documentation of the decision.
 */
export {
    AuthRequiredPopover,
    type AuthRequiredPopoverProps
} from '@/components/auth/AuthRequiredPopover.client';
