// `puedeCobrarle` (AC:B4:5, AC:B4:6): the pure decision, rule by rule (contract §4.1; glossary
// «fila viva» row 27 and «marca abierta» row 12; DEC-ARCH-006📌10/📌11).
import { describe, expect, it } from 'vitest';
import {
    type CanChargeRow,
    cancellationRereadWindowEndsAt,
    decideCanCharge
} from '../../../../src/services/billing/coverage/can-charge';

const DAY_MS = 24 * 60 * 60 * 1000;
const now = new Date('2026-10-12T12:00:00.000Z');
const seenAt = new Date('2026-10-05T12:00:00.000Z');
const WINDOW_DAYS = 7;

/** A row of the test; `providerCancelledAfterRejection` defaults to false (HOS-1676 H-3). */
type TestRow = Omit<CanChargeRow, 'providerCancelledAfterRejection'> &
    Partial<Pick<CanChargeRow, 'providerCancelledAfterRejection'>>;

function decide(input: {
    readonly rows: readonly TestRow[];
    readonly marks?: number;
    readonly at?: Date;
}): boolean {
    return decideCanCharge({
        rows: input.rows.map(
            (row): CanChargeRow => ({
                ...row,
                providerCancelledAfterRejection: row.providerCancelledAfterRejection ?? false
            })
        ),
        openUnconfirmedCancellationMarks: input.marks ?? 0,
        now: input.at ?? now,
        rereadWindowDays: WINDOW_DAYS
    });
}

const LIVE_BUT_SCHEDULED = [
    'PENDING_AUTHORIZATION',
    'ACTIVE',
    'GRACE_PERIOD',
    'PAUSED',
    'SUSPENDED'
] as const;
const TERMINALS = ['CANCELLED', 'ABANDONED', 'CHARGE_DECLINED'] as const;

