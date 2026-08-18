/**
 * Resolves the template variables a notification subject needs (H-64 / H-75).
 *
 * ## Why this module exists
 *
 * The values a subject interpolates used to be assembled by a hand-written
 * chain of `if` branches inside `NotificationService.generateSubject`, one
 * block per notification type. Emitters passed the data and `subject-builder`
 * interpolated it correctly; the chain in the middle was the only thing that
 * had to be kept in sync by hand, and three families of notifications
 * (HOS-278 aliados, HOS-376 usage, HOS-377 mentions) were never added to it.
 * Eleven live subjects therefore shipped their own template syntax to real
 * inboxes.
 *
 * The fix is to stop maintaining that list: the subject pattern already
 * declares which variables it needs, and the payload already carries them
 * under the same names. This module reads the first and pulls from the second,
 * so a new notification type whose payload field matches its placeholder needs
 * no change here at all.
 *
 * A branch remains only where the subject value is DERIVED rather than
 * carried — a formatted date, a name assembled from two fields, a label picked
 * from an enum. Those are enumerated in {@link DERIVED_SUBJECT_KEYS} and always
 * win over the generic pass, so a raw ISO timestamp can never leak into a
 * subject line.
 *
 * @module utils/subject-data
 */

import { formatDate } from '../templates/utils/index.js';
import type { NotificationPayload } from '../types/notification.types.js';
import { getSubjectPlaceholders } from './subject-builder.js';

/**
 * Subject variables that are COMPUTED, not copied from a same-named payload
 * field.
 *
 * Listed so the CI guard can tell "this key is deliberately derived" from
 * "this key was forgotten" — without it the guard could not distinguish the
 * two, and a forgotten key is exactly the defect being prevented.
 */
export const DERIVED_SUBJECT_KEYS = [
    'userEmail',
    'eventType',
    'senderName',
    'contactType',
    'scope',
    'accessUntil',
    'effectiveDate'
] as const;

/** A subject variable whose value is computed rather than copied. */
export type DerivedSubjectKey = (typeof DERIVED_SUBJECT_KEYS)[number];

/**
 * Computes the subject variables that cannot be read straight off the payload.
 *
 * @param payload - The notification being sent.
 * @returns Only the derived keys that apply to this payload.
 */
function buildDerivedSubjectData(payload: NotificationPayload): Record<string, string> {
    const derived: Record<string, string> = {};

    if (payload.type === 'admin_payment_failure' && 'affectedUserEmail' in payload) {
        derived.userEmail = payload.affectedUserEmail || '';
    }

    if (payload.type === 'admin_system_event' && 'eventDetails' in payload) {
        const details = payload.eventDetails as Record<string, unknown>;
        derived.eventType = (details.eventType as string) || 'unknown';
    }

    if (payload.type === 'contact_submission' && 'senderFirstName' in payload) {
        derived.senderName = `${payload.senderFirstName} ${payload.senderLastName}`.trim();
        derived.contactType = payload.contactType === 'accommodation' ? 'Alojamiento' : 'General';
    }

    if (payload.type === 'ai_cost_threshold_alert' && 'scope' in payload) {
        derived.scope =
            payload.scope === 'global' ? 'global' : `feature:${payload.feature ?? 'unknown'}`;
    }

    // Dates are formatted here rather than copied, so the subject never embeds
    // a raw ISO timestamp such as "2026-07-15T23:59:59.000Z".
    if (payload.type === 'subscription_cancel_confirmed' && 'accessUntil' in payload) {
        derived.accessUntil = formatDate({ dateString: payload.accessUntil });
    }

    if (payload.type === 'plan_being_retired' && 'accessUntil' in payload) {
        derived.accessUntil = formatDate({ dateString: payload.accessUntil });
    }

    if (payload.type === 'plan_price_change_notice' && 'effectiveDate' in payload) {
        derived.effectiveDate = formatDate({ dateString: payload.effectiveDate });
    }

    return derived;
}

/**
 * Reads a payload field as a subject value.
 *
 * Only strings and finite numbers qualify. Booleans, objects and arrays are
 * refused on purpose: rendering one produces `[object Object]` or `true` in an
 * inbox line, which is worse than the fallback the caller applies when a
 * variable cannot be resolved.
 *
 * @param value - The raw field value.
 * @returns The display string, or `undefined` when the field cannot render.
 */
function asSubjectValue(value: unknown): string | undefined {
    if (typeof value === 'string') {
        return value;
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
        return String(value);
    }

    return undefined;
}

/**
 * Builds the variable map for a notification's subject line.
 *
 * Resolution order, highest first:
 * 1. {@link DERIVED_SUBJECT_KEYS} — computed values (formatted dates, composed
 *    names, mapped labels).
 * 2. The payload's own field of the same name, when it renders as text.
 *
 * Anything the pattern declares and neither pass can supply is left out, which
 * the caller detects and handles — it is never silently interpolated as blank.
 *
 * @param params - `{ payload }` the notification about to be sent.
 * @returns `{ subjectData }` ready to hand to `getSubject`.
 *
 * @example
 * ```ts
 * buildSubjectData({ payload: { type: NotificationType.PARTNER_REVOKED, partnerName: 'Acme', ... } })
 * // => { subjectData: { partnerName: 'Acme' } }
 * ```
 */
export function buildSubjectData(params: { readonly payload: NotificationPayload }): {
    readonly subjectData: Record<string, string>;
} {
    const { payload } = params;
    const subjectData = buildDerivedSubjectData(payload);
    const { placeholders } = getSubjectPlaceholders({ type: payload.type });
    // TYPE-WORKAROUND: the placeholder names come from the subject pattern at
    // run time, so they cannot be expressed as keys of the payload union;
    // `asSubjectValue` below re-narrows every value before it is used.
    const fields = payload as unknown as Record<string, unknown>;

    for (const key of placeholders) {
        if (key in subjectData) {
            continue;
        }

        const value = asSubjectValue(fields[key]);
        if (value !== undefined) {
            subjectData[key] = value;
        }
    }

    return { subjectData };
}
