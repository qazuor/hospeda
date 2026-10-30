/**
 * Pure helpers of administrative action 24, «dar de baja una cuenta a pedido de su dueño»
 * (ACC:24, `NUCLEO/08` §3; AC:V8a:11 and AC:V8a:12).
 *
 * Nothing here touches the database: the transactional model in
 * `account-closure.model.ts` uses these to build the values it writes, and the
 * service uses them to describe the change without circulating personal values.
 */

/** Reserved TLD (RFC 2606) under which every pseudonymised mailbox lives. */
export const PSEUDONYM_EMAIL_DOMAIN = 'pseudonym.invalid' as const;

/** Prefix of the pseudonymised mailbox of a closed account. */
export const ACCOUNT_EMAIL_PSEUDONYM_PREFIX = 'deleted-' as const;

/** Prefix of the pseudonymised mailbox of a partner application. */
export const APPLICATION_EMAIL_PSEUDONYM_PREFIX = 'deleted-application-' as const;

/** Display name written over a closed account (ACC:24: the name is replaced). */
export const CLOSED_ACCOUNT_DISPLAY_NAME = 'deleted-user' as const;

/**
 * Keys of `users.contact_info` that action 24 nulls: every phone and every mailbox the
 * account wrote there (AC:V8a:11 «nombre, correo y teléfono reemplazados»). `whatsapp` is
 * a phone number too, so it is replaced with the others. Every other key stays as it was.
 */
export const ACCOUNT_CLOSURE_CONTACT_KEYS = [
    'homePhone',
    'workPhone',
    'mobilePhone',
    'whatsapp',
    'personalEmail',
    'workEmail'
] as const;

/**
 * NAMES of the fields action 24 replaces on the account, for the «qué cambió» of its audit
 * event. The audit log is append-only, so it carries names and never values: an old mailbox or
 * name stored there would undo the pseudonymisation (H5; DEC-DATA-005📌1, `NUCLEO/08` §1.2).
 */
export const ACCOUNT_CLOSURE_PERSONAL_FIELDS = [
    'email',
    'displayName',
    'firstName',
    'lastName',
    'slug',
    'contactInfo.homePhone',
    'contactInfo.workPhone',
    'contactInfo.mobilePhone',
    'contactInfo.whatsapp',
    'contactInfo.personalEmail',
    'contactInfo.workEmail'
] as const;

/**
 * Builds the mailbox that replaces a closed account's email (H4). Unique per account, so the
 * `users.email` UNIQUE constraint holds across every closure.
 *
 * @param input - `{ userId }` of the account being closed.
 * @returns `{ email }`, always lowercase.
 */
export function buildAccountEmailPseudonym(input: { readonly userId: string }): {
    readonly email: string;
} {
    return {
        email: `${ACCOUNT_EMAIL_PSEUDONYM_PREFIX}${input.userId}@${PSEUDONYM_EMAIL_DOMAIN}`.toLowerCase()
    };
}

/**
 * Builds the mailbox that replaces a partner application's email (H15). One per application,
 * so two `PENDING` applications never collide on the partial unique index over `lower(email)`.
 *
 * @param input - `{ applicationId }` of the application whose mailbox is replaced.
 * @returns `{ email }`, always lowercase.
 */
export function buildApplicationEmailPseudonym(input: { readonly applicationId: string }): {
    readonly email: string;
} {
    return {
        email: `${APPLICATION_EMAIL_PSEUDONYM_PREFIX}${input.applicationId}@${PSEUDONYM_EMAIL_DOMAIN}`.toLowerCase()
    };
}

/**
 * Tells whether a mailbox is one action 24 already wrote.
 *
 * @param input - `{ email }` to inspect.
 * @returns `true` when it ends in `@pseudonym.invalid`, ignoring case.
 */
export function isPseudonymizedEmail(input: { readonly email: string }): boolean {
    return input.email.toLowerCase().endsWith(`@${PSEUDONYM_EMAIL_DOMAIN}`);
}

/** The partner columns that make up its presence content (H10). */
export interface PartnerPresenceContentRow {
    readonly logoUrl: string | null;
    readonly description: string | null;
    readonly websiteUrl: string | null;
    readonly pendingLogoUrl: string | null;
    readonly pendingDescription: string | null;
    readonly pendingWebsiteUrl: string | null;
    readonly socialNetworks: Readonly<Record<string, unknown>> | null;
    readonly contactInfo: Readonly<Record<string, unknown>> | null;
}

function hasText(value: unknown): boolean {
    return typeof value === 'string' && value.trim().length > 0;
}

function hasAnyValue(value: Readonly<Record<string, unknown>> | null): boolean {
    if (value === null || typeof value !== 'object') return false;
    return Object.values(value).some((entry) =>
        typeof entry === 'string' ? hasText(entry) : entry !== null && entry !== undefined
    );
}

/**
 * Tells whether a partner presence still holds content, which blocks action 24 until action 25
 * empties it (ACC:24 «una presencia de Partner con contenido», lote N-G; H10). One named
 * predicate so V8b's action 25 aligns with it.
 *
 * @param row - The presence columns of one `partners` row.
 * @returns `true` when any text column is non-blank after trim, or `socialNetworks` /
 *   `contactInfo` holds any non-null, non-blank value.
 */
export function partnerPresenceHasContent(row: PartnerPresenceContentRow): boolean {
    const texts = [
        row.logoUrl,
        row.description,
        row.websiteUrl,
        row.pendingLogoUrl,
        row.pendingDescription,
        row.pendingWebsiteUrl
    ];
    return texts.some(hasText) || hasAnyValue(row.socialNetworks) || hasAnyValue(row.contactInfo);
}
