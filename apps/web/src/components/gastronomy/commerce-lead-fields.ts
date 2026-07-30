/**
 * @file commerce-lead-fields.ts
 * @description Field helpers for the CommerceLead island (HOS-295).
 *
 * Extracted from `CommerceLead.client.tsx` to keep that component under the
 * project's 500-line ceiling. Pure functions only — no React, no DOM.
 */

import type { CommerceLeadCreateInput } from '@repo/schemas';

/**
 * The signed-in visitor, forwarded from `Astro.locals.user` by the page
 * frontmatter. `null` for anonymous visitors, which is the form's primary case.
 *
 * Only the two fields the form actually seeds are carried: island props are
 * serialized into the rendered HTML, so shipping the user id here would leak an
 * internal identifier into page source for no benefit.
 */
export interface CommerceLeadCurrentUser {
    readonly name: string | null;
    readonly email: string | null;
}

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

/**
 * Whether the session actually contributed a value to the contact fields.
 *
 * A session can carry an empty name (Better Auth stores `''` rather than null
 * for an account that never set one), and the form must not claim it pre-filled
 * something it left blank.
 *
 * @param params.currentUser - Signed-in visitor, or null/undefined for guests
 * @returns True when at least one contact field was seeded from the session
 */
export function hasSessionPrefill({
    currentUser
}: {
    readonly currentUser?: CommerceLeadCurrentUser | null;
}): boolean {
    return Boolean(currentUser?.name || currentUser?.email);
}

/**
 * Joins the element ids that describe a field into one `aria-describedby`
 * value, dropping the ones that are not currently rendered.
 *
 * @param params.ids - Candidate ids; `null` entries are dropped
 * @returns The space-separated id list, or undefined when nothing describes it
 */
export function buildDescribedBy({
    ids
}: {
    readonly ids: ReadonlyArray<string | null>;
}): string | undefined {
    const present = ids.filter((id): id is string => Boolean(id));
    return present.length > 0 ? present.join(' ') : undefined;
}
