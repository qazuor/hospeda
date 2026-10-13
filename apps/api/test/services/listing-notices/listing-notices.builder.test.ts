import type { CoverageResponse } from '@repo/billing-verticals-contract';
import type { ListingNoticeRow, ListingStatusChangeFact } from '@repo/db';
import { PublicationStatusEnum as S, TrialStatusEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import {
    buildListingNoticeItems,
    buildTrialSummary,
    isTrialRunning
} from '../../../src/services/listing-notices/listing-notices.builder';

const ID = '44444444-4444-4444-8444-444444444444';
const NOW = new Date('2026-10-13T12:00:00.000Z');
const DAY = 86_400_000;
const daysAgo = (days: number) => new Date(NOW.getTime() - days * DAY);
const UNCOVERED: CoverageResponse = { covered: false, sources: [] };
const COVERED = { covered: true, sources: [] } as unknown as CoverageResponse;

function fact(
    args: Partial<ListingStatusChangeFact> & { readonly to: S }
): ListingStatusChangeFact {
    return {
        listingId: ID,
        from: null,
        actorType: 'owner',
        reason: null,
        occurredAt: daysAgo(1),
        correlationId: 'c-1',
        archiveOrigin: null,
        ...args
    };
}

function row(
    args: Partial<ListingNoticeRow> & { readonly publicationStatus: S }
): ListingNoticeRow {
    return {
        id: ID,
        deletionAnnouncedAt: null,
        enteredCurrentStatus: null,
        lastLift: null,
        openFixRequest: null,
        ...args
    };
}

function addon(until: Date | 'NO_KNOWN_DATE', target: string = ID) {
    return {
        type: 'ADDON',
        reference: { kind: 'ADDON_VERSION', id: '55555555-5555-4555-8555-555555555555' },
        scope: 'LISTING',
        target,
        since: daysAgo(10),
        until,
        charged: null,
        floor: null
    };
}

function noticesOf(input: {
    readonly row: ListingNoticeRow;
    readonly coverage?: CoverageResponse;
}) {
    const [item] = buildListingNoticeItems({
        rows: [input.row],
        coverage: input.coverage ?? UNCOVERED,
        now: NOW
    });
    return item?.notices ?? [];
}

describe('TEST:V8a:5 row 20 — a listing purged by the inactivity job', () => {
    it('is PURGED_BY_INACTIVITY when the job moved it to PURGED', () => {
        // Arrange
        const purged = row({
            publicationStatus: S.PURGED,
            enteredCurrentStatus: fact({ from: S.ARCHIVED, to: S.PURGED, actorType: 'job' })
        });

        // Act
        const notices = noticesOf({ row: purged });

        // Assert
        expect(notices).toEqual([{ kind: 'PURGED_BY_INACTIVITY' }]);
    });

    it('PB12 by the owner is NOT inactivity', () => {
        // Arrange
        const purged = row({
            publicationStatus: S.PURGED,
            enteredCurrentStatus: fact({ from: S.ARCHIVED, to: S.PURGED, actorType: 'owner' })
        });

        // Act
        const notices = noticesOf({ row: purged });

        // Assert
        expect(notices).toEqual([{ kind: 'PURGED' }]);
    });
});

describe('TEST:V8a:7 one notice per kind (AC:V8a:6)', () => {
    it('row 31: PB12 over a MODERATED listing is PURGED_FROM_MODERATION', () => {
        // Arrange
        const purged = row({
            publicationStatus: S.PURGED,
            enteredCurrentStatus: fact({ from: S.MODERATED, to: S.PURGED, actorType: 'admin' })
        });

        // Act + Assert
        expect(noticesOf({ row: purged })).toEqual([{ kind: 'PURGED_FROM_MODERATION' }]);
    });

    it('a PURGED listing without a recorded transition is a plain PURGED', () => {
        // Act + Assert
        expect(noticesOf({ row: row({ publicationStatus: S.PURGED }) })).toEqual([
            { kind: 'PURGED' }
        ]);
    });

    it('row 18: a PB4 archive returns on its own and carries the announced date', () => {
        // Arrange
        const archived = row({
            publicationStatus: S.ARCHIVED,
            deletionAnnouncedAt: new Date('2027-01-10T00:00:00.000Z'),
            enteredCurrentStatus: fact({ from: S.PUBLISHED, to: S.ARCHIVED, actorType: 'job' })
        });

        // Act + Assert
        expect(noticesOf({ row: archived })).toEqual([
            {
                kind: 'ARCHIVED',
                deletionAnnouncedAt: '2027-01-10T00:00:00.000Z',
                returnsOnItsOwn: true
            }
        ]);
    });

    it('row 18: a PB4 archive from UNPUBLISHED_BY_BILLING returns on its own', () => {
        // Arrange
        const archived = row({
            publicationStatus: S.ARCHIVED,
            enteredCurrentStatus: fact({
                from: S.UNPUBLISHED_BY_BILLING,
                to: S.ARCHIVED,
                actorType: 'job'
            })
        });

        // Act + Assert
        expect(noticesOf({ row: archived })).toEqual([
            { kind: 'ARCHIVED', deletionAnnouncedAt: null, returnsOnItsOwn: true }
        ]);
    });

    it('row 18: PB5 (an archived draft) does not return on its own', () => {
        // Arrange
        const archived = row({
            publicationStatus: S.ARCHIVED,
            enteredCurrentStatus: fact({ from: S.DRAFT, to: S.ARCHIVED, actorType: 'job' })
        });

        // Act + Assert
        expect(noticesOf({ row: archived })).toEqual([
            { kind: 'ARCHIVED', deletionAnnouncedAt: null, returnsOnItsOwn: false }
        ]);
    });

    it('row 24: MODERATED carries the reason and since when', () => {
        // Arrange
        const moderated = row({
            publicationStatus: S.MODERATED,
            enteredCurrentStatus: fact({
                from: S.PUBLISHED,
                to: S.MODERATED,
                actorType: 'admin',
                reason: 'Fotos ajenas',
                occurredAt: daysAgo(2)
            })
        });

        // Act + Assert
        expect(noticesOf({ row: moderated })).toEqual([
            { kind: 'MODERATED', reason: 'Fotos ajenas', since: daysAgo(2).toISOString() }
        ]);
    });

    it('row 30: an open fix request is FIX_REQUESTED with its report', () => {
        // Arrange
        const published = row({
            publicationStatus: S.PUBLISHED,
            openFixRequest: {
                id: 'f-1',
                reason: 'Horario',
                suggestedDate: '2026-10-20',
                openedAt: daysAgo(3),
                openedById: 'admin',
                ownerReportedFixedAt: daysAgo(1)
            }
        });

        // Act + Assert
        expect(noticesOf({ row: published })).toEqual([
            {
                kind: 'FIX_REQUESTED',
                reason: 'Horario',
                suggestedDate: '2026-10-20',
                openedAt: daysAgo(3).toISOString(),
                ownerReportedFixedAt: daysAgo(1).toISOString()
            }
        ]);
    });

    it('row 30: a lift of 29 days ago says where the listing went', () => {
        // Arrange
        const draft = row({
            publicationStatus: S.DRAFT,
            lastLift: { at: daysAgo(29), returnedTo: S.DRAFT }
        });

        // Act + Assert
        expect(noticesOf({ row: draft })).toEqual([
            {
                kind: 'MODERATION_LIFTED',
                returnedTo: S.DRAFT,
                at: daysAgo(29).toISOString(),
                fixRequestOpen: false
            }
        ]);
    });

    it('row 30: a lift of 31 days ago is not shown', () => {
        // Arrange
        const draft = row({
            publicationStatus: S.DRAFT,
            lastLift: { at: daysAgo(31), returnedTo: S.DRAFT }
        });

        // Act + Assert
        expect(noticesOf({ row: draft })).toEqual([]);
    });

    it('row 30: a lift is not shown once the listing is moderated again', () => {
        // Arrange
        const moderated = row({
            publicationStatus: S.MODERATED,
            lastLift: { at: daysAgo(5), returnedTo: S.DRAFT }
        });

        // Act
        const kinds = noticesOf({ row: moderated }).map((notice) => notice.kind);

        // Assert
        expect(kinds).toEqual(['MODERATED']);
    });

    it('rows 8 and 9: UNPUBLISHED_BY_BILLING while covered is SURPLUS', () => {
        // Act + Assert
        expect(
            noticesOf({
                row: row({ publicationStatus: S.UNPUBLISHED_BY_BILLING }),
                coverage: COVERED
            })
        ).toEqual([{ kind: 'SURPLUS' }]);
    });

    it('UNPUBLISHED_BY_BILLING without coverage is NOT surplus', () => {
        // Act + Assert
        expect(noticesOf({ row: row({ publicationStatus: S.UNPUBLISHED_BY_BILLING }) })).toEqual(
            []
        );
    });

    it('DRAFT and PUBLISHED carry no status notice', () => {
        // Act + Assert
        expect(noticesOf({ row: row({ publicationStatus: S.DRAFT }) })).toEqual([]);
        expect(noticesOf({ row: row({ publicationStatus: S.PUBLISHED }) })).toEqual([]);
    });
});

describe('TEST:V8a:7 recurring listing add-ons (H7)', () => {
    it('counts only add-ons on this listing with no known end; one with a date does not count', () => {
        // Arrange
        const coverage = {
            covered: false,
            sources: [
                addon('NO_KNOWN_DATE'),
                addon('NO_KNOWN_DATE'),
                addon(new Date('2026-12-01T00:00:00.000Z')),
                addon('NO_KNOWN_DATE', '66666666-6666-4666-8666-666666666666')
            ]
        } as unknown as CoverageResponse;

        // Act
        const [item] = buildListingNoticeItems({
            rows: [row({ publicationStatus: S.PUBLISHED })],
            coverage,
            now: NOW
        });

        // Assert
        expect(item?.recurringListingAddons).toBe(2);
        expect(item?.listingId).toBe(ID);
        expect(item?.publicationStatus).toBe(S.PUBLISHED);
    });
});

describe('TEST:V8a:7 row 2 and row 4 — the trial', () => {
    it('is running only while TRIAL_ACTIVE with a future end', () => {
        // Arrange
        const active = { status: 'TRIAL_ACTIVE', startedAt: daysAgo(5), endsAt: daysAgo(-1) };

        // Act + Assert
        expect(isTrialRunning({ trial: active, now: NOW }).running).toBe(true);
        expect(isTrialRunning({ trial: { ...active, endsAt: daysAgo(1) }, now: NOW }).running).toBe(
            false
        );
        expect(
            isTrialRunning({ trial: { ...active, status: 'TRIAL_EXPIRED' }, now: NOW }).running
        ).toBe(false);
        expect(isTrialRunning({ trial: null, now: NOW }).running).toBe(false);
    });

    it('sums the total days and splits base, promo and support', () => {
        // Arrange
        const trial = {
            status: TrialStatusEnum.TRIAL_ACTIVE,
            startedAt: new Date('2026-10-01T00:00:00.000Z'),
            endsAt: new Date('2026-11-15T00:00:00.000Z')
        };

        // Act
        const summary = buildTrialSummary({ trial, promoDays: 10, supportDays: 5 });

        // Assert
        expect(summary).toEqual({
            status: 'TRIAL_ACTIVE',
            startedAt: '2026-10-01T00:00:00.000Z',
            endsAt: '2026-11-15T00:00:00.000Z',
            totalDays: 45,
            origins: { base: 30, promo: 10, support: 5 }
        });
    });

    it('answers NONE without a trial row and zero days for a row born consumed', () => {
        // Act + Assert
        expect(buildTrialSummary({ trial: null, promoDays: 0, supportDays: 0 })).toEqual({
            status: 'NONE'
        });
        expect(
            buildTrialSummary({
                trial: { status: 'TRIAL_EXPIRED', startedAt: null, endsAt: null },
                promoDays: 0,
                supportDays: 0
            })
        ).toEqual({
            status: 'TRIAL_EXPIRED',
            startedAt: null,
            endsAt: null,
            totalDays: 0,
            origins: { base: 0, promo: 0, support: 0 }
        });
    });
});
