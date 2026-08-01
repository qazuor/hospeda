/**
 * @file commerce-lead-fields.ts
 * @description Field helpers for the CommerceLead island (HOS-295).
 *
 * Extracted from `CommerceLead.client.tsx` to keep that component under the
 * project's 500-line ceiling. Pure functions only — no React, no DOM.
 */

import type { CommerceLeadCreateInput } from '@repo/schemas';
import type { SessionPrefillUser } from '@/lib/forms/session-prefill';

export { buildDescribedBy } from '@/lib/forms/aria-describedby';
export { hasSessionPrefill } from '@/lib/forms/session-prefill';

/**
 * The signed-in visitor, forwarded from `Astro.locals.user` by the page
 * frontmatter. `null` for anonymous visitors, which is the form's primary case.
 *
 * Alias of the shared {@link SessionPrefillUser} — the alliance lead form seeds
 * its contact fields from the same two values, so the shape lives in
 * `@/lib/forms/session-prefill` and this name is kept for the commerce callers.
 */
export type CommerceLeadCurrentUser = SessionPrefillUser;

/** The lead form's field values, including the spam honeypot. */
export type LeadFields = Omit<CommerceLeadCreateInput, 'domain'> & {
    readonly _hp: string;
};

/** Per-field validation messages, keyed by field name. */
export type FieldErrors = Partial<Record<keyof LeadFields, string>>;

/** Empty form state — the anonymous visitor's starting point. */
const INITIAL_FIELDS: LeadFields = {
    businessName: '',
    contactName: '',
    email: '',
    phone: '',
    destinationId: undefined,
    message: '',
    _hp: ''
};

/**
 * Builds the form's initial field values, seeding the contact fields from the
 * session when the visitor is signed in.
 *
 * The business-specific fields (name, phone, city, description) are never
 * seeded — we know nothing about the business yet.
 *
 * @param params.currentUser - Signed-in visitor, or null/undefined for guests
 * @returns The initial {@link LeadFields} for `useState`
 */
export function buildInitialFields({
    currentUser
}: {
    readonly currentUser?: CommerceLeadCurrentUser | null;
}): LeadFields {
    if (!currentUser) {
        return INITIAL_FIELDS;
    }

    return {
        ...INITIAL_FIELDS,
        contactName: currentUser.name ?? '',
        email: currentUser.email ?? ''
    };
}
