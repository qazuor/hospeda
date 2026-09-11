/**
 * @file subject-data.addon-cancellation.test.ts
 * @description The ADDON_CANCELLATION subject branches on surviving access
 * (HOS-847 PR 7c).
 *
 * An add-on cancellation reaches the customer in two states. Non-payment and an
 * admin cancel end the benefit on the spot; `softCancelRecurringAddon` leaves it
 * running until the end of the period already paid for, and only that path fills
 * `accessUntil`. Until this branch existed, both arrived under "Tu complemento X
 * ha sido cancelado" — above a body reading "seguís teniendo el beneficio hasta
 * el 15 de abril".
 *
 * These tests go end to end, payload -> resolved variables -> interpolated
 * subject, because the two halves can each be right and still not meet: the
 * date is DERIVED (formatted in `subject-data`) while the pattern is chosen in
 * `subject-builder`, and a subject that read the raw payload field would publish
 * "2026-04-15T23:59:59.000Z" to an inbox.
 */

import { describe, expect, it } from 'vitest';
import type { AddonCancellationPayload } from '../../src/types/notification.types.js';
import { NotificationType } from '../../src/types/notification.types.js';
import { getSubject } from '../../src/utils/subject-builder.js';
import { buildSubjectData } from '../../src/utils/subject-data.js';

/** Minimal ADDON_CANCELLATION payload, with or without surviving access. */
function cancellationPayload(accessUntil?: string): AddonCancellationPayload {
    return {
        type: NotificationType.ADDON_CANCELLATION,
        recipientEmail: 'owner@example.com',
        recipientName: 'Juan',
        addonName: 'Fotos extra',
        canceledAt: '2026-03-17T10:00:00.000Z',
        ...(accessUntil === undefined ? {} : { accessUntil })
    } as AddonCancellationPayload;
}

/** End-to-end: payload -> resolved variables -> interpolated subject. */
function subjectFor(accessUntil?: string): string {
    const { subjectData } = buildSubjectData({ payload: cancellationPayload(accessUntil) });
    return getSubject(NotificationType.ADDON_CANCELLATION, subjectData);
}

describe('ADDON_CANCELLATION subject (HOS-847 PR 7c)', () => {
    it('is unchanged, byte for byte, when the benefit ended immediately', () => {
        // The immediate path promises nothing and must keep saying exactly what
        // it said before this branch existed.
        expect(subjectFor()).toBe('Tu complemento Fotos extra ha sido cancelado');
    });

    it('resolves no accessUntil variable at all when the payload omits it', () => {
        const { subjectData } = buildSubjectData({ payload: cancellationPayload() });

        expect(subjectData.accessUntil).toBeUndefined();
    });

    it('tells the soft-cancelled customer the benefit runs to the paid date', () => {
        expect(subjectFor('2026-04-15T23:59:59.000Z')).toBe(
            'Tu complemento Fotos extra queda cancelado — lo seguís usando hasta el 15 de abril de 2026'
        );
    });

    it('never publishes the raw ISO timestamp', () => {
        const subject = subjectFor('2026-04-15T23:59:59.000Z');

        expect(subject).not.toContain('2026-04-15T23:59:59.000Z');
        expect(subject).not.toContain('{');
    });

    it('falls back to the original subject when the date cannot be formatted', () => {
        // `formatDate` answers '' here, and a branch taken on that would ship
        // "…hasta el " with nothing after it.
        expect(subjectFor('not-a-date')).toBe('Tu complemento Fotos extra ha sido cancelado');
    });

    it('never lets the unformattable value through as raw text', () => {
        // The derived pass claims the key even when it cannot format it. Left
        // unset, the generic pass would copy the payload's own `accessUntil`
        // and publish it verbatim — which is what this test caught.
        const { subjectData } = buildSubjectData({ payload: cancellationPayload('not-a-date') });

        expect(subjectData.accessUntil).toBe('');
        expect(subjectFor('not-a-date')).not.toContain('not-a-date');
    });
});
