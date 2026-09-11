/**
 * @file leave-warning-copy.ts
 * @description Builds the copy for a leave-confirmation dialog that has to
 * state MORE THAN ONE warning at once (HOS-1018).
 *
 * Kept apart from `leave-warning-registry.ts` on purpose: the registry owns
 * the event plumbing and knows nothing about wording, and this module owns the
 * wording and knows nothing about clicks.
 *
 * A combiner is keyed by the exact SET of active kinds, not by "at least
 * these". That is what makes the combined message honest: it may only claim to
 * describe the warnings it was written for. Anything else returns `null` and
 * the registry falls back to the highest-severity entry's own copy — the
 * behaviour that existed before combining did, and a message that under-states
 * rather than one that mis-states.
 *
 * The owner rejected the two obvious alternatives while specifying this
 * (HOS-1018 review): chaining two dialogs back to back reads as an
 * interrogation, and plain priority silently drops the loser — which is the
 * exact bug this replaces.
 *
 * @module lib/forms/leave-warning-copy
 */

import { createTranslations } from '@/lib/i18n';
import type {
    LeaveWarningCopy,
    LeaveWarningEntry,
    LeaveWarningKind
} from './leave-warning-registry';

/** i18n prefix for the "unsaved changes AND photos without alt text" dialog. */
const UNSAVED_AND_PHOTO_ALT = 'common.confirmations.unsavedChangesAndPhotoAlt';

/** Set of the distinct kinds present in `entries`. */
function kindsOf(entries: readonly LeaveWarningEntry[]): ReadonlySet<LeaveWarningKind> {
    return new Set(entries.map((entry) => entry.kind));
}

/** True when `kinds` holds exactly `expected`, no more and no less. */
function kindsAreExactly(
    kinds: ReadonlySet<LeaveWarningKind>,
    expected: readonly LeaveWarningKind[]
): boolean {
    return kinds.size === expected.length && expected.every((kind) => kinds.has(kind));
}

/**
 * Builds the single dialog shown when several warnings are active at once.
 *
 * @param entries - Every active warning, already ordered by severity (highest
 * first) by the registry.
 * @returns The combined copy, or `null` when no combiner covers this exact set
 * of kinds — including when the entries carry no locale to translate with.
 *
 * @example
 * ```ts
 * // unsaved video caption + 3 photos with no alt text
 * buildCombinedLeaveWarningCopy([unsavedEntry, photoAltEntry]);
 * ```
 */
export function buildCombinedLeaveWarningCopy(
    entries: readonly LeaveWarningEntry[]
): LeaveWarningCopy | null {
    const kinds = kindsOf(entries);

    if (kindsAreExactly(kinds, ['unsaved-changes', 'photo-alt'])) {
        return buildUnsavedChangesAndPhotoAltCopy(entries);
    }

    return null;
}

/**
 * The one combination that exists today: the Fotos editor page, where
 * `VideoSection` guards real unsaved edits and `PhotoSection` nudges about
 * empty alt texts. Both live on the same page as separate `client:load`
 * islands, which is precisely why neither can build this message alone.
 */
function buildUnsavedChangesAndPhotoAltCopy(
    entries: readonly LeaveWarningEntry[]
): LeaveWarningCopy | null {
    const photoAlt = entries.find((entry) => entry.kind === 'photo-alt');
    const locale = entries.find((entry) => entry.locale !== undefined)?.locale;
    if (!photoAlt || !locale) {
        return null;
    }

    const count = photoAlt.count ?? 0;
    const { t, tPlural } = createTranslations(locale);

    return {
        title: t(
            `${UNSAVED_AND_PHOTO_ALT}.title`,
            'Cambios sin guardar y fotos sin texto alternativo'
        ),
        message: tPlural(`${UNSAVED_AND_PHOTO_ALT}.message`, count, { count }),
        confirmLabel: t(`${UNSAVED_AND_PHOTO_ALT}.confirm`, 'Salir y descartar los cambios'),
        cancelLabel: t(`${UNSAVED_AND_PHOTO_ALT}.cancel`, 'Seguir editando')
    };
}
