/**
 * The deterministic pseudonym of a mailbox, for the trial that is single for
 * life (HOS-1443, V4.1, AC:V4:2; DEC-TRIAL-004 pins 1 and 2; `V/02` §2.2).
 *
 * The whole defence of "one trial per person" rests on this function: a person
 * who registers again with the same mailbox gets a new `user_id`, and only the
 * pseudonym recognises them. It is the pseudonym of the NORMALISED mailbox, so
 * that `ana.maria@gmail.com` and `anamaria@gmail.com` (one Gmail mailbox) match.
 *
 * ## It never changes
 *
 * The mailbox is not stored, so there is nothing to recompute old rows from.
 * Changing the hash or the normalisation hands the trial back to everyone who
 * already used it; if that is ever needed it is an owner decision with that
 * consequence stated, not a migration. The provider list MAY change, and
 * changing it does not recompute old rows (a row written before a provider
 * entered the list keeps the pseudonym of the mailbox with its dots).
 *
 * ## The function
 *
 * Unkeyed SHA-256 over the normalised mailbox, as 64 lowercase hex characters.
 * Unkeyed on purpose: "anyone with a candidate mailbox can compute the hash" is
 * only true without a key (legal question 5), and a keyed hash would lose every
 * row when the secret is lost or rotated, with no detector.
 *
 * ## The normalisation (a closed list, provider by provider)
 *
 * Lowercase everywhere, then by the domain of the mailbox:
 *
 * | provider | dots in the local part | `+alias` | domains |
 * |---|---|---|---|
 * | Gmail (`gmail.com`, `googlemail.com`) | removed | removed | unified into `gmail.com` ONLY if measured |
 * | Microsoft consumer (`outlook`, `hotmail`, `live`, `msn` and their country variants) | kept | removed | never unified |
 * | Proton (`proton.me`, `protonmail.com`, `protonmail.ch`, `pm.me`) | kept (`.`, `-`, `_` removed ONLY if measured) | removed | unified into `proton.me` |
 * | iCloud (`icloud.com`, `me.com`, `mac.com`) | kept | removed | unified into `icloud.com` ONLY if measured |
 * | Yahoo (`yahoo.com`, `yahoo.com.ar`) | kept | kept (removed ONLY if measured) | never unified |
 * | AOL, Zoho, GMX, Argentine ISPs | kept | kept | never unified |
 * | Microsoft consumer / any domain the list does not name | kept | removed | never unified |
 *
 * ## What "measured" means
 *
 * Anything the spec marks "a medir" applies only with the measurement of step 0
 * of the cut (`EX-49`), and without it does NOT apply: a false positive denies a
 * real person a trial with no remedy, a false negative only gives one away. The
 * measurement has not happened, so every flag in {@link MEASURED_RULES} is
 * `false`. They are constants, not parameters, on purpose: a caller passing a
 * different set would compute a different pseudonym for the same mailbox. The
 * list is frozen with step 0, before the first `trial` row exists; what the
 * measurement shows outside the table goes back to the owner before it applies.
 *
 * @module services/trial/trial-email-pseudonym
 */

import { createHash } from 'node:crypto';

/**
 * Which "a medir" rules the step-0 measurement confirmed (`EX-49`). All `false`
 * until the measurement is done and the owner closes the list. Changing one is
 * changing the list: see the module docs for what that means for old rows.
 */
export const MEASURED_RULES = {
    /** `googlemail.com` and `gmail.com` are the same mailbox. */
    gmailDomainUnification: false,
    /** Proton ignores `.`, `-` and `_` in the local part. */
    protonIgnoresSeparators: false,
    /** `me.com` and `mac.com` are `icloud.com`. */
    icloudDomainUnification: false,
    /** Yahoo ignores `+alias`. */
    yahooIgnoresPlus: false
} as const;

/** Why a mailbox could not be normalised. */
export type TrialEmailPseudonymErrorCode = 'INVALID_EMAIL';

/** A mailbox that cannot be normalised; carries no part of the input. */
export interface TrialEmailPseudonymError {
    readonly code: TrialEmailPseudonymErrorCode;
    readonly message: string;
}

/** Result of {@link normalizeEmailForTrial}. */
export type NormalizeEmailForTrialResult =
    | { readonly ok: true; readonly normalized: string }
    | { readonly ok: false; readonly error: TrialEmailPseudonymError };

/** Result of {@link computeTrialEmailPseudonym}. */
export type ComputeTrialEmailPseudonymResult =
    | { readonly ok: true; readonly pseudonym: string }
    | { readonly ok: false; readonly error: TrialEmailPseudonymError };