describe('decideCanCharge (AC:B4:5, AC:B4:6)', () => {
    it.each(LIVE_BUT_SCHEDULED)('rule 1: a %s row counts whatever its column says', (status) => {
        // Arrange
        const rows = [
            { status, hasProviderLink: true, cancelledSeenAt: seenAt },
            { status, hasProviderLink: true, cancelledSeenAt: null },
            { status, hasProviderLink: false, cancelledSeenAt: null }
        ];

        // Act
        const answers = rows.map((row) => decide({ rows: [row] }));

        // Assert
        expect(answers).toEqual([true, true, true]);
    });

    it('rule 2 and I-4: a CANCEL_SCHEDULED counts until its cancellation is seen', () => {
        // Arrange
        const unseen = { status: 'CANCEL_SCHEDULED', hasProviderLink: true, cancelledSeenAt: null };
        const seen = { status: 'CANCEL_SCHEDULED', hasProviderLink: true, cancelledSeenAt: seenAt };
        const unlinked = {
            status: 'CANCEL_SCHEDULED',
            hasProviderLink: false,
            cancelledSeenAt: null
        };

        // Act
        const answers = {
            unseen: decide({ rows: [unseen] }),
            seen: decide({ rows: [seen] }),
            unlinked: decide({ rows: [unlinked] })
        };

        // Assert
        expect(answers).toEqual({ unseen: true, seen: false, unlinked: true });
    });

    it.each(TERMINALS)('rule 2 and I-4: a %s row counts only while linked and unseen', (status) => {
        // Arrange
        const unseen = { status, hasProviderLink: true, cancelledSeenAt: null };
        const unlinked = { status, hasProviderLink: false, cancelledSeenAt: null };
        const longSeen = {
            status,
            hasProviderLink: true,
            cancelledSeenAt: new Date(now.getTime() - 30 * DAY_MS)
        };

        // Act
        const answers = {
            unseen: decide({ rows: [unseen] }),
            unlinked: decide({ rows: [unlinked] }),
            longSeen: decide({ rows: [longSeen] })
        };

        // Assert
        expect(answers).toEqual({ unseen: true, unlinked: false, longSeen: false });
    });

    it.each(['CANCELLED', 'ABANDONED'] as const)(
        'rule 5: a %s row with its cancellation seen a minute ago no longer counts',
        (status) => {
            // Arrange
            const row = {
                status,
                hasProviderLink: true,
                cancelledSeenAt: new Date(now.getTime() - 60_000)
            };

            // Act
            const answer = decide({ rows: [row] });

            // Assert
            expect(answer).toBe(false);
        }
    );

    it('rule 3 (I-2, I-3): a CHARGE_DECLINED counts until the 16th deadline ends, exclusive', () => {
        // Arrange
        const row = { status: 'CHARGE_DECLINED', hasProviderLink: true, cancelledSeenAt: seenAt };
        const base = seenAt.getTime();
        const instants = {
            seenAt: new Date(base),
            day6: new Date(base + 6 * DAY_MS),
            justBefore: new Date(base + 7 * DAY_MS - 1),
            boundary: new Date(base + 7 * DAY_MS),
            minuteAfter: new Date(base + 7 * DAY_MS + 60_000)
        };

        // Act
        const answers = Object.fromEntries(
            Object.entries(instants).map(([name, at]) => [name, decide({ rows: [row], at })])
        );

        // Assert
        expect(answers).toEqual({
            seenAt: true,
            day6: true,
            justBefore: true,
            boundary: false,
            minuteAfter: false
        });
    });

    it('TEST:1676:2 rule 3: the mirror CANCELLED after a rejection counts until the 16th deadline ends', () => {
        // Arrange
        const afterRejection = {
            status: 'CANCELLED',
            hasProviderLink: true,
            cancelledSeenAt: seenAt,
            providerCancelledAfterRejection: true
        };
        const plainCancelled = {
            status: 'CANCELLED',
            hasProviderLink: true,
            cancelledSeenAt: seenAt,
            providerCancelledAfterRejection: false
        };
        const declined = {
            status: 'CHARGE_DECLINED',
            hasProviderLink: true,
            cancelledSeenAt: seenAt,
            providerCancelledAfterRejection: false
        };
        const base = seenAt.getTime();
        const instants = {
            seenAt: new Date(base),
            day6: new Date(base + 6 * DAY_MS),
            boundary: new Date(base + 7 * DAY_MS)
        };
        const answersFor = (row: TestRow) =>
            Object.fromEntries(
                Object.entries(instants).map(([name, at]) => [name, decide({ rows: [row], at })])
            );

        // Act
        const answers = {
            afterRejection: answersFor(afterRejection),
            plainCancelled: answersFor(plainCancelled),
            declined: answersFor(declined)
        };

        // Assert
        expect(answers).toEqual({
            afterRejection: { seenAt: true, day6: true, boundary: false },
            plainCancelled: { seenAt: false, day6: false, boundary: false },
            declined: { seenAt: true, day6: true, boundary: false }
        });
    });

    it('rule 4: an open CANCELACION_SIN_CONFIRMAR mark answers yes over a seen cancellation', () => {
        // Arrange
        const row = { status: 'CANCELLED', hasProviderLink: true, cancelledSeenAt: seenAt };

        // Act
        const answers = {
            withMark: decide({ rows: [row], marks: 1 }),
            withoutMark: decide({ rows: [row], marks: 0 })
        };

        // Assert
        expect(answers).toEqual({ withMark: true, withoutMark: false });
    });

    it('rule 5: an account without subscriptions answers no', () => {
        // Arrange
        const rows: CanChargeRow[] = [];

        // Act
        const answer = decide({ rows });

        // Assert
        expect(answer).toBe(false);
    });

    it('answers yes when one of several rows still counts', () => {
        // Arrange
        const rows = [
            { status: 'CANCELLED', hasProviderLink: true, cancelledSeenAt: seenAt },
            { status: 'ABANDONED', hasProviderLink: false, cancelledSeenAt: null },
            { status: 'SUSPENDED', hasProviderLink: true, cancelledSeenAt: seenAt }
        ];

        // Act
        const answer = decide({ rows });

        // Assert
        expect(answer).toBe(true);
    });
});

describe('cancellationRereadWindowEndsAt (I-3)', () => {
    it('ends the window the given days after the first re-read that saw it cancelled', () => {
        // Arrange
        const input = { seenAt, days: WINDOW_DAYS };

        // Act
        const endsAt = cancellationRereadWindowEndsAt(input);

        // Assert
        expect(endsAt).toEqual(new Date('2026-10-12T12:00:00.000Z'));
    });
});
