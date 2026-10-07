import { describe, expect, it } from 'vitest';
import {
    buildEmailDedupKey,
    buildEventOccurrence,
    buildScheduleOccurrence,
    EmailOutboxKeyError
} from '../../src/models/email-outbox/email-outbox-dedup-key.ts';

describe('email outbox dedup key (AC:U2:5)', () => {
    const schedule = {
        subjectKind: 'trial',
        subjectId: 'abc',
        milestone: 'pre:-2d',
        targetDate: '2026-10-04'
    } as const;

    it('builds a schedule occurrence that carries the target date', () => {
        expect(buildScheduleOccurrence(schedule)).toBe('trial:abc:pre:-2d:2026-10-04');
    });

    it('gives a moved target date a different key (extension, renewal, retention reset)', () => {
        const before = buildEmailDedupKey({
            recipient: 'u1',
            template: 'trial-pre',
            occurrence: buildScheduleOccurrence(schedule)
        });
        const after = buildEmailDedupKey({
            recipient: 'u1',
            template: 'trial-pre',
            occurrence: buildScheduleOccurrence({ ...schedule, targetDate: '2026-10-11' })
        });
        expect(after).not.toBe(before);
    });

    it('is a pure function of its parts: the same inputs give the same key on every call', () => {
        const input = {
            recipient: 'U1',
            template: 't',
            occurrence: buildEventOccurrence({ eventId: 'e1' })
        };
        expect(buildEmailDedupKey(input)).toBe(buildEmailDedupKey({ ...input }));
    });

    it('uses the domain event id as the event occurrence', () => {
        expect(buildEventOccurrence({ eventId: 'evt-9' })).toBe('event:evt-9');
    });

    it('normalizes the recipient case', () => {
        const a = buildEmailDedupKey({
            recipient: 'Ana@Example.com',
            template: 't',
            occurrence: 'o'
        });
        const b = buildEmailDedupKey({
            recipient: 'ana@example.com',
            template: 't',
            occurrence: 'o'
        });
        expect(a).toBe(b);
    });

    it('rejects empty parts, separators and malformed dates', () => {
        expect(() =>
            buildEmailDedupKey({ recipient: ' ', template: 't', occurrence: 'o' })
        ).toThrow(EmailOutboxKeyError);
        expect(() =>
            buildEmailDedupKey({ recipient: 'a|b', template: 't', occurrence: 'o' })
        ).toThrow(EmailOutboxKeyError);
        expect(() => buildScheduleOccurrence({ ...schedule, targetDate: '04/10/2026' })).toThrow(
            EmailOutboxKeyError
        );
    });
});
