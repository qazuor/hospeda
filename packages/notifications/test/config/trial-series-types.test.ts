/**
 * HOS-1012 T-002 / G-4 — the nine sends of the trial series are nine distinct
 * things.
 *
 * The requirement that made spec section 4 worth writing is that each send
 * carries its own tone: T−10 asks how it is going, T−1 says it comes down
 * tomorrow, day 0 says it came down, and the win-backs invite them back. One
 * subject reused nine times satisfies every structural check — the types exist,
 * the map is complete, the enum compiles — and fails that requirement in total
 * silence.
 *
 * These assertions are the guard for that. They also pin the category split,
 * where the expiry mail deliberately breaks ranks with its eight siblings.
 *
 * @module test/config/trial-series-types
 */

import { describe, expect, it } from 'vitest';
import { NOTIFICATION_CATEGORY_MAP } from '../../src/config/notification-categories';
import { NotificationCategory, NotificationType } from '../../src/types/notification.types';
import { getSubject } from '../../src/utils/subject-builder';

/** The three pre-expiry warnings, in the order the subscriber lives them. */
const PRE_EXPIRY = [
    NotificationType.TRIAL_ENDING_10D,
    NotificationType.TRIAL_ENDING_5D,
    NotificationType.TRIAL_ENDING_1D
] as const;

/** The five win-backs, in order. */
const WIN_BACK = [
    NotificationType.TRIAL_WIN_BACK_1D,
    NotificationType.TRIAL_WIN_BACK_5D,
    NotificationType.TRIAL_WIN_BACK_10D,
    NotificationType.TRIAL_WIN_BACK_30D,
    NotificationType.TRIAL_WIN_BACK_60D
] as const;

/** All nine, including the expiry mail that belongs to neither group. */
const SERIES = [...PRE_EXPIRY, NotificationType.TRIAL_EXPIRED, ...WIN_BACK] as const;

describe('the trial email series (HOS-1012)', () => {
    it('has exactly nine sends', () => {
        // Written as a literal rather than as SERIES.length, which would be
        // true of any array. The spec says nine and lists three plus five; the
        // ninth is the expiry mail itself.
        expect(SERIES.length).toBe(9);
    });

    it('every send has its own subject', () => {
        for (const type of SERIES) {
            expect(getSubject(type, {})).toBeTruthy();
        }
    });

    it('no two sends share a subject', () => {
        // The assertion that catches one template reused nine times.
        const subjects = SERIES.map((type) => getSubject(type, {}));
        expect(new Set(subjects).size).toBe(SERIES.length);
    });

    it('the three sends that land within 48 hours read as three different things', () => {
        // T−1 ("tomorrow it comes down"), day 0 ("it came down") and +1 arrive
        // inside two days of each other. If any two of them read the same, the
        // series reads as one message repeated — the specific failure section 4
        // exists to prevent.
        const near = [
            getSubject(NotificationType.TRIAL_ENDING_1D, {}),
            getSubject(NotificationType.TRIAL_EXPIRED, {}),
            getSubject(NotificationType.TRIAL_WIN_BACK_1D, {})
        ];
        expect(new Set(near).size).toBe(3);
    });

    it('the warnings and win-backs are opt-out-able reminders', () => {
        for (const type of [...PRE_EXPIRY, ...WIN_BACK]) {
            expect(NOTIFICATION_CATEGORY_MAP[type]).toBe(NotificationCategory.REMINDER);
        }
    });

    it('the expiry mail is transactional, unlike its eight siblings', () => {
        // Deliberate break: someone who opted out of reminders and then finds
        // their listing gone with no notice reads it as the platform having
        // deleted it. That is operational information about their own account.
        expect(NOTIFICATION_CATEGORY_MAP[NotificationType.TRIAL_EXPIRED]).toBe(
            NotificationCategory.TRANSACTIONAL
        );
    });
});
