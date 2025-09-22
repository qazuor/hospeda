import type { AdminInfoType } from '@repo/schemas';

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
export const normalizePhoneNumber = (phone: string): string => {
    // Remove all non-digit characters except +
    let cleaned = phone.replace(/[^\d+]/g, '');

    // If it doesn't start with +, add it
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
 *   personalEmail: ' USER@EXAMPLE.COM ',
 *   workEmail: 'work@example.com'
 * });
 * // Returns: {
 * //   mobilePhone: '+541155550002',
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
        normalized.mobilePhone = normalizePhoneNumber(normalized.mobilePhone);
    }
    if (typeof normalized.homePhone === 'string') {
        normalized.homePhone = normalizePhoneNumber(normalized.homePhone);
    }
    if (typeof normalized.workPhone === 'string') {
        normalized.workPhone = normalizePhoneNumber(normalized.workPhone);
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
        ...(notes !== undefined ? { notes } : {}),
        favorite: typeof favorite === 'boolean' ? favorite : false
    } as AdminInfoType;
}
