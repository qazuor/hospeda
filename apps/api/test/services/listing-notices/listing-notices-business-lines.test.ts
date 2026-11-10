import type { CoverageResponse } from '@repo/billing-verticals-contract';
import type { ListingBusinessLinesChangeFact, ListingNoticeRow } from '@repo/db';
import { type ListingNotice, PublicationStatusEnum as S } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { buildListingNoticeItems } from '../../../src/services/listing-notices/listing-notices.builder';

const ID = '44444444-4444-4444-8444-444444444444';
const NOW = new Date('2026-10-13T12:00:00.000Z');
const DAY = 86_400_000;
const daysAgo = (days: number) => new Date(NOW.getTime() - days * DAY);
const UNCOVERED: CoverageResponse = { covered: false, sources: [] };

function row(args: {
    readonly status?: S;
    readonly change?: ListingBusinessLinesChangeFact | null;
}): ListingNoticeRow {
    return {
        id: ID,
        publicationStatus: args.status ?? S.PUBLISHED,
        deletionAnnouncedAt: null,
        enteredCurrentStatus: null,
        lastLift: null,
        openFixRequest: null,
        lastBusinessLinesChange:
            args.change === undefined
                ? {
                      at: daysAgo(2),
                      actorType: 'admin',
                      before: ['food'],
                      after: ['food', 'nightlife']
                  }
                : args.change
    };
}

function noticesOf(args: {
    readonly row: ListingNoticeRow;
    readonly vertical?: 'accommodation' | 'venue' | 'experience';
}): readonly ListingNotice[] {
    const [item] = buildListingNoticeItems({
        rows: [args.row],
        coverage: UNCOVERED,
        now: NOW,
        ...(args.vertical === undefined ? {} : { vertical: args.vertical })
    });
    return item?.notices ?? [];
}

function businessLines(notice: ListingNotice | undefined) {
    return notice?.kind === 'BUSINESS_LINES_CHANGED' ? notice : undefined;
}

describe('TEST:7.3:9 BUSINESS_LINES_CHANGED (HOS-1875, DEC-FAC-056)', () => {
    it('shows an admin change inside the window with the lines and sections it moved', () => {
        // Act
        const notice = businessLines(
            noticesOf({
                row: row({
                    change: {
                        at: daysAgo(29),
                        actorType: 'admin',
                        before: ['food'],
                        after: ['food', 'nightlife']
                    }
                }),
                vertical: 'venue'
            }).find((candidate) => candidate.kind === 'BUSINESS_LINES_CHANGED')
        );

        // Assert
        expect(notice).toEqual({
            kind: 'BUSINESS_LINES_CHANGED',
            at: daysAgo(29).toISOString(),
            addedLines: ['nightlife'],
            removedLines: [],
            shownSections: ['nightInfo'],
            hiddenSections: []
        });
    });

    it('hides a change older than the 30-day window', () => {
        // Act
        const notices = noticesOf({
            row: row({
                change: {
                    at: daysAgo(31),
                    actorType: 'admin',
                    before: ['food'],
                    after: ['food', 'nightlife']
                }
            }),
            vertical: 'venue'
        });

        // Assert
        expect(notices).toEqual([]);
    });

    it("hides the notice when the last change is the owner's own", () => {
        // Act
        const notices = noticesOf({
            row: row({
                change: {
                    at: daysAgo(2),
                    actorType: 'owner',
                    before: ['food', 'nightlife'],
                    after: ['food']
                }
            }),
            vertical: 'venue'
        });

        // Assert
        expect(notices).toEqual([]);
    });

    it('hides the notice on a PURGED listing', () => {
        // Act
        const notices = noticesOf({ row: row({ status: S.PURGED }), vertical: 'venue' });

        // Assert
        expect(notices.map((notice) => notice.kind)).not.toContain('BUSINESS_LINES_CHANGED');
    });

    it('hides the notice when the change moved no line', () => {
        // Act
        const notices = noticesOf({
            row: row({
                change: {
                    at: daysAgo(2),
                    actorType: 'admin',
                    before: ['food'],
                    after: ['food']
                }
            }),
            vertical: 'venue'
        });

        // Assert
        expect(notices).toEqual([]);
    });

    it('hides the notice without a vertical, and for a vertical without business lines', () => {
        // Act
        const withoutVertical = noticesOf({ row: row({}) });
        const accommodation = noticesOf({ row: row({}), vertical: 'accommodation' });

        // Assert
        expect(withoutVertical).toEqual([]);
        expect(accommodation).toEqual([]);
    });
});
