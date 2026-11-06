/**
 * @file phone-editor-validation.ts
 * @description Strict client-side phone check for the owner editors (HOS-2034).
 *
 * The shared write schema (`@repo/schemas`) deliberately stays permissive: a
 * stored legacy `+54...` value of any length must keep validating, so a too-short
 * `+54 344245` still matches the historical E.164 fallback there. The editors
 * compose `+54 <typed>` for Argentina, so for Argentina-selected input the form
 * enforces the strict rule itself: the value must parse as a real Argentine
 * number (ten national digits once trunk 0 / mobile 9 / 15 are accounted for).
 */

import { parsePhoneNumber } from '@repo/schemas';
import type { z } from 'zod';

/** Existing localized message shared by every editor phone field. */
export const EDITOR_PHONE_INVALID_MESSAGE = 'zodError.common.contact.phone.argentina';

/**
 * Returns `false` only for an Argentina-prefixed (`+54`) value that does not
 * parse as an Argentine number. Other countries and blank values pass here
 * (the shared schema still judges them).
 *
 * @param value - The composed phone value from the editor
 */
export function isStrictEditorPhone(value: string): boolean {
    const trimmed = value.trim();
    if (!trimmed.startsWith('+54')) {
        return true;
    }
    return parsePhoneNumber(trimmed)?.kind === 'argentina';
}

/**
 * `superRefine` callback for an owner-update schema carrying `contactInfo`:
 * applies {@link isStrictEditorPhone} to `contactInfo.mobilePhone`.
 *
 * @param data - The parsed payload
 * @param ctx - The Zod refinement context
 */
export function refineStrictContactPhone(
    data: { readonly contactInfo?: { readonly mobilePhone?: string | null } | null },
    ctx: z.RefinementCtx
): void {
    const phone = data.contactInfo?.mobilePhone;
    if (typeof phone === 'string' && !isStrictEditorPhone(phone)) {
        ctx.addIssue({
            code: 'custom',
            path: ['contactInfo', 'mobilePhone'],
            message: EDITOR_PHONE_INVALID_MESSAGE
        });
    }
}
