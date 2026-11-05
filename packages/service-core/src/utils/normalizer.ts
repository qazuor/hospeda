import type { AdminInfoType } from '@repo/schemas';
import { normalizeArgentinePhone, parsePhoneNumber } from '@repo/schemas';

/**
 * Utility functions for normalizing data across services.
 * Provides consistent data formatting and validation.
 */

/**
 * Normalizes a phone number to its canonical international form.
 *
 * Parsing is delegated to the shared `@repo/schemas` parser, which is the same
 * one the validators use, so every accepted input normalizes to a value the
 * validators also accept. Canonical forms:
 * - mobile (by meaning or by marker): `+549` + 10 national digits
 * - landline: `+54` + 10 national digits
 * - any other country, and legacy E.164 values: `+<digits>` untouched
 *
 * Input the parser does not accept (never produced by a validated payload)
 * keeps the historic best-effort cleanup.
 *
 * @param phone - The phone number to normalize
 * @param mobileByMeaning - `true` (default) for fields that mean a mobile line
 *   (`mobilePhone`, `whatsapp`), `false` for general/landline fields
 * @returns The normalized phone number
 *
 * @example
 * ```typescript
 * normalizePhoneNumber('3442 45-2345') // '+5493442452345'
 * normalizePhoneNumber('3442 45-2345', false) // '+543442452345'
 * normalizePhoneNumber('3442 15 45-2345', false) // '+5493442452345'
 * normalizePhoneNumber('155550002') // '+54155550002' (unparseable, legacy cleanup)
 * ```
 */
export const normalizePhoneNumber = (phone: string, mobileByMeaning = true): string => {
    if (parsePhoneNumber(phone, mobileByMeaning)) {
        return normalizeArgentinePhone(phone, mobileByMeaning);
    }
    const cleaned = phone.replace(/[^\d+]/g, '');
    return cleaned.startsWith('+') ? cleaned : `+${cleaned.startsWith('54') ? '' : '54'}${cleaned}`;
};

/**
 * Normalizes contact information including phone numbers and emails.
 *
 * @param contactInfo - The contact info to normalize
 * @returns The normalized contact info
 *
 * @example
 * ```typescript
 * const normalized = normalizeContactInfo({
 *   mobilePhone: '+54 11 5555-0002',
 *   whatsapp: '+54 11 5555-0002',
 *   personalEmail: ' USER@EXAMPLE.COM ',
 *   workEmail: 'work@example.com'
 * });
 * // Returns: {
 * //   mobilePhone: '+541155550002',
 * //   whatsapp: '+541155550002',
 * //   personalEmail: 'user@example.com',
 * //   workEmail: 'work@example.com'
 * // }
 * ```
 */
export const normalizeContactInfo = (contactInfo: unknown): unknown => {
    if (!contactInfo || typeof contactInfo !== 'object') {
        return contactInfo;
    }

    const normalized = { ...(contactInfo as Record<string, unknown>) };

    // Normalize phone numbers
    if (typeof normalized.mobilePhone === 'string') {
        normalized.mobilePhone = normalizePhoneNumber(normalized.mobilePhone, true);
    }
    if (typeof normalized.homePhone === 'string') {
        normalized.homePhone = normalizePhoneNumber(normalized.homePhone, false);
    }
    if (typeof normalized.workPhone === 'string') {
        normalized.workPhone = normalizePhoneNumber(normalized.workPhone, false);
    }
    if (typeof normalized.whatsapp === 'string') {
        normalized.whatsapp = normalizePhoneNumber(normalized.whatsapp, true);
    }

    // Normalize emails
    if (typeof normalized.personalEmail === 'string') {
        normalized.personalEmail = normalized.personalEmail.trim().toLowerCase();
    }
    if (typeof normalized.workEmail === 'string') {
        normalized.workEmail = normalized.workEmail.trim().toLowerCase();
    }

    return normalized;
};

/**
 * Normalizes an adminInfo object to ensure favorite is always boolean and never undefined.
 * If neither notes nor favorite are present, returns undefined.
 */
export function normalizeAdminInfo(input: unknown): AdminInfoType | undefined {
    if (!input || typeof input !== 'object') return undefined;
    const { notes, favorite } = input as Partial<AdminInfoType>;
    if (notes === undefined && favorite === undefined) return undefined;
    return {
        ...(notes === undefined ? {} : { notes }),
        favorite: typeof favorite === 'boolean' ? favorite : false
    } as AdminInfoType;
}
