import type { QrCodeCreateInput, QrCodeUpdateInput } from '@repo/schemas';
import type { Actor } from '../../types';

/**
 * Normalizes the input for creating a QR code.
 *
 * Trims the human-facing strings and the URL. `targetUrl` is trimmed rather
 * than canonicalised: a redirect target is copied out of a browser bar by an
 * operator, and rewriting it (dropping a trailing slash, lowercasing a path)
 * would silently change where a printed code sends people.
 *
 * @param data - The original input data for creation.
 * @param _actor - The actor performing the action (unused).
 * @returns The normalized data.
 */
export const normalizeCreateInput = (data: QrCodeCreateInput, _actor: Actor): QrCodeCreateInput => {
    return {
        ...data,
        targetUrl: data.targetUrl.trim(),
        label: data.label.trim(),
        description: data.description?.trim() ?? data.description
    };
};

/**
 * Normalizes the input for updating a QR code.
 *
 * Only keys actually present are touched — an absent key must stay absent, or a
 * PATCH would overwrite fields the caller never sent.
 *
 * @param data - The original input data for the update.
 * @param _actor - The actor performing the action (unused).
 * @returns The normalized data.
 */
export const normalizeUpdateInput = (data: QrCodeUpdateInput, _actor: Actor): QrCodeUpdateInput => {
    const result: QrCodeUpdateInput = { ...data };

    if (typeof data.targetUrl === 'string') result.targetUrl = data.targetUrl.trim();
    if (typeof data.label === 'string') result.label = data.label.trim();
    if (typeof data.description === 'string') result.description = data.description.trim();

    return result;
};