const GMAIL_DOMAINS: ReadonlySet<string> = new Set(['gmail.com', 'googlemail.com']);
const PROTON_DOMAINS: ReadonlySet<string> = new Set([
    'proton.me',
    'protonmail.com',
    'protonmail.ch',
    'pm.me'
]);
const ICLOUD_DOMAINS: ReadonlySet<string> = new Set(['icloud.com', 'me.com', 'mac.com']);
const YAHOO_DOMAINS: ReadonlySet<string> = new Set(['yahoo.com', 'yahoo.com.ar']);

/**
 * Domains the list names as "as is": the `+alias` stays. Everything else the list
 * does not name is an own domain and loses it (`V2-j3`).
 */
const KEEP_PLUS_DOMAINS: ReadonlySet<string> = new Set([
    // AOL
    'aol.com',
    // Zoho
    'zoho.com',
    'zohomail.com',
    // GMX
    'gmx.com',
    'gmx.net',
    'gmx.de',
    'gmx.at',
    'gmx.ch',
    // Argentine ISPs: Fibertel, Arnet, Speedy, Ciudad, Ferozo
    'fibertel.com.ar',
    'arnet.com.ar',
    'speedy.com.ar',
    'ciudad.com.ar',
    'ferozo.com'
]);

const PROTON_SEPARATORS = /[._-]/g;

const invalidEmail = (): NormalizeEmailForTrialResult => ({
    ok: false,
    error: { code: 'INVALID_EMAIL', message: 'The mailbox has no usable local part and domain' }
});

/** Drops the `+alias`; a local part that would end up empty is left as it was. */
const stripPlusAlias = (local: string): string => {
    const index = local.indexOf('+');
    return index > 0 ? local.slice(0, index) : local;
};

/**
 * Normalises a mailbox by the closed provider list (see the module docs).
 *
 * @param params - Receive object.
 * @param params.email - The mailbox as the person typed it.
 * @returns The normalised mailbox, or `INVALID_EMAIL` when it has no usable local
 *   part and domain.
 */
export function normalizeEmailForTrial({
    email
}: {
    readonly email: string;
}): NormalizeEmailForTrialResult {
    const lowered = email.trim().toLowerCase();
    const at = lowered.lastIndexOf('@');
    if (at <= 0 || at === lowered.length - 1 || /\s/.test(lowered)) {
        return invalidEmail();
    }
    const local = lowered.slice(0, at);
    const domain = lowered.slice(at + 1);

    if (GMAIL_DOMAINS.has(domain)) {
        const unified = MEASURED_RULES.gmailDomainUnification ? 'gmail.com' : domain;
        const dotless = stripPlusAlias(local).replaceAll('.', '');
        return { ok: true, normalized: `${dotless || local}@${unified}` };
    }
    if (PROTON_DOMAINS.has(domain)) {
        const stripped = stripPlusAlias(local);
        const cleaned = MEASURED_RULES.protonIgnoresSeparators
            ? stripped.replace(PROTON_SEPARATORS, '')
            : stripped;
        return { ok: true, normalized: `${cleaned || local}@proton.me` };
    }
    if (ICLOUD_DOMAINS.has(domain)) {
        const unified = MEASURED_RULES.icloudDomainUnification ? 'icloud.com' : domain;
        return { ok: true, normalized: `${stripPlusAlias(local)}@${unified}` };
    }
    if (YAHOO_DOMAINS.has(domain)) {
        const kept = MEASURED_RULES.yahooIgnoresPlus ? stripPlusAlias(local) : local;
        return { ok: true, normalized: `${kept}@${domain}` };
    }
    if (KEEP_PLUS_DOMAINS.has(domain)) {
        return { ok: true, normalized: `${local}@${domain}` };
    }
    // Microsoft consumer (`outlook`, `hotmail`, `live`, `msn` and their country
    // variants), Fastmail, Yandex and every own domain: only the `+alias` goes,
    // dots stay and domains are never unified (each Microsoft domain is another
    // mailbox). It is the rule of every domain the list does not name.
    return { ok: true, normalized: `${stripPlusAlias(local)}@${domain}` };
}

/**
 * The pseudonym of a mailbox: unkeyed SHA-256, as 64 lowercase hex characters,
 * over the normalised mailbox. Deterministic across processes and deploys.
 *
 * @param params - Receive object.
 * @param params.email - The mailbox as the person typed it.
 * @returns The pseudonym, or `INVALID_EMAIL`.
 */
export function computeTrialEmailPseudonym({
    email
}: {
    readonly email: string;
}): ComputeTrialEmailPseudonymResult {
    const result = normalizeEmailForTrial({ email });
    if (!result.ok) {
        return result;
    }
    return {
        ok: true,
        pseudonym: createHash('sha256').update(result.normalized, 'utf8').digest('hex')
    };
}
