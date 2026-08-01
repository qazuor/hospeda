/**
 * @file alliance-lead-fields.ts
 * @description Field helpers for the AllianceLead island.
 *
 * Extracted from `AllianceLead.client.tsx` to keep that component under the
 * project's 500-line ceiling, mirroring `commerce-lead-fields.ts`. Pure
 * functions only — no React, no DOM.
 */

import type { SessionPrefillUser } from '@/lib/forms/session-prefill';

export type { SessionPrefillUser } from '@/lib/forms/session-prefill';
export { hasSessionPrefill } from '@/lib/forms/session-prefill';

/**
 * The generic contact fields every alliance kind asks for. The kind-specific
 * fields live in `AllianceLeadSpecificValues` (see `alliance-lead-message.ts`).
 */
export interface GenericFields {
    contactName: string;
    email: string;
    phone: string;
    freeText: string;
}

/** Empty form state — the anonymous visitor's starting point. */
const INITIAL_GENERIC_FIELDS: GenericFields = {
    contactName: '',
    email: '',
    phone: '',
    freeText: ''
};

/**
 * Builds the form's initial generic field values, seeding the contact fields
 * from the session when the visitor is signed in.
 *
 * Phone is never seeded: the account does not carry one, and the applicant may
 * well want to be reached on a different line than the one on their profile.
 *
 * @param params.currentUser - Signed-in visitor, or null/undefined for guests
 * @returns The initial {@link GenericFields} for `useState`
 */
export function buildInitialGenericFields({
    currentUser
}: {
    readonly currentUser?: SessionPrefillUser | null;
}): GenericFields {
    if (!currentUser) {
        return INITIAL_GENERIC_FIELDS;
    }

    return {
        ...INITIAL_GENERIC_FIELDS,
        contactName: currentUser.name ?? '',
        email: currentUser.email ?? ''
    };
}
