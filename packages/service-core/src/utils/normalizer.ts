import type { AdminInfoType } from '@repo/schemas';
import { normalizeArgentinePhone, parsePhoneNumber } from '@repo/schemas';

/**
 * Utility functions for normalizing data across services.
 * Provides consistent data formatting and validation.
 */

/**
 * Normalizes phone numbers to international format.
 * Ensures they start with + and follow the E.164 standard.
 *
 * @param phone - The phone number to normalize
 * @returns The normalized phone number
 *
 * @example
 * ```typescript
 * normalizePhoneNumber('+54 11 5555-0002') // Returns: '+541155550002'
 * normalizePhoneNumber('11 5555-0002') // Returns: '+541155550002'
 * normalizePhoneNumber('155550002') // Returns: '+54155550002'
 * ```
 */
export const normalizePhoneNumber = (phone: string, mobileByMeaning = true): string => {
    if (parsePhoneNumber(phone, mobileByMeaning)) {
        return normalizeArgentinePhone(phone, mobileByMeaning);
    }
    let cleaned = phone.replace(/[^\d+]/g, '');

    // Legacy values outside the current Argentine parser retain the historic
    // cleanup behavior. Parsed Argentine formats use the shared +54 canonical.
    // Drop the domestic trunk prefix, optional mobile marker (15), and the
    // international mobile marker (9) before prefixing +54.
    const hadInternationalPrefix = cleaned.startsWith('+');
    let digits = cleaned.replace(/\D/g, '');
    // Preserve the already-deployed HOS-1027 WhatsApp canonical, including
    // older nine-digit local payloads that the current write schema rejects.
    if (hadInternationalPrefix && digits.startsWith('549')) return `+${digits}`;
    if (digits.startsWith('549') && (hadInternationalPrefix || digits.length === 13)) {
        digits = digits.slice(3);
        return `+54${digits}`;
    }
    if (digits.startsWith('54') && digits.length === 12) digits = digits.slice(2);
    if (digits.startsWith('0') && digits.length === 11) digits = digits.slice(1);
    const mobilePrefixIndex = [2, 3, 4].find((index) => digits.slice(index, index + 2) === '15');
    if (mobilePrefixIndex !== undefined) {
        digits = digits.slice(0, mobilePrefixIndex) + digits.slice(mobilePrefixIndex + 2);
    }
    if (digits.length === 10) return `+54${digits}`;

    if (!cleaned.startsWith('+')) {
        // Assume it's an Argentine number if no country code
        if (cleaned.startsWith('54')) {
            cleaned = `+${cleaned}`;
        } else if (cleaned.startsWith('11') || cleaned.startsWith('15')) {
            // Argentine mobile numbers
            cleaned = `+54${cleaned}`;
        } else {
            // Default to +54 for Argentine numbers
            cleaned = `+54${cleaned}`;
        }
    }

    return cleaned;
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
